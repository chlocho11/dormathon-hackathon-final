# Implementation Status

_Last updated: 2026-10-10_

| Phase | Status |
|---|---|
| 0. Scaffold | Done |
| 1. Database & Gateway | Done (mock provider; real Anthropic call not yet verified, no key supplied) |
| 2. Data & ML | Done (all metrics on synthetic data) |
| 3. Decision & Cache | Next |
| 4. Dashboard | Route skeleton only |
| 5. E2E, Deploy, Demo | Not started |

## Phase 2: Data & ML (done)

### Completed
- **Synthetic generator** ([app/ml/synthetic.py](apps/api/app/ml/synthetic.py), CLI [scripts/generate_synthetic.py](scripts/generate_synthetic.py)): seed 42, 180 days, 3 apps × 4 categories. Counts use Poisson-gamma noise with weekday seasonality, trend, payday and campaign peaks, and AR(1) log noise (temporally correlated). Tokens are lognormal per category, model mix varies per app, and cost is computed from tokens using the versioned rates. There are **23 labelled events** (A1–A7 across apps, split 10/5/8 over train/validation/test) plus 5 A8 data-quality injections. Each component uses its own seeded stream, and the manifest records SHA-256 hashes of every file. `scenario_truth.csv` holds no-cache vs cache potential outcomes on the same demand stream (for Phase 3).
- **Cleaning and aggregation** ([app/ml/clean.py](apps/api/app/ml/clean.py)), shared by synthetic and real data: dedupe by request_id, impute missing output tokens from the segment median, bucket by occurred_at (not arrival time), keep extreme legitimate requests. Retries are inferred as the same message **and the same client** fingerprint within 60 s.
- **Forecasting** ([features.py](apps/api/app/ml/features.py), [train_forecast.py](apps/api/app/ml/train_forecast.py), [backtest.py](apps/api/app/ml/backtest.py)): previous-day naive, seasonal naive (t-7), 7-day rolling mean and a recursive HistGradientBoosting model, all forecasting segment-level cost and requests. Features are leakage-safe, and a fast recursive path is tested to match the pandas features exactly. Backtests use rolling origins and retrain per origin. Intervals are empirical (split-conformal style), and the candidate ships only if it beats seasonal naive.
- **Anomaly detection** ([train_anomaly.py](apps/api/app/ml/train_anomaly.py)): a robust median/MAD seasonal baseline plus an IsolationForest fitted on the training window, gated by an impact floor, with outages handled as operational alerts. Contiguous alert days merge into one event. Reason codes follow a fixed priority, and explanations are fixed templates.
- **Offline evaluation** ([evaluate.py](apps/api/app/ml/evaluate.py), [scripts/run_evaluation.py](scripts/run_evaluation.py)): forecast and anomaly thresholds are selected on validation and reported once on test. It covers interval coverage, month-end overrun classification at RM200/225/250, a threshold sweep, confusion matrix, false alerts per 30 days, detection delay, benign promotions and drift. It writes `artifacts/evaluation/evaluation.json`, [docs/evaluation_report.md](docs/evaluation_report.md) (generated) and an `evaluation_runs` row.
- **Production services**: [forecast.py](apps/api/app/services/forecast.py) (month-to-date actuals once + remaining forecast + next-7-day estimate; per-run model selection on the last 28 days; idempotent `run_key`; insufficient-data status), [drivers.py](apps/api/app/services/drivers.py) (segment shares vs the 14-day run rate, reconciled to the forecast, template sentences), [anomaly.py](apps/api/app/services/anomaly.py) (thresholds from the stored evaluation; acknowledgements preserved), [history.py](apps/api/app/services/history.py) (daily aggregation of real traffic, complete days only), [synthetic_loader.py](apps/api/app/services/synthetic_loader.py).
- **API**: `POST /forecasts/run` (owner, idempotent), `GET /forecasts/latest` (series, bounds, risk, crossing date, next 7 days, provenance), `GET /forecasts/{id}/drivers`, `GET /forecasts`, `GET /anomalies` (+ synthetic ground truth when the data is synthetic), `POST /anomalies/{id}/acknowledge` (owner, audited), `GET /usage/daily`, `GET /usage/requests` (cursor pagination, metadata only), `GET /evaluation/latest` (`not_run` until it really runs), `POST /jobs/daily` (scheduler secret).
- Migration **0002**: `api_requests.client_fingerprint`, `daily_usage.retry_requests`. The gateway records an HMAC client key per chat session / user / app key.
- Scripts and Make targets: `scripts/seed_demo.py [--evaluate] [--predict]`, `make seed`, `make train`; job `python -m app.jobs.predict`.
- Docs: [model_card.md](docs/model_card.md), [data_dictionary.md](docs/data_dictionary.md), [evaluation_report.md](docs/evaluation_report.md).

