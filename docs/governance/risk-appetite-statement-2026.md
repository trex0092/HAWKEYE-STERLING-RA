# Risk Appetite Statement — 2026

**How much risk the firm accepts, expressed as constraints the estate enforces.**

**Owner:** Board (accountable for appetite) · MLRO (operational custodian)
**Source of truth:** [`data/risk-appetite.json`](../../data/risk-appetite.json) (machine-readable; this page is the human view)
**Enforcement:** [`test/grc-metrics.test.mjs`](../../test/grc-metrics.test.mjs) (CI) — the stated appetite must match the appetite the code applies
**Measurement:** [`grc-metrics.md`](grc-metrics.md) · breach history in [`kri-breach-ledger.md`](kri-breach-ledger.md) — the live count of KRIs and how many are instrumented is in [`data/grc-metrics.json`](../../data/grc-metrics.json), not quoted here, because a hand-written count goes stale the moment a KRI is added
**Review cadence:** annually, and on any material change to the methodology, the estate or the regulatory perimeter.
**Status:** **DRAFT — for ratification as resolution R7** at the sitting in [`board-minute-template-2026-07.md`](board-minute-template-2026-07.md) (open-actions item 17).

> **What this document is not.** It does not grant tolerance the controls do not
> already give. Every position below states an appetite the estate *already*
> enforces in code, so ratification is the Board adopting a description of the
> operating reality — not signing up to a new one. Where the Board wants a
> different appetite, the control changes first and this page follows.

---

## 1. Appetite positions

| ID | Domain | Position | The line |
|---|---|---|---|
| RA-01 | Sanctions & TFS | **ZERO** | No dealing with a designated party, and no silent clear. An unloadable core list reads DEGRADED rather than passing |
| RA-02 | Customer acceptance | **BANDED** | CDD ≤ 19 · SDD ≤ 22 · EDD above, on the 0–30 score. Prohibited outcomes are never onboarded; diligence may only be raised, never lowered |
| RA-03 | AI in compliance decisions | **ZERO** | No AI decides, files, freezes or records. No model call declares tools; no generative prose enters a filed report |
| RA-04 | Personal data & cross-border transfer | **ZERO** | No personal data to a processor without an executed DPA and a confirmed basis. Unconfirmed means gated OFF, not documented as a risk |
| RA-05 | Prompt & agent change control | **ZERO** | No instruction set reaches production unreviewed; no agent holds an unregistered action |
| RA-06 | Operational resilience | **MEASURED** | Degradation is tolerated. Silent degradation is not |
| RA-07 | Supply chain, secrets & code security | **ZERO** | No secret in git history; no known-vulnerable dependency without a written justification |
| RA-08 | Remediation & audit findings | **LOW** | Findings are a normal output of assurance; carrying them is not. CRITICAL/HIGH findings carry a regression test |

Each position in the JSON names the files that enforce it and the obligations it
serves; CI fails if any of those paths stop existing.

## 1a. From appetite to tolerance — the boundary each position actually has

An appetite position is a *direction*. A tolerance is a **boundary someone is
told about when it is crossed**, which needs three things a direction does not:
a number, a named owner, and a clock. Until 2026-07-29 no position carried any
of the three, which left two of the firm's own written rules unenforceable —
[`../policies/risk-assessment-methodology.md`](../policies/risk-assessment-methodology.md)
§3 (*"residual risk is compared against the appetite; anything above appetite
requires a treatment plan with an owner and a date"*) and the risk register's
own auditor checkpoint (*"residual scores sit within appetite"*). Neither could
be evaluated, because *above appetite* had nothing to be above.

| ID | Position | Residual ceiling | Operational owner | Escalation on breach |
|---|---|:-:|---|---|
| RA-01 | ZERO | **6** | MLRO | Same business day to the MLRO; a confirmed designated-party match goes to the Board immediately |
| RA-02 | BANDED | **12** | MLRO | Five business days to the MLRO; a prohibited outcome onboarded escalates immediately |
| RA-03 | ZERO | **6** | MLRO | Same business day. A model call declaring tools, or generative prose in a filed report, is an *incident*, not a KRI breach to log |
| RA-04 | ZERO | **6** | MLRO / DPO | Same business day to the MLRO and DPO; the path is gated OFF before the escalation, not after |
| RA-05 | ZERO | **6** | Compliance Engineering | Same business day to maintainer and MLRO; unreviewed drift is reverted first, discussed second |
| RA-06 | MEASURED | **12** | Compliance Engineering | Ten business days for a single breach; a sustained anomaly auto-escalates to a GitHub issue on the run that detects it |
| RA-07 | ZERO | **6** | Compliance Engineering | Same business day to the maintainer; a secret in git history goes to the repo owner immediately and triggers the scrub runbook |
| RA-08 | LOW | **9** | MLRO (with Internal Audit) | Next quarterly management review; a CRITICAL/HIGH finding open past its verification escalates to the MLRO within five business days |

**Where the ceilings come from.** They are set on the bands the methodology
already publishes — **Low 1–6 · Medium 7–12 · High 13–25** — by position type,
not risk by risk:

- **ZERO → 6.** Nothing above the Low band is carried without a dated treatment.
- **LOW → 9.** Findings are a normal output of assurance and may sit into the
  lower Medium band while closure holds.
- **BANDED and MEASURED → 12.** Both positions accept risk up to a stated
  boundary rather than minimising it, so the boundary is the top of Medium.

A ceiling is **not a prohibition** and crossing one is **not a failure**. It is
the trigger that converts a carried risk into a treatment plan with an owner and
a date. Every one of the twenty risks in the
[AI risk register](../aims/ai-risk-register.md) is claimed by exactly one
position — CI fails on a risk claimed twice or by nobody — and
`residualAboveAppetite` scores them all on every run.

**One risk sits above its ceiling today: R-03**, the sanctions false negative,
at residual **10 Medium** against RA-01's **6**. Its treatment (threshold tuning,
MLRO four-eyes) has an owner and a quarterly cadence but no target date, so it
does not yet meet the methodology's own test. It is recorded as KRI-10 in the
[breach ledger](kri-breach-ledger.md). The measure was breached on the day it
was created, which is the point of creating it: the condition was already true
and nothing was counting it.

