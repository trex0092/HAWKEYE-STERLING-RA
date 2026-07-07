# Internal Audit Programme (AIMS 9.2)

**Owner:** MLRO (programme) · system maintainer (evidence). **Cadence:** annual
full-system audit (before the management review) + quarterly thematic audits +
continuous automated evidence. **Related:**
[`management-review.md`](management-review.md) (9.3 — audit results are agenda
input 6) · [`corrective-actions.md`](corrective-actions.md) (10.2 — findings land
here) ·
[`../governance/assurance-coverage-matrix.md`](../governance/assurance-coverage-matrix.md)
(the control-to-proof map every audit starts from).

ISO/IEC 42001 §9.2 requires audits at planned intervals that determine whether the
AIMS conforms to the organisation's own requirements and to the standard, and is
effectively implemented. This document is that programme: criteria, schedule,
method, independence handling, and the findings loop.

## 1. Scope & criteria

The audit covers the whole AIMS boundary as defined in
[`ai-system-inventory.md`](ai-system-inventory.md): the deterministic risk engine
(`index.html`/`app.js`), the screening engine (`screen.py`, `ai.py`, `agents.py`),
the Advisor AI surfaces (`advisor.html`, `netlify/functions/brain-soul.js`), the
Netlify delivery functions, and the CI/CD control plane (`.github/workflows/`).

Audit criteria, in order of precedence:
1. **Binding law** — UAE FDL 10/2025, Cabinet Resolution 134/2025, PDPL, FATF
   R.1/R.10/R.11/R.22 (see [`in-domain-aml-coverage.md`](in-domain-aml-coverage.md)).
2. **ISO/IEC 42001:2023** clauses 4–10 + the Annex A controls selected in the
   [`statement-of-applicability.md`](statement-of-applicability.md).
3. **The organisation's own rules** — [`../governance/ai-policy.md`](../governance/ai-policy.md),
   [`../governance/ai-acceptable-use-policy.md`](../governance/ai-acceptable-use-policy.md),
   the protection-as-code in `.github/settings.yml`, and the runbooks in
   `docs/governance/`.

## 2. Programme (what is audited, when)

| Tier | Cadence | Scope | Performed by |
|---|---|---|---|
| **Continuous** (automated evidence) | Every push/PR + daily | The full CI gate (41 node tests + Python engine/bias/red-team, CodeQL, Semgrep, gitleaks, actionlint+zizmor); the daily **AI Governance Report** (`scripts/governance-report.mjs`) which files an operating-effectiveness record per control and flags silently-stopped controls **STALE** | GitHub Actions (deterministic) |
| **Quarterly thematic** | Q-start | Rotating theme: (Q1) access & supply chain, (Q2) data governance & retention, (Q3) AI assurance (bias review, advisor eval history, model validation), (Q4) AML methodology (with the adverse-media methodology review task filed by `scripts/quarterly-review.mjs`) | Maintainer, reviewed by MLRO |
| **Annual full-system** | Before the annual management review | Every clause-4–10 requirement + every SoA-selected Annex A control, using the checklist in §4; conformity of documents to reality (do the cited tests/workflows still exist and pass?) | MLRO (or external auditor — §3) |

## 3. Independence & impartiality (single-maintainer reality)

ISO 42001 asks that auditors do not audit their own work. This repository has one
human maintainer, so textbook separation is impossible — the same honesty applied
in `.github/settings.yml` (review policy) applies here. The programme compensates
with three mechanisms, in descending weight:

1. **Automated-evidence primacy.** Wherever the
   [`assurance-coverage-matrix.md`](../governance/assurance-coverage-matrix.md)
   maps a control to an automated proof, the audit verdict comes from the CI/
   workflow record, not from the maintainer's attestation. The evidence is
   deterministic, timestamped, and tamper-evident (Actions run logs).
