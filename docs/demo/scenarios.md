# Demo Scenarios

*Scripted, reproducible scenarios for the walkthrough. All names are fictional
(see [`sample-data.md`](sample-data.md)). Expected outcomes describe the engine's
deterministic behaviour; exact scores depend on the current Risk Data baseline.*

## Scenario A — Low-risk domestic dealer (happy path)
- **Entity:** Fictitious Trading LLC (fake), UAE-incorporated, established gold
  retailer, long operating history, transparent ownership, no high-risk nexus.
- **Purpose:** show the clean path and the CDD outcome.
- **Expected:** low aggregate score → **CDD**; no escalations; clean sanctions/
  adverse/PEP; delivers to *HAWKEYE STERLING APP* CDD section.

## Scenario B — Sanctions/control hit (escalation path)
- **Entity:** Mirage Metals FZE (fake) with a beneficial owner whose name matches
  a designated party on a screened list.
- **Purpose:** show escalation, the 50%/control aggregation rule, and that the
  freeze/report action is an **MLRO decision**, not automated.
- **Expected:** score bumped by the control-linkage factor → **EDD** (or
  **PROHIBITED** on a confirmed designation); MLRO decision checkboxes; tokenised
  vs full-detail delivery choice demonstrable.

## Scenario C — Adverse-media pattern (optional, for compliance audiences)
- **Entity:** Horizon Bullion Co (fake) appearing in ≥3 distinct negative stories
  within 90 days (fraud/investigation typology).
- **Purpose:** show the adverse-media classifier, typology bucketing, the
  **repeat-pattern** escalation (EDD + STR assessment), and the committed evidence
  log.
- **Expected:** adverse-media findings with sources/links; repeat-pattern line in
  the report; note the tipping-off caution before any STR discussion.

## Scenario D — Unscreenable subject (fairness/fail-safe, optional)
- **Subject:** an individual with a non-Latin-script or too-short name.
- **Purpose:** show that the matcher routes to **MANUAL REVIEW** rather than
  passing — the fairness/fail-safe behaviour a regulator will probe.
- **Expected:** MANUAL REVIEW marker; the subject is never banded LOW on the
  strength of an auto-clear.

*Run A and B for a general/executive audience (≈8 min); add C and D for a
compliance or audit audience.*
