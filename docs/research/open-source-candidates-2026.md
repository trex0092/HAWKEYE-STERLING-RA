# Open-source candidates for this repository — evaluation (2026-10-08)

**Owner:** Compliance Engineering (maintainer) · **Status:** research note, no
adoption decided. Adopting any row below is a separate change. A row that
would touch the screening matcher must go through the recall-monotone
invariant (`test/fixtures/screening-benchmark/floors.json`).

**Why a separate note.**
[`../governance/screening-open-source-adoption.md`](../governance/screening-open-source-adoption.md)
records the 12 screening repositories whose *patterns* were already adopted.
Open PR #815 adds two shadow benchmarks (opensanctions/rigour,
moov-io/watchman). This note covers **20 further repositories**, chosen for the
gaps this repository records in its own documents. They are not taken from a
generic "AML tools" list.

**The constraint that decides every row.** The repository has **zero runtime
dependencies** (`CLAUDE.md`; [ADR-002](../governance/adr-002-zero-runtime-dependencies.md)).
So a candidate can only be adopted in one of three ways:
**(a)** a CI or development tool, hash-locked and never shipped;
**(b)** a data source or schema;
**(c)** a design pattern re-implemented natively.
Anything that must run inside the app, the engine or the MCP server is
"pattern only" by definition.

**How each row was checked.** Licence and status were taken from the project's
own README or package metadata where the search reached it, otherwise from
package-registry or third-party metadata (marked *secondary*). **No LICENSE
file was opened directly.** This session's GitHub access is scoped to this
repository only. Confirm each LICENSE file before adoption.

## Candidates

