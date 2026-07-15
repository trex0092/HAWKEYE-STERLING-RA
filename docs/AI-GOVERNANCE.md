# AI Governance — Hawkeye Sterling AML/CFT Screening (V2)

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
Filed reports contain **only real, sourced data** — every sanctions hit shows the
real matched list entry, every adverse item shows the real headline + source +
**clickable article link**, every PEP shows the real Wikidata record. **No
model-generated facts ever enter a report.**

Two precise boundaries:
- **Generative prose (free-text summaries) is OFF** by default and stays off even
  with a key (`REPORT_ALLOW_LLM=0`). Enabling it needs `REPORT_ALLOW_LLM=1` **and**
  a key — a separate, documented decision. The `[Auto]` summary is a deterministic
  template filled with the real matched values.
- **Grounded triage MAY use the LLM** when a key is present (`LLM_TRIAGE=1`,
  default): it only **classifies** the supplied real headline (is this about the
  subject? how severe?) under a hard grounding contract that forbids inventing any
  fact. It generates no new information, the raw headline + link are always shown,
  the result is labelled, and any model failure falls back to deterministic. Set
  `LLM_TRIAGE=0` to make even this deterministic.

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

## 5a. Prompt security (UAE "Securing Agentic AI")
Adverse-media headlines and source names come from the open web and are treated as
**untrusted input**. Before any text reaches the model it is (1) stripped of control
characters, (2) length-capped, (3) wrapped in explicit untrusted markers, and (4)
screened for prompt-injection patterns (`ai.py::detect_injection`). On any detection
the item is **never sent to the model** — it is classified deterministically and the
attempt is flagged in the report and audit trail. The model's system prompt also
carries a hard contract to ignore any instruction embedded in untrusted text and to
invent no facts. "Secure by design. Trust by default."

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
UAE Federal Decree-Law No. 10 of 2025 (AML/CFT/CPF, repealing FDL 20/2018) ·
Cabinet Resolution 134/2025 (Executive Regulations, superseding Cabinet Decision 10/2019) ·
Cabinet Resolution 74/2020 (TFS) · FATF Recommendations 6, 10, 12.

## 8a. Governance ⇄ Compliance traceability matrix
Governance is the strategy ("how should we manage AI?"); compliance is the proof
("are we meeting requirements?"). Both are implemented and **attested in every
report** (report section ⑦, derived from live run state) and **enforced in CI**
(`test/engine_test.py`).

| Pillar | Control | Implementation | Attested / tested |
| --- | --- | --- | --- |
| Governance | Policies & Standards | this document | report §⑦ |
| Governance | AI Principles (fairness/transparency/accountability) | labelled outputs + raw evidence; transliteration fairness sets | §4, §5; report §⑦ |
| Governance | Risk Framework | `ai.compute_risk_rating` (FATF R.10) + QA gate | engine_test; report §⑦ |
| Governance | Accountability | `agents.py` identities + authorization; MLRO ownership | preflight test; report §⑥/⑦ |
| Governance | Decision Oversight | MLRO human-in-the-loop; degrade-loudly | report §⑦ |
| Compliance | Regulations | UAE FDL 26/2021 · Cabinet 74/2020 · FATF R.6/10/12 · AI Strategy 2031 | report header + §⑦ |
| Compliance | Data Privacy | PDPL; no-egress default; LLM opt-in gated | §3; report §⑦ |
| Compliance | Security Controls | prompt-injection defence + credential broker (least privilege) | engine_test; report §⑥/⑦ |
| Compliance | Audits | agent audit trail + QA gate; 10-yr retention (Asana + GitHub) | report §⑥/⑦ |
| Compliance | Documentation | this doc · README · CI-tested engine | repo |

## 9. Review
This model card is reviewed whenever the AI layer changes and at least annually by
the MLRO / compliance function. Last updated with the initial AI-layer release.