**Capacity is still not stated.** Appetite (how much risk the firm *wants*) and
tolerance (the boundary per position) are now both on this page. **Risk
capacity** — the maximum the firm could absorb before it could not continue
operating — is a firm-level judgement about capital, licence and staffing that
this repository holds no input to. It is named here as a gap rather than left
unmentioned; see [`risk-glossary.md`](risk-glossary.md) §1.

## 2. The customer-acceptance scale

| Band | Score | Meaning |
|---|---|---|
| CDD | 0–19 | Within appetite on the numeric score alone |
| SDD | 20–22 | Simplified/standard handling per the methodology |
| EDD | 23–30 | Enhanced due diligence mandatory |

Three hard rules sit above the score: a prohibit-flagged answer forces
**PROHIBITED** regardless of score; any EDD trigger forces **EDD** regardless of
score; and the analyst override is a **one-way ratchet** — it may only raise the
required diligence, needs a written justification, and never applies to a
prohibited relationship. These cutoffs are parsed out of `app.js` by CI and
compared with the table above, so the statement cannot quote numbers the engine
does not apply.

## 3. Zero-tolerance thresholds carried into the Advisor

The eight thresholds the Advisor is instructed to treat as blocking — confirmed
sanctions hits · CAHRA refinery inputs without OECD documentation · direct
mixer-sourced inbound · four-eyes/SoD violations · FFR filing SLA breaches ·
transactions with no identifiable originator or beneficiary · high-risk EDD
reviews overdue beyond 30 days · unregulated/unlicensed VASP transactions.

The list is mirrored in `data/risk-appetite.json` and CI fails if it diverges
from `ZERO_TOLERANCE` in `netlify/functions/brain-soul.js` in either direction.
Stated appetite and applied appetite cannot drift apart.

## 4. Key risk indicators

Each KRI is tied to a position, to a metric the repository computes, to a named
owner, and to the escalation SLA of the position it measures — the four things
that make it a trigger rather than a chart.

| KRI | Measures | Amber at | Breach when | Owner |
|---|---|---|---|---|
| KRI-01 | Control effectiveness | — | < 100% | Compliance Engineering |
| KRI-02 | Obligations without an owner | — | > 0 | MLRO |
| KRI-03 | Model tool-calling declarations | — | > 0 | Compliance Engineering |
| KRI-04 | Vendor assessment coverage | — | < 100% | MLRO / DPO |
| KRI-05 | Unapproved prompt / agent-capability drift | — | > 0 | Compliance Engineering |
| KRI-06 | Obligations with no change-detection source | > 0 | > 1 | Compliance Officer |
| KRI-07 | Vulnerability suppressions without a justification | — | > 0 | Compliance Engineering |
| KRI-08 | Audit finding closure | < 95% | < 90% | MLRO (with Internal Audit) |
| KRI-09 | Overdue issue rate | — | **not instrumented** — no target dates exist to age against | MLRO |
| KRI-10 | Risks carried above their appetite ceiling | — | > 0 | MLRO (with Internal Audit) |

**Amber is a warning band, not a breach** — it fires before the red line so the
signal arrives before the SLA starts. It exists only where the red line has
headroom: a threshold of 0 or 100% has none by construction, and a warning that
can never fire is worse than none, so those rows read `—` rather than carrying
an invented number.

KRI-09 is deliberately kept and reported as null rather than deleted: an
appetite you cannot yet measure is a gap to state. Instrumenting it means the
Board setting target dates on the open-actions register — the size of that gap
is itself now counted, as `openActionsWithoutTargetDate`.

**Current position:** two KRIs in breach and one amber.

- **KRI-04** (breach) — vendor assessment coverage at 71.4%, driven by the two
  outstanding confirmations (Asana DPA on file, Anthropic counsel
  transfer-basis) already open as items 2 and 5.
- **KRI-10** (breach) — R-03 sits at residual 10 against RA-01's ceiling of 6,
  with a treatment that has an owner and a cadence but no date.
- **KRI-06** (amber) — one obligation with no change-detection source
  (ISO/IEC 42001, a standards body rather than a supervisor feed). Tolerated at
  the line; a second would breach.

Live numbers: [`grc-metrics.md`](grc-metrics.md). Breach history and follow-ups:
[`kri-breach-ledger.md`](kri-breach-ledger.md).

## 5. Framework mapping

| Framework | Clause | How this satisfies it |
|---|---|---|
| ISO/IEC 42001 | 6.1 (risks and opportunities), 5.2 (policy) | Appetite is stated, owned, measured and reviewed |
| ISO 31000 | 5.4.3 (risk criteria) | Criteria published with the scale they are applied on |
| NIST AI RMF | GOVERN 1.3 (risk tolerance) | Tolerance documented and tied to enforcing controls |
| FATF RBA | R.1 | Risk-based acceptance with hard prohibitions above the score |

---

**Related:** [`obligation-register.md`](obligation-register.md) ·
[`grc-metrics.md`](grc-metrics.md) ·
[`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) ·
[`ai-governance-committee-charter.md`](ai-governance-committee-charter.md)
