# Process-Based Governance (PBG) — AI Lifecycle Map (2026)

Maps each stage of the AI lifecycle to its owner, the controls applied, and the
evidence — the "process-based governance" backbone recommended by the Alan Turing
Institute guide. This is the lifecycle view; the layered-control view is in
[`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md)
and the principle mappings in [`ai-frameworks-crosswalk-2026.md`](ai-frameworks-crosswalk-2026.md).

**Owner:** MLRO · Compliance Engineering · **Date:** 2026-06-30 · Review: annual + on change.

| Lifecycle stage | Owner | Controls applied | Evidence |
|---|---|---|---|
| **1. Design / scoping** | Compliance Eng + MLRO | Use-case classified & risk-tiered before build; in-domain AML/CFT scope only | [`../aims/ai-system-inventory.md`](../aims/ai-system-inventory.md), [`../aims/in-domain-aml-coverage.md`](../aims/in-domain-aml-coverage.md) |
| **2. Impact assessment** | MLRO | DPIA + stakeholder impact assessment before deployment | [`dpia-2026.md`](dpia-2026.md), [`stakeholder-impact-assessment-2026.md`](stakeholder-impact-assessment-2026.md) |
| **3. Data sourcing** | Compliance Eng | Data-minimisation; public/official sources; PDPL assessment | [`../aims/pdpl-data-processing-assessment.md`](../aims/pdpl-data-processing-assessment.md), [`data-retention.md`](data-retention.md) |
| **4. Build / configure** | Compliance Eng | No model training (external LLM, read-only); deterministic engine of record; CODEOWNERS review | [`model-validation-2026.md`](model-validation-2026.md), `.github/CODEOWNERS` |
| **5. Test / validate** | Compliance Eng | Golden scoring tests, bias eval, prompt-injection red-team, advisor assurance | `test/scoring-golden.test.js`, `test/bias_eval.py`, `test/redteam_injection.py`, `test/advisor-assurance.test.js` |
| **6. Pre-deploy review** | MLRO / senior mgmt | Sign-off; release gated by required reviewer (protected `release` env) | [`../aims/management-review.md`](../aims/management-review.md), [`github-repository-hardening.md`](github-repository-hardening.md) |
| **7. Deploy** | Compliance Eng | Pure-`'self'` CSP + Trusted Types; signed releases (SBOM + provenance) | `netlify.toml`, `.github/workflows/release.yml`, [`../architecture.md`](../architecture.md) |
| **8. Operate / monitor** | MLRO | Runtime guards, kill switch, weekly live eval, daily screening, degrade-loudly alerting | `brain-soul.js`, `scripts/advisor-eval.mjs`, [`runtime-monitoring`](../aims/runtime-monitoring.md) |
| **9. Audit / record-keeping** | MLRO | Tamper-evident hash-chained log; retention snapshots; 10-yr AML retention | `scripts/retain-state.mjs`, `index.html` audit chain |
| **10. Incident / improve** | MLRO | Incident runbook + post-incident template; corrective-actions log; quarterly review | [`ai-incident-runbook.md`](ai-incident-runbook.md), [`incident-postmortem-template.md`](incident-postmortem-template.md), [`../aims/corrective-actions.md`](../aims/corrective-actions.md) |
| **11. Retire / change** | MLRO | Any new AI surface must be added to the inventory before deploy; change control via PR | [`ai-asset-register.md`](ai-asset-register.md) |
