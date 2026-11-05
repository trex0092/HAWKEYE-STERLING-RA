# Open-source candidates for this repository: second evaluation (2026-11-04)

**Owner:** Compliance Engineering (maintainer) · **Status:** research note, no
adoption decided. Adopting any row below is a separate change. A row that
would touch the screening matcher must go through the recall-monotone
invariant (`test/fixtures/screening-benchmark/floors.json`) and keep the
Python and JS matchers in agreement (`test/matcher-parity.test.mjs`).

**Why a second note.** The first note,
[`open-source-candidates-2026.md`](open-source-candidates-2026.md)
(2026-10-08), covered 20 repositories; the
[GitHub screening repository review](github-screening-repository-review-2026-10-13.md)
(2026-10-13) covered 25; and
[`../governance/screening-open-source-adoption.md`](../governance/screening-open-source-adoption.md)
records the 12 repositories whose patterns are already adopted and the two
shadow benchmarks (opensanctions/rigour, moov-io/watchman). **None of the 27
repositories below appears in those documents.** They were chosen for needs
this repository recorded in its own code and notes on 4 November 2026:

- `kyc.py` now screens employees from their full name, nationality and date
  of birth (PR #1107) and carries a hand-written demonym map (`_DEMONYMS`).
- The identity rule (`identity_exclusion_reason`) relies on clean name parts,
  birth years and nationalities; free-text name strings are the weak input.
- Adverse media (`scripts/adverse-media.mjs`, `LANG_TERMS`) reads non-English
  sources, and the Google News and GDELT routes are throttled on some days.
- The Arabic-name benchmark (`arabic-name-bench.yml`) measures cross-script
  recall and has no Arabic-specific tokeniser or named-entity reference.
- Related-party and UBO records (`hawkeye_related_parties` in `screen.py`,
  `ai.py`, `agents.py`, `mcp_tools.py`) are flat lists with no graph tooling.
- The MCP server (`mcp_server.py`) is tested by `test/mcp_tools_test.py` only;
  no protocol-level client exercises it.
- Only one JSON data file (`data/transaction-feed.schema.json`) has a schema.

**The constraint that decides every row.** The web app has zero runtime
dependencies, the MCP server is stdlib-only, and the Python engine runs with
the hash-locked set in `ci/requirements.txt` only (`CLAUDE.md`;
[ADR-002](../governance/adr-002-zero-runtime-dependencies.md)). `CLAUDE.md`
says not to add a runtime dependency to any surface, so no row below assumes
one. A candidate can be adopted in one of three ways:
**(a)** a CI or development tool, hash-locked and never shipped;
**(b)** a data source or schema, reviewed and committed;
**(c)** a design pattern re-implemented natively in the engine or the app.

**How each row was checked.** Each repository's GitHub project page was read
on 2026-11-04 (licence badge or LICENSE link, description, star count, and the
README statements quoted here). Three files were opened directly: the
feedparser LICENSE file, the nameparser particle list
(`nameparser/config/particles.py`) and the ICIJ database licence page. Star
counts are discovery signals,
not quality or regulatory approval. Where a fact could not be read it is
marked **not confirmed**; confirm every LICENSE file before adoption.

## A. Name handling and false-positive control

| # | Repository | Licence (as read 2026-11-04) | What it adds here | Mode | Recommendation |
|---|---|---|---|---|---|
| 1 | [datamade/probablepeople](https://github.com/datamade/probablepeople) | MIT · 623 stars | Parses an unstructured name string into labelled parts (given name, surname, suffix, corporation name) and tells a person from a company. `kyc.parse_employee` and `parse_customer` take names as free text today | (a) offline run over fixtures to label the name-split edge cases, then (c) encode the learnt rules natively | **Medium-high.** The identity rule is only as good as the name split |
| 2 | [derek73/python-nameparser](https://github.com/derek73/python-nameparser) | LGPL · 717 stars | Rule-based human-name splitter (title, first, middle, last, suffix, nickname). Its particle list (`nameparser/config/particles.py`, 76 entries, read directly) includes al, bin, bint, binte, binti, abu, ibn, de, van and von, plus the Arabic-script forms of bin, bint, ibn, al and abu | (a) only, used unmodified as a library in a CI job, as the governance note already does for python-stdnum; or (c) write the repository's own particle list from the same public facts, not from the LGPL code | Medium. The particles that matter for this customer base are present, which makes it a sound reference for `kyc.py` name splitting |
| 3 | [psolin/cleanco](https://github.com/psolin/cleanco) | MIT · 361 stars | Strips legal-form suffixes from company names (Ltd, LLC, GmbH and others) so "X Trading LLC" and "X Trading" score as one name | (c) pattern: a committed suffix table for the entity matcher | Medium. **Not confirmed:** whether its term list includes the UAE forms FZE, FZCO, FZ-LLC, DMCC and Est. Add them in the committed table if absent; the recall benchmark must not drop |
| 4 | [mledoze/countries](https://github.com/mledoze/countries) | ODbL-1.0 · 6.3k stars | World country data with demonyms (Emirati, Saudi, Indian and so on), native names, ISO codes and translations | (b) data: generate `_DEMONYMS` in `kyc.py` from it instead of maintaining the map by hand | **High.** ODbL requires attribution and share-alike for a derived database; record both in the licence register before committing |
| 5 | [anyascii/anyascii](https://github.com/anyascii/anyascii) | ISC · 424 stars · Python and JavaScript ports | Unicode-to-ASCII transliteration covering Arabic, Cyrillic, Chinese and more, with identical tables in both languages | (c) pattern, or (b) a committed transliteration table used by **both** matchers, which keeps `matcher-parity` true by construction | Medium-high. Compare against the current normaliser on the Arabic-name benchmark first |
| 6 | [CAMeL-Lab/camel_tools](https://github.com/CAMeL-Lab/camel_tools) | MIT · 590 stars | Arabic NLP suite. Its README abstract lists "pre-processing, morphological modeling, Dialect Identification, Named Entity Recognition and Sentiment Analysis"; datasets are installed separately with `camel_data` | (a) CI-only, beside `arabic-name-bench.yml`, to produce a tokenised Arabic reference set | Medium. The first use is measurement: how many UN Arabic names does the current gate miss because of prefixes and clitics |
| 7 | [philipperemy/name-dataset](https://github.com/philipperemy/name-dataset) | Apache-2.0 · 1.0k stars · 730K first names, 983K last names | Name-frequency and country priors that could down-weight very common names | None | **Do not adopt.** The README states the names were "extracted from the Facebook massive dump (533M users)". Personal data from a breach has no place in a regulated screening tool, whatever the code licence says |

## B. Identity data quality (employee and customer records)

| # | Repository | Licence (as read 2026-11-04) | What it adds here | Mode | Recommendation |
|---|---|---|---|---|---|
| 8 | [arthurdejong/python-stdnum](https://github.com/arthurdejong/python-stdnum) | LGPL-2.1 · 593 stars | Validators for IBAN, LEI and many national identity numbers. Already installed transitively in the `arabic-name-bench.yml` job as a dependency of rigour; **never imported by the engine** | (a) direct use in a CI data-quality job over the Asana exports; (c) re-implement only the LEI and IBAN check digits (public ISO algorithms) | Medium. **No UAE or Gulf module** is listed, so Emirates ID and UAE passport formats stay with the repository's own checks |
| 9 | [mdomke/schwifty](https://github.com/mdomke/schwifty) | MIT · 261 stars | IBAN and BIC validation and bank lookup | (a) or (c) | Low-medium. Relevant only when `txn_monitor.py` or `payment_screen.py` receive a feed |
| 10 | [daviddrysdale/python-phonenumbers](https://github.com/daviddrysdale/python-phonenumbers) | Apache-2.0 · 3.8k stars | Parses and validates telephone numbers and infers the country of a number | (a) CI data-quality job | Low-medium. A customer phone country that contradicts the stated nationality or residence is a cheap consistency signal |
| 11 | [JoshData/python-email-validator](https://github.com/JoshData/python-email-validator) | Unlicense · 1.4k stars | Syntax and optional DNS deliverability check for e-mail addresses | (a) CI data-quality job (DNS checks only in CI, never in the browser) | Low |
| 12 | [Arg0s1080/mrz](https://github.com/Arg0s1080/mrz) | GPL-3.0 · 392 stars | Checks passport and ID machine-readable zones (TD1, TD2, TD3) with ICAO 9303 check digits | (c) only: implement the check-digit arithmetic from the public ICAO Doc 9303 specification; **do not copy GPL code** into a repository whose code is not GPL | Low-medium. Useful only once MRZ lines are captured; HR dossiers hold passport numbers, not MRZ lines |
| 13 | [openvenues/libpostal](https://github.com/openvenues/libpostal) | MIT · 4.9k stars · C library with Python binding; model about 1.8 GB | Worldwide address parsing and normalisation | (a) offline CI job only, because of size | Low-medium. Address normalisation would help the related-party and residence consistency checks, but the model size makes it a weekly job at most |

## C. Adverse media

| # | Repository | Licence (as read 2026-11-04) | What it adds here | Mode | Recommendation |
|---|---|---|---|---|---|
| 14 | [pemistahl/lingua-py](https://github.com/pemistahl/lingua-py) | Apache-2.0 · 1.8k stars · 75 languages including Arabic, Persian, Urdu, Turkish, Russian, Chinese · works offline · v2.2.0 | Language identification for short and mixed-language text | (a) in the Python engine's CI path, or (c) a small natively implemented detector for the `LANG_TERMS` locales | Medium-high. Knowing an article's language before matching or translating removes a class of false hits from `LANG_TERMS` |
| 15 | [explosion/spaCy](https://github.com/explosion/spaCy) | MIT · 33.8k stars · v3.8 | Named-entity recognition: extracts the persons and organisations an article is actually about | (a) CI batch over the day's article hits | Medium-high. Confirms that a name hit is the article's subject rather than a passing mention. Each language model has its own licence; read it |
| 16 | [argosopentech/argos-translate](https://github.com/argosopentech/argos-translate) | Code dual-licensed MIT or CC0 · 6.5k stars · offline · Arabic and Turkish supported | Offline machine translation of article text | (a) CI only | Medium. The project page states no licence for the translation **models**; **not confirmed** until the model package metadata is read |
| 17 | [scrapinghub/dateparser](https://github.com/scrapinghub/dateparser) | BSD-3-Clause · 2.9k stars · more than 200 language locales | Parses human-written dates in many languages and scripts, including relative forms such as "2 days ago" | (a) CI, or (c) for the handful of locales in `LANG_TERMS` | Medium. Article dates and dates of birth in free text are the two inputs it fixes |
| 18 | [kurtmckee/feedparser](https://github.com/kurtmckee/feedparser) | BSD-2-Clause (LICENSE file read) · 2.4k stars | RSS and Atom parsing that tolerates malformed feeds | (c) pattern for `scripts/adverse-media.mjs`, which is JavaScript | Low-medium. Relevant if regulator and court RSS feeds are added as sources alongside Google News and GDELT |
| 19 | [WojciechMula/pyahocorasick](https://github.com/WojciechMula/pyahocorasick) | BSD-3-Clause · 1.1k stars | Aho-Corasick automaton: finds thousands of names in a text in one pass | (c) pattern: a native automaton in both matchers | Medium. Scanning each article once for every screened subject is the shape the daily batch already needs |

## D. Related parties, ownership and networks

| # | Repository | Licence (as read 2026-11-04) | What it adds here | Mode | Recommendation |
|---|---|---|---|---|---|
| 20 | [networkx/networkx](https://github.com/networkx/networkx) | BSD-3-Clause · 17.2k stars | Graph construction and analysis (shortest paths, components, centrality) | (a) offline analysis of `hawkeye_related_parties`; (c) for the two or three traversals the engine needs | Medium. Finds a listed party two hops from a customer, which flat lists cannot show |
| 21 | [ICIJ/offshoreleaks-data-packages](https://github.com/ICIJ/offshoreleaks-data-packages) | Repository README states no licence; the ICIJ database page states "licensed under the Open Database License" with contents "under Creative Commons Attribution-ShareAlike" and asks users to "Always cite the International Consortium of Investigative Journalists" · 251 stars · Neo4j 4.2 dump and CSV | Offshore entity, officer and intermediary records from the ICIJ leaks | (b) analyst research data in a CI benchmark only, never a screening list | Low-medium. A name in the data is not a finding. The disclaimer section of the ICIJ page was empty when read, so its wording is **not confirmed** |

## E. Documents and images

| # | Repository | Licence (as read 2026-11-04) | What it adds here | Mode | Recommendation |
|---|---|---|---|---|---|
| 22 | [JaidedAI/EasyOCR](https://github.com/JaidedAI/EasyOCR) | Apache-2.0 · 29.9k stars · 80+ languages including Arabic | OCR of identity document images | (a) offline tool run by the analyst or in a dispatch-only job | Medium. Reads the Emirates ID and passport data that today is typed into Asana by hand |
| 23 | [mindee/doctr](https://github.com/mindee/doctr) | Apache-2.0 · 6.3k stars · v1.1.0 | Document text detection and recognition with layout | (a) | Low-medium. Overlaps row 22; pick one |
| 24 | [ocrmypdf/OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF) | MPL-2.0 · 35.1k stars · Tesseract based | Adds a searchable text layer to scanned PDFs | (a) | Medium. The EOCN Local Terrorist List and some regulator PDFs are text already; the value is for scanned KYC documents and image-only circulars |

## F. Engineering and assurance

| # | Repository | Licence (as read 2026-11-04) | What it adds here | Mode | Recommendation |
|---|---|---|---|---|---|
| 25 | [python-jsonschema/jsonschema](https://github.com/python-jsonschema/jsonschema) | MIT · 5.0k stars | JSON Schema validation | (a) CI check of every `data/*.json` against a committed schema | **High.** Only `data/transaction-feed.schema.json` exists today; a bad hand edit to a sanctions or obligations file is caught by drift tests only indirectly |
| 26 | [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector) | README: "The MCP project is transitioning from the MIT License to Apache-2.0"; new code Apache-2.0, older contributions MIT, documentation CC-BY-4.0 · 11.2k stars | Protocol-level client for MCP servers (web, CLI and terminal interfaces) | (a) devDependency used in a CI smoke job against `mcp_server.py` | **High.** The server is stdlib-only and untouched by this; the inspector only talks to it |
| 27 | [duckdb/duckdb](https://github.com/duckdb/duckdb) | MIT · 41.1k stars | In-process SQL over CSV, JSON and Parquet files | (a) analyst and CI tool for list reconciliation and receipt analysis | Medium. Joining the UN, OFAC, EU, UK and EOCN exports by identifier for the reconciliation workflows is one query instead of a script each |

## Shortlist

Rows that answer a need this repository already records, in the order the
maintainer could take them:

1. **jsonschema (row 25)** and **MCP inspector (row 26)**: CI-only, no
   runtime surface touched, each closes a verification route the test suite
   does not have.
2. **mledoze/countries (row 4)**: replaces a hand-written demonym map with a
   maintained dataset under a documented licence.
3. **lingua-py (row 14)** and **spaCy (row 15)**: the two steps that turn a
   name hit in a foreign-language article into a subject-confirmed hit.
4. **probablepeople (row 1)** and **anyascii (row 5)**: better name parts and
   one transliteration table for both matchers; measure on the benchmark
   before and after, and the floors must not move down.
5. **Do not adopt** name-dataset (row 7) and do not copy GPL code from mrz
   (row 12).

## Sources

All pages read on 2026-11-04.

- https://github.com/datamade/probablepeople
- https://github.com/derek73/python-nameparser
- https://github.com/psolin/cleanco
- https://github.com/mledoze/countries
- https://github.com/anyascii/anyascii
- https://github.com/CAMeL-Lab/camel_tools
- https://github.com/philipperemy/name-dataset
- https://github.com/arthurdejong/python-stdnum
- https://github.com/mdomke/schwifty
- https://github.com/daviddrysdale/python-phonenumbers
- https://github.com/JoshData/python-email-validator
- https://github.com/Arg0s1080/mrz
- https://github.com/openvenues/libpostal
- https://github.com/pemistahl/lingua-py
- https://github.com/explosion/spaCy
- https://github.com/argosopentech/argos-translate
- https://github.com/scrapinghub/dateparser
- https://github.com/kurtmckee/feedparser and https://raw.githubusercontent.com/kurtmckee/feedparser/develop/LICENSE
- https://github.com/WojciechMula/pyahocorasick
- https://github.com/networkx/networkx
- https://github.com/ICIJ/offshoreleaks-data-packages and https://offshoreleaks.icij.org/pages/database
- https://github.com/JaidedAI/EasyOCR
- https://github.com/mindee/doctr
- https://github.com/ocrmypdf/OCRmyPDF
- https://github.com/python-jsonschema/jsonschema
- https://github.com/modelcontextprotocol/inspector
- https://github.com/duckdb/duckdb
