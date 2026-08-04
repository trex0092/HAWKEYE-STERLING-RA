# Roadmap

*Date: 4 Aug 2026 (previous edition 2 Jul 2026). Effort = engineering/documentation
days; signatures and data feeds are firm actions, not effort. Impact =
compliance/business value. Items opened by the August 2026 full-repo audit carry
their [open-actions register](../governance/open-actions-register.md) number and
target date — the register is the tracking record; this page is the horizon view.*

## Short term (≤ 1 month)
| Item | Effort | Impact | Status |
|---|---|---|---|
| Executive layer (brief · value · readiness · roadmap · KPI) | done | High | ✅ |
| Model cards (6) | done | High | ✅ |
| Architecture diagram set (context · data-flow · trust boundary) | done | High | ✅ delivered — [`../architecture/diagrams.md`](../architecture/diagrams.md) |
| Risk-register L×I formatting + key-person row | done | Medium | ✅ delivered — R-17 in [`../aims/ai-risk-register.md`](../aims/ai-risk-register.md) |
| Sign Anthropic DPA → enable AI triage + advisor bias cycle | signature | High | ⬜ firm |
| Create 4 Asana custom fields + first live assessment (TEST-000) | 0.5 d | High | ⬜ firm → verify |

## Medium term (1–3 months)
| Item | Effort | Impact | Register |
|---|---|---|---|
| Connect transaction feed → activate FATF R.16 engine (closes R-13) | feed-dependent | High | item 6 |
| First ISO 42001 management review + committee ToR in operation | meeting | High | item 4 |
| KPI dashboard automation (render `run-metrics` history) | 1–2 d | Medium | — |
| User / administrator / API guides | done | Medium | ✅ delivered — [`../user-guides/analyst-guide.md`](../user-guides/analyst-guide.md), [`../api/functions.md`](../api/functions.md) |
| First annual penetration test | external | Medium | — |
| Q3 model-validation sign-off (due 30 Sep) | sign-off | Medium | — |
| Toolchain deepening: coverage + mypy (report-only) + mutation spot-check | 2 d | Medium | item 25 · 2026-10-31 |
| Deploy self-heal + rollback automation (runbook shipped 2026-08) | 1 d | Medium | item 26 · 2026-10-31 |

## Long term (3–12 months)
| Item | Effort | Impact | Register |
|---|---|---|---|
| Netlify Identity/JWT on write + confidential-read endpoints (zero-trust) | project | High | item 20 · 2027-03-31 |
| Second alert channel beyond Asana (e-mail / chat webhook + escalation) | 1–2 d | High | item 21 · 2026-12-31 |
| Distributed rate limiting (Edge/Upstash) | project | Medium | item 22 · 2027-03-31 |
| Server-side persistence tier + RPO/RTO statement | project | High | item 23 · 2027-06-30 |
| Browser + function error telemetry into anomaly escalation | 1–2 d | Medium | item 24 · 2026-12-31 |
| Console/Advisor Arabic UI chrome (AR reviewer required) | 2–3 d | Medium | item 28 · 2026-12-31 |
| `screen.py` decomposition + matcher consolidation decision | project | Medium | item 27 · 2027-06-30 |
| Passkeys / WebAuthn over TOTP | project | Medium | — |
| Commercial adverse-media/PEP feed evaluation (World-Check / LSEG) | eval | High | — |
| ISO/IEC 42001 external certification readiness assessment | external | High | — |

## Sequencing logic
Signatures first (they unlock automation with zero engineering), then the
transaction feed (the one High-risk functional gap), then the delivery-resilience
items (second alert channel, deploy self-heal — cheap and they harden what
already runs), then the zero-trust/enterprise-scale items once the firm's usage
justifies the infrastructure. The August 2026 audit items are sequenced by
their register target dates.
