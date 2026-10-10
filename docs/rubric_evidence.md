# Rubric evidence

| Criterion | Evidence |
|---|---|
| Problem clarity | README and Overview describe SME AI budget risk and owner-approved intervention. |
| Predictive rigor | Seed-42 generator, temporal backtests, baseline comparison, anomaly ground truth, docs/model_card.md and generated docs/evaluation_report.md. All historic reported metrics are synthetic. |
| Decision support | Persisted forecast → driver attribution → simulator → deterministic recommendation → optimistic owner approval → measurement; Phase 3 integration tests and demo_replay.py. |
| Explainability | Provenance badges, assumptions, forecast interval, sensitivity, quality gate, anomaly explanations and limitations, Evaluation UI. |
| Execution | Dashboard and BakeryBot sources, gateway tests, browser smoke runner and CI configuration. Current run evidence and setup blockers are in IMPLEMENTATION_STATUS.md. |

The local mock fallback passes backend tests (150), frontend data tests (3), lint/typecheck/build and Chromium desktop/mobile browser smoke. See IMPLEMENTATION_STATUS.md for commands and screenshots. Cloud deployment requires actual URLs and hosted smoke evidence; no deployed URL is asserted. The three-minute script is prepared; a timed human presentation/recording and GitHub-hosted CI run remain unverified.
