# Citation-Accuracy Metric — Advisor Grounding

The Advisor's answer to hallucination risk is grounding: cite the approved
corpus or say so plainly. The CI **citation guard** already enforces the
mechanics; this note promotes it from a pass/fail plumbing check to a
**reported metric with a target**, so grounding quality is citable over time
in the [eval scorecard](eval-scorecard.md). **Owner: MLRO / Compliance
Engineering · reported per release.**

## 1. Definition

**Citation-resolution rate** = citations resolving to an entry in the approved
citation corpus ÷ all citations emitted, measured over the behavioural-eval
question set and any sampled production transcripts.

**Target: 100% — hard merge gate.** A non-resolving citation is a grounding
defect (treated like a wrong answer, not a formatting nit).

Companion indicator: **unsupported-assertion findings** — behavioural-eval
regressions filed for answers that assert regulatory content without citing.
Target: zero open at each release; any open finding is listed in the release
row of the scorecard.

## 2. Current state — honest

The guard runs in CI today with a **standing exemption** covering the 160-row
citation migration ([worklist](../aims/advisor-citation-migration-worklist.md))
that is with counsel — open-actions register **item 5**. While the exemption
stands, the guard cannot claim the 100% gate: rows under migration are skipped,
so the effective coverage is partial and the metric is reported **with the
exempt count alongside** (e.g. "100% of covered · 160 rows exempt"). When
counsel's mapping returns and the exemption drops, the gate becomes absolute
and this section is deleted.

## 3. Reporting rules

- Each release row in the [eval scorecard](eval-scorecard.md) records:
  resolution rate, exempt-row count (until §2 closes), and open
  unsupported-assertion findings.
- A drop below 100% on covered rows blocks the release (CI); the fix lands
  before the release row is written.
- Corpus changes (adding/retiring citable sources) go through the same
  CODEOWNERS review as the governance pack — the metric is only as honest as
  the corpus it resolves against.
