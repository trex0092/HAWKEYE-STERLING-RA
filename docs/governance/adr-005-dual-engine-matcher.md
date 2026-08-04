# ADR-005 — Dual-Engine Matcher (Python + JS), Parity-Locked

**Status:** Accepted under review (recorded retroactively 2026-08-04; the
consolidation question is register item 27) · **Owner:** Maintainer ·
**Revisit:** §4.

Sanctions name matching exists twice: `screen.py` (the engine the scheduled
screens run) and `scripts/sanctions-match.mjs` (the matcher the in-browser
batch screen and several workflows use). They are locked together by
`test/matcher-parity.test.mjs`. This record states why the duplication
exists, what it costs, and the standing rule that keeps it safe.

## 1. Context

- The Python engine needs the matcher inside GitHub Actions with the full
  list-fetch pipeline; the browser needs it with zero runtime dependencies
  (ADR-002) and no server round-trip (ADR-004). No single implementation
  runs in both places without adding a build step or a network hop.
- The two engines drifted repeatedly — PRs #360, #362, #363, #364 and #373
  are all parity repairs (the worst found 19 divergences; one mirror parsed
  to zero entries because it was read in the wrong CSV dialect).

## 2. Decision

Keep both engines **for now**, under two standing rules:

1. **Parity is CI-enforced**: `test/matcher-parity.test.mjs` runs the same
   cases through both and fails on any divergence.
2. **Recall is monotone**: neither engine may lower recall — the benchmark
   floors (`test/fixtures/screening-benchmark/floors.json`) only ratchet up,
   and per-script recall parity is bounded by `test/bias_eval.py`. A change
   that drops a true positive is wrong even when precision improves.

## 3. Consequences

**Gained:** each surface gets a native matcher with no build step and no
server dependency; parity failures surface in CI instead of production.
**Paid:** every matching improvement is written twice and reviewed twice;
the parity suite grows with every fix; five repair PRs in two months is a
measured, recurring tax.

## 4. Revisit triggers

**Register item 27** (target 2027-06-30) owns the consolidation decision as
part of the `screen.py` decomposition. Candidate resolutions: one engine
compiled/transpiled for the other runtime; the browser calling a function
endpoint (costs ADR-004's offline property); or accepting the dual engine
permanently with this ADR re-signed. Earlier triggers: a parity failure that
reaches production, or a third consumer appearing.
