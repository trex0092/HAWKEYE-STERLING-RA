# KRI Breach Ledger

**Every time a key risk indicator crossed its line, who was told, and what
happened next.** A dashboard shows the current value; this page shows the
history — which is the only way to tell a one-off from a trend, and the only
way to show an examiner that a stated escalation path was actually walked.

**Owner:** MLRO (with Compliance Engineering) · appended on every breach and
every return to green.
**Current values:** [`data/grc-metrics.json`](../../data/grc-metrics.json) —
generated, never hand-edited.
**The lines themselves:** [`data/risk-appetite.json`](../../data/risk-appetite.json)
(`kris[]`), published in [`risk-appetite-statement-2026.md`](risk-appetite-statement-2026.md).

> **Why this is a markdown file and not part of the snapshot.**
> `data/grc-metrics.json` is regenerated from the repository on every run and is
> byte-compared by CI, so it can carry no history and no timestamp — a snapshot
> that changed on every run would train everyone to ignore the drift check. The
> ledger is the other half: the snapshot says *where the number is now*, this
> says *where it has been*.

> **Append-only.** Rows are added, never rewritten. A breach that was later
> found to be a measurement error is closed with a row saying so — the original
> stays. Same rule as the [evaluation scorecard](eval-scorecard.md) §2: never
> rewrite history, and a ❌ must carry its follow-up.

---

## 1. How a row gets here

1. `scripts/grc-metrics.mjs` evaluates every instrumented KRI against its
   threshold on each run. The result reaches `data/grc-metrics.json` as
   `breached: true` (red), `amber: true` (warning band crossed, red line not
   yet), or both false.
2. A red line crossed is escalated per the `escalation_sla` of the appetite
   position the KRI measures — carried into the snapshot beside each KRI, so the
   recipient and the clock are visible where the breach is.
3. The MLRO records the breach here with its follow-up, and records the return
   to green when the metric recovers. An open row with no follow-up is itself a
   finding at the next management review.

**Amber is a signal, not a breach.** It is logged in Section 3, not Section 2,
and it carries no SLA — its purpose is to be seen before the SLA starts. Amber
exists only for KRIs whose red line has headroom: a threshold of 0 or 100% has
none by construction, so those KRIs have no warning band and none is invented
for them.

## 2. Breach ledger

Both opening rows are dated **2026-07-29**, the day this ledger was created.
Neither breach began that day — KRI-04 has been red for as long as the vendor
coverage metric has existed, and KRI-10 measures a condition the risk register
has carried since it was written. The dates say when the breach was first
*recorded*, and this note says so rather than backdating a row nobody wrote.

| Date opened | KRI | Metric | Value vs line | Owner told | Follow-up | Date closed |
|---|---|---|---|---|---|---|
| 2026-07-29 | KRI-04 | `thirdPartyAssessmentCoverage` | 71.4% vs ≥ 100% | MLRO / DPO | Two vendors in the [third-party register](../aims/third-party-register.md) carry an unconfirmed safeguard position. Closing act is the DPA pack and counsel's PDPL transfer-basis confirmation — [open actions](open-actions-register.md) items 5 and 11. The affected paths are gated OFF, per RA-04, rather than running on an undocumented basis | open |
| 2026-07-29 | KRI-10 | `residualAboveAppetite` | 1 vs ≤ 0 | MLRO | **R-03 (sanctions false negative)** carries residual **10 Medium** against RA-01's ceiling of **6**, the Low band a ZERO appetite allows. The treatment recorded in the [risk register](../aims/ai-risk-register.md) — threshold tuning and MLRO four-eyes — has an owner and a quarterly cadence but **no target date**, so it does not yet meet the methodology's own requirement of "a treatment plan with an owner and a date". Same missing input as [open actions](open-actions-register.md) item 17 | open |

> **KRI-10 was breached on the day it was created.** That is the point of it,
> not a defect: the risk register has carried R-03 above a ZERO-appetite
> position since it was written, and nothing measured the fact because no
> position stated a number to measure against. The first act of the measure is
> to surface what was already true.

## 3. Amber (warning band reached, red line not crossed)

| Date | KRI | Metric | Value vs amber | Note |
|---|---|---|---|---|
| 2026-07-29 | KRI-06 | `obligationsWithoutWatchSource` | 1 vs ≤ 0 | ISO/IEC 42001 has no supervisor feed to watch — it is a standards-body publication, so change arrives by revision rather than by circular. Tolerated at the red line (≤ 1); a **second** such obligation means a real blind spot and would breach. Amber is doing its job: the number is at the edge of tolerance with no incident |

## 4. What CI enforces about this page

- **The lines quoted here must be the lines in force.** Every KRI ID and metric
  named above resolves to a KRI in `data/risk-appetite.json`; a renamed or
  deleted KRI fails [`test/grc-metrics.test.mjs`](../../test/grc-metrics.test.mjs).
- **A breach may not be silently un-recorded.** The snapshot's `breached` flags
  are recomputed from the repository on every run and byte-compared; a metric
  cannot be quietly relaxed in one file and left green in another.
- **Uninstrumented KRIs never appear here as passing.** KRI-09 (overdue issue
  rate) is not measurable while no open action carries a target date; it is
  excluded from the breach denominator and reports *null*, never zero.

---

**Related:** [`risk-appetite-statement-2026.md`](risk-appetite-statement-2026.md) ·
[`grc-metrics.md`](grc-metrics.md) ·
[`risk-glossary.md`](risk-glossary.md) ·
[`eval-scorecard.md`](eval-scorecard.md) ·
[`open-actions-register.md`](open-actions-register.md)
