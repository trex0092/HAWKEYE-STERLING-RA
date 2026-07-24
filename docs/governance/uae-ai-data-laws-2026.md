# UAE AI & Data Laws 2026 — Applicability & Posture Map

How the 2026 UAE AI/data regulatory landscape lands on this system, mapped
honestly onto what exists in this repository — covered, partially covered, or
open, never silently implied. Penalty figures and the violation taxonomy follow
the UAE Data Office's public summary (as of May 2026); treat amounts as
indicative — the law and executive regulations control, and penalties scale
with severity and repetition. **Owner: MLRO · reviewed with the quarterly
methodology cycle.**

## The instruments in scope

| Instrument | What it governs | Where this system engages it |
|---|---|---|
| Federal Decree-Law No. 45/2021 (PDPL) | Personal-data processing | [DPIA](dpia-2026.md) (incl. ROPA + cross-border row), [data retention](data-retention.md), no-egress default, tokenised delivery |
| UAE AI Ethics Principles & Guidelines | Lawful, fair, transparent, accountable, safe, privacy-respecting AI | Charter P1–P10 + [UAE AI Charter 12-principle mapping](uae-ai-charter-mapping-2026.md) |
| Federal Decree-Law No. 34/2021 (Cybersecurity) | Security of systems and data | Edge hardening (pure-`'self'` CSP, Trusted Types), scanner fleet, [repo hardening](github-repository-hardening.md), [GRC↔cyber model](grc-cybersecurity-model.md) |
| UAE Data Office regulations & cross-border rules | Transfers, notices, DPO, breach duties | Rows below |
| Sector-specific regimes (DPMS) | AML/CFT overlay for precious metals | The whole platform; see [in-domain coverage](../aims/in-domain-aml-coverage.md) |

## The Data Office top-10 violation areas, against this system

Status: ✅ addressed · 🟡 partial / to confirm · ⚪ conditional on deployment.

| # | Violation area (indicative penalty, AED) | This system's posture | Status |
|---|---|---|---|
| 1 | No lawful basis for processing (≤100k) | Processing rests on the controller's AML/CFT legal obligations (FDL 10/2025), recorded in the [DPIA](dpia-2026.md); the tool is decision-support for that regulated duty | ✅ |
| 2 | Invalid consent (≤100k) | Basis is legal obligation, not consent — no consent theatre; the DPIA says so explicitly | ✅ |
| 3 | Illegal cross-border transfer (≤250k) | UAE→US transfers (Anthropic, Asana) are assessed in the DPIA (processor terms, no-training API, minimised payloads); **tokenise — no PII** delivery keeps identity on-device; residual Med accepted there. Whether a Data Office transfer approval is additionally required is a deployment-entity legal call | 🟡 |
| 4 | Unfair or biased AI (≤500k) | Cross-script recall-parity test CI-enforced, [bias review method + log](advisor-bias-review-2026.md), quarterly bias eval, risk register R-05 | ✅ |
| 5 | No privacy notices (≤100k) | [Interested-parties information](../aims/interested-parties-information.md) + in-app transparency notice + [explainability statement](explainability-statement-2026.md) | ✅ |
| 6 | Inadequate data security (≤100k) | CSP/Trusted Types/isolation headers, secret masking, egress-blocked CI, encrypted state branches (P30), scanner fleet — see the [GRC↔cyber map](grc-cybersecurity-model.md) | ✅ |
| 7 | Excessive collection (≤100k) | Minimisation by design: only name+headline ever reach the LLM; assessment fields are the regulated minimum | ✅ |
| 8 | Retention failures (≤100k) | [Data-retention schedule](data-retention.md) with per-store rules | ✅ |
| 9 | Breach-reporting failures (≤1M) | [AI incident runbook](ai-incident-runbook.md) + anomaly escalation cover detect/respond; the runbook now pins the **Data Office notification clock** (immediately; 72h internal ceiling pending the Executive Regulations' final timeline) alongside the FIU/EOCN paths | ✅ |
| 10 | No DPO where required (≤50k) | Roles sit in the [governance committee charter](ai-governance-committee-charter.md); whether the deploying entity must formally designate a DPO depends on its processing profile — decide and minute it | ⚪ |

## The 2026 must-do checklist, located in this repo

- Data inventory & mapping → [AI asset register](ai-asset-register.md) + DPIA ROPA
- Privacy notices & consent mechanics → notices ✅ (consent N/A — legal-obligation basis)
- Lawful basis for all processing → DPIA ✅
- DPIA for high-risk AI → [dpia-2026.md](dpia-2026.md) ✅
- Security & access controls → hardening stack ✅
- Retention & deletion policies → [data-retention.md](data-retention.md) ✅
- DPO appointment (if required) → ⚪ row 10 above
- Breach detection & response → runbook + monitors ✅; notification clock pinned ✅ row 9
- Cross-border approval → 🟡 row 3 above
- Team training & culture → competency records + [training pack](../aims/competency-records.md)

## Ethics principles → charter

Lawful → P1/P2 grounding · Fair → P5/P6 + bias testing · Transparent → P7/P9 +
explainability statement · Accountable → HITL, MLRO sign-off, dual attestation ·
Safe & secure → security stack + guardrail evals · Privacy-respecting → minimisation,
tokenised delivery, PDPL assessment.

*The remaining residue is row 3 🟡 and row 10 ⚪: confirm the transfer-approval position
(draft: [cross-border-transfer-position-2026.md](cross-border-transfer-position-2026.md))
and minute the DPO determination (draft:
[dpo-determination-2026.md](dpo-determination-2026.md)). Row 9's clock was pinned in the
runbook on 2026-07-24. Route via the [open-actions register](open-actions-register.md).*
