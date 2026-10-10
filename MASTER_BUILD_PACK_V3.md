# TOKENGUARD AI — MASTER BUILD PACK v3.0

**Date:** 10 October 2026  
**Hackathon:** Track 1 — Predict Early, Decide Better  
**Status:** Implementation specification, NOT evidence of a completed deployment.  
**Authority:** This file is the SINGLE source of truth. `REFERENCE_*` files are historical context only and MUST NOT override this document.

## 0. Non-negotiable engineering instructions

You are an autonomous coding agent. Audit the supplied repository first; do not overwrite working teammate code. Implement and test all P0 features. Choose ordinary implementation details without asking the user. Ask only for unavailable repository access, provider credentials, Supabase/Vercel permissions, or irreversible actions. Never claim a feature, live call, evaluation score, saving, or deployment unless verified. Maintain `IMPLEMENTATION_STATUS.md` with evidence and `LIVE`, `DEMO`, `NEXT`, `BLOCKED` statuses. Never commit API keys, `.env`, credentials, raw customer messages, or secrets. No LLM API calls for cost estimation, classification, forecasting, anomaly detection, optimisation, or explanation; Anthropic is used solely for actual uncached chatbot responses.

**Read the full document before coding.** If `frontend-design` skill is installed, use it. If accessible, consult Notion `DESIGN.md` at getdesign.md; otherwise implement the detailed design below and note that external reference was unavailable. Don't stall for design references.

## 1. Product and narrative

TokenGuard is a pre-request AI cost predictor and decision-support gateway. For every request it estimates token usage and price **before** the provider call, checks owner-approved safe cost interventions, sends a request only when needed, then reconciles actual provider usage against the prediction. Separately it forecasts month-end budget risk, detects abnormal usage, explains cost drivers, and offers an interactive cost simulator.

**End-to-end sequence:** authenticate -> validate full request -> estimate input tokens -> predict output tokens and uncertainty -> compute estimated cost and worst-case price bound -> select permitted action -> safe cache lookup or Anthropic call -> record real usage and action -> aggregate ledger -> budget forecast / anomalies -> simulate actions -> owner approval -> monitor outcome.

Three visible experiences: (1) fictional Sweet Crumbs Bakery customer chatbot; (2) TokenGuard owner dashboard; (3) simulator, which works without provider credentials and is always clearly labelled hypothetical.

**Success:** a judge can send three requests, see per-request predicted vs actual cost, observe an approved cache hit without an Anthropic call, see complex requests remain unchanged, and reconcile all totals with persisted gateway events. Never pretend model routing, semantic caching, or production savings are live if not implemented/tested.

## 2. Locked implementation choices and priorities

- **P0 platform:** retain existing working Next.js App Router + TypeScript gateway on Vercel if present. Do NOT force FastAPI/LiteLLM migration. If repo absent, scaffold Next.js 15+ compatible App Router using stable installed versions; TypeScript strict, Zod, Supabase Postgres, Tailwind CSS, shadcn/ui, Lucide React, Recharts, Vitest, Playwright. Backend route handlers execute server-side. Python scripts may train models offline.
- **Provider:** Anthropic only; default `claude-haiku-4-5-20251001` unless the provider rejects it, in which case fail visibly and request a valid configured model. Do not invent a `claude-haiku-5-5` ID. Use official SDK for Messages API and preserve supported request fields. No silent provider/model switching.
- **Hosting:** Vercel frontend/gateway, Supabase database/auth. Model training is OFFLINE, not per-request. Optional Render only if genuinely needed for embeddings or batch compute; not P0.
- **Currency:** MYR dashboard; Anthropic prices USD per million tokens, configurable price book and FX snapshot with `effective_at` and `source` fields. Default **illustrative** FX 4.20 MYR/USD ONLY for seeded demo, not a claim about live rates. Verify current prices before any real cost claim. Store USD and MYR decimal values with pricing version. No float currency accumulation.
- **Time:** UTC persisted; Asia/Kuala_Lumpur displayed. Monthly budget RM200 default, owner editable.
- **Source separation:** `real`, `synthetic`, `mock` must never be mixed without prominent disclosure. Real totals default to `real` only; demo toggle can show seeded history and must label it.
- **Approval:** routing, output caps and cache policy changes OFF until owner approval. P0 caching is exact canonical, approved, versioned static FAQ only. Semantic cache is P1 and cannot reuse arbitrary conversation answers.
- **P0:** working real provider call; persistent usage ledger; pre-request estimate; deterministic safe action selection; exact FAQ cache; forecast + baseline; anomaly evaluation; cost simulator; actual dashboard API wiring; approval/audit; tests; live demo; deploy. **P1:** quality-tested model routing, response length cap, semantic FAQ embeddings, provider-native prompt caching, automatic throttling (display NEXT).
- **Avoid scope creep:** no billing integration, Stripe, WhatsApp, arbitrary customer-uploaded docs, multi-provider gateway, complex RAG, live FX fetch requirement, long-running training inside serverless.

