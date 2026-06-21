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

## Operator obligations
- Read the on-screen transparency notice; verify every cited basis against the primary source.
- Report suspected failures per [`ai-incident-runbook.md`](ai-incident-runbook.md).
- Complete AML/AI-use awareness before operating the Advisor.

## Acknowledgment
The Advisor is **gated in-app**: the composer is blocked until the operator acknowledges this policy,
recorded on the device as `hsra.aup.ack.v1` (`advisor.html`). The Advisor cannot be used until the
gate is accepted.

*Reviewed annually and on any change to the Advisor's models or scope.*
