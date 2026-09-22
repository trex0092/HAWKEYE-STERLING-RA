# Sharded screening — design (NOT YET BUILT)

**Status: design only. No code implements this.** It exists so the work can be
executed without re-deriving it, and so the hazards found while scoping it are
not rediscovered the hard way.

## Why

The adverse-media net collapses on every daily run. From `weekly-adverse-media`
run 31479768870 (2026-08-11), and identically in the 9 and 10 August logs:

```
10:04:20  enrichment-start          904 subjects, 8 workers
10:05:22  GDELT circuit OPEN        (5 subjects in a row, HTTP 429)
10:34:42  Google News circuit OPEN  (30 in a row at max backoff)
10:41:54  enrichment done           37m23s
```

GDELT dies 62 seconds into enrichment. Google News dies at minute 30 of 37.
Every subject enriched after 10:34:42 has **both** feeds open — no adverse-media
coverage at all. The engine discloses this correctly (that is what the circuit
breakers are for), but the recall is genuinely gone, every day.

More parallelism inside one job cannot fix it: the limit is **per IP**, and one
job is one IP. `pep-shard-harvest.yml` already documents this exact conclusion
for Wikidata — "widening the request window inside ONE job fights the limiter
and has a ceiling" — and solves it by putting each shard on its own runner.

Expected gain: ~8× the per-IP news budget, and enrichment from ~37 min to ~5.

## Shape

Modelled on `pep-shard-harvest.yml`, including the two properties that make it
safe:

- **Dispatch-only and additive.** `weekly-adverse-media.yml` keeps its schedule
  and is not modified. If a sharded run misbehaves, the mandatory daily control
  is untouched and nothing is lost. This is the single most important
  constraint in this document — it is what bounds the blast radius.
- **Shards never share a ref.** Each force-pushes only `screen-shard-<i>`; the
  merge job is the sole writer of `screen-delta-state`, preserving the
  single-writer invariant the daily workflow's concurrency comment depends on.

```
screen-shard.yml  (workflow_dispatch only)
  shard:  matrix [0..7], fail-fast: false
          screen.py with SCREEN_SHARD_INDEX/COUNT, delivers nothing,
          force-pushes screen-shard-<i>
  merge:  needs: shard — reads all 8, REFUSES if any is missing,
          builds one narrative, posts one Asana card, writes delta-state
```

## The shard seam is the CUSTOMER, not the subject

`screen.py` builds `subjects_all` by expanding each customer into a company
subject, its individuals, and its entity owners, and findings are grouped by the
customer's `permalink`.

Slice **`customers[index::count]`**, never `subjects_all`. A subject-level split
would scatter one customer's findings across shards and force the merge to
reassemble them — which is exactly how a card ends up looking complete while a
subject is missing. A customer-level seam keeps every derived subject with its
parent and reduces the merge of findings to a concatenation.

Cost: every shard re-downloads the full sanctions list set (~280 MB). Accepted
deliberately — it buys "each shard is a complete screening of its slice", which
is what keeps the merge simple enough to trust.

## The hazard: aggregates, not findings

`screen_subject_set` (`screen.py`, ~430 lines) runs subject expansion → sanctions
→ enrichment → PEP → delta → AI triage → narrative → delivery → delta-state →
attestation in one pass. Splitting it at the delivery boundary means these
locals cross:

`possible_matches`, `clear`, `adverse_findings`, `pep_findings`, `customers`,
`counts`, `stats`, `list_meta`, `state`, `delta`, `coverage_result`,
`run_result`, `timings`, `mode`, `run_time`

Four of them **combine**; they do not concatenate. This is where a defect would
hide, because the findings would look right while the numbers lied:

| Crossing value | How the merge must treat it |
|---|---|
| `possible_matches`, `clear`, `adverse_findings`, `pep_findings` | concatenate (customer-level seam guarantees no overlap) |
| `counts["subjects"]`, `counts["errors"]` | **sum**; `error_rate` recomputed from the totals, never averaged |
| `coverage_result` alarms/drops | **union**, de-duplicated — one shard's degraded feed degrades the whole run |
| `list_meta` | **assert identical** across shards; differing list counts mean the shards screened against different lists and the merge must refuse |
| `timings` | max (wall-clock), not sum — the shards ran concurrently |
| `state`, `delta` | merge reads delta-state fresh; delta is recomputed against the combined findings, never per-shard |

## Merge refusal conditions — all of them fail the run loudly

1. Any `screen-shard-<i>` ref missing, or older than this run's id.
2. Shard-reported customer counts not summing to the full book.
3. `list_meta` divergent between shards.
4. Any shard reporting it did not finish its slice.

A partial merge must never post a card. An absent shard is not reduced
coverage — it is an unscreened slice of the book, and the report has no way to
say so honestly after the fact.

## Verification before this ships

- `test/fixtures/screening-benchmark/floors.json` — recall must not drop.
  Screening is recall-monotone; the floors only ratchet up.
- `test/matcher-parity.test.mjs` — unaffected, but re-run.
- A shard-vs-whole equivalence test: the same book screened as 1 shard and as N
  shards must yield the same findings set and the same summed counts. This is
  the test that would catch every hazard in the table above.

## Open question for the maintainer

Sharding the **whole** sweep (as designed here) re-downloads the sanctions lists
per shard. Sharding **only enrichment** would avoid that but requires an
enrichment-only entry point and a second state hand-off, which is materially
more pipeline for less clarity. This design takes the first option on the
grounds that when the failure mode is a silent miss, simplicity of the merge is
worth more than bandwidth.
