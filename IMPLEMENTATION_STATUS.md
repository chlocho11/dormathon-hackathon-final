# Implementation Status

_Last updated: 2026-10-10_

| Phase | Status |
|---|---|
| 0. Scaffold | Done |
| 1. Database & Gateway | Done (mock provider; real Anthropic call not yet verified, no key supplied) |
| 2. Data & ML | Next |
| 3. Decision & Cache | Not started |
| 4. Dashboard | Route skeleton only |
| 5. E2E, Deploy, Demo | Not started |

## Phase 1: Database & Gateway (done)

### Completed
- **Schema** ([app/models.py](apps/api/app/models.py), migration [0001](apps/api/alembic/versions/0001_initial_schema.py)): all 16 tables from §5 with UUID PKs, UTC timestamptz, workspace FKs and time-series indexes, `vector(384)` embedding columns (pgvector), and check constraints for non-negative tokens and cost, the `cache_status`/`data_origin` enums, the policy similarity threshold (0.95–0.99), and roles. Cache rows cascade-delete with their FAQ entry. `policy_audit` is append-only, enforced by a DB trigger that rejects UPDATE/DELETE. RLS is enabled on every table with no policies, which denies direct Supabase client access (the backend connects as owner). Additions beyond §5: `faq_entries.aliases`, `api_requests.faq_intent_key/similarity_score` (safe-cache diagnostics, no text), `policies.version/holdout_enabled`, `recommendations.version/application_id`, `forecast_runs.run_key` (idempotency), `anomaly_events.end_day/estimated_impact_myr`.
- **Auth** ([app/auth.py](apps/api/app/auth.py)): Supabase JWT via JWKS (RS256/ES256) with audience and issuer checks; local HS256 dev tokens only outside production and when JWKS is not configured; `require_member` enforces workspace membership (404 for non-members) and owner role (403). Scoped BakeryBot chat tokens (30 min, single workspace + app, rejected by owner endpoints). Hashed application API keys: shown once, rotation invalidates the old key, and rotations are audited.
- **Gateway** ([app/services/chat.py](apps/api/app/services/chat.py), [api/chat.py](apps/api/app/api/chat.py)): `POST /chat/session`, `POST /chat`. Input is trimmed and capped at 1,000 chars with a locale pattern; output is capped at 250 tokens with a 25s timeout. Requests are rate-limited per IP, app and workspace. The system prompt is built from the approved FAQ for the current knowledge version. Each miss makes exactly one provider call; the SDK retries transient errors with bounded backoff. Provider errors are logged with zero cost, return a sanitized 502, and are never cached. Request categories are assigned deterministically (static_faq / order_enquiry / complex_support / other) with no LLM.
- **Anthropic adapter** ([anthropic_adapter.py](apps/api/app/services/anthropic_adapter.py)): live provider (official SDK, model validated at startup with an actionable error) plus a deterministic mock that never touches the network and is recorded as provider `anthropic-mock`.
- **Cost ledger** ([costing.py](apps/api/app/services/costing.py), [usage_logger.py](apps/api/app/services/usage_logger.py)): costs are computed from actual token counts (input, output, cache read, cache write) using the versioned price catalog and the fixed demo FX rate (4.70 MYR/USD, labelled as an estimate). The ledger stores metadata only. The fingerprint is an HMAC of the normalized message; raw text is never stored.
- **Fixtures**: [bakery_faq.json](apps/api/app/fixtures/bakery_faq.json) has 10 approved intents with aliases, all demo-only. [pricing.json](apps/api/app/fixtures/pricing.json) has Haiku 4.5, Sonnet 4.5 and Opus 4.1 rates recorded from Anthropic's public pricing as of Oct 2025, stored with `verified_at = null` and **not re-verified live**.
- **Settings**: `GET /me`, `GET/PATCH /settings/workspace` (owner-only patch, audited), `POST /applications/{id}/rotate-key`.
- **Dev/demo**: `POST /auth/dev-login`, `POST /demo/seed`, `POST /demo/reset` (the audit log is kept). All return 404 in production or when `DEMO_MODE=false`.
- **Bootstrap job** `python -m app.jobs.bootstrap` is idempotent and runs on container start. It can grant owner rights to a real Supabase user via `OWNER_AUTH_USER_ID`.
- **Docker-free Postgres**: [scripts/local_db.py](apps/api/scripts/local_db.py) runs embedded PostgreSQL 16.2 + pgvector 0.6.2 via `pgserver`.
- **Smoke test**: [scripts/smoke_test.py](scripts/smoke_test.py) uses only the standard library and sends one chat request (billed in live mode; `--no-chat` skips it).
- CI: the API job now runs against a `pgvector/pgvector:pg16` service container.

