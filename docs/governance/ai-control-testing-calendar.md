# AI Control Testing Calendar

**Owner:** MLRO  
**Coordinator:** Compliance Engineering  
**Control source:** [`data/ai-controls.json`](../../data/ai-controls.json)  
**Related framework:** [Enterprise AI Governance six-layer crosswalk](enterprise-ai-governance-6layers-2026.md).

This calendar consolidates the existing test cadences. It does not invent evidence for a cycle that has not run. Scheduled controls are evidenced by workflow/run history; human reviews are evidenced only by a completed review, minute, audit record or signed decision.

## Continuous / per change

| Control activity | Evidence |
|---|---|
| AI asset inventory drift | `test/ai-assets.test.js` |
| Prompt fingerprint/change control | `test/prompt-register.test.mjs` |
| Tool/connector authorization drift | `test/tool-register.test.mjs` |
| Enterprise control-register integrity and generated views | `node scripts/ai-governance-controls.mjs --check` |
| Policy-register ownership/approval consistency | `test/policies.test.mjs` |
| Security scanning | CodeQL, Semgrep, Fortify, gitleaks, dependency review |
| Assurance evidence path integrity | GRC metrics + enterprise control-register validation |

## Daily

| Control activity | Evidence |
|---|---|
| Mandatory control freshness | `.github/workflows/freshness-check.yml` |
| Governance operating-effectiveness report | `scripts/governance-report.mjs` |
| Runtime screening/control health | Screening/runtime assurance workflows and state evidence |

## Weekly

| Control activity | Evidence |
|---|---|
| Advisor live behavioural evaluation | `scripts/advisor-eval.mjs` / Advisor Eval workflow |
| Governance summary and operational trend review | Existing weekly reporting workflows |

## Quarterly

| Control activity | Evidence / required record |
|---|---|
| AI asset/control register review | Updated register metadata and PR |
| AI risk-register review | `docs/aims/ai-risk-register.md` |
| Bias/fairness review | `scripts/advisor-bias-eval.mjs`, bias review log |
| Provider/vendor assurance review | Third-party register and outstanding conditions |
| Access/tool/connector review | Tool & connector register plus permission review |
| Prompt/model change review | Prompt register and model-validation sign-off |
| Management review inputs | GRC metrics, CAPA, open actions, incidents and evaluation results |

## Annual

| Control activity | Evidence / required record |
|---|---|
| AI Policy and AUP review | Policy register + ratification record if changed |
| Internal audit programme execution | `docs/aims/internal-audit.md` audit record |
| AI incident tabletop / runbook exercise | Incident-runbook exercise record and any CAPA |
| BCP/vendor-exit exercise | AIMS BCP evidence |
| Enterprise framework review | Six-layer crosswalk, NIST/ISO/UAE mappings |
| External assurance decision | Board/MLRO decision whether to commission independent review/certification |

## Event-driven triggers

Run an out-of-cycle review when:

- a new AI surface, provider, model family or tool is introduced;
- personal/confidential data flow changes;
- a material prompt charter changes;
- a HIGH or repeated MEDIUM incident occurs;
- a control or scheduled workflow misses its expected cadence;
- a regulator/framework change affects the control boundary;
- a vendor materially changes terms, processing, security or availability.

## Evidence rule

A scheduled date is not evidence. A test is complete only when its run/result is retained. A human review is complete only when the named human decision is recorded. The generated dashboard therefore distinguishes implemented repository controls from outstanding human/external assurance work.

