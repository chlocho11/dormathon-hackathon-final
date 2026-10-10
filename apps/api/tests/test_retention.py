from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from app.models import ApiRequest, DailyUsage, Policy, Workspace
from app.services.history import aggregate_real_usage


def test_retention_preserves_aggregates_and_tenant_boundaries(session, bakery_app, other_app):
    from app.services.retention import purge_expired_usage

    today = date(2026, 10, 11)
    now = datetime(2026, 10, 11, tzinfo=UTC)
    # Use the unseeded workspace so this regression is independent of ML module fixtures.
    ws = session.get(Workspace, other_app.workspace_id)
    for app, age in [(other_app, 31), (other_app, 30), (bakery_app, 31)]:
        session.add(
            ApiRequest(
                workspace_id=app.workspace_id,
                application_id=app.id,
                occurred_at=now - timedelta(days=age),
                provider="mock",
                model="test",
                request_category="static_faq",
                cache_status="miss",
                data_origin="real",
                request_fingerprint="test",
                pricing_version="test",
                estimated_cost_myr=1,
            )
        )
    session.commit()
    aggregate_real_usage(session, ws, through=today - timedelta(days=1))
    old_day = (now - timedelta(days=31)).date()
    session.add(
        DailyUsage(
            workspace_id=ws.id,
            application_id=other_app.id,
            day=today - timedelta(days=181),
            request_category="static_faq",
            model="test",
            requests=1,
            input_tokens=0,
            output_tokens=0,
            cost_myr=1,
            data_origin="real",
        )
    )
    session.commit()
    result = purge_expired_usage(session, ws, now=now)
    assert result["requests_deleted"] == 1
    assert result["aggregates_deleted"] == 1
    assert len(session.scalars(select(ApiRequest)).all()) == 2
    aggregate_real_usage(session, ws, through=today - timedelta(days=1))
    rows = session.scalars(
        select(DailyUsage).where(
            DailyUsage.workspace_id == ws.id,
            DailyUsage.model == "test",
        )
    ).all()
    assert {r.day for r in rows} == {old_day, (now - timedelta(days=30)).date()}
    assert sum(r.requests for r in rows) == 2
    assert purge_expired_usage(session, ws, now=now)["requests_deleted"] == 0
    for row in rows:
        session.delete(row)
    session.commit()


def test_measurement_window_matches_retained_metadata(session, bakery_app):
    from app.services.measurement import measure

    policy = session.scalars(
        select(Policy).where(
            Policy.application_id == bakery_app.id,
            Policy.policy_type == "semantic_cache",
        )
    ).one()
    policy.approved_at = datetime.now(UTC) - timedelta(days=60)
    session.commit()
    measurement = measure(session, bakery_app.workspace_id, None)
    row = next(r for r in measurement["applications"] if r["status"] != "never_enabled")
    assert row["days_observed"] <= 30
    assert "retention" in measurement["note"].lower()
