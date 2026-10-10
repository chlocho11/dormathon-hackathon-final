import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, requestDay, filterUsage, usageTotals } from "../lib/usage-data.ts";

test("CSV quotes fields and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell("a,b\nnext"), '"a,b\nnext"');
  assert.equal(csvCell("  +SUM(A1)"), '"\'  +SUM(A1)"');
});
test("request calendar date uses Kuala Lumpur at UTC day boundary", () => {
  assert.equal(requestDay("2026-10-09T18:00:00Z"), "2026-10-10");
});
test("combined filters preserve provenance and total only selected rows", () => {
  const rows = [
    { day: "2026-10-10", application: "bakery_demo", model: "haiku", request_category: "static_faq", data_origin: "synthetic", cost_myr: 2, requests: 10, input_tokens: 100, output_tokens: 20, cache_hits: 3 },
    { day: "2026-10-10", application: "bakery_demo", model: "haiku", request_category: "static_faq", data_origin: "real", cost_myr: 1, requests: 5, input_tokens: 50, output_tokens: 10, cache_hits: 1 },
  ];
  const selected = filterUsage(rows, { from: "2026-10-10", to: "2026-10-10", app: "bakery_demo", origin: "real", model: "haiku", category: "static_faq" });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].data_origin, "real");
  assert.deepEqual(usageTotals(selected), { cost: 1, requests: 5, tokens: 60, hits: 1 });
  assert.equal(filterUsage(rows, { from: "2026-10-11", to: "2026-10-10" }).length, 0);
});