## 3. Repository audit and reuse

Teammate notes *claim* the following files may exist, but they have NOT been independently inspected: `app/v1/messages/route.ts`, `lib/auth.ts`, `lib/pricing.ts`, `lib/cache.ts`, `lib/forecast.ts`, `lib/ridge.ts`, `lib/policy.ts`, `lib/schema.ts`, `components/dashboard/provider.tsx`, `lib/demo-data.ts`, `lib/demo-forecast.ts`, `chatbot.py`, `build_pack/API_CONTRACT.md`, `build_pack/LUMI_INTEGRATION.md`. Start by printing the repo tree, package scripts, current git status, API route signatures, auth flow, and tests. Create a gap table with file, working evidence, missing functionality, owner, and action. Preserve existing naming and routes when possible. Freeze schema/API contract BEFORE dashboard teammates change code. Never imply these files exist until verified.

Suggested additions (adapt to repo):

```text
app/
  (marketing)/page.tsx
  dashboard/page.tsx
  dashboard/requests/page.tsx
  dashboard/anomalies/page.tsx
  dashboard/decisions/page.tsx
  dashboard/simulator/page.tsx
  dashboard/evaluation/page.tsx
  dashboard/settings/page.tsx
  bakery/page.tsx
  v1/messages/route.ts
  api/usage/requests/route.ts
  api/usage/daily/route.ts
  api/forecast/route.ts
  api/risk/route.ts
  api/scenarios/compare/route.ts
  api/recommendations/route.ts
  api/recommendations/[id]/approve/route.ts
  api/policies/[id]/disable/route.ts
  api/evaluation/route.ts
lib/
  auth.ts pricing.ts schema.ts token-estimator.ts output-predictor.ts
  decide.ts cache.ts ledger.ts forecast.ts anomalies.ts simulator.ts
  supabase-admin.ts demo-faq.ts api-errors.ts
components/
  dashboard/* ui/* bakery/*
supabase/migrations/0001_init.sql
scripts/generate_dataset.py scripts/train_output_model.py
scripts/train_forecast.py scripts/evaluate_anomalies.py
scripts/seed_demo.ts scripts/smoke_live.ts
fixtures/faq.json fixtures/quality_cases.json
models/README.md
build_pack/API_CONTRACT.md build_pack/IMPLEMENTATION_STATUS.md
tests/unit/* tests/integration/* tests/e2e/*
.env.example README.md vercel.json
```

## 4. API gateway request flow and predictions

**Endpoint:** Preserve working `POST /v1/messages` or `/api/v1/messages` path; for Anthropic SDK `base_url`, verify that SDK path joining yields `/v1/messages` exactly once. The gateway must accept supported Anthropic Messages API fields (`model`, `max_tokens`, `system`, `messages`, `temperature`, `stop_sequences` where supported) and reject unsupported payloads with clear 4xx. P0 supports text-only non-streaming; reject unsupported tool calls, images, files, streaming with honest errors rather than silently losing content. Restrict body size (e.g. 128 KiB), timeouts, tenant quotas and authentication. Validate max_tokens against provider limits; never silently rewrite user intent.

**Input-token estimate:** count ALL system text, previous turns, new message text, and protocol overhead. P0: approximate `ceil(total UTF-8 text characters / 4) + 6 * number_of_messages + 20` for English-only messages; label `char_heuristic_v1` and mark as estimate. This is NOT an exact token count and can be badly wrong for multilingual input; record locale and error. For large prompts/ambiguous tokenization, show wider uncertainty. P1 optional Anthropic token-count endpoint where latency acceptable; no claim that it is free of API/network cost. Never call a paid generation model for prediction.

