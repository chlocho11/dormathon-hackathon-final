# Implementation Status

_Last updated: 2026-10-11_

| Phase | Status |
|---|---|
| 0. Scaffold | Done |
| 1. Database & Gateway | Done (mock provider; real Anthropic call not yet verified, no key supplied) |
| 2. Data & ML | Done (all metrics on synthetic data) |
| 3. Decision & Cache | Done (mock provider) |
| 4. Dashboard | Done locally: functional screens, build and desktop/mobile browser smoke passed |
| 5. E2E, Deploy, Demo | Local fallback verified; CI configuration and demo/runbooks ready; hosting deferred by user |

## Phase 4/5 continuation (2026-10-11)

### Live-key setup and chatbot comparison (2026-10-11)
- Created the local git-ignored root `.env.anthropic.local` for the user's key and a tracked empty `.env.anthropic.local.example` for new checkouts. Backend Settings loads the private file. No key was supplied or printed; `git check-ignore` confirmed exclusion.
- Added explicit launcher `--live`: checks key presence, validates configured model at API startup, disables SDK retries, strips backend secrets from the web child, and uses verified Haiku 4.5 catalog `anthropic-2026-10-11`. Default launcher remains mock. Fast restarts now apply migrations/bootstrap while skipping only heavy seed/evaluation.
- Added owner-only `/chat/compare`. It reserves two rate-limit slots, uses the same question/model/facts/output cap, always sends the baseline to the provider, and sends the optimized arm through the existing approved cache policy. The baseline ledger uses separate `bakery_demo_baseline` application; both arms count toward actual workspace spend. Failure in one arm preserves the other's reply/usage. No raw questions are persisted and no schema migration was needed.
- Chatbot now has responsive two-column replies and cumulative per-session input/output tokens, estimated MYR provider cost, provider-call/cache-hit counts, successful-pair cost difference, reset and single-chat mode. Mock/live and policy status are visible. Unknown/failed usage is excluded and labelled; cost difference excludes local overhead and is not guaranteed net savings. Reload/reset starts fresh UI counters; recorded ledger usage remains.
- Verified: **154 backend tests passed** (155.16 s; one optional PySocks warning), **5 frontend data tests passed**, full typecheck/lint/production build passed, launcher ruff/format and diff checks passed. Live launcher with an empty key rejected startup with an actionable message and made no provider call.
- Updated Chromium E2E passed: compares provider baseline with cache-hit zero tokens, checks accumulation after unsafe provider bypass, resets totals, and checks 360px mobile layout alongside existing dashboard/approval/viewer/error flow. Desktop/mobile comparison screenshots saved and visually inspected at `apps/web/test-results/screenshots/chat-desktop.png` and `chat-mobile.png`.
- Updated mock demo running at **http://localhost:3001/demo/chat**, API at **http://localhost:8000**. Cache policies were disabled after E2E so the next owner can demonstrate approval. Actual live Anthropic authentication/generation remains unverified until the user supplies a key and starts `--live`; no paid call was made in this work.
- Next user action: paste key after `ANTHROPIC_API_KEY=` in `.env.anthropic.local`, stop the existing demo and run `python scripts/local_demo.py --web-port 3001 --skip-prepare --live`; sign in as owner and approve caching in Decision Lab before testing FAQ savings.

