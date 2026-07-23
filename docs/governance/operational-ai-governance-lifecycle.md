# AI Governance as an Operating Discipline — the Seven-Stage Loop

AI governance here is not a binder produced once for an auditor — it is the
operating cadence of the system: a repeating loop where every stage leaves
evidence that is **traceable, auditable, and defensible**. This page maps the
seven stages of that loop onto the artifacts and automation that actually run
in this repository. It is the *operating-cadence* view; the complementary
*system-lifecycle* view (design → build → deploy → retire, 11 stages) lives in
the [PbG lifecycle map](pbg-lifecycle-map-2026.md). **Owner: MLRO · reviewed
at each management review.**

## The seven stages, located in this repo

| # | Stage | What it means here | Standing evidence |
|---|---|---|---|
| 1 | **Strategic alignment** | Why the AI exists and what it may be used for is written down and ratified — decision-support for a regulated AML/CFT duty, never autonomous decisions | [AI Policy](ai-policy.md) (ratified 2026-07-02) · [committee charter](ai-governance-committee-charter.md) · [in-domain AML coverage](../aims/in-domain-aml-coverage.md) · [acceptable use](ai-acceptable-use-policy.md) |
| 2 | **Risk & readiness** | Know what you run and what could go wrong before it goes wrong | [AI system inventory](../aims/ai-system-inventory.md) · [risk register R-01…R-20](../aims/ai-risk-register.md) · [DPIA](dpia-2026.md) · [impact assessments](stakeholder-impact-assessment-2026.md) · [readiness review](enterprise-readiness-review-2026.md) |
| 3 | **Governance & control design** | Every accepted risk gets a named control, every control a named owner | [ISO 42001 SoA](iso-42001-soa-2026.md) · [NIST AI RMF mapping](nist-ai-rmf-mapping-2026.md) · [GRC↔cyber model](grc-cybersecurity-model.md) · [repo hardening](github-repository-hardening.md) |
| 4 | **Validation & testing** | Prove the system works *before* relying on it, and keep re-proving it | [Model validation](model-validation-2026.md) · weekly advisor evals + guardrail battery (CI-enforced) · [bias & fairness testing](../aims/bias-fairness-testing.md) · [red-team procedure](../aims/red-team-procedure.md) |
| 5 | **Evidence-based decisions** | Releases, sign-offs, and risk acceptances happen on evidence, not assertion | Protected `release` environment gate · quarterly MLRO sign-off in [model validation](model-validation-2026.md) · [management review](../aims/management-review.md) · [board minute template](board-minute-template-2026-07.md) |
| 6 | **Monitor & assure** | Watch the running system continuously and degrade loudly, never silently | [Runtime monitoring](../aims/runtime-monitoring.md) · anomaly-watch sustained-anomaly escalation · monthly governance report · [assurance coverage matrix](assurance-coverage-matrix.md) · [internal audit](../aims/internal-audit.md) |
| 7 | **Improve & adapt** | Findings become tracked corrections, not shelf-ware | [CAPA log](../aims/corrective-actions.md) · [open-actions register](open-actions-register.md) · [incident postmortems](incident-postmortem-template.md) · [stakeholder feedback](../aims/stakeholder-feedback.md) · quarterly methodology review |

Stage 7 feeds stage 1: what monitoring and CAPA surface reshapes policy and
risk appetite at the next management review, and the loop runs again.

## The three questions an executive must be able to answer

| Question | The answer, with evidence |
|---|---|
| **What could go wrong?** | The [risk register](../aims/ai-risk-register.md) enumerates it (R-01…R-20 with inherent/residual scoring); the [DPIA](dpia-2026.md) and [stakeholder impact assessment](stakeholder-impact-assessment-2026.md) cover the people it could go wrong *for* |
| **Who is accountable?** | Named in the [committee charter](ai-governance-committee-charter.md); every register row carries an owner; human-in-the-loop is architectural (the AI drafts, the MLRO decides — STR filing is MLRO-only) |
| **Can we prove it?** | The [assurance coverage matrix](assurance-coverage-matrix.md) maps each control to its automated proof; CI gates fail loudly on drift; the [internal audit programme](../aims/internal-audit.md) tests the map itself |

If any of these three ever cannot be answered *from the artifacts* — not from
memory — that gap is itself a finding for the [CAPA log](../aims/corrective-actions.md).

*The discipline is the loop, not the documents: every stage above is exercised
by scheduled automation or a dated review cycle, so the evidence stays current
without anyone remembering to refresh it.*
