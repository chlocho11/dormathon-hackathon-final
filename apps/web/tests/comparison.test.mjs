import test from "node:test";
import assert from "node:assert/strict";
import { tallyArm, pairedCostDifference } from "../lib/chat-comparison.ts";

const response = (input, output, cost, mode = "live") => ({
  usage: { input_tokens: input, output_tokens: output }, estimated_cost_myr: cost,
  provider_mode: mode, cache_status: mode === "none" ? "exact_hit" : "miss",
});
test("cumulative counters include returned usage and distinguish cache hits from failures", () => {
  const totals = tallyArm([
    { response: response(100, 20, .002) }, { response: response(0, 0, 0, "none") },
    { response: null, error: { code: "provider_unavailable", message: "Unavailable" } },
    { response: response(50, 10, .001) },
  ]);
  assert.equal(totals.input_tokens, 150);
  assert.equal(totals.output_tokens, 30);
  assert.equal(totals.estimated_cost_myr, .003);
  assert.equal(totals.provider_calls, 2);
  assert.equal(totals.cache_hits, 1);
  assert.equal(totals.errors, 1);
});
test("cost difference compares successful pairs only, including negative differences", () => {
  const data = pairedCostDifference([
    { baseline: { response: response(100, 20, .002) }, tokenguard: { response: response(0, 0, 0, "none") } },
    { baseline: { response: null }, tokenguard: { response: response(100, 20, .01) } },
    { baseline: { response: response(100, 20, .001) }, tokenguard: { response: response(100, 20, .004) } },
  ]);
  assert.equal(data.pairs, 2);
  assert.ok(Math.abs(data.difference - (-.001)) < 1e-10);
});
