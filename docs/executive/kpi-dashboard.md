# KPI Dashboard (specification + monthly log)

*The metrics management reviews monthly and that feed the ISO 42001 management
review. Source data already exists in the repo; this page defines each KPI, its
source, and holds the running log. Date: 2 Jul 2026.*

## KPI catalogue

| # | KPI | Definition | Source (in repo) |
|---|---|---|---|
| 1 | Assessments completed | Count of completed register entries | app register / Asana mirror |
| 2 | Risk-band distribution | % CDD / SDD / EDD / PROHIBITED | register |
| 3 | EDD rate | % of assessments requiring EDD | register |
| 4 | Screening volume | subjects × lists screened per day | Sanctions Screen run log |
| 5 | New matches | new sanctions/adverse/PEP alerts per period | daily reports / delta state |
| 6 | False-positive rate | MLRO "false positive" dispositions ÷ alerts | Asana dispositions |
| 7 | Processing time | screening run duration trend | `data/run-metrics.json` |
| 8 | Coverage health | lists loaded ÷ expected; degraded days | run log / coverage alarms |
| 9 | AI usage | LLM calls attempted/ok/failed (when enabled) | `ai.LLM_CALLS` in run log |
| 10 | Human-override rate | analyst overrides ÷ assessments | activity log **[needs `[AI]`-accept logging — see roadmap]** |
| 11 | Control effectiveness | green-rate across the 25 controls | daily AI Governance Report |
| 12 | Open audit findings | count from QA gate / reviews | agent audit / management review |

## Rendering
KPIs 4/5/7/8/9/11 are already produced as data by the screening pipeline and the
daily reports. The roadmap item "KPI dashboard automation" renders them to an
auto-committed HTML page from `data/run-metrics.json`; until then this table is
maintained monthly by hand.

## Monthly log
| Month | Assessments | EDD % | Screening vol. (subj/day) | Degraded days | Control green-rate | FP rate | Notes |
|---|---|---|---|---|---|---|---|
| _2026-07_ | _tbc_ | _tbc_ | _tbc_ | _tbc_ | _tbc_ | _tbc_ | first live month |

*Populate from real runs before any external presentation — never present target
values as achieved values.*