**Output-token estimate:** default robust hierarchical baseline from *past completed real requests only* by workspace + model + task bucket + max_tokens bucket; if fewer than 20 examples, fall back to model-wide median; if fewer than 20 model examples, fall back to explicit configured default `min(max_tokens, 256)` and mark `cold_start_baseline`. Detect requested long-form tasks by conservative regex (e.g. report, essay, 10,000 words) and widen range; NEVER assume a short input means a short output. Always clip predicted output to `max_tokens`. Optional P0 offline-trained ridge regressor (if validated) using log1p(input estimate), log1p(max_tokens), model ID, task category, message count, explicit requested length; deploy only if held-out MAE beats naive baseline. For a request asking for 10,000 words but `max_tokens=4000`, estimate a large output capped at 4000; do not promise 10,000 words. If `max_tokens` huge, show wide range and maximum exposure.

**Cost arithmetic:** `predicted_usd = (estimated_input_tokens * input_usd_per_million + predicted_output_tokens * output_usd_per_million) / 1_000_000`, plus any provider-specific pricing rules if applicable. `predicted_myr = predicted_usd * fx_rate`. Compute `predicted_upper_myr` using `max_tokens` for output and a conservatively inflated input estimate; label upper bound as *conditional estimate*, not hard contractual maximum because billing details may vary. After Anthropic returns, calculate actual provider cost from returned usage fields and applicable price rules; record `actual_input_tokens`, `actual_output_tokens`, provider cache read/write tokens if present, and model returned. If pricing unknown, record usage but set actual monetary cost NULL and display `pricing unavailable` rather than RM0.

**Request lifecycle:** allocate UUID; persist `pending` prediction/action event before calling provider; commit; on cache hit complete with actual provider cost 0, `cache_hit` action and lookup overhead; on provider response update same row atomically with actual usage/cost and provider request ID; on provider error record `failed`, error class, no fabricated token usage. Idempotency key prevents duplicate ledger rows where feasible; never retry non-idempotent provider calls automatically after uncertain failure. Store no raw prompt/response content in ledger; cache only approved static FAQ IDs/answers.

**Headers** for supported transports: `x-tokenguard-request-id`, `x-tokenguard-predicted-cost-myr`, `x-tokenguard-action`, `x-tokenguard-model-used`, `x-tokenguard-estimate-method`; expose via CORS if needed. Header values are informational, not source of truth; dashboard reads ledger API. For cache responses, return Anthropic-compatible response envelope with explicit cached metadata via headers, without fabricating provider usage. Avoid claiming cached content came from a new Claude generation.

## 5. Decision engine: no paid optimisation calls

Pure deterministic function `decide(input, policy, cacheCandidate, prediction, risk): Decision` with `action: 'pass_through'|'cache_hit'|'routed'|'output_cap'`, `reason_code`, `requested_model`, `selected_model`, `selected_max_tokens`, `policy_approval_id`, `estimated_avoided_cost_myr`, `quality_gate_status`. Priority: authentication/validation -> tenant and policy checks -> exact FAQ cache hit if approved and valid -> P1 model routing if owner approved and category quality-gated -> P1 cap if approved and consistent with task -> pass-through. P0 must NEVER route or trim silently. No automatic throttling. Return explanation template, e.g. `Approved FAQ match, same knowledge-base version, no provider call required`.

**Cache P0:** whitelist fixed intents: opening hours, bakery address (fictional), pickup policy, general cake menu (versioned). Exact normalization: Unicode NFKC, lowercase, collapse whitespace, trim punctuation; do not strip negation, numbers, modifiers or personal details. Only canonical aliases explicitly enumerated in `fixtures/faq.json` may match; no fuzzy string threshold in P0. Cache key HMAC/workspace+locale+intent+answer_version+KB_version; TTL 24h (unless shorter by policy), invalidate on FAQ edit; never cache order status, personal data, refunds with conditions, inventory, prices unless answer is versioned and expressly approved. For demo, prefer stable hours/pickup over variable menu prices. Cache lookup makes ZERO Anthropic calls. Cache result provider cost = 0; estimated avoided cost is counterfactual, not proven savings. Prevent cross-workspace leakage; do not log customer PII.

**P1 semantic:** local embeddings + pgvector only on approved static FAQ alias candidates, similarity >=0.95 plus same intent and all policy gates; benchmark 20 positive and 20 adversarial negative pairs before LIVE. Similarity alone NEVER authorizes cache. **P1 routing:** approved cheap model must exist and be provider-valid; run paired 20-prompt quality test with no critical failures before activation, record cost/quality tradeoff, exclude sensitive/complex/long-form tasks. **P1 output cap:** approved short-answer categories only; show changed `max_tokens` and never cap long report requests. All P1 features default OFF.

