# Security and privacy

- Supabase JWT issuer, audience and JWKS checks; membership and owner authorization are enforced by the backend.
- Development login/reset endpoints are hidden outside demo mode and in production. Scoped chat tokens cannot use owner APIs.
- Workspace isolation applies to usage, cache matching, scenarios and policies. Direct operational-table client access is denied by RLS.
- Anthropic and database credentials remain server-side. Only Supabase public URL/anon key and the API base URL belong in NEXT_PUBLIC variables.
- Application keys are hashed, shown once and rotated explicitly. Rotation invalidates the old key.
- Usage stores HMAC fingerprints and metadata. Chat history remains in browser memory only; prompts are not stored in the ledger.
- Cache hits return approved static FAQ answers after eligibility, locale, tenant, knowledge-version and expiry checks. Personal, numeric, dynamic, ambiguous and adversarial queries bypass.
- Policy activation requires owner approval with an optimistic version. Emergency disable is available. Audit rows cannot be edited/deleted.
- Input limits, bounded provider retries, timeouts, application/workspace/IP limits and sanitized error envelopes reduce abuse. The in-memory rate limiter supports only one backend instance.
- CSV export contains sanitized aggregates and neutralizes spreadsheet formula prefixes.

The daily job aggregates complete-day gateway traffic before purging request metadata older than 30 days, aggregates older than 180 days, and expired response-cache entries. Retention is workspace-scoped and configurable with REQUEST_RETENTION_DAYS / AGGREGATE_RETENTION_DAYS; immutable policy audit is retained. Historical daily totals survive metadata deletion. Savings measurement is limited to the retained metadata window, with overhead computed for the same window. Schedule the daily job for retention to run.

Before public release, configure production secrets, HTTPS, exact CORS origins, verified pricing, the daily scheduler and a durable shared rate limiter if scaling beyond one instance. Review local demo flags and do not expose a development server publicly.

## Chat comparison and local provider key

The root `.env.anthropic.local` is git-ignored and loaded by backend configuration. The launcher strips backend secrets from the web child environment; none are NEXT_PUBLIC values. Live mode is explicit (`--live`), checks key presence, validates model access at API startup, and disables SDK retries. Default mock mode never uses the key.

Comparison requires a workspace owner JWT; public chat tokens, viewers and other-workspace owners are rejected before provider calls. Both arms reserve rate-limit slots. Direct-provider usage is logged under a separate baseline application in the same workspace, with identical approved facts and no FAQ-cache decision. Actual baseline experiment spend still contributes to workspace totals. UI totals live only in the current tab, do not persist raw prompts, and exclude unknown/failed usage from paired comparisons. Costs are estimates and exclude local overhead.

## Dependency audit results (2026-10-11)

`npm audit --omit=dev` reports zero production dependency vulnerabilities after overriding PostCSS to 8.5.29. The unused `cn` package was removed; the shadcn generator/CSS build package is now a development dependency. Playwright is pinned as a development dependency so browser checks are reproducible.

The full audit still reports nine high findings through development-only `braces` / `micromatch` / glob tooling, including ESLint and shadcn. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. These tools receive repository-controlled file patterns during local builds, not customer chat input. This is a scoped exposure assessment, not a claim that the full audit is clean. Do not pass untrusted glob patterns into development tools; track the upstream fix. The PostCSS update addresses the [source-map advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). CI checks production dependency advisories.
