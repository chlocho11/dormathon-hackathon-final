// Real local API + browser smoke; mock Anthropic only. No cloud credentials.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH || "playwright";
const { chromium } = await import(modulePath);
const web = process.env.E2E_WEB_URL || "http://localhost:3000";
const base = process.env.E2E_API_URL || "http://localhost:8000";
const output = process.env.E2E_OUTPUT || "test-results/screenshots";
await mkdir(output, { recursive: true });

async function api(path, { token, method = "GET", body } = {}) {
  const response = await fetch(base + "/api/v1" + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.ok, true, path + " HTTP " + response.status);
  return response.json();
}
const health = await api("/health");
assert.equal(health.demo_mode, true, "Run against a disposable local demo");
assert.equal(health.dependencies.anthropic.mode, "mock", "Browser tests must never use paid Anthropic");
const { access_token: token } = await api("/auth/dev-login", { method: "POST", body: { role: "owner" } });
const forecast = await api("/forecasts/latest", { token });
assert.equal(forecast.status, "ok", "Seed, evaluate and predict before this smoke test");
const policies = await api("/policies", { token });
for (const policy of policies.items.filter((p) => p.enabled)) await api("/policies/" + policy.id + "/disable", { token, method: "POST" });

const browser = await chromium.launch({ headless: true, ...(process.env.E2E_BROWSER_PATH ? { executablePath: process.env.E2E_BROWSER_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function visible(locator) { await locator.waitFor({ state: "visible", timeout: 30000 }); }
async function screenshot(name) { await page.screenshot({ path: output + "/" + name + ".png", fullPage: true }); }
try {
  await page.goto(web + "/login");
  await page.getByRole("button", { name: "Continue as demo owner", exact: true }).click();
  await page.waitForURL("**/overview");
  await visible(page.getByRole("heading", { name: "Predict early. Spend smarter.", exact: true }));
  await visible(page.getByText("Month-end forecast", { exact: true }));
  const bodyText = await page.locator("main").innerText();
  assert.ok(bodyText.includes(forecast.forecast_total_myr.toFixed(2)), "UI forecast equals backend value");
  await screenshot("overview-desktop");

  await page.goto(web + "/predictions");
  await visible(page.getByRole("heading", { name: "Predictions", exact: true }));
  await page.goto(web + "/anomalies");
  await visible(page.getByRole("heading", { name: "Anomalies", exact: true }));
  await page.goto(web + "/usage");
  await visible(page.getByRole("button", { name: "Export aggregates CSV", exact: true }));
  await page.getByLabel("Origin", { exact: true }).selectOption("synthetic");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export aggregates CSV", exact: true }).click();
  assert.equal((await downloadPromise).suggestedFilename(), "tokenguard-usage.csv");
  await screenshot("usage-desktop");

  await page.goto(web + "/settings");
  await visible(page.getByRole("heading", { name: "Settings", exact: true }));
  const settings = await api("/settings/workspace", { token });
  await page.getByLabel("Monthly budget (MYR)", { exact: true }).fill(String(settings.monthly_budget_myr));
  await page.getByRole("button", { name: "Save budget", exact: true }).click();
  await visible(page.getByText("Budget saved. Run a new forecast to use it.", { exact: true }));
  await screenshot("settings-desktop");

  await page.goto(web + "/decisions");
  await visible(page.getByRole("heading", { name: "Decision Lab", exact: true }));
  const slider = page.getByRole("slider").first();
  await visible(slider);
  const oldAssumption = Number(await slider.getAttribute("aria-valuenow"));
  const scenarioResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/scenarios/compare") &&
    response.request().method() === "POST" &&
    response.request().postDataJSON()?.assumptions?.eligible_share !== undefined);
  await slider.focus();
  await slider.press(oldAssumption > 0 ? "ArrowLeft" : "ArrowRight");
  const adjusted = await (await scenarioResponse).json();
  const scenario = adjusted.scenarios.find((s) => s.scenario_type === "semantic_cache");
  assert.notEqual(scenario.assumptions.eligible_share, oldAssumption, "Slider updates the API scenario");
  assert.equal(scenario.baseline_forecast.total_myr, forecast.forecast_total_myr, "Scenario uses the saved forecast");
  // Generate a fresh recommendation through the backend, then verify UI approval.
  const recommendation = await api("/recommendations/generate", { token, method: "POST" });
  assert.equal(recommendation.action_type, "enable_semantic_cache", "The seeded demo should offer safe caching");
  await page.reload();
  await page.getByRole("button", { name: "Approve & enable", exact: true }).first().click();
  await visible(page.getByRole("dialog"));
  await page.getByRole("dialog").getByRole("button", { name: "Approve & enable", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok((await api("/policies", { token })).items.some((p) => p.enabled));
  await screenshot("decisions-desktop");

  await page.goto(web + "/demo/chat");
  await page.getByRole("button", { name: "What time do you open?", exact: true }).click();
  await visible(page.getByText("Safe cache hit", { exact: true }));
  const inputCount = async (arm) => Number((await page.getByTestId(arm + "-input-total").innerText()).replaceAll(",", ""));
  const firstBaseline = await inputCount("baseline");
  assert.ok(firstBaseline > 0, "Comparison baseline uses provider input tokens");
  assert.equal(await inputCount("tokenguard"), 0, "Approved FAQ avoids provider tokens on optimized side");
  await page.getByRole("button", { name: "Is my order ready?", exact: true }).click();
  await visible(page.getByText("Bypass · provider call", { exact: true }).last());
  await page.getByRole("button", { name: "Compare", exact: true }).waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="tokenguard-input-total"]');
    return Number(node?.textContent?.replaceAll(",", "")) > 0;
  });
  assert.ok(await inputCount("baseline") > firstBaseline, "Baseline counters accumulate across questions");
  assert.ok(await inputCount("tokenguard") > 0, "Unsafe question reaches provider on optimized side");
  await screenshot("chat-desktop");
  await page.setViewportSize({ width: 360, height: 800 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Comparison fits mobile");
  await screenshot("chat-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Reset session", exact: true }).click();
  assert.equal(await inputCount("baseline"), 0);
  assert.equal(await inputCount("tokenguard"), 0);

  await page.goto(web + "/evaluation");
  await visible(page.getByRole("heading", { name: "Evaluation", exact: true }));
  await visible(page.getByText("Forecast against baselines", { exact: true }));
  await screenshot("evaluation-desktop");

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(web + "/overview");
  await visible(page.getByRole("button", { name: "Open navigation", exact: true }));
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await visible(page.getByRole("dialog"));
  await page.getByRole("dialog").getByRole("link", { name: "Settings", exact: true }).click();
  await page.waitForURL("**/settings");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert.ok(width.content <= width.viewport + 1, "No mobile horizontal page overflow");
  await screenshot("settings-mobile");

  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto(web + "/login");
  await page.getByRole("button", { name: "Continue as viewer (read-only)", exact: true }).click();
  await page.waitForURL("**/overview");
  await page.goto(web + "/settings");
  await visible(page.getByText("Viewer access. Only the workspace owner can change these settings.", { exact: true }));
  assert.equal(await page.getByRole("button", { name: "Save budget", exact: true }).isDisabled(), true);

  await page.route("**/api/v1/usage/daily**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "test_unavailable", message: "Deliberate browser error-state test", request_id: "e2e" } }) }));
  await page.goto(web + "/usage");
  await visible(page.getByText("Deliberate browser error-state test", { exact: true }));
  assert.deepEqual(errors, [], "No uncaught browser exceptions");
  console.log("PASS: login, API values, CSV, settings, approval, comparison/cumulative counters/reset, cache hit/bypass, evaluation, mobile, viewer and error state");
} finally {
  await browser.close();
  // Leave cache disabled, including on test failure.
  const current = await api("/policies", { token });
  for (const policy of current.items.filter((p) => p.enabled)) await api("/policies/" + policy.id + "/disable", { token, method: "POST" });
}