### Verified (2026-10-10; dataset seed 42, 2026-04-13..2026-10-09, all synthetic)
| Check | Result |
|---|---|
| `ruff check`, `ruff format --check` | pass |
| `pytest` (real Postgres + pgvector, mock Anthropic) | **97 passed** (47 Phase 1 + 50 Phase 2) |
| Migrations 0001→0002 up / down / up, `alembic check` | clean |
| `scripts/seed_demo.py --evaluate --predict` on local DB | ok: 4,651 synthetic daily rows; evaluation stored; forecast `ok`; 13 anomaly events stored |
| Data quality | injected duplicates 617, missing 873, delayed 2,114 and extreme 105 rows are recovered exactly by cleaning |

**Measured results** (from [docs/evaluation_report.md](docs/evaluation_report.md); synthetic data only):
- Forecast, test window (6 origins × 14 days, retrained per origin), workspace daily WAPE: HGB 0.374, seasonal naive 0.395, previous-day 0.385, **7-day rolling mean 0.358**. HGB was selected on validation (0.226 vs seasonal naive 0.331) and also beats seasonal naive on test, but the simple rolling mean is best on test. HGB is best at horizon 1 (0.310) and on segment-days outside injected events (0.407 vs rolling mean 0.459). The test window holds 8 injected events, so absolute errors are large by design.
- Intervals: nominal 90%, measured test coverage 84.1% (segment-days) and 75.7% (cumulative totals). They under-cover under shift, and this is reported as measured.
- Month-end overrun (45 origins, only 2 complete months): at RM200 the central forecast has precision 1.00 and recall 0.73; the upper bound has recall 1.00. Mean month-end error is 12.6%. The central forecast under-predicts the rising months. This is a known tree-model limitation, documented in the model card.
- Anomalies, test (held out; thresholds chosen on validation): precision 1.00, recall 0.82, F1 0.90, FPR 0.00, 0 false alerts / 30 days, event recall 1.00 (7/7), mean delay 0.2 days, benign promotion not alerted (0/1). The drift event (A6) is not detected once outage alerts no longer count as detecting it.
- Demo forecast (today = 2026-10-10): RM269.46 projected vs RM200 budget (`projected_overrun`), 90% interval RM129.75–409.17, budget crossed on 2026-10-24. Drivers reconcile to within RM0.00003. All 13 stored anomalies match their injected mechanism.

### Bugs found and fixed during Phase 2
- Retry inference counted different customers asking the same FAQ as retries, so traffic spikes were mislabelled `retry_storm`. Fixed with a client fingerprint.
- Reason codes picked the largest z across differently scaled metrics. Replaced with a fixed priority.
- `int(180 * 0.70) == 125` (floating point) made the train split one day short. Fixed with `round()`.
- A drift event counted as "detected" because of an unrelated outage alert. Outage alerts no longer count as drift detection.

### Known limitations
- Every metric is on synthetic data, and the evaluation report says so in its header.
- HGB cannot extrapolate sustained upward drift, so month-end recall in rising months is weak. The upper bound is the conservative signal.
- Intervals are wide and under-cover during shift.
- The offline evaluation takes about 20 s, and a production forecast run about 5–8 s (it reselects the model each run).

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

## Next: Phase 3 (Decision & Cache)
Safe FAQ cache (normalization, PII/dynamic-query denylist, exact + alias + MiniLM embedding match with a 0.95 threshold and 0.03 margin, tenant/version/locale/TTL gates, adversarial test set), a what-if simulator on the persisted forecast (evaluated against `scenario_truth.csv`), recommendations, the owner approval workflow with audit, policy enable/disable, and savings measurement.
