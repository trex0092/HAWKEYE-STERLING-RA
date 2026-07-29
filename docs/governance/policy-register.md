# Policy Register

**Every governing instrument, its owner, its approval record and when it falls due.**

**Owner:** MLRO · Compliance Engineering (operational)
**Source of truth:** [`data/policies.json`](../../data/policies.json) (machine-readable; this page is the human view)
**Enforcement:** [`test/policies.test.mjs`](../../test/policies.test.mjs) (CI, every pull request)
**Review cadence:** annually, and whenever an instrument is added, approved or retired.
**Last reviewed:** 2026-07-28

> **The gap this closes.** The policies existed and the governance README indexed
> them. What no artefact recorded was which instruments had actually been
> *approved*, by whom, when they are next due, and — for three of them — who
> owned them at all. An indexed policy nobody owns is the "weak ownership of key
> controls" failure in its usual form: not a missing document, a missing name.

---

## 1. The register

| ID | Instrument | Type | Owner | Status | Next review |
|---|---|---|---|---|---|
| POL-01 | [AI Policy](ai-policy.md) | policy | MLRO | ✅ in force — **ratified 2026-07-02** | 2027-07-02 |
| POL-02 | [AI Acceptable Use Policy](ai-acceptable-use-policy.md) | policy | MLRO | ✅ in force | 2027-06-21 |
| POL-03 | [Risk Appetite Statement 2026](risk-appetite-statement-2026.md) | statement | Board | 📝 draft — board **R7** (item 17) | on ratification |
| POL-04 | [AI Governance Committee Charter](ai-governance-committee-charter.md) | charter | Board | 📝 draft — adoption block (item 4) | on adoption |
| POL-05 | [Operating Model](operating-model.md) | standard | MLRO | ✅ in force | 2027-07-15 |
| POL-06 | [Data Retention](data-retention.md) | standard | MLRO | ✅ in force | 2027-06-21 |
| POL-07 | [TFS Name-Match Procedure](../aims/tfs-name-match-procedure.md) | procedure | MLRO | ✅ in force | 2026-09-15 |
| POL-08 | [Red-Team Procedure](../aims/red-team-procedure.md) | procedure | MLRO / maintainer | ✅ in force | 2026-09-30 |
| POL-09 | [EOCN List Update SOP](../aims/eocn-list-update-sop.md) | procedure | MLRO | ✅ in force | 2026-09-15 |
| POL-10 | [AI Incident Runbook](ai-incident-runbook.md) | runbook | MLRO | ✅ in force | 2027-06-21 |
| POL-11 | [Backup & Recovery](backup-recovery.md) | runbook | Compliance Eng. | ✅ in force | 2027-07-28 |
| POL-12 | [App Setup Runbook](../app-setup-runbook.md) | runbook | Compliance Eng. | ✅ in force | 2027-07-28 |
| POL-13 | [History Scrub Runbook](../security/history-scrub-runbook.md) | runbook | Repo owner | ✅ in force — execution is item 1 | 2027-07-28 |
| POL-14 | [AML/CFT/CPF Policy](../policies/aml-cft-cpf-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-15 | [Customer Acceptance & CDD (SDD/EDD)](../policies/customer-acceptance-cdd-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-16 | [Sanctions & TFS](../policies/sanctions-tfs-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-17 | [Counter-Proliferation Financing (CPF)](../policies/proliferation-financing-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-18 | [Transaction Monitoring & Reporting](../policies/transaction-monitoring-reporting-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-19 | [STR/DPMSR Filing Procedure (goAML)](../policies/str-dpmsr-filing-procedure.md) | procedure | MLRO | 📝 draft — item 18 | on approval |
| POL-20 | [Risk Assessment Methodology (EWRA/BWRA)](../policies/risk-assessment-methodology.md) | standard | MLRO | 📝 draft — item 18 | on approval |
| POL-21 | [Responsible Sourcing](../policies/responsible-sourcing-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-22 | [Record-Keeping & Retention](../policies/record-keeping-retention-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-23 | [Training & Awareness](../policies/training-awareness-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-24 | [Compliance Programme Governance Charter](../policies/compliance-governance-charter.md) | charter | MLRO | 📝 draft — item 18 | on approval |
| POL-25 | [Whistleblowing & Speak-Up](../policies/whistleblowing-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-26 | [Data Privacy (PDPL)](../policies/data-privacy-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-27 | [Information Security](../policies/information-security-policy.md) | policy | Compliance Eng. | 📝 draft — item 18 | on approval |
| POL-28 | [Outsourcing & Third-Party Risk](../policies/outsourcing-third-party-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-29 | [Independent Audit](../policies/independent-audit-policy.md) | policy | Internal Audit | 📝 draft — item 18 | on approval |
| POL-30 | [Regulatory Change Management](../policies/regulatory-change-management-procedure.md) | procedure | Compliance Officer | 📝 draft — item 18 | on approval |
| POL-31 | [Conflict of Interest & Staff Conduct](../policies/conflict-of-interest-policy.md) | policy | MLRO | 📝 draft — item 18 | on approval |
| POL-32 | [Business Continuity & Resilience Plan](../aims/bcp.md) | standard | MLRO | ✅ in force | 2027-07-28 |
| POL-33 | [AI Decommissioning & Retirement](../aims/decommissioning.md) | procedure | MLRO | ✅ in force | 2027-07-28 |
| POL-34 | [Data-Quality Plan](../aims/data-quality-plan.md) | standard | MLRO | ✅ in force | 2027-06-29 |
| POL-35 | [Internal Audit Programme](../aims/internal-audit.md) | procedure | MLRO | ✅ in force | 2027-07-28 |
| POL-36 | [Model Validation & Change Control](model-validation-2026.md) | standard | MLRO | ✅ in force | 2026-09-30 |

**Thirty-six instruments.** Sixteen are in force. Twenty are drafts: two waiting
on the same board sitting as the rest of the programme, and the eighteen-document
[AML/CFT/CPF policy pack](../policies/README.md) drafted 2026-07-28 and awaiting
approval under open-actions item 18.

Five of the in-force rows (POL-32 to POL-36) were added on 2026-07-28 for
instruments that already existed, were owned and were operating — the business
continuity plan, the decommissioning procedure, the data-quality plan, the
internal audit programme and the model-validation pack. They had simply never
been registered, so nothing tracked their approval or their next review. That
is the failure this register exists to prevent, and it was hiding inside the
register's own blind spot (see §2).

Until the pack is approved it is **written, not operative** — the register says
so, the documents say so, and CI fails if either claims otherwise.

## 2. What CI enforces

- **Ownership is declared in the document, not only in the register.** Every
  instrument's own header must carry an `**Owner:**` line, so ownership survives
  someone reading the document without the register. Five documents — the
  committee charter, backup & recovery, the app setup runbook, the red-team
  procedure and the history scrub runbook — had no declared owner until this
  register asked for one; the headers were added in the same change.
- **An approval date must be evidenced by the document.** A register row may not
  claim ratification the instrument itself does not record, in ISO or long form.
- **A draft may not assert a next-review date**, and must name the open-actions
  item that approves it. Review clocks start at approval, not at drafting.
- **Anti-shadow-policy sweep — two signals, not one.** A document is swept if
  **either** its filename carries *policy*, *procedure*, *charter*, *runbook*,
  *sop*, *plan*, *standard*, *methodology* or *bcp*, **or** its header declares
  an `**Approver:**`. Anything swept must be registered or excluded with a
  written reason.

  The second signal exists because the first one missed real instruments:
  `bcp.md` and `decommissioning.md` were owned, operative and unregistered
  purely because of what they were called. A register that only catches
  well-named documents is a register with a blind spot, so the rule now also
  keys on the thing only an instrument claims — that someone approves it.

Five documents are excluded with reasons: the UAE AI Charter mapping and the
ISO 42001 Statement of Applicability (external framework artefacts, not
instruments the firm issues), the explainability statement (descriptive
documentation), and the two index pages — this register and the policy pack's
own README, which list instruments rather than being ones.

## 3. How an instrument changes

1. Edit the document; update its own header (owner, cadence).
2. Update its row here — version, status, and the approval record if the change
   was approved.
3. If it moves from draft to in force, record the approval date **in the
   document** and set the next review from that date.
4. If it is retired, remove the row and record the retirement in the CAPA log or
   the management review — CI will otherwise flag the orphaned document.

## 4. Framework mapping

| Framework | Clause | How this register satisfies it |
|---|---|---|
| ISO/IEC 42001 | 7.5 (documented information: creation, update, control) | Version, owner, approval and review cycle recorded and enforced |
| ISO/IEC 42001 | A.2.2, A.2.3 (AI policy, review of the AI policy) | The AI Policy's approval and review cadence are machine-checked |
| NIST AI RMF | GOVERN 1.2 (policies documented and implemented) | Documentation plus the ownership and review record that makes "implemented" demonstrable |
| GRC practice | Core component 4 — policy management / policy repository | The repository this framework asks for |

---

**Related:** [`risk-appetite-statement-2026.md`](risk-appetite-statement-2026.md) ·
[`obligation-register.md`](obligation-register.md) ·
[`grc-metrics.md`](grc-metrics.md) ·
[`README.md`](README.md)
