"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { DataSourceBadge } from "@/components/data-source-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatMetric, formatNum, formatPct } from "@/lib/format";
import { useEvaluation, useForecast } from "@/lib/queries";
import type { RegressionScores } from "@/lib/types";

export default function EvaluationPage() {
  const evaluation = useEvaluation();
  const forecast = useForecast();
  const [origin, setOrigin] = useState("");
  const ev = evaluation.data?.evaluation;
  const results = ev?.results;
  const fc = results?.forecast;
  const anomaly = results?.anomaly?.splits?.test;
  const cache = results?.cache;
  const plot = (fc?.backtest_plot ?? []) as { origin: string; day: string; actual: number; forecast: number; seasonal_naive: number }[];
  const origins = [...new Set(plot.map((p) => p.origin))];
  const chosenOrigin = origins.includes(origin) ? origin : origins[0];
  const scores = (fc?.test?.scores ?? {}) as Record<string, { workspace_daily: RegressionScores }>;
  const mix = forecast.data && "data_mix" in forecast.data ? forecast.data.data_mix : null;
  return <>
    <PageHeader title="Evaluation" description="Measured runs, held-out baselines and known limitations. Synthetic results are not evidence of real-world accuracy." badges={ev ? <DataSourceBadge origin={ev.data_origin === "real" ? "real" : "synthetic"} /> : undefined} />
    {evaluation.isLoading && <LoadingBlock />}{evaluation.isError && <ErrorState error={evaluation.error} onRetry={() => evaluation.refetch()} />}
    {evaluation.data && !ev && <EmptyState title="No evaluation has been run">Run the offline evaluation and seed the demo to publish measured results here.</EmptyState>}
    {ev && <div className="space-y-8">
      <p className="text-sm text-muted-foreground">Run {formatDateTime(ev.evaluated_at)} · dataset {ev.dataset_version} · seed {ev.seed} · {ev.method}</p>
      <section><SectionTitle>Forecast against baselines</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">Selected model: {fc?.selection?.chosen ?? "n/a"}. {fc?.selection?.reason ?? ""} Selection uses validation only; these scores use the held-out test window.</p>
        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>{["Model", "MAE (MYR)", "RMSE (MYR)", "WAPE", "sMAPE"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{Object.entries(scores).map(([name, s]) => <TableRow key={name}><TableCell>{name}{name === fc?.selection?.chosen ? " · selected" : ""}</TableCell><TableCell>{formatMetric(s.workspace_daily.mae)}</TableCell><TableCell>{formatMetric(s.workspace_daily.rmse)}</TableCell><TableCell>{formatPct(s.workspace_daily.wape, 1)}</TableCell><TableCell>{formatPct(s.workspace_daily.smape, 1)}</TableCell></TableRow>)}</TableBody></Table></div>
        <p className="mt-3 text-xs text-muted-foreground">Lower error is better. The selected model can lose to a simpler baseline on the test window; all results remain visible.</p>
        <p className="mt-3 text-sm">Interval coverage: nominal {formatPct(fc?.test?.interval_coverage?.nominal, 1)}, segment-days {formatPct(fc?.test?.interval_coverage?.segment_daily, 1)}, cumulative totals {formatPct(fc?.test?.interval_coverage?.cumulative_total, 1)}. Under-coverage means uncertainty is understated on this test set.</p>
      </section>
      {!!plot.length && <section className="rounded-lg border bg-card p-4 sm:p-6"><SectionTitle aside={<select aria-label="Backtest origin" value={chosenOrigin} onChange={(e) => setOrigin(e.target.value)} className="rounded border p-2">{origins.map((o) => <option key={o}>{o}</option>)}</select>}>Held-out backtest · daily cost (MYR)</SectionTitle><div className="h-64" role="img" aria-label="Backtest actual, selected forecast and seasonal baseline in MYR"><ResponsiveContainer width="100%" height="100%"><LineChart data={plot.filter((p) => p.origin === chosenOrigin)}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="day" minTickGap={35} /><YAxis /><Tooltip /><Line dataKey="actual" name="Actual (synthetic)" stroke="#202124" dot={false} /><Line dataKey="forecast" name="Selected forecast" stroke="#2563eb" dot={false} /><Line dataKey="seasonal_naive" name="Seasonal baseline" stroke="#71717a" strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer></div></section>}
      <section><SectionTitle>Anomaly detection · held-out test</SectionTitle>{anomaly ? <><dl className="grid gap-3 rounded-lg border bg-card p-5 sm:grid-cols-3">{[["Precision", formatPct(anomaly.day_level?.precision, 1)], ["Recall", formatPct(anomaly.day_level?.recall, 1)], ["F1", formatMetric(anomaly.day_level?.f1)], ["False alerts / 30 days", formatMetric(anomaly.false_alerts_per_30_days, 2)], ["Mean detection delay (days)", formatMetric(anomaly.mean_detection_delay_days, 2)], ["Event recall", formatPct(anomaly.event_recall, 1)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><div className="mt-3 overflow-auto"><Table><TableHeader><TableRow><TableHead>Confusion matrix (days)</TableHead><TableHead>Predicted alert</TableHead><TableHead>Predicted normal</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Actual anomaly</TableCell><TableCell>{formatNum(anomaly.confusion_matrix?.tp)}</TableCell><TableCell>{formatNum(anomaly.confusion_matrix?.fn)}</TableCell></TableRow><TableRow><TableCell>Actual normal</TableCell><TableCell>{formatNum(anomaly.confusion_matrix?.fp)}</TableCell><TableCell>{formatNum(anomaly.confusion_matrix?.tn)}</TableCell></TableRow></TableBody></Table></div></> : <EmptyState title="No anomaly evaluation" />}</section>
      <section><SectionTitle>Safe FAQ cache · labelled adversarial queries</SectionTitle>{cache ? <><dl className="grid gap-3 rounded-lg border bg-card p-5 sm:grid-cols-4">{[["Accepted-hit precision", formatPct(cache.hit_precision, 1)], ["Positive coverage", formatPct(cache.positive_coverage, 1)], ["Adversarial false hits", formatNum(cache.adversarial_false_hits)], ["Queries tested", formatNum(cache.n)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl><p className="mt-3 text-sm text-muted-foreground">{cache.caveat} Threshold {cache.threshold}; safety gate and approved answers are required.</p></> : <EmptyState title="No cache evaluation" />}</section>
      <section><SectionTitle>Forecast training provenance</SectionTitle>{mix ? <div className="overflow-auto"><Table><TableHeader><TableRow><TableHead>Origin</TableHead><TableHead>Days</TableHead><TableHead>Rows</TableHead><TableHead>Cost share</TableHead></TableRow></TableHeader><TableBody>{Object.entries(mix).map(([name, d]) => <TableRow key={name}><TableCell>{name}</TableCell><TableCell>{d.days}</TableCell><TableCell>{d.rows}</TableCell><TableCell>{formatPct(d.cost_share, 1)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="text-muted-foreground">No forecast training mix available.</p>}<p className="mt-3 text-xs text-muted-foreground">Gateway-origin records can include mock traffic. They are not proof of paid Anthropic usage.</p></section>
      <section className="space-y-3 rounded-lg border bg-card p-5"><SectionTitle>Limitations and model card</SectionTitle><p>Forecasts can under-predict sustained upward drift. Empirical intervals may under-cover during shifts. Anomaly explanations describe correlations, not proven causes. Cache coverage is deliberately conservative.</p><p className="text-sm text-muted-foreground">The evaluation uses synthetic history and a small hand-labelled bakery FAQ set. Zero false hits on this set does not guarantee correctness for new queries.</p><a className="text-primary underline underline-offset-4" href="/model-card">Read the model card</a></section>
    </div>}
  </>;
}
