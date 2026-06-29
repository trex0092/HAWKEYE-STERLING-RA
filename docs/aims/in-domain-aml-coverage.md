# In-Domain AML Coverage — FATF R.10 / R.16 / R.25

Extends the screening control beyond name-only matching into three further FATF
Recommendations. Owner: MLRO / system maintainer.

## FATF R.10 — Customer Due Diligence (identity corroboration) — BUILT
A sanctions/PEP name match is no longer name-only. The structured KYC note in Asana
is parsed (`kyc.parse_customer`) into identity records, and each flagged individual
now carries:
- an **identity dossier** — nationality, date of birth, share %, role, and a
  **masked** ID number (last-3 only) — so the MLRO can compare against the matched
  designation immediately;
- **CDD gap flags** — missing ID / nationality / DOB / proof of address, or an
  **expired** passport / Emirates ID. "Missing" is always surfaced as a finding,
  never treated as satisfied (degrade loudly);
- **jurisdiction risk** — the customer's country + parties' nationalities are
  checked against a **maintained** FATF jurisdiction list
  (`data/jurisdiction-risk.json`): a *call-for-action* (high-risk) nexus raises the
  risk score materially, a *grey-list* nexus nudges it. Empty/unmaintained list ⇒
  neutral (no bump), logged.

Open CDD gaps also feed the risk rating (an alert that can't be cleared on identity
is a real impediment to disposition).

**Maintenance:** `data/jurisdiction-risk.json` must be refreshed after every FATF
plenary (Feb/Jun/Oct). It is decision-support only; it never decides.

## FATF R.25 — Transparency of legal arrangements — BUILT
The KYC parser recognises **legal-arrangement roles** — settlor, trustee,
beneficiary, protector, founder, general/limited partner — and arrangement entity
types (trust, foundation, Stiftung, waqf, fideicomiso, …). When present:
- every arrangement party is screened (sanctions + adverse + PEP), exactly like a
  UBO, and
- a sanctioned/PEP party **flags the whole arrangement** (look-through), shown as a
  "Legal arrangement (R.25)" note on the flagged subject.

For the current book of business (companies with shareholders/directors) this
correctly degrades to a no-op — there are no trust parties to add — but the control
is in place the moment an arrangement is onboarded.

## FATF R.16 — Transaction monitoring — ENGINE BUILT, INACTIVE (no feed)
A deterministic, tested rules engine (`txn_monitor.py`) covering:
- **structuring / smurfing** (multiple cash txns just under the DPMS reporting
  threshold within a window);
- **threshold** breaches (cash ≥ AED 55,000 DPMS reporting threshold);
- **velocity** spikes (a day ≫ the customer's mean daily volume);
- **high-risk counterparty geography** (counterparty country on the maintained
  jurisdiction list);
- **rapid pass-through** (funds in then out within 48h for a similar amount).

**Honest status — no fabricated data:** the platform holds KYC/customer data only;
there is **no transaction feed** (the Asana "First Transaction Date" field is empty
across records). The engine is therefore **INACTIVE in production** —
`load_transactions()` returns `[]` and nothing transaction-related reaches a filed
report — until a real feed is connected via `TXN_FEED_PATH` (POS/ledger export,
bank feed, or goAML transaction file). The engine is fully unit-tested on
**synthetic** fixtures so it is correct and ready the day a feed exists. The report's
§⑤ monitoring block states this status plainly.

**To activate:** export `TXN_FEED_PATH=/path/to/transactions.json` — a JSON list of
`{customer, date, amount, direction "in"|"out", method "cash"|"wire"|"gold",
counterparty, counterparty_country}`. Thresholds are configurable
(`DPMS_CASH_THRESHOLD`, `CDD_TRIGGER_THRESHOLD`).

## Evidence
- Code: `kyc.py`, `txn_monitor.py`; wiring in `screen.py` (identity dossier, CDD
  gaps, jurisdiction risk, arrangement flag, monitoring §⑤).
- Tests: `test/engine_test.py` (R.10 parsing/gaps/jurisdiction, R.25 arrangement
  detection, R.16 rules + inert-without-feed).
- Risk model: `ai.compute_risk_rating` (jurisdiction + CDD-gap factors).
