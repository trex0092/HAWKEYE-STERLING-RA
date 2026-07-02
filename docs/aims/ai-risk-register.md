# AI Risk Register (AIMS 6.1 / A.5 · ISO 31000)

AI-specific risks of the screening/assessment system, scored on a 5×5
likelihood × impact matrix, with the controls in place and the residual score
after those controls. Reviewed at least annually and on change. **Owner: MLRO.**

### Scoring key
**Likelihood (L)** 1 Rare · 2 Unlikely · 3 Possible · 4 Likely · 5 Almost certain
**Impact (I)** 1 Negligible · 2 Minor · 3 Moderate · 4 Major · 5 Severe (regulatory/enforcement)
**Score = L × I (1–25)** → band: **Low 1–6 · Medium 7–12 · High 13–25**.
Inherent = before controls; Residual = with the controls in the row operating.

| ID | Risk | L | I | Inherent | Key controls in place | L | I | Residual | Treatment · owner · review |
|---|---|:-:|:-:|:-:|---|:-:|:-:|:-:|---|
| R-01 | **Hallucination** — model invents a fact that reaches a filed report | 4 | 4 | 🔴 16 High | Reports deterministic-only; LLM only for grounded classification; `REPORT_ALLOW_LLM=0` default; raw evidence always shown; CI invariant test | 1 | 4 | 🟢 4 Low | Accept; CI monitor · Eng · per build |
| R-02 | **Prompt injection** via adverse-media / question text | 4 | 4 | 🔴 16 High | `detect_injection` blocks injected items from the model; untrusted-text wrapping; hard system contract; standing CI red-team (`redteam_injection.py`) | 1 | 4 | 🟢 4 Low | Accept; red-team every build · Eng · per build |
| R-03 | **False negative** — a true sanctions/PEP match missed | 3 | 5 | 🔴 15 High | 5 core lists + supplementary; fuzzy + transliteration recall; degrade-loudly (never "all clear" on failure); daily cadence; R.10 identity/jurisdiction corroboration | 2 | 5 | 🟡 10 Medium | Mitigate; threshold tuning; MLRO four-eyes · MLRO · quarterly |
| R-04 | **False positive** — noise buries real risk | 4 | 2 | 🟡 8 Medium | Core-token FP suppression; confidence tiers; delta engine (only new) | 2 | 2 | 🟢 4 Low | Accept; monitor FP rate · MLRO · quarterly |
| R-05 | **Bias** — under-matching non-Latin (Arabic/Turkish) names | 3 | 4 | 🟡 12 Medium | Transliteration variant sets; uniform thresholds; **formal cross-script recall-parity test, CI-enforced** (`bias_eval.py`) | 1 | 4 | 🟢 4 Low | Accept; expand labelled set from dispositions · MLRO · quarterly |
| R-06 | **Data egress / privacy** — customer data leaves to a third party | 3 | 5 | 🔴 15 High | No-egress default; LLM opt-in & gated; only name+headline sent; ID masking; **PDPL assessment + ROPA**; vendor register | 1 | 5 | 🟢 5 Low | Accept on key provisioning + DPA · MLRO · on change |
| R-07 | **Secret leakage / cybersecurity** — a key exposed in logs/reports/client | 3 | 5 | 🔴 15 High | `_mask` presence-only; secrets never logged or sent to browser (Semgrep-enforced); gitleaks; credential broker; counts-only telemetry | 1 | 5 | 🟢 5 Low | Accept · Eng · per build |
| R-08 | **Silent control failure** — a daily control stops running | 4 | 4 | 🔴 16 High | `freshness-check` (fails loudly + Asana alert); degrade-loudly; runtime anomaly detection (latency/error/coverage → QA gate); **STALE flag in daily governance report** | 1 | 4 | 🟢 4 Low | Accept · Eng · per run |
| R-09 | **Source unavailability / silent shrink** — a list/feed down or collapsed | 4 | 3 | 🟡 12 Medium | Per-list degrade flag; supplementary never flips core; 429/Retry-After retry; source-coverage drift monitor (≥20% core drop → alarm) | 2 | 3 | 🟢 6 Low | Accept; monitor trend · Eng · per run |
| R-10 | **Over-reliance / automation bias** — staff trust output without review | 3 | 4 | 🟡 12 Medium | Human-in-the-loop sign-off; "decision-support only" labelling; nothing auto-files; RBAC completion gate | 1 | 4 | 🟢 4 Low | Accept; training · MLRO · annual |
| R-11 | **Model / provider drift** — an LLM change alters behaviour | 3 | 3 | 🟡 9 Medium | `AI_MODEL` pinned; deterministic fallback on any LLM error/format change; severity clamped; weekly advisor guardrail eval | 1 | 3 | 🟢 3 Low | Accept; review on model change · Eng · on change |
| R-12 | **Job timeout / capacity** — sweep exceeds runner budget | 3 | 3 | 🟡 9 Medium | Parallelised sweep; 350-min cap; degrade-loudly; runtime latency anomaly alarm | 1 | 3 | 🟢 3 Low | Accept · Eng · per run |
| R-13 | **Transaction-layer blind spot** — no monitoring of transaction behaviour (FATF R.16) | 4 | 5 | 🔴 20 High | R.16 rules engine built & tested (`txn_monitor.py`); INACTIVE pending a feed; status shown honestly in every report; no fabricated data | 3 | 4 | 🟡 12 Medium | **Mitigate: connect a transaction feed** (`TXN_FEED_PATH`) · firm · until closed |
| R-14 | **Silent degradation unactioned** — an anomaly recurs run-after-run, no one told | 3 | 4 | 🟡 12 Medium | Per-run anomalies in report; **SUSTAINED anomalies auto-escalate to a GitHub issue** (`sustained_anomalies` + `anomaly-watch`); adverse-media degradation class; unit-tested | 1 | 4 | 🟢 4 Low | Mitigate; MLRO reviews each escalation · Compliance · per run |
| R-15 | **Vendor / dependency failure** — Anthropic, Asana, Netlify or GitHub outage or termination | 3 | 4 | 🟡 12 Medium | Deterministic engine works with no LLM; Asana mirror is a copy, not the record; static app rehostable anywhere; third-party register + BCP; delivery retries | 2 | 3 | 🟢 6 Low | Accept; BCP drill · firm · annual |
| R-16 | **Regulatory non-compliance** — methodology drifts from FATF / UAE rules | 3 | 5 | 🔴 15 High | Regulatory Watch pipeline; quarterly methodology review (auto-filed); model-validation sign-off log; framework crosswalks; explainability statement | 2 | 4 | 🟡 8 Medium | Mitigate; quarterly + mgmt review · MLRO · quarterly |
| R-17 | **Key-person dependency** — single operator / administrator | 4 | 4 | 🔴 16 High | Roles documented; git + Asana trails survive off-device; BCP (`bcp.md`); setup runbook enables a second operator | 3 | 4 | 🟡 12 Medium | **Mitigate: run a BCP drill** (second person rotates secrets & operates) · firm · annual |

