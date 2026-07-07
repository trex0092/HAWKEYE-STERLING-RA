# External AI-Ethics Frameworks — Crosswalk (2026)

Maps two widely-cited public AI-ethics/governance frameworks to the controls
already implemented in this system, so their principles are demonstrably covered
(not just asserted). Complements the regulatory/standards crosswalks:
[`nist-ai-rmf-mapping-2026.md`](nist-ai-rmf-mapping-2026.md),
[`iso-42001-soa-2026.md`](iso-42001-soa-2026.md), and
[`uae-ai-charter-mapping-2026.md`](uae-ai-charter-mapping-2026.md).

**Owner:** MLRO · Compliance Engineering · **Date:** 2026-06-30 ·
Status: ✅ implemented · 🟡 partial (evidence accrues over time).

> **Scope.** Mapped against the **AI surfaces** — the LLM Advisor (`brain-soul.js`)
> and the optional LLM adverse-media triage. The deterministic Entity Risk
> Assessment engine is governed under AML/CFT controls, not as a model. These are
> voluntary best-practice frameworks; this is a self-assessment of alignment.

## A. Alan Turing Institute — *Understanding AI Ethics and Safety* (Leslie)

### SUM Values (the ethical platform)
| Value | How this system aligns |
|---|---|
| **Respect** | Decision-support only; the human analyst/MLRO always decides. AUP acknowledgment gate; no autonomous action on a person. |
| **Connect** | Bilingual EN/AR with legal review; WCAG 2AA accessibility; cited, explainable outputs so users can engage critically. |
| **Care** | Non-Latin / unscreenable subjects routed to MANUAL REVIEW (never silent-cleared); degrade-loudly on any data-source failure. |
| **Protect** | Data-minimised LLM egress (name + one headline, never the record); AES-256-GCM at rest; tipping-off / PII / injection guards; kill switch. |

### FAST Track Principles
| Principle | Evidence |
|---|---|
| **Fairness** | Cross-script recall-parity bias eval ([`../aims/bias-fairness-testing.md`](../aims/bias-fairness-testing.md), `scripts/advisor-bias-eval.mjs`, `test/bias_eval.py`); deterministic engine has no learned bias. |
| **Accountability** | Named MLRO owner; tamper-evident hash-chained audit log; one-way analyst-override ratchet; CODEOWNERS-gated change control. |
| **Sustainability** (safety, robustness, reliability over time) | Golden scoring tests + model-validation pack ([`model-validation-2026.md`](model-validation-2026.md)); weekly live advisor eval; deterministic fallback on model failure; runtime guards. |
| **Transparency** | `[AI]`/`[Auto]` labelling; on-screen AI-use notice; contributing-factors shown behind every deterministic output; see [`explainability-statement-2026.md`](explainability-statement-2026.md). |

### Process-Based Governance (PBG)
Implemented as the **6-layer governance** model — see
[`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md) —
and the **stakeholder impact assessment**
([`stakeholder-impact-assessment-2026.md`](stakeholder-impact-assessment-2026.md)).

## B. Responsible & Compliant AI framework (EU AI Act-oriented)

| Framework expectation | How this system aligns |
|---|---|
| Risk classification | Advisor classed **limited-risk** (transparency obligations) in the asset register; not high-risk (a human makes every regulated decision). Full article-level assessment — territorial scope, roles, Art. 5 / Annex III sweep, Art. 4 literacy, Art. 73-equivalent clocks — in [`eu-ai-act-assessment-2026.md`](eu-ai-act-assessment-2026.md). |
| AI inventory | [`../aims/ai-system-inventory.md`](../aims/ai-system-inventory.md) + [`ai-asset-register.md`](ai-asset-register.md), with a decision-impact tier table. |
| Technical documentation | Model-validation pack, DPIA ([`dpia-2026.md`](dpia-2026.md)), this crosswalk set, architecture + STRIDE ([`../architecture.md`](../architecture.md)). |
| Human oversight | Human-in-the-loop on every AI surface (Layer 5 of the 6-layer doc). |
| Data governance | Data-minimisation, retention auto-purge, PDPL assessment ([`../aims/pdpl-data-processing-assessment.md`](../aims/pdpl-data-processing-assessment.md)). |
| Logging & record-keeping | Hash-chained audit log + retention snapshots (`scripts/retain-state.mjs`); 10-yr AML retention. |
| Transparency to users | On-screen notice + `[AI]` labelling + citations. |

## Summary
All SUM values and FAST principles, and the EU-AI-Act-style lifecycle expectations,
map to controls already in place. Residual items are evidence-maturity (bias-review
history, live eval history), tracked at the quarterly management review.

## Sources
- D. Leslie, *Understanding Artificial Intelligence Ethics and Safety*, The Alan
  Turing Institute (Public Policy Programme).
- *AI Governance: A Framework for Responsible and Compliant Artificial
  Intelligence* (2025), responsible-AI / EU AI Act practitioner guide.

These are advisory frameworks informing this self-assessment; the binding
obligations remain UAE FDL 10/2025, PDPL, and FATF standards.
