export function PagePlaceholder({ title, description, phase }: { title: string; description: string; phase: number }) {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted">{description}</p>
      </header>
      <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-card p-6 text-muted">
        No data yet. This screen is wired up in Phase {phase}; no values are shown until real computations exist.
      </div>
    </section>
  );
}
