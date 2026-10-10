export const metadata = { title: "Sign in · TokenGuard" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-card p-6">
        <h1 className="text-xl font-semibold">Sign in to TokenGuard</h1>
        <p className="mt-2 text-muted">Authentication is implemented in Phase 1.</p>
      </div>
    </main>
  );
}
