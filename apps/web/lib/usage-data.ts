import type { UsageDailyRow } from "./types";

export function csvCell(value: unknown): string {
  // Quote delimiters and line breaks; prevent formula execution on spreadsheet import.
  return '"' + String(value).replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""') + '"';
}

export function requestDay(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return [get("year"), get("month"), get("day")].join("-");
}

type Filters = { from?: string; to?: string; app?: string; model?: string; category?: string; origin?: string };
export function filterUsage<T extends Pick<UsageDailyRow, "day" | "application" | "model" | "request_category" | "data_origin">>(rows: T[], f: Filters): T[] {
  if (f.from && f.to && f.from > f.to) return [];
  return rows.filter((r) =>
    (!f.from || r.day >= f.from) && (!f.to || r.day <= f.to) &&
    (!f.app || r.application === f.app) && (!f.model || r.model === f.model) &&
    (!f.category || r.request_category === f.category) && (!f.origin || r.data_origin === f.origin));
}

export function usageTotals(rows: Pick<UsageDailyRow, "cost_myr" | "requests" | "input_tokens" | "output_tokens" | "cache_hits">[]) {
  return rows.reduce((t, r) => ({
    cost: t.cost + r.cost_myr, requests: t.requests + r.requests,
    tokens: t.tokens + r.input_tokens + r.output_tokens, hits: t.hits + r.cache_hits,
  }), { cost: 0, requests: 0, tokens: 0, hits: 0 });
}
