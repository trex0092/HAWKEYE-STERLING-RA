# Transaction-Feed Compensating Control (Manual) — Interim

> **DRAFT — awaiting MLRO adoption.** Prepared 2026-07-24 for open-actions
> register **item 6**. The live transaction feed stays INERT until the four
> [scoping decisions](transaction-feed-scoping.md) (§6) are answered; register
> item 6 allows the alternative of a **recorded manual compensating control**.
> This is that record, ready to adopt. Adopting it closes item 6 *as the
> interim decision* — the §6 questions remain the route to the wired feed.

## 1. Control statement

Until the automated feed is wired, the MLRO (or a delegate per the
[operating model](../governance/operating-model.md) delegation matrix —
preparation only, decision stays with the MLRO) reviews the firm's sales
ledger **weekly** for transactions that would have alerted in
`txn_monitor.py`:

| Check | Rule |
|---|---|
| Cash threshold | Any cash (or cash-equivalent) sale ≥ **AED 55,000**, single or linked series — triggers the CDD/EDD refresh per the methodology and the FDL 10/2025 cash-transaction duties |
| Structuring pattern | Clusters of transactions just below the line (≥ 2 within 7 days at 80–99% of threshold, same customer or linked parties) — treated as one aggregated event |
| Non-cash ≥ AED 55k | Confirm the CDD-trigger alert fired in the app (the #312 fix); record any manual catch-up |
| Third-party payer | Any payment from a party other than the customer of record — routed to KYC review |

Findings route exactly as automated alerts would: KYC review, EDD refresh, or
STR assessment — always an MLRO decision, recorded in Asana.

## 2. Evidence log

One row per weekly review; an empty week is still a row ("nil findings") —
absence of a row is absence of the control, not absence of findings.

| Week ending | Ledger export ref | Transactions reviewed | Findings (threshold / structuring / third-party) | Action taken | Reviewer | MLRO sign-off |
|---|---|---|---|---|---|---|
| _first row on adoption_ | | | | | | |

## 3. Expiry

This control expires the day the wired feed's first monitored run completes
(scoping §5); the final log row records the cut-over. Quarterly, the
management review checks the log's continuity — gaps escalate as a CAPA.

## 4. Adoption (closes register item 6 as the interim decision)

| Adopted as interim control (yes/no) | First review week | Signed (MLRO) | Date |
|---|---|---|---|
| _pending_ | | | |
