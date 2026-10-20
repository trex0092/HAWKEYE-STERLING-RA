# GitHub repository review for worldwide screening

Reviewed 25 public GitHub repositories on 2026-10-13 for sanctions, PEP, adverse media, entity resolution, source ingestion, and analyst data preparation. The review used each repository's GitHub metadata and README where available. Stars and last-push dates are discovery signals, not quality or regulatory approval.

## Recommended additions to evaluate

These are libraries or architectural references to evaluate in the existing pipeline. The review does not recommend copying whole applications or adopting an external data feed without source, license, freshness, and coverage checks.

| Repository | License / activity observed | Useful contribution | Fit for this repository |
|---|---|---|---|
| [rapidfuzz/RapidFuzz](https://github.com/rapidfuzz/RapidFuzz) | MIT; actively maintained | Fast string distance and fuzzy matching in Python and C++ | Check current dependencies and benchmark against present name scoring. Add only if it improves multilingual alias matching or throughput. |
| [moj-analytical-services/splink](https://github.com/moj-analytical-services/splink) | MIT; actively maintained | Scalable probabilistic record linkage across SQL backends | Strong candidate for offline identity deduplication and calibration experiments; keep the existing runtime path until measured recall and false-positive effects are known. |
| [dedupeio/dedupe](https://github.com/dedupeio/dedupe) | MIT; active, last push observed 2025-07-29 | Trainable fuzzy matching and entity resolution | Candidate for reviewed, labelled-match evaluation sets and entity consolidation, not an unreviewed production replacement. |
| [opensanctions/yente](https://github.com/opensanctions/yente) | MIT software; actively maintained | On-prem search and bulk matching API for FollowTheMoney entities | Evaluate as an optional adapter or comparator. OpenSanctions dataset terms are separate from the software license; commercial use may require a data license. |
| [opensanctions/followthemoney](https://github.com/opensanctions/followthemoney) | MIT; active | Entity model for people, companies, assets, relationships, and financial-crime data | Useful schema reference for richer alias, relationship, and source-provenance records. Map fields deliberately rather than replacing the repository's established schema. |
| [jamesturk/jellyfish](https://github.com/jamesturk/jellyfish) | MIT; active | Phonetic and approximate string comparison algorithms | Candidate for transliteration and phonetic benchmark tests. Use only as a complementary signal with language-aware evaluation. |
| [adbar/trafilatura](https://github.com/adbar/trafilatura) | Apache-2.0; actively maintained | Article text and metadata extraction from web pages | Candidate for extracting evidence from already permitted article URLs, with source attribution, robots/terms checks, and safe URL handling. |
| [scrapy/scrapy](https://github.com/scrapy/scrapy) | BSD-3-Clause; actively maintained | General-purpose crawler framework | Useful only for approved, rate-limited public source ingestion. It does not make a source lawful, stable, or suitable by itself. |
| [pycountry/pycountry](https://github.com/pycountry/pycountry) | LGPL-2.1; active | ISO country, subdivision, language, currency, and script data | Useful for normalization and validation of country/language codes. Review LGPL obligations before bundling it. |
| [OpenRefine/OpenRefine](https://github.com/OpenRefine/OpenRefine) | BSD-3-Clause; active | Human-facing data cleaning, clustering, and reconciliation | Useful as an analyst-side workbench for source-list QA and research. It is a separate application, not a runtime dependency. |
| [J535D165/recordlinkage](https://github.com/J535D165/recordlinkage) | BSD-3-Clause; last push observed 2024-02-21 | Modular record-linkage comparisons and classifiers | Useful as a reference for offline comparisons; maintenance is less current than Splink, so review before adoption. |
| [AI-team-UoA/pyJedAI](https://github.com/AI-team-UoA/pyJedAI) | Apache-2.0; active | End-to-end entity-resolution algorithms and workflows | Research/benchmark option for alternative blocking and matching strategies; assess its dependency footprint before production use. |

## Data and source projects: use only after provenance review

| Repository | License / activity observed | Useful contribution | Limitation and disposition |
|---|---|---|---|
| [opensanctions/opensanctions](https://github.com/opensanctions/opensanctions) | MIT for code; actively maintained | Public sanctions/PEP collection, normalization, deduplication, and export pipeline | The README states generated data is CC BY-NC 4.0, while some bundled files are third-party material that OpenSanctions cannot license. Commercial data use needs separate licensing review. Reuse pipeline ideas or evaluate a licensed service; do not vendor its dataset into this commercial product by default. |
| [opensanctions/offshore-graph](https://github.com/opensanctions/offshore-graph) | MIT; last push observed 2024-12-17 | Example linking OpenSanctions and ICIJ OffshoreLeaks in an investigation graph | Older demo; its name-based links need independent validation and are not findings. Reference only for analyst graph workflows. |
| [opensanctions/api-examples](https://github.com/opensanctions/api-examples) | MIT; last push observed 2024-05-09 | Sample API requests and client usage | Useful for integration examples only; verify API and dataset terms, endpoint behavior, and current documentation first. |
| [proofaml/global-pep-census](https://github.com/proofaml/global-pep-census) | Repository metadata did not declare a license; README describes CC BY 4.0 for its compilation/resolution layer and per-source terms | Research snapshot of 51,751 PEP records, with source-level license manifest | README labels it a snapshot dated 2026-08-24 and says it is not current production data. Use only for a controlled benchmark after reviewing NOTICE and every upstream license; do not treat as a live global PEP feed. |
| [PatrickAttankurugu/AfricaPEP](https://github.com/PatrickAttankurugu/AfricaPEP) | MIT; updated 2026-07-17 | Africa-specific PEP application with 54-country scope and audit-trail concepts | README says Wikidata is its sole source. This can provide a regional comparison and tests, but does not establish complete government-source coverage for all 54 countries. Verify row-level provenance and freshness before any data reuse. |
| [brunofonsousa/peps](https://github.com/brunofonsousa/peps) | MIT; last push observed 2022-07-19 | Brazil-focused PEP data retrieval example | Stale and jurisdiction-specific. Research pointer only; verify current official source and data terms before using. |
| [cylon56/ofac-naughtylist](https://github.com/cylon56/ofac-naughtylist) | MIT; active, updated 2026-10-13 | Extracts sanctioned digital-currency addresses from OFAC SDN Advanced XML | Narrow crypto-address supplement, not a general sanctions feed. Check whether the existing pipeline already covers the same identifiers before adding. |
| [covyr/uk-sanctions-list](https://github.com/covyr/uk-sanctions-list) | No license declared; last push observed 2026-05-13 | UK sanctions CSV cleanup and column normalization | A code assignment project, with no reuse license declared. Do not copy code or redistributed output; compare transformation ideas only. |
| [Vishukk1503/sanctions-parser](https://github.com/Vishukk1503/sanctions-parser) | No license declared; updated 2026-08-18 | Recent CLI concept for downloading and normalizing OFAC, UN, EU, and UK lists | No reuse license was declared in repository metadata. Inspect tests, official-source provenance, update cadence, and parsing edge cases; do not import without a license. |

## Screening examples: benchmark patterns only

| Repository | License / activity observed | Useful contribution | Limitation and disposition |
|---|---|---|---|
| [anil-turan/sanctions-pep-screening](https://github.com/anil-turan/sanctions-pep-screening) | No license declared; updated 2026-07-22 | Compares five fuzzy algorithms and describes recall-anchored threshold tuning and alert triage | Small notebook project with no declared reuse license. Review its evaluation design, but reproduce benchmarks against this repository's own labelled cases. |
| [Rahim5536/AML-Sanctions-Fuzzy-Matching](https://github.com/Rahim5536/AML-Sanctions-Fuzzy-Matching) | No license declared; updated 2026-07-19 | Demonstrates string normalization and phonetic matching on mock data | No reuse license and mock lists; not a production source or validated screening engine. |
| [ntnon/FIND-A-PEP](https://github.com/ntnon/FIND-A-PEP) | No license declared; last push observed 2025-09-03 | Norway-specific PEP lookup challenge application | Small challenge project with API-key-dependent news enrichment and no declared reuse license. Do not import. |

## Decision

Evaluate RapidFuzz, Splink, Dedupe, Yente, FollowTheMoney, Jellyfish, and Trafilatura against the current implementation with labelled examples, measured recall, false-positive rate, throughput, and multilingual coverage. OpenRefine is the strongest separate analyst-workbench candidate. Treat all external datasets independently from code licenses. The repository should ingest only traceable, legally reusable, freshness-monitored sources and preserve source-level attribution and failure status.

The review does not claim that any external project supplies complete worldwide coverage. A library or dataset can improve a specific capability while runtime evidence still reports provider outages or identity gaps.
