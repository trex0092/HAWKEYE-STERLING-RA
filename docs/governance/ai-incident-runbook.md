# AI Incident Runbook — Hawkeye Sterling

**Layer 6 — Governance, Compliance & Audit (incident response & kill switch).**
**Owner:** MLRO. **Date:** 2026-06-21. Covers the LLM Advisor (`brain-soul.js`) and reg-draft.

## Triggers
- `advisor-eval` workflow **FAIL** (a SOUL_CHARTER guardrail regressed against the live model).
- A **tipping-off escape** (output that should have been withheld but wasn't).
- A fabricated sanctions/adverse-media result reaching a user (P1/P2 breach).
- A prompt-injection that caused the Advisor to ignore the charter.
- Any suspected key/token exposure.

## Response steps
1. **Contain (kill switch).** In Netlify, unset `ANTHROPIC_API_KEY` → `brain-soul.js` returns **503**
   and the Advisor is disabled immediately. For reg-draft, the workflow's AI step no-ops without the key.
2. **Notify.** Inform the MLRO within 24h; if customer PII or a tipping-off risk is involved, treat as
   a potential data/compliance incident under the firm's IR policy. **External clocks:** classify the
   event against [`eu-ai-act-assessment-2026.md §6`](eu-ai-act-assessment-2026.md) — a breach of a
   legal duty is assessed ≤ 48h and routed to the UAE notification duties; a serious malfunction
   without legal breach is triaged ≤ 5 business days. The UAE paths, each with its own clock:
   - **FIU / goAML** (suspicion of ML/TF): STR/SAR assessment per the MLRO's standing procedure —
     without delay once suspicion is formed.
   - **EOCN / TFS** (designated-party touchpoint): freeze first, then report per the TFS procedure —
     immediately.
   - **UAE Data Office — personal-data breach (PDPL, FDL 45/2021 Art. 9):** where a breach threatens
     privacy, confidentiality or security of personal data, notify the Data Office **immediately; the
     firm's internal ceiling is 72 hours from becoming aware**, adopted as the conservative SLA while
     the PDPL Executive Regulations' final notification timeline is pending — revisit this line when
     they issue. Notify **affected individuals without undue delay** where the breach threatens their
     rights. Record both notification times in the incident log below.
3. **Preserve evidence.** Export the tamper-evident activity log; save `advisor-eval-report.md` and the
   workflow run; capture the offending prompt/response.
4. **Root-cause.** Diagnose from the eval report + audit line (model, mode, hash, timestamp).
5. **Fix + regression-proof.** Patch the charter/guard/routing; **add a regression case** to
   `test/advisor-assurance.test.js` (and a live case to `scripts/advisor-eval.mjs` if applicable);
   confirm CI is green.
6. **Restore.** Re-set `ANTHROPIC_API_KEY`; re-run `advisor-eval.mjs` and confirm all guardrails hold.
7. **Record.** Log the incident below and update the asset register if anything changed.

## Incident log

| Date | Trigger | Root cause | Fix / regression test | MLRO sign-off |
|------|---------|-----------|------------------------|---------------|
| _none to date_ | | | | |