## 6. Database schema — additive, durable, tenant scoped

Use Supabase PostgreSQL and additive SQL migration; do not drop existing tables. All money `numeric(18,8)`, times `timestamptz`, UUID IDs. Minimum tables:

- `workspaces(id uuid pk, name text, owner_user_id uuid, budget_myr numeric, timezone text, created_at timestamptz)`
- `workspace_members(workspace_id uuid, user_id uuid, role text CHECK role IN ('owner','viewer'), PRIMARY KEY(...))`
- `gateway_keys(id uuid pk, workspace_id uuid, key_hash text UNIQUE, prefix text, revoked_at timestamptz, created_at timestamptz)`; generate cryptographically secure secrets, store only hashes.
- `pricing_versions(id uuid pk, provider text, model text, input_usd_per_million numeric, output_usd_per_million numeric, cache_read_usd_per_million numeric NULL, cache_write_usd_per_million numeric NULL, fx_usd_to_myr numeric, source text, effective_at timestamptz)`
- `usage_events(id uuid pk, workspace_id uuid, occurred_at timestamptz, status text, origin text CHECK origin IN ('real','synthetic','mock'), model_requested text, model_used text, action text, action_reason_code text, policy_approval_id uuid NULL, prediction_method text, prediction_model_version text, predicted_input_tokens int, predicted_output_tokens int, predicted_cost_myr numeric, predicted_cost_upper_myr numeric, actual_input_tokens int NULL, actual_output_tokens int NULL, actual_cost_myr numeric NULL, prediction_error_myr numeric NULL, estimated_avoided_cost_myr numeric NULL, measured_local_overhead_myr numeric NULL, cache_status text, pricing_version_id uuid NULL, fx_rate_used numeric, provider_request_id text NULL, error_class text NULL, latency_ms int NULL, request_id text UNIQUE, created_at timestamptz)`
- `daily_usage(id uuid pk, workspace_id uuid, usage_date date, origin text, model text, request_count int, input_tokens bigint, output_tokens bigint, actual_cost_myr numeric, UNIQUE(workspace_id,usage_date,origin,model))`
- `faq_entries(id uuid pk, workspace_id uuid, intent_id text, locale text, aliases jsonb, approved_answer text, answer_version int, kb_version int, is_approved boolean, expires_at timestamptz NULL)`
- `cache_entries(id uuid pk, workspace_id uuid, faq_entry_id uuid, cache_key text UNIQUE, answer_version int, kb_version int, expires_at timestamptz, hit_count int DEFAULT 0)`
- `policies(id uuid pk, workspace_id uuid, policy_type text, enabled boolean DEFAULT false, config jsonb, updated_at timestamptz)`
- `policy_approvals(id uuid pk, workspace_id uuid, policy_id uuid, approved_by uuid, approved_at timestamptz, justification text)`
- `forecast_runs(id uuid pk, workspace_id uuid, as_of date, origin text, model_version text, projected_month_end_myr numeric, lower_myr numeric, upper_myr numeric, baseline_myr numeric, metrics jsonb, created_at timestamptz)`
- `anomaly_events(id uuid pk, workspace_id uuid, usage_date date, origin text, detector text, score numeric, severity text, reason_codes jsonb, reviewed_label text NULL, created_at timestamptz)`
- `scenario_runs(id uuid pk, workspace_id uuid, created_by uuid, inputs jsonb, assumptions jsonb, outputs jsonb, is_hypothetical boolean DEFAULT true, created_at timestamptz)`
- `recommendations(id uuid pk, workspace_id uuid, forecast_run_id uuid NULL, scenario_run_id uuid NULL, intervention text, estimated_net_savings_myr numeric, risk_summary text, status text, created_at timestamptz)`
- `audit_events(id uuid pk, workspace_id uuid, actor_user_id uuid NULL, action text, object_type text, object_id uuid NULL, metadata jsonb, occurred_at timestamptz)`

Add foreign keys and indexes `(workspace_id,occurred_at DESC)` and `(workspace_id,origin,occurred_at)`; unique constraint on cache identity. Enforce RLS for user-facing tables and membership-based policies; backend service role only server-side. No unauthenticated owner APIs. For pre-existing schemas, create equivalent additive columns and document mapping. Seed synthetic records only into a dedicated demo workspace or separate origin, never masquerading as real provider calls.

## 7. Typed API contract

