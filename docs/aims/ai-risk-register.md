# AI Risk Register (AIMS 6.1 / A.5)

AI-specific risks of the screening system, their inherent rating, the controls in
place, and residual rating. Scale: Low / Medium / High. Reviewed at least annually
and on change. Owner: MLRO.

| ID | Risk | Inherent | Controls in place | Residual | Treatment / owner |
|---|---|---|---|---|---|
| R-01 | **Hallucination** — model invents a fact that reaches a filed report | High | Reports are deterministic-only; LLM used only for grounded classification; `REPORT_ALLOW_LLM=0` by default; raw evidence always shown; CI invariant test | Low | Accept; monitor via CI |
| R-02 | **Prompt injection** via adverse-media text | High | `detect_injection` blocks injected items from the model; untrusted-text wrapping; hard system contract; flagged in audit trail | Low | Accept; red-team periodically |
| R-03 | **False negative** — a true sanctions/PEP match missed | High | 5 core lists + supplementary; fuzzy + transliteration recall; degrade-loudly (never "all clear" on failure); daily cadence | Medium | Mitigate; tune thresholds; MLRO four-eyes |
| R-04 | **False positive** — noise buries real risk | Medium | Core-token false-positive suppression; confidence tiers; delta engine (only new) | Low | Accept; monitor FP rate |
| R-05 | **Bias** — under-matching non-Latin (Arabic/Turkish) names | Medium | Transliteration variant sets; uniform thresholds; fairness review | Medium | Harden: formal bias test (planned) |
| R-06 | **Data egress / privacy** — customer data leaves to a third party | High | No-egress default; LLM opt-in & gated; only name+headline sent (no full record); PDPL DPA; vendor register | Low | Accept on key provisioning + DPA |
| R-07 | **Secret leakage** in logs/reports | High | `_mask` presence-only; secrets never logged; gitleaks; credential broker | Low | Accept |
| R-08 | **Silent control failure** — a daily control stops running | High | `freshness-check` (fails loudly + Asana alert); degrade-loudly | Low | Accept |
| R-09 | **Source unavailability** — a list/feed down or bot-gated | Medium | Per-list degrade flag; supplementary lists never flip core to degraded; 429/Retry-After transport | Medium | Mitigate; monitor coverage |
| R-10 | **Over-reliance / automation bias** — staff trust output without review | Medium | Human-in-the-loop sign-off; "decision-support only" labelling; nothing auto-files | Low | Accept; training |
| R-11 | **Model/provider change** alters LLM behaviour | Medium | `AI_MODEL` pinned; deterministic fallback on any LLM error/format change; severity clamped | Low | Accept; review on model change |
| R-12 | **Job timeout / capacity** — sweep exceeds runner budget | Medium | Parallelized sweep (minutes); 350-min cap; degrade-loudly | Low | Accept |

**Top residual risks:** R-03 (false negative), R-05 (bias), R-09 (source coverage)
— each carries a planned hardening action.
