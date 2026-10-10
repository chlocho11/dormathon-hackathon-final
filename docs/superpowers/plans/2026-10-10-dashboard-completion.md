# Dashboard completion and local delivery

**Goal:** Complete the remaining P0 screens and verify the local prediction → decision → approval → chat loop in MASTER_BUILD_PACK.md.

**Architecture:** Extend the existing Next.js client, React Query hooks, typed FastAPI adapter, shadcn components and light dashboard theme. The backend remains the authority for forecasts, costs, permissions and activation. Use mock Anthropic for verification.

## Work items
- [x] Usage Explorer: daily filters by date, origin, app, model and category; totals, chart, sanitized CSV, request pagination and sorting.
- [x] Evaluation: stored baseline scores, backtest chart, anomaly confusion matrix, cache quality, dataset proportions and limitations; honest not-run state.
- [x] Settings: owner budget edit, safe policy edits, disable, confirmed key rotation and FAQ invalidation; demo reset only in demo mode.
- [x] BakeryBot: scoped session, sample prompts, message form, reply metadata and mock/live labels; expired-session recovery without automatically resending a billed request.
- [ ] Validate the merged screens and correct build/API integration defects.
- [x] Add browser smoke coverage for the critical flow and wire it into CI; execution remains pending frontend dependency installation.
- [ ] Run frontend lint/typecheck/build and backend checks. Exercise the seeded local demo and inspect desktop/mobile.
- [x] Complete architecture/security/deployment/demo/rubric docs and update IMPLEMENTATION_STATUS.md with observed evidence and blockers.

## Verification
Use `npm run lint`, `npm run typecheck`, `npm run build`, backend `ruff check`, `ruff format --check`, `pytest`, and Playwright. Browser assertions check behavior and backend-derived values, owner/viewer actions, provenance, error recovery and mobile navigation. Public deployment needs account access and an HTTP smoke test before it can be marked complete.
