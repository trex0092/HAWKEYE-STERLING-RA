# Curated Sanctions List Update SOP (EOCN Local Terrorist List)

**Owner:** MLRO (accountable) · Compliance Engineering (tooling support)
**Applies to:** every curated in-repo designation list, primarily
[`data/eocn-local-terrorist-list.json`](../../data/eocn-local-terrorist-list.json)
(UAE Local Terrorist List, a TFS freeze-duty list), and the SECO / DFAT curated
files when enabled (`data/seco-curated-list.json`, `data/dfat-curated-list.json`).
**Why this exists:** these lists have no free machine-readable feed, so their
currency depends on a HUMAN update procedure. Screening is automated; the list
maintenance is not. This SOP is the written procedure that was previously
missing, and the evidence log in §7 is where each update and reconciliation is
recorded.

---

## 1. Update triggers (any one of these starts §3 within 24 hours)

| Trigger | Source |
|---|---|
| Official update notification | EOCN / UN list-update notification service subscription (register item P18; until confirmed, the compensating detections below apply) |
| Mirror cross-check alarm | The daily screen's EOCN mirror cross-check reports designations present on the external mirror but missing locally (report section ⑤ / run log "EOCN CROSS-CHECK ALARM") |
| Review-age alarm | The screen fails with "EOCN REVIEW OVERDUE" when `lastReviewed` is older than `EOCN_REVIEW_MAX_AGE_DAYS` (default 7 days) |
| Sanctions Watch change alert | A watch task/issue reporting a designation-list change |

## 2. Roles

- **MLRO:** performs or approves every list change; signs the evidence log.
- **Compliance Engineering:** maintains the tooling (cross-check, alarms,
  schema tests); reviews the PR mechanics.
- Four-eyes: the list change is made in a pull request; the merge is the
  second pair of eyes. Never edit the list directly on the default branch.

## 3. Update procedure

