# AI Risk Register (AIMS 6.1 / A.5)

AI-specific risks of the screening system, their inherent rating, the controls in
place, and residual rating. Scale: Low / Medium / High. Reviewed at least annually
and on change. Owner: MLRO.

| ID | Risk | Inherent | Controls in place | Residual | Treatment / owner |
|---|---|---|---|---|---|
| R-01 | **Hallucination** — model invents a fact that reaches a filed report | High | Reports are deterministic-only; LLM used only for grounded classification; `REPORT_ALLOW_LLM=0` by default; raw evidence always shown; CI invariant test | Low | Accept; monitor via CI |
| R-02 | **Prompt injection** via adverse-media text | High | `detect_injection` blocks injected items from the model; untrusted-text wrapping; hard system contract; flagged in audit trail; **standing CI red-team** (`test/redteam_injection.py`; red-team-procedure.md) | Low | Accept; red-team runs every CI build |
| R-03 | **False negative** — a true sanctions/PEP match missed | High | 5 core lists + supplementary; fuzzy + transliteration recall; degrade-loudly (never "all clear" on failure); daily cadence; **R.10 identity corroboration + jurisdiction risk** | Medium | Mitigate; tune thresholds; MLRO four-eyes |
| R-04 | **False positive** — noise buries real risk | Medium | Core-token false-positive suppression; confidence tiers; delta engine (only new) | Low | Accept; monitor FP rate |
| R-05 | **Bias** — under-matching non-Latin (Arabic/Turkish) names | Medium | Transliteration variant sets; uniform thresholds; **formal cross-script recall-parity test, CI-enforced** (`test/bias_eval.py`; bias-fairness-testing.md) | Low | Accept; expand labelled set from MLRO dispositions |
| R-06 | **Data egress / privacy** — customer data leaves to a third party | High | No-egress default; LLM opt-in & gated; only name+headline sent (no full record); ID masking; **formal PDPL data-processing assessment + ROPA** (pdpl-data-processing-assessment.md); vendor register | Low | Accept on key provisioning + DPA |
| R-07 | **Secret leakage** in logs/reports | High | `_mask` presence-only; secrets never logged; gitleaks; credential broker; LLM usage telemetry is counts-only | Low | Accept |
| R-08 | **Silent control failure** — a daily control stops running | High | `freshness-check` (fails loudly + Asana alert); degrade-loudly; **runtime anomaly detection** (latency/error/coverage cliff → QA gate) | Low | Accept |
| R-09 | **Source unavailability / silent shrink** — a list/feed down, bot-gated, or partially collapsed | Medium | Per-list degrade flag; supplementary never flips core; 429/Retry-After; **source-coverage drift monitor** (≥20% core drop → degrade-loudly alarm + QA gate; monitoring.py) | Low | Accept; monitor trend |
| R-10 | **Over-reliance / automation bias** — staff trust output without review | Medium | Human-in-the-loop sign-off; "decision-support only" labelling; nothing auto-files | Low | Accept; training |
| R-11 | **Model/provider change** alters LLM behaviour | Medium | `AI_MODEL` pinned; deterministic fallback on any LLM error/format change; severity clamped | Low | Accept; review on model change |
| R-12 | **Job timeout / capacity** — sweep exceeds runner budget | Medium | Parallelized sweep (minutes); 350-min cap; degrade-loudly; runtime latency anomaly alarm | Low | Accept |
| R-13 | **Transaction-layer blind spot** — no monitoring of transaction behaviour (R.16) | High | R.16 rules engine built & tested (`txn_monitor.py`); INACTIVE pending a real feed; status shown honestly in every report (§⑤); no fabricated data | Medium | Mitigate: connect a transaction feed (`TXN_FEED_PATH`) — owner: firm |
| R-14 | **Silent degradation goes unactioned** — a runtime/coverage anomaly recurs run-after-run but no one is told | Medium | Per-run anomalies surfaced in §⑤; SUSTAINED anomalies (persisting across consecutive runs) auto-escalate to a GitHub issue via `monitoring.sustained_anomalies` + the `anomaly-watch` workflow; logic unit-tested | Low | Mitigate; MLRO reviews each escalation — owner: Compliance |

**Top residual risks:** R-03 (false negative) and R-13 (no transaction feed
connected) — R-05, R-06, R-08, R-09 reduced to **Low** by the hardening pass
(formal bias test, PDPL assessment, runtime + coverage monitoring). R-13 stays
Medium until the firm connects a transaction source.
