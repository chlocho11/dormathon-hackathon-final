from datetime import UTC, datetime

from sqlalchemy import select, update

from app.models import ApiRequest, Application, Policy
from app.services.anthropic_adapter import ProviderError


def compare(client, headers, app_id, message="What time do you open?"):
    return client.post(
        "/api/v1/chat/compare", headers=headers, json={"application_id": str(app_id), "message": message}
    )


def test_comparison_disabled_uses_same_prompt_and_records_both_arms(
    client,
    owner_headers,
    bakery_app,
    mock_provider,
    session,
    monkeypatch,
):
    calls = []
    original = mock_provider.complete

    def spy(system, message, max_tokens):
        calls.append((system, message, max_tokens))
        return original(system, message, max_tokens)

    monkeypatch.setattr(mock_provider, "complete", spy)
    response = compare(client, owner_headers, bakery_app.id)
    assert response.status_code == 200, response.text
    body = response.json()
    assert mock_provider.calls == 2
    assert calls[0] == calls[1]
    assert body["policy_enabled"] is False
    assert body["baseline"]["response"]["usage"]["input_tokens"] > 0
    assert body["tokenguard"]["response"]["usage"]["input_tokens"] > 0
    rows = session.scalars(select(ApiRequest)).all()
    assert len(rows) == 2
    assert len({row.application_id for row in rows}) == 2
    baseline = session.scalar(select(Application).where(Application.name == "bakery_demo_baseline"))
    assert baseline.workspace_id == bakery_app.workspace_id
    assert next(r for r in rows if r.application_id == baseline.id).cache_decision == "comparison_baseline"


def test_comparison_cache_avoids_only_tokenguard_call(client, owner_headers, bakery_app, mock_provider, session):
    session.execute(
        update(Policy).where(Policy.application_id == bakery_app.id).values(enabled=True, approved_at=datetime.now(UTC))
    )
    session.commit()
    for _ in range(2):
        body = compare(client, owner_headers, bakery_app.id).json()
        assert body["policy_enabled"] is True
        assert body["baseline"]["response"]["estimated_cost_myr"] > 0
        optimized = body["tokenguard"]["response"]
        assert optimized["cache_status"] == "exact_hit"
        assert optimized["usage"] == {"input_tokens": 0, "output_tokens": 0}
        assert optimized["estimated_cost_myr"] == 0
    assert mock_provider.calls == 2
    body = compare(client, owner_headers, bakery_app.id, "Is my order ready?").json()
    assert body["tokenguard"]["response"]["cache_status"] == "bypass"
    assert mock_provider.calls == 4


def test_comparison_partial_failure_preserves_other_arm(client, owner_headers, bakery_app, mock_provider):
    mock_provider.fail_next = ProviderError("provider_timeout")
    response = compare(client, owner_headers, bakery_app.id)
    assert response.status_code == 200
    body = response.json()
    assert body["baseline"]["response"] is None
    assert body["baseline"]["error"]["code"] == "provider_unavailable"
    assert body["tokenguard"]["response"]["usage"]["input_tokens"] > 0


def test_comparison_is_owner_only_and_tenant_scoped(
    client,
    viewer_headers,
    other_owner_headers,
    chat_headers,
    bakery_app,
    mock_provider,
):
    assert compare(client, viewer_headers, bakery_app.id).status_code == 403
    assert compare(client, other_owner_headers, bakery_app.id).status_code == 404
    assert compare(client, chat_headers, bakery_app.id).status_code == 401
    assert compare(client, {}, bakery_app.id).status_code == 401
    assert mock_provider.calls == 0
