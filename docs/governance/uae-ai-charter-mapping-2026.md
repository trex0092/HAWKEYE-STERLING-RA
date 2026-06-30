# UAE AI Charter — Principle-by-Principle Mapping (2026)

Maps the **UAE Charter for the Development and Use of Artificial Intelligence**
(issued June 2024 — a voluntary, non-binding national ethical framework) to the
concrete controls in this system. Complements the binding/standards mappings:
[`nist-ai-rmf-mapping-2026.md`](nist-ai-rmf-mapping-2026.md) (NIST AI RMF) and
[`iso-42001-soa-2026.md`](iso-42001-soa-2026.md) (ISO/IEC 42001 SoA).

**Owner:** MLRO · Compliance Engineering · **Date:** 2026-06-30 ·
Status: ✅ implemented · 🟡 partial · 🔴 open.

> **Scope.** The Charter is mapped against the **AI surfaces only** — the LLM
> Advisor and the optional LLM adverse-media triage (see
> [`ai-asset-register.md`](ai-asset-register.md) /
> [`../aims/ai-system-inventory.md`](../aims/ai-system-inventory.md)). The
> deterministic Entity Risk Assessment engine is governed under AML/CFT controls,
> not as a model. Principle titles follow the Charter's published English wording;
> the framework is advisory, so this is a self-assessment of alignment.

## The 12 principles

| # | Charter principle | Status | How this system aligns (evidence) |
|---|---|---|---|
| 1 | **Strengthening the human–machine relationship** (AI serves human wellbeing) | ✅ | AI is strictly **decision-support** — every output is labelled `[AI]`, carries "decision support, not a decision — MLRO review required", and the deterministic path is the system of record ([`AI-GOVERNANCE.md`](../AI-GOVERNANCE.md)). No AI files, decides, or acts autonomously. |
| 2 | **Safety** (safe, secure, robust AI) | ✅ | Server-held keys, pure-`'self'` CSP + Trusted Types, CORS, CodeQL/Gitleaks/GitGuardian, harden-runner egress policies; tipping-off / PII / injection / hallucination / anomaly runtime guards in `brain-soul.js`; deterministic fallback on any model error. |
| 3 | **Algorithmic bias** (mitigate unfair bias) | ✅/🟡 | Bias method + cadence defined ([`advisor-bias-review-2026.md`](advisor-bias-review-2026.md), [`../aims/bias-fairness-testing.md`](../aims/bias-fairness-testing.md)); automated `advisor-bias-eval.yml`; non-Latin names routed to **MANUAL REVIEW** (never silent-cleared). Live history accrues over cycles (🟡). |
| 4 | **Data privacy** | ✅ | Data-minimised egress — the LLM receives only a subject name + a single headline, never the customer record ([`../aims/ai-system-inventory.md`](../aims/ai-system-inventory.md)); on-device encryption (AES-256-GCM); PDPL assessment ([`dpia-2026.md`](dpia-2026.md), [`../aims/pdpl-data-processing-assessment.md`](../aims/pdpl-data-processing-assessment.md)); key-off ⇒ zero AI egress. |
| 5 | **Transparency** | ✅ | On-screen AI-use notice in `advisor.html`; `[AI]`/`[Auto]` labelling; cited Q&A; contributing-factors shown behind every deterministic output. |
| 6 | **Human oversight** | ✅ | Human-in-the-loop / human-on-the-loop on every AI surface (Layer 5 of [`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md)); MLRO sign-off before acting on any flagged sanctions/PEP/adverse-media hit; in-app AUP acknowledgment gate. |
| 7 | **Governance and accountability** | ✅ | Named accountable owner (MLRO) in the asset register and [`CODEOWNERS`](../../.github/CODEOWNERS); management review ([`../aims/management-review.md`](../aims/management-review.md)); tamper-evident hash-chained audit log; incident runbook + kill switch. |
| 8 | **Technological excellence** (accuracy, reliability) | ✅ | Golden scoring tests + model-validation pack ([`model-validation-2026.md`](model-validation-2026.md)); advisor-assurance + register-schema tests in CI; weekly key-gated live eval (`advisor-eval.yml`); grounded/retrieval-only classification. |
| 9 | **Human commitment / responsibility** (humans remain responsible) | ✅ | No automated output with legal or serious effect is actioned without human review; the analyst/MLRO is the decision-maker of record; AUP defines acceptable use and individual responsibility ([`ai-acceptable-use-policy.md`](ai-acceptable-use-policy.md)). |
| 10 | **Peaceful coexistence with AI** (no harmful/abusive use) | ✅ | AUP prohibits misuse; refusal protocol + tipping-off guard (red-teamed, [`../../test/redteam_injection.py`](../../test/redteam_injection.py)); narrow, in-domain AML/CFT scope only ([`../aims/in-domain-aml-coverage.md`](../aims/in-domain-aml-coverage.md)). |
| 11 | **Promoting an inclusive future** (accessible, inclusive) | ✅/🟡 | WCAG 2AA a11y checks (`a11y.yml`) across all three screens; bilingual EN/AR with legal review ([`../i18n-ar-legal-review.md`](../i18n-ar-legal-review.md)); zero-cost, no-login, runs on a static host. |
| 12 | **Compliance with applicable laws and treaties** | ✅ | FDL 10/2025 (AML/CFT) + PDPL lawful-basis documented ([`dpia-2026.md`](dpia-2026.md), [`../aims/pdpl-data-processing-assessment.md`](../aims/pdpl-data-processing-assessment.md)); EU AI Act limited-risk classification; FATF R.10 alignment; sanctions sourced from official designation lists. |

## Summary

All 12 Charter principles are addressed. Two carry a 🟡 maturity note (not a gap in
control design, but in accrued evidence): **Principle 3** (bias) accumulates live
review history over successive cycles, and **Principle 11** (inclusion) continues to
broaden accessibility and language coverage. These track on
[`corrective-actions.md`](../aims/corrective-actions.md) and are reviewed at the
quarterly management review.

## Change control

This mapping is reviewed quarterly (with the MLRO sign-off cycle) and on any change
to an AI model, provider, prompt charter, or data flow. Edits are owned by
@trex0092 (see [`CODEOWNERS`](../../.github/CODEOWNERS)) and land via reviewed PR.

## Source

The 12 principles are the UAE Charter for the Development and Use of Artificial
Intelligence (TDRA / UAE Government, June 2024), a voluntary ethical framework.
Official text: <https://uaelegislation.gov.ae/en/policy/details/the-uae-charter-for-the-development-and-use-of-artificial-intelligence>.
