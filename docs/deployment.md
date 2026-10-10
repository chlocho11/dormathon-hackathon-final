# Deployment and local runbook

No cloud deployment is claimed by this document. Accounts, credentials and a successful live HTTP smoke test are required.

## Local demo

After installing dependencies, the one-command local mock demo is
`python scripts/local_demo.py` from the repository root. It uses a separate embedded
`tokenguard_local_demo` database, migrates and seeds/evaluates it, and starts API/web.
It overrides provider/auth configuration for a local mock session and requires no cloud keys.
Ctrl+C stops the web/API. Manual setup is below.
If another project uses port 3000, run `python scripts/local_demo.py --web-port 3001`.
The launcher checks ports before changing demo data and keeps frontend/API/CORS URLs aligned.
For later restarts after successful preparation, add `--skip-prepare` to reuse the
stored dataset/evaluation instead of regenerating it. Run without this flag after schema changes.

Use Node 24 and Python 3.12 with uv. From the repository root:

```powershell
Copy-Item .env.example .env
python -m pip install uv
Set-Location apps/api
python -m uv sync
python -m uv run python scripts/local_db.py
```

Copy the printed DATABASE_URL into the root .env. The embedded database is development-only. Alternatively use `docker compose up -d --wait db` from the repository root.

From apps/api:

```powershell
python -m uv run alembic upgrade head
python -m uv run python -m app.jobs.bootstrap
python -m uv run python ../../scripts/seed_demo.py --evaluate --predict
python -m uv run uvicorn app.main:app --port 8000
```

In a second terminal from apps/web:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000/login and continue as demo owner. Keep ANTHROPIC_MODE=mock during the demo if no real request is intended.

## Scripted chatbot and optional live backend

The `/demo/chat` interface now runs entirely in the browser. No API key, backend
login, cache-policy approval or provider calls are needed for it. All replies,
token usage and costs are hardcoded. Original questions fill a session cache;
exact repeats and listed paraphrases return the same answer with zero provider
tokens/cost. Reset or reload clears the session. Simulated traffic is not written
to the dashboard ledger. See [all questions and answers](scripted_chat_demo.md).

For the chatbot alone, run `npm run dev -- --port 3003` in `apps/web` and open
http://localhost:3003/demo/chat. For the whole dashboard, use the root local launcher.

The backend still supports `/api/v1/chat` and owner-only `/api/v1/chat/compare`.
To use these endpoints with real Anthropic, paste the key into the ignored root
`.env.anthropic.local` and start the launcher with `--live`. Startup validates the
key/model. These endpoints make billed calls; the scripted UI does not call them.

Baseline calls are logged under `bakery_demo_baseline`; TokenGuard calls remain under `bakery_demo`. Both count toward actual workspace usage/cost, but the baseline does not pollute bakery cache measurements. No raw questions are persisted. The separate baseline app is created idempotently; no schema migration is needed. Mock token counts/costs are illustrative, not paid savings.

Haiku 4.5 input $1 / output $5 per million tokens was checked against [official Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) on 2026-10-11 and stored in catalog `anthropic-2026-10-11`. MYR uses configured fixed FX (default 4.70), not a current exchange rate or an invoice. The comparison excludes local cache/hosting overhead; Decision Lab/Measurement retain their net-savings estimates. If changing the model, add its verified versioned pricing before use.

## Verification commands

From apps/api: `python -m uv run ruff check .`, `python -m uv run ruff format --check .`, `python -m uv run pytest`.

From apps/web: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

With the seeded API and web running:

```powershell
npx playwright install chromium
npm run test:e2e
```

The smoke runner requires a disposable local demo and refuses live Anthropic. It approves a policy, verifies caching, then disables policies in cleanup. Screenshots go to apps/web/test-results/screenshots. Optional E2E_WEB_URL/E2E_API_URL override local URLs; PLAYWRIGHT_MODULE_PATH can point to an installed Playwright module entry; E2E_BROWSER_PATH can select an installed Chromium binary.

Repository-root gateway replay: `python scripts/demo_replay.py --approve --disable-after`. Mock mode makes no paid API calls.

If registry TLS verification fails, configure the network's trusted CA via NODE_EXTRA_CA_CERTS for Node/npm and the corresponding uv certificate configuration. Do not commit certificates/secrets or turn off verification. Re-run npm ci after a partial installation.

## Hosted deployment

1. Provision Supabase PostgreSQL with pgvector and Auth. Obtain server database credentials and public Auth configuration; create the owner user.
2. Apply Alembic migrations using DATABASE_URL. Operational tables have RLS enabled with no client policies; the backend uses server DB credentials.
3. Deploy the API using render.yaml / apps/api/Dockerfile. Set DATABASE_URL, SUPABASE_URL, SUPABASE_JWKS_URL, OWNER_AUTH_USER_ID, exact ALLOWED_ORIGINS, ANTHROPIC_API_KEY and configured model. APP_ENV=production and DEMO_MODE=false. Configure strong CHAT_TOKEN_SECRET, FINGERPRINT_SECRET and SCHEDULER_SECRET.
4. Bootstrap the workspace using `python -m app.jobs.bootstrap`. This is idempotent; set OWNER_AUTH_USER_ID to the real Supabase user's UUID.
5. Deploy apps/web to Vercel as a Next.js project. Set NEXT_PUBLIC_API_BASE_URL to the API HTTPS URL and the two public Supabase variables. Never put server/provider keys in frontend variables.
6. Schedule POST /api/v1/jobs/daily with X-Scheduler-Secret using an authenticated scheduler. Confirm hosting plan support at deployment time. If scheduling is unavailable, call that secured endpoint manually.
   This job also enforces the default 30-day request / 180-day aggregate retention and removes expired cache entries.
7. Verify GET /api/v1/health, Supabase sign-in, workspace membership, gateway scope, forecast, approval, disable and UI provenance. A live chat smoke is optional, explicitly authorized and billed; cap it to one request.

Generated local ML files are not durable hosted storage. The database persists usage, forecasts, evaluations, policies and audit. Daily production forecasts use database history. Offline evaluation artifacts should be exported separately. Do not enable public synthetic seed/reset endpoints.

Blocked prerequisites: actual Supabase/Render/Vercel access and a server-side Anthropic key. Model support and pricing must be verified at live startup/use. No public URLs exist in this task's evidence.