### Verified (2026-10-10)
| Check | Result |
|---|---|
| `alembic upgrade head` → `downgrade base` → `upgrade head`, then `alembic check` | clean; no model/migration drift |
| `ruff check`, `ruff format --check` | pass |
| `pytest` (real Postgres + pgvector, mock Anthropic) | **47 passed** |
| Live server + `scripts/smoke_test.py --seed` | all checks PASS (health ok, DB ok, seed, chat session, chat miss with usage 521 in / 38 out, cost RM0.0033417, chat token rejected on `/me`) |
| Ledger row check | `anthropic-mock`, `static_faq`, `miss`, cost matches (521×$1 + 38×$5)/1M × 4.70 by hand |
| Bootstrap job run twice | idempotent |

Test coverage by file: `test_auth` (invalid/expired/wrong-aud/wrong-iss/wrong-secret tokens, chat-token scope, dev endpoints hidden outside demo, JWKS mode disables dev tokens, viewer vs owner, production config guards), `test_chat` (single provider call per miss, ledger values and cost, no raw text persisted, keyed fingerprint, provider failure not cached, validation, app keys, rate limit, categories), `test_tenant_isolation` (workspace A cannot read, patch, rotate or chat with B), `test_db_integrity` (immutable audit, non-negative constraint, threshold range, RLS on all tables, idempotent seed), `test_costing`, `test_anthropic_adapter` (real SDK against an offline HTTP mock: usage parsed from response metadata, request shape, error mapping).

### Known limitations / notes
- **No real Anthropic request has been made.** This needs `ANTHROPIC_API_KEY`; once supplied, run `scripts/smoke_test.py` once in live mode.
- Mock-mode gateway traffic is stored with `data_origin='real'` (it went through the real gateway) but `provider='anthropic-mock'`, and the dashboard must label it as mock (Phase 4).
- The rate limiter is in-process (single instance only).
- The chat is single-turn: `conversation_id` is accepted, but conversation history is never stored, for privacy.
- The Anthropic SDK (1.13) now ships on `httpx2`; the adapter test uses `httpx2.MockTransport`.
- Supabase JWKS verification is implemented but untested against a live Supabase project (no account supplied). The test confirms that dev tokens are refused once JWKS is configured.
- The safe FAQ cache is not active yet: every chat is a `miss`. This is Phase 3.

## Phase 0: Scaffold (done)
Monorepo per §4; FastAPI app factory with error envelope, request IDs, security headers, and a CORS allowlist; Next.js 15 + Tailwind v4 shell with §14 design tokens, a responsive sidebar and all routes as honest "no data yet" placeholders; `.env.example`, `.gitignore`, `docker-compose.yml`, `Makefile`, `render.yaml`, and CI. Verified: web lint, typecheck and build pass; all 10 routes return 200 on a local boot.

Environment notes: this machine has no Docker or `make`; `uv` was installed via pip (`python3 -m uv`). The API is pinned to Python 3.12 (uv-managed).

## Next: Phase 2 (Data & ML)
`scripts/generate_synthetic.py` (seed 42, 180 days, 3 apps × 4 categories, labelled anomalies A1–A8, scenario truth, manifest), loading into `daily_usage` as `synthetic`, daily aggregation of real traffic, baseline forecasts (naive, seasonal naive, rolling mean) and HistGradientBoosting with a chronological split, rolling-origin backtests, conformal intervals, the anomaly detector (robust seasonal MAD + IsolationForest) with held-out evaluation, and model artifacts plus model card.
