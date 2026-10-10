"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp, Bot, Check, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDemoTurn, demoTotals, type DemoTurn } from "@/lib/scripted-chat";

type VisibleTurn = DemoTurn & { baselinePending?: boolean; tokenguardPending?: boolean };
const money = (cost: number) => `RM${cost.toFixed(6)}`;

function Conversation({ arm, turns }: { arm: "baseline" | "tokenguard"; turns: VisibleTurn[] }) {
  const guarded = arm === "tokenguard";
  const totals = demoTotals(turns.filter((turn) => !turn[arm === "baseline" ? "baselinePending" : "tokenguardPending"]), arm);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [turns]);
  return <section aria-label={guarded ? "With TokenGuard conversation" : "Without TokenGuard conversation"} className="flex min-w-0 flex-col rounded-2xl border bg-background">
    <header className="flex items-center gap-3 border-b px-4 py-4 md:px-6"><div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${guarded ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{guarded ? <ShieldCheck className="size-5" /> : <Bot className="size-5" />}</div><div><h2 className="text-base font-semibold">{guarded ? "With TokenGuard" : "Without TokenGuard"}</h2><p className="text-xs text-muted-foreground">{guarded ? "Reuse answers with exact and semantic caching" : "Generate an answer for every message"}</p></div></header>
    <dl className="grid grid-cols-3 gap-2 border-b bg-muted/30 px-4 py-3 md:px-6"><div><dt className="text-xs text-muted-foreground">Input tokens</dt><dd data-testid={`${arm}-input-total`} className="mt-1 font-semibold tabular-nums">{totals.input.toLocaleString()}</dd></div><div><dt className="text-xs text-muted-foreground">Output tokens</dt><dd data-testid={`${arm}-output-total`} className="mt-1 font-semibold tabular-nums">{totals.output.toLocaleString()}</dd></div><div><dt className="text-xs text-muted-foreground">Estimated cost</dt><dd data-testid={`${arm}-cost-total`} className="mt-1 break-all text-sm font-semibold tabular-nums">{money(totals.cost)}</dd></div></dl>
    <div role="log" aria-label={guarded ? "TokenGuard messages" : "Baseline messages"} className="h-[380px] space-y-7 overflow-y-auto overscroll-contain px-4 py-6 md:h-[430px] md:px-6">
      {!turns.length && <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><Bot className="size-7 text-muted-foreground" /><h3 className="text-lg font-medium">Ask Sweet Crumbs Bakery</h3><p className="max-w-64 text-sm text-muted-foreground">{guarded ? "The first answer fills the cache. Ask again to see the difference." : "Ask a question to start the conversation."}</p></div>}
      {turns.map((turn, index) => {
        const waiting = turn[arm === "baseline" ? "baselinePending" : "tokenguardPending"];
        const reply = turn[arm]; const cached = reply.mode !== "generated";
        return <article key={index} className="space-y-5"><div className="ml-auto max-w-[88%] rounded-3xl rounded-br-md bg-slate-700 text-white px-4 py-3 dark:bg-slate-600"><p className="sr-only">You</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{turn.question}</p></div><div className="flex items-start gap-3"><span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${guarded ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted"}`}><Bot className="size-4" /></span><div className="min-w-0 space-y-2"><p className="text-xs font-semibold">Sweet Crumbs AI</p><p className="text-sm leading-7">{waiting ? <span role="status" className="text-muted-foreground motion-safe:animate-pulse">Generating...</span> : reply.answer}</p>{!waiting && <><div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${cached ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{cached && <Check className="size-3" />}{reply.mode === "exact_hit" ? "Exact cache hit" : reply.mode === "semantic_hit" ? "Semantic cache hit" : "Generated answer"}</div><p className="text-xs text-muted-foreground tabular-nums">{reply.input} input / {reply.output} output tokens · {money(reply.cost)}{cached && ` / ${turn.lookup_ms < 0.01 ? "<0.01" : turn.lookup_ms.toFixed(2)} ms local lookup`}</p></>}</div></div></article>;
      })}<div ref={end} />
    </div><footer className="border-t px-4 py-2 text-xs text-muted-foreground md:px-6">{turns.length} replies{guarded && ` · ${totals.hits} cache hits`} · cumulative session totals</footer>
  </section>;
}

export function ChatClient() {
  const [turns, setTurns] = useState<VisibleTurn[]>([]);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const baseline = demoTotals(turns.filter((turn) => !turn.baselinePending), "baseline"); const guarded = demoTotals(turns.filter((turn) => !turn.tokenguardPending), "tokenguard");
  function send(question: string) {
    if (busy.current) return;
    const turn = createDemoTurn(question, turns);
    if (!turn) { setError("Please ask about opening hours, our cake menu, pickup, delivery, or chocolate cake prices."); return; }
    busy.current = true; setPending(true);
    setTurns((previous) => [...previous, { ...turn, baselinePending: true, tokenguardPending: turn.tokenguard.mode === "generated" }]);
    setInput(""); setError(null);
    timer.current = setTimeout(() => {
      setTurns((previous) => previous.map((item, index) => index === previous.length - 1 ? { ...item, baselinePending: false, tokenguardPending: false } : item));
      busy.current = false; setPending(false); timer.current = null;
    }, 2800 + Math.random() * 400);
  }
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 md:px-8">
    <div className="flex flex-wrap items-center justify-between gap-2"><Link href="/overview" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />TokenGuard dashboard</Link><Button variant="ghost" size="sm" disabled={pending} onClick={() => { setTurns([]); setInput(""); setError(null); }}><RotateCcw className="size-4" />Reset demo</Button></div>
    <header className="space-y-2"><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">One conversation. See the cache make a difference.</h1><p className="text-sm text-muted-foreground">Sweet Crumbs BakeryBot · Compare a fresh answer with a cached response.</p></header>
    <div className="grid gap-4 md:grid-cols-2"><Conversation arm="baseline" turns={turns} /><Conversation arm="tokenguard" turns={turns} /></div>
    <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>Estimated cost saved <strong data-testid="cost-saved" className="ml-2 tabular-nums text-emerald-700 dark:text-emerald-300">{money(baseline.cost - guarded.cost)}</strong></p><p className="text-xs text-muted-foreground">Reset clears messages, counters and the demo cache.</p></div>
    <form className="rounded-2xl border bg-muted/30 p-3" onSubmit={(event) => { event.preventDefault(); send(input); }}><label htmlFor="message" className="sr-only">Your question</label><div className="flex items-end gap-3"><textarea id="message" rows={2} maxLength={1000} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (input.trim()) send(input); } }} placeholder="Message both assistants…" className="min-w-0 flex-1 resize-none rounded-lg bg-transparent px-2 py-1 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring" /><Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send message" className="shrink-0 rounded-xl"><ArrowUp className="size-5" /></Button></div><p className="px-2 pt-2 text-xs text-muted-foreground">Enter to send · Shift + Enter for a new line · the same message goes to both sides</p></form>
    {error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Demo estimates</summary><p className="mt-2 leading-5">Usage and generation delays are simulated; cache timing measures only the local predefined-variant lookup. No provider calls or charges. Estimates use $1 input / $5 output per million tokens and RM4.70/USD. All bakery facts are fictional; messages do not enter dashboard usage.</p></details>
  </main>;
}
