import test from "node:test";
import assert from "node:assert/strict";
import { demoQuestions, createDemoTurn, demoTotals } from "../lib/scripted-chat.ts";

test("first question, exact repeat and paraphrase demonstrate generation, exact cache and semantic cache", () => {
  const example = demoQuestions[0];
  const first = createDemoTurn(example.question, []);
  const second = createDemoTurn(example.question, [first]);
  const third = createDemoTurn(example.paraphrases[0], [first, second]);
  assert.equal(first.tokenguard.mode, "generated");
  assert.notEqual(first.baseline.answer, first.tokenguard.answer);
  assert.equal(first.baseline.input, first.tokenguard.input);
  assert.equal(first.baseline.output, first.tokenguard.output);
  assert.equal(first.baseline.cost, first.tokenguard.cost);
  assert.equal(second.tokenguard.mode, "exact_hit");
  assert.equal(third.tokenguard.mode, "semantic_hit");
  assert.notEqual(second.baseline.answer, first.baseline.answer);
  assert.notEqual(third.baseline.answer, second.baseline.answer);
  for (const turn of [second, third]) {
    assert.equal(turn.tokenguard.input, 0);
    assert.equal(turn.tokenguard.output, 0);
    assert.equal(turn.tokenguard.cost, 0);
    assert.equal(turn.tokenguard.answer, first.tokenguard.answer);
    assert.ok(turn.baseline.input > 0);
    assert.ok(turn.baseline.output > 0);
  }
  assert.equal(demoTotals([first, second, third], "baseline").input, first.baseline.input + second.baseline.input + third.baseline.input);
  assert.equal(demoTotals([first, second, third], "tokenguard").input, example.input);
});

test("repeated generation varies usage by about 5–10 percent and recalculates cost", () => {
  const first = createDemoTurn(demoQuestions[0].question, []);
  const repeat = createDemoTurn(demoQuestions[0].question, [first], () => 0.5);
  assert.notEqual(repeat.baseline.input, first.baseline.input);
  for (const key of ["input", "output"]) {
    const change = Math.abs(repeat.baseline[key] / first.baseline[key] - 1);
    assert.ok(change >= 0.04 && change <= 0.11);
  }
  assert.ok(Math.abs(repeat.baseline.cost - (repeat.baseline.input + repeat.baseline.output * 5) / 1e6 * 4.7) < 1e-12);
  assert.ok(repeat.lookup_ms >= 0);
});

test("each topic starts cold; paraphrases can seed the cache and repeats become exact hits", () => {
  for (const example of demoQuestions) {
    const first = createDemoTurn(example.paraphrases[0], []);
    assert.equal(first.tokenguard.mode, "generated");
    const canonical = createDemoTurn(example.question, [first]);
    assert.equal(canonical.tokenguard.mode, "semantic_hit");
    const repeated = createDemoTurn(example.question, [first, canonical]);
    assert.equal(repeated.tokenguard.mode, "exact_hit");
    assert.equal(first.tokenguard.answer, example.answer);
    assert.notEqual(first.baseline.answer, first.tokenguard.answer);
  }
  assert.equal(createDemoTurn("An unsupported question", []), null);
  assert.equal(createDemoTurn("", []), null);
  assert.equal(demoTotals([], "baseline").cost, 0);
});
