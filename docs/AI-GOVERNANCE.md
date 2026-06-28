# AI Governance — Fine Gold LLC AML/CFT Screening (Hawkeye Sterling V2)

Adopted in line with the **UAE National AI Strategy 2031** mandate to embed AI in
operations, and the **UAE AI Ethics Principles** (fairness, accountability,
transparency, explainability, human oversight) and **UAE PDPL** (data protection /
residency). This document is the model card + governance record for the AI layer
(`ai.py`) used by the daily screening engine (`screen.py`).

## 1. Purpose & scope
The AI layer provides **decision-support only** for AML/CFT screening:
- Customer risk rating (Low / Medium / High) with explainable factors
- Adverse-media triage (severity · relevance · confidence)
- Plain-language alert summaries ("why flagged / what to check")
- Network / related-party detection (shared owners / UBOs)
- Arabic / Turkish transliteration to widen sanctions-match recall
- goAML STR/SAR **draft** generation (for human review and filing)

It does **not** make decisions. It never freezes, declines, on-boards, or files.

## 2. Human-in-the-loop (FATF R.10/R.12; UAE Cabinet Decision 74/2020)
Every output is reviewed by the **MLRO**, who retains the decision and signs off.
No automated TFS freeze, no automated STR filing — STRs are drafted for the MLRO
to verify, complete, and file via the UAE FIU **goAML** portal.

## 2a. No hallucinations / no fabricated data (HARD RULE)
Filed reports contain **only real, sourced, deterministic data** — every item
traces to a real designation-list entry, a real news article link, or a real
Wikidata record. There is **no generative text and no model-inferred facts** in
any report. Risk ratings and triage labels are computed by transparent rules and
list their contributing factors. The LLM is **locked out of the report path**
(`REPORT_ALLOW_LLM=0` by default) — it stays deterministic **even if an LLM key is
present**. Enabling generative text in reports requires explicitly setting
`REPORT_ALLOW_LLM=1` **and** a key — a separate, documented decision, never the
default.

## 3. LLM use is opt-in; data residency (UAE PDPL)
- Any feature that would send customer data to an external model is **gated behind
  the `ANTHROPIC_API_KEY` secret**.
- **With no key, the system runs fully on-runner with deterministic logic — no
  customer data leaves the GitHub Actions runner, no paid key, no third-party
  model.**
- Provisioning the key is the firm's **explicit authorisation** for that egress and
  must be accompanied by a data-processing assessment under UAE PDPL.
- Model (when enabled): configurable via `AI_MODEL` (default a hosted Claude model).

## 4. Explainability & transparency
- Deterministic features return the **contributing factors** behind every output
  (e.g. the risk rating lists exactly why it is High).
- LLM-generated text is **labelled `[AI]`** in the report; deterministic text is
  labelled `[Auto]`. Both always carry the **raw evidence** (matched list entry,
  score, article link) so a human can verify without trusting the model.
- The report footer states the active **AI mode** every run.

## 5. Fairness / bias controls
- Transliteration variant sets (`ai.py::_TRANSLIT_GROUPS`) are curated to give
  **equitable recall across Arabic and Turkish name spellings** common to this
  book of business, reducing under-matching of non-Latin names.
- Match thresholds are documented (`THRESHOLD`, `CORE_THRESHOLD`) and applied
  uniformly to all subjects.
- A "no match" is **never** treated as a clearance when a module is degraded — the
  degradation is shown, never hidden (avoids false assurance).

## 6. Accountability & audit
- Every run is an immutable GitHub Actions record + an Asana task (10-year
  retention, UAE FDL No. 26 of 2021 Art. 23).
- The delta engine records what was reported and when (`data/screen-delta-state.json`).
- Reduced coverage or model failure **degrades loudly** (red run + alert), never
  silently.

## 7. Failure handling
- An LLM error never blocks a report: the feature falls back to its deterministic
  path and the output is labelled accordingly.
- The deterministic path is the **system of record**; the LLM only sharpens it.

## 8. Regulatory basis
UAE National AI Strategy 2031 · UAE AI Ethics Principles · UAE PDPL ·
UAE Federal Decree-Law No. 20 of 2018 (AML/CFT) · Cabinet Decision 10/2019 ·
Cabinet Resolution 74/2020 (TFS) · FATF Recommendations 6, 10, 12.

## 9. Review
This model card is reviewed whenever the AI layer changes and at least annually by
the MLRO / compliance function. Last updated with the initial AI-layer release.