### Final local-demo continuation
- User chose to finish the local demo first; Supabase/Render/Vercel hosting is not set up. No public deployment is claimed.
- Real Chromium browser smoke passed three times, including against the final combined launcher: owner/viewer login, backend forecast reconciliation, usage filters/CSV, budget save, scenario slider/API updates, approval confirmation/persisted policies, safe FAQ cache hit, order-query provider bypass, evaluation, 360px mobile navigation/no overflow, and deliberate API error state. No uncaught page exceptions. Final automated browser flow took **54.4 seconds**; this is automation timing, not a timed human presentation. Policies were disabled afterward for the next approval demo.
- Desktop Overview and mobile Settings screenshots were visually inspected. Generated screenshots: `apps/web/test-results/screenshots/` (git-ignored).
- Added configurable workspace-scoped 30-day request / 180-day aggregate retention and expired-cache cleanup to the daily pipeline. Fixed aggregation so older totals survive metadata deletion. Measurement and overhead now use the same retained window; Decision Lab explains that window.
- Retention regression initially passed alone but failed against existing seeded rows; it was isolated to the unseeded workspace. The subsequent complete 149-test run passed; both retention/measurement regressions and approval checks then passed together (11 tests). Final backend run: **150 passed in 149.83 seconds**, real PostgreSQL/pgvector and mock provider. Ruff and formatting passed.
- Patched PostCSS to 8.5.29, removed unused `cn`, moved shadcn build/generator tooling to dev dependencies, and pinned Playwright. Production audit (`npm audit --omit=dev`) reports **0 vulnerabilities**. Full audit retains **9 high development-tool findings** from the unpatched braces advisory; exposure and upstream follow-up are documented in `docs/security.md`. No breaking downgrade was applied.
- Combined launcher migrated, seeded/evaluated and started API/web at port 3001. It rejects occupied ports before modifying demo data and accepts port overrides. API-child termination caused the launcher to stop its web child and release both ports; sibling port 3000 was left intact. `--skip-prepare` supports fast restarts after successful preparation.
- A clean production build passed after terminating this project's orphaned Windows Next.js dev child. Final lint, full typecheck, and production build passed after the measurement copy update. Frontend data tests: **3 passed**.
- Final localhost checks: API health `ok`, provider `mock`, persisted forecast `ok`, measurement note reflects 30-day retention, login HTTP 200. The combined launcher is running at **http://localhost:3001/login** and API **http://localhost:8000**; fast restart was verified with `--skip-prepare`.

### Hotspot follow-up: npm blocker resolved (earlier evidence)
- `npm ci` succeeded after switching networks (711 packages installed). Certificate verification remained enabled.
- Full `npm run typecheck` passed after correcting request-origin typing to the backend's real/synthetic enum. All 3 frontend data tests passed again.
- `npm run build` passed and generated all routes. Lint had no errors; its sole unused-import warning was removed and lint rerun.
- Development frontend started at **http://localhost:3001/login** (port 3000 belongs to the sibling dormathon-hackathon project); HTTP login route returned 200. Mock API started at http://localhost:8000 with CORS configured for ports 3000 and 3001.
- Local demo preparation reran successfully with the same synthetic dataset and stored evaluation.
- Initial npm install reported 11 dependency vulnerabilities; the final local-demo continuation above supersedes this audit and pending-browser status.

### Implemented
- Preserved merged Phase 4 login/auth, shell, Overview, Predictions, Anomalies and Decision Lab.
- Usage Explorer now reads daily aggregates and paginated metadata, filters date/app/model/category/origin, sorts loaded requests, shows origin-separated cost chart/totals and exports sanitized CSV. Request calendar filters use Kuala Lumpur dates.
- Evaluation now displays persisted held-out baseline scores, backtest curves, interval coverage, anomaly confusion matrix/precision/recall/delay, adversarial cache quality and forecast training proportions. No-result state remains until evaluation exists. Added a readable model-card route.
- Settings now supports owner-only budget edits, safe threshold/TTL/holdout edits, emergency disable, confirmed key creation/rotation, confirmed FAQ invalidation and demo-only confirmed reset. Keys are shown once. Viewers see restrictions.
- BakeryBot uses a short-lived scoped token, sample prompts and real gateway responses, with cache/provider labels and token/cost metadata. Errors preserve the question for a manual resend; no automatic billed retry.
- Removed missing PagePlaceholder imports. Removed build-time Google font fetch; the specified system-sans fallback is used. Clarified gateway-origin badges because mock traffic is not proof of paid API calls.
- Added data-helper tests, a real local API/Playwright smoke runner, a CI E2E job, Windows-capable local mock launcher, architecture/security/deployment/demo/rubric docs, and a working Make demo replay command.

