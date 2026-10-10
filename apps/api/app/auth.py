"""Authentication and workspace authorization.

- Hosted: Supabase Auth JWTs verified against the project's JWKS with audience + issuer checks.
- Local/dev (no JWKS configured, not production): HS256 tokens signed with DEV_JWT_SECRET.
- BakeryBot: short-lived HS256 chat tokens scoped to one workspace + application, chat only.
Every workspace resource is checked against workspace_members; non-members get 404.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Annotated, Literal

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session
from app.errors import ApiError
from app.models import Workspace, WorkspaceMember

DEV_ISSUER = "tokenguard-dev"
CHAT_AUDIENCE = "tokenguard-chat"
Role = Literal["owner", "viewer"]

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    email: str | None = None
    is_guest: bool = False


@dataclass(frozen=True)
class Membership:
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role: Role


@dataclass(frozen=True)
class ChatScope:
    workspace_id: uuid.UUID
    application_id: uuid.UUID
    session_id: str | None = None  # token jti; identifies one chat session for retry detection


def _unauthorized(message: str = "Missing or invalid credentials.") -> ApiError:
    return ApiError(401, "unauthorized", message)


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def issue_dev_token(user_id: uuid.UUID, email: str | None = None, minutes: int = 480) -> str:
    settings = get_settings()
    if not settings.dev_auth_enabled:
        raise ApiError(403, "forbidden", "Dev tokens are disabled in this environment.")
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "aud": settings.supabase_jwt_audience,
        "iss": DEV_ISSUER,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    if email:
        claims["email"] = email
    return jwt.encode(claims, settings.dev_jwt_secret, algorithm="HS256")


def decode_user_token(token: str) -> Principal:
    settings = get_settings()
    try:
        if settings.supabase_jwks_url:
            key = _jwks_client(settings.supabase_jwks_url).get_signing_key_from_jwt(token).key
            issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1" if settings.supabase_url else None
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256", "ES256"],
                audience=settings.supabase_jwt_audience,
                issuer=issuer,
                options={"require": ["exp", "sub", "aud", "iss"], "verify_iss": issuer is not None},
            )
        elif settings.dev_auth_enabled:
            claims = jwt.decode(
                token,
                settings.dev_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_audience,
                issuer=DEV_ISSUER,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
        else:
            raise _unauthorized("No authentication method is configured.")
        return Principal(user_id=uuid.UUID(claims["sub"]), email=claims.get("email"))
    except (jwt.PyJWTError, ValueError) as exc:
        raise _unauthorized() from exc


def issue_chat_token(scope: ChatScope) -> tuple[str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    exp = now + timedelta(minutes=settings.chat_token_ttl_minutes)
    claims = {
        "aud": CHAT_AUDIENCE,
        "scope": "chat",
        "ws": str(scope.workspace_id),
        "app": str(scope.application_id),
        "iat": now,
        "exp": exp,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(claims, settings.effective_chat_token_secret, algorithm="HS256"), exp


def decode_chat_token(token: str) -> ChatScope | None:
    """Return the scope if this is a valid chat token, else None (caller may try user auth)."""
    try:
        claims = jwt.decode(
            token,
            get_settings().effective_chat_token_secret,
            algorithms=["HS256"],
            audience=CHAT_AUDIENCE,
            options={"require": ["exp", "aud", "ws", "app"]},
        )
    except jwt.PyJWTError:
        return None
    if claims.get("scope") != "chat":
        return None
    return ChatScope(
        workspace_id=uuid.UUID(claims["ws"]),
        application_id=uuid.UUID(claims["app"]),
        session_id=claims.get("jti"),
    )


def bearer_token(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> str:
    if creds is None or creds.scheme.lower() != "bearer":
        raise _unauthorized()
    return creds.credentials


def current_user(
    request: Request, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Principal:
    if request.headers.get("Authorization"):
        if creds is None:
            raise _unauthorized()
        return decode_user_token(creds.credentials)
    if get_settings().public_demo_enabled:
        # Scenario previews are calculated in a rolled-back transaction, without storing data.
        if request.method != "GET" and request.url.path != "/api/v1/scenarios/compare":
            raise ApiError(403, "read_only", "Public access is read-only. Sign in as an owner to make changes.")
        return Principal(uuid.UUID("00000000-0000-4000-8000-0000000000ff"), is_guest=True)
    raise _unauthorized()


def get_membership(session: Session, workspace_id: uuid.UUID, user_id: uuid.UUID) -> Membership | None:
    role = session.scalar(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.auth_user_id == user_id
        )
    )
    return None if role is None else Membership(workspace_id, user_id, role)


def require_member(
    session: Session, principal: Principal, workspace_id: uuid.UUID | None, role: Role | None = None
) -> Membership:
    """Resolve the workspace (defaulting to the user's only one) and enforce membership/role."""
    if principal.is_guest:
        public_id = session.scalar(
            select(Workspace.id).where(Workspace.slug == get_settings().public_demo_workspace_slug)
        )
        if public_id is None or (workspace_id is not None and workspace_id != public_id):
            raise ApiError(404, "not_found", "Workspace not found.")
        if role == "owner":
            raise ApiError(403, "read_only", "Public access is read-only.")
        return Membership(public_id, principal.user_id, "viewer")
    if workspace_id is None:
        ids = session.scalars(
            select(WorkspaceMember.workspace_id).where(WorkspaceMember.auth_user_id == principal.user_id)
        ).all()
        if len(ids) != 1:
            raise ApiError(400, "workspace_required", "Specify workspace_id.")
        workspace_id = ids[0]
    m = get_membership(session, workspace_id, principal.user_id)
    if m is None:
        raise ApiError(404, "not_found", "Workspace not found.")
    if role == "owner" and m.role != "owner":
        raise ApiError(403, "forbidden", "Only the workspace owner can perform this action.")
    return m


CurrentUser = Annotated[Principal, Depends(current_user)]
DbSession = Annotated[Session, Depends(get_session)]
