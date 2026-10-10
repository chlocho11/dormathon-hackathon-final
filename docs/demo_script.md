# Three-minute demo

Preparation: migrate/bootstrap, seed with `--evaluate --predict`, start API in mock mode and web, sign in as owner. Disable existing cache policies so approval has an observable effect. Never replace backend numbers with illustrative pitch numbers.

| Time | Surface | Action and narration |
|---|---|---|
| 0:00–0:30 | BakeryBot | Ask opening hours. Show mock/provider status, actual returned token metadata and estimated cost. All bakery facts are fictitious. |
| 0:30–1:00 | Overview | Show current budget, stored month-end forecast and interval; explain synthetic-history and gateway-origin labels. |
| 1:00–1:30 | Predictions / Anomalies | Inspect cost drivers and budget crossing date. Explain observed/expected anomaly values and that labelled synthetic mechanisms are demo ground truth. |
| 1:30–2:10 | Decision Lab | Adjust a safe caching assumption. Show the saved-forecast baseline, resulting net savings after overhead, sensitivity and quality checks. Say when the action still exceeds the budget. |
| 2:10–2:35 | Approval / BakeryBot | Approve as owner; ask opening hours again and show a safe cache hit. Ask order status and show bypass/mock provider. Disable reverses caching. |
| 2:35–3:00 | Evaluation | Show held-out scores against baselines, anomaly precision/recall/false alarms and adversarial cache tests. State limitations and that synthetic and mock results are not proven production savings. |

Closing: TokenGuard turns AI cost forecasts into measurable, quality-aware preventive actions.

Fallback: use the local seeded mock demo when provider/cloud credentials are absent. Browser screenshots can support a recorded walkthrough, but never present a recording as a live request.
