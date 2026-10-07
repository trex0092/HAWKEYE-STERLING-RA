# External screening benchmark — Cascade company and vessel name pairs

An **independent** labelled corpus for the sanctions name matcher. The repo's own
benchmark (`test/fixtures/screening-benchmark/`) was written alongside the
matcher. These pairs were not: they measure the matcher against cases it was
never tuned on.

## Source and licence

- `cascade-name-pairs.csv` (300 pairs) and `cascade-name-pairs-2.csv` (185 pairs)
  are copied unmodified from `contrib/opensanctions/` of
  <https://github.com/ArslaneSempai-ui/cascade-screening>, retrieved 2026-10-02.
  The same files are vendored as test data by moov-io/watchman
  (`pkg/search/testdata/`).
- Licence: MIT, Copyright (c) 2026 Arslane Chaouche — full text in
  `LICENSE-cascade-name-pairs`. The MIT licence covers only these files; the rest
  of the upstream repository is under a different licence and nothing else from it
  is used here.
- SHA-256 at retrieval:
  - `cascade-name-pairs.csv` `5c225b06bc1b1d6743b8569b4f9b6e9c15a3b6f8edb3b88f1c3ed87a84b54b72`
  - `cascade-name-pairs-2.csv` `ede72aaf261e9f71bb80ed2c0d2d13aeb9bb44dc36ff21d6594cb88e25f44676`

Upstream's own disclosures, repeated so a reader can weigh them:

- Lot 1: up to four pairs for each of the 75 most frequent error types, picked
  from the author's authored pair sets.
- Lot 2: 100 of the 185 pairs were written by two language-model agents (Hebrew,
  Burmese); every pair was then reviewed blind, and pairs naming a real
  sanctioned person or real registered companies were removed.

These are company and vessel names written as test cases, not customer data.

## How it is scored

`scripts/external-benchmark.mjs` screens `name1` against an index holding only
`name2` (the single-entry protocol the internal benchmark uses) through the
production JS matcher, `scripts/sanctions-match.mjs`. A pair "hits" when the
matcher raises a list hit.

- **Recall**: matching pairs (`is_match=true`) that hit.
- **Negative clear**: non-matching pairs that do not hit.

## Floors

`floors.json` pins the counts measured when the corpus was added (2026-10-02).
Both floors ratchet up only, the same rule as the internal benchmark: a matcher
change may not lose a true pair it caught, nor start flagging a non-match it
cleared. The floors record where the engine stands today; they are not a quality
target. Lot 2 is low mainly because the matcher does not transliterate Hebrew or
Burmese script. Only the JS engine is measured here.
