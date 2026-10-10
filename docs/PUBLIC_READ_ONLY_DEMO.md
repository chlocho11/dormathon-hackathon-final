# Public read-only deployment

After pushing this change to the deployed branch:

1. Render → tokenguard-api → Environment: add `PUBLIC_DEMO_ENABLED` = `true`.
2. Keep `DEMO_MODE` = `false` and existing Supabase authentication settings.
3. Save and redeploy Render. The existing seeded `sweet-crumbs` workspace becomes publicly readable. An optional `PUBLIC_DEMO_WORKSPACE_SLUG` selects a different workspace deliberately.
4. Vercel → project → Settings → Environment Variables: add `NEXT_PUBLIC_PUBLIC_DEMO_ENABLED` = `true` for Production (and Preview if needed). This is a public configuration value.
5. Redeploy Vercel after saving. Next.js includes this setting at build time.
6. Open the production website in a private browser window. It should open Overview directly and show “Guest · read-only”.

Guests can browse charts, forecasts, anomalies, usage and the browser-based chatbot. Scenario previews calculate results and roll back their database transaction. They cannot save budgets, approve or change policies, generate recommendations, run forecasts or use the authenticated provider comparison endpoint. Workspace authorization restricts guests to the configured public workspace. Invalid tokens are rejected rather than downgraded to guest access.

Owners can choose “Owner sign in” in the user menu, or visit `/login`, to use their existing Supabase account and workspace membership. Public mode does not create owner accounts or memberships. Disable both public-access settings and redeploy to restore mandatory login.