## Heat-map summary (residual position)

| Impact ↓ / Likelihood → | 1 Rare | 2 Unlikely | 3 Possible |
|---|---|---|---|
| **5 Severe** | R-06, R-07 | R-03 | — |
| **4 Major** | R-01, R-02, R-05, R-08, R-10, R-14 | R-16 | R-13, R-17 |
| **3 Moderate** | R-11, R-12 | R-09, R-15 | — |
| **2 Minor** | — | R-04 | — |

*(No residual risk sits at Likelihood 4–5; the controls move every row left.)*

## Top residual risks (for management attention)
1. **R-13 (Medium 12)** — transaction-monitoring engine built but **inactive** pending a firm-provided feed.
2. **R-17 (Medium 12)** — single-operator key-person dependency; closed by a BCP drill + a second trained operator.
3. **R-03 (Medium 10)** — residual false-negative risk inherent to any screening; held down by recall design + four-eyes.
4. **R-16 (Medium 8)** — regulatory drift; held down by the Regulatory Watch + quarterly review cadence.

All other residuals are **Low**, reduced by the hardening passes (formal bias test,
PDPL assessment, runtime + coverage + adverse-media monitoring, delivery retry/dedup,
egress lockdown). *This register is the ISO 31000 record; changes flow through the
management review.*
