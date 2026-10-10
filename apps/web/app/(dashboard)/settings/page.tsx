"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { OwnerButton } from "@/components/owner-button";
import { ErrorState, LoadingBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { appLabel, formatMYR } from "@/lib/format";
import { useHealth, usePolicies, useSettings } from "@/lib/queries";
import type { Policy } from "@/lib/types";

function PolicyEditor({ policy, owner, onSaved }: { policy: Policy; owner: boolean; onSaved: () => void }) {
  const [threshold, setThreshold] = useState(String(policy.similarity_threshold));
  const [ttl, setTtl] = useState(String(policy.ttl_hours));
  const [holdout, setHoldout] = useState(policy.holdout_enabled);
  const patch = useMutation({ mutationFn: () => api.patchPolicy(policy.id, { similarity_threshold: Number(threshold), ttl_hours: Number(ttl), holdout_enabled: holdout }), onSuccess: () => { toast.success("Policy settings saved"); onSaved(); } });
  const disable = useMutation({ mutationFn: () => api.disablePolicy(policy.id), onSuccess: () => { toast.success("Cache disabled"); onSaved(); } });
  const valid = threshold.trim() !== "" && Number(threshold) >= 0.95 && Number(threshold) <= 0.99 && Number.isInteger(Number(ttl)) && Number(ttl) >= 1 && Number(ttl) <= 168;
  return <form className="space-y-4 rounded-lg border bg-card p-5" onSubmit={(e) => { e.preventDefault(); if (valid && owner) patch.mutate(); }}>
    <SectionTitle>{appLabel(policy.application)} · {policy.enabled ? "Enabled" : "Disabled"}</SectionTitle>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="space-y-1 text-sm">Similarity threshold (0.95–0.99)<Input aria-label={appLabel(policy.application) + " threshold"} type="number" min="0.95" max="0.99" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} disabled={!owner} /></label>
      <label className="space-y-1 text-sm">TTL (1–168 hours)<Input aria-label={appLabel(policy.application) + " TTL"} type="number" min="1" max="168" step="1" value={ttl} onChange={(e) => setTtl(e.target.value)} disabled={!owner} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={holdout} onChange={(e) => setHoldout(e.target.checked)} disabled={!owner} />Keep a 10% measurement holdout</label>
    </div>
    <p className="text-xs text-muted-foreground">Approved static FAQs only. A threshold is not a guarantee of equivalent answers. Enable caching through owner approval in Decision Lab.</p>
    <div className="flex flex-wrap gap-2"><OwnerButton type="submit" disabled={!valid || patch.isPending}>Save policy settings</OwnerButton>{policy.enabled && <OwnerButton type="button" variant="destructive" disabled={disable.isPending} onClick={() => disable.mutate()}>Disable cache</OwnerButton>}</div>
    {patch.isError && <ErrorState error={patch.error} />}{disable.isError && <ErrorState error={disable.error} />}
  </form>;
}