All dashboard endpoints require Supabase session JWT, enforce workspace membership and use explicit workspace ID. Gateway uses scoped gateway API key and workspace mapping. Rate-limit endpoints. Return ISO UTC timestamps, money as decimal strings, and `source_origin` where relevant. Consistent error: `{error:{code,message,request_id}}`.

- `POST /v1/messages`: Anthropic-compatible text-only request; response preserves Anthropic fields where real, plus metadata headers; authenticated gateway key.
- `GET /api/usage/requests?workspace_id=&origin=real&limit=50&cursor=`: paginated event rows including prediction, actual, action, model, method, status.
- `GET /api/usage/daily?workspace_id=&origin=real&from=&to=`: daily grouped aggregates sourced from event ledger; no fabricated demo totals.
- `GET /api/forecast?workspace_id=&origin=synthetic`: month-end point/range, baseline, method/version, history window, last run, driver contributions.
- `GET /api/risk?workspace_id=&origin=synthetic`: budget risk, anomaly alerts, reason codes, confidence caveat.
- `POST /api/scenarios/compare`: `{workspace_id, requests_per_day, avg_input_tokens, avg_output_tokens, model, repeat_rate, simple_rate, horizon_days, assumptions}`; return base cost, separate intervention estimates, combined scenario with overlap removed, caveats. No mutation to actual ledger.
- `GET /api/recommendations?workspace_id=`: proposed actions, forecast linkage, predicted net savings, approval status.
- `POST /api/recommendations/:id/approve`: owner only, CSRF/origin check, transactional policy approval and audit record; fail if quality gate missing.
- `POST /api/policies/:id/disable`: owner only, immediate disable and audit.
- `GET /api/evaluation?workspace_id=`: train/test provenance, MAE/RMSE/baseline, anomaly precision/recall/F1/false positives, quality test summary.
- `GET /api/health`: non-secret readiness, DB reachable, configured provider flag; no credentials in output.

Freeze a JSON example and Zod schema for `UsageEvent` in `build_pack/API_CONTRACT.md` before frontend work. Dashboard must not import `demo-data.ts` or `demo-forecast.ts` for LIVE views. In synthetic demo mode, explicitly label data and never display synthetic amounts as actual billing.

## 8. Dataset generation, forecasting and anomalies

Generate 180 days of deterministic synthetic daily traffic (`seed=42`) for three fictional applications: bakery, tuition, retail. Fields: date, workspace, app, segment, requests, avg_input_tokens, avg_output_tokens, provider/model, calculated_cost_myr, anomaly_type, anomaly_label, origin='synthetic', and pricing version. Four segments: static FAQ, dynamic FAQ, order conversation, long-form request. Include weekly seasonality, mild trend, noisy counts, holiday-like effects, and zero-traffic days. Explicit anomalies with reproducible IDs and windows: (A) 3x traffic spike, (B) runaway output tokens, (C) model mix shifts expensive, (D) repeated FAQ burst, (E) abrupt cost increase from price change, (F) declining cache hit rate, (G) slow drift, (H) legitimate one-day promotion (hard negative), (I) sparse/missing telemetry, (J) duplicate ingestion attempt. Synthetic labels describe injected conditions; don't claim real-world performance.

**Hybrid real sample:** capture genuine Anthropic request metadata only after real calls; label origin='real'. No fabricated provider token usage. Train synthetic proof-of-method and real request output model only if enough real samples; show sample counts and separate metrics. Never evaluate on seeded labels used as predictor features.

**Request-level output predictor:** train on completed request records; time-ordered train 60%, validation 20%, test 20%; ensure same prompt family/duplicate doesn't leak across sets when possible. Features only known BEFORE call: estimated input, max_tokens, message count, requested model, approved task category, explicit length hint. Compare naive global median, group median, and Ridge regression. Evaluate MAE, RMSE, median absolute percentage error only when meaningful, 80% interval coverage, underprediction rate, and cost error in MYR. A seeded Ridge score is NOT proof of real-world predictive accuracy. Deploy Ridge only if it improves held-out real or clearly labelled synthetic test error. Cold-start baseline always works.

**Monthly forecasting:** use per-day spend/requests, weekday, lag1/7/14, rolling means, segment mix. Chronological split (first 70% train, next 15% validate, final 15% test), rolling-origin backtests; naive last-7-day average and seasonal same-weekday baselines. Ridge or HistGradientBoosting only if beats baseline on held-out MAE; report RMSE, WAPE when denominator nonzero, prediction interval coverage, budget breach classification precision/recall, and data source. Never use future daily totals in features. Show uncertainty and a clear `insufficient history` state.

