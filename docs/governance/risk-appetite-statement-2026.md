# Risk Appetite Statement — 2026

**How much risk the firm accepts, expressed as constraints the estate enforces.**

**Owner:** Board (accountable for appetite) · MLRO (operational custodian)
**Source of truth:** [`data/risk-appetite.json`](../../data/risk-appetite.json) (machine-readable; this page is the human view)
**Enforcement:** [`test/grc-metrics.test.mjs`](../../test/grc-metrics.test.mjs) (CI) — the stated appetite must match the appetite the code applies
**Measurement:** [`grc-metrics.md`](grc-metrics.md) — nine KRIs, eight instrumented
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

Nine KRIs, each tied to a position and to a metric the repository computes.

| KRI | Measures | Breach when |
|---|---|---|
| KRI-01 | Control effectiveness | < 100% |
| KRI-02 | Obligations without an owner | > 0 |
| KRI-03 | Model tool-calling declarations | > 0 |
| KRI-04 | Vendor assessment coverage | < 100% |
| KRI-05 | Unapproved prompt / agent-capability drift | > 0 |
| KRI-06 | Obligations with no change-detection source | > 1 |
| KRI-07 | Vulnerability suppressions without a justification | > 0 |
| KRI-08 | Audit finding closure | < 90% |
| KRI-09 | Overdue issue rate | **not instrumented** — no target dates exist to age against |

KRI-09 is deliberately kept and reported as null rather than deleted: an
appetite you cannot yet measure is a gap to state. Instrumenting it means the
Board setting target dates on the open-actions register.

**Current position:** one KRI in breach — **KRI-04**, vendor assessment coverage
at 71.4%, driven by the two outstanding confirmations (Asana DPA on file,
Anthropic counsel transfer-basis) that are already open-actions items 2 and 5.
Live numbers: [`grc-metrics.md`](grc-metrics.md).

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
