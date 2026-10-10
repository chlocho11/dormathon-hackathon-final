import type { ComparisonArm } from "./types";

export function tallyArm(arms: Array<Partial<ComparisonArm>>) {
  return arms.reduce((total, arm) => {
    if (arm.error) total.errors++;
    const response = arm.response;
    if (!response) return total;
    total.input_tokens += response.usage.input_tokens;
    total.output_tokens += response.usage.output_tokens;
    total.estimated_cost_myr += response.estimated_cost_myr;
    total.completed++;
    if (response.provider_mode === "none") total.cache_hits++;
    else total.provider_calls++;
    return total;
  }, { input_tokens: 0, output_tokens: 0, estimated_cost_myr: 0, completed: 0, errors: 0, provider_calls: 0, cache_hits: 0 });
}

export function pairedCostDifference(rows: Array<{ baseline: Partial<ComparisonArm>; tokenguard: Partial<ComparisonArm> }>) {
  return rows.reduce((total, row) => {
    if (!row.baseline.response || !row.tokenguard.response) return total;
    total.pairs++;
    total.difference += row.baseline.response.estimated_cost_myr - row.tokenguard.response.estimated_cost_myr;
    return total;
  }, { pairs: 0, difference: 0 });
}
