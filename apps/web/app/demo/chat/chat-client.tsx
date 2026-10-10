"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatMYR, formatNum, titleCase } from "@/lib/format";
import { pairedCostDifference, tallyArm } from "@/lib/chat-comparison";
import type { ChatComparison, ChatResponse, ChatSession, ComparisonArm } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/states";

const prompts = ["What time do you open?", "Do you deliver?", "What cakes do you sell?", "Do you open on Sunday?", "Is my order ready?"];
type Message = { id: number; question: string; comparison?: ChatComparison; response?: ChatResponse; failed?: boolean; comparing: boolean };

function Reply({ arm, pending, label }: { arm?: ComparisonArm; pending: boolean; label?: string }) {
  const response = arm?.response;
  return <div className="min-w-0 rounded-lg border bg-card p-4">
    {label && <h3 className="mb-2 text-sm font-medium">{label}</h3>}
    <p className="whitespace-pre-wrap break-words">{response?.reply ?? (pending ? "Preparing your reply…" : arm?.error?.message ?? "No response received. Usage is unknown; check Usage Explorer before retrying.")}</p>
    {arm?.error && <p className="mt-2 text-xs text-amber-800">Failed call: no returned usage. It is excluded from totals and paired cost differences.</p>}
    {response && <div className="mt-4 space-y-2 border-t pt-3 text-xs text-muted-foreground" aria-label="Request details">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{["exact_hit", "semantic_hit"].includes(response.cache_status) ? "Safe cache hit" : response.cache_status === "bypass" ? "Bypass · provider call" : "Provider call"}</Badge>
        <Badge variant="outline">{response.provider_mode === "mock" ? "Mock provider · no API charge" : response.provider_mode === "none" ? "Approved FAQ answer" : "Live Anthropic"}</Badge>
      </div>
      <p>{formatNum(response.usage.input_tokens)} input / {formatNum(response.usage.output_tokens)} output tokens · {formatMYR(response.estimated_cost_myr, true)} estimated provider cost</p>
      <p>{titleCase(response.cache_decision ?? response.cache_status)}</p>
    </div>}
  </div>;
}

