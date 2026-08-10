# AI Acceptable-Use Policy — Hawkeye Sterling

**Layer 6 — Governance, Compliance & Audit (policy enforcement).** Applies to all operators of the
MLRO Advisor. **Owner:** MLRO. **Date:** 2026-06-21.

## Purpose
The Advisor is an **assistive, decision-support** tool. It does not make, and must never be treated as
making, a compliance decision. The MLRO/Compliance Officer remains accountable for every decision.

## Permitted use
- Researching AML/CFT/sanctions questions, typologies, red flags, and regulatory references.
- Drafting internal analysis, structuring assessments, and summarising the firm's own material.
- Generating **gap lists** and **next-step** recommendations for human action.

## Prohibited use
- Treating Advisor output as a **final** sanctions/PEP determination, risk decision, or disposition.
- Pasting data into the Advisor that **must not leave the device** (the authoritative record is the
  on-device register, not an Advisor conversation).
- Asking the Advisor to draft any **customer-facing** text that could constitute tipping-off
  (it will refuse — Article 25, FDL 10/2025).
- Relying on the Advisor's **training-data** recollection for sanctions/PEP/enforcement status.
- Acting on Advisor output **without MLRO review**.

## Third-party AI tools (outside this system)

This policy governs **every** AI tool an operator uses for firm work, not only the Advisor. Public
assistants — ChatGPT, Gemini, Copilot, Claude.ai, an AI feature inside another product, or anything
reached from a personal account — are **unapproved by default**.

- **Never** enter customer identities, CDD/KYC material, transaction data, screening results, STR/SAR
  content or any other confidential firm data into an unapproved AI tool. This holds regardless of the
  tool's own privacy claims: the firm has no DPA, no transfer basis and no deletion right over it.
- The **approved tool list** is the [AI asset register](ai-asset-register.md). A tool that is not on it
  has not been assessed and must not be used on firm data. Adding one is an MLRO decision, recorded
  there, and requires an executed DPA and a confirmed transfer basis before any personal data flows —
  the same bar the Advisor's own egress path is held to.
- Using an unapproved tool on non-confidential material (public regulatory text, general drafting with
  no firm or customer content) is permitted, but the output is subject to every obligation below.
- There is **no technical enforcement** of this clause — no device management, no DLP. It rests on
  operator discipline, which is why the risk is carried openly as **R-21** in the
  [AI risk register](../aims/ai-risk-register.md) rather than recorded as controlled.

## Operator obligations
- Read the on-screen transparency notice; verify every cited basis against the primary source.
- Use the Advisor, not a public assistant, for anything touching firm or customer data — the sanctioned
  path exists so there is never a reason to reach for an unapproved one.
- Report suspected failures per [`ai-incident-runbook.md`](ai-incident-runbook.md).
- Complete AML/AI-use awareness before operating the Advisor.

## Acknowledgment
The Advisor is **gated in-app**: the composer is blocked until the operator acknowledges this policy,
recorded on the device as `hsra.aup.ack.v1` (`advisor.html`). The Advisor cannot be used until the
gate is accepted.

*Reviewed annually and on any change to the Advisor's models or scope.*
