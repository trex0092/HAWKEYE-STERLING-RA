# Operating Model — Running This Estate at Squad Scale

What this estate looks like as a *team* system: the squad shape it is designed
to be run by, who owns what, and what the accountable owner may delegate and
must not. **Honesty first: today the estate is operated by a single
maintainer with the MLRO accountable** (the enterprise-readiness review says
so) — this document is the designed operating model that the artifact
boundaries already assume, stated so that scaling is a staffing act, not a
redesign. **Owner: MLRO · reviewed at management review.**

## 1. Squad shape (target)

| Squad | Scope (owned surfaces) | Core skills |
|---|---|---|
| **Screening Ops & Data** | `screen.py`, list pipelines, state branches, run health, Asana delivery, [runtime](../aims/runtime-monitoring.md) + [population](../aims/population-stability-monitoring.md) monitoring | Python, data eng, AML ops |
| **Advisor & GenAI** | `ai.py`/`agents.py`, advisor app surfaces, eval harnesses, [red-team](../aims/red-team-log.md), [citation guard](citation-accuracy-metric.md) | LLM eng, evals, prompt security |
| **Governance & Assurance** | `docs/governance` + `docs/aims` packs, registers, [MRM](model-risk-management-2026.md), audit interface, release/provenance controls | GRC, model risk, supply-chain security |

Squads are project-scoped, not permanent silos: a cross-cutting change (e.g.
the #312 deep audit) staffs a temporary strike team across all three, with the
register still naming a single owner per residue item.

## 2. RACI for the recurring processes

R = does the work · A = accountable (one name) · C = consulted · I = informed.

| Process | Screening Ops | Advisor/GenAI | Governance | MLRO | Internal Audit | Board/Committee |
|---|---|---|---|---|---|---|
| Daily screen incident (failed run / degraded coverage) | R | I | I | A | I | — |
| Case disposition (clear / escalate / STR) | C (evidence) | — | — | **A+R** (non-delegable) | I | I (aggregate) |
| Eval regression (behavioural / bias / red-team) | C | R | C | A | I | I |
| List-source change (URL, format, new list) | R | — | C | A | — | — |
| Model change (weights, thresholds, prompts) | R/C by surface | R/C by surface | C (change control) | A (sign-off §5) | I | I (Tier-1) |
| Register & pack upkeep | C | C | R | A | audits | I |
| Quarterly methodology review | C | C | R | A | C | I |
| Release approval | C | C | R | A | — | — |

## 3. Delegation matrix — what the MLRO may hand down

| Delegable to squads | Never delegable |
|---|---|
| Alert triage *preparation* (evidence packs, recommended dispositions) | The disposition decision itself (freeze / decline / report) |
| Threshold *analysis* (champion/challenger evidence) | Threshold *adoption* (change-control sign-off) |
| Drafting of packs, registers, training material | STR/FFR filing decisions and tipping-off judgments |
| Running evals, red-team rounds, monitoring | Accepting a residual risk (register/DPIA rows) |
| Regulator-facing *preparation* | Regulator-facing *representations* |

## 4. Cadences

Daily: run health (Screening Ops, auto-escalated). Weekly: behavioural eval +
ops review. Monthly: PSI read. Quarterly: methodology review, validation
sign-off, bias eval, red-team round, management review. Annual: internal-audit
thematic, index/navigability audit.

## 5. Scaling triggers

Hire/staff a squad when any of: open-case median age > 10 working days
(disposition capacity); more than one Tier-1 model change per month sustained
(change-control load); a second production surface adopts the platform
(cross-division port — see the
[use-case map](../executive/cross-division-use-case-map.md)).
