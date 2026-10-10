"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { appLabel, categoryLabel, formatDateTime, formatMYR, formatNum, formatPct } from "@/lib/format";
import { useHealth, useUsageDaily } from "@/lib/queries";
import { csvCell, filterUsage, requestDay, usageTotals } from "@/lib/usage-data";

export default function UsagePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [origin, setOrigin] = useState("");
  const [app, setApp] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const usage = useUsageDaily({ from, to, data_origin: origin || undefined });
  const health = useHealth();
  const requests = useInfiniteQuery({ queryKey: ["usageRequests"], queryFn: ({ pageParam }) => api.usageRequests(pageParam), initialPageParam: null as string | null, getNextPageParam: (last) => last.next_cursor ?? undefined });
  const invalidRange = Boolean(from && to && from > to);
  const rows = filterUsage(usage.data?.items ?? [], { from, to, origin, app, model, category });
  const total = usageTotals(rows);
  const days = new Map<string, { day: string; synthetic: number; real: number }>();
  for (const r of rows) {
    const day = days.get(r.day) ?? { day: r.day, synthetic: 0, real: 0 };
    day[r.data_origin] += r.cost_myr;
    days.set(r.day, day);
  }
  const series = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  const requestRows = filterUsage((requests.data?.pages.flatMap((p) => p.items) ?? []).map((r) => ({ ...r, day: requestDay(r.occurred_at) })), { from, to, origin, app, model, category }).sort((a, b) => sort === "cost" ? b.estimated_cost_myr - a.estimated_cost_myr : sort === "latency" ? b.latency_ms - a.latency_ms : b.occurred_at.localeCompare(a.occurred_at));
  function exportCsv() {
    const columns = ["day", "application", "model", "request_category", "data_origin", "requests", "input_tokens", "output_tokens", "cost_myr", "cache_hits"] as const;
    const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "tokenguard-usage.csv"; link.click(); URL.revokeObjectURL(url);
  }
  const options = (field: "application" | "model" | "request_category") => [...new Set(usage.data?.items.map((r) => r[field]) ?? [])].sort();
  return <>
    <PageHeader title="Usage Explorer" description="Estimated daily costs and request metadata. Raw customer prompts are never shown." actions={<Button variant="outline" onClick={exportCsv} disabled={!rows.length}>Export aggregates CSV</Button>} />
    <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <label className="space-y-1 text-xs">From<Input aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="space-y-1 text-xs">To<Input aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      {([ ["Origin", origin, setOrigin, ["synthetic", "real"]], ["Application", app, setApp, options("application")], ["Model", model, setModel, options("model")], ["Category", category, setCategory, options("request_category")] ] as const).map(([label, value, setter, values]) => <label key={label} className="space-y-1 text-xs">{label}<select aria-label={label} className="h-9 w-full rounded-md border bg-card px-2" value={value} onChange={(e) => setter(e.target.value)}><option value="">All</option>{values.map((v) => <option key={v} value={v}>{label === "Application" ? appLabel(v) : label === "Category" ? categoryLabel(v) : v}</option>)}</select></label>)}
    </div>
    {invalidRange && <p role="alert" className="mb-4 text-destructive">From date must be before or equal to To date.</p>}
    {usage.isLoading && <LoadingBlock />}{usage.isError && <ErrorState error={usage.error} onRetry={() => usage.refetch()} />}
    {usage.data && <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Estimated provider cost" value={formatMYR(total.cost)} /><MetricCard label="Requests" value={formatNum(total.requests)} /><MetricCard label="Tokens" value={formatNum(total.tokens)} /><MetricCard label="Cache hit rate" value={formatPct(total.requests ? total.hits / total.requests : null)} /></div>
      <p className="text-xs text-muted-foreground">Synthetic history is simulated. Gateway traffic may use a mock provider{health.data?.dependencies.anthropic.mode === "mock" ? " (currently mock; no real API charge)" : ""}. Costs use a fixed demo FX estimate. Daily aggregates include complete days only; recent requests appear below.</p>
      {!rows.length ? <EmptyState title="No usage in this selection">Adjust the filters or seed demo history.</EmptyState> : <section className="rounded-lg border bg-card p-4 sm:p-6"><SectionTitle>Daily estimated cost (MYR)</SectionTitle><div className="h-64" role="img" aria-label="Daily estimated cost by synthetic and gateway origin"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" minTickGap={40} /><YAxis /><Tooltip formatter={(v) => formatMYR(Number(v))} /><Line dataKey="synthetic" name="Synthetic" stroke="#71717a" dot={false} /><Line dataKey="real" name="Gateway (may be mock)" stroke="#2563eb" dot={false} /></LineChart></ResponsiveContainer></div></section>}
      <section><SectionTitle>Daily aggregates · {rows.length} rows</SectionTitle><div className="max-h-96 overflow-auto rounded-lg border"><Table><TableHeader><TableRow>{["Day", "Application / origin", "Model / category", "Requests", "Input / output tokens", "MYR", "Hits"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={[r.day,r.application,r.model,r.request_category,r.data_origin].join("-")}><TableCell>{r.day}</TableCell><TableCell>{appLabel(r.application)}<p className="text-xs text-muted-foreground">{r.data_origin}</p></TableCell><TableCell>{r.model}<p className="text-xs text-muted-foreground">{categoryLabel(r.request_category)}</p></TableCell><TableCell>{formatNum(r.requests)}</TableCell><TableCell>{formatNum(r.input_tokens)} / {formatNum(r.output_tokens)}</TableCell><TableCell>{formatMYR(r.cost_myr, true)}</TableCell><TableCell>{r.cache_hits}</TableCell></TableRow>)}</TableBody></Table></div></section>
    </div>}
    <section className="mt-8 space-y-3"><SectionTitle aside={<select aria-label="Sort requests" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded border p-2"><option value="newest">Newest first</option><option value="cost">Highest cost</option><option value="latency">Highest latency</option></select>}>Request metadata</SectionTitle><p className="text-xs text-muted-foreground">Filters and sorting apply to loaded requests. Load more to inspect older records. Dates in this table use Kuala Lumpur time.</p>
      {requests.isLoading && <LoadingBlock />}{requests.isError && <ErrorState error={requests.error} onRetry={() => requests.refetch()} />}
      {requests.data && !requestRows.length && <EmptyState title="No matching loaded requests" />}
      {!!requestRows.length && <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>{["Time", "Application", "Provider", "Category", "Cache", "Tokens in / out", "MYR", "Latency"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{requestRows.map((r) => <TableRow key={r.id}><TableCell>{formatDateTime(r.occurred_at)}</TableCell><TableCell>{appLabel(r.application)}</TableCell><TableCell>{r.provider_mode}<p className="text-xs">{r.model}</p></TableCell><TableCell>{categoryLabel(r.request_category)}</TableCell><TableCell>{r.cache_status}</TableCell><TableCell>{r.input_tokens} / {r.output_tokens}</TableCell><TableCell>{formatMYR(r.estimated_cost_myr, true)}</TableCell><TableCell>{r.latency_ms} ms</TableCell></TableRow>)}</TableBody></Table></div>}
      {requests.hasNextPage && <Button variant="outline" disabled={requests.isFetchingNextPage} onClick={() => requests.fetchNextPage()}>Load more requests</Button>}
    </section>
  </>;
}
