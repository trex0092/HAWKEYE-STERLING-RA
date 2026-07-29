# Information Security Policy

**Owner:** Compliance Engineering (operational) · MLRO (accountable)
**Approver:** Board of Directors
**Status:** DRAFT — for Board approval (open-actions item 18)
**Version:** 0.1 · **Review cadence:** annually, and on any material change to the platform, its hosting or its integrations.

**Regulatory basis:** Federal Decree-Law No. 10 of 2025 and Cabinet Resolution
No. 134 of 2025 (protection of records and their availability to competent
authorities) · Federal Decree-Law No. 45 of 2021 (PDPL security obligations).

---

## 1. Why a compliance pack contains a security policy

Compliance records that can be altered, lost or leaked are not compliance
records. Availability within 48 hours of a request, integrity of the evidence
trail, and confidentiality of customer and reporting data are AML obligations
before they are IT preferences.

## 2. Control statements

1. **Least privilege.** Access to customer data, screening output and filing
   records is granted by role and reviewed. Automated components hold an
   explicit allow-list of actions and a brokered credential per action; anything
   outside the list is denied **and logged** — see
   [`../governance/tool-connector-register.md`](../governance/tool-connector-register.md).
2. **Secrets.** Credentials are held as platform secrets, never in source,
   never in the browser, and never written to a report or a log. Rotation is a
   scheduled duty in the compliance calendar. Secret scanning runs on every
   change.
3. **Egress control.** Automated jobs run under an egress allow-list; a host not
   on the list is blocked, not merely recorded.
4. **Encryption.** Data in transit is encrypted; sensitive state committed by
   automation is encrypted at rest.
5. **Vulnerability management.** Dependency, container and static analysis run
   continuously. A known vulnerability is either fixed or suppressed **with a
   written justification** — silent suppression is a control failure and is
   measured as a KRI.
6. **Change control.** Every change to the platform is reviewed and tested
   before merge; protected branches and required checks are configuration, not
   convention.
7. **Logging and audit trail.** Compliance-relevant actions are recorded in an
   append-only trail; the trail is part of the evidence pack, not a debugging
   aid.
8. **Backup and recovery.** Backups are taken, and **restoration is tested** —
   see [`../governance/backup-recovery.md`](../governance/backup-recovery.md).

## 3. AI-specific security

The advisory and triage surfaces are governed as AI assets with their own
controls: instruction sets are fingerprinted and version-controlled
([`../governance/prompt-lifecycle-register.md`](../governance/prompt-lifecycle-register.md)),
no model call may declare tools, third-party text is treated as data and never
as instructions, and a standing prompt-injection red-team runs in CI. Acceptable
use for staff is in
[`../governance/ai-acceptable-use-policy.md`](../governance/ai-acceptable-use-policy.md).

## 4. Incidents

Security incidents follow the incident runbook at
[`../governance/ai-incident-runbook.md`](../governance/ai-incident-runbook.md):
contain, assess, notify within the applicable clocks, remediate, and record a
blameless post-mortem. An incident touching personal data also runs the privacy
path in [`data-privacy-policy.md`](data-privacy-policy.md); one touching
compliance records also runs the record-integrity path in
[`record-keeping-retention-policy.md`](record-keeping-retention-policy.md).

Vulnerability disclosure by external parties is handled per
[`../../SECURITY.md`](../../SECURITY.md).

## 5. Evidence

Control-by-control proof is in
[`../governance/assurance-coverage-matrix.md`](../governance/assurance-coverage-matrix.md);
supply-chain posture is scored publicly and tracked in
[`../governance/scorecard-9.5-path.md`](../governance/scorecard-9.5-path.md);
required repository configuration is in
[`../governance/github-repository-hardening.md`](../governance/github-repository-hardening.md).

## 6. Approval

| Field | Value |
|---|---|
| Approved by (Board) | ☐ |
| Date of approval | ☐ |
| Next review due | ☐ (12 months from approval) |
