"""Workspace-scoped retention, run only after complete-day usage aggregation."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import ApiRequest, DailyUsage, ResponseCache, Workspace


def purge_expired_usage(session: Session, ws: Workspace, *, now: datetime | None = None) -> dict:
    now = now or datetime.now(UTC)
    settings = get_settings()
    requests = session.execute(
        delete(ApiRequest).where(
            ApiRequest.workspace_id == ws.id,
            ApiRequest.occurred_at < now - timedelta(days=settings.request_retention_days),
        )
    )
    aggregates = session.execute(
        delete(DailyUsage).where(
            DailyUsage.workspace_id == ws.id,
            DailyUsage.day
            < now.astimezone(ZoneInfo(ws.timezone)).date() - timedelta(days=settings.aggregate_retention_days),
        )
    )
    caches = session.execute(
        delete(ResponseCache).where(
            ResponseCache.workspace_id == ws.id,
            ResponseCache.expires_at <= now,
        )
    )
    result = {
        "requests_deleted": requests.rowcount,
        "aggregates_deleted": aggregates.rowcount,
        "expired_cache_deleted": caches.rowcount,
    }
    session.commit()
    return result
