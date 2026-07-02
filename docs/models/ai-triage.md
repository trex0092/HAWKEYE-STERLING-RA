# Model Card — AI Adverse-Media Triage & Risk-Rating Narration

*Card date: 2 Jul 2026 · Type: **LLM classification/summarisation, gated** · `ai.py` · **gated on `LLM_TRIAGE=1` + `ANTHROPIC_API_KEY` — currently OFF***

> Distinct from the Advisor: this component does **not** generate facts. It classifies
> the relevance/severity of *real* headlines and narrates the *deterministic* risk
> rating. All sanctions/PEP/links remain deterministic and source-verified.

| Field | Detail |
|---|---|
| **Purpose** | Reduce false-positive noise in adverse-media review by classifying each real headline's relevance and severity, and produce a plain-language alert summary — so the MLRO triages faster. |
| **Business owner** | MLRO. |
| **Technical owner** | Compliance Engineering. |
| **Inputs** | A real news headline/article already retrieved by the classifier + the subject name; the deterministic risk-rating factors. Untrusted text is sanitised and injection-screened before any model call. |
| **Outputs** | Per-article `{severity, relevance, injection_suspected}` triage; an `alert_summary` narration. **No new facts** — the underlying evidence (list entry / article link / Wikidata) is unchanged and shown. |
| **Model** | `claude-haiku-4-5` (default `AI_MODEL`), max ~400 tokens per call. |
| **Prompt strategy** | Constrained classification/summarisation prompts over sanitised, `<untrusted>`-wrapped input; injection-suspected input is classified **deterministically and the model is not used**. |
| **Limitations** | Optional enhancement only — with the gate off (current state) the pipeline runs fully deterministic with no egress; classification can err (treated as advisory ranking, never as clearance). |
| **Known risks** | **Data egress** — enabling the gate authorises sending a subject name + one public headline to Anthropic; mitigated by the DPA requirement, minimal payload, and PDPL assessment. **Prompt injection** via headline — mitigated by sanitise + detect + non-execution. **Over-reliance** — mitigated: triage ranks, humans decide. Risk register R-03/R-08. |
| **Bias / fairness** | Ranking only; does not gate coverage (every subject is still screened deterministically). Covered by the same red-team/bias governance as the Advisor. |
| **Human oversight** | Triage severity is advisory; the MLRO reviews every flagged item and decides. |
| **Monitoring** | LLM call counters (attempted/ok/failed) surfaced in the run log and governance footer; behaviour under injection tested in `test/redteam_injection.py`. |
| **Performance metrics** | Triage precision/recall vs MLRO disposition (to be baselined once enabled); false-positive-reduction rate; injection-refusal rate. |
| **Retirement / change control** | Enabling requires: **signed Anthropic DPA**, confirmed transfer basis (PDPL), and setting `LLM_TRIAGE=1`. Any prompt change → `model-validation-2026.md` §5. Retire on provider change or unacceptable drift. |