### Verified in this continuation
| Check | Result |
|---|---|
| API `uv run ruff check .`, `ruff format --check .` | pass; 71 files formatted |
| API `uv run pytest` | **148 passed**, 2 Windows Hugging Face symlink-cache warnings; 276.30 s; real embedded PostgreSQL/pgvector, mock Anthropic |
| Web `npm test` | **3 passed**: CSV safety, Kuala Lumpur day boundary, combined filtering/totals and provenance |
| Strict TypeScript check of usage helper and API types | pass |
| TSX transpilation syntax checks of five new screens/components | 0 diagnostics; this is not full typecheck/build evidence |
| E2E runner `node --check`, CI YAML parse, `git diff --check` | pass |
| Local launcher `python scripts/local_demo.py --prepare-only` | pass: migrations 0001–0003, bootstrap, 4,660 synthetic daily rows, persisted evaluation, forecast `ok`, 13 anomaly events |
| Local launcher ruff + format | pass |
| HTTP smoke against seeded local API | pass: health/database ok, semantic matching available, scoped chat token, mock reply/token cost, token denied on owner endpoint |
| HTTP approval/cache replay | pass: identical 10 prompts, **10 → 3 provider calls**, 7 approved FAQ hits, personal/order/numeric bypasses; owner approval HTTP 200, policies disabled afterward |

**Refreshed evaluation:** seed 42, 180 fully synthetic days, **2026-04-14..2026-10-10**. Generated [evaluation report](docs/evaluation_report.md) now reflects this dataset rather than the previous day's run. Test workspace WAPE: previous-day 0.373, seasonal 0.361, rolling mean 0.339, HGB 0.338. Nominal 90% interval coverage: segment-days 81.4%, cumulative totals **55.4%** (under-coverage). Anomaly precision 1.000, recall 0.882, event recall 1.000, 0 false alerts/30 days. Cache hit precision 1.000, 0 false hits, positive coverage 0.800. Forecast-based simulator error 44.7%; synthetic results are not evidence of production performance.

**Local recommendation replay:** stored forecast RM278.52 against RM200 budget; caching scenario approximately RM253.85, net estimated savings RM24.67 (assumption sensitivity RM13.87–37.23). The recommendation explicitly says the budget is still exceeded. Provider mode was mock; these are estimated accounting values, not actual paid savings.

### Earlier setup failures and remaining limits
- The earlier npm certificate failure was resolved by changing to a hotspot; full frontend checks now pass as recorded above. Earlier `npm ci` failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (Fortinet issuer `FG6H1FTB22901592`); system-CA/offline retries failed. Chromium and browser smoke now work.
- Earlier lint/build/typecheck attempts failed because of missing dependencies; installation and full checks now succeeded.
- Browser runner passed locally and generated screenshots; GitHub-hosted CI itself has not been run in this session.
- Combined launcher startup and child-failure cleanup are verified. Real interactive terminal Ctrl+C was not separately exercised by the automation harness.
- No real Anthropic call or live Supabase/Render/Vercel deployment was performed. Cloud accounts/credentials and pricing/model verification remain required.
- P1 streaming/provider prompt caching/routing remain deferred. Automated retention now runs with the secured daily job; a hosted scheduler still needs account setup.

### Next actions
The requested local fallback is working and left running. For public release later: provision Supabase/Render/Vercel, configure real auth/provider secrets and daily scheduler, verify model/pricing, then perform hosted HTTP/browser checks. Track the development-tool advisory upstream. A timed human three-minute presentation/recording has not been performed; the complete browser flow and three-minute script are available.

## Phase 3: Decision & Cache (done)

