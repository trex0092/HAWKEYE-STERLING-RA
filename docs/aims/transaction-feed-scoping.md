# Transaction Feed Scoping Note (R-13, FATF R.16)

**Status: scoping only. Nothing is connected, and this note changes no behaviour.**
**Owner of the connection decision:** MLRO and IT, together with the owner of the
firm's sales / ERP / POS system.
**Prepared:** 2026-07-16, every claim verified against `main` HEAD `3b52024`.
**Related:** [`in-domain-aml-coverage.md`](in-domain-aml-coverage.md) (engine
coverage), [`ai-risk-register.md`](ai-risk-register.md) (risk R-13),
[`statement-of-applicability.md`](statement-of-applicability.md) (FATF R.16 row),
Asana task "[AI GOV] P38: Transaction-monitoring live feed, scoping decision".

This note records what a live transaction feed must provide before the
transaction-monitoring engine can be activated, and how the connection must be
secured. It deliberately makes no data-source decision and invents no data:
the source decision belongs to the firm (Section 6), and the engine stays
INERT until a real feed exists.

## 1. Current state (verified)

- `txn_monitor.py` is a deterministic, explainable rules engine covering
  structuring, threshold breaches, velocity spikes, round-amount cash, rapid
  pass-through, high-risk counterparty geography, and the CDD
  occasional-transaction trigger (rule set listed at `txn_monitor.py:215-217`).
- It is INERT in production: `load_transactions()` (`txn_monitor.py:58`)
  returns an empty list until a feed is configured, and the daily report says
  so honestly (`txn_monitor.py:287-289`, wired into the report at
  `screen.py:3607`). Nothing transaction-related reaches a filed report today.
- A configured but unparseable feed is a loud DEGRADED state, never a quiet
  "0 transactions" day (`feed_parse_error`, `txn_monitor.py:43-56`, and the
  DEGRADED status line at `txn_monitor.py:277-280`).
- The rules are unit-tested on synthetic fixtures only
  (`test/engine_test.py:338-349`). No transaction data exists anywhere in the
  platform, and the Asana "First Transaction Date" field is empty across
  records (see `in-domain-aml-coverage.md`, R.16 section).
- Risk register: R-13 "transaction-layer blind spot" stays open at Medium 12
  until a feed is connected (`docs/aims/ai-risk-register.md:27`).

## 2. Required record format (the engine's input contract)

One JSON document containing a list of flat objects. The shape is fixed by the
engine (`txn_monitor.py:17-19` and the loader at `txn_monitor.py:58-70`):

| Field | Type / values | Notes |
|---|---|---|
| `customer` | string | The customer identity as used in the screening platform, stable across records. Rules group strictly by this value, so an inconsistent spelling splits one customer's activity into two invisible halves. |
| `date` | string `YYYY-MM-DD` | Value date. The engine reads the first 10 characters (`txn_monitor.py:72-76`); records with unparseable dates drop out of the date-window rules. |
| `amount` | number | AED. Non-numeric values coerce to 0 (`txn_monitor.py:79-83`), so the export must guarantee numeric amounts; a zero-coerced amount silently weakens every threshold rule. |
| `direction` | `in` or `out` | Case-insensitive (`txn_monitor.py:86-87`). Drives the pass-through rule. |
| `method` | `cash`, `wire` or `gold` | Cash drives the threshold, structuring and round-amount rules. |
| `counterparty` | string | Free text, used in alert narratives. |
| `counterparty_country` | string | Country name; matched lower-cased against the maintained jurisdiction-risk table for the geography rule (`txn_monitor.py:149-164`). |

Contract points the source-system owner must confirm:

- **Currency:** the engine assumes AED throughout. A multi-currency source must
  convert to AED at export time and record the rate source, or the format
  decision must be revisited before connection.
- **Thresholds** are configuration, not code: `DPMS_CASH_THRESHOLD` (default
  55000) and `CDD_TRIGGER_THRESHOLD` (default 15000), both env-overridable
  (`txn_monitor.py:30-31`).
- **Completeness:** the export must contain ALL transactions in the window,
  not a sample. The structuring, velocity and pass-through typologies are
  meaningless on partial data.
