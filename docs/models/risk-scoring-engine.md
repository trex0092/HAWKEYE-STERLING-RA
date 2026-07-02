# Model Card — Entity Risk Scoring Engine

*Version: app `3.7.0` · Card date: 2 Jul 2026 · Type: **deterministic rules engine** (no ML, no LLM)*

| Field | Detail |
|---|---|
| **Purpose** | Produce a 0–30 AML/CFT risk score and the required-diligence band (CDD / SDD / EDD / PROHIBITED) for a customer (entity) under the FATF risk-based approach, so the analyst has a consistent, explainable starting position. |
| **Business owner** | MLRO (accountable for methodology and every disposition). |
| **Technical owner** | Compliance Engineering (system maintainer). |
| **Inputs** | Structured questionnaire: jurisdiction, business activity, onboarding channel, operational history, relationship duration, ownership/control/compliance answers, supply-chain material sources (recycled/mined), plus the firm-approved Risk Data baseline and any dated analyst overrides. |
| **Outputs** | Numeric score (0–30); numeric band (`≤19 CDD` / `20–22 SDD` / `≥23 EDD`); operative outcome (hard rules can force **PROHIBITED**; escalations force **EDD**); per-factor breakdown; analyst override (one-way — may raise diligence, never weakens PROHIBITED). |
| **Knowledge / training source** | None trained — a transparent rule set with firm-approved weights (the "frozen values" in `model-validation-2026.md`). Country/activity baselines are versioned and FATF-aligned. |
| **Prompt strategy** | N/A (no model). |
| **Limitations** | Only as good as the questionnaire inputs and the maintained baseline; does not itself verify identity or screen names (that is the matcher's job); a score near the 22/23 boundary is sensitive to a single factor (flagged in the report). |
| **Known risks** | Incorrect baseline → mis-band (mitigated: override + audit + monthly backup); input error (mitigated: required fields, print-back for review). See risk register R-01/R-02. |
| **Bias assessment** | Rule-based and identical for all entities; no protected-attribute inputs. Fairness risk lives in the *matcher*, not here. |
| **Human oversight** | Analyst reviews every factor; reviewer (MLRO) approves completion; override requires a reason and is audit-logged. Completion gated on assessor + sign-off identity. |
| **Monitoring** | Golden-set regression (`test/scoring-golden.test.js`) + full behaviour suite (`test/app.test.js`, 280+ checks) run every push/PR; any change to a frozen value fails CI until re-approved. |
| **Performance metrics** | Reproduces the approved baseline exactly (golden set); hard-outcome rules (PROHIBITED/EDD triggers) cannot regress (CI-enforced). |
| **Retirement criteria** | Retire/replace when the firm adopts a materially different scoring methodology, or on a supervisory model-validation finding; changes flow through `model-validation-2026.md` §5 sign-off. |