| # | Repository | Licence (how verified) | Gap it addresses here | Mode | Recommendation |
|---|---|---|---|---|---|
| 1 | [IBM/AMLSim](https://github.com/IBM/AMLSim) | Apache-2.0 (secondary: repo trackers, IDB catalogue) | `txn_monitor.py` is inert with no feed (open action 6), so its rules have only been tested on small hand fixtures. AMLSim generates synthetic transactions with **known** laundering patterns | (a) offline fixture generation in CI | **High.** Generate a synthetic fixture once, commit only the synthetic output, and measure rule recall per pattern |
| 2 | [NVIDIA/garak](https://github.com/NVIDIA/garak) | Apache-2.0 (secondary; moved from GPL) | Prompt-injection testing today is `test/redteam_injection.py` plus a manual campaign (open action 15). garak adds a maintained probe library (OWASP LLM01, LLM02, LLM07) | (a) dispatch-only workflow against the Advisor | **High.** Run like `advisor-eval.yml`: dispatch-only and budget-capped, because live probes cost model spend (see open action 40) |
| 3 | [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | MIT (project README) | Same gap as row 2, in Node, so it would be a devDependency with no Python toolchain | (a) | Medium. A reported 2026 change of ownership is a supply-chain consideration; pick **one** of rows 2 and 3 |
| 4 | [Azure/PyRIT](https://github.com/Azure/PyRIT) | MIT (secondary) | Same as row 2 | (a) | Low. Overlaps garak |
| 5 | [UKGovernmentBEIS/inspect_ai](https://github.com/UKGovernmentBEIS/inspect_ai) | MIT (PyPI classifiers) | `scripts/advisor-eval.mjs` is a hand-rolled harness; Inspect is a maintained evaluation framework | (a) | Low-medium. Only if the eval suite outgrows the harness |
| 6 | [usnistgov/OSCAL](https://github.com/usnistgov/OSCAL) | Not confirmed in search; NIST work is generally public domain in the US (**unverified**) | `data/ai-controls.json` and the new ISO 27001 SoA draft are bespoke formats. OSCAL is the machine-readable control format auditors' tools read | (b) schema | Medium. Export the control register to OSCAL once the SoA is approved |
| 7 | [oscal-compass/compliance-trestle](https://github.com/oscal-compass/compliance-trestle) | Apache-2.0 (file headers, PyPI) | Tooling to author and validate OSCAL (row 6) | (a) | Medium. Pairs with row 6 |
| 8 | [openownership/data-standard](https://github.com/openownership/data-standard) (BODS) | Apache-2.0 (the standard's own site) | UBO extraction (Cabinet Decision 109/2023) and `hawkeye_related_parties` use an ad-hoc shape | (b) schema / (c) | Medium. Align the UBO record shape to BODS 0.4 |
| 9 | [mitre-atlas/atlas-data](https://github.com/mitre-atlas/atlas-data) | **Not confirmed**; ATLAS content is under MITRE's terms of use (secondary) | Map the red-team log to ATLAS technique IDs | (b) | Hold until the terms are read |
| 10 | [explodinggradients/ragas](https://github.com/explodinggradients/ragas) | Apache-2.0 (secondary: Snyk) | `scripts/verified-legal-retrieval.mjs` has no retrieval-quality metric | (a) | Low now. Only once retrieval is connected to the Advisor |
| 11 | [confident-ai/deepeval](https://github.com/confident-ai/deepeval) | Apache-2.0 (vendor page, PyPI) | Same as row 10 | (a) | Low. Overlaps row 10 |
| 12 | [fsfe/reuse-tool](https://github.com/fsfe/reuse-tool) | GPL-3.0-or-later for the tool, mixed (secondary). CI-only use, so nothing is shipped | Draft SoA control 5.32: **no register of third-party licences** (fonts, data sources) | (a) | Medium. `reuse lint` in CI gives every file a licence statement |
| 13 | [aboutcode-org/scancode-toolkit](https://github.com/aboutcode-org/scancode-toolkit) | Apache-2.0 (secondary) | Same gap as row 12, by scanning instead of annotating | (a) | Low-medium. Pick one of rows 12 and 13 |
| 14 | [tgherzog/wbgapi](https://github.com/tgherzog/wbgapi) | MIT for the code (secondary); the data falls under World Bank terms. WGI data itself is CC BY 4.0 per the World Bank data portal | Country risk: a licence-clean replacement for the corruption factor that was dropped with TI's CPI | (a) fetch in CI → (b) committed data | **High**, but only as part of a country-score method change, which is the MLRO's decision (`scripts/country-score.mjs` header) |
| 15 | [datasets/country-codes](https://github.com/datasets/country-codes) | PDDL (secondary: DataHub mirrors) | `scripts/country-score.mjs` matches countries by app display name and throws on unknown names. ISO codes would make cross-list joins robust | (b) | Low-medium |
| 16 | [J535D165/recordlinkage](https://github.com/J535D165/recordlinkage) | BSD-3-Clause (PyPI) | Another matcher to benchmark in shadow, like yente (`yente-bench.yml`) | (a) shadow benchmark | Low. splink is already the adopted pattern |
| 17 | [dedupeio/dedupe](https://github.com/dedupeio/dedupe) | MIT (project README) | Same as row 16 | (a) | Low |
| 18 | [jamesturk/jellyfish](https://github.com/jamesturk/jellyfish) | BSD-style (secondary; the project may have moved to Codeberg) | Phonetic algorithms (Metaphone, Soundex and others) as a recall comparison for Latin-script names | (a) shadow benchmark | Low-medium |
| 19 | [NVIDIA-NeMo/Guardrails](https://github.com/NVIDIA-NeMo/Guardrails) | Apache-2.0 (project README, packaging) | Runtime guardrails: they would be a runtime dependency, which is **barred** | (c) pattern only | Do not adopt. Compare its rail types against `brain-soul.js` guards once |
| 20 | [guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails) | Apache-2.0 (README badge; 2024 snapshot) | Same as row 19 | (c) pattern only | Do not adopt |

## Shortlist

The rows that close a gap this repository already records:

1. **AMLSim (row 1):** proves `txn_monitor.py` rules on realistic synthetic
   volume before any real feed exists.
2. **garak (row 2):** a maintained prompt-injection probe set for the Advisor,
   dispatch-only.
3. **wbgapi plus World Bank WGI (row 14):** a licence-clean corruption and
   rule-of-law input for the draft country score.
4. **reuse-tool (row 12):** closes draft SoA control 5.32.

## Sources

Project pages are linked in the table. Licence evidence came from web search
results on 2026-10-08, including:
[promptfoo README](https://raw.githubusercontent.com/promptfoo/promptfoo/main/README.md),
[BODS about page](https://standard.openownership.org/en/0.4.0/about),
[compliance-trestle on PyPI](https://pypi.org/project/compliance-trestle/3.12.4/),
[recordlinkage on PyPI](https://pypi.org/project/recordlinkage),
[World Bank WGI: Control of Corruption](https://data.worldbank.org/indicator/GOV_WGI_CC_EST)
(CC BY 4.0, 2025 revision) and
[DeepEval](https://confident-ai.com/frameworks/deepeval).
