# Information for Interested Parties (AIMS A.8.2)

The information the firm makes available to interested parties about its AI system — what it
is, what it does and does not do, how data is handled, and how to raise a concern. This is the
**outward-facing transparency statement**; the internal stakeholder analysis is in
[`interested-parties.md`](interested-parties.md). **Owner:** MLRO / DPO. **Date:** 2026-06-29.
Review: annually + on material change. Also surfaced as the on-screen transparency notice in
`advisor.html`.

## What the system is
Hawkeye Sterling is an **AML/CFT screening and decision-support** platform for a UAE dealer in
precious metals and stones (DPMS). It screens customers and their beneficial owners against
sanctions lists, adverse media, and PEP sources, produces an explainable risk rating, and
offers an MLRO Advisor for compliance research.

## What it does — and does not — do
- It **supports** human decisions; it does **not** make them. Every disposition is made and
  signed by the MLRO/Compliance Officer.
- It does **not** auto-file reports, freeze accounts, or decline customers.
- It does **not** fabricate data: reports are deterministic, and the optional AI step only
  classifies text that is supplied to it, with sources shown.
- It flags possible matches and gaps for human verification; **absence of a flag is not a
  clearance**.

## How personal data is handled
- **Minimisation:** by default no customer data leaves the processing runner. The optional LLM
  step receives only a **subject name + a single public headline** — never the full record.
- **Lawful basis:** screening is a legal obligation (UAE FDL; Cabinet 74/2020; FATF R.6/10/12).
- **Privacy:** UAE PDPL applies; assessed in [`ai-impact-assessment.md`](ai-impact-assessment.md)
  and [`pdpl-data-processing-assessment.md`](pdpl-data-processing-assessment.md).
- **Processors:** listed with safeguards in [`third-party-register.md`](third-party-register.md).
- **Retention:** AML records are retained for 10 years as legally mandated
  ([`../governance/data-retention.md`](../governance/data-retention.md)).

## Fairness & limitations
- Name-matching is tested for **cross-script recall parity** so non-Latin (Arabic/Turkish)
  names are not under-screened ([`bias-fairness-testing.md`](bias-fairness-testing.md)).
- Matching is **high-recall by design** — possible matches require human verification; same-name
  individuals may be surfaced and must be disambiguated by the reviewer.
- The Advisor's training-data knowledge is **not a live source**; cited bases must be verified
  against the primary source.

## Data-subject rights
Rights are handled under the firm's PDPL procedures. Certain erasure/access rights are limited
where AML retention is legally mandated. See [`ai-impact-assessment.md`](ai-impact-assessment.md) §6.

## Raising a concern
Operators and stakeholders report suspected failures, bias, or privacy concerns via the channels
in [`stakeholder-feedback.md`](stakeholder-feedback.md) and, for incidents,
[`../governance/ai-incident-runbook.md`](../governance/ai-incident-runbook.md). Regulators and
auditors are supported by the audit trail and this document pack.

## Governing documents
[`ai-policy.md`](../governance/ai-policy.md) · [`ai-acceptable-use-policy.md`](../governance/ai-acceptable-use-policy.md)
· [`../AI-GOVERNANCE.md`](../AI-GOVERNANCE.md).
