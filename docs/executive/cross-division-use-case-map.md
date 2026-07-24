# Cross-Division Use-Case Map — Porting the Platform Patterns

What this estate proves is not "a screening tool": it is a set of governed-AI
patterns — deterministic core + gated LLM assist, HITL on operative decisions,
frozen golden sets, eval scorecards, evidence trails, MRM tiering — running in
production under regulatory consequence. This map shows where each pattern
lands in the corporate-finance divisions of a bank or large firm.
**Illustrative port map, not a claim of deployment. Owner: MLRO / Compliance
Engineering.**

## 1. Pattern → division

| Division | Use case | Pattern ported | The control that makes it deployable |
|---|---|---|---|
| **Treasury / Payments** | Pre-release payment sanctions screening | The matcher pattern: fuzzy match + refuse-to-clear + MANUAL REVIEW routing + [champion/challenger thresholds](../governance/champion-challenger-thresholds.md) | A payment never clears on a failed list load; threshold changes only via change control |
| **FP&A** | LLM-drafted variance commentary & board narratives | Advisor pattern: grounded corpus + [citation guard](../governance/citation-accuracy-metric.md) + behavioural evals | Commentary cites source figures or blocks; evals catch drift release-to-release |
| **Internal Audit** | Continuous control monitoring | [Assurance coverage matrix](../governance/assurance-coverage-matrix.md) pattern: control → automated proof → evidence, with known-gaps stated | Audit consumes evidence continuously instead of sampling annually |
| **Procurement / Finance Ops** | Supplier due diligence & invoice anomaly flags | KYS + risk-scoring engine pattern (per-factor explainable score, one-way analyst override) + TBML-style red flags | Every score decomposes for the buyer and the auditor; overrides ratchet up only |
| **Corporate finance / Risk** | Governance of forecasting & valuation models | [MRM framework](../governance/model-risk-management-2026.md): inventory, tiering, validation independence, [backtesting](../governance/backtesting-protocol-2026.md), [PSI](../aims/population-stability-monitoring.md) | Same CBUAE-MMS/SR 11-7 skeleton, different model inventory |
| **HR / Conduct (adjacent)** | Adverse-media monitoring for senior-hire vetting | Adverse-media pattern: two-feed sweep, typology buckets, injection-hardened triage, evidence log with retention | "Silence is never evidence" degradation alarms; every finding is human-decided |

## 2. What transfers as-is vs what re-scopes

**As-is:** the CI-enforced golden-set discipline; egress-blocked runners;
encrypted state branches; the register discipline (one owner per open item);
eval scorecard mechanics; the delegation split (prepare vs decide).

**Re-scopes per division:** the model inventory and tiers (each division's
consequence table differs); data-protection basis (PDPL rows re-assessed per
data class); the HITL decision points (who is the "MLRO" of an FP&A
narrative); egress allowlists per data source.

## 3. Why this map exists

Two audiences: (1) internally, it is the expansion backlog — each row is a
candidate second deployment of the platform (see the
[operating model §5](../governance/operating-model.md) scaling trigger);
(2) externally, it answers the cross-functional question honestly — the
divisional experience is the operator's biography, but the *patterns'
portability* is demonstrable from this estate, row by row.
