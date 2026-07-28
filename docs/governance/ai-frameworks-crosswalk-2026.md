# External AI-Ethics Frameworks — Crosswalk (2026)

Maps three external AI-ethics/governance frameworks to the controls
already implemented in this system, so their principles are demonstrably covered
(not just asserted). Complements the regulatory/standards crosswalks:
[`nist-ai-rmf-mapping-2026.md`](nist-ai-rmf-mapping-2026.md),
[`iso-42001-soa-2026.md`](iso-42001-soa-2026.md), and
[`uae-ai-charter-mapping-2026.md`](uae-ai-charter-mapping-2026.md).

**Owner:** MLRO · Compliance Engineering · **Date:** 2026-06-30 ·
**Updated:** 2026-07-28 (§C added) ·
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

## C. Operational AI Governance Stack (five levels)

Maps the five-level *Operational AI Governance Stack* — its operating principle:
visibility enables monitoring, monitoring enables control, control produces
evidence, evidence enables continuous governance — to this system. Levels 1–2
are where AI-agent-governance platforms (e.g. CloudFuze) position themselves;
Levels 3–5 must be the organisation's own architecture. The stack's key
distinction: monitoring shows *what happened*; **governance evidence** (Level 4)
proves *why, who authorised it, whether a human intervened, and that this is
independently verifiable*. Scored tile-by-tile in
[`operational-ai-governance-stack-2026.md`](operational-ai-governance-stack-2026.md).

| Level | Tiles | How this system aligns |
|---|---|---|
| **1 · Visibility** (agent discovery, asset inventory, shadow-AI detection, asset catalog) | ✅ [`data/ai-assets.json`](../../data/ai-assets.json) register + [`ai-asset-register.md`](ai-asset-register.md); shadow-AI scan in `test/ai-assets.test.js` (every model-API caller in the codebase must be a registered surface or an allowlisted eval harness); register gate: no AI surface deploys unregistered. |
| **2 · Operational monitoring** (activity monitoring, permission analysis, conversation monitoring, knowledge-source analysis, risk alerts) | ✅ runtime guards in `brain-soul.js` (`piiFlagged` / `structureFlagged` / `budgetFlagged`); weekly live eval + quarterly bias eval; knowledge sources pinned and watched (`data/sanctions-sources.json`, regulatory watch); every failure path alerts loudly (Asana card / red run / issue fallback). *Conversation monitoring is a deliberate non-control — see note below.* |
| **3 · Governance controls** (policy enforcement, ownership, risk controls, lifecycle management, approval workflows) | ✅ AUP acknowledgment gate enforced in-app; named MLRO owner per register row; kill switch (`ADVISOR_ENABLED`); risk register R-01…R-20; decommissioning procedure ([`../aims/decommissioning.md`](../aims/decommissioning.md)); CODEOWNERS change gate + protected `release` environment approvals. |
| **4 · Governance evidence** (decision ledger, runtime evidence, human override records, authorization chain, independent audit evidence, decision provenance) | ✅ indexed type-by-type in the [assurance coverage matrix](assurance-coverage-matrix.md) §1.10: hash-chained activity log, one-way override records with mandatory justification, MLRO sign-off/attestation chain, Sigstore + SARIF artefacts, contributing-factors provenance. |
| **5 · Continuous operational governance** (continuous assurance, governance metrics, executive reporting, continuous improvement, regulatory readiness) | ✅ daily governance report with composite **GovernanceScore** (`scripts/governance-report.mjs`); KPI catalog (matrix §3); [executive brief](../executive/executive-brief.md) + [KPI dashboard](../executive/kpi-dashboard.md); CAPA loop ([`../aims/corrective-actions.md`](../aims/corrective-actions.md)); FATF-ME prep + NIST/ISO self-assessments. |

> **Deliberate non-controls (stated, not hidden).** *Conversation monitoring* of
> Advisor sessions is not implemented: exchanges are ephemeral by design
> (data-minimisation; retaining them would create a PDPL liability with no
> proportionate benefit for a single-operator tool). *Discovery / permission-analysis
> tooling* — the platform tiles of Levels 1–2 — is N/A while the AI estate is
> small and fully enumerated; the register gate is the control. **Re-trigger:**
> adopting platform-built agents (Copilot Studio, Vertex AI or similar) reopens
> both decisions.

## Summary
All SUM values and FAST principles, the EU-AI-Act-style lifecycle expectations,
and the five-level operational stack (§C, with its Level-4 evidence types indexed
artefact-by-artefact in the coverage matrix) map to controls already in place.
Residual items are evidence-maturity (bias-review history, live eval history),
tracked at the quarterly management review.

## Sources
- D. Leslie, *Understanding Artificial Intelligence Ethics and Safety*, The Alan
  Turing Institute (Public Policy Programme).
- *AI Governance: A Framework for Responsible and Compliant Artificial
  Intelligence* (2025), responsible-AI / EU AI Act practitioner guide.
- *Operational AI Governance Stack* (2026), governance-research newsletter
  analysis positioning AI-agent-governance platforms (CloudFuze walkthrough)
  within a five-level operational architecture; origin of the Level-4
  "governance evidence" framing indexed in
  [`assurance-coverage-matrix.md`](assurance-coverage-matrix.md) §1.10.

These are advisory frameworks informing this self-assessment; the binding
obligations remain UAE FDL 10/2025, PDPL, and FATF standards.
