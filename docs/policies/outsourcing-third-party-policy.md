# Outsourcing & Third-Party Risk Policy

**Owner:** MLRO (accountable) · Compliance Engineering (operational)
**Approver:** Board of Directors
**Status:** DRAFT — for Board approval (open-actions item 18)
**Version:** 0.1 · **Review cadence:** annually, and on any new processor, service or material change to an existing one.

**Regulatory basis:** Federal Decree-Law No. 10 of 2025 · Cabinet Resolution
No. 134 of 2025 (internal controls; reliance on third parties) · Federal
Decree-Law No. 45 of 2021 (PDPL, where personal data is processed).

---

## 1. Principle

The firm may outsource a task. It cannot outsource the obligation. Where a third
party performs a compliance function, or processes data the firm is responsible
for, accountability stays with the MLRO and the Board.

## 2. Before engagement

1. **Due diligence** on the provider: legal identity, ownership, licensing,
   sanctions and adverse-media screening, and — for anything touching customer
   data — its security and privacy posture.
2. **Risk assessment**: what breaks if this provider fails, leaks or is
   compromised; whether a compliance obligation depends on it; what the exit
   route is.
3. **Contract**: scope, service levels, audit and information rights, security
   obligations, breach notification, sub-processing limits, data location, and
   termination and return-of-data terms. A **DPA** where personal data is
   processed.
4. **Approval**: senior management for material engagements; MLRO for anything
   in the compliance chain.
5. **Registration** in [`../aims/third-party-register.md`](../aims/third-party-register.md)
   with data shared, direction of flow, safeguard and DPA status — and, where
   the provider is technically reachable by the platform, in
   [`../governance/tool-connector-register.md`](../governance/tool-connector-register.md)
   with its credential, egress host and kill switch.

## 3. Reliance on a third party for CDD

Where the firm relies on another party's CDD, it obtains the underlying
information immediately, satisfies itself that the records will be produced on
request without delay, and records the basis for the reliance. **Ultimate
responsibility for CDD stays with the firm** — reliance is never a defence.

## 4. Know Your Supplier (KYS)

Suppliers of gold and precious metals are a distinct category with its own
diligence, tiering and provenance requirements set out in
[`responsible-sourcing-policy.md`](responsible-sourcing-policy.md). This policy
governs service providers and processors; that one governs the physical supply
chain. A counterparty that is both is assessed under both.

## 5. Ongoing management

| Control | Cadence |
|---|---|
| Register review (all processors, data shared, safeguards) | Annually, and on change |
| Screening refresh of providers and their owners | Annually |
| Credential rotation for provider access | Quarterly, per the compliance calendar |
| DPA and residency confirmation | On engagement; re-confirmed annually |
| Concentration and exit-risk review | Annually |

**Current state — stated, not hidden.** Two confirmations are outstanding: the
Asana DPA on file, and Anthropic's written cross-border transfer basis
(open-actions items 2 and 5). Both show as the single KRI currently in breach —
vendor assessment coverage at 71.4% in
[`../governance/grc-metrics.md`](../governance/grc-metrics.md). The number is
published rather than smoothed.

## 6. Exit and failure

Every material engagement has a stated exit path: how the service is replaced,
how data is returned or destroyed, and how long the firm can operate without it.
For platform connectors, the kill switch is recorded per connector and is
testable — degrade loudly, never silently.

## 7. Approval

| Field | Value |
|---|---|
| Approved by (Board) | ☐ |
| Date of approval | ☐ |
| Next review due | ☐ (12 months from approval) |