- **Zero-day semantics:** a day with no transactions must still produce an
  export (an empty list). A missing file must remain distinguishable from a
  quiet business day, so a feed outage can alarm instead of reading as calm.

## 3. Endpoint contract (what the source system must provide)

Either delivery shape works; the firm's system owner picks one in Section 6.

**Option A: scheduled file export (simplest to operate)**

- A dated JSON export produced by the POS / ledger / ERP system at the agreed
  cadence.
- The landing zone must be PRIVATE storage reachable by the workflow with a
  secret credential: private object storage, an SFTP drop, or a private
  repository. This public repository is not an acceptable landing zone for
  any transaction data, at any point, in any encoding.
- The consuming workflow downloads the file to the runner's ephemeral disk,
  points `TXN_FEED_PATH` at that local path, and runs the engine. Nothing
  transaction-related is written back anywhere.

**Option B: pull API**

- An authenticated HTTPS endpoint returning the record list for a requested
  date window.
- Required properties: TLS; token or key auth (held as a GitHub Actions
  secret); a date-window query parameter so each run fetches exactly its
  window; deterministic pagination if a window can exceed one response; and a
  documented window-complete signal so a partial response is detectable and
  can degrade LOUDLY, matching the existing `feed_parse_error` posture.

**Common to both options**

- **Idempotency:** re-fetching the same window must yield the same records
  once. Duplicated rows inside one export are the failure mode to exclude,
  since every rule would double-count them.
- **Availability signal:** a missed export (outage) must be detectable, per
  the zero-day semantics above.

## 4. Credentials and security constraints

- The feed credential (API token, SFTP key, or storage key) lives ONLY as a
  GitHub Actions secret, with the same handling as `ASANA_ACCESS_TOKEN`:
  never in the repository, never echoed in a workflow log.
- The consuming workflow runs under `step-security/harden-runner` with
  `egress-policy: block`; the feed host must be added to that workflow's
  `allowed-endpoints` list (pattern: `.github/workflows/onboarding-screen.yml:59-78`),
  which keeps every other egress destination closed while the feed host is
  reachable.
- Transaction records are customer personal data under UAE PDPL. They stay on
  the runner's ephemeral disk for the duration of the run and are never
  committed to any branch. The repository is public, and the state-branch
  encryption mechanism is a mitigation for screening state, not a licence to
  store transaction data there. Records are never sent to any third party;
  only the alert lines the MLRO needs (rule, customer, date, amount, detail,
  the shape at `txn_monitor.py:227-230`) reach the Asana report.
- Raw feed files are not retained by the platform. Retention stays in the
  source system; the alerts land in the daily report under the existing
  retention policy.

## 5. Activation plan (a small PR, only after Section 6 is answered)

1. Add the feed fetch step and the `TXN_FEED_PATH` env to the daily screening
   workflow, plus the one egress allowlist entry.
2. Extend the `test/engine_test.py` fixtures if the agreed field mapping adds
   any transformation beyond the Section 2 contract.
3. First supervised run: the MLRO reviews the alert volume before the cadence
   is left unattended. Thresholds are env-tunable if the first run over- or
   under-alerts.

Acceptance evidence: the report's monitoring line flips from INACTIVE to
"ACTIVE, N txns / M customers" (`txn_monitor.py:285-286`), and a deliberately
corrupted staging file produces the DEGRADED line (`txn_monitor.py:277-280`),
proving the loud-failure path end to end before go-live.

## 6. Decisions needed before any connection (open as of 2026-07-16)

| # | Decision | Owner |
|---|---|---|
| 1 | Source system and export mechanism (Option A file export, or Option B API) | Firm sales/ERP owner + IT |
| 2 | Field mapping to the Section 2 contract, and currency handling | Firm sales/ERP owner + MLRO |
| 3 | Landing zone and credential (private storage choice, secret name) | IT + repository owner |
| 4 | Cadence and retention | MLRO |

These mirror the four questions standing on Asana task
"[AI GOV] P38: Transaction-monitoring live feed, scoping decision" since
2026-07-16. None has an answer yet. Until they do, `txn_monitor.py` stays
INERT by design: no connection, no mock data, no fabricated transactions.
