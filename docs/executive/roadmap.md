# Roadmap

*Date: 2 Jul 2026. Effort = engineering/documentation days; signatures and data
feeds are firm actions, not effort. Impact = compliance/business value.*

## Short term (≤ 1 month)
| Item | Effort | Impact | Status |
|---|---|---|---|
| Executive layer (brief · value · readiness · roadmap · KPI) | done | High | ✅ this cycle |
| Model cards (6) | done | High | ✅ this cycle |
| Architecture diagram set (context · data-flow · trust boundary) | 1 d | High | ⬜ next |
| Sign Anthropic DPA → enable AI triage + advisor bias cycle | signature | High | ⬜ firm |
| Create 4 Asana custom fields + first live assessment (TEST-000) | 0.5 d | High | ⬜ firm → verify |
| Risk-register L×I formatting + key-person row | 0.5 d | Medium | ⬜ next |

## Medium term (1–3 months)
| Item | Effort | Impact |
|---|---|---|
| Connect transaction feed → activate FATF R.16 engine (closes R-13) | feed-dependent | High |
| First ISO 42001 management review + committee ToR in operation | meeting | High |
| KPI dashboard automation (render `run-metrics` history) | 1–2 d | Medium |
| User / administrator / API guides | 1.5 d | Medium |
| First annual penetration test | external | Medium |
| Q3 model-validation sign-off (due 30 Sep) | sign-off | Medium |

## Long term (3–12 months)
| Item | Effort | Impact |
|---|---|---|
| Netlify Identity/JWT on write endpoints (zero-trust) | project | High |
| Distributed rate limiting (Edge/Upstash) | project | Medium |
| Passkeys / WebAuthn over TOTP | project | Medium |
| Commercial adverse-media/PEP feed evaluation (World-Check / LSEG) | eval | High |
| ISO/IEC 42001 external certification readiness assessment | external | High |

## Sequencing logic
Signatures first (they unlock automation with zero engineering), then the
documentation package for presentation readiness, then the transaction feed (the
one High-risk functional gap), then the zero-trust/enterprise-scale items once the
firm's usage justifies the infrastructure.
