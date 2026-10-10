# Architecture

The Next.js dashboard authenticates with Supabase user JWTs when configured, or development-only demo tokens. Its typed API adapter calls FastAPI; React Query caches reads and invalidates relevant data after mutations. BakeryBot requests a short-lived, application-scoped chat token and does not expose provider keys.

The gateway validates scope and rate limits, applies deterministic FAQ safety checks, looks up approved answers, and calls Anthropic only when a safe cache hit cannot be served. Mock mode is explicit. The usage ledger stores token counts, estimated costs, keyed fingerprints and safe metadata rather than raw prompts.

SQLAlchemy and Alembic manage PostgreSQL with pgvector. Every operational query is workspace scoped. Daily jobs aggregate complete days, forecast segments and detect anomalies. Forecast selection and evaluation use historical temporal splits; generated rows remain labelled synthetic.

The what-if simulator transforms a persisted forecast. It subtracts lookup and fixed overhead from estimated avoided provider cost, identifies assumption sources, reports sensitivity and checks quality gates. Recommendations are deterministic. Owner approval enables policies and writes an immutable audit in one transaction. Measurement distinguishes observational estimates from holdout evidence.

Source of truth: MASTER_BUILD_PACK.md. Current verification and limitations: IMPLEMENTATION_STATUS.md.