1. Download the current official publication (EOCN Local Terrorist List from
   the official portal, https://www.uaeiec.gov.ae). Record the publication
   date shown on the official notice.
2. Compare against `data/eocn-local-terrorist-list.json` `entries`:
   - add newly LISTED individuals/entities (plain string, or
     `{"name": "...", "aliases": ["..."]}` for known AKAs);
   - remove DELISTED parties (the file intentionally carries listed parties
     only);
   - keep names in the Latin transliteration used by the official publication.
3. Update the metadata in the same edit: `count` (must equal the number of
   entries), `lastReviewed` (today, YYYY-MM-DD). A review with no changes still
   updates `lastReviewed`: that field is the evidence the review happened.
4. Open a pull request; CI validates the file shape
   (`test/data-schema.test.js`). Merge after review.
5. Verify the next scheduled screen runs green and its report shows the new
   entry count; on a new designation, confirm the re-screen result for the
   affected name and record the TFS timeline (publication date from step 1,
   ingestion = merge time, re-screen = next successful screen run).
6. Add a row to the evidence log (§7).

## 4. Full reconciliation procedure (line-by-line, both directions)

Run at least quarterly, and after any period where the review-age alarm fired:

1. Export the entries: `python3 -c "import json;
   print('\n'.join(sorted(n if isinstance(n,str) else n['name'] for n in
   json.load(open('data/eocn-local-terrorist-list.json'))['entries'])))"`.
2. Compare line-by-line against the full official publication, BOTH ways:
   - every officially listed party present locally (missing = false-negative
     exposure: fix immediately);
   - every local entry still officially listed (extra = stale entry: remove).
3. The daily mirror cross-check only alarms in the missing-locally direction;
   the reconciliation covers both directions and uses the official
   publication, not the mirror.
4. Record the result in §7 with counts checked in each direction, differences
   found, and actions taken. Update `lastReviewed`.

## 5. Cadence and thresholds

- Update within **24 hours** of any §1 trigger (TFS updates apply without
  delay; the daily screen picks up the merged list on its next run).
- Review currency: `lastReviewed` must never exceed
  **`EOCN_REVIEW_MAX_AGE_DAYS` (default 7) days**; the screen hard-fails past
  that age.
- Full two-direction reconciliation (§4): at least **quarterly**.

## 6. Related controls

- Review-age gate + mirror cross-check: `screen.py`
- Coverage floor on the loaded list: `screen.py` (`CORE_LIST_FLOORS`)
- File-shape validation: `test/data-schema.test.js`
- Change detection on the machine-readable core lists: `scripts/sanctions-watch.mjs`
- TFS update timeline log: `data/tfs-update-log.json` (register item P16)

## 7. Evidence log

| Date | Performed by | Type (update / review / full reconciliation) | Basis (trigger / official notice date) | Entries before → after | Differences found | Action | Sign-off |
|---|---|---|---|---|---|---|---|
| 2026-06-19 | MLRO | review (recorded retrospectively) | `lastReviewed` in the data file | 312 → 312 | n/a | baseline for this SOP | MLRO |
| 2026-07 | MLRO | sample currency check (recorded in the compliance register, 2026-07-14) | register verification | 312 → 312 | 20 of 20 recent designations present; 17 of 17 delistings absent | none required; NOT a full reconciliation | MLRO |
| 2026-07-16 | MLRO (mechanical comparison executed by compliance automation from the official publication supplied by the MLRO; the merge of the recording PR is the MLRO sign-off) | full reconciliation (§4, both directions) | official EOCN Local Terrorist List publication dated 13 Jul 2026 | 312 → 312 | 288 publication decision rows parsed: 261 active listings, 27 de-listings (رفع الإدراج rows). Every active designation matched into the file (0 missing); no de-listed party present in the file (0 stale). One file-side alias spelling had no exact publication match and is retained per §5 (curated file is authoritative for aliases). | none required; `lastReviewed` refreshed to 2026-07-16 | MLRO (PR merge) |
| 2026-08-10 | MLRO (mechanical comparison executed by compliance automation from the official publication supplied by the MLRO; the merge of the recording PR is the MLRO sign-off) | full reconciliation (§4, both directions) | official EOCN publication supplied as `LS_130923_2026.pdf` (12 pages, PDF creation stamp 2026-05-12; carries designations through Cabinet Decision No. (63) of 2026). Also closes the 2026-08-01 mirror-derived entry, which was recorded as pending confirmation against the official publication | 619 → 619 | Parsed by section and by ROW ORDINAL, so coverage is measured against the publication's own numbering rather than a name sample: listed individuals 1–171, organisations 1–75, entities 1–65 = **311 listed parties, every ordinal present, no gaps**; de-listing sections: removed individuals 1–19, removed entities 1–8 = **27 de-listed**. Direction 1: all 311 listed parties matched into `entries`, including every alternate rendering carried in the same publication cell (individual #108 `HAZEM MOHSEN FARHAN + HAZEM MOHSEN AL FARHAN`; individual #121's three Khanfurah spellings) — **0 missing**. Direction 2: none of the 27 de-listed parties present — **0 stale**. Names compared through the engine's own `normalizeName`, so the check reflects what the matcher keys on. | none required; no entry added, changed or removed; `lastReviewed` refreshed to 2026-08-10 | MLRO (PR merge) |

## 8. Internal firm watchlist (same procedure, different list)

[`data/internal-watchlist.json`](../../data/internal-watchlist.json) — names the
firm designates **internally** (declined customers, known fraud counterparties,
court/police notices, exited relationships) — is maintained under **this same
SOP**: every change lands via a four-eyes PR, `count` must equal the entries,
and `lastReviewed` is bumped on every review. Differences from the official
curated lists:

- **Optional by design.** Empty `entries` is a valid state ("no internal
  designations") and never degrades coverage — both engines report it
  informationally (`optional: true` in `data/sanctions-extra.json`;
  supplementary tier in `screen.py`). Official curated lists keep the opposite
  fail-safe: empty = DEGRADED.
- **Not a TFS list.** A hit is an internal control outcome routed through the
  ordinary [alert decision tree](../user-guides/alert-investigation-decision-tree.md)
  — never the [TFS name-match procedure](tfs-name-match-procedure.md), and it
  triggers no freeze duty by itself.
- **Review cadence:** with the annual internal-watchlist review duty in
  `data/compliance-calendar.json`, and on any addition/removal event.

---

*First full §4 reconciliation completed and recorded 2026-07-16; most recent
2026-08-10. The next is due per the §1 triggers or the weekly review window,
whichever comes first.*
