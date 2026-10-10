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

Prerequisites: Python 3.11+ with [uv](https://docs.astral.sh/uv/), Node 22, and either Docker or nothing else (see the Docker-free option).

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

With `make`: `make dev`, `make test`, `make lint`, `make smoke`. On Windows without `make`, run the commands above directly (if `uv` is not on PATH, use `python -m uv`).

### Local auth

Without Supabase configured, `POST /api/v1/auth/dev-login {"role":"owner"|"viewer"}` returns a local token for the fixed demo owner or viewer. This endpoint and HS256 dev tokens are disabled in production. BakeryBot uses `POST /api/v1/chat/session`, a 30-minute token that only works for chat on the demo bakery app.

## Checks

```bash
cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd apps/web && npm run lint && npm run typecheck && npm run build
```

API tests run against real PostgreSQL + pgvector: `TEST_DATABASE_URL` if set (as in CI), otherwise an embedded server started automatically. Tests never call the real Anthropic API.
