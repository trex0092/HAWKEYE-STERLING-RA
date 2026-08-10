# AI Risk Register (AIMS 6.1 / A.5 · ISO 31000)

AI-specific risks of the screening/assessment system, scored on a 5×5
likelihood × impact matrix, with the controls in place and the residual score
after those controls. Reviewed quarterly for rows with an open mitigation (the
quarterly methodology review files the check), in full at least annually, and on
any significant change to the system, data, models or regulatory landscape.
**Owner: MLRO.**

Lifecycle per risk: **Identify → Assess → Record → Mitigate → Monitor → Review →
Close** — new risks enter via the management review, open mitigations carry an
owner and land in the [CAPA log](corrective-actions.md) /
[open-actions register](../governance/open-actions-register.md) with target
dates, and a row closes only when the management review accepts the evidence.

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
| R-18 | **Lack of explainability** — an output or score cannot be explained or justified to an examiner | 3 | 3 | 🟡 9 Medium | Deterministic rule engine with per-hit reason evidence (raw evidence always shown beside conclusions); [explainability statement](../governance/explainability-statement-2026.md); model cards; per-response audit line; charter P9 "no score without methodology" CI-enforced (weekly eval + offline tests) | 1 | 3 | 🟢 3 Low | Accept · MLRO · annual |
| R-19 | **Unauthorized AI access** — an unauthorized party invokes the AI system or reads its data | 3 | 4 | 🟡 12 Medium | Key-gated LLM path + `ADVISOR_ENABLED` kill switch; `APP_SHARED_TOKEN` gate on the data relays; RBAC completion gate; repository hardening (2FA, branch protection, least-privilege tokens — [checklist](../governance/github-repository-hardening.md)); function logging | 1 | 4 | 🟢 4 Low | Mitigate; periodic access review · firm · quarterly |
| R-20 | **AI incident response gap** — an AI incident is not detected or responded to in time | 3 | 4 | 🟡 12 Medium | [AI incident runbook](../governance/ai-incident-runbook.md) + [postmortem template](../governance/incident-postmortem-template.md); runtime anomaly alarms with sustained-anomaly auto-escalation to a GitHub issue; freshness/degrade-loudly alerts; Asana alert routing | 2 | 4 | 🟡 8 Medium | **Mitigate: annual tabletop drill of the runbook** · MLRO · annual |
| R-21 | **Shadow AI** — an operator pastes customer or CDD data into a public AI tool (ChatGPT, Gemini, Copilot, an AI feature inside another product) outside this system. *Business impact: personal data disclosed to a processor with no DPA and no confirmed transfer basis — PDPL breach notification, regulatory exposure, loss of confidentiality over CDD and screening material, and an STR's existence potentially disclosed (tipping-off).* | 4 | 4 | 🔴 16 High | [AUP §Third-party AI tools](../governance/ai-acceptable-use-policy.md) — unapproved by default, approved list is the [AI asset register](../governance/ai-asset-register.md), MLRO decision + DPA to add one; the Advisor exists as the sanctioned path so no task requires an unapproved tool; in-app AUP acknowledgement gate; no-egress default keeps the system itself off that path (R-06); awareness training | 3 | 4 | 🟡 12 Medium | **Mitigate: this is policy-only — there is NO technical enforcement** (no managed devices, no DLP). Residual stays Medium until the firm records periodic operator attestation against the approved-tool list · firm/MLRO · annual |

## Heat-map summary (residual position)

| Impact ↓ / Likelihood → | 1 Rare | 2 Unlikely | 3 Possible |
|---|---|---|---|
| **5 Severe** | R-06, R-07 | R-03 | — |
| **4 Major** | R-01, R-02, R-05, R-08, R-10, R-14, R-19 | R-16, R-20 | R-13, R-17, R-21 |
| **3 Moderate** | R-11, R-12, R-18 | R-09, R-15 | — |
| **2 Minor** | — | R-04 | — |

*(No residual risk sits at Likelihood 4–5; the controls move every row left.)*

## Top residual risks (for management attention)
1. **R-13 (Medium 12)** — transaction-monitoring engine built but **inactive** pending a firm-provided feed.
2. **R-17 (Medium 12)** — single-operator key-person dependency; closed by a BCP drill + a second trained operator.
3. **R-21 (Medium 12)** — shadow AI: the only row whose controls are **policy-only**. Every other
   residual on this register is held down by something that runs; this one is held down by operator
   discipline, and the register says so rather than scoring a document as an operating control.
4. **R-03 (Medium 10)** — residual false-negative risk inherent to any screening; held down by recall design + four-eyes.
5. **R-16 (Medium 8)** — regulatory drift; held down by the Regulatory Watch + quarterly review cadence.
6. **R-20 (Medium 8)** — incident-response capability documented but **undrilled**; closed by the first tabletop exercise.

All other residuals are **Low**, reduced by the hardening passes (formal bias test,
PDPL assessment, runtime + coverage + adverse-media monitoring, delivery retry/dedup,
egress lockdown).

## Treatment options (legend)

- **Accept** — residual sits within appetite; keep the row's monitoring cadence.
- **Mitigate** — reduce likelihood or impact; each open mitigation carries an owner
  and a target date in the [CAPA log](corrective-actions.md) /
  [open-actions register](../governance/open-actions-register.md).
- **Transfer** — share the risk contractually (e.g. the Anthropic DPA and vendor
  terms recorded in the third-party register — noted inside the controls column).
- **Avoid** — discontinue the activity: the no-egress default *avoids* the
  data-egress risk entirely unless a key is provisioned deliberately (R-06).

## Industry top-10 coverage (ISO/IEC 42001:2023 + NIST AI RMF baseline)

The ten AI risks most commonly tracked in ISO 42001 / NIST AI RMF-aligned
registers, mapped to this register's rows — coverage is complete:

| # | Commonly tracked risk | Typical owner | This register |
|---|---|---|---|
| AI-R01 | Bias & discrimination | AI product owner | R-05 |
| AI-R02 | Hallucination | AI team | R-01 |
| AI-R03 | Prompt injection | Security | R-02 |
| AI-R04 | Sensitive data leakage | Privacy officer | R-06 · R-07 |
| AI-R05 | Model drift | ML team | R-11 (weekly guardrail eval) |
| AI-R06 | Lack of explainability | AI team | R-18 |
| AI-R07 | Unauthorized AI access | IT security | R-19 |
| AI-R08 | Third-party AI risk | Vendor manager | R-15 (+ R-06 vendor/DPA controls) |
| AI-R09 | Regulatory non-compliance | Compliance | R-16 |
| AI-R10 | AI incident response | AI governance lead | R-20 |
| AI-R11 | Shadow AI — staff use of unsanctioned public AI tools on confidential data | Compliance / MLRO | R-21 |

## Auditor checkpoints

Checked by [internal audit item 6.1](internal-audit.md) at each cycle:

- every AI system in the [asset register](../governance/ai-asset-register.md) has
  at least one register row covering it;
- every row names a responsible owner;
- controls cited are documented **and operating** (evidence links resolve);
- residual scores sit within appetite, or carry an open mitigation;
- treatments are approved through the [management review](management-review.md);
- the register was reviewed within its stated cadence.

*An AI risk that is not assigned, monitored and periodically reviewed will
eventually become an incident. This register is the ISO 31000 record; changes
flow through the management review.*