**Anomaly detection:** rolling median/MAD robust z-score plus optional IsolationForest trained on pre-anomaly or unsupervised training window; choose thresholds on validation only; freeze and test chronologically. Metrics: precision, recall, F1, false positives per 30 days, detection delay, confusion matrix, performance on legitimate promotion hard negative. Display reason codes and distinguish *actual observed anomaly* from *predicted future budget risk*. Anomaly alerts are informational; no auto-throttle.

**Cost driver analysis:** decompose forecast by segment/model and compare forecast against reference-period contributions. Avoid describing correlation as causation. Link what-if interventions to forecasted eligible volume, not arbitrary unrelated historical rates.

## 9. Simulator and recommendations

Simulator must work even without a live gateway. Inputs: requests/day (1–100000), avg input tokens (1–100000), avg output tokens (1–100000), model from configured price book, estimated repeat rate (0–100%), simple rate (0–100%), horizon days (1–31), assumed cache hit rate, caching overhead MYR, model-route quality eligibility (only if tested), approved max-token cap (P1). Validate input and prevent negative or nonsensical values.

Baseline `N = requests_per_day*horizon_days`; `base_cost = N*(input*rate_in+output*rate_out)/1e6*fx`. Cache scenario `eligible = N*repeat_rate*approved_cache_eligibility_rate`; `avoided_calls = eligible*expected_hit_rate`; `net_savings = avoided_calls*cost_per_call - local_lookup_cost - storage_cost`. Show all assumptions. If routing P1 unavailable, show `NEXT / not validated`, not a live savings figure. Combined scenarios apply interventions to remaining calls and deduct overhead to avoid double counting. Separate: `simulated_savings`, `predicted_savings`, `estimated_avoided_spend`, and `verified_actual_provider_spend`. Actual savings require credible matched baseline or randomized holdout; do not assert `forecast - actual` as measured savings.

Recommendation rule: select eligible action with positive net savings and quality gate passed; if none, recommend `No change`. Include forecast/run ID, triggering risk, expected savings interval, assumptions, quality caveat, and owner approval. A recommendation is not an action until approved.

## 10. UI/UX: Notion-inspired, clean, trustworthy

Next.js + shadcn/ui + Tailwind + Lucide. Light mode; white background, neutral-50 panels, neutral-200 borders, subtle shadows, ink text, muted blue accents, 8px spacing rhythm, max content width ~1440px, responsive left navigation, top workspace selector, clear LIVE / SYNTHETIC / MOCK status indicator. Accessible keyboard focus, WCAG AA contrast, semantic labels, skeleton/error/empty states, no fake progress animations. Use Recharts line/bar visualizations; chart tooltips display MYR, data origin, time zone, model version.

Pages:
1. **Overview:** actual spend (real only), budget remaining, predicted month-end range, breach probability if calibrated, latest anomalies, estimated avoidance, next recommended action; live vs seeded toggle.
2. **Requests:** sortable paginated ledger; predicted/actual cost, error, input/output tokens, requested/used model, action, origin, request ID, cache status; drill-down explanation.
3. **Anomalies:** timeline, severity, observed metrics, baseline, reason codes, hard-negative/false-positive explanation, detector version.
4. **Decisions:** predicted cost drivers, scenario cards, action eligibility, approval CTA, approval history, rollback toggle, quality warnings.
5. **Simulator:** editable inputs and immediate arithmetic results; per-action savings and overlap-aware combined estimate; copy/share scenario only if authorized; permanent `Hypothetical` label.
6. **Evaluation:** held-out prediction vs actual, MAE vs baseline, data provenance, anomaly precision/recall/false positives, cache adversarial test results, quality gating, version hashes.
7. **Settings:** workspace, budget, API key creation/revocation (show secret once), approved policy toggles, provider model, FX/pricing source/date, knowledge base versions.
8. **Bakery demo chat:** sample question chips, conversation, provider/cached status, per-message prediction vs actual and action, clear fictional bakery notice. No actual orders or payment collection.

Never show seeded forecast as actual production billing. If forecast trained on synthetic data, show `Synthetic-data demonstration — not validated on customer history`. Do not make savings charts imply observed outcomes when they are simulated.

## 11. Bakery chatbot and demonstration fixtures

