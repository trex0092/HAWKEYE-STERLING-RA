# ADR-005 — Dual-Engine Matcher (Python + JS), Parity-Locked

**Status:** Accepted under review (recorded retroactively 2026-08-04; the
consolidation question is register item 27) · **Owner:** Maintainer ·
**Revisit:** §4, tightened by the §5 addendum (2026-09-09).

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

## 5. Addendum — 2026-09-09

**A revisit trigger has already fired.** This ADR was recorded 2026-08-04
citing five parity-repair PRs (#360, #362, #363, #364, #373). A **sixth**,
#421 ("four verified engine-agreement recall fixes"), merged **2026-08-06**
— two days later — plus two earlier matcher PRs (#349, #353) not counted in
the original tally. `screen.py` has grown from 5,913 to **6,918 lines**
(+17%) over the same one-month window. The "keep both, revisit at
2027-06-30" plan is drifting faster than it assumed; §2's two standing rules
(parity is CI-enforced, recall is monotone) have held — no divergence has
reached production — but the *authoring* tax keeps recurring, which is what
this ADR predicted would be the paid cost, not a failure of the rules.

**Decision, made now rather than deferred again:** full decomposition or
consolidation stays out of scope for this session — it is correctly framed
in the register as a project, and attempting it inside a live AML/CFT
screening engine without the dedicated test/rollback runway that scale of
change needs would be irresponsible. Instead, the interim posture changes
from *passive* ("keep both, revisit later") to *active reduction of shared
surface area*:

1. **Every future parity fix must ask first whether the corrected logic can
   move to shared, engine-agnostic data** (the precedent is
   `data/translit-groups.json`, which #364 already extracted for the
   phonetic tables) **before it is patched twice in code.** Not every fix
   qualifies — some are algorithmic, not data-shaped — but the question
   must be asked and the answer recorded in the fix's PR description.
2. **The revisit trigger is moved up and made concrete**, replacing the
   single fixed date: consolidation planning becomes mandatory (register
   item 27 re-scoped from "long term" to "medium term") on **whichever comes
   first** of (a) a **seventh** parity-repair PR, (b) `screen.py` crossing
   **7,500 lines**, or (c) the original 2027-06-30 date. This is checkable
   without judgment calls — the next parity PR or the next line-count
   measurement either trips it or it does not.
3. This addendum does not re-sign the ADR's core decision (§2's rules are
   unchanged and still CI-enforced); it tightens the off-ramp because the
   evidence gathered since §4 was written shows the original date was
   optimistic, not wrong in kind.

**Owner of the moved-up trigger check:** Compliance Engineering, verified
mechanically (`git log --oneline | grep -cE '^\w+ (Matcher:|Parity:)'` and
`wc -l screen.py` are both one-line checks) at each `screen.py`-touching PR
review, not on a calendar.