### Completed
- **Safe FAQ cache** ([faq_eligibility.py](apps/api/app/services/faq_eligibility.py), [cache.py](apps/api/app/services/cache.py), [embeddings.py](apps/api/app/services/embeddings.py)), in this order:
  1. A deterministic safety gate rejects PII, account- or order-specific requests, dynamic requests (today, stock, dates, times), discounts, any digits, negation, multiple questions, non-English text, unsupported locales and conflicting product names.
  2. Exact matching against approved FAQ phrasings and aliases.
  3. Local MiniLM semantic matching, only at cosine ≥ the policy threshold (default 0.95), with a margin ≥ 0.03 over the next intent and identical key terms (day and product names).

  Matching is scoped to workspace + application + locale + knowledge version and only uses unexpired, cacheable entries. Hits return the **approved FAQ answer** and make no provider call. The decision is recorded for every request (`cache_decision`), in shadow mode before approval. Owners can opt in to a deterministic 10% holdout. A knowledge-version bump invalidates the cache, and TTL lives in `response_cache`. Embeddings run through fastembed (ONNX, no torch) and are baked into the Docker image. If the model is unavailable, the cache falls back to exact matching only and health reports it.
- **Embeddings, measured:** true paraphrases score 0.80–0.90 cosine, and so do the spec's different-answer pairs (Sunday vs Saturday 0.864, Chocolate vs Vanilla 0.836, "deliver" vs "deliver to my address" 0.818). Embeddings alone cannot separate them, so the gate, exact aliases and the key-term guard are mandatory; the spec allows exactly this ("bypass and/or require deterministic intent matching").
- **What-if simulator** ([simulator.py](apps/api/app/services/simulator.py)) transforms the **persisted forecast's** predicted requests and costs for `static_faq` in the target apps: hits = requests × eligible share × safe hit rate; gross = hits × predicted cost per request; net = gross − overhead (per-lookup + fixed daily, labelled assumptions). Defaults come from measured shadow decisions on real traffic (n ≥ 50, smoothed), otherwise the synthetic dataset's rates, otherwise assumed values, and every source is labelled. Client overrides are bounded; clients cannot submit costs. The output includes assumption sensitivity, a separate forecast-interval range, a quality gate (approved catalog, threshold range, adversarial cache tests, reversibility, approved answers only) and the evidence type.
- **Recommender** ([recommender.py](apps/api/app/services/recommender.py)): deterministic. It proposes the gate-passing option with the highest positive net savings; otherwise it recommends "No safe intervention yet; collect more data". Rationales come from a template and say plainly when the budget is still exceeded.
- **Approval workflow:** owner only, with an optimistic `expected_version`, rejection of stale proposals (newer forecast), idempotent repeat approvals, and a single transaction that enables policies, updates the recommendation and writes audit rows. Reject, emergency disable (resumes provider calls and marks the recommendation `disabled`), and policy PATCH (threshold 0.95–0.99, TTL 1–168 h, holdout; audited) are all included.
- **Measurement** ([measurement.py](apps/api/app/services/measurement.py)): per app since approval it reports requests, provider calls, exact/semantic hits, bypasses, holdout, avoided cost, overhead and net. With ≥ 30 holdout requests it uses a holdout counterfactual; otherwise the estimate is labelled observational. Mock-mode accounting is flagged.
- **API:** `POST /scenarios/compare`, `POST /recommendations/generate`, `GET /recommendations`, `POST /recommendations/{id}/approve|reject`, `GET /policies`, `PATCH /policies/{id}`, `POST /policies/{id}/disable`, `GET /audit`, `GET /measurement`, `POST /faq/invalidate`, `GET /overview`.
- FAQ catalogs for all three demo apps; migration **0003** (`api_requests.cache_decision`); [scripts/demo_replay.py](scripts/demo_replay.py); the cache and simulator evaluations are part of `run_evaluation.py` and the generated report.

