# AI Policy — Hawkeye Sterling (ISO/IEC 42001 A.2.2)

**Layer 6 — Governance, Compliance & Audit.** The firm's top-level, standalone policy
governing the responsible development, deployment, and use of AI in the screening and
advisory platform. **Owner:** MLRO · Compliance Engineering. **Date:** 2026-06-29.
**Version:** 1.0 — **ratified 2 July 2026** (see §9).

This is the parent policy. It sits above and references the operational documents:
[`AI-GOVERNANCE.md`](../AI-GOVERNANCE.md) (control mapping),
[`ai-acceptable-use-policy.md`](ai-acceptable-use-policy.md) (operator rules),
[`ai-asset-register.md`](ai-asset-register.md), [`dpia-2026.md`](dpia-2026.md),
[`../aims/statement-of-applicability.md`](../aims/statement-of-applicability.md), and the
ISO/NIST self-assessments.

## 1. Purpose & scope
Establish how Hawkeye Sterling governs AI so its use is **lawful, proportionate, explainable,
and always subject to human accountability**. Scope: every AI surface in the platform — the
deterministic risk-rating engine, the grounded adverse-media triage (optional LLM), and the
MLRO Advisor. Excludes model *training/fine-tuning*: the firm consumes a third-party model
read-only and develops no models (see SoA exclusions).

## 2. Principles
1. **Decision-support only.** AI never makes a compliance decision. The MLRO/Compliance
   Officer is accountable for every disposition (FATF R.10/R.12; UAE Cabinet 74/2020).
2. **Human-in-the-loop.** Nothing auto-files; nothing freezes/declines without human review.
3. **Degrade loudly.** A failure, a shrunk source, or an unavailable feed is surfaced — never
   silently presented as "all clear".
4. **No fabrication.** Reports are deterministic; the LLM is used only for grounded
   classification of supplied text. No invented transactions, hits, or sources.
5. **Data minimisation & privacy by default.** No customer-data egress by default; the LLM
   path is opt-in and receives only a subject name + one public headline (UAE PDPL; DPIA).
6. **Explainability.** Every output carries its basis and raw evidence; risk scores state
   their methodology.
7. **Fairness.** Name-matching must not under-serve non-Latin names; tested for cross-script
   recall parity ([`../aims/bias-fairness-testing.md`](../aims/bias-fairness-testing.md)).
8. **Security.** Untrusted text is treated adversarially (prompt-injection detect-then-don't-send);
   least privilege; secrets never in logs or the browser.
9. **Accountability & auditability.** Roles are assigned; every change flows through git; every
   AI response emits an audit line.

## 3. Roles & responsibilities
- **MLRO** — accountable owner of AI use, risk acceptance, and sign-off.
- **Compliance Engineering** — implements and tests controls; maintains this pack.
- **Operators (analysts)** — use AI per the Acceptable-Use Policy; verify against primary sources.
- **Senior management / board** — ratify this policy; review residual-risk acceptance.

## 4. Permitted & prohibited use
Governed by [`ai-acceptable-use-policy.md`](ai-acceptable-use-policy.md), which is binding on all
operators and gated in-app (acknowledgment recorded as `hsra.aup.ack.v1`).

## 5. Data governance
Data resources, lineage, retention, and quality are governed by
[`data-retention.md`](data-retention.md) and
[`../aims/data-quality-plan.md`](../aims/data-quality-plan.md). Third-party processors and DPA
status are in [`../aims/third-party-register.md`](../aims/third-party-register.md).

## 6. Risk management
AI risks are identified, rated, and tracked in
[`../aims/ai-risk-register.md`](../aims/ai-risk-register.md); impacts on individuals in
[`../aims/ai-impact-assessment.md`](../aims/ai-impact-assessment.md) and
[`dpia-2026.md`](dpia-2026.md). Residual-risk acceptance is a management-review decision.

## 7. Monitoring, review & improvement
Runtime/coverage monitoring ([`../aims/runtime-monitoring.md`](../aims/runtime-monitoring.md)),
weekly advisor evaluation, bias review ([`advisor-bias-review-2026.md`](advisor-bias-review-2026.md)),
and corrective action ([`../aims/corrective-actions.md`](../aims/corrective-actions.md)). The AIMS is
reviewed by senior management at least annually and on material change
([`../aims/management-review.md`](../aims/management-review.md)).

## 8. Incidents
AI failures, suspected bias, prompt-injection, or privacy concerns are raised and handled per
[`ai-incident-runbook.md`](ai-incident-runbook.md).

## 9. Approval & ratification
| Version | Date | Author | Approver (senior management) | Status |
|---|---|---|---|---|
| 1.0 | 2026-06-29 | Compliance Engineering / MLRO | Luisa Fernanda (MLRO) | **Ratified 2026-07-02** |

> Signature evidence: Ratified 2026-07-02 by Luisa Fernanda (MLRO / workspace owner) — evidence: Asana task 1216233454512937 in HAWKEYE STERLING APP (name entered by the workspace owner, 2026-07-02T10:44Z; workspace is single-owner access).

*Reviewed annually and on any change to AI models, scope, or applicable regulation.*

## 10. References & external frameworks
This policy is informed by, and mapped to, the following frameworks (binding
obligations remain UAE FDL 10/2025, PDPL, and FATF standards):

- **Binding/standards crosswalks:** [`nist-ai-rmf-mapping-2026.md`](nist-ai-rmf-mapping-2026.md),
  [`iso-42001-soa-2026.md`](iso-42001-soa-2026.md),
  [`uae-ai-charter-mapping-2026.md`](uae-ai-charter-mapping-2026.md).
- **External ethics frameworks crosswalk** (Alan Turing Institute *FAST principles
  & SUM values*; EU-AI-Act-oriented responsible-AI lifecycle):
  [`ai-frameworks-crosswalk-2026.md`](ai-frameworks-crosswalk-2026.md).
- **Process & assessments:** [`pbg-lifecycle-map-2026.md`](pbg-lifecycle-map-2026.md),
  [`stakeholder-impact-assessment-2026.md`](stakeholder-impact-assessment-2026.md),
  [`explainability-statement-2026.md`](explainability-statement-2026.md),
  [`dpia-2026.md`](dpia-2026.md).
