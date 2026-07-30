# Data Privacy Policy (PDPL) — and its AML intersection

**Owner:** MLRO (accountable, pending DPO determination) · Compliance Engineering (operational)
**Approver:** Board of Directors
**Status:** DRAFT — for Board approval (open-actions item 18)
**Version:** 0.1 · **Review cadence:** annually, and on any change to processing, processors or transfer basis.

**Regulatory basis:** Federal Decree-Law No. 45 of 2021 (UAE Personal Data
Protection Law) · Federal Decree-Law No. 10 of 2025 and Cabinet Resolution
No. 134 of 2025 (record-keeping obligations that interact with it).

---

## 1. Lawful basis

The firm processes customer personal data to discharge its AML/CFT/CPF
obligations. The lawful basis for that processing is the firm's **legal
obligation** — not consent. A customer cannot withdraw consent to due diligence
the law requires the firm to perform.

## 2. The five points where privacy and AML meet

| Principle | How it resolves |
|---|---|
| **Lawful basis** | AML/CFT/CPF compliance is a legal obligation and is the basis for CDD processing |
| **Data minimisation** | Collect what the obligation requires — no more. Over-collection is a privacy breach, not diligence |
| **Retention** | The five-year AML retention prevails over shorter privacy defaults for records it covers |
| **Data-subject rights** | Access and erasure **do not** override AML record-keeping or the tipping-off prohibition |
| **Cross-border transfer** | Disclosures to the FIU, supervisors, or for TFS purposes rest on the legal-obligation basis |

## 3. Data-subject requests

Requests are logged and answered within the statutory period. Where a request
touches AML material:

- **Erasure is refused** for records under an AML retention obligation; the
  refusal and its basis are recorded.
- **Access is refused or redacted** where disclosure would reveal that a report
  has been or may be made — Article 25 of Federal Decree-Law No. 10 of 2025
  takes precedence, and the requester is not told that this is the reason.
- A request that appears designed to establish whether a report was filed is
  itself assessed for suspicion.

## 4. Transparency

The customer-facing privacy notice states that personal data is processed for
AML/CFT/CPF compliance, what categories are processed, who it may be shared
with (supervisors, the FIU, processors), and the retention period. It does not
describe monitoring in a way that would defeat it.

## 5. Processors and transfers

Every processor is recorded in
[`../aims/third-party-register.md`](../aims/third-party-register.md) with the
data shared, the safeguard and the DPA status; the capability view (what may be
invoked, with which credential) is in
[`../governance/tool-connector-register.md`](../governance/tool-connector-register.md).

Two positions are **outstanding and gated rather than assumed**: counsel's
written confirmation of the cross-border transfer basis (open-actions items 5
and 11), and the determination of whether a **DPO** must be formally designated
(item 13). Until the transfer basis is confirmed, the model-triage egress path
stays **fail-closed off** — the control is the gate, not the intention.

## 6. Data protection by design

Minimisation is enforced in code, not policy alone: the only personal data that
leaves the firm's boundary for model-assisted triage is a subject name and a
single public headline, and the platform holds no customer record server-side.
The impact assessment is at
[`../governance/dpia-2026.md`](../governance/dpia-2026.md) and the processing
assessment at
[`../aims/pdpl-data-processing-assessment.md`](../aims/pdpl-data-processing-assessment.md).

## 7. Breach handling

A personal-data breach is triaged under the incident runbook at
[`../governance/ai-incident-runbook.md`](../governance/ai-incident-runbook.md),
which carries the notification clocks. A breach that also indicates ML/TF/PF
exposure is escalated to the MLRO in parallel.

## 8. Approval

| Field | Value |
|---|---|
| Approved by (Board) | ☐ |
| Date of approval | ☐ |
| DPO determination minuted | ☐ (open-actions item 13) |
| Next review due | ☐ (12 months from approval) |
