# TokenGuard AI

Predictive AI cost intelligence for small businesses: forecast Anthropic API spend, flag budget risk and abnormal usage, simulate safe interventions (FAQ semantic caching) against the same forecast, and activate them only with owner approval.

Full specification: [MASTER_BUILD_PACK.md](MASTER_BUILD_PACK.md). Progress and verified evidence: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Layout

| Path | What |
|---|---|
| `apps/api` | FastAPI backend (Python 3.12, SQLAlchemy 2, Alembic, uv) |
| `apps/web` | Next.js 15 dashboard + BakeryBot demo (Tailwind v4, Lucide) |
| `scripts/` | Synthetic data generation, seeding, evaluation, smoke tests |
| `data/generated/`, `artifacts/` | Generated, git-ignored outputs |

## Local setup

After dependencies are installed, `python scripts/local_demo.py` prepares a separate
embedded demo database, generates/evaluates synthetic history, and launches API/web
in mock mode. See [the runbook](docs/deployment.md) for verification and manual setup.
If port 3000 is occupied, use `python scripts/local_demo.py --web-port 3001`.
On subsequent runs, add `--skip-prepare` to reuse the prepared database and evaluation.
The chatbot at `/demo/chat` is a scripted split-screen demo: fixed answers, tokens,
and costs, with exact and predefined semantic cache hits. It makes no API calls and
needs no key. See [the question guide](docs/scripted_chat_demo.md).
The backend retains live Anthropic endpoints; `--live` enables those endpoints only.

Prerequisites: Python 3.12 with [uv](https://docs.astral.sh/uv/), Node 24, and either Docker or the embedded PostgreSQL option.

```bash
cp .env.example .env                 # leave ANTHROPIC_API_KEY empty for mock mode

# Database: EITHER Docker...
docker compose up -d --wait db        # Postgres 16 + pgvector on :5432
# ...OR Docker-free embedded Postgres 16 + pgvector; copy the printed URL into DATABASE_URL in .env
cd apps/api && uv run python scripts/local_db.py

cd apps/api
uv sync
uv run alembic upgrade head
uv run python -m app.jobs.bootstrap   # demo workspace, apps, FAQ, pricing (idempotent)
uv run uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs

cd apps/web
npm install
npm run dev                           # http://localhost:3000

python scripts/smoke_test.py          # end-to-end HTTP check of the running API
```

### Synthetic history, evaluation and forecasts

```bash
cd apps/api
uv run python ../../scripts/seed_demo.py --evaluate --predict
#   = generate seed-42 synthetic data (180 days ending yesterday) -> load into the demo workspace
#   -> offline evaluation (docs/evaluation_report.md, artifacts/evaluation/) -> forecast + anomaly detection
uv run python -m app.jobs.predict     # daily job: aggregate real traffic, forecast, detect anomalies
```

`make seed` and `make train` wrap these. All synthetic rows are labelled `data_origin=synthetic`; see [docs/data_dictionary.md](docs/data_dictionary.md) and [docs/model_card.md](docs/model_card.md).

### Decision loop demo (cache recommendation -> approval -> replay)

```bash
python scripts/demo_replay.py --approve --disable-after
# same 10 prompts before/after owner approval: provider calls drop for safe FAQ intents only;
# order-status / personal / numeric prompts still go to the provider. Mock mode spends nothing.
```

With `make`: `make dev`, `make test`, `make lint`, `make smoke`. On Windows without `make`, run the commands above directly (if `uv` is not on PATH, use `python -m uv`).

### Local auth

Without Supabase configured, `POST /api/v1/auth/dev-login {"role":"owner"|"viewer"}` returns a local token for the fixed demo owner or viewer. This endpoint and HS256 dev tokens are disabled in production. BakeryBot uses `POST /api/v1/chat/session`, a 30-minute token that only works for chat on the demo bakery app.

## Checks

The dashboard has API-backed Overview, Predictions, Anomalies, Decision Lab, Usage Explorer,
Evaluation and Settings. BakeryBot is at `/demo/chat`. Use demo owner/viewer sign-in locally;
hosted sign-in uses Supabase. The current verification state is in IMPLEMENTATION_STATUS.md.

```bash
cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd apps/web && npm run lint && npm run typecheck && npm run build
```

API tests run against real PostgreSQL + pgvector: `TEST_DATABASE_URL` if set (as in CI), otherwise an embedded server started automatically. Tests never call the real Anthropic API.

Frontend data tests: `cd apps/web`, then `npm test` (Node 24 recommended).
Browser smoke with a seeded local mock API and web running:
`npx playwright install chromium`, then `npm run test:e2e`.
This approves and then disables local demo policies; use a disposable demo workspace.

See [deployment runbook](docs/deployment.md), [three-minute demo](docs/demo_script.md),
[architecture](docs/architecture.md), [security notes](docs/security.md), and
[rubric evidence](docs/rubric_evidence.md).
