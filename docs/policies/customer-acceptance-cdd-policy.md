# Customer Acceptance & Due Diligence Policy (CDD / SDD / EDD)

**Owner:** MLRO (accountable) · Compliance Officer (operational)
**Approver:** Board of Directors
**Status:** DRAFT — for Board approval (open-actions item 18)
**Version:** 0.1 · **Review cadence:** annually, and on any change to the CDD framework or the scoring methodology.

**Regulatory basis:** Federal Decree-Law No. 10 of 2025 · Cabinet Resolution
No. 134 of 2025 · MoE Circular No. 6 of 2025 (risk-based CDD including
Simplified Due Diligence) · MoE Circular No. 4 of 2025 (National Risk
Assessment 2024).

---

## 1. Acceptance principle

No business relationship is established, and no qualifying occasional
transaction is executed, before due diligence is complete and the customer risk
rating is recorded. Where verification cannot be completed, the relationship is
declined and the circumstances are assessed for suspicion.

## 2. Customer risk rating

Risk is scored on the firm's **0–30 methodology**, which produces one of four
outcomes. The numeric bands and the hard rules that sit above them are the same
ones the assessment engine applies:

| Outcome | Basis |
|---|---|
| **CDD** | Score ≤ 19 |
| **SDD** | Score ≤ 22, and every SDD eligibility condition in §4 is met |
| **EDD** | Score ≥ 23, **or** any EDD trigger, regardless of score |
| **PROHIBITED** | Any prohibition trigger, regardless of score — do not onboard |

Two rules are absolute: a prohibition trigger overrides the score, and an
analyst may only ever **raise** the diligence level, never lower it, and only
with a written justification recorded against the assessment. This is enforced
in the engine, not merely stated here.

## 3. Standard CDD

For every customer:

1. **Identify** the customer — legal name, legal form, registered address,
   trade licence, and identity documents for natural persons.
2. **Verify** identity from independent, reliable source documents or data.
3. **Identify the beneficial owner** — natural persons owning or controlling
   **25% or more**; where no such person exists or can be identified, identify
   the natural person exercising control by other means, and failing that, the
   senior managing official. **Nominal managers and nominee shareholders must be
   identified** and looked through.
4. **Understand the purpose and intended nature** of the relationship.
5. **Screen** the customer, beneficial owners and connected parties against the
   applicable lists before the relationship begins — see
   [`sanctions-tfs-policy.md`](sanctions-tfs-policy.md).
6. **Assess PF exposure** as a distinct question, not a by-product of the ML
   assessment — see
   [`proliferation-financing-policy.md`](proliferation-financing-policy.md).
7. **Record** the rating, the evidence and the decision.

## 4. Simplified Due Diligence (SDD)

SDD is a **reduction, never an elimination**, and is permitted only where a
documented risk assessment supports a low-risk classification.

**Permitted reductions:** delayed verification of identity after the
relationship begins; acceptance of a beneficial-ownership declaration without
independent verification; reduced periodic-review frequency; source of funds not
required unless suspicion arises.

**SDD is never available where** the customer is a PEP or related to one; the
transaction is at or above **AED 55,000**; there is any suspicion of ML/TF/PF;
the customer is connected to a high-risk jurisdiction; or the product, channel
or counterparty is classified high risk.

**Documentation is mandatory even under SDD:** the risk assessment relied on,
which measures were reduced, the basis for the low-risk classification, and the
triggers that would escalate to standard CDD or EDD.

## 5. Enhanced Due Diligence (EDD)

EDD is mandatory for PEPs and their family members and close associates, for
customers connected to high-risk or call-for-action jurisdictions, for
complex or opaque ownership structures, for artisanal or small-scale mined
(ASM) gold from a high-risk jurisdiction, and wherever the score or a trigger
produces an EDD outcome.

EDD measures: senior management approval to establish or continue the
relationship; establishment of **source of funds and source of wealth** with
supporting evidence; enhanced ongoing monitoring; and a shortened periodic
review cycle.

## 6. PEP handling

PEP status is a **risk factor, not a prohibition** — but it removes SDD, forces
EDD, and requires senior-management sign-off. Screening covers domestic and
foreign PEPs, international organisation officials, and their relatives and
close associates. A PEP determination and its basis are recorded on the file;
so is a decision that a screening hit is a false positive, with the analysis
that supports it.

## 7. Ongoing monitoring and periodic review

| Risk rating | Review frequency |
|---|---|
| High / EDD | Every 6 months |
| Medium | Annually |
| Low / SDD | Every 2 years, or on trigger |

A review is also triggered by: a change in beneficial ownership; a sanctions or
adverse-media hit; a transaction inconsistent with the profile; a change in the
customer's jurisdiction or business; or any escalation from front office.

Transaction-side monitoring obligations sit in
[`transaction-monitoring-reporting-policy.md`](transaction-monitoring-reporting-policy.md).

## 8. Failure to complete CDD

Where CDD cannot be completed: do not establish or continue the relationship, do
not execute the transaction, consider whether the failure itself gives grounds
for suspicion, and refer to the MLRO. A customer's refusal to provide
beneficial-ownership information is itself a red flag.

## 9. Records

Every CDD file retains the identification and verification evidence, the risk
assessment and rating, screening results (including cleared hits and the reason
they were cleared), source-of-funds/wealth evidence where obtained, senior
management approvals, and the periodic review history — for at least five
years after the relationship ends.

## 10. Approval

| Field | Value |
|---|---|
| Approved by (Board) | ☐ |
| Date of approval | ☐ |
| Next review due | ☐ (12 months from approval) |