### Verified (2026-10-10)
| Check | Result |
|---|---|
| `ruff`, `pytest` | pass, **148 passed** (51 new: cache, simulator, approval) |
| Migration 0003 up / down / up, `alembic check` | clean |
| Cache, labelled set (51 queries) | hit precision **1.00**, **0 false hits** (0/26 adversarial), coverage 0.80 (13/13 exact, 7/12 paraphrase), median decision 0.06 ms |
| Threshold sweep | false hits at 0.85–0.90; 0 from 0.92; coverage drops to 0.56 at 0.97, so **0.95 is supported empirically** |
| Ablation without the safety gate | precision 0.952, 1 false hit, so the gate is necessary |
| Simulator vs synthetic counterfactual (test window) | on actual units: RM40.67 vs truth RM40.69 (0.1% error, formula correct); on the forecast: RM26.66 (34.5% error, all from test-period under-forecasting) |
| Live replay (`demo_replay.py --approve --disable-after`, mock) | identical 10 prompts: **10 → 3 provider calls** after approval; order-status, personal-address and numeric prompts still bypass; disable resumes provider calls |
| Live recommendation | "Projected RM269.46 vs RM200 budget … static FAQ RM63.02 … synthetic-data 64% safe hit share, RM13.49 overhead … approximately RM242.64 (net RM26.82; RM15.22–RM40.30) … does not fully eliminate the budget overrun" |

### Bugs found by the live run and fixed (with regression tests)
- The in-memory match index held ORM objects across DB sessions, so the second request raised `DetachedInstanceError`. It now caches plain snapshots.
- Mock provider request IDs used a per-process counter and collided with stored rows after a restart. They now use UUIDs.
- The savings sensitivity mixed forecast-interval and assumption uncertainty (−RM13 to RM157). They are now reported separately.

### Known limitations
- At a 0.95 threshold, semantic matching adds only a little coverage beyond aliases (7/12 paraphrases). This is a deliberate safety trade-off.
- The labelled cache set covers the bakery app; the tuition and retail catalogs are covered by the "every approved phrase passes the gate" test only.
- Simulator defaults come from the synthetic generator's true rates until ≥ 50 real FAQ requests exist. These are labelled `synthetic` and are not measured evidence.
- Measured savings in the replay are mock-mode accounting. At demo volumes the fixed daily overhead assumption makes observed net savings negative, and it is reported as such.

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

## Next: finish current verification
The dashboard screens now build successfully. Complete browser smoke and visual inspection before marking Phase 4 complete. Cloud deployment still needs account access and live smoke evidence.
# Scripted chat interface update (2026-10-11)

The latest user request replaces the `/demo/chat` API-connected interface with
a browser-only scripted split-screen conversation. Each pane has user/AI messages,
per-reply token/cost metadata, cumulative input/output/cost totals and cache labels.
Five predefined question sets each include two paraphrases and a fixed answer.
First use of a topic has equal usage on both sides; repeats/paraphrases return
zero-token exact/semantic hits on TokenGuard. Reset clears messages and demo cache.
Unsupported questions show guidance. The page labels all values as simulated;
it calls no API and does not affect dashboard ledger/policies. Real backend chat
endpoints and server-only key setup remain available independently.

Question/answer runbook: `docs/scripted_chat_demo.md`. Fresh verification: seven
frontend unit tests, lint and TypeScript checks passed; standalone browser smoke
passed first use, exact/semantic hits, totals, reset, unsupported inputs, mobile
overflow and zero API calls. Desktop/mobile screenshots are under ignored
`apps/web/test-results/screenshots/scripted-chat-*.png`. This section supersedes
earlier descriptions of API calls made by the chatbot UI. Whole-dashboard smoke
has been updated for the scripted UI; it was not rerun in this update.

Chat presentation follow-up: prominent implementation copy was replaced by a
compact expandable Demo estimates disclosure. Generation estimates vary 5-10%
around each topic's initial usage (whole-token rounding), costs are recalculated,
and generation waits 2.8-3.2 seconds with a Generating loading state. First-use
arms remain equal; cache hits appear independently without added delay, show
measured local predefined-variant lookup milliseconds, and retain zero usage.
Generation delay is simulated; cache timings do not measure a semantic model.

Latest chat refinement: baseline replies cycle through three equivalent phrasings
for each topic; TokenGuard retains the original answer for cache hits. Removed
the topic selector and all question suggestion buttons; questions are entered
only through the shared composer. The compact estimates disclosure remains.

First-response refinement: generation delay is now 2.8-3.2 seconds, and baseline
first replies use a different equivalent phrasing from TokenGuard. Initial token
and cost estimates stay equal. Cache hits continue to reuse TokenGuard's first
answer with no artificial cache delay.