Fictional business: Sweet Crumbs Bakery. Static approved FAQs: opening hours Mon–Sat 10am–6pm, closed Sunday; pickup available; menu includes fictional Vanilla Cloud Cake RM55, Midnight Chocolate Cake RM70, Red Velvet Cake RM75 (prices versioned and not guaranteed); delivery fees confirmed manually. No order-taking or collection of addresses/phone numbers in MVP. Chatbot must politely state uncertainty for custom requests; real Anthropic call for uncached complex prompts. Safe fixture prompts: `What are your opening hours?` (approved exact FAQ), repeat identical prompt (cache hit), `Can you design a complex three-tier wedding cake and explain the tradeoffs?` (pass-through to Claude). Optionally simple request route only if P1 routing fully quality-gated and approved; otherwise do NOT demo routing as LIVE.

Gateway chat must be used; do not allow a separate `chatbot.py` or Lumi script to bypass TokenGuard. If Python client exists, update `base_url` and gateway auth with server-side env; test route with one real request. A live provider key must never reach browser.

## 12. Testing and acceptance gates

Unit tests: input estimate includes system/history; long-output request; cap at max_tokens; price decimal precision; cold-start; policy default deny; no routing/trim without approval; cache exact approved vs negation/personalization/cross-tenant/expired version; simulator monotonicity and no double-count; forecast leakage; anomaly hard negative; error event handling.

Integration tests: gateway auth unauthorized=401; pending prediction persisted BEFORE provider invocation; successful mock response updates same row; provider error recorded; cache hit causes zero provider SDK calls; dashboard API totals equal SQL ledger; workspace isolation; owner-only approve and disable; migrations reversible where practical; price missing -> null not zero; synthetic excluded from real totals.

E2E Playwright: login, bakery chat, two identical FAQ requests, complex pass-through, request table reconciliation, simulator no gateway dependency, approve/disable cache, origin labels, responsive mobile layout.

Cloud smoke: Vercel live link + Supabase; real Anthropic request returns valid response and usage; persistent event after refresh and redeploy; request headers and dashboard row share request ID; repeat approved FAQ does not invoke provider; secrets not exposed. If real key unavailable, record BLOCKED, show mock test results labelled mock, do not claim LIVE.

**P0 acceptance (must pass or explicitly disclose blocked):**
1. Authenticated real Anthropic request through gateway.
2. Pre-request prediction stored before provider call.
3. Predicted vs actual usage/cost shown with estimation method.
4. Durable, source-labelled ledger reconciles dashboard totals.
5. Approved static FAQ cache hit avoids provider call.
6. No unauthorized model downgrade or output truncation.
7. Monthly forecast evaluated against naive baseline on held-out time split.
8. Anomaly detector tested with precision, recall, false positives and hard negatives.
9. What-if simulator uses same pricing and eligible demand assumptions.
10. Owner approval and audit trail for activation/rollback.
11. Secrets protected; workspace isolation tested.
12. Vercel deployment smoke tested, or blocker disclosed.
13. Three-minute demo rehearsed; backup recording prepared and clearly identified.
14. All synthetic/mocked data and unverified savings clearly labelled.

## 13. Execution plan: 24 hours, critical path first

**0–1h:** repo audit, status evidence, verify deployment/env (do not reveal secrets), freeze contracts and teammate ownership. **1–3h:** real Anthropic gateway call through Vercel with usage; fix auth/SDK issues. **3–5h:** additive DB migration + event lifecycle, prediction fields. **5–7h:** pre-request estimator/output baseline + decision function + unit tests. **7–9h:** approved exact FAQ caching + approval/rollback + adversarial tests. **9–12h:** dashboard live API integration + requests table + bakery gateway integration. **12–14h:** simulator + cost driver cards. **14–17h:** seeded dataset + forecast baseline + anomaly evaluation; optional Ridge if evidence supports it. **17–20h:** polish UI, evaluation, integration/e2e tests. **20–22h:** cloud smoke and fix critical bugs. **22–24h:** rehearse three-prompt demo, record backup, freeze build and generate proof report. Work can parallelize by frontend/backend/ML after schema freeze.

**Cut order if behind:** first cut semantic embeddings, routing, trimming, provider prompt caching, sophisticated anomaly UI; then optional trained request-level Ridge (keep baseline); then secondary charts. NEVER cut real gateway, pre-request prediction, persistence, safe cache, reconciliation, or honest provenance. If provider key blocked, deliver working simulator + mocked gateway labelled DEMO and mark live proof BLOCKED.

## 14. Three-minute judging demo