export default function SettingsPage() {
  const settings = useSettings();
  const policies = usePolicies();
  const health = useHealth();
  const qc = useQueryClient();
  const [budget, setBudget] = useState("");
  const [confirmation, setConfirmation] = useState<{ kind: "key" | "faq" | "reset"; appId?: string; name?: string } | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const owner = settings.data?.role === "owner";
  const refresh = () => { void qc.invalidateQueries(); };
  const save = useMutation({ mutationFn: () => api.patchSettings({ monthly_budget_myr: Number(budget) }), onSuccess: () => { setBudget(""); toast.success("Budget saved. Run a new forecast to use it."); refresh(); } });
  const action = useMutation({ mutationFn: async () => {
    if (!confirmation) return;
    if (confirmation.kind === "key") return api.rotateKey(confirmation.appId!);
    if (confirmation.kind === "faq") return api.invalidateFaq();
    return api.demoReset();
  }, onSuccess: (result) => { if (result && "api_key" in result) setKey(result.api_key); setConfirmation(null); setConfirmText(""); toast.success("Change saved"); refresh(); } });
  const validBudget = budget.trim() !== "" && Number.isFinite(Number(budget)) && Number(budget) >= 0 && Number(budget) <= 1000000;
  function open(c: NonNullable<typeof confirmation>) { action.reset(); setConfirmText(""); setKey(null); setConfirmation(c); }
  return <>
    <PageHeader title="Settings" description="Workspace budget, application access and approved FAQ policies." />
    {settings.isLoading && <LoadingBlock />}{settings.isError && <ErrorState error={settings.error} onRetry={() => settings.refetch()} />}
    {settings.data && <div className="space-y-8">
      {!owner && <p className="rounded-lg border bg-muted p-3">Viewer access. Only the workspace owner can change these settings.</p>}
      <section className="space-y-4 rounded-lg border bg-card p-5"><SectionTitle>{settings.data.name}</SectionTitle><p className="text-sm text-muted-foreground">Currency: {settings.data.currency} · Timezone: {settings.data.timezone} · Current budget: {formatMYR(settings.data.monthly_budget_myr)}</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (validBudget && owner) save.mutate(); }}><label className="space-y-1 text-sm">Monthly budget (MYR)<Input aria-label="Monthly budget (MYR)" type="number" min="0" max="1000000" step="0.01" placeholder={String(settings.data.monthly_budget_myr)} value={budget} onChange={(e) => setBudget(e.target.value)} disabled={!owner} /></label><OwnerButton type="submit" disabled={!validBudget || save.isPending}>Save budget</OwnerButton></form>{save.isError && <ErrorState error={save.error} />}
        <p className="text-xs text-muted-foreground">Provider mode: {settings.data.provider_mode}. Fixed demo FX: {settings.data.fx_myr_per_usd_demo} MYR/USD (estimate, not a live rate). Pricing catalog: {settings.data.pricing_catalog_version}; verify rates before using live cost estimates.</p>
      </section>
      <section className="space-y-4"><SectionTitle>Cache policies</SectionTitle>{policies.isLoading && <LoadingBlock />}{policies.isError && <ErrorState error={policies.error} onRetry={() => policies.refetch()} />}{policies.data?.items.map((p) => <PolicyEditor key={p.id + "-" + p.version} policy={p} owner={owner} onSaved={refresh} />)}</section>
      <section className="space-y-4 rounded-lg border bg-card p-5"><SectionTitle>Application integration</SectionTitle><p className="text-sm text-muted-foreground">Send requests to {API_BASE_URL}/api/v1/chat using your server-side application key in the X-App-Key header. Keep it out of browser code. Rotation immediately invalidates the previous key.</p>{settings.data.applications.map((a) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div><p>{appLabel(a.name)}</p><code className="break-all text-xs text-muted-foreground">{a.id}</code></div><OwnerButton variant="outline" onClick={() => open({ kind: "key", appId: a.id, name: a.name })}>{a.has_api_key ? "Rotate" : "Create"} application key</OwnerButton></div>)}{key && <div className="space-y-2 rounded-lg bg-blue-50 p-4"><p className="text-sm">Shown once. Copy this key now and keep it server-side.</p><code className="block break-all select-all text-sm">{key}</code><Button variant="outline" onClick={() => setKey(null)}>Dismiss key</Button></div>}</section>
      <section className="space-y-3 rounded-lg border bg-card p-5"><SectionTitle>Knowledge and data provenance</SectionTitle><p>FAQ knowledge version: {settings.data.knowledge_version}</p><p className="text-sm text-muted-foreground">{settings.data.data_sources.synthetic_days} synthetic days · {settings.data.data_sources.real_requests} gateway requests (may include mock traffic). Synthetic means generated history; mock means no paid provider call; forecast means a future estimate.</p><OwnerButton variant="outline" onClick={() => open({ kind: "faq" })}>Invalidate FAQ cache</OwnerButton></section>
      {health.data?.demo_mode && health.data.environment !== "production" && <section className="space-y-3 rounded-lg border border-destructive/30 p-5"><SectionTitle>Reset local demo</SectionTitle><p className="text-sm text-muted-foreground">Deletes workspace requests, daily history, forecasts, anomalies and decisions; disables policies. Audit records are retained. Seed again afterward.</p><OwnerButton variant="destructive" onClick={() => open({ kind: "reset" })}>Reset demo data</OwnerButton></section>}
    </div>}
    <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open && !action.isPending) setConfirmation(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmation?.kind === "key" ? "Replace application access key?" : confirmation?.kind === "faq" ? "Invalidate FAQ cache?" : "Delete demo operational data?"}</DialogTitle><DialogDescription>{confirmation?.kind === "key" ? "The previous key stops working immediately. The replacement is shown only once." : confirmation?.kind === "faq" ? "This increments the knowledge version and expires existing cache entries. Requests resume through the provider until approved FAQs are available for the new version." : "This deletes the local demo history and decisions. The immutable audit log is retained. Type RESET to confirm."}</DialogDescription></DialogHeader>
      {confirmation?.kind === "reset" && <Input aria-label="Type RESET" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />}
      {action.isError && <ErrorState error={action.error} />}
      <DialogFooter><Button variant="outline" disabled={action.isPending} onClick={() => setConfirmation(null)}>Cancel</Button><Button variant={confirmation?.kind === "reset" ? "destructive" : "default"} disabled={!owner || action.isPending || (confirmation?.kind === "reset" && confirmText !== "RESET")} onClick={() => action.mutate()}>Confirm change</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
