# Model Card — PEP / RCA Identifier

*Card date: 2 Jul 2026 · Type: **deterministic lookup** (no ML, no LLM) · `pep-check.mjs`, `screen.py:check_pep`*

| Field | Detail |
|---|---|
| **Purpose** | Provide a best-effort signal that an individual (customer, UBO, director, signatory) is a Politically Exposed Person, Relative/Close Associate, or state-owned-enterprise link (FATF R.12), to trigger EDD + senior sign-off. |
| **Business owner** | MLRO. |
| **Technical owner** | Compliance Engineering. |
| **Inputs** | Individual name → **Wikidata** public query (position-held / office / political-party signals). |
| **Outputs** | PEP/RCA/SOE indicator with the matched Wikidata record and reason; feeds the risk-rating factor "PEP / RCA / SOE exposure". |
| **Knowledge / training source** | None trained — live Wikidata; no proprietary PEP database. |
| **Prompt strategy** | N/A. |
| **Limitations** | **Best-effort and supplementary** — Wikidata is not an authoritative PEP list; coverage is uneven, especially for local/regional figures and non-English names; absence of a hit is **not** evidence of non-PEP status. |
| **Known risks** | **False negative** (undetected PEP) — mitigated: the signal never *clears* a subject; a standing PEP match is never dropped on a run where the lookup errored; PEP determination remains a documented MLRO judgement, not an automated clearance. Risk register R-07. |
| **Bias assessment** | Coverage gaps skew against non-English-language figures; mitigated by treating the signal as additive-only and pairing with adverse-media (which has Arabic coverage) and manual EDD. |
| **Human oversight** | A hit triggers EDD + senior approval; a non-hit does not close the PEP question — the MLRO records the determination. |
| **Monitoring** | `test/pep-check.test.mjs` every push/PR; PEP error count reported per run; the AM/PEP daily audit task in Ongoing Monitoring evidences execution. |
| **Performance metrics** | Lookup success/error rate per run; standing-match persistence across runs. |
| **Retirement criteria** | Replace when a commercial PEP feed (World-Check / Dow Jones) is adopted — at which point this becomes a fallback or is retired; re-validated on change. |
