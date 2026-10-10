export const metadata = { title: "Sweet Crumbs BakeryBot · Demo" };

export default function DemoChatPage() {
  return (
    <main className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
        Demo only: Sweet Crumbs Bakery is fictitious. No real orders or payments.
      </div>
      <div className="rounded-[var(--radius-card)] border border-line bg-card p-6">
        <h1 className="text-xl font-semibold">Sweet Crumbs BakeryBot</h1>
        <p className="mt-2 text-muted">The chat gateway is implemented in Phase 1.</p>
      </div>
    </main>
  );
}
