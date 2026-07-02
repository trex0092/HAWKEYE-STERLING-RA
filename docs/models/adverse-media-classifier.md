# Model Card — Adverse-Media Classifier

*Card date: 2 Jul 2026 · Type: **deterministic keyword/typology classifier** over two news feeds (optional LLM triage — see [`ai-triage.md`](ai-triage.md)) · `screen.py`, `adverse-media.mjs`*

| Field | Detail |
|---|---|
| **Purpose** | Surface negative news linking a customer/UBO to financial crime, and bucket it by typology, so the MLRO can assess adverse-media risk (FATF R.10 risk-based EDD). |
| **Business owner** | MLRO. |
| **Technical owner** | Compliance Engineering. |
| **Inputs** | Subject name → two independent free feeds: **Google News RSS** (5 locales: US/GB/AE/TR/**AR**) and **GDELT DOC 2.0** (100+ languages, machine-translated). Headlines matched against **129 English** red-flag terms + a curated **Arabic** set (mapped to English equivalents). |
| **Outputs** | Ranked, duplicate-collapsed articles: title, source, date, URL, matched keywords, typology categories; a per-subject flagged/clear verdict; a committed evidence log (`data/adverse-media-evidence.json`, 400-day retention); a **repeat-pattern** signal (≥3 distinct stories / 90 days → EDD + STR assessment). |
| **Knowledge / training source** | None trained — a curated keyword→typology map (`KEYWORD_TYPOLOGY`) maintained under the quarterly review; live news feeds. |
| **Prompt strategy** | N/A for the classifier. Optional LLM relevance triage is a separate, gated component ([`ai-triage.md`](ai-triage.md)). |
| **Limitations** | News is real-time but false-positive-prone; keyword matching can over- or under-flag; media alone is never conclusive — current status must be confirmed before any adverse decision; free feeds lack the curation/SLA of commercial providers. |
| **Known risks** | **Missed adverse story** (recall) — mitigated by two independent feeds, Arabic coverage, and the **sustained-degradation escalation** (>25% of subjects losing their pass across 3 runs → Anomaly Watch opens an MLRO issue; "silence is never evidence"). Prompt-injection via a hostile headline is detected and the model is *not* invoked (deterministic classification). Risk register R-06. |
| **Bias assessment** | Language coverage explicitly includes Arabic and Turkish locales so non-English-press subjects are not systematically under-screened; keyword set reviewed quarterly for balanced typology coverage. |
| **Human oversight** | Every finding is raw evidence with a link; the MLRO decides (no action / investigate / escalate / file STR). |
| **Monitoring** | `test/adverse-media.test.mjs`, engine tests (GDELT parse, Arabic mapping, evidence log, repeat/degradation) every push/PR; quarterly methodology-review task (`quarterly-review.yml`); daily run log. |
| **Performance metrics** | Two-feed coverage; duplicate-story collapse ratio; evidence-log completeness; repeat-pattern precision reviewed quarterly. |
| **Retirement criteria** | Replace/augment when a commercial adverse-media feed is adopted; the keyword methodology and feeds would be re-validated. |