0:00–0:20: “AI API costs are variable; owners often see charges after requests complete. TokenGuard predicts and acts before the next call.” Avoid unverified survey percentages. 0:20–0:45: overview: spend, month forecast, anomaly, real/synthetic labels. 0:45–1:15: simulator: enter illustrative workload, compare no-action and approved FAQ caching, show assumptions and forecast-linked recommendation. 1:15–2:20: live three prompts: first approved FAQ (initial request may be served from approved static cache if preseeded; explain accurately), repeat FAQ (cache hit, provider cost zero), complex custom request (passes to Anthropic). Show predicted vs actual and request IDs. 2:20–2:45: held-out MAE vs baseline, anomaly false positives, adversarial cache tests. 2:45–3:00: “The simulator estimates. The gateway measures. Predict early, decide better.” If recorded, identify recording. Never demo unvalidated model routing as live.

## 15. Rubric evidence matrix

- **Problem clarity/value (20):** concrete AI-key owner, budget exposure, per-request uncertainty, real cost mechanics, no unsourced statistics.
- **Predictive rigor/data robustness (20):** true pre-request predictor with held-out output length error; monthly forecast vs naive; time splits; seeded anomalies; false positives; honest synthetic/real distinctions.
- **Decision support/actionability (20):** policy-driven cache action, scenario calculations, owner approval, rollback, recommendation tied to predicted volume and spend.
- **Explainability/trust (20):** token and price breakdown, model and action reason, uncertainty, quality gates, audit logs, provenance.
- **Live execution/pitch (20):** real gateway, persisted ledger, matching dashboard, chatbot, simulator, rehearsed demo and backup.

## 16. Security and operational requirements

Secrets only in server-side environment. `.env.example` contains placeholders, no actual values. API keys hashed; dashboard JWT verified and membership checked. Rate limits per key and workspace; body-size limit; redact logs; no raw customer chat persisted except approved fictional FAQ answers. CSRF/origin protection for owner actions. Do not expose reset endpoint publicly; if development reset exists require admin and disable in production. Add health checks, idempotency where possible, DB connection pooling appropriate for serverless, request timeout handling, and cost cap alerts (alerts do not block traffic automatically). Fail closed for cache eligibility and policy approval; fail open to original requested provider/model ONLY if valid auth and budget policy permit, and log reason. If DB unavailable, do not claim an unlogged cost-saving decision; return an honest service error or safe configured failover.

## 17. Deployment checklist

1. Provision Supabase project and enable RLS; run migration and verify policies.
2. Create server-only gateway key hash and owner account.
3. Configure Vercel env: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GATEWAY_KEY_PEPPER`, `APP_BASE_URL`, `DEMO_FX_USD_MYR` (label demo), `NODE_ENV`.
4. Configure pricing version and verify official provider rates; do not ship stale assumed rates as fact.
5. Deploy; test `/api/health`, real `/v1/messages`, auth, ledger persistence, cache repeat, owner approval, and dashboard totals.
6. Run unit/integration/e2e and smoke tests, save exact commands and results.
7. Verify Vercel runtime timeouts and no use of volatile in-memory production ledger.
8. Record 3-minute backup demo, mark as recording.

## 18. Final agent deliverables

- Functional repository changes, migrations, scripts, tests and cloud deployment configuration.
- `build_pack/API_CONTRACT.md` with canonical event JSON and endpoint examples.
- `IMPLEMENTATION_STATUS.md` with LIVE/DEMO/NEXT/BLOCKED, exact evidence, known limitations and blockers.
- `EVALUATION_REPORT.md` with dataset provenance, train/validation/test periods, baselines, held-out metrics, anomalies and quality tests; no invented numbers.
- `DEMO_RUNBOOK.md` with reset/seed procedure, exact three prompts, screenshot checkpoints, 3-minute script and backup instructions.
- `DEPLOYMENT.md` with env variable descriptions, migrations, local commands, cloud setup, smoke test and rollback.
- `README.md` with architecture, screenshots only if real, quick start, honest feature status.

## 19. Exact first instruction to execute

> Inspect the existing repository and compare it with this v3 specification. Do not rewrite working components. Produce a concise gap assessment, then immediately implement the critical path: live Anthropic gateway -> persisted pre-request prediction -> safe approved cache -> dashboard reconciliation. Continue autonomously through P0, running tests and updating status after each milestone. If repository or credentials are missing, identify the specific blocker, implement all unblocked parts, and do not claim an unverified live deployment.
