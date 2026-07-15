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
| _next_ | | **first full §4 reconciliation: to be performed and recorded here** | | | | | |

---

*The sample check above verified a sample, not the whole file: the first full
line-by-line reconciliation under §4 remains an open MLRO action and this SOP
is not fully operational until that row is completed.*
