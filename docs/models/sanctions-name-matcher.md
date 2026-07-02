# Model Card — Sanctions / Watchlist Name Matcher

*Card date: 2 Jul 2026 · Type: **deterministic fuzzy matcher** (no ML, no LLM) · `sanctions-match.mjs`, `screen.py:screen_name`*

| Field | Detail |
|---|---|
| **Purpose** | Decide whether a customer, UBO, director or counterparty name matches a designated party on the consolidated sanctions / watchlists — the operative FATF R.6/TFS control. |
| **Business owner** | MLRO. |
| **Technical owner** | Compliance Engineering. |
| **Inputs** | Subject name (+ jurisdiction/ID when available) and the consolidated lists: OFAC SDN/non-SDN, UN, EU, UK OFSI, the maintained UAE EOCN Local Terrorist List. Names are Unicode-normalised; transliteration variants generated (`name_variants`, `_ascii_fold`). |
| **Outputs** | Per-subject: top score (0–100), band, hit list with matched entry and score; a **MANUAL REVIEW** marker (score-0, `unscreenable`) for non-Latin-script or too-short names that cannot be auto-screened. Material-match threshold default 0.85 (`SCREEN_MATCH_THRESHOLD`). |
| **Knowledge / training source** | None trained — token-sort/fuzzy similarity (RapidFuzz on the Python side) over the live lists; no historical model. |
| **Prompt strategy** | N/A. |
| **Limitations** | Fuzzy matching trades false positives for recall; very short or non-Latin-only names cannot be auto-scored → routed to MANUAL REVIEW rather than passed; list freshness depends on the Sanctions Watch pipeline. |
| **Known risks** | **False negative** (missed designation) is the critical failure — mitigated by transliteration variants, the conservative threshold, MANUAL REVIEW routing, and the **refuse-to-clear** guard (no list loaded ⇒ run bails, never a false all-clear). False positives mitigated by MLRO four-eyes review. Risk register R-04 (matching quality), R-05 (fairness). |
| **Bias assessment** | **Formally measured.** `test/bias_eval.py` (CI-enforced) holds labelled Latin / Arabic / Turkish equivalence sets and asserts a bounded recall gap between scripts — a fairness failure here is a discriminatory *false-negative*, so it is treated as a compliance defect. See [`../aims/bias-fairness-testing.md`](../aims/bias-fairness-testing.md). |
| **Human oversight** | Detection is automatic; the freeze / decline / report action is always an MLRO decision with dual attestation (UAE Federal Decree-Law 10/2025 Art.16/18; FATF R.26). |
| **Monitoring** | `test/sanctions-match.test.mjs`, `test/sanctions-match-fuzz.test.mjs`, `test/engine_test.py` recall-gap check every push/PR; daily Sanctions Screen run log + coverage-degradation alarms. |
| **Performance metrics** | Cross-script recall parity within bound (CI); standing matches recorded once, new/changed matches always alert. |
| **Retirement criteria** | Replace if the firm adopts a commercial screening engine (e.g. World-Check); the card and the egress allowlist would be revised and re-validated. |