2. **Role separation within the firm.** The MLRO — accountable for the AIMS but
   not the author of the code — chairs the annual audit and signs the findings.
   The maintainer prepares evidence; the MLRO judges it.
3. **External audit option.** Before any certification claim, or on MLRO request,
   an external ISO/IEC 42001 audit is commissioned; this document and the
   coverage matrix are the audit-ready inputs. Until then, results carry the
   label *self-assessment with automated evidence*.

## 4. Annual audit checklist (clause → verify → evidence)

| Ref | Verify that… | Primary evidence |
|---|---|---|
| 4.1–4.4 | Context, interested parties and AIMS scope still match reality | [`interested-parties.md`](interested-parties.md); [`ai-system-inventory.md`](ai-system-inventory.md) |
| 5.2 | AI policy exists, is ratified, and is followed | [`../governance/ai-policy.md`](../governance/ai-policy.md) §9 signature block |
| 6.1 | Risk register is current; every OPEN risk has an owner and treatment | [`ai-risk-register.md`](ai-risk-register.md) |
| 6.1.3 | SoA matches deployed controls (spot-check 5 controls) | [`statement-of-applicability.md`](statement-of-applicability.md) vs. code/CI |
| 7.2 | Competency & AI-literacy records current for every role | [`competency-records.md`](competency-records.md) |
| 8 | Operational controls run as documented — no STALE flags outstanding | Daily governance-report history (Asana) |
| 9.1 | Monitoring & drift detection active; metrics history accumulating | [`runtime-monitoring.md`](runtime-monitoring.md); `data/run-metrics.json` commits |
| 9.2 | *This programme* executed on schedule; last cycle's findings closed | §6 log below |
| 9.3 | Management review held; outputs actioned | [`management-review.md`](management-review.md) log |
| 10.2 | Every CRITICAL/HIGH finding carries a regression test and a Closed status | [`corrective-actions.md`](corrective-actions.md) |
| A.5 | Impact/bias assessments current (≤ 12 months old, or younger than the last model change) | [`ai-impact-assessment.md`](ai-impact-assessment.md); [`../governance/advisor-bias-review-2026.md`](../governance/advisor-bias-review-2026.md) log |
| A.6 | Lifecycle procedures exist for every phase **including retirement** | [`decommissioning.md`](decommissioning.md) |
| A.7 | Retention/purge behaviour matches [`../governance/data-retention.md`](../governance/data-retention.md) | `scripts/retain-state.mjs` runs; `data/retention/manifest.json` |
| A.8 | Transparency surfaces intact — on-screen AI notice, `[AI]` labels, citations | Browser smoke assertions in `.github/workflows/ci.yml` (advisor disclosure string) |
| A.10 | Third-party register current; DPA statuses true | [`third-party-register.md`](third-party-register.md) |

Method: start from the coverage matrix, pull the latest run for each automated
proof, then walk the checklist top-to-bottom. Any "verify" that fails, or any
document found to cite a test/workflow/control that no longer exists, is a
**nonconformity**.

## 5. Reporting & follow-up

Each audit produces a short report: scope, criteria, evidence sampled, findings
(classified **nonconformity / observation / opportunity**), and a conclusion on
AIMS conformity and effectiveness. Every nonconformity is entered in the
[CAPA log](corrective-actions.md) with root cause and verification, and the
report is tabled as input 6 of the next
[management review](management-review.md). Findings stay open until the
corrective action is *verified*, not merely implemented.

## 6. Audit log

| Date | Tier | Auditor | Scope | Findings (NC/Obs/OFI) | Report / CAPA refs | Status |
|---|---|---|---|---|---|---|
| _scheduled — Q3 2026 (before first management review)_ | Annual | MLRO | Full AIMS per §4 | _to be recorded_ | — | Planned |
| | | | | | | |

> The first annual audit is deliberately scheduled *before* the first management
> review so the review receives real audit results, completing the 9.1 → 9.2 →
> 9.3 → 10.2 Check-Act loop.
