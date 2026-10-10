from fastapi import APIRouter

from app.config import get_settings
from app.db import ping_database

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """Readiness and dependency summary. Never includes secrets."""
    settings = get_settings()
    db = ping_database()
    return {
        "status": "ok" if db == "ok" else "degraded",
        "environment": settings.app_env,
        "dependencies": {
            "database": db,
            "anthropic": {"mode": settings.provider_mode, "model": settings.anthropic_model},
        },
        "demo_mode": settings.demo_mode,
        "pricing_catalog_version": settings.pricing_catalog_version,
    }
