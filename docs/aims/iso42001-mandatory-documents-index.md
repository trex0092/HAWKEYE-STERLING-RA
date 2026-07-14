# ISO/IEC 42001:2023 — Mandatory Documented Information: Crosswalk Index

_Maps the 33 items of documented information an effective AIMS requires (per the
standard's clauses 4–10 + Annex A practice checklists) to this repo's evidence,
so an auditor — or the MLRO — can find every artifact from one page. Statuses:
✅ maintained · 🟡 partial (documented below) · N-A excluded with justification.
Self-assessment (not certified). Owner: MLRO / Compliance Engineering.
Last review: 2026-07-14._

| # | Documented information | Status | Evidence |
|---|---|---|---|
| 01 | AIMS scope | ✅ | [`README.md`](README.md) (pack scope: screening engine + web app), [`statement-of-applicability.md`](statement-of-applicability.md) |
| 02 | Interested parties & requirements | ✅ | [`interested-parties.md`](interested-parties.md) · [`interested-parties-information.md`](interested-parties-information.md) |
| 03 | AI system inventory | ✅ | [`ai-system-inventory.md`](ai-system-inventory.md) + live [`data/ai-assets.json`](../../data/ai-assets.json) |
| 04 | AI context & applicability assessment | ✅ | [`statement-of-applicability.md`](statement-of-applicability.md) · [`../governance/iso-42001-soa-2026.md`](../governance/iso-42001-soa-2026.md) |
| 05 | AI policy | ✅ | [`../governance/ai-policy.md`](../governance/ai-policy.md) (ratified 2026-07-02) + [`../governance/ai-acceptable-use-policy.md`](../governance/ai-acceptable-use-policy.md) |
| 06 | Roles & responsibilities | ✅ | AI policy §roles; asset register `owner_role`; [`../../.github/CODEOWNERS`](../../.github/CODEOWNERS); MLRO accountable throughout |
| 07 | AI risk assessment methodology | ✅ | [`ai-risk-register.md`](ai-risk-register.md) preamble — likelihood × impact matrix, residual scoring, treatment options |
| 08 | AI risk register | ✅ | [`ai-risk-register.md`](ai-risk-register.md) (R-01…) |
| 09 | AI objectives & plans | 🟡→✅ | §Objectives below — the measurable objectives were enforced in CI/monitoring but not stated as AIMS objectives until this index |
| 10 | Statement of Applicability (Annex A) | ✅ | [`statement-of-applicability.md`](statement-of-applicability.md) · [`../governance/iso-42001-soa-2026.md`](../governance/iso-42001-soa-2026.md) (incl. justified N-A exclusions) |
| 11 | Competency & awareness records | ✅ | [`competency-records.md`](competency-records.md) |
| 12 | Communication process | 🟡→✅ | §Communication below — channels existed; the process statement lives here |
| 13 | Document control procedure | 🟡→✅ | §Document control below — enforced by git + branch protection; procedure stated here |
| 14 | AI lifecycle management procedure | ✅ | [`../governance/pbg-lifecycle-map-2026.md`](../governance/pbg-lifecycle-map-2026.md) · model cards [`../models/`](../models/) · [`decommissioning.md`](decommissioning.md) |
| 15 | Human oversight mechanism | ✅ | HITL mandate: AI policy; every report ends in MLRO sign-off; `agents.py` four-eyes lines; no freeze/decline/report without human review |
| 16 | Incident management procedure | ✅ | [`../governance/ai-incident-runbook.md`](../governance/ai-incident-runbook.md) + [`../governance/incident-postmortem-template.md`](../governance/incident-postmortem-template.md) |
| 17 | Change management procedure | ✅ | [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) + [`../governance/github-repository-hardening.md`](../governance/github-repository-hardening.md) (PR-only, 8 required checks, model-change control test) |
| 18 | Monitoring & validation records | ✅ | [`runtime-monitoring.md`](runtime-monitoring.md) + live `data/run-metrics.json` · [`../governance/model-validation-2026.md`](../governance/model-validation-2026.md) |
| 19 | Internal audit protocols & reports | ✅ | [`internal-audit.md`](internal-audit.md) + per-run QA gate/attestation (report §⑥–⑦) |
| 20 | Management review records | ✅ | [`management-review.md`](management-review.md) |
| 21 | KPI / monitoring metrics | ✅ | [`runtime-monitoring.md`](runtime-monitoring.md) (thresholds table) + weekly `advisor-eval` scores |
| 22 | Nonconformity & corrective action | ✅ | [`corrective-actions.md`](corrective-actions.md) (CAPA log) |
| 23 | Continual improvement records | ✅ | [`../../CHANGELOG.md`](../../CHANGELOG.md) (dated, root-caused entries) + CAPA log |
| 24 | AI impact assessment | ✅ | [`ai-impact-assessment.md`](ai-impact-assessment.md) · [`../governance/stakeholder-impact-assessment-2026.md`](../governance/stakeholder-impact-assessment-2026.md) |
| 25 | Data governance records | ✅ | [`data-quality-plan.md`](data-quality-plan.md) · [`../governance/data-retention.md`](../governance/data-retention.md) · [`pdpl-data-processing-assessment.md`](pdpl-data-processing-assessment.md) |
| 26 | Model governance records | ✅ | Model cards: [`../models/`](../models/) (matcher, adverse-media, PEP, triage, advisor, risk engine) |
| 27 | Third-party management records | ✅ | [`third-party-register.md`](third-party-register.md) (incl. OpenSanctions CC-BY-NC entry + kill-switches, Anthropic DPA pack) |
| 28 | Cybersecurity integration records | ✅ | [`../../SECURITY.md`](../../SECURITY.md) · OpenSSF Scorecard ([`../governance/scorecard-9.5-path.md`](../governance/scorecard-9.5-path.md)) · CodeQL/Semgrep/gitleaks/zizmor gates · [`../security/`](../security/) |
| 29 | Legal & regulatory compliance evidence | ✅ | [`../research/uae-aml-legal-framework.md`](../research/uae-aml-legal-framework.md) (FDL 10/2025 register) · per-run attestation (report §⑦) · Regulatory Watch trail |
| 30 | Stakeholder feedback records | ✅ | [`stakeholder-feedback.md`](stakeholder-feedback.md) |
| 31 | Bias & fairness assessment | ✅ | [`bias-fairness-testing.md`](bias-fairness-testing.md) + CI gate `test/bias_eval.py` · [`../governance/advisor-bias-review-2026.md`](../governance/advisor-bias-review-2026.md) |
| 32 | Explainability & transparency records | ✅ | [`../governance/explainability-statement-2026.md`](../governance/explainability-statement-2026.md) + labelled AI outputs carrying raw evidence |
| 33 | Business continuity & resilience plan | ✅ | [`bcp.md`](bcp.md) · [`../governance/backup-recovery.md`](../governance/backup-recovery.md) · degrade-loudly + mirror/watchlist fallbacks (CHANGELOG 2026-07-14) |

**2026-focus additions** — AI ethics & responsible-AI docs: AI policy + charter P1–P10 ✅ ·
Generative-AI content management: `REPORT_ALLOW_LLM=0` + `LLM_TRIAGE` PDPL gate ✅ ·
AI security & adversarial risk controls: [`red-team-procedure.md`](red-team-procedure.md) + CI gate `test/redteam_injection.py` ✅ ·
DPIA: [`../governance/dpia-2026.md`](../governance/dpia-2026.md) ✅ ·
Prompt security & LLM risk management: injection detection/non-execution/no-downgrade guarantees (engine tests) ✅.

## §Objectives — measurable AIMS objectives and plans (closes item 09)

The objectives below were already *enforced* (CI gates, monitoring thresholds);
this section states them as the AIMS objectives they are. Reviewed at
management review; failures surface via the monitoring/escalation path.

| Objective | Measure | Target | Enforced by |
|---|---|---|---|
| No silent screening degradation | `am_blackout`, module statuses | 0 subjects without any adverse net; every degradation printed in the MLRO report | engine tally + anomaly-watch |
| Screening completeness | `subjects` vs book | 100% of customers + related parties attempted daily | daily + onboarding runs, freshness check |
| Error containment | `error_rate` (actionable failures) | ≤ 10% per run; sustained window empty | monitoring thresholds + escalation |
| Advisor quality | weekly eval score; bias parity | eval gate passes; recall parity within tolerance | `advisor-eval.yml`, `bias_eval.py` (CI-blocking) |
| Prompt-security | red-team suite | detection, non-execution, no-downgrade, no-echo all hold | `redteam_injection.py` (CI-blocking) |
| Supply-chain posture | OpenSSF Scorecard | maintain configurable maximum (8.1 today; ≥9.0 from 2026-09 per runbook) | scorecard workflow + [`scorecard-9.5-path.md`](../governance/scorecard-9.5-path.md) |

## §Communication — internal & external AI communication process (closes item 12)

- **To the MLRO (daily, operational):** the unified screening report delivered to
  Asana by 09:00 UAE — findings, module statuses, monitoring, QA gate,
  attestation, sign-off block. Escalations additionally as MLRO case subtasks.
- **To engineering/ops (event-driven):** GitHub issues opened by the watchers
  (anomaly-watch, link-check, sanctions/reg watch fallbacks) — each now closes
  itself when its condition clears; Asana alerts for stale controls and live-site
  failures.
- **To users of the app (transparency):** the Advisor transparency notice
  (`advisor.html`) + [`interested-parties-information.md`](interested-parties-information.md).
- **External security reporting:** [`../../SECURITY.md`](../../SECURITY.md)
  (private vulnerability reporting, SLAs).
- **Record:** run logs and reports are the communication record (10-year
  retention posture).

## §Document control — procedure (closes item 13)

All AIMS documentation is **controlled in git** and inherits the code
controls, which is stricter than a manual document register:

- **Creation/update:** PR-only to `main` (branch protection, no direct pushes,
  `enforce_admins` on); every change reviewed against the 8 required status
  checks; CODEOWNERS routes ownership; squash merges keep linear history.
- **Versioning & traceability:** every revision is a commit with author, date,
  rationale; notable changes logged in `CHANGELOG.md` (format CI-enforced by
  `test/changelog.test.mjs`).
- **Review & currency:** register/date headers in each doc; quarterly
  methodology review auto-filed; Regulatory Watch keeps legal references
  current (see the FDL 10/2025 migration, 2026-07-14).
- **Access & integrity:** public read; write restricted to the maintainer via
  branch protection; history immutable (no force-push/deletion on `main`).
- **Retention:** repository history (indefinite) within the firm's 10-year
  evidence posture ([`../governance/data-retention.md`](../governance/data-retention.md)).
