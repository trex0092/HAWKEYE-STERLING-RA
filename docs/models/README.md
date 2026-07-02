# Model Cards — AI & Analytic Features

Each AI or analytic component in Hawkeye Sterling RA has a model card using a
fixed template (Purpose · Business owner · Technical owner · Inputs · Outputs ·
Knowledge/training source · Prompt strategy · Limitations · Known risks · Bias
assessment · Human oversight · Monitoring · Performance metrics · Retirement
criteria). This satisfies ISO/IEC 42001 A.6 (AI system life cycle) and the
transparency expectations of the NIST AI RMF and (should territorial scope ever
apply) the EU AI Act.

| Card | Component | LLM? | Gating |
|---|---|---|---|
| [`risk-scoring-engine.md`](risk-scoring-engine.md) | Deterministic 0–30 customer risk score & band (`app.js`) | No | Always on (core) |
| [`sanctions-name-matcher.md`](sanctions-name-matcher.md) | Fuzzy / transliteration name matcher (`sanctions-match.mjs`, `screen.py`) | No | Always on |
| [`adverse-media-classifier.md`](adverse-media-classifier.md) | Keyword/typology adverse-media classifier + feeds (`screen.py`, `adverse-media.mjs`) | No (triage optional) | Always on |
| [`pep-identifier.md`](pep-identifier.md) | Wikidata PEP/RCA signal (`pep-check.mjs`, `screen.py`) | No | Always on (best-effort) |
| [`advisor-llm.md`](advisor-llm.md) | Cited-answer AML Advisor (`netlify/functions/brain-soul.js`) | **Yes** | `ANTHROPIC_API_KEY` |
| [`ai-triage.md`](ai-triage.md) | LLM adverse-media relevance triage + risk-rating narration (`ai.py`) | **Yes** | `LLM_TRIAGE=1` + key |

**Governing principle (all cards):** every AI output is **decision-support, not a
decision** — the MLRO decides and files. With no `ANTHROPIC_API_KEY` the platform
runs fully deterministic on-runner with **no customer-data egress**; the two
LLM-backed features are opt-in and separately gated.

**Cross-references:** validation → [`../governance/model-validation-2026.md`](../governance/model-validation-2026.md) ·
bias → [`../aims/bias-fairness-testing.md`](../aims/bias-fairness-testing.md) ·
red-team → [`../aims/red-team-procedure.md`](../aims/red-team-procedure.md) ·
explainability → [`../governance/explainability-statement-2026.md`](../governance/explainability-statement-2026.md) ·
risk register → [`../aims/ai-risk-register.md`](../aims/ai-risk-register.md).

*Template note: cards describe the system as implemented in the repository at the
date shown. Any change to a frozen scoring value or a prompt/charter is a change
to firm-approved methodology and requires the model-validation §5 sign-off.*
