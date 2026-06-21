# NIST AI RMF 1.0 — Crosswalk (2026)

**Layer 6 — Governance, Compliance & Audit.** Maps the LLM Advisor (and reg-draft) to the NIST AI
Risk Management Framework functions. **Owner:** MLRO · Compliance Engineering. **Date:** 2026-06-21.
Status: ✅ implemented · 🟡 partial · 🔴 open.

> Scope: the **AI** surfaces only (see [`ai-asset-register.md`](ai-asset-register.md)). The
> deterministic RA engine is governed under AML/CFT controls, not as a model.

## GOVERN
| Subcategory | Status | Evidence |
|---|---|---|
| GOVERN 1.1 — legal/regulatory requirements understood | ✅ | EU AI Act class + FDL 10/2025 in register; [`dpia-2026.md`](dpia-2026.md) |
| GOVERN 1.2 — trustworthy-AI characteristics integrated | 🟡 | `SOUL_CHARTER` P1–P10; transparency notice in `advisor.html` |
| GOVERN 1.4 — risk-management process | ✅ | [`agentic-ai-governance-6layers-2026.md`](agentic-ai-governance-6layers-2026.md) + this crosswalk |
| GOVERN 2.1 — roles & responsibilities | ✅ | Register `owner_role` (MLRO accountable) |
| GOVERN 4.1 — org practices to manage risk | ✅ | Register onboarding gate; model-change control test |
| GOVERN 6.1 — third-party risk policies | ✅ | Anthropic/Asana documented in register + DPIA |

## MAP
| Subcategory | Status | Evidence |
|---|---|---|
| MAP 1.1 — context & use established | ✅ | Register `classification`/`autonomy`; advisory-only |
| MAP 2.3 — capabilities, limits documented | ✅ | "Decision support, not a decision" disclaimers + notice |
| MAP 3.4 — human oversight defined | ✅ | HITL/HOTL in the 6-layer doc (Layer 5) |
| MAP 5.1 — impacts to individuals/groups | 🟡 | DPIA risk register; bias review pending first cycle |

## MEASURE
| Subcategory | Status | Evidence |
|---|---|---|
| MEASURE 2.5 — validity & reliability | ✅ | `test/advisor-assurance.test.js`; `scripts/advisor-eval.mjs` |
| MEASURE 2.6 — safety | ✅ | Tipping-off guard (red-teamed); refusal protocol |
| MEASURE 2.7 — security & resilience | ✅ | CORS, server-held keys, CodeQL, Gitleaks |
| MEASURE 2.11 — harmful bias | 🟡 | [`advisor-bias-review-2026.md`](advisor-bias-review-2026.md) (method defined; first cycle pending) |
| MEASURE 4.1 — feedback on efficacy | 🟡 | Weekly eval report; no end-user feedback loop yet |

## MANAGE
| Subcategory | Status | Evidence |
|---|---|---|
| MANAGE 1.2 — risks prioritised | ✅ | Risk tiers (advisor MEDIUM, reg-draft LOW) |
| MANAGE 2.3 — mechanisms to sustain value | ✅ | Weekly `advisor-eval.yml` |
| MANAGE 2.4 — mechanisms to supersede/deactivate | ✅ | Kill switch: unset `ANTHROPIC_API_KEY` → 503 ([`ai-incident-runbook.md`](ai-incident-runbook.md)) |
| MANAGE 4.1 — incident response & recovery | ✅ | [`ai-incident-runbook.md`](ai-incident-runbook.md) |

**Open items:** formal bias-review first cycle (MEASURE 2.11) and a structured efficacy feedback loop
(MEASURE 4.1). No conformity-assessment body engaged — this is a self-assessment.
