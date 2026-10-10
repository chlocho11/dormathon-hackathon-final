import hashlib
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.auth import (
    ChatScope,
    CurrentUser,
    DbSession,
    _bearer,
    decode_chat_token,
    decode_user_token,
    get_membership,
    issue_chat_token,
    require_member,
)
from app.config import get_settings
from app.errors import ApiError
from app.models import Application, Workspace
from app.ratelimit import check_chat_limits, limiter
from app.schemas import (
    ChatComparisonResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionResponse,
    ChatUsage,
    ComparisonArm,
    ComparisonError,
)
from app.services.anthropic_adapter import ChatProvider, get_provider
from app.services.cache import cache_policy
from app.services.chat import ChatResult, handle_chat
from app.services.costing import PricingNotFound, get_rates
from app.services.seed import chat_application

router = APIRouter(tags=["chat"])


def hash_app_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _authorize_app(
    session: DbSession,
    application_id,
    creds: HTTPAuthorizationCredentials | None,
    app_key: str | None,
) -> tuple[Application, str]:
    """Accept a scoped chat token, a hashed application key, or a member's user JWT.

    Returns the application and a client key (session / user / key holder) used only as an HMAC
    input so retries can be told apart from different customers asking the same question.
    """
    not_found = ApiError(404, "not_found", "Application not found.")
    app = session.get(Application, application_id)
    if app is None or not app.is_active:
        raise not_found
    if app_key:
        if app.app_key_hash and app.app_key_hash == hash_app_key(app_key):
            return app, f"key:{app.id}"
        raise ApiError(401, "unauthorized", "Invalid application key.")
    if creds is None:
        raise ApiError(401, "unauthorized", "Missing or invalid credentials.")
    scope: ChatScope | None = decode_chat_token(creds.credentials)
    if scope is not None:
        if scope.application_id != app.id or scope.workspace_id != app.workspace_id:
            raise not_found
        return app, f"chat:{scope.session_id}"
    principal = decode_user_token(creds.credentials)
    if get_membership(session, app.workspace_id, principal.user_id) is None:
        raise not_found
    return app, f"user:{principal.user_id}"


@router.post("/chat/session", response_model=ChatSessionResponse)
def create_chat_session(request: Request, session: DbSession) -> ChatSessionResponse:
    """Issue a short-lived token scoped to the public BakeryBot demo application only."""
    limiter.check({f"session-ip:{_client_ip(request)}": get_settings().rate_limit_ip_per_min})
    app = chat_application(session)
    if app is None or not app.is_active:
        raise ApiError(503, "demo_not_seeded", "The demo bakery workspace has not been set up yet.")
    ws = session.get(Workspace, app.workspace_id)
    token, exp = issue_chat_token(ChatScope(workspace_id=app.workspace_id, application_id=app.id))
    return ChatSessionResponse(token=token, expires_at=exp, application_id=app.id, workspace_name=ws.name)


@router.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    request: Request,
    session: DbSession,
    provider: Annotated[ChatProvider, Depends(get_provider)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    x_app_key: Annotated[str | None, Header()] = None,
) -> ChatResponse:
    app, client_key = _authorize_app(session, body.application_id, creds, x_app_key)
    check_chat_limits(_client_ip(request), str(app.id), str(app.workspace_id))
    result = handle_chat(session, provider, app, body.message, body.locale, client_key)
    return _chat_response(result)


def _chat_response(result: ChatResult) -> ChatResponse:
    if result.cache_status in ("exact_hit", "semantic_hit"):
        mode = "none"
    else:
        mode = "mock" if result.provider.endswith("-mock") else "live"
    return ChatResponse(
        reply=result.reply,
        cache_status=result.cache_status,
        usage=ChatUsage(input_tokens=result.usage.input_tokens, output_tokens=result.usage.output_tokens),
        estimated_cost_myr=float(result.estimated_cost_myr),
        request_id=result.request_id,
        provider_mode=mode,
        request_category=result.request_category,
        cache_decision=result.cache_decision,
        faq_intent_key=result.faq_intent_key,
        similarity=result.similarity,
    )


@router.post("/chat/compare", response_model=ChatComparisonResponse)
def compare_chat(
    body: ChatRequest,
    request: Request,
    session: DbSession,
    principal: CurrentUser,
    provider: Annotated[ChatProvider, Depends(get_provider)],
) -> ChatComparisonResponse:
    app = session.get(Application, body.application_id)
    if app is None or not app.is_active:
        raise ApiError(404, "not_found", "Application not found.")
    require_member(session, principal, app.workspace_id, role="owner")
    settings = get_settings()
    try:
        rates = get_rates(session, provider.model, settings.pricing_catalog_version)
    except PricingNotFound as exc:
        raise ApiError(503, "pricing_not_configured", "No price is configured for the active model.") from exc
    # Reserve both arms before making either potentially billed call.
    for _ in range(2):
        check_chat_limits(_client_ip(request), str(app.id), str(app.workspace_id))
    name = f"{app.name}_baseline"
    session.execute(
        insert(Application)
        .values(
            id=uuid.uuid4(),
            workspace_id=app.workspace_id,
            name=name,
        )
        .on_conflict_do_nothing(index_elements=["workspace_id", "name"])
    )
    session.commit()
    baseline_app = session.scalars(
        select(Application).where(
            Application.workspace_id == app.workspace_id,
            Application.name == name,
        )
    ).one()
    policy = cache_policy(session, app)
    enabled = bool(policy and policy.enabled)
    client_key = f"user:{principal.user_id}"

    def run_arm(target: Application, *, baseline_for: Application | None = None) -> ComparisonArm:
        try:
            result = handle_chat(
                session,
                provider,
                target,
                body.message,
                body.locale,
                client_key,
                baseline_for=baseline_for,
            )
            return ComparisonArm(response=_chat_response(result))
        except ApiError as exc:
            return ComparisonArm(error=ComparisonError(code=exc.code, message=exc.message))

    baseline = run_arm(baseline_app, baseline_for=app)
    optimized = run_arm(app)
    return ChatComparisonResponse(
        baseline=baseline,
        tokenguard=optimized,
        policy_enabled=enabled,
        provider_mode="mock" if provider.name.endswith("-mock") else "live",
        model=provider.model,
        pricing_catalog_version=rates.version,
        fx_myr_per_usd=settings.myr_per_usd_demo,
        input_usd_per_million=float(rates.input_usd_per_million),
        output_usd_per_million=float(rates.output_usd_per_million),
    )
