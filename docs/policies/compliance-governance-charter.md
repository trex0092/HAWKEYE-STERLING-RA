# Compliance Programme Governance Charter

**Owner:** MLRO (custodian) · Board of Directors (accountable)
**Approver:** Board of Directors
**Status:** DRAFT — for Board approval (open-actions item 18)
**Version:** 0.1 · **Review cadence:** annually, and on any change to the governance structure or the MLRO appointment.

**Regulatory basis:** Federal Decree-Law No. 10 of 2025, Article 17 (compliance
officer, training, independent audit) · Cabinet Resolution No. 134 of 2025
(senior-management responsibility; compliance-officer remit extended to CPF).

---

## 1. Governance architecture

| Element | Requirement | Held by |
|---|---|---|
| Board-level oversight | Approves policies and reviews risk appetite at least annually | Board |
| Senior-management responsibility | Personally approves internal policies; oversees high-risk relationships | Senior management |
| MLRO appointment | Competent, senior, with **direct Board access** | MLRO |
| Day-to-day programme management | Screening, monitoring, records, training, filing logs | Compliance Officer |
| Independent review | Annual independent testing of the programme | Internal Audit |

The **AI Governance Committee** chartered at
[`../governance/ai-governance-committee-charter.md`](../governance/ai-governance-committee-charter.md)
governs the platform and its models. It does not displace this charter: AML
decisions remain the MLRO's.

## 2. MLRO independence and authority

The MLRO:

- is the **sole decision-maker** on filing, freezing, no-action and release;
- has direct, unfiltered access to the Board and may escalate without going
  through management;
- has authority to stop a transaction or decline a relationship, and that
  decision is not commercially reversible;
- has access to all customer, transaction and supplier information without
  restriction;
- may not have that authority delegated away, though defined operational tasks
  may be delegated in writing (see the delegation matrix in
  [`../governance/operating-model.md`](../governance/operating-model.md)).

The compliance function is independent of revenue-generating lines. It advises
on customer acceptance; it does not carry a commercial target on the outcome.
Pressure to suppress a filing is itself a reportable matter under
[`whistleblowing-policy.md`](whistleblowing-policy.md).

## 3. MLRO annual report to the Board

At least annually, the MLRO reports to the Board on: the firm's ML/TF/PF risk
profile and any change to it; filing volumes (STR, DPMSR, TFS) and no-action
decisions; screening performance and material hits; training delivery and gaps;
independent audit findings and their closure status; regulatory changes and
their impact; resourcing adequacy; and the state of the open-actions register.

The report is minuted. Board acceptance of a risk the MLRO has flagged is
recorded as a decision, with reasons.

## 4. Annual compliance cycle

| Period | Activity | Owner |
|---|---|---|
| January | MLRO annual report to the Board | MLRO |
| February | Training needs assessment; schedule the year | CO |
| March | Business-wide risk assessment review (or on trigger) | MLRO / CO |
| April | Periodic review cycle — high-risk customers (6-monthly) | CO |
| May | Screening system review and threshold calibration | CO |
| June | Mid-year programme review | MLRO |
| July | Policy and procedure review against regulatory change | CO |
| August | Annual AML/CFT/CPF refresher delivery | CO |
| September | goAML registration verification; filing-log review | CO |
| October | Periodic review cycle — medium-risk customers (annual) | CO |
| November | Pre-examination readiness check | MLRO |
| December | Document inventory and version-control audit; Board year-end briefing | MLRO / CO |

Dated duties the repository can file with lead time are held in
`data/compliance-calendar.json`; duties the repository cannot know (registration
renewals, assessment anniversaries) are added there by the owner.

## 5. Escalation path

Employee → Compliance Officer → **MLRO** → Board. No step may be skipped
downward (a matter is never resolved below the level it was escalated to), and
no step may be blocked upward. Where the MLRO is conflicted, the matter goes
directly to the Board.

## 6. Programme documentation

Every instrument in this pack is registered, owned and dated in
[`../governance/policy-register.md`](../governance/policy-register.md); the
obligations they discharge are in
[`../governance/obligation-register.md`](../governance/obligation-register.md);
the controls that evidence them are in
[`../governance/assurance-coverage-matrix.md`](../governance/assurance-coverage-matrix.md).
Version control and ownership are enforced in CI, so an instrument cannot lose
its owner or misstate its approval status without failing the build.

## 7. Approval

| Field | Value |
|---|---|
| Approved by (Board) | ☐ |
| Date of approval | ☐ |
| MLRO named in the appointment record | ☐ |
| Next review due | ☐ (12 months from approval) |