function Totals({ name, arm, totals }: { name: string; arm: string; totals: ReturnType<typeof tallyArm> }) {
  return <section className={`min-w-0 rounded-lg border p-5 ${arm === "tokenguard" ? "border-blue-200 bg-blue-50/40" : "bg-card"}`} aria-label={name}>
    <h2 className="text-lg font-semibold">{name}</h2>
    <p className="mb-4 mt-1 text-xs text-muted-foreground">{arm === "baseline" ? "Every question goes directly to Anthropic." : "Approved safe FAQs avoid a provider call."}</p>
    <dl className="grid grid-cols-2 gap-4 tabular">
      <div><dt className="text-xs text-muted-foreground">Input tokens</dt><dd className="text-xl font-semibold" data-testid={`${arm}-input-total`}>{formatNum(totals.input_tokens)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Output tokens</dt><dd className="text-xl font-semibold" data-testid={`${arm}-output-total`}>{formatNum(totals.output_tokens)}</dd></div>
      <div className="col-span-2"><dt className="text-xs text-muted-foreground">Estimated provider cost</dt><dd className="text-2xl font-semibold" data-testid={`${arm}-cost-total`}>{formatMYR(totals.estimated_cost_myr, true)}</dd></div>
    </dl>
    <p className="mt-4 text-xs text-muted-foreground">{totals.completed} completed · {totals.provider_calls} provider calls · {totals.cache_hits} cache hits{totals.errors > 0 ? ` · ${totals.errors} failed (usage unknown)` : ""}</p>
  </section>;
}

export function ChatClient() {
  const session = useRef<ChatSession | null>(null);
  const sequence = useRef(0);
  const busy = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [compareMode, setCompareMode] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const settings = useQuery({ queryKey: ["chat-settings"], queryFn: api.settings, retry: false });
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const policies = useQuery({ queryKey: ["chat-policies"], queryFn: api.policies, enabled: settings.isSuccess });
  const owner = settings.data?.role === "owner";
  const comparisons = messages.flatMap((m) => m.comparison ? [m.comparison] : []);
  const baselineTotals = tallyArm(comparisons.map((c) => c.baseline));
  const optimizedTotals = tallyArm(comparisons.map((c) => c.tokenguard));
  const paired = pairedCostDifference(comparisons);
  const last = comparisons.at(-1);
  const policyEnabled = last?.policy_enabled ?? policies.data?.items.find((p) => p.application === "bakery_demo")?.enabled;
  const live = health.data?.dependencies.anthropic.mode === "live";
  const canSend = !pending && (!compareMode || owner);

  async function send(question: string) {
    question = question.trim();
    if (!question || question.length > 1000 || busy.current || !canSend) return;
    busy.current = true;
    setPending(true);
    setError(null);
    const id = ++sequence.current;
    setMessages((previous) => [...previous, { id, question, comparing: compareMode }]);
    setInput("");
    try {
      if (!session.current || Date.parse(session.current.expires_at) <= Date.now() + 5000) session.current = await api.chatSession();
      if (compareMode) {
        const comparison = await api.chatCompare(session.current.application_id, question);
        setMessages((previous) => previous.map((m) => m.id === id ? { ...m, comparison } : m));
      } else {
        const response = await api.chat(session.current.token, session.current.application_id, question);
        setMessages((previous) => previous.map((m) => m.id === id ? { ...m, response } : m));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) session.current = null;
      setError(e);
      setInput(question);
      setMessages((previous) => previous.map((m) => m.id === id ? { ...m, failed: true } : m));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
    <Link href="/overview" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />TokenGuard dashboard</Link>
    <header className="space-y-2">
      <h1 className="text-3xl">Sweet Crumbs BakeryBot</h1>
      <p className="max-w-2xl text-muted-foreground">One question. Two paths. Compare direct AI responses with TokenGuard’s approved FAQ caching.</p>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">{health.isLoading ? "Checking provider…" : health.isError ? "Provider unavailable" : live ? "Live Anthropic · billed calls" : "Mock provider · no API charge"}</Badge><Badge variant="outline">{policyEnabled === undefined ? "Checking cache policy…" : policyEnabled ? "Approved cache enabled" : "Cache disabled"}</Badge></div>
    </header>
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Demo bakery; all business facts are fictitious. No real orders or payments. Please do not share personal details. {live && "Comparison makes one or two billed Anthropic calls per question."}</div>
    <div className="flex flex-wrap items-center gap-2" aria-label="Chat mode">
      <Button variant={compareMode ? "default" : "outline"} size="sm" disabled={pending} aria-pressed={compareMode} onClick={() => setCompareMode(true)}>Side-by-side comparison</Button>
      <Button variant={!compareMode ? "default" : "outline"} size="sm" disabled={pending} aria-pressed={!compareMode} onClick={() => setCompareMode(false)}>Single chatbot</Button>
      <Button variant="ghost" size="sm" className="sm:ml-auto" disabled={pending || !messages.length} onClick={() => { setMessages([]); setError(null); setInput(""); }}><RotateCcw className="size-4" />Reset session</Button>
    </div>
    {compareMode && <>
      {!owner && !settings.isLoading && <p className="text-sm text-muted-foreground"><Link href="/login" className="text-primary underline">Sign in as workspace owner</Link> to run comparisons. Single chatbot remains available.</p>}
      {policyEnabled === false && <p className="text-sm text-muted-foreground">Caching is off, so both paths use the provider. <Link href="/decisions" className="text-primary underline">Approve caching in Decision Lab</Link> to compare safe FAQ hits.</p>}
      <div className="grid gap-4 md:grid-cols-2"><Totals name="Without TokenGuard" arm="baseline" totals={baselineTotals} /><Totals name="With TokenGuard" arm="tokenguard" totals={optimizedTotals} /></div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm"><span>Provider cost difference</span><strong className="tabular">{formatMYR(paired.difference, true)}</strong><span className="text-xs text-muted-foreground">{paired.pairs} successful pairs · baseline minus TokenGuard · excludes local hosting/cache overhead</span></div>
      <p className="text-xs text-muted-foreground">Cumulative totals cover comparison replies in this tab only. Reset clears the display, not recorded usage. Both paths use the same model, question and approved bakery facts; each question is independent. Extra baseline calls appear as BakeryBot baseline in Usage Explorer.</p>
      {last && <p className="break-words text-xs text-muted-foreground">{last.model} · input ${last.input_usd_per_million} / output ${last.output_usd_per_million} per million tokens · fixed estimate RM{last.fx_myr_per_usd.toFixed(2)}/USD · {last.pricing_catalog_version}{last.provider_mode === "mock" ? " · mock token estimates, no paid spend" : " · actual returned API usage, estimated cost"}</p>}
    </>}
    <div className="flex flex-wrap gap-2">{prompts.map((prompt) => <Button key={prompt} variant="outline" size="sm" disabled={!canSend} onClick={() => void send(prompt)}>{prompt}</Button>)}</div>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
      <label htmlFor="message" className="sr-only">Your question</label><Input id="message" value={input} maxLength={1000} onChange={(e) => setInput(e.target.value)} placeholder="Ask the bakery…" disabled={!canSend} autoComplete="off" />
      <Button type="submit" disabled={!canSend || !input.trim()}><Send className="size-4" /><span className="sr-only sm:not-sr-only">{compareMode ? "Compare" : "Send"}</span></Button>
    </form>
    {error !== null && <><ErrorState error={error} /><p className="text-xs text-amber-800">No automatic retry. If the connection failed after sending, a provider call may have completed; check Usage Explorer before resending.</p></>}
    <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-5">
      {!messages.length && <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Choose a sample question or write your own. Session counters start at zero.</p>}
      {messages.map((m) => <article key={m.id} className="space-y-3">
        <p className="rounded-lg bg-blue-50 px-4 py-3 text-blue-950">{m.question}</p>
        {m.comparing ? <div className="grid gap-4 md:grid-cols-2"><Reply label="Without TokenGuard" arm={m.comparison?.baseline} pending={!m.comparison && !m.failed} /><Reply label="With TokenGuard" arm={m.comparison?.tokenguard} pending={!m.comparison && !m.failed} /></div> : <Reply arm={m.response ? { response: m.response, error: null } : undefined} pending={!m.response && !m.failed} />}
      </article>)}
    </div>
    <p className="text-xs text-muted-foreground">Order status and personal questions bypass the cache. TokenGuard cache hits use zero provider input/output tokens; the approved FAQ answer still contains text. Session cost differences are observations, not guaranteed net savings.</p>
  </main>;
}
