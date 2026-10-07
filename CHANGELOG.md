# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the application follows the `APP_VERSION` constant in [`app.js`](app.js).
Release tags and notes are also generated automatically by the
[Auto Release workflow](.github/workflows/auto-release.yml) on every version
bump merged to `main`.

## [Unreleased]

- **Enterprise AI governance: six-layer control system added.**
  - Added an original Policy → Roles & Accountability → Risk Management → Data & Model Governance → Monitoring & Controls → Audit & Assurance crosswalk, plus a repository-native Mermaid diagram.
  - Added `data/ai-controls.json` as the machine-readable control map, with generated ownership, dashboard and residual-risk views.
  - Added an AI use-case intake gate, AI-vendor assurance view, explicit residual-risk acceptance ledger and consolidated control-testing calendar.
  - CI now validates control ownership/status, every referenced evidence/test path, the quarterly register-review deadline, explicit risk-acceptance evidence and generated-view drift. The dashboard stays honest about incomplete human/external work rather than converting a green build into a governance approval.

- **Sanctions: national-source depth 48 → 54 / 195. Six national sanctions lists added and verified on the runner; two non-financial proscription candidates are recorded but disabled.**
  - **How they were found.** A new fixed probe suite (`opensanctions-catalogue`, run 37147223927) read the OpenSanctions `sanctions` collection that the daily engine's worldwide net already screens: 95 member datasets, each with its publisher. Six are national sanctions or terrorist-financing lists that increase national-source depth. Two others, Germany and Ireland, are proscription sources rather than financial-sanctions lists; they are retained as disabled research references and are not loaded by the sanctions screen.
  - **Added.** The six qualifying national sources are enabled with coverage floors. Germany and Ireland remain disabled because loading them as sanctions sources would overstate national financial-sanctions coverage. A second probe (run 37147471222) parsed each one; floors are about 85% of the count.

    | Country | Registry id | Publisher | Names |
    | --- | --- | --- | --- |
    | Austria | `at-oenb-terror` | Austrian National Bank | 81 |
    | Bulgaria | `bg-dans-mft` | State Agency for National Security | 30 |
    | Serbia | `rs-apml-domestic` | APML (7 persons, matching the 2018 Government decision) | 21 |
    | Romania | `ro-onpcsb-terror` | ONPCSB, GD 1.272/2005 | 458 |
    | Nepal | `np-moha-prohibited` | Ministry of Home Affairs | 18 |
    | Iraq | `iq-aml-freeze` | AML/CFT Office; Latin-script names, unlike the Arabic-only API | 14,801 |
    | Germany | `de-bfv-banned-orgs` | BfV association bans; proscriptions, not financial sanctions | 31 |
    | Ireland | `ie-unlawful-orgs` | Offences Against the State Acts orders; proscriptions | 5 |

  - **Not added.** Russia (MFA counter-sanctions), Iran (MFA sanctions list) and Vietnam (MPS terrorist list) are also in the collection. They stay an MLRO decision and get no registry entry.
  - **Probe.** `scripts/source-probe.mjs` gains two fixed suites, `opensanctions-catalogue` and `news-feeds`, whose URLs are fixed in code. It also accepts several registry ids in one dispatch.

- **Asana: AI and platform cards file under "AI & Platform Governance", not "Regulatory Changes".**
  - **Cause.** Earlier gids of the "AI & Platform Governance" section had been deleted, so #701/#703 pinned the AI Governance & Platform Report, Advisor Eval, the weekly summary and every fallback platform alert to "Regulatory Changes", where they sat among law changes. The section now exists in the live project (gid 1218985347982681) and is registered as an approved destination in `scripts/asana-sections.mjs`, pinned by gid and never created by name.
  - **Now filed there:**
    - the daily AI Governance & Platform Report, Advisor Eval and the weekly summary;
    - platform-health alerts: production drift, workflow recovery blocked, control stale, function/site down, code scan failed, and morning dispatch / 09:00 delivery guard;
    - the FATF monitoring-gap alert and the RA ↔ Asana reconciliation;
    - a Regulatory Watch card that reports only unreachable sources (it is not mirrored to the law-change queue).
  - **Unchanged.** Law and list changes (Regulatory Watch content changes, FATF list changes, EOCN reviews), screening findings and document follow-ups keep their sections.

- **Regulatory Watch: change cards name the exact publication, link to it, and say what it means.**
  - **Before.** A card showed long lowercased runs of page text (OFAC on 3 Oct: "department of the treasury read the latest treasury news … menu about ofac history …"), with HTML codes left raw ("treasury&#39;s", "page 3 &hellip;"), and no link to the item that was issued. The AI analysis was written to a file and never reached the card.
  - **New and withdrawn items.** Every good fetch also snapshots the page's titled links (`data/reg-watch-snapshots/<id>.links.json`). A change lists each new item and each item no longer listed, by its title as printed (original case) and linked to the instrument, e.g. "🆕 New item: Counter Terrorism Designations; Iran-related Designations and Designations Updates". Generic link texts ("Read more", "اقرأ المزيد", page numbers) and tracking/session parameters are ignored. A new item's title also counts toward severity. The first item snapshot of each source is persisted on its first run, so items are listed from the next change.
  - **Plain text.** HTML character references are decoded in the card's excerpts. Decoding is for display only: fingerprints are unchanged, because Sanctions Watch shares them and every list containing `&amp;` would otherwise fire one false "list changed" alert.
  - **Provenance.** Each change states which two versions were compared and how each was obtained, e.g. "version of 2026-10-02 (direct fetch) → version of 2026-10-03 (web.archive.org snapshot …)".
  - **AI analysis on the card.** When the AI step runs, it is given the new and withdrawn items and returns five labelled lines that appear on the card: what changed, impact on a UAE DPMS, action to consider, instrument (number, date, authority) and effective date. A line the text does not support reads "not stated"; a line the model omits stays absent. The card marks it "verify against the source before acting".

- **Regulatory Watch: archive.org reads wait their turn and back off longer, so a rate-limited capture is not reported as an outage.**
  - **Cause.** On 3 Oct 2026 (run 37145525927) the OECD responsible-business-conduct page answered HTTP 403 directly. archive.org held a capture from 2 Oct, but all three reads of it got HTTP 429 within about 30 s while other sources' archive reads ran in parallel. The source was reported "persistently unreachable" for a 3rd run, opening an Asana monitoring-gap card.
  - **Fix.** Capture reads are serialized (one archive.org read at a time across all sources), get a 4th attempt on a 15 s linear base, and honour `Retry-After` up to 30 s. A failure that persists is still returned as the failure; no page is ever assumed.

- **Regulatory Watch: no more daily false alerts from re-stamped footers, and change cards show the exact words that moved.**
  - **Cause.** The UAE Ministry of Economy homepage ends with "آخر تحديث للمحتوى بتاريخ: 02 اكتوبر 2026" ("content last updated: …"). That date changes every day, and the noise filter stripped only numeric dates. So the page was filed as a source change on both 3 Oct 2026 runs, with identical-looking excerpts on each side.
  - **Stamp filter.** "Last updated" stamps written with a month name, in English or Arabic, are now stripped. The filter is scoped to the stamp phrase, so a dated entry in a list of actions (e.g. OFAC's "october 02, 2026 - sanctions list updates") remains content.
  - **No false wave on upgrade.** Fingerprints carry a version (`FP_VERSION` = 2). A stored hash from the old filter is re-checked against its stored snapshot re-filtered with the new rules. It is re-baselined only if the content is identical; otherwise it is reported as a change, which is the safe direction.
  - **Word-level comparison.** Modified segments are paired, and the card shows the changed words in context, e.g. `⟦launches⟧` → `⟦launched⟧`. Pure re-ordering or re-segmenting is not a content change.
  - **Severity on changed words only.** The 3 Oct EU AI Act edit had been rated 🔴 HIGH because the unchanged text contained "standard"; it now rates 🟢 LOW. OFAC's real 2 Oct designations entry still rates 🔴 HIGH.
  - **Nothing hidden.** Changes that were not alerted are listed in the report with the reason.

- **Report: a confidence tier that rests on the distinctive name now says so.** The 3 Oct 2026 report showed a line of the form "<list>: \"<short designation>\" 8% · STRONG". The percentage is the conservative min(full, core) score. The tier is the distinctive-name (core) score, here 100%, because the short-designation rule must still catch "Hamas General Trading LLC" against "HAMAS". Such lines now read "8% · STRONG on the distinctive name (100%; full name 8%)". This changes the display only; matching, scoring, tiers and recall are unchanged.

- **FATF watchdog: a false grey-list "removal" of Côte d'Ivoire and Lao PDR is fixed, and the stored lists self-repair.**
  - **What happened.** On 3 Oct 2026 the watchdog read an archived FATF page (web.archive.org snapshot 20261002051513) that wrote "Côte d'Ivoire" and "Lao People's Democratic Republic" with a typographic apostrophe or an HTML entity. Its dictionary matched only the plain apostrophe, so both names dropped out of the grey list. It alerted that the FATF had removed them, and it overwrote the stored state with 20 jurisdictions instead of 22.
  - **What is true.** The FATF statement of 19 June 2026 still lists both, and there has been no plenary since; the next is 26–30 October 2026.
  - **Parser fix.** Entities and apostrophe variants are now folded before classification (`foldEntities`).
  - **Plenary anchor.** A page that agrees exactly with the recorded plenary lists in `data/fatf-assessments.json` repairs a disagreeing stored state silently instead of alerting. This also covers the stale-capture branch.
  - **Removal check.** A removal whose name is still spelt on the page (compared on letters only) is recorded as parser drift, never alerted as a delisting.
  - **Gap alert wording.** The alert title now reads "lists not verified" instead of "list source unreachable".
  - A pinned correction was posted on the Asana alert task.
- **Screening matcher: apostrophe variants and HTML entities now key like the plain spelling in both engines.** This applies to `normalizeName` in `sanctions-match.mjs` and `normalize` in `screen.py`, which are kept byte-identical.
  - **Before.** "OʼBrien" (U+02BC, common in transliterated names) keyed as one letter-token and was routed to MANUAL REVIEW as lost script. "O&#39;Brien" keyed as "O 39 BRIEN" and "Smith &amp; Co" as "SMITH AMP CO", so none of them met the plain spelling.
  - **After.** Plain-apostrophe names keep exactly the key they had.
  - **Benchmarks.** Every recall and negative floor held. The parity corpus gained 5 names and 2 pairs, both scoring 100 in each engine.
  - **Property tests.** The fuzz property "ASCII names keep their historic key" now excludes strings carrying an HTML character reference. A new, stricter property requires such names to key exactly as their decoded form.

- **Three more national sanctions lists are screened; national-source depth rises from 45 to 48 of 195 countries.** Each list is read from the issuing authority's own publication, and each count was checked against a second read of the same document.
  - **Lebanon:** the ISF National Terrorism Financial List (Law No. 44/2015) is fetched live from isf.gov.lb on every run. The download link is resolved from the official page each time. The file is a legacy Excel 97-2003 workbook, so the screen gained a stdlib-only `.xls` reader (OLE2 compound file + BIFF8, `parseXlsSheets`, parser `lbisf`). Source-probe run 37128209902 confirmed the format. Run 37128512274 read 286 names on the runner, the same count and order as an independent read of the same file.
  - **Somalia:** both NAMLC lists of Al-Shabaab financiers and leaders, NAMLC/001/24 and NAMLC/002/24 (17 persons), are kept in `data/so-namlc-curated-list.json`, transcribed from the primary PDFs.
  - **Côte d'Ivoire:** CENTIF's consolidated national UNSCR 1373 list (update of 4 July 2025, 78 persons) is kept in `data/ci-centif-curated-list.json`. A script checks that every name and alias occurs verbatim in the official text.
  - **Register corrections.** Fiji is now `assessed-not-loadable`: its FIU states there are currently no local designations. Armenia stays `identified`: its 2021 list (341 individuals, 13 entities) was read, but the PDF text garbles the Arabic script and one entry, so it is not screened until a second independent extraction verifies it.
  - **Further research recorded, nothing loaded yet.**
    - Serbia's 2018 government decision (7 persons) is a scanned PDF whose machine-read names are garbled.
    - Bulgaria's Council of Ministers list (Decision No 265/2003, last amended 16 Aug 2024) is a consolidated PDF that must be reconciled with each amendment.
    - Trinidad and Tobago's FIU portal is a session-bound search form with no downloadable file link (source-probe run 37129541443).

- **Screening hardening.**
  - **Thin news coverage now earns a same-day make-up sweep.** On 3 Oct 2026, 972 of 996 subjects were reached by Bing alone. That counted as covered, so the 03:07 make-up firing exited in 40 s. Run metrics now record feed reach as counts only. When at least `MAKEUP_THIN_FEED_PCT` (default 50%) of the book had one feed or none, a fresh runner re-sweeps. A make-up run never re-triggers on this ground, so it runs at most once a day.
  - **The Wikidata PEP net reports a stale harvest.** If the weekly harvest is older than `PEP_WIKIDATA_MAX_AGE_DAYS` (default 14) or undated, the run logs it and §③ says STALE. The net still screens.
  - **The manual Daily Sanctions Screening workflow downloads the UK Sanctions List.** It was still fetching the OFSI ConList, which closed on 28 Jan 2026 and has been frozen since 3 Jun. The run script's header-scanning parser already reads the new file's Name 1..6 layout.

- **GDELT recovers during the run instead of staying off.** On 3 Oct 2026 GDELT returned HTTP 429 in the first two minutes. The breaker opened at 00:07 UTC, and GDELT then reached 0 of 996 subjects for the rest of the 28-minute run. The GDELT breaker is now half-open like Google News: one probe query every `GDELT_PROBE_SECONDS` (default 300 s), and a success closes the circuit.

- **FATF Watchdog and Regulatory Watch recover archived pages instead of skipping.** Both read archive.org captures when the official site blocks the GitHub runner. On 3 Oct 2026 a capture existed for each, but its single read got HTTP 429, so the FATF lists went unverified for an 8th run in a row and the UAE NAMLCFTC page for a 3rd.
  - Capture reads now retry 429, 5xx and network errors with backoff and honour Retry-After.
  - FATF tries the newest three captures, in raw and normal form.
  - Regulatory Watch also uses a fresh capture that Save Page Now redirects to on a 429.
  - A 404 is never retried, and no page is ever fabricated.

- **Free official sources first, and a licence-free mode.** OpenSanctions states that businesses must acquire a data licence. The engine now needs none for its core screening.
  - **Official lists are the primary source.** The Python daily screen reads the UK Sanctions List (official FCDO CSV), EU FSF (official webgate XML), Australia DFAT (official .xlsx) and Switzerland SECO (official XML) directly. On 3 Oct 2026 the JS engine loaded these same files: UK 58,311, EU 31,070, AU 11,413 and CH 44,361 names. The OpenSanctions mirrors are now only fallbacks. The DFAT and SECO parsers are ported from `scripts/sanctions-match.mjs`.
  - **Free worldwide PEP net.** The Python screen now also runs the repo's own Wikidata PEP harvest, which is CC0. The 2 Oct 2026 harvest holds 423,826 office-holders. The report names its harvest date.
  - **Licence-free mode.** The repository variable `OPENSANCTIONS_DATA=0` stops every download from `data.opensanctions.org` in both engines. That covers the mirror fallbacks, the PEP/RCA net, the crime watchlist, the extra nets, the worldwide sanctions net, the EOCN cross-check and the 28 OpenSanctions-hosted national lists. Each switched-off net is named OFF in the report. Licence-free mode loses the relatives / close associates (RCA) bulk net and the crime watchlist, and the report says so. Unset = today's behaviour.
  - **Report fix.** The bulk adverse-source lines in §② now print on every run, not only on days with adverse findings.

- **Optional extra bulk adverse-media nets: OpenSanctions debarment and regulatory.** On 3 Oct 2026 the daily report showed GDELT reaching 0 of 996 subjects and Google News 24, so 972 subjects rested on one news feed. Bulk nets do not depend on news feeds being reachable. Setting the repository variable `ADVERSE_WATCHLIST_EXTRA=debarment,regulatory` now screens every subject, alongside the crime watchlist, against the OpenSanctions **debarment** collection (61 sources, 197,914 targets on 3 Oct) and the **regulatory** collection (37 sources, 163,209 targets on 2 Oct). It uses the same matcher, and each hit is titled and linked to its dataset.
  - **Off by default:** the data is CC-BY-NC 4.0, and a commercial deployment needs an OpenSanctions licence first (`docs/aims/third-party-register.md` updated).
  - **Reporting:** a failed download is shown as UNAVAILABLE in §② and never reads as clear. Crime-list findings keep their exact titles, so delta fingerprints are unchanged.
- **Faster delivery of the daily screening results.** On 2 Oct 2026 (run 37009296159) the run took about 59 minutes: watchlist 6.7, sanctions 8.7, news enrichment 39, AI 3.8. Coverage and matching are unchanged; only the waiting is cut.
  - The news enrichment now **starts before** the watchlist and sanctions matching, which it never depended on, and is collected after them. That overlaps about 15 minutes of CPU-bound matching with the network sweep. A crash during matching cancels the queued sweep rather than waiting it out.
  - The **Google News breaker** also trips after `GNEWS_BREAKER_SECONDS` (default 300 s) of zero-coverage subjects at max backoff, not only after 30 subjects. On 2 Oct those 30 subjects cost about 29 minutes, all at zero coverage anyway.
  - While the breaker is open, a **recovery probe** (one fetch every `GNEWS_PROBE_SECONDS`, default 300 s) closes it again when Google News answers. Before this, an open breaker stayed open for the rest of the run. A run that tripped never stamps its market-rotation window as swept.
  - The per-match **AI summaries** run on the existing bounded triage pool (`AI_TRIAGE_CONCURRENCY`) instead of one by one.
- **The daily Transaction Monitoring report takes its names from Asana only.** The repository and its settings hold no company name.
  - The header now names the reporting entity, read at run time from the Asana workspace that holds the monitoring project. If Asana cannot be read, the header says UNAVAILABLE instead of guessing.
  - Each payment or activity task is tied to its Customer Database record (project `1214107620220121`), by an Asana task link or gid on the `Customer:` line, or by the exact name. A match takes the database's own name, and the case shows its Customer Database link. Names are never logged.
  - A customer matching no record raises the new `CUSTOMER_NOT_IN_DB` alert (HIGH, R.10: no CDD file on record), and its case says NOT FOUND. Employees are not matched as customers.
  - Each case reads `CASE n — Customer: <name>`.
- **SAR red flags, per-customer cases and a more compliant daily Transaction Monitoring report.**
  - The SAR register (506 indicators of suspicious activity in 31 categories: customer behaviour, profile, structuring, cash, third-party, settlement, virtual assets, pricing, documents, phantom trade, circular trading, logistics, UBO, adverse information, PEP, geography, sanctions, TF, PF, gold origin, CAHRA, human rights, environment, corruption, fraud, recycled gold, sudden change, intermediaries, customs, internal conduct, composites) is now `data/sar-red-flags.json`, codes `SAR-CB-01` …. Each names what detects it, using the same vocabulary as the STR register, plus a `kyc` control documented as PARTIAL (CDD gaps are reported for flagged customers only). STR codes are now `STR-ML-11` …; a bare `ML-11` still reads as STR. SAR sanctions / TF / PF flags are CRITICAL, like STR TF / PF / sanctions-evasion flags.
  - **Activity records:** a task in the Transaction Monitoring section with `Customer:` and `Red flags:` but no payment is an activity record. It runs through the rules and the report, never through payment screening.
  - **DPMSR scope fixed to POL-19 §3:** `THRESHOLD` now covers an international wire as well as cash at or above AED 55,000. The new `LINKED_THRESHOLD` covers cumulative linked dealings, i.e. two or more same-day cash or international-wire transactions below the threshold that together reach it. Before this, international wires and linked series were not flagged for DPMSR.
  - **Report:** confidentiality and tipping-off header (Article 25, Federal Decree-Law No. 10 of 2025); legal basis, controls run and thresholds in force; §③ reporting obligations (DPMSR, TFS, STR/SAR assessment, no-action decisions documented); §④ one case per customer (obligations, findings, task links, MULTIPLE INDICATORS at 3+ distinct indicators, and a blank A–H case record matching the internal documentation expectation); §⑤ operating notes. Every alert links to its task and cites the red-flag register entries it evidences. All decision fields stay blank for the MLRO.
- **STR red flags in transaction monitoring.** The MLRO's red-flag list (100 flags: money laundering 30, terrorist financing 14, proliferation financing 16, sanctions evasion 14, corruption / organised crime 16, criminal / regulatory proceeds 10) is now `data/str-red-flags.json`. Each flag has a code (`ML-11`, `TF-07`, …) and names what detects it: a monitoring rule, payment screening, customer screening, or `manual`. A test fails if a flag names a rule that does not exist.
  - Seven new rules (23 in total): `RAPID_RESALE` (same gold bought and sold back within 7 days, ±10% weight, loss stated), `FUNNEL` (5+ payers in 14 days, then ≥50% of it to one foreign payee), `MULTI_JURISDICTION` (one payment chain through 4+ countries), `REFERENCE_KEYWORD` (commission / consultancy, charity / NPO or hawala wording in the reference or purpose), `PERSONAL_ACCOUNT`, `CASH_NO_SOURCE_OF_FUNDS`, and `RED_FLAG` (codes a person records on the payment; TF / PF / sanctions-evasion codes are CRITICAL, an unknown code is reported). The thresholds are defaults pending MLRO confirmation.
  - The payment template in the Transaction Monitoring section gains optional lines (type, weight, purpose, unit/market price, third party, personal account, source of funds verified, payment completed, delivery confirmed, invoice/route mismatch, refund accounts, red flags). Before this, the existing third-party, pricing, phantom-delivery, invoice, route and refund rules could not be reached from Asana at all. Only an explicit yes/no or number is used; anything else is ignored, never guessed. A key may carry a bracketed hint (`Weight (grams): 1000`).
  - The daily Transaction Monitoring report names any monitoring rule that crashed and is then titled DEGRADED; it used to be a silent gap.
- **Daily Transaction Monitoring report in Asana.** The "Payments Register" section was renamed "Transaction Monitoring" in Asana (same section ID). It still holds one task per payment, and the daily run now also files one **Transaction Monitoring Daily Report** there each day. The report covers the section's open payments: ① payment screening (STOP / REVIEW / provisional, with a link to each payment's task), ② monitoring-rule alerts, ③ what to do (POL-07 for STOP, EDD / R.16 for REVIEW), then a blank MLRO decision record and the tipping-off line. Titles read `Transaction Monitoring Daily Report — ACTION REQUIRED | No open findings | DEGRADED — STOP n · Review n · Rule alerts n — <date>`. A run that could not read or screen the payments still posts, titled DEGRADED, and clears nothing. Repeat runs the same day find the first report and post no duplicate. A failed or misplaced post turns the run red (delivery gate, exit 5). The payment reader skips the report by its title prefix, so a report is never read or counted as a payment. JS notifiers still cannot file into the section. Pinned by new checks in `test/engine_test.py`.
- **Asana Payments Register**: the payment-screening input moves to the "Payments Register" section of HAWKEYE STERLING APP (`1219097494676108`), replacing the separate project. It is read-only input and deliberately not an approved destination, so no report or case card can be filed among payments. The daily run reads every OPEN task in that section only; report cards in the other sections are never read as payments. The section ID is registered in `scripts/asana-sections.mjs` (`PAYMENTS_SECTION`) and defaulted in the daily workflow (override: repo variable `ASANA_PAYMENTS_SECTION_GID`).
- **Payment screening** (`payment_screen.py`): screens the PARTIES of a payment, the counterpart of transaction monitoring, which watches behaviour. Every named party (originator, beneficiary, ultimate parties, ordering/intermediary/correspondent/beneficiary banks) goes through the production sanctions matcher. Every party country (stated, or taken from a BIC) is checked against the maintained FATF list. The payment reference is scanned for multi-word designated names. A missing originator or beneficiary name is reported as incomplete under FATF R.16. It reads SWIFT MT103 and ISO 20022 pacs.008 (DTD/entity declarations refused) or a feed record's `parties`. Outcomes: STOP (potential match, apply POL-07), REVIEW (FATF-listed jurisdiction or R.16 incomplete), NO MATCH, or NO MATCH — PROVISIONAL when a core list did not load. A bank given only by BIC is listed as not name-screened. It runs inside the daily screen and reports in §⑤, and is INACTIVE (and says so) until a transaction feed exists. New MCP tool `hawkeye_screen_payment`. The transaction-feed schema gains optional `payment_message`, `parties`, `remittance_info` and `expected_monthly_volume`.
- Transaction monitoring: three new typologies. `PROFILE_DEVIATION` flags a month above 1.5× the customer's declared expected volume and runs only when the profile figure is supplied. `CIRCULAR_FLOW` flags money out to and back from the same counterparty within 30 days for a similar amount. `NEW_GEOGRAPHY` flags a first-ever counterparty country after 5 earlier transactions.

- Retry Wikidata HTTP 200 maxlag and rate-limit error payloads with bounded backoff and Retry-After, rather than treating them as successfully fetched empty PEP name batches.

### Added

- Asana report wording now follows the registered TFS Name-Match Procedure (POL-07, `docs/aims/tfs-name-match-procedure.md`). The daily report's sanctions section said "report to the FIU"; it now states the procedure: stop the dealing while a match is open, PNMR in goAML for a potential match, freeze + CNMR + FFR in goAML for a confirmed one, STR/SAR assessed in parallel, release only on an EOCN/FIU written basis. The sign-off offers the PNMR and CNMR/FFR outcomes with a goAML reference. Sanctions case cards open with the stop-the-dealing line and ask for the identifiers compared, the suspension/freeze time, the goAML reference and the rationale. PEP case cards name the FATF R.12 controls (EDD, senior-management approval, source of funds/wealth, enhanced monitoring). Adverse-media case cards state they are not a TFS event and ask for the identity check. Every field is blank: the decisions stay the MLRO's. Regulatory Watch change cards carry a reviewer record (impact, instrument cited, effective date, assessor). Case-card titles are unchanged, so de-duplication and the delivery watchdog are unaffected. Pinned by new checks in `test/engine_test.py`, `test/reg-watch.test.mjs` and `test/asana-notify.test.mjs`.
- Drift monitoring: the Population Stability Index from `docs/aims/population-stability-monitoring.md` §1 is now code, `monitoring.population_stability_index()` and `psi_reading()`. It implements the spec's guards: bins with expected n < 5 are merged, a window with n < 50 reports `n too small` and never a score, and an empty bin is floored and disclosed. It is pinned by seven `test/engine_test.py` checks, one against a hand-computed value. The scheduled monthly run still awaits the first baseline freeze, which is an MLRO act.
- Screening: an independent external benchmark. It holds 485 MIT-licensed company and vessel name pairs from the Cascade Screening project (also vendored by moov-io/watchman), vendored byte-identical in `test/fixtures/external-benchmark/` with licence and provenance. `scripts/external-benchmark.mjs` scores them through the production JS matcher. It reports recall 87/140 and negative clear 93/160 on lot 1, and 33/118 and 65/67 on lot 2 (Hebrew/Burmese vs Latin, former names). `test/external-benchmark.test.mjs` pins these as ratchet floors and checks the files' SHA-256. The internal corpus and its floors are unchanged.
- Assessment form: a "Country AML profile (KnowYourCountry) ↗" analyst-reference link under the jurisdiction select. It opens that jurisdiction's public KnowYourCountry AML profile in a new tab with `noopener noreferrer`. It is a link only: KnowYourCountry's terms of use bar republishing its country reports outside the reader's organisation, so none of its content is copied into the app or repository, and the link never feeds the score. All 245 jurisdictions map to a listed page; seven use explicit slug overrides. `test/country-intel-links.test.mjs` pins the mapping, wired into CI.

### Fixed

- **State branches can no longer be refused by GitHub after a workflow change.** Seven workflows rebuilt their state branch as <current main> + one data commit and force-pushed it. After any `.github/workflows` change on main, that push also counted as updating workflow files, which GitHub refuses for the Actions token. Daily Screening run 36991549616 (2 Oct) delivered its report but went red without persisting its delta-state. A shared `scripts/push-state-branch.sh` now builds each state commit on the branch's own tip, so only the named data paths can differ, and every reader takes single files, never the tree. It is used by screen-delta-state (daily and onboarding), reg-watch-state, sanctions-watch-state, fatf-state, the pep-shard-* slices and the eocn-reconcile review branch. `test/screening-state.test.mjs` bans `HEAD:` state pushes and runs the helper end-to-end against a real repo where main's workflow file changes between two state writes.
- README: the Daily Screening badge showed "failing" while every recent run passed. Without an event filter, GitHub's native badge resolved to an old failed run. It now reads the scheduled daily runs (`&event=schedule`), the production screening path; verified live, it returns "passing".
- README: the Dependency Review badge showed "no status" because that workflow runs only on pull requests, while the badge asked for runs on `main`. It now reads the latest pull-request run (`event=pull_request`), which shields reports as passing.
- Sanctions Watch keeps EU change detection while the EU list is behind EU Login. A core list's declared fallback (`eu-fsf` → `fr-dgt`) is now watched as well, and `gels-avoirs.dgtresor.gouv.fr` is added to the watch workflow's egress allowlist. The fallback is fingerprinted by its parsed, sorted name set, so a re-issued register with only a new publication timestamp does not count as a list change. A first snapshot of a newly watched list is a baseline and no longer dispatches a full re-screen; only a changed list does. A gated primary whose fallback fetched cleanly is reported as "covered by fallback" instead of filing the same Asana alert on every run. If the fallback is down too, the escalation still fires.
- Obligation register: every row now carries an article-level `source_citation` that separates quoted law from the firm's paraphrase. A row is either `needs-source`, where all fields are null so nothing drafted can pass as law, or `sourced`, with a verbatim quote, an official HTTPS publisher URL, a page/section locator, and the MLRO or Counsel who verified it and the date. `test/obligations.test.mjs` enforces both shapes and proves the validator on synthetic rows. `obligationsWithoutSourcedCitation` (21 of 21 today, closing through open-actions item 5) is a new GRC counter. It is not a KRI, because thresholds are a Board act.
- EU coverage no longer depends on EU Login. Since 1 Oct 2026 the EU FSF public token redirects to the EU Login sign-in page, and a personal `EU_FSF_TOKEN` needs an EU Login account. `eu-fsf` now declares the French DG Trésor *Registre national des gels* (`fr-dgt`, public JSON API, no sign-in) as its fallback in both the source registry and the worldwide-screening contract. The DG Trésor states the register includes every EU freeze. Selective loads (`sourceIds`) can now reach a fallback that lives in `data/sanctions-extra.json`, so the sanctions runtime assurance loads it and allows its host. `assessRuntime` treats a required source as covered only when its declared fallback loaded complete, above its floor. That substitution is a named warning plus `servedByFallback` evidence, never a silent pass. `fr-dgt`'s floor is raised from 500 to 9,800 (about 50% of the 19,627 names loaded on 2 Oct 2026), so a truncated register cannot stand in for the EU list. `validate-worldwide-screening` fails if the contract's and registry's fallbacks disagree.
- **README: the Daily Screening badge reads GitHub's own status.** On 2 Oct 2026 shields.io's JSON for this workflow returned `failing` while GitHub's native badge for the same workflow returned `passing`, and the run history agrees with GitHub (every recent run succeeded; the 00:05 UTC run delivered the full results to Asana). The same mismatch was visible on 1 Oct. The badge now uses GitHub's native `badge.svg?branch=main`, like the CI and CodeQL badges. Its label becomes the workflow's display name: "Daily Screening (Sanctions + Adverse Media + PEP)".
- **Adverse media: a post-sweep second pass for zero-coverage subjects.** The per-subject last-resort retry runs while the whole book is still being swept, at peak provider pressure. On 2 Oct 2026 it recovered 275 of 286 subjects and left 11 with zero backbone coverage (GDELT down for all 952, Google News for 925).
  - After the sweep, the Sanctions Screen now re-checks only those zero-coverage subjects: once, after a cool-down (`ADVERSE_SECOND_PASS_DELAY_MS`, default 60 s), at concurrency 2, within the enrichment deadline. It is capped at 100 subjects, because a mass failure means the providers are down globally and re-querying adds load.
  - A recovered subject is rebuilt through the same `finalize()` path as the sweep, so a recovered hit merges exactly like a first-pass hit, and its error is un-counted. A subject that still fails stays a counted, fatal error.
  - The pass is reported in the run log and the assurance evidence (`secondPassAttempted` / `secondPassRecovered`, plus a warning line).
- **Sanctions Watch, deadline guard and Python engine hardened for the EU Login gate.**
  - **Sanctions Watch** fetches lists on the screen's path: optional personal token, cookie-carrying redirect follower, and the full cause chain instead of a bare `fetch failed`. An HTML page served in place of a CSV/XML/JSON list is now an error and is never fingerprinted, so a sign-in or error page can't be recorded as a "list change" in the TFS evidence log. A sign-in gate escalates on the **first** run, naming the `EU_FSF_TOKEN` secret; ordinary outages still wait for the 3-run streak. `sanctions-watch.yml` passes the secret.
  - **Deadline guard:** Sanctions Screen evidence is now today's run reaching its Asana delivery step, not the run's overall success. A run that delivered but failed only its runtime-assurance gate (2 Oct: EU list behind EU Login) counts as delivered, is named **DEGRADED** in the verdict, job summary and a `::warning::`, and is not re-dispatched, since a re-run can't fix a sign-in gate. Before this, it burned two ~100-minute re-runs and duplicate Asana deliveries every morning. Unreadable job data never triggers a blind re-dispatch. The delivery step's name is pinned by a test.
  - **Python engine:** the official EU XML fallback uses `EU_FSF_TOKEN` when set (charset-validated, request only), and `weekly-adverse-media.yml` / `onboarding-screen.yml` pass it. An EU Login page parses to no names and fails loudly.
- **EU consolidated list now needs EU Login: loud, named failure plus a personal-token path.** With the EU Login host allowed (entry below), the live redirect chain is `307 webgate…/content (+cookie) -> 303 webgate…/content -> 307 ecas.ec.europa.eu/cas/login (+cookie) -> 200 ecas.ec.europa.eu/cas/login`. Since 1 Oct 2026 the shared public download token lands on the EU Login sign-in page. The documented machine route is an FSF account's personal "crawler/robot" URL (Oracle Transaction Filtering admin guide, A.3 EU Watch List).
  - A redirect chain that ends on a sign-in page now fails with `the endpoint requires a sign-in` and names the `EU_FSF_TOKEN` secret to set, instead of `parsed 0 names`.
  - A source can opt in with `tokenEnv`; `eu-fsf` uses `EU_FSF_TOKEN`. When that repository secret is set, its value replaces the URL's token parameter for the request only. Values must match `[A-Za-z0-9._~+/=-]`, otherwise the secret is ignored. The personal URL is never stored, and GitHub masks the secret in logs.
  - Unset, the EU list keeps failing red: the run delivers against the other lists and reports the EU gap.
- **EU consolidated list: allow the EU Login hop.** With cookies carried (entry below), the EU file server's redirect chain continued to `ecas.ec.europa.eu`, the European Commission's EU Login / authentication service, which the runner's egress firewall blocked (harden-runner: `domain not allowed: ecas.ec.europa.eu`, then `ECONNREFUSED`). `ecas.ec.europa.eu:443` is now allowed next to `webgate.ec.europa.eu:443` in the six workflows that download the EU list. If EU Login only performs an anonymous check and returns, the list loads. If it demands an interactive login, the run receives a non-CSV page and fails loudly on the list's 20,000-name floor; it never screens a partial list as complete.
- **EU consolidated sanctions list: recover from the redirect loop.** With the cause chain now logged (entry below), the EU list's failure reads `fetch failed <- redirect count exceeded`: the endpoint now answers with a redirect loop. Node's `fetch` keeps no cookies, so an endpoint that sets a cookie and redirects loops until undici's 20-redirect limit; a browser or Python's `requests` carries the cookie and gets through. When a source fails with exactly that error, the engine now retries once, following redirects by hand with a cookie jar (at most 10 hops, http(s) only). It logs each hop as status, host and path; the query string is never logged. If the loop persists, the failure names its own chain and the screen still fails red. Reproduced offline on Node 22: a cookie-gated redirect gives the identical production error, and the new path returns the list.
- **A sanctions list that fails to download now says why.** Since 1 Oct 2026 ~17:54 UTC the EU consolidated financial sanctions list (`eu-fsf`, a required list) has failed to load in the Sanctions Screen. The runner's firewall allows the EU host and the connection opens, but the log showed only Node's bare `fetch failed`, because Node keeps the real reason (TLS certificate error, connection reset, timeout) on `error.cause`. `describeFetchError` now reports the cause chain on every source failure: in the retry warning, the failure log line and the assurance note. The screen still fails red on the missing list, as before; this makes the next run name the root cause.
- **README status board: no false red.**
  - The six coverage-count badges (sanctions lists, sanctions jurisdictions, sanctions countries researched, and the adverse-media editions, countries and languages) were fixed-colour red or orange. They showed red regardless of their value, which read as a failing control. They are now neutral blue, like the national-source depth badge. These are configured counts, not health states; runtime health stays on the operational badges.
  - The Advisor Eval badge stayed red after the 28–29 Sep Anthropic API usage-limit lapse, although today's run held 30/30 guardrails. The badge counts only scheduled and push runs. A change to `advisor-eval.yml` itself now re-runs the live eval, and this PR's merge produces that real verification on `main`.
- **A failed screening run is now re-run before 09:00 UAE, and a missed deadline alerts at 09:00 instead of 22:00 UAE.** The morning dispatch only *started* both screens at 00:05 UTC. A run killed mid-flight was healed only by Control Retry, whose cron GitHub starts 4–6 h late, so the report could reach Asana around midday UTC. The Delivery Watchdog judged a day only after 18:00 UTC.
  - The firing that dispatched now runs a deadline guard (second job in `screening-morning-dispatch.yml`). It watches both screens until 05:00 UTC (09:00 UAE).
  - It re-dispatches a screen whose run ended without delivery evidence, at most twice per screen.
  - Evidence for the Daily Screening is the Asana report with both full-results attachments; the run's own conclusion is not used, because the EOCN gate turns a delivered run red. Evidence for the Sanctions Screen is a successful run.
  - Unreadable evidence never triggers a blind re-dispatch.
  - When the deadline passes without full delivery (or delivery came late), the guard fails red and files an Asana alert.
  - The Asana check is shared with the watchdog: `reportEvidence` in `delivery-watchdog.mjs`.
  - A watchdog test fixture no longer names a real company.
- **News-feed errors no longer leak URL-encoded names into the public run log.** When a Google News, GDELT or Bing request failed, its error text included the request URL (`…url: /rss/search?q=%22Jane+Roe%22…`). That URL carries the subject's name URL-encoded, which `::add-mask::` cannot match. These lines, and the per-subject adverse-media and screening error lines, now go through `safe_err`. It keeps the error type and host but redacts the URL path and every query string.
- **Full-results delivery heals itself on a re-run.** If the first run's attachment upload failed, the run went red (correctly), and Control Retry re-ran it. The re-run found today's report already delivered, skipped it (duplicate-report guard), and never attached the files, so the gap could not heal while the Delivery Watchdog kept failing. A re-run that finds today's report now checks its attachments and uploads the complete report and results register if either is missing. Nothing is re-uploaded when both are present. An attachment list that cannot be read fails the delivery gate rather than passing as delivered.
- **Delivery Watchdog verifies that the FULL results were delivered, not just the card.** From 2 Oct 2026 (the first day #727's attachments exist), a due day passes only if one of its "Daily AML/CFT Screening Report" tasks carries both `full-screening-report-*.txt` and `screening-results-register-*.csv`. A report without them delivered only the capped card, so the watchdog fails and alerts ("DAILY SCREENING REPORT NOT FULLY DELIVERED"). An unreadable attachment list is reported as unverifiable, never as delivered. Days before the cutover are judged on the report alone, so there is no false alarm on history.
- **Format-drift guard on every core list in the Python engine.** OFAC SDN, UN, UK, EU, Australia, Switzerland and UAE EOCN now pass through `drop_junk_names` in both list-building paths. Stray non-name values are dropped. A parse that is mostly non-names is treated as empty, so the core-list coverage floor refuses the run as a corrupt source instead of screening junk under a "live" label. This is the Canada SEMA failure mode, now guarded for the lists that matter most.
- **Canada SEMA no longer reports "OK" while screening nothing.** Canada's official SEMA XML currently publishes 5,708 records whose fields are shifted against their labels. `LastName` holds a date serial ("44102") and `EntityOrShip` holds the schedule ("1, Part 1"); no record contains a name. Sanctions Screen's generic XML parser counted 11,087 such values (9,855 digit or schedule strings, and 1,232 "Part 1"/"Part 2") as designated names. That passed the list's 2,500-name floor, so the list showed as loaded on 1 Oct. The Python engine screened 178 such values as "live". Both parsers now accept a value as a name only if it has at least two letters (any script) and is not a bare schedule reference (`isScreenableName` / `is_screenable_name`). This file now reads 0 names and degrades loudly: Sanctions Screen reports the source failed and the daily report shows Canada unavailable, so it no longer claims coverage. Real names in Latin, Cyrillic and CJK scripts still parse, and the matcher, parity, fuzz and recall-benchmark suites are unchanged and green. Every other source now goes through the same guard in Sanctions Screen's list loader (`screenableNames`). Non-name values are dropped and counted. A source whose parse is mostly non-names is reported as **format drift**: it is recorded as failed and the screen is marked degraded with the reason. It is never screened under a "loaded" label.
- **Sanctions Screen results get a readable findings table, verified like the evidence pages.** The daily "Daily Sanctions Results" and "Daily Adverse Media and PEP Results" cards deliver every record, but only as JSON split across numbered evidence subtasks (82 pages on 1 Oct). Each card now also carries `screening-findings-<domain>-<date>-run<id>.csv`. It has one row per hit, with NEW/CHANGED/STANDING status, the customer and role, the list, the matched name, the score and confidence, the source URL, and first/last seen; customers cleared that run are listed too. It is UTF-8 with a BOM and protected against formula injection. The card is marked "DELIVERY VERIFIED" only after Asana's attachment list confirms the uploaded table; superseded machine-owned tables are retired, and analyst attachments are never touched. With no uploader configured, delivery fails instead of verifying.
- **Full screening results are delivered to Asana every day.** The daily report card is capped by Asana's ~65 KB notes limit, so it itemises the top findings and summarises the rest ("+57 further sanctions subjects", "+144 more adverse subjects", "+70 more similar candidates", "+40 more clusters"). The remainder was available only in the GitHub run log, which is public and, since #725, has subject names masked. Every report task now carries two attachments: the complete report, rendered with no item cut, and a CSV results register. The register has one row per sanctions hit (CONFIRMED / POTENTIAL / EXCLUDED ON IDENTITY), adverse-media article and PEP finding, plus one row per customer record with no sanctions match. It is UTF-8 with a BOM and protected against spreadsheet formula injection. The card's "+N more" lines now point to the attachment. If an upload fails, the delivery gate fails the run (exit 5); a card that claims attached detail is never treated as delivered without it.
- **No duplicate MLRO cases on same-day re-runs.** A Control Retry pass, coverage make-up or manual dispatch reuses the day's report task, but a re-sweep surfaces different news articles for the same person, so each re-run filed a second identical case. On 1 Oct 2026 nine adverse-media cases were filed twice, at 11:30 and 12:55 UTC. A re-run now adds its new items to the existing case as a comment. If the existing cases cannot be read, it fails open and creates the case anyway: a duplicate is noise, a missing case is a missed obligation.
- **Daily screening starts on time: results reach Asana before 09:00 UAE.** A new workflow, Screening Morning Dispatch (`screening-morning-dispatch.yml`), is scheduled at 19:07, 20:37 and 22:07 UTC. The first firing GitHub delivers waits on the runner until 00:05 UTC, then dispatches Sanctions Screen and Daily Screening; a `workflow_dispatch` starts at once, unlike this repository's scheduled events. Later firings find that day's runs and exit. A failed run that day is left to Control Retry rather than re-dispatched, and an accepted dispatch is never reported as delivery. The logic and its offline tests are in `scripts/workflow-recovery.mjs` (`--morning`, `--self-test`). The daily Claude Routine considered for this was dropped: its fired sessions have no GitHub access and draw on the account's usage limit.
- **Python engine name masking restored.** A Copilot Autofix accepted on #725 (for a CodeQL "clear-text logging of sensitive information" alert) made `mask_population` return 0 unconditionally, so `screen.py` masked nothing on GitHub Actions. Masking is restored. Its scope is names (subject, individuals, corporate owners). Contact email and ID numbers are no longer echoed into mask commands: neither reaches any log line, and echoing them was what CodeQL flagged. `test/engine_test.py` now asserts that the production path emits `::add-mask::`.
- **Customer and employee names are kept out of the public GitHub logs.** The repository and its Actions run logs are public. Both screening engines (`sanctions-screen.mjs` and `screen.py`) now register every customer, principal/UBO, corporate owner and employee identifier with GitHub's `::add-mask::` as soon as each population is read from Asana. Any later log line in that job prints `***`. The log lines that printed a subject name explicitly (shadow-band and phonetic-shadow evidence, per-customer progress, adverse-media errors, FraudLabs, onboarding) now give the opaque Asana gid instead. The name-bearing Sanctions Screen report is no longer echoed to the run log on GitHub Actions; it goes to Asana. If `STATE_ENCRYPTION_KEY` is missing, the three screening workflows used to publish plaintext subject state to their state branches with only a warning. They now fail red and publish nothing. Results, with names, are still disclosed in full in Asana (HAWKEYE STERLING APP).
- **Sanctions Screen moves to its earliest same-day slot so results reach Asana before 09:00 UAE.** In this repository, GitHub starts scheduled runs 4–6 hours late: the 05:37 UTC slot started at 09:41–11:57 UTC between 19 and 30 September, so results reached Asana in the mid-afternoon (UAE). It also drops most firings of a frequent cron. So the on-time trigger is an external `workflow_dispatch` shortly after 00:00 UTC. The cron moves to 00:17 UTC as the backstop: the earliest slot on the same UTC day, because freshness-check counts runs per UTC day.
- **Screening subjects carry the right identity type.** In Sanctions Screen (`sanctions-screen.mjs`), every HR – Employees task was screened as an organisation. An employee's PEP hit read "entity type differs", and the case checklist asked for a registration number instead of date of birth / passport / nationality, none of which was parsed. Corporate shareholders recorded as "Individual / Corporate: Company" were screened as individuals. Employees are now individuals (role Employee) with DOB, nationality and passport parsed from their record. Corporate shareholders are organisations that still name their customer and role. Matching and recall are unchanged (every name is still screened against every list), and subject keys are unchanged, so no standing match is re-raised.
- **Asana alerts route only to approved sections.** Advisor Eval and Weekly Summary sent their alerts to a deleted "AI & Platform Governance" section (`1218785568483509`), which the four-section routing contract (#701/#703) refuses. Advisor Eval's run went red, and Weekly Summary's refusal was masked by `continue-on-error`. FATF list-change alerts targeted the deleted "FATF list moves" / "Assessment Report" sections and were filed outside any section. The retired manual sanctions screen targeted "Assessment Report". All now use approved sections pinned in the workflow, so a stale repository variable cannot override them: governance and FATF alerts go to Regulatory Changes and sanctions to Screening Sanctions Update. `governance-report.mjs` no longer creates an "AI & Platform Governance" section by name; that behaviour kept re-provisioning a fifth, unapproved section in the monitoring project. `test/asana-notify.test.mjs` now fails CI on any unapproved section gid in a workflow, script or `screen.py`.
- **Delivery Watchdog no longer raises false "no report" alarms.** Control Retry dispatches the watchdog whenever it has no successful run that UTC day, which happens just after midnight. The watchdog then judged a report that was not due yet and filed "NO DAILY SCREENING REPORT FILED TODAY" in Asana (2026-09-30 00:44 and 2026-10-01 01:28 UTC); both days' reports were filed within hours. The watchdog now verifies the most recent DUE day: today's report from 18:00 UTC (its own cron hour), the previous UTC day's before that. A genuinely missing report still fails loudly and alerts.
- **PEP harvest chain unblocked; sharded completion refreshes runtime assurance again.** A PEP shard branch merged into `main` carried a spent harvest checkpoint (already at the 12-resume cap) and a shard slice. Every weekly harvest checkout then refused to resume. Both files are removed from `main`. The harvest now discards any checkout-borne checkpoint before overlaying `pep-worldwide-state`, the only source of a checkpoint. Shard commits now unstage the overlaid checkpoint and are verified to contain only their slice. The shard merge job no longer attempts a workflow dispatch its `contents: write` token cannot make. That 403 turned a successful merge red and suppressed the watchdog's Sanctions Screen refresh, so assurance kept reporting a complete PEP artifact as partial. The watchdog now dispatches that refresh only when the merge job actually published. A shard run with no checkpoint backlog and a complete artifact is a clean no-op; without either, it still fails loudly. The README "Sanctions Lists Screened" badge now queries the `sanctionsLists` figure that `data/coverage-figures.json` actually publishes.
- **Onboarding screen can no longer silently skip employees.** `onboarding-screen.yml` forwarded `vars.ASANA_EMPLOYEE_DB_GID` with no fallback. An unset repository variable expands to an empty string, which `screen.py` reads as "employee screening disabled". The workflow now falls back to the HR – Employees project (`1216239131596624`), as the daily and sanctions screens already do, and `test/employee-screening-wiring.test.mjs` requires that fallback in all three. Screening subjects remain the Customer Database (`1214107620220121`) plus HR – Employees; delivery remains HAWKEYE STERLING APP (`1216203370612914`).
- **CI restored on `main`.** `app.js` is restored to its last green version: #721 had replaced the 2,961-line scoring app with a 340-line file lacking `APP_VERSION`, `COUNTRIES` and `computeAssessment`, which failed the scoring, golden-set, export, SBOM, changelog and watchdog suites. The README is restored to its last green version as well. That brings back the live runtime-assurance badges (read from `screen-state`) in place of the neutral "tracked by workflow" badges, and the system-state section and links the readiness and doc-link guards check. `netlify.toml` is restored too (build command, functions directory, pure-`'self'` CSP and the security headers); #721 had removed them. #721's `_auth.js` hardening is kept.
- Start independent news providers concurrently, back off shared queues on headerless HTTP 429, and avoid repeating rate-limited GDELT queries.
- Prioritize missing PEP person names before optional office metadata and reuse validated names already published by the same harvest without changing the completeness denominator.

- **Runtime recovery without false clears.** News circuits now admit one validated recovery probe after cooldown, ignore stale in-flight results, re-check admission after queueing, and share bounded Retry-After backoff. Missing or blank PEP names remain pending; incomplete non-sharded harvests retain their checkpoint and request a bounded resume. Dataset completeness is derived from all discovered holders even when an expected count is omitted or understated. Runtime assurance thresholds are unchanged.

- **Optional Composio orchestration layer.** Added a server-side Tool Router bridge for Asana, Gmail, Google Drive, Slack and GitHub with per-user sessions, connected-account linking, tool discovery/execution, hosted MCP session metadata, trigger management, signed webhook receipt, session mount operations and an independently gated raw proxy path. The integration is off by default, requires `APP_SHARED_TOKEN`, keeps project/webhook secrets server-side, and is explicitly excluded from sanctions, adverse-media, PEP, risk scoring and runtime assurance.

- **Register research: Slovenia, Croatia, Slovakia** recorded as
  `assessed-not-loadable`. Each ministry's sanctions page points only to the
  UN and EU lists, and neither is published nationally. Guyana is
  `identified`: under the FIU's TFS guidance, domestic designations are
  published in the Gazette and on the FIU website. Cyprus gets a partial
  note: Law 150(I)/2025 provides for national sanctions, but no published
  national list was found. Andorra and Senegal are `assessed-not-loadable`
  because their FIU sanctions pages link only the UN list. The Holy See is
  `identified`: the Governorate's ordinances update its "List of Subjects
  that Threaten International Peace and Security" (ASIF Annual Report
  2023). Uzbekistan is `identified`: the Department on Combating Economic
  Crimes publishes 8 list forms as XLSX. It is not staged, because screening
  it is an MLRO policy decision. The Marshall Islands and Cambodia get partial
  notes. Lebanon is `identified`: the Internal Security Forces publish the
  national UNSCR 1373 list, updated 15/04/2025, as a legacy `.xls` file,
  which the registry cannot read yet. Suriname is `identified`: S.B. 2025
  no. 53 establishes the Nationale Sanctielijst, but no names are published
  yet. Kuwait's partial note now cites Ministerial Resolution No. 8 of 2025,
  under which the Committee may designate persons under UNSCR 1373.
  Tanzania is `identified`: the Minister of Home Affairs publishes the Domestic
  List in the Gazette, per the FIU's TFS guidelines. Angola gets a partial
  note (Law No. 1/12). Turkmenistan is `assessed-not-loadable` because its FIU
  site links only UN lists. The Laos note now cites the 4 September 2025
  decree establishing a Domestic Designation List, which has no published
  list yet. Djibouti gets a partial note (Law No. 104/AN/24, Art. 9).
  Researched rows: 121 → 133.
- **Belize: `bz-fiu-consolidated` staged (disabled).** This is the FIU's
  official Consolidated Belize Sanctions List: High Court orders covering
  domestic and UNSCR designations, published as XLSX. Its month-named file
  is found from the FIU page, and discovery must match exactly one `.xlsx`
  link, because a month name cannot be sorted by date. `fiubelize.org` is
  added to the screen's egress allowlist. Runner probe 36397059655 fetched the
  file but found a UN-layout re-export (UN references prefixed "BZ"). The
  generic reader splits its name columns into single-word fragments, so the
  source stays **disabled**. It is redundant with the UN list, as with
  `za-fic-tfs`.
- **Register research (FATF-listed, Gulf, Asia): Oman, Nepal, Vietnam, Côte
  d'Ivoire, Republic of Korea, China, Algeria, Mali, Burkina Faso, Niger,
  Armenia, Tajikistan, Bangladesh, Ethiopia, Zambia, Rwanda, Mozambique, Somalia, Uganda, Palestine, Fiji, Cuba, Myanmar, Maldives**
  recorded as `identified`, each with the official source for its
  national list. Vietnam's national list is not staged: its entries include
  overseas political organisations, so screening it is an MLRO policy
  decision; the same applies to Mali, Burkina Faso, Niger, Tajikistan, Rwanda, Cuba and Myanmar, whose
  lists reportedly include journalists and political figures. Papua New Guinea (no domestic designations), Namibia, Ghana, Sierra
  Leone, Samoa, Solomon Islands and Malawi (UN lists only) are
  `assessed-not-loadable`. Kuwait, Lebanon, Laos, DR Congo, Syria,
  Haiti, Bosnia and Herzegovina, Brunei, Senegal, Togo, Benin, Zimbabwe, Botswana, Sudan, Tanzania, Iran, Vanuatu, Guyana, Mongolia and Seychelles get partial notes. Researched rows:
  89 → 121.
- **Register research: Norway, Iceland, Montenegro, San Marino, Malta,
  Liechtenstein, North Macedonia** recorded as
  `assessed-not-loadable`. Each implements UN sanctions (and, for the first
  three, mirrors or relays the EU lists), with no separate national list.
  Albania is `identified`: a Council of Ministers list of persons declared as
  terrorism financiers exists on qbz.gov.al, but its format is not yet
  verified. Russia (Rosfinmonitoring terrorism/extremism list) and Belarus
  (KGB terrorism list) are `identified`, as is Hungary (national terrorism
  list under Act LII of 2017). Neither is staged: screening them is
  an MLRO policy decision. Researched rows: 78 → 89.
- **Poland: `pl-mswia-sanctions` enabled.** Runner probe 36393616291 (on
  main) found the MSWiA spreadsheet via `linkMatch` discovery and read 461
  names (floor 100). Poland moves to `screened`.
- **Estonia: `ee-vm-russia-ukraine` enabled.** Runner probe 36392452572
  (on main) read 5 names (floor 3). Estonia now screens all three official
  MFA lists.
- **Register research: El Salvador, Nicaragua, Spain, Germany, Italy,
  Portugal, Ireland, Luxembourg, Sweden, Finland, Denmark** recorded as
  `assessed-not-loadable`. Finland has a national freezing list, but it is
  supplied only on request from the National Bureau of Investigation. Greece
  is `identified`: its national list exists but no published copy was found. Each row cites the official source that
  shows UN/EU lists relayed, or national measures issued only as individual
  decrees, with no consolidated national list. Researched rows: 66 → 78.
- **FATF black and grey lists with their assessments.** The new file
  `data/fatf-assessments.json` covers all 25 jurisdictions from the FATF
  19 June 2026 statements (3 black, 22 grey). Each entry gives the FSRB, the
  commitment date, the MER adoption date where stated, the action-plan
  status, and the action-plan items quoted verbatim with their source URL.
  Register rows gain a `fatf` field, and the MCP resource
  `hawkeye://reference/fatf-assessments` serves the file. A test pins the
  assessments, `data/jurisdiction-risk.json` and the register to the same
  jurisdictions. The README gains a "FATF black and grey lists" section.
- **Americas register research (15 countries).** Recorded from official
  regulator/FIU pages, each cited in its row note: Paraguay, Chile, Peru,
  Bahamas, Colombia, Panama, Costa Rica, Dominican Republic, Uruguay, Bolivia,
  Guatemala, Honduras and Jamaica are `assessed-not-loadable` (UN relay, no
  separate national list found); Trinidad and Tobago and Ecuador are
  `identified` (national designations exist, file not yet verified).
  Researched rows: 51 → 66 of 195.
- **Estonia: `ee-vm-human-rights` enabled.** Runner probe 36391873968 read
  193 names (floor 150).
- **Register `baseline` per country.** Every row now records the daily lists
  that already cover it: `UN` for the 193 UN members and `EU` for the 27 EU
  members. A test pins both counts, and that both lists are enabled. The
  README gains a "Sanctions coverage by country" section explaining UN, EU,
  and OFAC/UK coverage.

- **Sanctions: Estonia's three national lists staged (disabled)**
  (`data/sanctions-extra.json`). They are `ee-vm-belarus` (273 designations),
  `ee-vm-human-rights` (160) and `ee-vm-russia-ukraine` (3). The MFA publishes
  them only as web pages of numbered lines, so they are read by a new
  `parseNumberedNameList`, which:
  - turns "SURNAME, Given" into given-name-first order;
  - screens every alias in parentheses, including Latin, Cyrillic and
    slash-separated variants;
  - never screens a lone given name on its own.

  All three stay disabled until a source-probe run on a runner shows the
  parse. `www.vm.ee:443` is added to the egress allowlist, and the register
  moves Estonia from `identified` to `pending`.
- **Poland spreadsheet reader.** Runner probe 36391592244 found the correct
  `.xlsx` via `linkMatch` (200,687 bytes), but the parser read 0 names: the
  name header is Polish (`Nazwisko i imię`). The XLSX reader now accepts it,
  skips rows with a struck-off date (`Data wykreślenia z listy`), and screens
  a parenthetical alias on its own. Poland stays disabled until a probe
  shows the floor met.
- **Estonia screened: `ee-vm-belarus` enabled.** Runner probe 36391541492
  read 615 names against a floor of 250. The register moves Estonia to
  `screened`; its two other lists stay disabled until their own probes run.
- **Estonia parser reads `<ol><li>` lists too.** Runner probe 36391013267
  showed the Belarus page renders its 273 designations as an ordered list,
  with the numbers added by the browser, so the parser found 0 names and the
  source stayed disabled. Items of any ordered list with 3 or more entries
  now screen, and breadcrumb lists never do. The fetched page now yields
  615 names: 273 entries plus their Latin and Cyrillic variants.
- **Discovery: optional `linkMatch` for pages with a generic link stem.**
  gov.pl serves every file as `/attachment/<uuid>`. The MSWiA page links one
  decision PDF per designee beside the single spreadsheet, and source-probe
  run 36390719857 showed the stem alone picking an 11-page PDF. That run
  found 0 names against a floor of 100, so the source correctly stayed
  disabled. With `linkMatch`, exactly one anchor must contain the string
  (Poland uses `Format: xlsx`); zero or several anchors return nothing, so
  the list fails loudly.

- **Sanctions: Lithuania, Czechia and Moldova national lists now screened**
  (`data/sanctions-extra.json`). Each was enabled only after a source-probe
  run on a GitHub runner fetched the official file:
  - `lt-migracija-magnitsky`: run 36388112480, HTTP 200 JSON, 284 entry-ban
    designations.
  - `cz-mzv-national`: run 36388018140, HTTP 200 UTF-8 CSV. It is read by a
    new `parseCzMfaCsv`, which pairs the slash-separated transliterations and
    screens only valid (`platný`) rows. The dated filename is resolved each run
    by a new opt-in `discover: { page, fileStem }` (`discoverDatedLink`). It
    takes the latest matching https link on the official page's host, and the
    list fails loudly if none is found.
  - `md-sis-terror`: run 36388020414, HTTP 200. The file is labelled as Excel
    but is actually an HTML table, so it is read by a new `parseHtmlTable`.
  - Configured coverage moves from 59 to 62 lists and from 40 to 43
    jurisdictions. The register moves these three countries from `pending` to
    `screened` (screened 43, pending 1). Tests were added to
    `test/sanctions-match.test.mjs` and `test/sanctions-screen.test.mjs`.
- **Source probe proves the parse, not just the fetch**
  (`scripts/source-probe.mjs`). Each probe now reports:
  - the source's own registry parser output: name count, a sample of names,
    and whether the `minNames` floor was met;
  - the final URL after redirects, so an off-allowlist host is caught before
    a source is enabled;
  - the `discover` link resolution, done exactly as the screen does it.
- **Poland staged (disabled)**: `pl-mswia-sanctions`, the Interior Ministry
  (MSWiA) sanctions-list `.xlsx` on gov.pl, with page discovery.
  `www.gov.pl:443` is added to the screen's egress allowlist. The register
  moves Poland from `identified` to `pending`.
- `test/app.test.js`: the retention-purge audit poll now has the same
  300-tick budget as its sibling polls. It had failed once on a loaded runner
  at 50 ticks; the assertion itself is unchanged.

- **Sanctions: a 195-country coverage register, and three official national
  lists staged** (`data/sanctions-country-coverage.json`,
  `data/sanctions-extra.json`).
  - **The register** lists every country (193 UN members plus the Holy See and
    Palestine) with its status: `screened` (40), `pending` (4), `identified`
    (5), `assessed-not-loadable` (2) or `not-researched` (144). A test pins
    `screened` to the live configuration in both directions, and no country is
    marked as having no national list without evidence. A new README badge
    shows countries researched (51 / 195). The UN Security Council list,
    screened daily, binds every UN member state regardless.
  - **Staged, disabled until a GitHub-runner source probe confirms each one:**
    Lithuania's Migration Department list (official keyless JSON; 284 names
    verified live), Czechia's MFA national list (official CSV, but its dated
    filename needs link discovery) and Moldova's SIS terrorist list
    (spreadsheet of unverified format).
  - **Parser:** `parseJsonList` now reads the Lithuanian `vardas`/`pavarde`
    name fields, with tests.
  - **Network allowlist:** the three hosts are added to `sanctions-screen.yml`.
  - **Iraq:** its official API was verified live, but names are Arabic-only,
    so it is recorded as pending until the matcher can compare Arabic with
    Latin script.
- **The Python engine's rotation ledger counted four markets it never swept**
  (`screen.py` `GNEWS_LOCALES`). The live Google News audits of 2026-09-27/28
  found that `DK:da` silently serves the Norwegian edition and `LK:en` serves
  en-US. They also found that `TZ:en` and `UG:en` keep their code but serve one
  generic international-English feed with no local press. The engine still
  swept all four and stamped them in the rotation ledger as covered markets.
  They are removed, taking the matrix from 91 to 87 editions. Each duplicated
  content another listed edition already sweeps, so recall is unchanged and
  the coverage claim is now true. The Swahili `KE:sw`/`TZ:sw` editions are kept.
- **Adverse media: six verified Google News editions added** (`scripts/adverse-media.mjs`):
  Ireland (`en-IE`), Canada in English (`en-CA`), Austria (`de-AT`), US Spanish
  (`es-US`), Malaysia in English (`en-MY`) and Morocco in French (`fr-MA`), taking
  the matrix from 73 to 79 editions and 67 to 69 countries.
  Each was fetched live and compared with a confirmed edition on the same query.
  The edition code had to be kept, the article set had to differ, and the
  country's own press had to be present. The evidence is recorded in the code.
  Seventeen candidates were rejected and recorded so they are not re-added blind:
  - `da-DK` silently served the Norwegian edition.
  - `en-TZ`, `en-UG`, `en-ZW`, `en-BW`, `en-NA` and `en-ET` turned out to be
    one generic English feed, 82-94% identical to each other, with no local
    press.
  - `es-VE` and `fr-SN` had no local press and mirrored US-Spanish and France.
  - `pt-AO` silently served Portugal's edition, and `fr-CI` silently served France's.
  - `es-UY`, `es-EC`, `es-PA`, `es-DO` and `es-CR` all silently served the same
    US-Spanish feed.
- **README: screening-coverage badges and status badges for more live
  controls.** A new coverage row shows the sanctions lists screened (59), the
  countries issuing the screened sanctions lists (40; first published as 36, which wrongly left out Canada, France, Ukraine and the UK because their lists are tagged `Global` for their reach, and was corrected the same day), the adverse-media Google News
  editions (73), their countries (67) and the risk-term languages (61), plus
  the three news backbones and the PEP source. The numbers come from
  `data/coverage-figures.json`, which `scripts/coverage-figures.mjs` generates
  from the engine's own configuration (the `LOCALES` and `LANG_TERMS` tables
  and the two sanctions source files). A new `--check` drift step in `ci.yml`
  and `npm test` stops them going stale. Status badges were added for the PEP
  harvest, PEP chain watchdog, EOCN reconcile, site currency, delivery
  watchdog, control retry, production deploy, bandit, Fortify, dependency
  review, Lighthouse and Scorecard workflows.
- **The daily Sanctions Screen digest could still be refused as too large**
  (`scripts/asana-notify.mjs`). On 2026-09-26 `screening-cases` failed with
  `.html_notes : Rich text value is too large`, so the MLRO got no results
  digest for a run of 905 subjects and 76 new matches. `fitAsanaHtml` capped
  `html_notes` by UTF-8 bytes, but Asana also limits the converted rich text,
  which can entity-encode every non-ASCII character. The Turkish, Arabic and
  em-dash-heavy rows the digest carries weigh far more that way than in bytes.
  `html_notes` is now measured by the same worst-case accounting the `notes`
  field and `screen.py` already use (`asanaHtmlSize`). `notifyAsana` also
  retries once on a 60% budget if Asana still answers "too large". Any
  truncation is disclosed in the card.
- **The Node adverse-media screen's GDELT fallback and breaker were never wired
  in** (`scripts/adverse-media.mjs`). The code comments said `checkAdverseMedia`
  retries GDELT on the base term set when the widened typology query is rejected,
  and stops asking a hard-down GDELT via the run-level breaker (`screen.py`
  parity). Neither was true: it made one wide-query request per subject, so a
  rejected wide query cost that subject the whole GDELT backbone, and nothing
  outside the tests called `gdeltBreakerRecordFailure()`. Both are now in the
  live path. A subject whose GDELT fetch is skipped or fails still counts GDELT
  as a failed source (partial, or errored if no other backbone answered), never
  as a clear. `test/adverse-media.test.mjs` drives `checkAdverseMedia` against a
  stubbed `fetch` to prove it, and its `knownGap()` wrapper is removed.
- **The UK Sanctions List and New Zealand's Russia register were not being
  screened** (`.github/workflows/sanctions-screen.yml`, #630). `uk-ofsi` was
  repointed to `sanctionslist.fcdo.gov.uk` on 2026-09-22, but the workflow's egress
  policy is `block` and only the retired `ofsistorage` host was allowlisted. The
  2026-09-27 scheduled run logged `uk-ofsi failed - fetch failed` and ended
  `degraded=true`; `nz-mfat-russia` (`www.mfat.govt.nz`) failed the same way. Both
  hosts are now allowlisted. Not yet confirmed on a real run: that needs the next
  scheduled `sanctions-screen`.
- **Three curated sources were loading no names at all** (`data/sanctions-extra.json`,
  `data/mu-nssec-curated-list.json`, #629, #630). `ma-cnasnu` (live since
  2026-09-26) and the new `bh-gazette` pointed at their in-repo file with `url`, but
  `fetchListBody()` only treats a source as local when the field is `file`, so both
  threw `Invalid URL` and surfaced only as a generic "coverage degraded" note.
  `mu-nssec` used `surname`/`otherNames`/`aka`, which `parseCuratedList` does not
  read, so it parsed 0 names. All three now load (28, 387 and 6 name strings).
- **Seven OpenSanctions sources were returning HTTP 404** (`data/sanctions-extra.json`,
  #627, #628): `az-fiu`, `au-dfat-opensanctions`, `ch-seco-opensanctions`,
  `sa-pcct-opensanctions`, `qa-nctc-opensanctions`, `kg-fiu-public`, `idb-sanctions`.
  OpenSanctions moved these from `artifacts/<name>/latest/` to
  `datasets/latest/<name>/`; the old path answers `NoSuchKey`. The new URLs redirect
  within `data.opensanctions.org` (already allowlisted) and returned current data.
  #627 also gave the OpenSanctions copies of `sa-pcct` and `qa-nctc` their own ids:
  the loader does not dedupe by id, so each list was being fetched twice.
- **Added the Bahrain National Terrorism List**
  (`data/bh-gazette-curated-list.json`, #629): 208 individuals, 172 entities and 7
  vessels from Cabinet Resolution 01-2741 (Official Gazette Supplement 3739, 28 March
  2024). An earlier session had left this unresolved because the Arabic extraction
  was corrupted. `pdftotext -layout` extracted it far more cleanly, but not
  perfectly: 369 of 387 entries needed only a stray U+FFFD removed, and 18 also had
  an inserted mid-word space, resolved one by one from evidence inside the same
  document, never guessed. Two alias variants of individual #106 could not be
  resolved and were omitted; the middle name of #116 is not independently
  confirmed. 12 entries carry a `verification_note`. The transcription was merged
  without a second-person review.
- **Tunisia's coverage floor was set from a wrong count**
  (`data/sanctions-extra.json`, #630). `tn-cnlct` had `minNames: 200`, taken from a
  `wc -l` figure (297) inflated by multi-line CSV cells. The dataset has 166 records
  (159 Person, 7 Organization), so every run reported a false "truncated source" and
  stayed degraded. The floor is now 150.
- **New registry integrity test** (`test/sanctions-registry-integrity.test.mjs`,
  #630). Offline, registered in `ci.yml`. Fails on: a curated source using `url`
  instead of `file`; a curated file yielding fewer names than `minNames`; an enabled
  source host missing from the `sanctions-screen.yml` egress allowlist; a retired
  OpenSanctions `artifacts/` URL; two enabled sources sharing an id. Run against
  main before the fixes it failed on exactly `uk-ofsi`, `nz-mfat-russia` and
  `mu-nssec`.
- **Adverse-media term lists for 15 languages were checked against each country's
  own FIU or AML law rather than translated** (`scripts/adverse-media.mjs`, #611 to
  #622, #624, #625): French, Hebrew, Portuguese, Spanish, German, Ukrainian,
  Japanese, Indonesian, Malay, Thai, Urdu, Tagalog, Hindi, Latvian and Dutch, plus
  New Zealand and Belgian locales (#611). Tagalog received a single term, because
  Philippine AML discourse keeps money laundering, AMLC and covered transactions in
  English. #626 restored the Portuguese terms that #614 silently deleted: it was
  built from a copy of the file fetched before #613 merged.
- **Freshness-check exemption for the Netlify fallback cron**
  (`scripts/freshness-check.mjs`, #623). The daily schedule added in #609 was never
  registered, so the freshness-check test failed; the workflow is now listed as
  exempt (it has no ingestion or evaluation duty).
- **`kg-fiu` note updated** (`data/sanctions-extra.json`, commit `ea4c4bb`, pushed
  straight to `main` without a PR). Records that a 2026-09-27 probe got no HTTP
  response at all, where the 2026-08-05 probe got an HTML page.

## [4.0.0] - 2026-09-25

- **The daily screening was being killed at 64 minutes by our own egress
  allowlist** (`.github/workflows/weekly-adverse-media.yml`,
  `test/workflow-hardening.test.mjs`). A GitHub-hosted runner heartbeats to
  `hosted-compute-watchdog-prod-<shard>.githubapp.com`, and a runner that cannot
  answer is reclaimed on a fixed timer — the job dies mid-step with no
  conclusion, no post-step (not even the `if: always()` one) and no uploaded
  logs, which is why five investigations since 6 Aug all hit a 404 on the very
  logs that would have explained it. The `adverse-media` job's allowlist pinned
  the shard **literally**, as `...-prod-iad-01`, so the sweep survived only on
  the days GitHub happened to place it on that shard. The evidence is a timer,
  not a workload ceiling: runs 31452192472, 31458943581 and 31557541298 died
  64m02s, 64m00s and 64m01s after job start — three failures inside a
  two-second band, which no workload-dependent limit produces. The obvious
  counter-hypothesis, that the sweep simply takes about an hour, is refuted by
  the control group: run 31468597213 **succeeded** on 11 Aug with a 65m08s job
  whose screening step alone ran 64m49s — longer than the entire lifetime of
  each of the three failed jobs — and a 120m54s sweep succeeded on 10 Jul. Same
  workflow, same config; the only variable is whether the heartbeat could be
  answered. A reclaim is unmistakable in the API too: the step stays
  `in_progress` with no conclusion and every post-step stays `pending`, which a
  normally-failing step never does (the 10 Aug run, which failed on the EOCN
  review-age gate, closed its step and ran every post-step as usual).
  The crash-forensics heartbeat added for exactly this
  confirmed the shape: run 31557541298 published `sanctions-done` (45 flagged /
  311 clear) and `enrichment-start` (904 subjects) at 9m32s, then nothing for
  the 54 minutes until the VM was taken. The allowlist now carries
  `*.githubapp.com:443`, which is what the other 50 workflows in the estate use,
  what fixed the identical ~63-minute deaths on `pep-worldwide`, and what fixed
  the same losses on `sanctions-screen` on 11 Aug — green every run since. This
  job was the one left behind.
  Guarded in both directions so it cannot come back (§8 of the hardening
  ratchet): **no** egress block anywhere may name a `hosted-compute-*` host
  literally, because the shard suffix is GitHub's to rotate and never ours to
  pin; and **every** job whose `timeout-minutes` exceeds the 60-minute reclaim
  window must allow the wildcard. The guard derives the job list from the
  workflows themselves, so a new long-running control is covered the day it is
  added rather than the day it first dies.

- **The AI triage pass fans out; sixteen minutes of the daily sweep were spent
  waiting in series** (`screen.py`, `ai.py`). Production measurement on
  2026-08-11 (run 31479768870): `Delta:` 10:41:54 → `AI: risk-rated` 10:57:56 =
  **16m02s**, against 16m44s and 17m29s on the two preceding days. The model was
  never failing - no circuit trip appears in any of those logs - it was
  answering at roughly ten seconds a call, and the loop asked for one article at
  a time. That is a quarter of a 64-minute sweep, at the very end, with the
  narrative and the Asana delivery still to come. Each article is independent
  (`triage_adverse` reads one headline and writes one dict), so the loop is now
  a bounded fan-out over `AI_TRIAGE_CONCURRENCY` (default 4, separate from
  `SCREEN_CONCURRENCY` - that one is sized against free feeds' per-IP patience,
  this against a paid API's rate limit).
  Two supporting changes make that safe. **A reply is no longer an outage:** the
  breaker exists to stop paying the 30s timeout, and an HTTP reply of any status
  arrives in milliseconds, so replies now re-arm it and only transport errors
  advance it - without which a burst of 429s earned by the new concurrency would
  have disabled triage for a whole run while saving no time at all. And the
  call counters are **lock-protected**, because they are reported and a lost
  increment would understate how degraded a run was. Expected ~16m → ~4m;
  **unverified until the next live sweep.** 11 checks in `test/engine_test.py`,
  including exact counting under 8 concurrent threads; the prompt-injection
  red-team still passes unchanged.

- **The two US SEC enforcement feeds have been 403-ing on every run, and now
  say why** (`screen.py`, `data/regulator-bulletins.json`). `US SEC -
  Litigation Releases` and `US SEC - Press Releases` have failed on every
  daily run since at least 9 Aug with a bare `http 403`, silently costing the
  adverse-media net its US enforcement and litigation coverage. The connection
  succeeds - `www.sec.gov` is on the runner allowlist - so this is SEC actively
  refusing, and their automated-access policy requires a User-Agent that
  declares the caller and a contact point; the fetch was sending a
  browser-shaped `Mozilla/5.0`. Feeds may now carry a per-source `ua`, and only
  the two SEC entries do: **six of the eight feeds work with the current
  default, and changing it globally could push a working feed into 403 - a
  recall regression, which this repo forbids.** The contact address is not
  committed: a source's `ua` carries a `{contact}` token substituted from the
  `REGULATOR_UA_CONTACT` repo variable, and with it unset the placeholder is
  stripped rather than sent literally and the 403 is reported *with its likely
  cause* instead of as a bare status code. **Unverified against SEC itself** -
  the sandbox's egress proxy blocks `sec.gov`, so the first live run is the
  test; if 403s persist with a contact configured, the cause is something else
  and the diagnostic will say so. 7 checks in `test/engine_test.py`.

- **A sweep that dies with the runner now leaves evidence** (`screen.py`,
  `.github/workflows/weekly-adverse-media.yml`). Five times between 6 and 11
  Aug 2026 - on the daily screening and on `sanctions-screen`, 58–64 minutes in
  - the GitHub runner was **lost**: the step stayed `in_progress` with no
  conclusion, no post-step ran (not even the `if: always()` one), and the logs
  were never uploaded, so every investigation dead-ended on a 404. Runtime was
  ruled out: a 120m54s run of this same workflow succeeded on 10 Jul, and the
  10 Aug success ran 64m31s - *longer* than the three ~64m failures.
  `screen.py` now records each phase boundary to `data/run-progress.json`
  (phase, wall-clock elapsed, counts), and a backgrounded heartbeat publishes
  it to a dedicated `screen-progress` branch **while the sweep is still
  running** - the only way to capture anything, since an artifact upload is a
  step and steps do not run when the runner is gone. The next death will name
  the phase it died in; the AI phase, which burned 16m44s and 17m29s on the two
  preceding days, has its own marker either side.
  Built so it cannot endanger what it watches: the writer is local, cheap and
  **cannot raise**; the heartbeat is read-only against the workspace (every
  commit is built in a throwaway repo, so the checkout's index, config and HEAD
  are never touched mid-sweep); it force-pushes **orphan** commits to its own
  branch, never `screen-delta-state`, so the delivered-finding history keeps
  exactly one writer and the progress branch stays permanently at one commit;
  and it is started in its own step so `GITHUB_TOKEN` is never in the screening
  step's environment. Both heartbeat steps are `continue-on-error` - `run:`
  executes under `bash -e`, so without it a heartbeat that merely failed to
  *start* would fail the step, fail the job, and stop the day's screening,
  making a mandatory AML control depend on its own diagnostic; the sweep step
  itself deliberately is not, because its exit code is the control's verdict.
  The stop step publishes the FINAL state through the same code path as every
  interim one - without that, the terminal phases are written locally and die
  with the VM, and the first production run proved the cost: a sweep that
  SUCCEEDED at 10:58:01 left the branch reading `ai-triage-start`,
  indistinguishable from a death in the AI phase, which is the exact question
  the file exists to answer. 19 checks in `test/engine_test.py`; push mechanics
  and the terminal publish both exercised against a local bare repo.

- **Correction to the LLM circuit-breaker entry below.** That change was
  described as addressing the ~17-minute AI phase. Production measurement on
  2026-08-11 (run 31479768870, the first with phase instrumentation) shows it
  does **not**: `Delta:` 10:41:54 → `AI: risk-rated` 10:57:56 = **16m02s**,
  against 16m44s and 17m29s on the two preceding days, with **no** circuit trip
  in the log. The Anthropic calls are succeeding, slowly - not timing out. The
  "~33 calls of pure timeout" in that entry was inferred from wall-clock, never
  measured, and was wrong. The breaker still bounds a genuine outage (where the
  cost would otherwise be unbounded) and the degraded-run disclosure stands,
  but the latency itself is unaddressed: the triage loop is SEQUENTIAL, one
  call per adverse article and per flagged subject. Fixing it needs a phase
  budget or a concurrent triage pass, not a breaker.

- **Freshness Check: the today-signals move into the tested pure layer**
  (`scripts/freshness-check.mjs`). This file's contract is that the decision
  logic is offline-tested and only the runner block touches the network, but
  the two signals that decide whether a mandatory control may stay silent -
  is a run in flight, has one already failed - were computed inside the
  `fetch` that fed them, where no test could reach. Extracted as the exported
  pure `summariseTodayRuns(runs, today)` and regression-tested against the
  **real recorded Actions-API payloads** from the 2026-08-11 incident (two
  runs dead from lost runners, a third mid-sweep): the closest thing to an
  integration test that stays offline, pinning the exact production shape the
  old `per_page=1` read got wrong. Also pinned: a prior day's runs never leak
  into today's verdict, `skipped` is not a failure (a no-op make-up firing did
  not fail to screen) while `timed_out` and `cancelled` are, and a
  missing/empty run list is tolerated. 9 further checks (132 in that suite).

- **Freshness Check: a control that already failed today can no longer hide
  behind its own retry** (`scripts/freshness-check.mjs`). The alarm skipped any
  control with a run in flight, so as not to red a long screen that is simply
  mid-sweep - but `pendingToday` was read from the **single most recent run**
  (`per_page=1`), so the failures sitting just below that one run were never
  looked at. A mandatory control could therefore fail every firing of the day
  and still be dropped from the alarm entirely, because a retry happened to be
  running when the check fired. The window is not narrow: the daily screening
  fires three times a day at ~64 minutes each, so the 09:09 **and** 12:09
  firings can both land mid-sweep. Now one call (widened to 20 runs, no extra
  round-trip) answers both questions - is anything running, and has anything
  already finished unsuccessfully today - and the mid-run pass applies only
  while the day is still an open question. Once a run has finished
  unsuccessfully, an in-flight retry no longer buys silence. A day that heals
  reports green at the next firing; a day that does not is loud the whole way
  through. The alarm table gains a `Today` column so the three shapes that
  reach it - never fired, failed, failed-and-retrying - are told apart rather
  than collapsed into one row. Cancelled and timed-out count as failures:
  neither produced a screening. 6 checks in `test/freshness-check.test.mjs`.

- **The LLM path gets the circuit breaker every other feed already had**
  (`ai.py`, `monitoring.py`). Google News, GDELT, Bing News and Wikidata each
  trip a run-level breaker after N consecutive failures; the Anthropic call was
  the one external dependency with none. It does not fail fast - a degraded
  endpoint costs `llm_complete`'s full 30s timeout on *every* call, and the
  triage loop calls it once per adverse article and per flagged subject,
  sequentially, in the LAST phase of the daily sweep. Measured on the
  2026-08-10 production run: the AI phase took **16m44s** for a 45-flagged /
  57-cluster workload that cost ~2m the day before on the same code path -
  ~33 calls of pure timeout, unbounded and undisclosed, landing after ~40
  minutes of enrichment while the run still had to build the narrative and
  deliver to Asana. Now five consecutive hard failures (transport error or
  non-200) declare the model unavailable for the rest of the run with one loud
  line; any HTTP 200 re-arms it, so an intermittent failure never trips it.
  The degrade is defined, not a guess: every caller computes deterministically
  first and lets the model only *sharpen* - `triage_adverse` keeps its typology
  severity floor (and may never downgrade), `alert_summary` writes its own
  prose. Skipping the model costs sharpening, never a finding. The skipped
  count is carried in the run metrics and disclosed in the report's monitoring
  block, so a tripped circuit can never read as a full-strength AI pass that
  merely made fewer calls. 12 checks in `test/engine_test.py`.

- **PEP harvest made fault-tolerant** (`scripts/pep-worldwide.mjs`): the first
  live harvest crawled ~62 minutes of Wikidata then a single flaky WDQS
  response threw and discarded the whole run. Now: holder batches are smaller
  (60, well under the WDQS 60s kill), a batch that fails after retries is
  counted and skipped rather than fatal, and a new failure-rate gate refuses
  to write only when >10% of batches were lost (a real outage) - below that
  the run keeps what it swept and the floor/shrink gates still guard the
  write. Label chunks and position queries are likewise non-fatal per-unit.
  A transient query hiccup no longer costs an hour's harvest.

- **Screening hardening audit - seven confirmed silent-clear / recall-loss
  holes closed.** An adversarial audit (6 finders across every screening
  surface, each candidate verified against the actual guards) found and this
  change fixes:
  - **OFAC SDN + alt.csv now decode latin-1** (they are latin-1 on the wire;
    `screen.py` always decoded them so, but the JS fetcher's `r.text()` forced
    UTF-8 - mangling every ñ/accented designation into a split token so
    "PEÑA" cleared against customer "PENA" on the *primary* list, invisibly to
    the row-count floors and to matcher-parity). Strictly recall-widening.
  - **`normalizeName` folds Ɖ→d / Ɔ→o** to match `screen.py`; a short
    designation in those African-Latin letters keyed apart from its ASCII
    spelling and cleared. Parity corpus pins it.
  - **Standing enrichment matches are no longer silently cleared on
    unverified coverage.** Three routes closed: (a) the diffState *match*
    branch now carries a prior enrichment signal forward when its module was
    off this run (e.g. `SCREEN_PEP=0` during a Wikidata outage - previously
    it erased every standing PEP from the book on the still-matching path,
    which the *clear* branch already guarded), preserving the stronger prior
    band it drove; (b) a **narrowed adverse-media sweep** (the default is a
    budgeted ≈8-of-70 locale rotation) now marks that signal unverified so a
    standing adverse-media hit is held, not cleared, off a rotation that never
    queried its originating edition - it clears only on a full-matrix sweep or
    an MLRO disposition; (c) a disclosed-partial sweep likewise holds. All
    carry-forward-only - recall is monotone-preserved; a genuine de-listing
    still clears once fully re-verified (control tests included).
  15 new regression checks across the matcher, parity and screen suites lock
  every fix. (One further low-severity finding - a generic-XML source whose
  count floor is too small to detect a corrupt-but-200 body, Latvia - is
  documented for a dedicated schema-aware parser; its only recall-safe fix
  forces permanent degraded status on a marginal list, a worse trade.)

- **Live-run true-up: two non-parsing sources disabled on evidence.** The
  first green run of the widened estate (25 lists, 226,636 names) left two
  additive sources degrading loudly: `za-fic-tfs` (probe shows its
  `?fileType=xml` URL returns an HTML *landing page*, not the XML file - a
  URL-discovery task) and `adb-debarment` (fetch fails at connection level
  from GitHub runners, same class as Sri Lanka). Both disabled with the
  observed truth recorded and a re-probe path; the next daily screen runs
  non-degraded. Nothing silently cleared - the run stayed green throughout
  because degraded additive sources never red the run, they just disclose.

- **Probe-evidence wave: five sources re-enabled, one confirmed dead.** The
  first source-probe run turned every guess into evidence, and the fixes
  land with it: **Israel NBCTF** re-enabled (real 87KB workbook; the XLSX
  reader now SCANS for the header row - English headers sit under a Hebrew
  caption row - and carries the English/Hebrew/Arabic name columns into the
  transliteration nets); **Saudi PCCT** re-enabled (the reader now walks
  EVERY worksheet - sheet 1 is vessels, the individuals/entities live on
  other tabs); **Qatar NCTC** re-enabled (real JSON, 864 designations,
  mislabeled content-type; `fullNameEn`/`fullNameAr` keys added and the
  JSON walker now keeps EVERY whole-name key per record, so both scripts
  screen); **Brazil BCB ×2** re-enabled (payload parses clean - the
  difference was the fetch: per-source `browserHeaders` option added, used
  by every endpoint the probe validated with browser-shaped requests);
  **Mexico SAT 69-B** enabled (per-source `charset` decode for its latin-1
  CSV + a dedicated parser that screens ONLY live statuses - a rebutted or
  court-cleared taxpayer never flags; named as a tax-integrity signal, not
  sanctions). Sri Lanka is confirmed unreachable from runners (probe
  evidence recorded); Jordan is reachable but HTML-only (note corrected).

- **Case-card XML contract fixed and frozen.** Both live runs' case creates
  400'd (`xml_parsing_error`) on the machine-read Disposition block: Asana
  parses `html_notes` as strict XML against a supported-tag subset, and the
  block's `<p>…<br>…</p>` uses two tags Asana rejects (`<br>` unclosed AND
  unsupported). The block is now a `<ul>` - wording verbatim, read-back
  unchanged - and a new strict-XML guard in the cases suite validates the
  full card and the daily digest against Asana's tag set (balanced or
  self-closed, supported tags only), so this failure class cannot ship
  again. Also recorded: CodeQL triage addendum for the two by-design
  source-probe alerts (dismissal is the owner's act, §6 of the triage
  record).

- **Source-probe diagnostic** (`scripts/source-probe.mjs` + dispatch-only
  `source-probe.yml`): fetches registry-configured sources (by id - never an
  arbitrary URL) with realistic browser headers and reports status, headers,
  a bounded control-byte-escaped body sample, JSON key paths, and sheet
  header rows as a step summary + artifact. Exists to close the loop on the
  five sources the first worldwide live run disabled on evidence (WAF
  challenge vs field mapping vs layout - each needs the actual response,
  observable only from a runner). Diagnostic only: no screening, no state,
  no secrets.

- **First live worldwide run: verdicts recorded, mirror retired.** The
  2026-08-05 verification run indexed **221,035 designated names from 20
  lists** and surfaced 47 new matches. Proven live: DFAT direct (11,068 -
  richer than the OpenSanctions mirror, which is now **retired**: the
  registry's last OpenSanctions-hosted feed is gone), Netherlands ODS (118),
  Trade.gov CSL (13,379), Belgium (6,376), Monaco (15,636), Argentina (471),
  Brazil TCU (452), Latvia (13). Recorded as disabled-with-reason after
  observing live behaviour: Israel (WAF challenge), Qatar (portal
  challenge/shape), Sri Lanka (runner-unreachable), Saudi (sheet layout),
  Brazil BCB ×2 (OData field names) - each note carries the observed
  failure and the re-enable path; South Africa's FIC file switches to the
  UN-schema parser (next run verifies).
- **Asana card hardening (`esc`)**: XML-invalid control characters and
  unpaired surrogates are now stripped before entity-escaping - four case
  creates 400'd live (`xml_parsing_error`) when designated names from the
  widened list set carried stray control bytes; escaping alone cannot
  represent those characters in XML. Regression checks pin the behaviour
  (tabs/newlines and astral emoji survive).

- **Worldwide PEP list - free, license-clean** (`scripts/pep-worldwide.mjs`
  + weekly `pep-worldwide.yml`): a real screenable worldwide PEP list
  harvested from Wikidata (CC0 - the one free commercial-use-clean source),
  replacing reliance on the weak per-name signal alone. Two-phase SPARQL
  partition (position items per FATF-grade root class → holders per VALUES
  batch at BestRank with a 24-month recency window) sidesteps the WDQS 60s
  kill and the unreliable OFFSET paging; every-language labels/aliases feed
  the matcher's transliteration nets; floor + shrink gates refuse a hollow
  harvest so an upstream outage can never thin the screened list. The
  artifact lives on the `pep-worldwide-state` branch; the daily screen
  overlays and screens it as a LOCAL index - hits are review-tier `PEP
  (Worldwide - Wikidata)` findings (band capped at medium, non-whitelistable
  by prefix, never a sanctions recommendation), with office + country + a
  former-holder marker in the hit detail, and the signal enters
  `evaluatedSignals` so standing PEP-list matches survive artifact-less runs
  uncleared.

- **Worldwide sanctions coverage expansion** (13-region survey, every claim
  documented in-registry): twelve new machine-readable national/institutional
  lists screen daily - US Trade.gov Consolidated Screening List (eleven
  export-control + non-SDN lists; SDN block deduplicated to its authoritative
  OFAC source), Sri Lanka 1373 designations, Netherlands national terrorism
  list (new ODS reader), Belgium FOD consolidated, Monaco fund-freezing,
  Latvia FID national, Israel NBCTF, Saudi PCCT, Qatar NCTC unified, Argentina
  RePET, Brazil BCB/TCU enforcement + debarment (4 feeds), South Africa FIC
  TFS, ADB debarment register - plus Australia DFAT's Improved Consolidated
  List re-enabled DIRECT from dfat.gov.au (starts retiring the OpenSanctions
  mirror; licence-clean path). Sources that publish only HTML/PDF or sit
  behind keys/WAFs are recorded as documented disabled stubs (Turkey, Egypt,
  Jordan, 13-country Asia cluster, CIS, Africa, NZ, EBRD/IDB/AfDB), so the
  registry itself is the survey record: enabled means machine-verified path,
  disabled means documented blocker - never fake coverage. Generic JSON
  parser gains Spanish/Portuguese name keys; every new source carries a
  coverage floor and the standard degrade-loudly contract.
- **FBI Wanted enrichment signal** (`scripts/fbi-check.mjs`, opt-in via
  `SCREEN_FBI=1` like Interpol): per-subject lookups against the free FBI
  Wanted API; only active wanted posters of Main subjects count (missing-
  person, victim/accomplice and captured posters are excluded by
  construction); high-band "must verify", never an auto-decision.
- **Regulator-bulletin net widened US+EU+UAE**: DOJ press releases, CFTC
  enforcement, OCC news, DFSA media releases and Europol newsroom RSS join
  SEC/FCA (all keyless RSS - no fetcher change); FinCEN/MAS/FATF/VARA have
  no feeds (recorded in the config for the next surveyor).

- **Yente matching benchmark - experimental, shadow-only**
  (`scripts/yente-bench.mjs` + dispatch-only `yente-bench.yml`): boots the
  MIT-licensed open-source yente matching engine (the software behind the
  OpenSanctions API) on the runner and scores it against the repo's own
  frozen screening benchmark - the fixtures' `listed` names are indexed as a
  custom yente dataset (license-clean: NO OpenSanctions data is downloaded;
  the published database carries a non-commercial licence), every `subject`
  name runs through `/match`, and the report (recall + false-positive rates
  at 0.5/0.6/0.7, per-mechanism breakdown) lands as step summary + artifact
  beside the committed baseline. A measurement instrument for the "adopt
  identifier-aware matching software as a corroboration engine?" decision;
  touching the live matcher would be a separate recall-monotone-governed
  change. No screening state, cases, or Asana surface involved.

- **Workflow-hardening ratchet** (`test/workflow-hardening.test.mjs`, CI-
  wired): the 2026-08-05 full-estate audit found every hardening deviation
  across all 57 workflows documented in-file; this guard freezes that state -
  every action SHA-pinned, harden-runner + `timeout-minutes` on every job,
  `persist-credentials: false` on every checkout, top-level `permissions`
  everywhere, no `write-all`, and every `egress-policy: audit` carrying its
  written rationale. 356 checks; a future workflow or edit that regresses any
  of it fails CI, and exceptions require a quoted in-file justification.

- **Ad-hoc batch name screening** (`scripts/batch-screen.mjs`): screen any
  CSV/list of names (prospects, walk-ins, supplier shortlists) against the
  same lists and matcher as the daily control - no Asana, no state; exits red
  rather than reporting against unloaded lists; reduced coverage disclosed.
- **Regulator enforcement-bulletin net** (4th adverse net, supplementary):
  SEC/FCA enforcement feeds fetched once per run (`data/regulator-bulletins.json`),
  subject names scanned against items (≥2 significant tokens); a regulator
  naming a subject is a strong-tier Enforcement/Legal finding; failed feeds
  disclosed in §② and the log, never silent, never fatal.
- **Identity cross-check on adverse hits** (display-only, demote-never-
  suppress): each flagged article is labelled *identity-corroborated* (also
  mentions the subject's associated entity / recorded nationality) or
  *name-only match - disambiguate*; absence of corroboration never demotes
  or suppresses.
- **Per-subject screening statements** in `subject_report.py`: regulator-grade
  narrative auto-selected from the file's actual state (under review / false
  positive with case cited / escalated with no-tipping-off), full list scope
  and FDL 10/2025 · CR 74/2020 basis in every variant.
- **Follow-Ups reminder attestation** (opt-out via `FOLLOWUP_PROJECT_GID`):
  after the daily report is delivered the engine posts a proof comment on the
  externally-generated reminder card and completes it on zero-finding days
  only; action days stay open for the analyst; failed runs never touch it.

- **09:00 UAE daily delivery target + professional report register.** The
  daily report now budgets itself against a delivery target (default
  `DELIVERY_TARGET_UTC=05:00` = 09:00 UAE): because GitHub delivers scheduled
  events 2-4h late (measured), the run controls its finish, not its start -
  news enrichment stops when continuing would miss the target, deferred
  subjects are disclosed in the report ("deadline-deferred", never silent,
  never counted clear; PEP still covered by the worldwide net) and the
  same-day make-up pass re-sweeps them; a run starting after the target
  delivers ASAP with full enrichment. The report itself moves to a formal
  register: "Daily AML/CFT Screening Report" title with a words-not-emoji
  ACTION REQUIRED / No open findings marker, a formal header (prepared-for,
  four-eyes statement, delivery time vs target, population, control status),
  and matching onboarding/make-up variants.

- **TFS FFR/PNMR draft dossiers** (`tfs_dossier.py`, str_dossier pattern -
  DRAFT ONLY, never files or freezes): a goAML-aligned Funds Freeze Report /
  Partial Name Match Report dossier for matches against the UN Consolidated
  or UAE Local Terrorist List (CR 74/2020 under FDL 10/2025), with a
  report-kind recommendation the MLRO confirms against current EOCN guidance,
  listed-person particulars, funds table (or nil holdings), the TFS
  checklist, and blank sign-off fields. Non-TFS matches are rejected onto the
  ordinary alert path.
- **Per-subject screening report** (`subject_report.py`): a single-subject,
  audit-ready evidence record rendered from the committed screening state -
  every hit with mechanism/confidence/carried-forward/cleared-FP annotations,
  the OFAC-API second opinion, and the case lifecycle - with blank
  MLRO + four-eyes sign-off fields (named humans only). An absent or
  unreadable state can never render as a clean report.

- **Analyst feedback loop on the screening case board.** Case cards now carry
  a machine-read disposition block: ticking `[x] false positive` clears the
  case and registers the exact designated-name+list pairs in a **cleared-FP
  registry** (case gid as evidence); identical future hits are DEMOTED with
  the clearance cited - annotated on report and card, never removed - and
  stop opening fresh cases, while a new or changed designated name re-opens
  normally (pair-level identity = built-in re-confirm on list change).
  `[x] escalate / freeze (TFS)` pins the case against every auto-clear and
  moves it to Escalated. Curated entries live in
  `data/screening-whitelist.json` (four-eyes PR procedure); kill switch
  `SCREEN_WHITELIST=0`. Conflicted cards resolve fail-safe (escalate wins).
- **OFAC-API second opinion on new matches (opt-in).** With repo var
  `OFACAPI=1` + the `OFAC_API_KEY` secret, every new/changed sanctions match
  (capped per run) gets an independent corroboration verdict from OFAC-API.com
  rendered on its case card - corroborated / no-match / unavailable - strictly
  additive: it can never downgrade, clear, or re-alert a hit, and a failed
  lookup reads as a lost signal, never a clear. Third-party transfer: record
  the processor in the third-party register before enabling.
- **CPF / proliferation-financing terms now reach the news queries.** The
  flag dictionaries always knew `proliferation financing` / `wmd` /
  `dual-use`, but the targeted Google News query never asked for them - a
  PF-specific story only surfaced if it also tripped a generic term. The
  English query gains `proliferation`, `export control`, `dual-use`,
  `sanctions evasion`; the Arabic query gains `تمويل الانتشار` and
  `أسلحة الدمار الشامل`, with matching `ADVERSE_KEYWORDS_AR` canonicals and
  an `export control` entry in the keyword set + Sanctions/Proliferation
  typology (FATF R.7 / UAE TFS alignment).
- **FraudLabs support signal on onboarding (opt-in, PDPL-gated).** A
  supplementary payment-fraud indicator on a newly onboarded customer's
  contact email (disposable/free/young-domain traits) - explicitly NOT a
  screening verdict and unable to block or red a run. OFF by default: enable
  by recording the processor + transfer basis in the third-party register,
  then setting repo variable `FRAUDLABS=1` with the `FRAUDLABS_API_KEY`
  secret. Material results (REVIEW/REJECT, score ≥ 60, disposable email)
  land as a clearly-labelled comment on the customer card; a signal that
  cannot be fetched is disclosed as lost, never read as clear.
- **Adverse-media/PEP coverage now spreads across the day.** The free news
  feeds rate-limit per egress IP, so a daily sweep could succeed with part of
  the book uncovered (5 Aug: GDELT and Google News circuits both opened
  mid-run). Two changes, engine + workflow: (1) the retry firings of
  `weekly-adverse-media.yml` on an already-successful day now run as a
  **coverage make-up pass** (`AM_COVERAGE_RETRY=1`) - the engine reads the
  committed run-metrics counts (`monitoring.makeup_decision`, counts only, no
  PII) and either exits in seconds or re-sweeps the full book from the fresh
  runner's fresh IP, with delta-state suppressing already-reported findings
  and a distinct "🛡️🔁 … (coverage make-up)" digest title; (2) the enrichment
  order now **rotates daily** (`screen.enrichment_rotation`, prime stride,
  extra offset on make-up passes) so a mid-run circuit trip no longer costs
  the same tail of the book its news coverage every day - results are
  restored to book order so nothing downstream changes.
- README and CONTRIBUTING gained a **project-handbook navigation row** linking
  the community/governance documents that GitHub's repo-overview tab bar does
  not surface (`SUPPORT.md`, `GOVERNANCE.md`, `MAINTAINERS.md`, `CHANGELOG.md`,
  `CITATION.cff`, `docs/README.md`) - those files exist but the tab bar shows
  only README / Code of conduct / Contributing / License / Security.

## [3.8.0] - 2026-08-04

### The repo's accounting of itself became the deliverable (2026-08-04)

The August 2026 full-repo audit asked what a "perfect" repo still lacked. The
answer, in this repo's own currency: every remaining gap either closed with a
guard, or declared in the governance system with an owner and a date.

- **Declared, dated, measured.** Nine engineering items the code cannot close
  alone (endpoint auth, a second alert channel, distributed rate limiting, a
  persistence tier, error telemetry, toolchain deepening, deploy self-heal,
  engine decomposition, Arabic UI chrome) joined the
  [open-actions register](docs/governance/open-actions-register.md) as items
  20–28 - together with the `Target date` column the register's preamble had
  reserved. Governance rows stay undated (that is the Board's item-17 act);
  the counter behind KRI-09 now measures per row. The dormant dated-column
  branch of `grc-metrics.mjs` threw on first use and was fixed with it.
- **Repo governance layer.** `GOVERNANCE.md` (decision rights),
  `MAINTAINERS.md` (succession against the flagged R-17 key-person risk) and
  `CLAUDE.md` (the CI-enforced invariants, so agents and second operators
  learn them before the build teaches them). README gained a guarded
  "System state & known limitations" section - the inert transaction
  monitor, draft policy instruments, effectively-public endpoints and
  on-device-only persistence were all documented, none visible from the
  front door.
- **Docs estate.** `docs/README.md` (first index over ~190 documents),
  `data/README.md` (per-file provenance incl. the retain-on-change semantics
  of `data/retention/`), ADR-002..005 (zero runtime deps, pure-`'self'` CSP,
  client-side persistence with its registered exit path, the parity-locked
  dual-engine matcher), a deploy-rollback runbook, and a truth-up of the
  readiness review's §5 gap table - six rows still claimed ✗ for artefacts
  that shipped weeks ago; a new guard fails any ✗ row whose `docs/` path
  exists.
- **MCP audit trail closed.** Tool calls over MCP were the one engine entry
  point that left no trace in the append-only `AgentLog`. `McpAgent` now
  records every outcome (never argument values - screening subjects are
  PII), holds exactly `["mcp.tool"]`, and can never be issued a secret. The
  capability registers (`data/tool-surfaces.json`, the tool-connector page)
  still declared "no MCP server is exposed" - false since #377 - and were
  reconciled to the shipped surface.
- **Advisor integrity.** The seeded fallback ANSWER - a canned "Enhanced Due
  Diligence · High confidence" card rendered under whatever the user actually
  asked whenever no live answer existed - is gone; the idle hero renders
  instead, and the tests that pinned the canned card now pin its absence.
- **Quiet hardening.** screen.py's import-time pip self-installer became
  opt-in (`HSRA_BOOTSTRAP_DEPS=1`) with a loud default; skip links landed on
  all three screens (pa11y's blind spot, now pinned by tests); the a11y
  workflow's path filter now covers the JS/CSS that builds the audited DOM;
  `assets/super-data.js` joined ESLint and both Semgrep target lists, and
  the MCP layer + STR assembler joined the blocking Semgrep Python targets.
- **This changelog.** v3.7.1 and v3.7.2 shipped as tags without their own
  sections and 4,000+ lines had pooled under `[Unreleased]`; the sections
  below were restored retroactively along the tag boundaries, and
  `test/changelog.test.mjs` now requires a `## [x.y.z]` section for the
  version the estate declares - the guard that would have caught the drift.

### The deploy monitor passed by comparing a constant with itself (2026-07-30)

The `netlify: failed` badge turned out not to be a badge problem. Reading the
Netlify deploy API directly:

```
published deploy: 6a697674771b1f000883cd99
created_at:       2026-07-29T03:41:40Z
commit_ref:       403f091f  (PR #338)
deploy_source:    api
summary:          "All files already uploaded by a previous deploy
                   with the same commits."
```

Main is **31 commits past that point**. Everything from #339 to #369 - every
screening hardening, the advisor error hints, the console staleness alert - is
merged and **not on the live site**. No Netlify check-run appears on any of the
last eight `main` commits, so the Git integration is not firing on pushes; the
GitHub-native fallback, `netlify-production-deploy.yml`, is a soft no-op
because `NETLIFY_BUILD_HOOK_URL` was never created.

**Three layers reported green over that.** Each had a success criterion that
was true once and had since become unconditional:

1. **Site Currency** compared the live `APP_VERSION` with the one at HEAD.
   Both read `3.7.2`, so it printed *"CURRENT - production serves the version
   at HEAD of main"*. It was not wrong about what it measured: `APP_VERSION`
   is hand-maintained and had not moved since 16 July, so the check passed by
   comparing a constant with itself.
2. **Its own escape hatch** - a warning-and-stay-green branch for the
   pre-`app.js`-split 27 Jun bundle - could no longer fire, because the stale
   deploy does serve an `app.js`.
3. **The deploy workflow's publish-wait** succeeded as soon as `/app.js`
   served *any* `APP_VERSION`. That distinguished a modern publish from the
   27 Jun bundle exactly once; afterwards it would have reported `PUBLISHED`
   within seconds of a build hook that did nothing at all.

Currency is now measured on **content**. `netlify.toml` publishes the repo root
with no build step, so every served asset is a checked-in file byte-for-byte:
`scripts/site-currency.mjs` sha256s each root `.html`/`.js`/`.css`/
`.webmanifest` - discovered from disk, not listed, so a new asset is covered
the day it is added - and compares it with the live origin. Any merge that
changes what the site serves necessarily changes a hash, so nothing has to be
remembered. A site that cannot be read reports `UNVERIFIABLE` and **fails**: an
unread site is not a current site, and no branch can pass without evidence.

Verified end to end against the two commits that matter, not just unit-tested.
Served the exact tree production is publishing (`403f091f`) on a local origin:

```
STALE  advisor.js    repo 5efc66575c70 != live ed433973c799
STALE  console.css   repo 25da781b8fc9 != live fcf5a633ad09
STALE  console.html  repo ea58c7f71e51 != live 4e0a077c9fc8
STALE  console.js    repo 3d18d0cbfd1a != live 7a59c1e75038
verdict: DRIFT
```

Served `HEAD` - `CURRENT`, every asset matching. The four stale files are the
user-visible fixes from #365, #366 and #368; `app.js` is identical across the
two commits, which is precisely why the version-string probe passed. The old
check was blind exactly where the damage was.

The deploy workflow's publish-wait now runs the same script, so it can only go
green once the live site serves *the commit being deployed*. And its
missing-secret path, which stays deliberately non-fatal so ordinary merges are
not blocked by a one-time UI step, now names the consequence rather than the
omission: **this merge is not deployed**.

Dating a divergence - the one thing separating deploy lag from real drift - is
read from the commits API, not from `git log`. The repo's
`hawkeye-no-child-process` Semgrep rule forbids subprocess spawning in script
code, and a monitoring probe is the wrong place to make an exception for a
command-injection vector; `fetch` is already this script's transport and
`api.github.com` is already on both callers' egress allowlists. When a date
cannot be established the divergence counts as **drift** - one that cannot be
proven recent must not be excused as lag. Only divergent assets are dated, and
only when a grace window could act on the answer, so a healthy site makes no
API calls at all.

`npm test` 77/77 (21 new checks); lint clean. Restoring production itself is a
one-time Netlify action and is not in this diff - re-link the repository under
Build & deploy → Continuous deployment, or create a `main` build hook and save
it as the `NETLIFY_BUILD_HOOK_URL` secret.

### One dead function was hiding the state of every other one (2026-07-30)

Found by running the new health probe for real rather than trusting it. The
dispatched run reported:

```
FAIL: the Advisor is configured but CANNOT ANSWER - [API error 400]
BRAIN_ANSWERED: false
ASANA_TOKEN_WORKS:            ← empty
```

`ASANA_TOKEN_WORKS` was empty because that step **never ran**. GitHub's default
step condition is `success()`, and no probe in this workflow carried a guard -
so the first failing probe skipped every later one. A single dead function hid
the state of all the others, and the alert reported them as `not-reached`.

This is **pre-existing**, not new: `asana-task` failing has always skipped
`risk-backup` and `brain-soul` too. The end-to-end probes added earlier today
simply made it visible, because for the first time a probe actually failed.

For a health check this is the worst possible ordering property - the alarm
degrades exactly when there is most to report. Every probe now carries
`if: '!cancelled()'`, so all five run and the alert carries the full picture;
the alert itself still fires only on `failure()`.

Pinned by a check that locates each probe's own step block and requires the
guard inside it - matching on the file as a whole would pass on a guard that
belonged to a different step. Negative-controlled: removing the guard from one
probe fails it.

### The Advisor was out of API credit, and the hint would have sent someone to rotate a working key (2026-07-30)

The Advisor outage is now diagnosed from evidence rather than inference. The
`advisor-eval` run of 2026-07-30 11:52 calls `api.anthropic.com` directly with
the real key, and every one of its 24 evals across all three models returned:

```
advisor-eval: API error 400 - You have reached your specified API usage limits.
              You will regain access on 2026-08-01 at 00:00 UTC.
```

So the key is **valid**. The account hit a **spend cap**. Every Advisor call got
HTTP 400 back in ~360 ms, which is precisely the latency the on-device telemetry
recorded next to "last call failed".

**The hint shipped hours earlier was confidently wrong about it.** A bare 400
mapped to *"the request was rejected as malformed upstream"* - which would have
had someone debugging a payload while the real fix was a billing limit. A hint
that is precisely wrong is worse than a bare status code: it spends the
operator's time in the wrong place and, in the `function-health` wording, told
them to **rotate a key that works**.

`isUsageLimit(status, body)` now classifies the upstream body - never reflects
it; the wording is ours and the provider's text stays in the function log - and
separates the two causes on both statuses that can carry them:

| upstream | reported as |
|---|---|
| 400 + *"usage limits"* / *"credit balance"* | **billing cap** - raise it in the Anthropic Console, or wait for the reset. **Do not rotate the key.** |
| 400, any other body | malformed request |
| 429 + *"credit balance too low"* | **billing cap** |
| 429, any other body | rate limiting - retry |

The `function-health` alert carries the same correction: the two causes need
**opposite** fixes, so it now says to read the detail before acting rather than
naming one remedy.

Eight checks pin it, including that a genuinely malformed 400 is still called
malformed, that a plain 429 is still rate limiting, that the classifier never
fires on an auth or overload body, and that classifying the body did not start
**reflecting** it. Negative-controlled: neutering the classifier fails three.

Worth recording plainly: the earlier diagnosis in this session ranked
401/revoked-key as most likely. It was 400/quota. The reasoning that located the
fault *inside the API call* was right - the ranking of causes was not, and only
the log settled it.

### The Advisor health alarm proved the API key EXISTS, never that it WORKS - 10 green days over a dead Advisor (2026-07-30)

Reported: the Advisor would not answer, and **nothing had alerted anyone**. That
second part is the more serious finding.

`function-health.yml` probes `brain-soul` daily with an empty body and treats
HTTP 400 as healthy, logging:

```
ok: brain-soul is live and ANTHROPIC_API_KEY is present
```

`brain-soul` checks the key's **presence** before it parses the body:

```
origin → token → rate limit → ADVISOR_ENABLED → KEY MISSING (503)
       → content-type → body size → JSON parse (400)
```

So a `{}` probe reaches 400 whenever the variable is merely **set**. The probe
never calls the Anthropic API at all. A key that is present but **revoked,
expired, out of quota, or not entitled to the routed model** returns 400 to that
probe every single day, while every real user call dies upstream at 401/403/404.

The run history is unambiguous - **ten consecutive successes, including
2026-07-30 07:43**, over an Advisor that answered nothing:

```
2026-07-30 07:43  success      2026-07-25 07:29  success
2026-07-29 08:01  success      2026-07-24 07:43  success
2026-07-28 07:56  success      2026-07-23 07:43  success
2026-07-27 08:49  success      2026-07-22 07:41  success
2026-07-26 07:48  success      2026-07-21 09:24  success
```

This is the session's recurring pattern - *counted as covered, actually not
covered, silent* - landing at the **monitoring** layer: the alarm that exists to
catch a dead Advisor could not see the way it actually dies.

The workflow now makes **one real end-to-end call** in speed mode (haiku, the
cheapest route, so a daily paid call stays trivial) and requires `ok: true`.
That is the only signal that proves the key is live, entitled to its model and
within quota. The original 400 probe is kept - it still distinguishes
"undeployed" from "key missing" for free - but its success message no longer
overstates what it tested.

The Asana alert now names the distinction that matters, because the two failure
modes need opposite responses:

> `answered: false` with brain-soul HTTP 400 means the key is **CONFIGURED BUT
> NOT WORKING** - revoked, expired, out of quota, or not entitled to the routed
> model; rotate it in Netlify Site configuration → Environment variables and
> redeploy.

The probe records *why* it could not answer, collapsed to a single line -
a multi-line value corrupts `$GITHUB_OUTPUT`'s `key=value` format and is an
output-injection vector.

Six checks in `advisor-assurance` pin it so the end-to-end call cannot be
weakened back to a status-code check. Negative-controlled: deleting the step
fails five of them.

#### The same blindness, one token over

`asana-task` and `risk-backup` check `ASANA_ACCESS_TOKEN`'s presence before body
validation too, so their `{}` probes also return 400 whenever the variable is
merely set - a **revoked Asana token passed both every day** as well. That
matters more than it sounds: Asana is where every case, alert and register
backup lands.

A real `asana-task` call would **create a task**, which a daily probe must not
do. So the token is exercised through `asana-mirror` `action:"read"` - it finds
and parses the two backup tasks, has no side effect, returns `ok:true` even for
an empty register (so a site with no backups yet does not cry wolf), and already
returns a **distinct** 401: *"Asana token unauthorized - rotate
ASANA_ACCESS_TOKEN"*.

One deliberate non-alarm: `APP_SHARED_TOKEN` is an operator opt-in, and once it
is on an unauthenticated probe cannot reach Asana at all. That case is
distinguished by its error text and **skips** rather than failing - a daily false
alarm is its own failure mode, and it trains people to ignore the real one. The
classifier was verified against all four inputs (`ok:true`, revoked token,
app-gated, unparseable) before shipping.

### A failed console refresh was silent on a phone, and left stale figures on screen (2026-07-30)

Found by sweeping for the fault class behind the Advisor telemetry bug: **a
status indicator that does not report reality.**

The Operations Console's "Refresh from Asana" button reported its outcome
through the button's **`title` attribute and nothing else**:

```js
const done = t => { …; btn.setAttribute('title', t); };
…
} else done('Refresh failed - try again');
```

A tooltip has no touch equivalent. On a phone - which is where this console is
actually read - a failed refresh was **completely silent**: the spinner stopped,
the register stayed on display, and nothing said the figures were of unknown
age. On failure `rerenderConsole()` is (correctly) not called, so what remains on
screen is the *previous* fetch, presented exactly as if it were current.

For an MLRO reading case counts, overdue reviews and prohibited-relationship
figures, silently-stale numbers are the problem, not the failed request.

The outcome now renders into a `role="status" aria-live="polite"` region beside
the stream header, and the message names the **consequence** rather than the
event:

```
⚠ Refresh failed - the figures shown are NOT up to date. Try again.
```

The network-level failure (the `.catch` path, previously identical to the
API-level one) says so distinctly. A successful refresh reports plainly and
clears itself after a few seconds rather than leaving a stale success line under
a panel it no longer describes.

Browser-verified rather than asserted, matching the standard #342 set for the
downgrade banner and #365 for the advisor strip: real Chromium drives the real
button, the Asana mirror endpoint is stubbed, and the checks cover the API
failure, the **network** failure, assistive-tech announcement, and the negative -
a successful refresh must not be marked failed, or the warning becomes noise
operators learn to ignore.

Negative-controlled: reverting to tooltip-only feedback fails 6 of the 9 checks.

Also checked and found **correct**, so left alone: `renderAnimated()` refreshes
only the numeric panels and not the alert stream - that is the count-up tween,
and alerts are not tweened; and `rerenderConsole()` does cover all four data
panels after a refresh.

### The phonetic tables could drift silently - measured, then made impossible (2026-07-30)

Four defects this week were the same shape: **two implementations of one idea
that drifted apart.** Two of those tables have since been moved to shared data
files (`translit-groups.json`, `corporate-stopwords.json`). This is a sweep for
the rest.

Four phonetic-fold tables were still duplicated in code - digraphs, vowel
classes, character map, particles. They were checked and found **currently
identical**, but only because the `tch` digraph added this week was
hand-synchronised into both files. Nothing enforced it.

So the exposure was measured directly: **one digraph (`kh`) was deleted from the
JS copy alone.**

```
full suite            74/74   pass
cross-engine parity   10/10   pass
JS benchmark          recall 131/132, hard negatives 85/85   unmoved
```

Nothing failed. The drift would have been completely silent - and `kh` is what
makes Arabic **خ** written `kh` fold with the same name written `ch`, the exact
class the `r122`–`r125` hard-`ch` recall pairs were added to protect.

The four tables now live in `data/phonetic-tables.json`, loaded by both engines,
fail-loud on a missing or malformed file. Same treatment the other two shared
files get.

`test/phonetic-tables.test.mjs` guards the part a schema check would miss:
**digraph order is load-bearing.** They are applied in sequence as plain
substring replacements, so any pattern that is a prefix of a later one would
consume it first and silently change every key - `sh` before `shch` makes `shch`
unreachable, and `ch` before `tch` is precisely what kept Tchaikovski and
Chaykovskiy apart until `r099` was closed. The guard rejects any such ordering
generally, spot-checks the two orderings whose violation has cost recall, and
then verifies behaviourally that every folding pair still keys alike and that
distinct names do not collapse.

Negative-controlled: deleting `kh` - the edit that previously broke nothing -
now fails the suite; swapping `tch` and `ch` fails both the ordering check and
the behavioural one.

#### One assertion I got wrong

The first version of the guard asserted `salah`/`saleh` must not share a
phonetic key. They do share `sal`, and the translit-groups file keeps them in
separate groups - but those are **different contracts**, and I conflated them.
The group firewall means "never swap one spelling for the other when generating
variants", so the equivalence is not spread across the corpus. It does not mean
the two must never score alike: `Mohammed Salah` against designated
`Mohammed Saleh` is one letter apart and scores **93 on fuzzy alone**, phonetic
layer or not. Surfacing that for MLRO review is correct behaviour. The
assertion was pinning the wrong contract and was replaced, with the reasoning
recorded in the test so it is not "fixed" back.

### The last recall miss was one missing transliteration pair - screen.py now clears the whole corpus (2026-07-30)

`r110` - `Hossam Din Farag` vs designated `Husam Deen Faraj` - was the only
recall pair **both** engines missed, and had stood as a residual since the
corpus was built. A designated party not flagged is the most serious error the
matcher can make, so it was worth chasing to the cause.

Two of the three tokens already folded:

```
canonical subject : hossam  deen  farag
canonical listed  : hossam  deen  faraj
```

`hossam/husam` and `deen/din` were both in `data/translit-groups.json`.
**`farag/faraj` was not** - and it blocked both paths at once: fuzzy scored 75,
and the phonetic keys split `FARK` vs `FARJ`.

That is Arabic **ج** (jim): Standard Arabic writes it `j`, Egyptian Arabic
writes it `g`. The file already carried `cemal / djamel / gamal / jamal`, so the
class was established - it was simply incomplete. Adding `farag/faraj`, and
`gaber` to the existing `jaber/jabir` group, closes it.

| | before | after |
|---|---|---|
| `screen.py` recall | 124/125 | **132/132 (100%)** |
| `screen.py` hard negatives | 85/85 | 85/85 |
| JS recall | 123/125 | **131/132** |
| JS hard negatives | 85/85 | 85/85 |

**Both engines now clear every hard negative, and `screen.py` links every recall
pair in the corpus.** The only remaining miss anywhere is `r120` (JS only,
allowlisted with its measured refutation).

#### Six groups measured, then not added

The first attempt added the whole Egyptian jim class - `nagi/naji`,
`ragab/rajab`, `hegazi/hejazi`, `khadiga/khadija`, `magdi/majdi`,
`nagib/najib` - on the reasoning that the class is real. Measuring the corpus
coverage refuted that: 78 of the existing 89 groups (88%) are exercised by the
benchmark, so six unexercised additions would more than double the unverified
portion of the file.

Adding a labelled pair for each then showed why they were unnecessary: **all six
pass with no transliteration group at all** - fuzzy similarity already links
them. Only `farag/faraj` and `gaber` are load-bearing, each verified by removing
it individually and watching its pair reopen.

The six pairs are kept as corpus **anchors** with mechanism `fuzzy` - which is
what actually catches them; labelling them `translit` would have been false -
so a future regression that breaks them is caught, without carrying five groups
that widen the false-positive surface for no measured gain.

### The case engine had no precision gate at all, and one missing Turkish token was costing recall (2026-07-30)

The two engines combined their score paths by **opposite** rules, and both were
documented as deliberate:

```
screen.py     decisive = min(full, core)     "a pair only scores high if BOTH the
                                              whole string AND its distinctive
                                              core agree"
sanctions-match.mjs  Math.max(lev, core, token)   "strictly recall-monotone: can
                                                   only rise, never lower an
                                                   existing score"
```

A `max()` cannot reject anything. So the case engine had no precision gate, and
two firms sharing everything except the token that **names** them scored on
their boilerplate:

```
Golden Gate General Trading  vs  Silver Gate General Trading   -> JS 85, flagged
                                                                  screen.py: clear
```

The JS matcher now applies screen.py's `min(full, core)` gate when both sides
have a distinctive core. A pure person-name has no boilerplate to strip, so the
gate stays out of the way there.

The gate is **not** recall-monotone - it can lower a score - so it was measured
rather than reasoned about. Its one apparent recall cost turned out not to be
the gate at all: **`as` (Turkish A.Ş., *anonim şirketi*) was in neither engine's
stopword list**, so `Anadolu Kiymetli Madenler Ticaret AS` and
`Anadolu Kiymetli Madenler Ticaret` compared as `anadolu as` vs `anadolu` and
fell below the gate. Adding it to the shared file fixed the cause - and closed
a pair `screen.py` had recorded as a **residual known miss**.

Both changes together, measured on both engines:

| | before | after |
|---|---|---|
| JS hard negatives | 84/85 | **85/85** |
| JS recall | 123/125 | 123/125 |
| `screen.py` hard negatives | 85/85 | 85/85 |
| `screen.py` recall | 123/125 | **124/125** |

Both engines now clear **every** hard negative, and the only remaining recall
misses are `r110` (both engines) and `r120` (JS only, allowlisted with its
measured refutation).

Pinned in `test/corporate-stopwords.test.mjs`: the boilerplate shape scores
below the gate, the Turkish variant of the same shape does too, a real typo
behind a corporate suffix **still** scores, and a pure person-name is untouched.
Negative-controlled: reverting to the bare `max()` returns the false positive
and fails 2 checks; removing `as` loses `r085` again and fails its own.

### The two engines' boilerplate lists had drifted, and it cost three false positives (2026-07-30)

Both engines strip corporate boilerplate before the decisive "core" similarity
check, so two unrelated firms sharing a legal form or sector phrase do not score
as a match. Each carried its own in-code table. They had drifted:

```
screen.py STOPWORD_TOKENS   79 tokens
sanctions-match.mjs CORP_STOP 58 tokens
in common                    42
```

The gap was not cosmetic. The JS matcher had no Turkish corporate vocabulary, so
`insaat sanayi ve ticaret sirketi` ("construction industry and trade company")
counted as **distinctive**:

```
subject  Anka  Insaat Sanayi Ve Ticaret Limited Sirketi
listed   Toros Insaat Sanayi Ve Ticaret Limited Sirketi
                JS: 89, high band, sanctions-match
```

`Anka` and `Toros` are different companies. `screen.py` cleared it - its core
tokens reduce to `ANKA` vs `TOROS` - but the case engine raised it. Three of the
85 hard negatives failed this way (`n009`, `n011`, and `n001` once the file is
trimmed), all of them the same shape: everything shared except the one token
that identifies the company. A false positive here costs MLRO review time and
can wrongly freeze a customer.

The list now lives in `data/corporate-stopwords.json`, loaded by both engines,
fail-loud on a missing or malformed file - the same treatment
`data/translit-groups.json` already gets, and whose own loader comment records
that *"the duplicated in-code tables had already drifted once."* Same lesson,
one table over.

The shared file is the **union** of both tables (96 tokens), so neither engine
loses a token it used to strip. Measured on both:

| | before | after |
|---|---|---|
| JS hard negatives | 82/85 | **84/85** |
| JS recall | 123/125 | 123/125 |
| `screen.py` hard negatives | 85/85 | 85/85 |
| `screen.py` recall | 123/125 | 123/125 |

`n010` (Golden Gate / Silver Gate) still fails in JS and is untouched here - it
is not a boilerplate problem, `gate` is genuinely distinctive; it is a
similarity-scoring difference and remains open.

Guarded by `test/corporate-stopwords.test.mjs`: schema, sortedness, continuity
(every token either engine stripped before must survive), the Turkish block
named explicitly so nobody trims it as noise, an assertion that distinctive
company tokens are **never** on the list, and a single-source check that fails
if either engine falls back to an in-code table. Negative-controlled: removing
the Turkish block returns the false positives and fails 3 checks; pointing JS
back at an in-code table fails 3 more.

### One of the two allowlisted recall gaps closed; the other refuted with evidence (2026-07-30)

Two transliteration pairs had sat allowlisted in the cross-engine parity test
because closing them "means tuning JS similarity, which trades against the hard
negatives". That was an assumption. It is now measured, and it was wrong in an
interesting way - the fix was never a threshold at all, but the shared phonetic
digraph table.

**r099 - closed, free.** `Tchaikovski` keyed `TAKVSKI` and `Chaykovskiy` keyed
`KAKVSKI`, because `tch` was not in the digraph table and only its `ch` tail
folded. Adding `tch` ahead of `ch` makes both key `KAKVSKI`. Measured on both
engines: **JS recall 118 → 119**, hard negatives unchanged, `screen.py`
unchanged, every hard-`ch` pair still intact. `tch` is never the hard-k reading,
so it can be folded without ambiguity.

**r120 - refuted, and the trap is now guarded.** The blocker is `achraf`→`AKRF`
vs `ashraf`→`ASRF`: `ch` is keyed as hard-k, but in French transliteration it is
/ʃ/. Folding `ch` to the sibilant closes r120 *and* r099 - **JS recall 118 → 120
with no hard-negative cost at all.** On the old corpus it looked free.

It is not. Direct probe:

```
                 baseline            ch -> sibilant
chalid/khalid    KALT   = KALT       SALT  ≠ KALT     BROKEN
chaled/khaled    KALT   = KALT       SALT  ≠ KALT     BROKEN
christos/khristos KIRSTS = KIRSTS    SIRSTS ≠ KIRSTS  BROKEN
zacharia/zakaria SAKRA  = SAKRA      SASRA ≠ SAKRA    BROKEN
michail/mikhail  MIKL   = MIKL       MISL  ≠ MIKL     BROKEN
```

Arabic خ and Greek χ are written `ch` by German and French sources and `kh` by
English ones. For this book that class matters considerably more than one French
sibilant spelling, so the trade is **refused**.

The corpus contained twelve pairs with `ch` in them and **not one** from the
hard-`ch` class, which is why the benchmark called the change free. Four recall
pairs were added - `r122` Chalid/Khalid, `r123` Zacharia/Zakaria, `r124`
Christos Michail/Khristos Mikhail, `r125` Chaled Bin Rachid/Khaled Bin Rasheed
(both readings in one name) - and with them the sibilant fold now **fails the
benchmark floor** instead of passing it.

r120 stays allowlisted, but its note is no longer speculation: it records the
measurement, names the class that breaks, and states what closing it would
actually require - multi-key phonetic profiles emitting both readings per token,
not a different single fold.

### The manual-review net fired on names it had just learned to screen, and went quiet on names it had not (2026-07-30)

`_lost_script_letters` decides whether a subject can be auto-screened at all. It
predicted the answer from the **input** - uppercase, NFD, "is every letter
A-Z?" - which was accurate only while the normaliser *deleted* the unfoldable
Latin letters `Ł Ø Đ Þ Æ Œ`.

Giving those letters a real fold (`Ł→L`, `Þ→TH`, `Æ→AE`) made the prediction
wrong in both directions at once.

**Over-firing.** A folded name keys to pure A-Z and screens correctly, but the
input test still called its letters lost:

```
"Łukasz Nowak"  ->  LUKASZ NOWAK   hits OFAC "LUKASZ NOWAK" at 100
                    ...and ALSO raised a MANUAL REVIEW card
```

Every Polish, Scandinavian, Balkan, Vietnamese and Icelandic name raised a
manual-review card **alongside its correct hit** - alert fatigue on exactly the
population the fold had just made screenable.

**Under-firing.** In `scripts/daily-screen-run.py` the caveat was an `elif`, so
any hit at all suppressed it. `screen.py` appends the manual-review finding and
*then* the fuzzy hits, so a subject carries both - the delta run kept only one.
A romanised name almost always has a hit:

```
"Сергей Иванов"  ->  SERGEY IVANOV  matches that spelling at 100
                     row read as a clean scored match; the fact that the
                     subject was never screened from its own script was lost
```

The predicate now asks the normaliser what it **actually produced**, with two
tests, because there are two distinct ways a name resists screening:

- the **output** still carries non-A-Z letters - the script was preserved
  (Arabic, CJK), so there is no Latin key to compare at all;
- the **input** carried non-Latin-script letters (Cyrillic, Greek). Those *are*
  romanised into a Latin key, but romanisation is one convention among several
  (Чайковский → Tchaikovski / Chaykovskiy / Tschaikowski), so a designation
  spelled another way can still be missed. **The net stays for them.**

A Latin letter that folds within Latin is neither, and is the *only* class that
stopped being flagged. The delta run now computes the flag independently of the
hits branch, a scored hit on a not-fully-screened name never routes straight to
`CONFIRMED`, and the report prints a `⚠ NOT FULLY SCREENED` line on the row.

Both engines were updated together and agree on **all 2,893** corpus strings
(the JS mirror had the same stale input-side test). Benchmark unmoved: recall
`119/121`, hard negatives `85/85`. Negative-controlled three ways - restoring
the input-side predicate fails 8 checks, restoring the `elif` fails its wiring
check, and reverting the JS mirror alone breaks cross-engine parity.

### Employee rows that lost their name vanished from screening without a trace (2026-07-30)

Employees are a screening population in their own right and run through the same
pipeline as customers. The customer loop records any Asana row missing a name or
a gid - such a row is a subject nobody screened, so it is logged, carried into
`CUSTOMER_ROWS_SKIPPED`, added back into the attestation's population total, and
named in the report so the MLRO can fix the source record.

The employee loop dropped the same row with a bare `continue`. No record, no log
line, no attestation - while the comment three lines above it read *"Same
pipeline, same matcher, **same guards**, same delta state"*. A staff member whose
Asana row lost its name simply disappeared: not screened, not counted, not
reported, and the population total silently excluded them.

Both populations now reach the recorder through **one** function,
`_record_skipped_row(task, population)`, and each skipped row carries which
population it came from so the attestation names it precisely. The attestation
lines are relabelled `Records in database (customers + employees)` /
`Records screened`, because employees were already inside that count while the
label said "Customers".

The test that should have caught this set `ASANA_EMPLOYEE_DB_GID = ""` to keep
the customer path isolated - so the untested path was the broken one. It now
drives **both** projects in a single call, and a structural check fails if any
future population is added with its own quiet `continue`. Negative-controlled:
restoring the bare `continue` fails 6 checks.

Two instances of *"a guard exists but one path doesn't call it"* in two days.

### The daily brief's 24h window silently skipped 8.37h of alerts in a month of clean runs (2026-07-30)

The Daily Compliance Brief reported on a fixed `now − 24h` window. That assumes
consecutive briefs are exactly 24h apart. They are not - GitHub delays cron by
hours and the delay varies run to run, so the interval between briefs drifts
either side of 24h.

Measured over the **last 30 briefs - every one a successful run, none missed**:

```
gaps between consecutive briefs   29
gaps longer than 24h              14   (max 25.93h)
alert activity in no brief at all  8.37h
```

Every hour by which two briefs were more than 24h apart was a window whose
alerts appeared in **no brief**, while the next brief still printed
`✅ ALL CLEAR - no new monitoring alerts in the last 24h`. Counted as covered,
actually uncovered, silent - the fourth instance of that pattern in this
codebase. A single missed run would have added a full day on top of the 8.37h.

The window is now **anchored to the previous brief's own creation time**, so
coverage is contiguous by construction: jitter and missed runs are absorbed by
the next brief instead of falling through it, and an alert on the boundary is
reported twice rather than not at all. The header states the real span
("last 26h (since the previous brief)") rather than a nominal 24h.

Two ways the anchor can be unavailable, both of which now **say so** instead of
presenting an assumed window as a measured one:

- **No previous brief found** - the genuine first run, or missing history. The
  brief notes that coverage before the window is unconfirmed.
- **Previous brief older than the 168h ceiling** - the brief leads with a
  `⚠ COVERAGE GAP` naming the uncovered span and directing the reader to Asana.

Pinned by 14 new checks, including the measured 30-run schedule replayed
end-to-end asserting no instant falls outside every window - plus a companion
check that the same schedule genuinely defeats a fixed 24h cutoff, so the test
corpus cannot quietly stop exercising the defect. Both directions
negative-controlled: reverting the anchoring fails 7 checks, suppressing the
coverage-gap notice fails its own.

`weekly-summary.mjs` was checked for the same defect and does **not** have it:
its window is calendar-day granular and its cron cannot slip past midnight, so
jitter is harmless, and a missed week shows as a visible date jump between two
cards rather than a hidden sub-day hole between consecutive dates.

### Cross-engine parity is now swept over 206 pairs, not spot-checked over 15 (2026-07-30)

The parity test checked **15 curated pairs** and counted a MANUAL REVIEW
routing as "reached by the JS engine". Both loosenesses were deliberate, but
together they let a real recall gap hide: the case engine could **CLEAR a
subject the daily screen flags**, and nothing failed.

Sweeping every pair the screening benchmark already maintains - 121 recall +
85 hard negatives - with a strict criterion (a genuine list hit, not a
manual-review referral) found **two live divergences**:

```
r099  "Tchaikovski Andrei" vs "Chaykovskiy Andrey"   screen.py 88.9  JS 83
r120  "Achraf Ganouchi"    vs "Ashraf Ghannouchi"    screen.py 87.5  JS 82
```

Both are transliteration variants, and both are **scoring** differences rather
than wiring gaps - the JS phonetic mode makes no difference to either. Closing
them means tuning JS similarity, which trades directly against the 85 hard
negatives, so they are **recorded rather than silently fixed**: each is
allowlisted individually with its measured scores and the reason.

The allowlist is self-policing. A second check fails if an allowlisted
divergence starts passing, so it must shrink and cannot rot into a blanket
exemption. Both directions are negative-controlled.

A third entry, `n030`, is a hard negative where `screen.py` hits at 88 - a known
budgeted false positive already recorded in the benchmark. JS declining to
follow makes JS *more* correct there, so that divergence is in the safe
direction and is documented as such.

Method note: the first version of this sweep reported 19 Python misses, which
contradicted the benchmark's 119/121 recall. The harness was wrong - it applied
a `score >= 85` filter on top of `screen_name`, which already applies its own
gates, so legitimate hits were being discarded. Corrected before any of it was
reported as a finding.


### The two matchers now key every name identically - enforced by test (2026-07-30)

Three cross-engine divergences have reached production over this project's life
(Turkish `ı`, German `ß`, Cyrillic), each found by diffing the engines rather
than by reasoning. That diff is now a **property test**, so the fourth cannot.
Running it took the count from **19 divergences to 0**, and finding the last few
required fixing real defects rather than adjusting the test:

- **Mixed-script names silently lost their non-Latin half.** The Latin pipeline
  ran first and won outright, so any name producing *some* Latin output had the
  rest discarded. Live in the curated TFS list: the EOCN alias
  `إتلاف 14 فبراير (البحرين)` keyed as **`14`** - the digits alone satisfied the
  Latin pipeline, so the script-preservation fallback never fired. A designated
  alias keyed as `14` matches nothing it should and is a collision waiting to
  happen. `محمد صالح TRADING LLC` keyed as `TRADING LLC` - pure corporate
  boilerplate with no identifying signal. The pipeline is now unified: romanize
  and fold first, then keep the letters/digits of whatever script survives,
  exactly as the JS engine does.

- **NFD → NFKD.** JS used NFKD, Python NFD, so fullwidth forms (common in
  CJK-region corporate records), digraph ligatures and Roman numerals keyed
  differently. Measured before switching: **0 keys move** across 1,631 corpus
  names - ordinary names contain no compatibility characters.

- **A lowercase key could leak out.** NFKD expands modifier and superscript
  letters into *lowercase* ASCII (`ª`→`a`, `ʲ`→`j`), and the uppercase step ran
  only at the front - so those names keyed with a stray lowercase letter that
  could never meet an uppercase key, and `normalize()` stopped being idempotent.
  Found by the idempotence property, not by reasoning: **170 characters** were
  affected.

- **Accented Cyrillic left Cyrillic in a Latin key.** `Ѐ Ѓ Ќ Ѝ` are precomposed
  and absent from the romanization table, so the first pass missed them and NFKD
  then reduced them to *base Cyrillic*, which the preservation branch kept
  verbatim. The table is applied a second time after the mark-strip (a no-op on
  Latin). That closed the last 39 idempotence failures.

- **Re-composition side effect.** That second pass initially called `romanize()`,
  which re-applies NFC - re-composing Hangul that NFKD had just decomposed, so
  Korean names keyed differently across engines. The pure per-character mapping
  is now separate from the NFC-applying wrapper. Caught by the cross-engine
  property within seconds of adding it.

The additive-only property is **replaced, not deleted**: two of these changes
move keys on purpose, so claiming additivity would be false. What is asserted
instead - and still covers the overwhelming majority of the book - is that a
name written in plain ASCII Latin keys exactly as it always did.

Benchmark unmoved: recall 119/121, hard negatives 85/85.


### Stroke letters were being deleted from names, not folded (2026-07-30)

Found by running the two matchers over the same 1,645-name corpus and diffing
their keys - the method the repo's own comments credit for the Turkish `ı` and
German `ß` fixes ("found by comparing the two engines rather than by
reasoning"). It surfaced **19 divergences**.

**Ł Ø Đ Þ Æ Œ have no NFD decomposition**, so `[^A-Z0-9 ]` deleted them outright:

```
"Łukasz Nowak"   ->  UKASZ NOWAK
"Đorđević"       ->  OR EVIC
"ØSTERGAARD A/S" ->  STERGAARD A S
"Æthelred"       ->  THELRED
```

A customer record almost always carries the plain ASCII spelling - "Lukasz
Nowak" → `LUKASZ NOWAK` - so the designation and the customer keyed differently
and **could never match**. Exactly the class already fixed twice, for the letters
those fixes missed. Both engines now fold them to ASCII.

**This DOES move existing keys**, deliberately, because the old ones were lossy.
Names containing these letters get a new delta-state fingerprint and will
re-alert once. The additive-only property is therefore rescoped to what remains
exactly true: the non-Latin *fallback* (romanization, then script preservation)
never moves a key the Latin pipeline already produced.

### Cyrillic й / ё keyed differently in the two engines (regression, same day)

Introduced with the Cyrillic romanization earlier today. `й` and `ё` are
**precomposed** (и+breve, е+diaeresis), and the JS engine ran `NFKD` +
mark-strip *before* its Cyrillic table - so they arrived as `и`/`е` and produced
`sergei`/`elka`, while `screen.py` romanized the composed form to `sergey`/
`yelka`, the spellings OFAC and the EU publish. Two of the commonest Russian
characters, keyed differently across engines.

It was missed because the seven names verified at the time contained neither
letter. The JS engine now maps them before `NFKD`, and cross-engine agreement is
pinned per-character rather than by spot-checking names.

Divergences down from 19 to 9; the remainder are compatibility-form differences
(`²`, `½`, Roman numerals, fullwidth) and mixed-script names, tracked separately.


### Arabic and CJK designations are now matchable; alert streams reach the MLRO queue (2026-07-30)

**Arabic/CJK - script preservation, not transliteration.** The JS case engine
already matched an Arabic subject against an Arabic-published designation at
100, while `screen.py` stripped the name to `""` and returned **no hits for the
same pair**. Since `screen.py` runs the *daily* screening, an Arabic-script
designation on the UN list was unmatchable in production and matchable only in
the case engine.

`normalize()` now falls back Latin → Cyrillic romanization → **script
preservation**. Preserving is strictly better than transliterating here:
romanizing `محمد` yields the consonant skeleton `MHMD`, which does not resemble
the Latin "MOHAMMED" it would need to match - it would buy no recall while
inventing false-positive surface. Same-script matching needs no guess at all.
Preserved-script subjects are still routed to MANUAL REVIEW *as well as*
screened.

The additive-only invariant still holds and is still enforced by property test:
across 1,302 benchmark and parity strings, **0 existing keys moved, 29
previously-dead keys rescued** (up from 9).

`normalize()`'s contract changed as a result - it is no longer closed over
`[A-Z0-9 ]`. The property now asserts what holds for every branch: letters,
digits and single spaces only; no combining marks; no punctuation; trimmed.

**Scheduling delay - measured, and NOT fixed by re-timing.** An earlier note
here proposed moving the first cron out of the midnight hour. The data refutes
it: Regulatory Watch's **06:19** slot is delayed **2h05m–3h51m**, statistically
the same as the 00:07 slot's ~3.2–3.9h. The delay is systemic to this repo's
Actions scheduling, not midnight congestion. Moving the slot earlier is also
*unsafe* - `freshness-check` pins this control at `maxAgeDays: 0`, so a run
landing on the previous UTC day would raise a false "control missed its cadence"
alarm. The cron is unchanged; the false claim that the sweep "lands in Asana
before ~09:00 UAE" is removed from both the file header and the schedule block
and replaced with the measured reality (~12:00 UAE).

**Alert streams mirrored.** `sanctions-watch` (list changes) and
`sanctions-screen` (the case engine, which posted 40-new-match days) now mirror
into "Sanctions/Media/PEP - Monitoring" → "Daily Sanctions Screening", joining
the law-change card. Additive - the #305 destination is untouched.

### Test harness - a failing property crashed the runner instead of reporting it

`check()` did `str(e).splitlines()[0]`. A bare `assert` carries an **empty**
message, so `splitlines()` returned `[]` and indexing it raised `IndexError` -
the whole property runner died and a real failure looked like a broken harness.
It now falls back to the exception type name.


### Cyrillic designations are now screened, not silently dead (2026-07-30)

A sanctions designation published only in Cyrillic normalized to `""` in
`screen.py`, was indexed under an empty key, and could therefore **never match
any customer** - while still counting toward the "screened against N list names"
attestation. Russia-related designations dominate current OFAC/EU/UK actions, so
this was a live recall hole on the busiest listing stream.

`romanize()` renders Cyrillic to Latin (BGN/PCGN-style, the spelling the
sanctions bodies publish), and `normalize()` uses it **only as a fallback when
the Latin pipeline returns `""`**.

That placement is the whole safety argument, and it is now a property test:
every name that already had a non-empty key keeps **exactly** that key, byte for
byte, so no existing match, score, delta fingerprint or dedup key can move. The
only reachable change is that entries which previously matched nothing can now
match. Verified across **1,296 real benchmark and parity strings: 0 keys moved,
9 previously-dead keys rescued.**

Scripts without a deterministic romanization - Arabic (which omits short vowels)
and CJK - are deliberately **not** guessed at. A wrong transliteration would be
a false CLEAR, which is worse than the honest MANUAL REVIEW they already get.

**Cross-engine parity.** The JS engine kept Cyrillic verbatim (`ХАМАС` →
`хамас`), so it matched a Cyrillic list entry but never the Latin designation.
Once `screen.py` romanized, Python would hit where JS did not - a directional
parity break. The same table now folds in `scripts/sanctions-match.mjs`, and
both engines produce identical keys.

Worth recording how that was pinned: the parity corpus **cannot** hold this,
because a MANUAL REVIEW routing already counts as "reached by the JS engine", so
parity passes with or without romanization. What actually changed is the outcome
quality, and that is what the JS tests assert:

```
without romanization:  MANUAL REVIEW   score 0    band medium    -> a human task
with    romanization:  KHAMAS          score 100  band critical  -> sanctions-match
```

The pre-existing guard "normalizeName keeps Cyrillic letters" was rewritten to
its *intent* - non-empty key, no silent clear, and now matching the Latin
rendering - rather than the superseded mechanism.

Benchmark unmoved: recall 119/121 (98.3%), hard negatives 85/85 (100%).


### Sanctions designations that can never match are now counted, not assumed away (2026-07-30)

The core sanctions index is built as `[(normalize(n), n) for n in names]`. A
designation published **only in non-Latin script** normalizes to `""` and is
indexed under an empty key, so `screen_name` can never return it:

```
normalize('ХАМАС') -> ''
screen_name('ХАМАС', {...}) -> []
```

It causes no false positive - an empty key matches nothing - but it **is**
counted in that list's `count`, which is the "screened against N list names"
coverage attestation. So the run could attest more screening reach than it
actually had, and nothing said so.

This is the third instance of one shape: **counted as covered, actually
unscreenable, silent** - after the adverse watchlist (#354) and the EOCN
cross-check (#359). `count_unmatchable_entries()` now records the figure per
list in `list_meta[...]["unmatchable"]` and logs an explicit
`UNMATCHABLE LIST ENTRIES` line when non-zero. A fully matchable list records
`0` and logs nothing.

Called from **both** list-building paths - the unified loader and the legacy
`main()` - and a test asserts both call sites exist, because a guard only one
path calls has been the recurring defect in this engine.

No live instance is currently demonstrated: the curated in-repo lists carry zero
such entries, and the core lists are fetched at runtime and could not be
inspected offline. The point is that the number is now auditable rather than
assumed.

### Model validation - matcher recall row signed (2026-07-30)

The 2026 Q3 matcher-recall row in `docs/governance/model-validation-2026.md` §5
is signed **HS MLRO**, recorded on the MLRO's explicit instruction. No pending
sign-off rows remain.


### "Not compared" was being reported as "covered" on a TFS freeze list (2026-07-30)

The weekly EOCN reconciliation cross-checks the curated UAE Local Terrorist List
against the OpenSanctions `ae_local_terrorists` mirror, and writes the result
into `lastReviewedEvidence` - the sentence an MLRO signs when merging the review.

`crosscheck_eocn` matches on `normalize()`, which strips a wholly non-Latin name
to `""`. Its `if ks` guard then **skips** such a name entirely, so it can never
be reported as missing. Whenever the comparable names all matched, the reconciler
wrote:

> "No divergence - the local list already covers every mirror designation."

That sentence was not established. An unknown number of designations had never
been compared at all. Reproduced: two Arabic-script designations genuinely absent
from the local list produced `crosscheck_eocn(...) == []`. On the UAE Local
Terrorist List this is a **freeze duty**, so "not compared" must never read as
"covered".

`eocn_uncomparable()` now surfaces exactly those names. They are reported
*separately*, not folded into `missing` and not auto-appended: the Latin-only
matcher could not screen them either, so appending would grow the file with
entries that can never match - they need a human transliteration against the
official EOCN publication. The daily run records them in
`list_meta["eocn"]["crosscheck_uncomparable"]` and logs an explicit
`EOCN CROSS-CHECK GAP` line, and the reconciler's evidence note now says
"No divergence among the COMPARABLE designations" plus a named NOT COMPARED
list, instead of claiming full coverage.


### Law-change cards were filed correctly and still never seen (2026-07-29)

PR #305 ("Route every pipeline Asana delivery to HAWKEYE STERLING APP", merged
22 Jul 2026) redirected every pipeline card to the app project. The Regulatory
Watch card - the law-change feed - is worked from a different project, so from
that day it was being created successfully and read as *nothing arrived* to the
person watching for it. Eight days of law-change deltas, including OFAC Recent
Actions and an LBMA Responsible Sourcing change, landed where nobody was looking.

Two things made it invisible rather than obvious:

- the workflow step was named **"Notify Asana - Ongoing Monitoring project"**
  while pointing at the app project; and
- the comment above the GIDs described `1216203370612916` as *"the Regulatory
  changes section of the Ongoing Monitoring project"*. Verified against the live
  API, `1216203370612914` is **HAWKEYE STERLING APP** and `1216203370612916` is
  its **Assessment Report** section - neither is what the comment claimed. A
  reviewer auditing the delivery path would have read the comment and moved on.

The card is now **mirrored**: one task with two project memberships (the same
multi-homing the daily screening already uses for its dual MLRO queue). The #305
destination is untouched - this is additive - and the card also appears in
"Sanctions/Media/PEP - Monitoring" → "Regulatory changes", where it is actually
worked. One task, so there is no duplicate to reconcile. The step name and the
GID comments now state the verified project and section names.

Note for the record: the daily sanctions/adverse/PEP screening was never
affected. It delivers via its own dual-queue path to "Sanctions/Media/PEP -
Monitoring" and has posted every day throughout.


### "This subject was never screened" must not lose its place to ten candidates (2026-07-29)

A subject whose name the matcher cannot handle (non-Latin script, or under four
matchable characters) gets a **MANUAL REVIEW** marker in the daily report - the
statement that it was never auto-screened at all, and must be screened by hand.

That marker scores `0` by construction, and the report shows
`sorted(hits, -score)[:10]`. So the moment a customer had ten other candidates,
the marker sorted last and was **dropped** - replaced by "… +N more similar
candidates", which reads as more of the same rather than "this subject was not
screened". It carries no `is_new`, so `open_mlro_cases` raises no case for it
either: the report line was its only surface. #351 dealt with a real subject
carrying 73 candidate designations, so ten is not a hypothetical threshold.

The marker is now pinned outside the top-ten cut - it is a coverage statement,
not a candidate competing on score - and the overflow counter counts candidates
only, so the number no longer includes the pinned line.

Found in the residual note of an adjudication verdict that had otherwise cleared
the lead; the two lenses had split on it.

### Ongoing Monitoring - a CLEAR card could suppress the same day's HIT card (2026-07-29)

The Adverse Media / PEP card is deduplicated per day so a re-run does not post
twice. The check matched on the date plus the words "Adverse Media" or "PEP" -
but **both** card names carry "Adverse Media", so CLEAR and HIT were treated as
interchangeable and whichever landed first suppressed the other.

A run earlier in the day that found nothing - or found nothing *because its feed
was degraded* - therefore suppressed a later run's HIT card, and Ongoing
Monitoring was left showing **CLEAR for a day on which hits were found**. The
path there is the one that matters most: a manual dispatch or a re-run, which is
exactly what you do after noticing the scheduled run was degraded.

The dedup is now direction-aware: a HIT card supersedes today's CLEAR card,
nothing supersedes a HIT, and a CLEAR run never overwrites a day already
reported as a hit. The boundary guard against `9 Jul` matching `19 Jul` is
retained. The predicate is exported as `omCardToSkip` so the invariant is tested
directly rather than asserted by replication.

### Coverage attestation - a customer row we cannot screen is a gap, not a non-event (2026-07-29)

`get_all_customers` dropped any Asana customer row missing a name or a gid with
a bare `continue`. Nothing recorded it - and `customers_total`, printed under
**SCOPE & COVERAGE ATTESTATION** as "Customers in database", is `len(customers)`,
i.e. the count *after* the exclusion. So a record that was never screened by any
net simply vanished from the denominator, and the attestation claimed complete
coverage of a book that had quietly lost it.

Skipped rows are now recorded with their permalink and the reason, logged as
they occur, and attested: "Customers in database" is the true total, with the
screened count and the un-screenable count reported separately and the affected
records named so the MLRO can fix them. A clean book states so affirmatively
rather than printing an ambiguous zero. The run still never crashes on one bad
row.

### MLRO cases - the disposition block was being cut off the end of long cases (2026-07-29)

`create_case_subtask` sent `notes[:8000]`, a head slice. The **end** of a case
note is the part that has to survive: the disposition checkboxes (the MLRO's
actual decision record), the "Do not tip off - UAE Cabinet Resolution 74/2020
applies" warning, and for HIGH-risk cases the entire STR/SAR draft. Any case
with a long hit list therefore reached the queue with evidence but **nothing to
tick and no legal warning**, and no log line said so. Measured on a 60-hit
HIGH-risk case: 10,944 characters built, 8,000 delivered, all three blocks gone.

8,000 characters was also **8x stricter than the budget the same Asana notes
field accepts** on the report path (65,000 worst-case rich-text bytes), so cases
were being cut that the API would have taken whole.

Case notes now go through `cap_notes` - which truncates the body and keeps the
tail - at the report path's budget, with a protected tail large enough that the
disposition block survives even above a long STR draft, and a visible truncation
marker instead of a silent cut. A refused create is re-queued to the backlog and
retried on later runs, so a payload Asana rejects at full budget would re-fail
forever; a size refusal (400/413) is now re-bid once at a smaller budget, while
auth, rate-limit and network failures are not (they fail identically at any size).

### Screening state - a flaky fetch could erase the delivered-finding history (2026-07-29)

Both state writers - the daily sweep and the onboarding run - restored the
delta-state branch with `if git fetch origin screen-delta-state; then overlay;
else cold start; fi`. `git fetch` exits **128 for a missing branch and 128 for
an unreachable origin**, so the two are indistinguishable and a transient
network flake was read as a first run. The run then diffed against `main`'s
frozen copy and re-reported findings already delivered - and, because the
commit step **force-pushes** the branch as `<main>` + one data commit, it
overwrote the accumulated delta-state permanently. Both writers share that
branch, so either one could destroy the other's history.

`git ls-remote --exit-code` is the discriminator (`2` = ref genuinely absent,
anything else = transport error). A cold start still proceeds; an unreachable
origin now stops the run with an explicit error rather than silently screening
with amnesia. The force-pushing commit step is additionally gated on the
overlay having established a baseline, so a failed overlay cannot persist state
built on one it never read.

`anomaly-watch` - a state *reader* - already carried this guard; the two
*writers* did not. Verified against the real `bash -e` GitHub uses, across four
scenarios (branch present, branch absent, origin unreachable, fetch failing
after a successful probe). `test/screening-state.test.mjs` now pins the
discrimination for all three consumers, form-agnostically, along with the
`set -e` capture idiom the guard depends on.

### Adverse media - the watchlist cannot "cover" a subject it cannot match (2026-07-29)

`am_blackout` - the figure that turns the adverse module DEGRADED - counted a
subject as having zero coverage only when the **whole watchlist failed to
load**. But the watchlist is screened with the same matcher as sanctions, and
that matcher returns nothing for a name it cannot handle (recorded in non-Latin
script, or collapsing under 4 matchable characters). Such a subject gets nothing
from the watchlist **even when the list loaded perfectly** - while the report
told the MLRO, in exactly the run where the news sweep had failed, that "the
adverse-exposure WATCHLIST still screened every subject".

So a subject that was both news-dead *and* unscreenable had **no adverse
coverage from any net**, and was reported as covered. The sanctions path already
surfaces these names for manual review; the adverse path had no equivalent.

`screen_watchlist` now records the names it could not screen, `tally_enrichment`
counts those as blackouts when their news sweep also failed, and the report line
no longer claims universal coverage - it says the watchlist screened every
subject **it can match**, and points at the DEGRADED figure for the rest.


### Matcher - the prefilter could silently cancel a MORE sensitive setting (2026-07-29)

The C-side blocking prefilter builds its cutoffs from `THRESHOLD` and
`TOKENSET_THRESHOLD`. A comment justified omitting `SHORT_ENTRY_THRESHOLD` by
asserting it "must be >= THRESHOLD, so the same cutoff covers it" - an ordering
**asserted in prose and enforced nowhere**. The threshold resolver accepts
anything in [70, 100] and only rejects a RAISE; *lowering* is documented as
plain config ("the challenger runs more sensitive only"). So activating the
documented short-name challenger, `MATCH_SHORT_ENTRY_THRESHOLD=80`, was accepted
silently and then **made the engine miss designations**: measured with real
rapidfuzz at the production default `MATCH_BLOCKING=1`, customer "HAMAZ" against
designated "HAMAS" returned **no hit blocked / one hit unblocked**. Turning the
sensitivity up produced a false negative.

The `core` disjunct of that gate is not bounded by either cutoff at all (core
can be 100 while the whole-string score is 33 - precisely the shape the gate
exists for), so rather than guess a bound the engine now **declines the
prefilter** when the configured threshold falls below what the cutoffs can
bound, and says so in the log. `None` is the established "prefilter
unavailable" contract: identical results at the original cost. At the default
threshold blocking stays fully active, so there is no routine performance cost.

Two tests pin it, and the first draft of the randomized one was **vacuous** -
it passed with the guard removed, because the generator's token pool held only
exact spellings of the short designations and the gap opens only for a
NEAR-miss. Near-miss tokens were added, plus a deterministic check asserting the
exact pairs measured diverging. Both now fail against the reverted guard.


### Case engine - a truncated alias file read as full coverage (2026-07-29)

Alias sources (OFAC's `alt.csv`, folded into the SDN list via `mergeInto`) were
deliberately exempted from coverage floors, on the reasoning - written into
`_README_minNames` when the floors landed hours earlier - that "the fold's
partial machinery covers them". **It does not.** That machinery fires only when
the alias file is TOTALLY ABSENT. A truncated-but-nonzero `alt.csv` (a partial
body, or an OFAC column shift that makes the parser return whatever it can)
took the healthy path: no floor to fail, counted as fetched, so the run was not
even DEGRADED.

Then the fold made it invisible. `foldAliasSources` merges the alias names into
the primary and **splices the alias row out**, never reading its `partial` flag
- so even an alias list explicitly marked partial came out clean. Because alias
hits are recorded under the **primary list's name**, an alias-derived standing
match is indistinguishable from a primary one: the primary counted as fully
re-verified, entered `screenedLists`, and `diffState` cleared the match and
auto-completed its MLRO case.

Both halves fixed: the alias source now carries its own `minNames` floor
(provisional, sized to catch truncation rather than police churn), and the fold
**propagates** reduced alias coverage onto the primary with a note, so the
primary is excluded from `screenedLists` and its standing matches are carried
forward rather than cleared. A complete alias fold still leaves the primary
fully re-verified, so a healthy run does not degrade.

### Screening - identity exclusion now reaches the CASE QUEUE (2026-07-29)

The identity-based demotion shipped hours earlier removed a candidate from the
report's primary queue but **not from case creation**: `open_mlro_cases`
filtered on `is_new` alone. Cases are capped per run, so a candidate we can
already prove is a different person could consume that cap and push a genuine
case into the backlog - and the MLRO's working time lives in the case queue, not
in the report text. Demotion that stops at the report is cosmetic. Excluded
candidates now raise no case; they remain in the report under their heading with
the reason, and in the record.

### Matcher / PEP - two more silent false negatives (2026-07-29)

Both surfaced by adjudicating audit leads that had never actually been
adjudicated, and both reproduced against the live engines before any change.

- **German sharp-s was not folded by the JS engine.** `ß` has no NFKD
  decomposition and lower-casing leaves it alone, so `Weiß` and its universal
  ASCII spelling `Weiss` normalized to different strings. `screen.py` folds it
  (its uppercase-first path maps ß→SS), so **designated "Weiß Trading" scored
  100 in Python and 0 - a clean CLEAR - in the JS engine**, and
  `lostScriptLetters` returns false for ß so it was not even routed to MANUAL
  REVIEW. Longer names could survive on fuzzy similarity; short ones cleared
  outright. This is precisely the class the cross-engine parity test exists to
  catch (Turkish ı, two-letter tokens) - the corpus simply had no ß name, so the
  pair is now pinned there. Fold is strictly widening.
- **A PEP name whose every token is under 3 characters could never hit.** The
  label test compares only tokens of 3+ characters, so for such a name the
  token list was empty, `if want and …` short-circuited, and `check_pep`
  returned - and **cached** - a confident `{"hit": false}`. That silently
  cleared real people: **"Wu Yi" is a former Vice-Premier of China**, and the
  whole shape of East Asian names romanized as two short syllables screened
  clean. They now route to manual PEP/RCA review, like the existing non-Latin
  path. The check runs BEFORE the lookup, so it also stops spending a Wikidata
  call and a shared rate-gate slot on a name the matcher cannot compare. The
  worldwide PEP/RCA net still screens these names by exact match, so this is
  their second net, not their only one.


### Case engine - "not re-checked" must never read as "checked and clear" (2026-07-29)

Three routes to the same false negative in `scripts/sanctions-screen.mjs`, all
ending the same way: the standing match **deleted from state** and its open MLRO
case auto-completed with the comment *"not flagged by the … screening run"* - a
statement that is false, written into a record kept for ten years, and a
completed case never re-opens. All three were reproduced against the live engine
before anything changed.

- **A MIXED standing match was wiped when only its sanctions half was
  re-verified.** The guard required `prior.lists.every(ENRICHMENT)`, so a prior
  of `['OFAC SDN', 'PEP (Wikidata)']` fell straight through it: on a run where
  OFAC genuinely de-listed the subject and the PEP lookup errored or was
  budget-skipped (routine on a large book), the never-re-verified PEP evidence
  was deleted. Now **any** enrichment evidence on the prior blocks the clear.
- **Switching an enrichment module off mass-cleared its standing matches.**
  `enrichmentIncomplete` is only set when a module is configured ON and then
  errors or runs out of budget; a module that is simply OFF performs no lookup
  and sets no flag, making the row indistinguishable from a verified clear. So
  `SCREEN_PEP=0` - the documented knob, most likely to be reached for **during**
  a Wikidata outage, exactly when standing matches most need preserving -
  cleared every PEP-derived match in the book in one run. `diffState` now takes
  an **`evaluatedSignals`** set (the enrichment counterpart of `screenedLists`)
  and carries forward any prior whose signal did not actually run.
- **A subject that left the screened population kept a stale `lastSeen`.** The
  loop only ever iterates this run's `results`, so a subject whose task was
  completed, renamed, deleted - or whose project GID was narrowed - was never
  seen, never cleared, and never marked. The case planner read the stale date as
  "no longer flagged" and auto-completed on it. Such subjects are now **held**:
  `lastSeen` is bumped so the case stays open, `notScreenedOn` records why, and
  they are returned to the caller and logged so the population change is visible.
  A subject that genuinely left the book still needs a human to dispose of its
  case.

Guarded against over-correction: a genuine de-listing, fully re-screened with
every signal evaluated, still clears - pinned by a control test - and callers
that pass no `evaluatedSignals` keep the previous behaviour.


### Screening - false positives: identity-based demotion, never suppression (2026-07-29)

The volume problem is real and measured: in the 29 Jul run a single subject
carried **73 candidate designations**, and another 58 - nearly all of them
different people who happen to share a common Arabic given name. That is alert
fatigue, and alert fatigue is how a real hit gets missed.

The engine now performs the same check the MLRO already does by eye. The report
already prints the designation's DOB and nationality directly beneath the
customer's; where **both axes are known on both sides and both disagree**, the
candidate cannot be that customer, so it leaves the primary queue.

It **demotes, it does not suppress**. The hit is still made, still stored in the
delta state, still in the MLRO case trail and the 10-year record, and still
printed in the report - under an `EXCLUDED ON IDENTITY` heading, each with the
reason it was excluded ("customer born 1980, Pakistan · designation born 1955,
Afghanistan - 25-year gap AND a different nationality") so an examiner can check
the engine's reasoning instead of taking it on trust, and the MLRO can overrule
it. **Recall is therefore mathematically untouched** - proven: the accuracy
benchmark is bit-identical either way (recall 119/121, hard negatives 85/85).

Deliberately fail-closed at every step: a missing customer DOB, a missing
customer nationality, a designation that publishes no DOB, an unparseable date,
a matching nationality, or a birth-year gap within tolerance - **any** of these
keep the candidate in the primary queue. Year comparison is used rather than
full dates because the three sources write dates three different ways
("27 Nov 1978", "1979-03-03", "September 06, 1980") and some publish a year
alone. Kill-switch `IDENTITY_EXCLUSION=0`; tolerance `IDENTITY_DOB_TOLERANCE_YEARS`
(default 2, because designation records routinely carry approximate or
multi-year birth dates).

Not done, and deliberately: tightening the phonetic `subset` shape that admits
these candidates in the first place. It would cut volume at the cost of recall
on a live sanctions control, and the benchmark holds exactly one phonetic-subset
pair, so the corpus cannot prove that trade safe.


### Screening - worldwide PEP + associates (RCA), and worldwide adverse media (2026-07-29)

**PEPs and their relatives / close associates, worldwide.** The consolidated
OpenSanctions PEP dataset - politically exposed persons **and their relatives
and close associates** - was already downloaded, already allowlisted, and
already parsed … but only as a *fallback*, used when a Wikidata lookup errored.
Wikidata is an encyclopaedia, not a PEP register: a domestic PEP or an RCA with
no English article returned a confident `{"hit": false}`, which is a silent
false negative on an **FATF R.12** duty (R.12 extends the PEP controls to family
members and close associates). The dataset is now the **standing worldwide net,
screened over every individual on every run**, with Wikidata kept as the richer
explanation layer on top. Three populations are covered, in precedence order:
lookups that **errored** (resolved by the net, as before), lookups that returned
**no hit** (the net now gets its own say - this is the coverage gain), and
lookups that **hit** (left untouched, Wikidata's description is better evidence).
The PEP-vs-RCA role is taken from the dataset's own `topics` column
(`role.pep` / `role.rca`) rather than asserted, and a row that states no role is
labelled "role not stated by the source" - the label never claims more than the
data.

**Adverse media across every market, without raising request volume.** 74
Google-News market editions are configured but only the first 8 were ever swept
- and the *same* 8 every day, so ~66 markets (all of Latin America, most of
Europe, East Asia, most of the Arabic press) were **never swept at all**, behind
a report line that read "worldwide". The per-run budget cannot simply be raised:
8 is the empirical per-IP ceiling for Google News from a GitHub runner (at 14
locales the limiter tripped on 10–12 Jul and cost real recall). So coverage now
comes from **deterministic rotation** instead of more requests: the 5 pinned core
editions (which the targeted risk passes index into) run every day, and the rest
of the matrix rotates on a day-of-cycle window - **every market is swept within
23 runs, at identical request volume**. Rotation is deterministic in the run
date, so re-running a day reproduces its evidence. The report now discloses
which markets ran and when the cycle completes; GDELT's global index still runs
on every subject every run, so worldwide reach is not gated on the rotation.
`ADVERSE_LOCALE_ROTATION=0` restores the old fixed first-N behaviour.

### Matcher - two sanctions false negatives and a nondeterminism defect (2026-07-29)

Found by an adversarial audit of the screening stack; all three reproduced
against the live matchers before any code changed.

- **A designation embedded in a customer name could screen CLEAR.** The
  near-exact gate for short (<6 char) entries tested only the decisive
  `min(full, core)` score, which legal-form boilerplate drags down:
  **"Hamas General Trading LLC" vs designated "HAMAS"** scores full=33 /
  core=100 → min=33, so it cleared - while the JS engine scored the same pair
  100/critical. Same for ISIL, ANO and any short designation plus boilerplate.
- **The same shape for LONG entries whose distinctive core is one token.**
  "Al Qaeda General Trading" vs "AL QAEDA": full=50 fails the min() gate, and
  the token-SUBSET gate cannot fire because `_is_token_subset` requires ≥2 core
  tokens (its own false-positive guard) and AL is a particle, so the core is
  just "QAEDA". Both branches now also test the **distinctive core** for a
  near-exact match. This does not weaken `min()`, which exists for the
  OPPOSITE shape (full high / core low - two firms sharing only boilerplate).
  The gate is tight: it fires only when the customer's *entire* distinctive
  core is the designation, so "Hummus Trading LLC" still clears.
- **Screening was nondeterministic.** The per-variant winner was "first variant
  scoring strictly higher", iterated over a Python **set**. String hashes are
  randomised per process, so on a score TIE between transliteration variants
  the recorded core - and therefore whether the pair passed the core gates -
  depended on the hash seed. Measured: the Al Qaeda pair screened HIT under
  `PYTHONHASHSEED` 0,1,2,4,5,6,8 and **CLEAR under 3,7,9** - same customer,
  same list, different day. Variants are now iterated **sorted**, with ties
  broken on core then full, keeping the best-evidenced variant.

Measured effect, both Python backends: **recall 118/121 → 119/121 (97.5% →
98.3%)** - the recovered case is r081, a Turkish corporate whose `A.S.` /
`ANONIM SIRKETI` boilerplate is exactly this shape - with the **hard-negative
clear rate unchanged at 85/85 (100%)**: no false-positive cost. `fn_count_max`
ratcheted 3 → 2 on both Python backends so the recovered case cannot silently
regress. Cross-engine parity holds (12/12) and the blocking-equivalence
property is green under real rapidfuzz. A core-only hit is recorded at the
conservative min-based score, so it reads as a POSSIBLE match for MLRO
adjudication and can never be scored as a confirmed designation.

Recorded in `docs/governance/model-validation-2026.md` §5 **pending MLRO
sign-off** - this is a change to the deterministic engine's matching behaviour
and needs the MLRO's signature under §4 change control.

### Screening - coverage alarms turn the run red; onboarding gets the gate chain (2026-07-29)

Two gaps in the loud-failure chain:

- **Coverage-drift alarms never failed the run.** A core list that silently
  shrank ≥20% vs its trailing median (or EOCN mirror designations missing
  locally) reached the report §⑤ and the QA gate - but the QA gate only logs,
  so the Actions run stayed green and freshness/failure alerting saw a
  healthy control while coverage drifted. New post-delivery
  `enforce_coverage_alarm_gate()` (exit 6, kill-switch
  `COVERAGE_ALARM_HARD_FAIL=0`), same deliver-first-then-red pattern as the
  outage gate. The EOCN review-age alarm stays excluded - it has its own gate
  and exit code.
- **The onboarding run called none of the post-delivery gates.** A failed
  onboarding delivery, an outaged core list, a lapsed EOCN review or a drift
  alarm left a green 6-hourly run - and a new customer's screen is the one
  the daily batch will not redo that day. `run_onboarding` now ends with the
  same four-gate chain as the daily run.

Tests pin the exit code, the kill-switch, the clean path, that BOTH run modes
call all four gates (source inspection), and the no-double-gate exclusion.

### Case engine - coverage floors reach the JS screening path too (2026-07-29)

`scripts/sanctions-screen.mjs` (the per-case / onboarding engine) degraded
loudly on a fetch failure or a 0-name parse - but a list that parsed 50 of
39,000 names counted as fully loaded: partial truncation was the one
false-negative class the Python engine floors caught and the JS engine did
not. Each source now carries a `minNames` coverage floor in its registry
(`data/sanctions-sources.json`, `data/sanctions-extra.json`; ~50% of verified
baselines, provisional where none is logged). A below-floor list still
screens - a hit on a truncated list is a real hit - but is marked `partial`,
which reuses the existing contract: standing matches are carried forward
instead of cleared, and the run reports DEGRADED, so a "no match" against a
truncated list is provisional, never an all-clear. Alias files (`mergeInto`)
carry no floor (the fold's partial machinery covers them) and the optional
internal watchlist keeps none (empty is a valid state). Tests pin the
classifier and - the multi-homing lesson - that every enabled non-optional
source in BOTH registries actually carries a floor.

### Screening - availability hardening: retry the blip, retry the day (2026-07-29)

Two layers of self-healing for the failure classes no fallback ladder can
absorb:

- **`download()` retries transients** (network errors, 5xx, 429) with a short
  backoff before giving up - one TCP reset used to burn a list's primary
  origin, forcing the mirror (or a DEGRADED day where no mirror exists). Any
  other 4xx still fails immediately: a bot gate will not heal within one run,
  and retrying it only delays the fallback ladder that can. `DOWNLOAD_ATTEMPTS`
  (default 3), tests cover all four classes.
- **A third daily cron slot** (06:07 UTC) on the unified screening workflow.
  The first two slots sit 3h apart, so a single 3–4h outage window (GitHub
  Actions or an upstream source) could still cost the whole day. The new slot
  is the same NO-OP-when-already-green preflight; when it does have to screen,
  delivery lands ~11:30 UAE - late, but a late daily screening beats a missing
  one for a mandatory control.

### Screening - coverage floors ratchet themselves to the observed baseline (2026-07-29)

The static floors are point-in-time baselines, and AU/CH shipped with
provisional 500s and a TODO to tighten them by hand once runs logged real
counts. Now the engine does the tightening itself: each run raises - never
lowers - a primary-served core list's effective floor to
`ADAPTIVE_FLOOR_PCT` (50%) of its trailing-median count from the coverage
history `monitoring.check_source_coverage` already persists, once
`ADAPTIVE_FLOOR_MIN_HISTORY` (5) days of history exist. A partial corruption
that clears a stale static floor but sits under half the observed baseline
now refuses the run. Fallback-served lists keep the static floor - a mirror
is a different corpus (e.g. OFAC without the alias fold), and judging it by
the primary's baseline would turn the fallback into a refusal trap. Any
read/parse problem with the history yields the static floors: the ratchet is
an extra guard, not a new failure mode. Kill-switch `ADAPTIVE_FLOOR_PCT=0`.
Engine tests cover the ratchet, the minimum-history gate, the never-lower
rule, the fallback exemption, and the missing-file path; the pre-existing
static-floor tests are pinned hermetic against a nonexistent history file.

### Screening - every core list with a second origin now falls back to it (2026-07-29)

The UN blob rotation caught by the 29 Jul proof run showed the remaining
fragility class: a core list with one reachable origin. OFAC and UN already
fell back to their OpenSanctions mirrors; the ladder now covers the rest:

- **UK OFSI** falls back to the `gb_hmt_sanctions` mirror (same
  `_mirror_fallback` contract: only when the primary yields nothing, MIRROR
  provenance in the list date, degrade-loudly unchanged when both are down).
- **EU FSF** - the one core list whose *primary* is the OpenSanctions host -
  falls back the other way, to the **official webgate XML** (public FSF token),
  parsed by a new schema-tolerant `parse_eu_official_xml`. The webgate host is
  now allowlisted in the two screening workflows that lacked it (the unified
  daily path and onboarding).
- The **legacy manual path** gets the full ladder too (OFAC/UN/UK/EU), with the
  same fallback-before-alias-fold ordering the daily path documents.
- **AU/CH** have no second origin (DFAT bot-gates its .xlsx; SECO's XML is a
  third schema) - documented in the loader; an OpenSanctions outage surfaces
  as the usual outage-gate DEGRADED, never a silent gap.
- Engine tests pin the FSF XML parser, the EU fallback contract, and - the
  multi-homing lesson - that **both** load paths actually wire every fallback,
  via source inspection, so a helper existing but uncalled can't recur.

Source-coverage drift monitoring (>20% shrink alarm vs trailing median) already
covers AU/CH automatically as history accrues; their provisional 500 floors
stay until observed baselines land.

### Screening - the unified poster multi-homes too; second UN blob domain (2026-07-29)

The 2026-07-29 live proof run (30455597768) succeeded - UN loaded over the
rotated blob domain, AU/CH matched with 🆕 markers, an employee-project record
was screened, no DEGRADED - but its report task landed **only in Ongoing
Monitoring**. `_mlro_queue_targets()` existed and both legacy posters used it;
the **unified** poster (`post_unified_task`, the path the daily workflow
actually takes) still hardcoded a single queue. Fixed, and the payload is now
pinned by two engine-test checks so a delivery target can't silently narrow
again. Today's task was multi-homed into Follow Ups by hand (same task GID -
multi-homing keeps the single audit trail).

The same run's egress log also showed the UN rotating across **more than one**
storage account: `umsaszjsdz5c04wqdhbq.blob.core.windows.net` was blocked at
14:20:53 while `umsanrp1dltx4dj3sxtt` served the list. Both are now in the
five workflow allowlists; a future rotation to a third account will surface as
a DEGRADED banner (never a silent gap), per RA-01.

### Screening - the core-list set stops being hardcoded in four places (2026-07-29)

Self-audit of the morning's AU/CH core-list addition found **four places that
still enumerated the original five lists** - each one a spot where an Australia
or Switzerland outage would have been invisible to that specific control while
the floors and outage gate caught it elsewhere:

- `screen.py` - the report's **DEGRADED banner** derived coverage from a
  hardcoded five-tuple. Now derived from `list_meta`'s tier, with **no tier
  defaulting to core (fail-closed)** - the engine test proved the first draft of
  this fix fail-open: an untagged meta made the comprehension empty and
  `all([])` read as clean coverage.
- `agents.py` - the **QA gate** checked five core lists; an AU/CH outage would
  have passed QA silently. Now seven.
- `agents.py` - the per-run **attestation**'s `core_ok` likewise. Now seven.
- `scripts/daily-screen-run.py` - the retired manual path's floor
  classification now floors AU/CH too, with obtained-from-results semantics
  (like EOCN), so a fetch failure classifies as an outage, never a refusal.

Test fixtures updated to the seven-list core meta. 73/73 checks pass.


### Screening - the DEGRADED cause is fixed (not the flag), AU + CH become core lists, and staff join the screening population (2026-07-29)

**Diagnosis first.** The daily screen has run green every day - what was failing
was inside it: the harden-runner egress log for the 29 Jul sweep shows
`domain not allowed: umsanrp1dltx4dj3sxtt.blob.core.windows.net`. The UN
rotated its list-hosting Azure storage account; every screening workflow still
allowlisted only the old one (`unsolprodfiles`), so the UN Consolidated fetch
died mid-redirect and the run honestly reported **DEGRADED** - which is the
control working, not the defect. The defect was the stale allowlist, and that
is what is fixed: the new UN blob domain is allowlisted in **all five**
screening workflows. **The DEGRADED flag itself is untouched and stays** -
RA-01's ratified position is *"a screening run that cannot load a core list
must read DEGRADED rather than pass"*, and suppressing the label would convert
visible outages into silent clears.

- **Australia (DFAT Regulation 8) and Switzerland (SECO) are now CORE lists**,
  screened directly every run in **both engines** via the OpenSanctions mirrors
  (`au_dfat_sanctions`, `ch_seco_sanctions`, `targets.simple.csv` - the same
  host and shape the EU list has always used, so **no new egress endpoint**).
  Previously both were "cross-referenced" prose: DFAT bot-gates its .xlsx and
  the curated fallbacks sat empty and disabled. Both carry coverage floors
  (provisional and deliberately low - no verified baseline existed at
  introduction; tighten toward ~50% of observed counts once real runs have
  logged them, `LIST_FLOOR_AU` / `LIST_FLOOR_CH`). The daily core set is now
  **UN · OFAC (SDN + a.k.a.) · UK OFSI · EU FSF · Australia DFAT ·
  Switzerland SECO · UAE EOCN**, plus Canada SEMA / France DGT / the internal
  watchlist as supplementary - with worldwide adverse media (Google News ×5
  locales, Bing, GDELT) and worldwide PEP (OpenSanctions PEPs + Wikidata)
  already daily.
- **The HR – Employees project is a screening population** in both engines -
  each staff member screened as an individual through the same matcher, guards,
  delta state and case lifecycle as customers. Configured-but-unreachable (or
  empty) is **FATAL**, the same contract as the customer database: a population
  that silently drops out of screening is a silent clear for everyone in it.
  Disable only explicitly (`ASANA_EMPLOYEE_DB_GID=""` /
  `ASANA_EMPLOYEE_PROJECT_GID=""`).
- **Daily deliverables are multi-homed into BOTH MLRO queues** - Ongoing
  Monitoring (review record) and **Follow Ups** (action queue) - one task, two
  projects, a single audit trail. A delivery that reaches neither still arms
  the delivery gate and turns the run red.
- The daily report's coverage section now shows AU and CH as directly-screened
  core lists with their counts, replacing the "cross-referenced periodically"
  prose that a reader could mistake for screening.


### Advisor - the default mode is Balanced, as the model card always claimed (2026-07-29)

The backend defaults to `balanced` (`claude-sonnet-5`) and the model card
documents that as the default - but the UI booted on **Speed**, so every
operator's first answer actually came from `claude-haiku-4-5`, the weakest
model. On a surface whose known risk is **automation bias** (R-10 - the
operator trusting the output too much), defaulting to the least capable
reasoning is the worst possible pairing, and the documented default and the
experienced default disagreed: the paper-vs-practice gap in one line of state.

The UI now boots on **Balanced**. Speed and Deep remain one click away -
deliberate choices, not starting points - and the browser check pins the boot
default so it cannot silently drift again.


### Advisor - deep mode works on a default site, the eval covers every model and fires on model change, and the downgrade banner is browser-verified (2026-07-29)

Three residual limitations from the morning's model refresh, each stated at the
time and each now closed with evidence rather than restated.

- **The Claude 5 models are live-confirmed, and confirmation can no longer lag a
  swap.** The behavioural eval was dispatched against the real API the same day
  - run 30452220311, **all guardrail cases held, zero regressions** (the
  fail-on-regression step did not fire; the egress log shows the
  `api.anthropic.com` call). Structurally: `scripts/advisor-eval.mjs` now
  evaluates **every model of the governed routing**, read from `MODEL_BY_MODE`
  rather than restated - the single-model default would have left the deep tier
  unverified by exactly the swap that just happened - and `advisor-eval.yml`
  **fires on any push to `main` touching `brain-soul.js`, `data/ai-assets.json`
  or the eval itself**, so the confirmation window is minutes, not up to a week.
- **Deep mode is genuinely available on a default-capped site - as a guarded
  continuation.** A 4096+-token deep answer can never fit a ~10 s synchronous
  cap, and both obvious escapes are wrong for this surface: a background
  function is plan-gated and puts operator content at rest in a new store
  (RA-04), and **streaming is architecturally incompatible with the tipping-off
  guard** - the guard must see the complete output before the operator does,
  and a streamed sentence cannot be unstreamed. Instead the governed deep model
  (`claude-opus-5`) generates the answer across up to `DEEP_HOP_LIMIT`
  synchronous hops (assistant-prefill resume), under two CI-pinned invariants:
  **no unguarded token ever leaves** - the tipping-off guard runs over the full
  accumulated text on *every* hop, and a partial that trips it is withheld on
  that hop, never returned for resubmission - and **the client renders nothing
  until the final fully-guarded response**. The audit line records `deepHops=N`.
  Old cached clients that don't declare `deepContinue` keep the previous
  visible degrade; raised-cap sites keep single-call deep; the hop budget
  (~6 × 1530 ≈ 8k tokens) matches what a raised cap would afford.
- **The downgrade banner is verified in a real browser, not assumed.**
  `test/advisor-browser.test.mjs` drives Chromium against the real
  `advisor.html` - through the AUP acknowledgment gate, which the check
  confirmed blocks every send until accepted - stubs the function, and asserts
  the banner is on screen with its reason and remedy, **and** that an
  undegraded answer shows no banner, so the warning cannot decay into noise.
  Skips loudly when no browser is available, same contract as the Python
  suites.

### Governance - the MLRO signs what the MLRO can sign (2026-07-29)

Four approvals recorded under the **HS MLRO**'s own authority. The governing
principle, and the reason this is four items and not eighteen: **an instrument's
approver is fixed by its type, not by who is available.** Policies, standards and
charters are Board acts (the Board is **HS Management**); procedures are the
MLRO's. Nothing here was signed by a role that does not hold the authority for it.

- **Stakeholder Impact Assessment v1.1 ratified** - the ISO/IEC 42001 clause
  6.1.4 designation, the unfair-and-discriminatory-outcome section and the
  availability clause. **Closes open-actions item 19.** v1.1 was signed on its own
  account rather than folded into v1.0's 2026-07-02 signature, and both rows
  stand in the sign-off table so the version history records what was approved
  when.
- **POL-19** (STR/DPMSR filing) and **POL-30** (regulatory change management)
  **approved and in force to 2027-07-29.** Both approval blocks read *"Approved
  by (MLRO)"* - they are procedures, so they did not wait on the board sitting.
  The other **sixteen** pack instruments are Board acts and stay draft; item 18
  remains open for them.
- **Transaction-feed compensating control adopted** - and **item 6 stays open**,
  deliberately. `OB-03`, `OB-13` and `OB-21` name item 6 as their closing
  condition, and the control is *interim*: `txn_monitor.py` is still INACTIVE and
  no feed is connected. Closing the item would have stranded three genuinely
  unmet obligations with no tracked path and converted a visible gap into an
  invisible one. The item is rewritten, not removed - the outstanding act is
  wiring `TXN_FEED_PATH`.
- **The Claude 5 model change recorded** in `model-validation-2026.md` §5, per §4
  step 5 of change control, with its residual limitation stated: the live
  guardrail eval is weekly and key-gated, so the first scheduled run is the
  confirmation.

**The CI guard on the 6.1.4 artefact was corrected, not relaxed.** It previously
forbade a v1.1 row from reading *Ratified* - which was right while v1.1 was
unsigned and wrong once it was signed. It now requires that **any row claiming
ratification names an approver and carries a date**, catching both real failure
modes: content amended under an earlier signature, and a row marked Ratified with
`_(pending)_` still in the approver column.

Verified by breaking it: removing every occurrence of the approval date from
`str-dpmsr-filing-procedure.md` fails `policies.test.mjs`, so the signature is
evidenced by the document rather than merely asserted in the register.

**Still not done, and not signable:** R7 ratification, the board sitting, the ISO
path decision, the MRM ratification and the DPO minute are Board acts. Item 11
needs counsel's signature before the MLRO countersigns. Items 1, 2, 3, 5, 7, 8, 9,
14 and 15 are acts that produce evidence - the history scrub, the emails, the
release holds, counsel's mapping, the training delivery, the audit, the
enterprise register, the backtesting cycle (blocked on ≥25 disposed cases) and
the red-team round.

### Advisor - the guardrails stop disappearing under deep mode, and the models move to Claude 5 (2026-07-29)

**`brain-soul.js` aborted its own API call at 26 s against a Netlify synchronous
function cap of ~10 s** - 2.6× the platform limit. On a default-configured site
deep mode was not merely slow, it was **killed by the platform mid-flight**, and
that is worse than a slow answer: when the platform kills the invocation the
function never returns, so **none of the guardrails run**. The tipping-off guard
(P4), the PII guard, the injection and hallucination guards, the quality score
and the audit line all silently did not happen, and the operator saw an opaque
platform error instead of a governed refusal.

- **The abort budget now derives from the platform cap and sits inside it** -
  `ADVISOR_PLATFORM_CAP_MS` (default 10000) minus 1.5 s of headroom for the
  guards and the response, so the function **always returns its own governed
  answer**. CI asserts the budget is strictly less than the cap, that the
  headroom is at least a second, and that no mode asks for more tokens than the
  budget affords.
- **Deep mode degrades loudly rather than pretending.** A 10 s cap affords ~1500
  output tokens; deep mode's premise - steelman the counterargument, run a
  pre-mortem, cite every relevant typology - does not fit, and shipping a
  truncated answer under the deep label is exactly the paper-vs-practice gap
  this estate exists to close. Below 4096 affordable tokens deep mode now
  **degrades to balanced visibly**: `modeDegraded` and a reason in the response,
  `modeDegraded=deep→balanced` on the audit line, and an amber banner in the UI.
  The instruction set follows the *effective* mode, so a downgraded answer is
  never asked for a full pre-mortem it cannot deliver. Same rule as everywhere
  else here - degradation is tolerated, silent degradation is not (RA-06).
  Raise the site cap with Netlify support, set `ADVISOR_PLATFORM_CAP_MS` to
  match, and deep mode becomes available with no code change.
- **Governed routing split from deployment affordability.** `MODEL_BY_MODE` is
  what each mode *is*; `selectModel` applies the affordability layer on top.
  `data/ai-assets.json` pins the former, so the model-change control stays
  enforceable whatever cap a given site runs - otherwise the register would read
  differently per deployment.
- **Models refreshed to Claude 5** - `claude-sonnet-4-6` → **`claude-sonnet-5`**,
  `claude-opus-4-8` → **`claude-opus-5`**; `claude-haiku-4-5` kept for speed
  mode. Moved in the same commit as `data/ai-assets.json` and
  `docs/models/advisor-llm.md`, as the model-change control requires, plus
  `scripts/advisor-eval.mjs`, `scripts/advisor-bias-eval.mjs` and
  `scripts/reg-draft.mjs`. No request-shape change was needed - the call sends
  no `temperature`, `top_p` or `thinking` parameter.

### Governance - the chain between control families, and trust defined narrowly enough to measure (2026-07-29)

The estate slices its governance four ways - a five-level operational stack, a
six-layer agentic model, a seven-stage lifecycle, an eleven-stage PbG map - and
every one of them slices **the same territory**. What none of them recorded is
which control's output another control *consumes*. The assurance matrix is
control → *proof*; `AI-GOVERNANCE.md` §8a is pillar → *control*; there was **no
control → control map anywhere**.

- **[`docs/governance/governance-chain.md`](docs/governance/governance-chain.md)**
  draws the missing edge - **Visibility → Explainability → Accountability →
  Trust** - as an ordering that is load-bearing rather than rhetorical: you
  cannot explain what you cannot see, and you cannot hold anyone accountable for
  a decision you cannot explain.
- **Failure propagation, with real dependencies.** A stale AI asset register
  does not just leave one asset undocumented - it makes the explainability
  statement's **scope claim** false, which makes every accountability record
  built on it a record about a system that is not the one running. A drifted
  prompt fingerprint leaves the audit line still able to say *what* a response
  was and no longer able to support *why*. Read upward, the table is a
  diagnostic: **a trust indicator that will not hold is rarely a trust problem** -
  it is usually an accountability gap, which is usually an explainability gap,
  which is almost always a visibility gap.
- **Trust is defined so it can be falsified.** Before this page the only
  occurrences of *trust* in the estate were security **trust boundaries**,
  **Trusted Types**, and a tagline. It is now defined as *the share of what this
  estate claims that an outsider can re-derive from the repository without
  asking anyone who works here* - a property of the evidence, not of anyone's
  opinion - with four indicators that already exist: control effectiveness
  (100%), **recorded-breach completeness** (every breached KRI in the ledger,
  CI-enforced - trust is not the absence of breaches but the absence of
  *unrecorded* ones), generated-artefact integrity (three drift guards), and
  honest nulls (KRI-09 reports null with its reason, never 0%).
- **Two indicators deliberately do not read green** - `residualAboveAppetite` is
  1 and `kriBreachRate` is 22.2%. An estate whose indicators were all perfect
  would be telling you about its indicators, not its risks.
- **Inline fenced mermaid, per the house convention.**
  `docs/architecture/diagrams.md` states it - *renders natively on GitHub, no
  tooling* - and the one `.mmd`+`.png` set in the tree was hand-rendered out of
  band with no renderer in the repository and nothing in CI to catch a `.mmd`
  drifting from its `.png`. Another PNG pair would add that same silent-drift
  liability.

### Governance - ISO/IEC 42001 clause 6.1.2 and 6.1.4 are separated, and the two statements of applicability stop contradicting each other (2026-07-29)

**`6.1.2` and `6.1.4` appeared nowhere in `docs/`.** The estate satisfied both in
substance and had never separated them on paper - which matters because the two
clauses ask different questions about the same failures, and a risk assessment
is routinely offered as though it answered both. It does not:

| | 6.1.2 - risk to the firm | 6.1.4 - impact on the person |
|---|---|---|
| False negative (R-03) | Severe: regulatory breach, licence risk | Slight - not being flagged does not harm the person |
| False positive (R-04) | Minor: analyst time, friction | **Severe** - de-risking, refused service, a record they cannot contest |

The two readings point in **opposite directions**. A control set tuned only on
the left column is tuned the wrong way for the people it acts on.

- **[`docs/aims/iso-42001-clause-6-1-mapping.md`](docs/aims/iso-42001-clause-6-1-mapping.md)
  - the mapping index**, with **bidirectional `R-nn` ↔ Annex A traceability**.
  Before it, *no register row cited an Annex A control and neither SoA cited a
  risk ID*, so "which control treats R-13?" had no answer anywhere in the tree.
  Both tables are hand-maintained, so
  [`test/clause-mapping.test.mjs`](test/clause-mapping.test.mjs) pins them: every
  register risk must appear, every cited risk must still exist, and **every pair
  must be present in both directions** - building it that way immediately found
  two asymmetries (A.6.2.4 did not list R-04; A.4.4 did not list R-15).
- **`stakeholder-impact-assessment-2026.md` is designated the canonical 6.1.4
  artefact**, extended with a section on **unfair and discriminatory outcomes**
  ("discriminatory" appeared **once** in the entire tree) and an availability
  clause. Every row of the new section is a *comparison between populations*,
  not a count, because that is where discrimination lives and no per-individual
  row can see it. It records one tension it cannot resolve: fair-treatment
  guidance says tell the affected person, and the tipping-off prohibition
  (FDL 10/2025, Art. 25) makes telling them an offence. The statute governs, and
  the conflict is written down rather than mitigated on paper.
- **The ratified document was not silently amended.** v1.0 was ratified
  2026-07-02 with signature evidence; a signature given then cannot cover
  sections written a month later. v1.0 stays in force, the new content is
  **v1.1 pending approval** (open-actions item 19), and a CI check fails if a
  1.1 row ever claims ratification.
- **`ai-impact-assessment.md` gained a date, a version and a named approver** -
  it had **none of the three**, so nothing recorded when it was written, what had
  changed, or who stood behind it. Also a §5a covering group-level outcomes,
  which its two-column individuals-only table could not reach.
- **The two statements of applicability contradicted each other about the same
  control.** The AIMS statement asserted *"AI impact assessment
  (individuals/society) - Implemented"* while the Advisor statement recorded
  A.5.4 as 🟡 with its first bias cycle pending. The row is now **split into
  A.5.2 and A.5.4** at their true and matching statuses, and **both statements
  now cite the ratified SIA**, which *neither had cited at all* despite it being
  the strongest 6.1.4 evidence either could offer. CI now fails if the two
  disagree about A.5.4.
- **Three vocabulary defects fixed.** `iso-42001-soa-2026.md` used 🟢 outside its
  own four-value legend, and its open-items paragraph called the AI policy's
  ratification *pending* while its own A.2.2 row recorded it as ratified
  2026-07-02 - a file contradicting itself within twenty-five lines. The AIMS
  statement used `Implemented (inactive)` for FATF R.16, a fifth value outside
  its four declared ones; it is **Partial** (built, not operating), which its own
  justification column already said. Both vocabularies are now CI-enforced.
- **Both impact assessments entered the anti-shadow-policy sweep** the moment
  they declared an approver, and are **excluded with written reasons**: an
  assessment records a finding, it does not issue a rule. Signing a finding is
  not creating an instrument.

### Governance - appetite became tolerance, and the register's own auditor checkpoint became testable (2026-07-29)

The estate stated eight appetite positions and measured nine KRIs, and **not one
position carried a number**. That left two rules the firm wrote for itself
unenforceable - `risk-assessment-methodology.md` §3 (*"residual risk is compared
against the appetite; anything above appetite requires a treatment plan with an
owner and a date"*) and the AI risk register's own auditor checkpoint
(*"residual scores sit within appetite"*). Neither could be evaluated, because
*above appetite* had nothing to be above. An appetite position is a direction; a
**tolerance** is a boundary someone is told about when it is crossed, and that
needs three things a direction does not: a number, an owner, and a clock.

- **A numeric `residual_ceiling` on every position**, derived from the
  methodology's own published bands (Low 1–6 · Medium 7–12 · High 13–25) **by
  position type, not risk by risk** - ZERO 6, LOW 9, BANDED and MEASURED 12 -
  with the derivation recorded in `residual_ceiling_basis` so an auditor can
  challenge the rule rather than guess at eight separate numbers. CI enforces
  that positions of the same type carry the same ceiling and that ZERO is
  tighter than LOW; the ceilings are appetite, so only the Board may move them.
- **An operational `owner` and an `escalation_sla` on every position, and an
  `owner` on every KRI** - each required separately by CI, because each fails
  separately: a ceiling with no owner has nobody to breach to, an owner with no
  SLA has no clock.
- **All twenty register risks are now claimed by exactly one appetite position**,
  in both directions, with `risksWithoutAppetitePosition` pinned at 0. A risk
  claimed by nobody was never scored, and an unscored risk is indistinguishable
  from a compliant one in a count.
- **`residualAboveAppetite` scores every risk on every run** - parsing the
  markdown register by **column header name**, never by position, so an inserted
  column cannot silently make it read the wrong cell. **It reports 1**: R-03,
  the sanctions false negative, sits at residual **10 Medium** against RA-01's
  ceiling of **6**, and its treatment carries an owner and a quarterly cadence
  but **no date** - recorded per row, because a cadence is a rhythm and the
  methodology asks for a deadline. The snapshot **names** the risk rather than
  only counting it. The measure was breached the day it was created; that is
  what it is for, since the condition was already true and nothing counted it.
- **Amber warning bands, as a sibling key `threshold_amber`** - never a
  reshaping of `threshold`, which the suite hard-requires. Amber exists **only
  where the red line has headroom**: a threshold of 0 or 100% has none by
  construction, and a warning that can never fire is worse than none. Two KRIs
  qualify; the rest read `-` rather than carrying an invented number.
- **The snapshot's KRI block is a projection, and now says so.** Owners, SLAs
  and amber verdicts are copied into it explicitly - a field added to
  `data/risk-appetite.json` and not listed in the projection would reach no
  board pack, so the governance data would exist and never be measured. A new
  test asserts every projected KRI carries both.
- **[`docs/governance/kri-breach-ledger.md`](docs/governance/kri-breach-ledger.md)
  - the history the snapshot cannot carry.** `data/grc-metrics.json` is
  byte-compared by CI and holds no timestamp by design, so it can only ever say
  where a number is *now*. The ledger is append-only, records who was told and
  what followed, keeps amber signals separate from breaches, and is pinned by CI:
  every KRI it quotes must still exist with that metric, and **every currently
  breached KRI must appear in it** - a breach the dashboard shows and the ledger
  does not is a breach with no recorded escalation.
- **Two stale claims fixed.** `risk-appetite-statement-2026.md` hand-quoted
  "nine KRIs, eight instrumented" in its header - a count that goes stale on
  every KRI change, now replaced by a pointer to the live snapshot - and RA-08
  listed only KRI-08 while KRI-09 named RA-08 as its position, so the link ran
  one way only. CI now checks both directions.
- **Capacity is still not stated, and the statement says so.** Risk capacity is
  a firm-level judgement about capital, licence and staffing that this
  repository holds no input to. Named as a gap rather than quietly omitted.

**R7 is not ratified by this change.** The statement stays DRAFT; ratification
is a board act (open-actions item 17).

### Governance - registers say how they know, and the missing-deadline gap is now a number (2026-07-29)

Register hygiene: four claims the registers made that the evidence did not
support, and one honest count where an invented one was the tempting option.

- **In-force instruments now declare *what put them in force*.** Fifteen of the
  sixteen `in-force` rows in [`data/policies.json`](data/policies.json) carried
  `approved_on: null` **and** a `next_review` date - a review clock anchored to
  nothing. Each now carries an `approval_basis` from a closed two-value
  vocabulary (`operative-on-publication`, `adopted-at-management-review`),
  documented in `approval_basis_meanings` and **required by
  [`test/policies.test.mjs`](test/policies.test.mjs)** on every in-force row
  without an approval date. The vocabulary was derived from what the documents
  already say, not invented: fourteen read "Operative on publication", POL-05
  was adopted at a management review. No approval date was fabricated - the
  seventeen open actions stay human acts.
- **The missing deadlines are now counted rather than described.**
  KRI-09 (overdue issue rate) reports *null* because no open action carries a
  target date, and instrumenting it would have meant inventing seventeen
  deadlines. Instead `scripts/grc-metrics.mjs` gained
  **`openActionsWithoutTargetDate`** - it keys on a dedicated `Target date`
  column and, with no such column, correctly counts every row (**17**). The
  board gets a number for item 17, and the counter falls on its own the moment
  dates start landing.
- **`docs/aims/README.md` omitted four documents that exist on disk** - among
  them **two in-force registered instruments**, the TFS Name-Match Procedure
  (POL-07) and the EOCN List Update SOP (POL-09). That page is the "start here"
  for an AIMS audit, so a document missing from it is a document an auditor does
  not know to ask for. All twenty-nine are now indexed.
- **Three stale cross-references corrected.** OB-10's note in
  `data/obligations.json` said the risk register runs "R-01…R-13" when it runs
  to **R-20**; `data/risk-appetite.json` cited `test/risk-appetite.test.mjs`,
  which **does not exist** (the assertion lives in `test/grc-metrics.test.mjs`);
  the open-actions register and item 18 called the AML/CFT/CPF pack
  "seventeen instruments" against **eighteen** on disk and eighteen `draft` rows
  in the register.
- **The open-actions register's own "Last updated" line said 24 July** while
  items 16–18 had landed on the 28th - the one line whose whole job is to say
  how fresh the answer to "what is pending?" is.

### Governance - the risk vocabulary, and a guard for the links that hold the pack together (2026-07-29)

The pack is written in fluent GRC dialect and had **no translation layer**.
Seventeen of the thirty terms in a standard risk lens appeared **nowhere** in
`docs/` - risk capacity, target residual risk, control owner, control weakness,
compliance gap, loss event, performance indicator among them - while *issue* (41
documents) and *incident* (40) were used constantly and never once defined or
distinguished.

- **[`docs/governance/risk-glossary.md`](docs/governance/risk-glossary.md)** -
  the thirty terms in business language, grouped by what they actually decide:
  the four levels of risk-taking (appetite vs tolerance vs **capacity**), risk
  levels, accountability (**risk owner vs control owner**), control failure vs
  control **weakness**, the four failure words (**issue vs incident vs near miss
  vs loss event**), and **KRI vs performance indicator**.
- **It links rather than restates.** Every entry points at the definition that
  already exists - `risk-assessment-methodology.md` §3 for inherent/residual and
  the Strong/Adequate/Weak/Absent control ratings, `ai-risk-register.md` for the
  scoring key and the four treatments, `obligation-register.md` §3 and the
  `status_meanings` blocks for the status vocabularies - so the glossary cannot
  drift away from the registers it explains.
- **It records what is *not* governed as plainly as what is.** Risk capacity,
  target residual risk, control owner, loss event and a severity scale have no
  home in this estate, and the page says so. A glossary that quietly implies a
  control the firm does not have is worse than no glossary.
- **It disambiguates a term that already means something else here.**
  `near-miss` has four uses in the pack and **all four are matcher-score
  margins** against the 0.85 threshold - not "a failure caught in time".
- **It names the gap that makes two stated rules unenforceable.**
  `risk-assessment-methodology.md` requires that *"anything above appetite
  requires a treatment plan with an owner and a date"*, and the risk register
  lists *"residual scores sit within appetite"* as an auditor checkpoint.
  Neither is testable today, because no appetite position states a numeric
  residual ceiling.

**[`test/doc-links.test.mjs`](test/doc-links.test.mjs) - relative links now have
a guard.** `scripts/link-check.mjs` extracts `https?://` only, so a
cross-reference to a file that does not exist was invisible to CI - across
**1,182 relative links in 179 documents**, in a pack whose registers are built
out of links to their own evidence. Zero were broken, which is the point: the
guard is preventive, it pins a property the estate already has, and it verified
the glossary's own forty-four links on the way in. Fragments (`#anchor`) are
deliberately out of scope - GitHub's slug rules would make it cry wolf - but the
file half of `file.md#section` is checked.

### Engine config - the Asana credential is checked where Asana is called, and the settings that gate a degraded run are documented (2026-07-29)

- **`screen.py` no longer `KeyError`s at import.** It read `ASANA_TOKEN` with an
  unguarded `os.environ[...]` at module load, while the `.mjs` scripts, every
  workflow and `.env.example` all use **`ASANA_ACCESS_TOKEN`** - so copying
  `.env.example` to `.env` and running `python screen.py` failed before a line
  of the engine ran. Four consumers that only wanted the matcher worked around
  it by injecting a placeholder credential. It now accepts **either** name and
  normalises the result onto one, so `agents.py`'s credential broker (which
  audits presence by name) stays correct.
- **The safety that hard failure provided moved to where it belongs.**
  `asana_request()` - the single Asana call path - now refuses to run without a
  credential, because an unauthenticated Asana read does not fail cleanly: it
  returns an error body that parses as zero tasks, and a screen over zero
  customers would file as an all-clear. So the check fires when Asana is
  actually used, instead of blocking consumers that never touch it.
- **All four placeholder credentials are gone** - the two CI steps, the
  EOCN reconcile step and the daily-screen runner. A step that parses external
  downloads now holds no Asana credential at all. The old wiring pin is
  replaced by a contract pin asserting **both** halves: either env name is
  accepted, *and* `asana_request` still refuses an unauthenticated call.
- **`.env.example` covers the engine.** It made 30 of the 77 variables the
  engine reads assignable, and the gap included the **sanctions coverage
  floors** (`LIST_FLOOR_*`, `LIST_FLOORS_ENFORCE`) and the **hard-fail gates**
  (`DELIVERY_HARD_FAIL`, `EOCN_REVIEW_HARD_FAIL`) - the settings that decide
  whether a degraded run fails loudly or passes quietly. Every operator-facing
  variable is now documented with its default and what it costs you to change:
  thresholds, AI gates, transaction-monitoring, circuit breakers, alarms. The
  Python-side `MATCH_THRESHOLD` / `SHADOW_THRESHOLD` names were previously
  described in a comment without ever being assignable. CI-injected values
  (`GITHUB_*`, the per-list `*_HASH`, the date/step plumbing) are deliberately
  excluded and say so - setting those by hand misreports a run.

### Tooling - Python becomes a governed language here, and `npm test` stops lying (2026-07-29)

Three gaps that all had the same shape: a check that existed in one place and
not the other, so the green signal was narrower than it looked.

- **Ruff on the screening engine.** ~5,900 lines of Python that make sanctions
  decisions had **no static analysis at all** - the only gate was
  `python -m py_compile`, a syntax check - and `pyproject.toml` was pure
  metadata with no `[tool.*]` section. Ruff now runs in
  [`lint.yml`](.github/workflows/lint.yml), pinned and hash-locked in
  [`ci/ruff-requirements.txt`](ci/ruff-requirements.txt) like semgrep and zizmor
  before it. Rule selection deliberately mirrors `eslint.config.mjs` - pyflakes
  correctness (`F`) plus `E9`, **not** the pycodestyle formatting families: the
  engine's house style puts short guards on one line and ruff flags 125 such
  sites, and restyling a sanctions matcher for a formatter is a large, risky
  diff with no correctness payoff. It found 16 real items, all fixed -
  including two imports that were dead inside the workflow YAML where nothing
  could see them.
- **`npm test` now runs the five Python suites.** They ran only in CI, so a
  developer who had just broken `screen.py` got a green `npm test` - the 389
  assertions in the largest suite never fired. A missing interpreter or engine
  dependency is a **loud skip, never a pass** (`⚠ n python suite(s) SKIPPED -
  not run, not passed`), on the same principle the engine applies to a list it
  cannot load. `test/matcher-parity.test.mjs` follows the identical policy.
  `npm test` goes from 65 checks to 70.
- **The one-way rule that allowed it is now bidirectional.**
  `test/ci-coverage.test.mjs` enforced "every `test/*.py` appears in ci.yml" but
  never the reverse - the same asymmetry its own §4 says let a stale artefact
  reach `main` on 2026-07-28. It now also asserts the runner discovers them.
  Its header claim that "there is no test runner / package.json in this repo"
  is corrected; both have existed for some time.
- **`str_dossier.py` joins the `py_compile` gate** - it was exercised by
  `test/engine_test.py` but never syntax-checked.
- **`i18n.js`, `sw.js` and `sw-register.js` are actually linted now.** They were
  absent from `npm run lint` *and* from every `files:` block in
  `eslint.config.mjs`, so adding them to the script alone would have applied
  zero rules and read as "linted" while catching nothing - verified: an
  undefined-variable reference in `sw.js` raised no error. They get real config
  blocks (`sw.js` with service-worker globals rather than window ones), and the
  same reference now fails as `no-undef`.

### Screening - 842 lines of the daily screen come out of the workflow YAML (2026-07-29)

The daily sanctions screen carried three inline `python3 << PYEOF` heredocs
inside [`daily-sanctions-screen.yml`](.github/workflows/daily-sanctions-screen.yml)
- 842 lines of the live screening path (fetch the customer/principal list,
screen it through the real `screen.py` matcher, build the report and file the
Asana task). Inside a YAML string that code was invisible to
`python -m py_compile`, unreachable by any test, and unlintable by semgrep, which
scans `.py` files and not YAML. It was the least-governed code in the repository
and it ran every day.

- Extracted **verbatim** - byte-for-byte, verified by diffing the dedented
  heredoc bodies against the new files - into
  [`scripts/daily-screen-fetch.py`](scripts/daily-screen-fetch.py),
  [`scripts/daily-screen-run.py`](scripts/daily-screen-run.py) and
  [`scripts/daily-screen-report.py`](scripts/daily-screen-report.py). The
  workflow drops from **1,135 lines to 290** and now just calls them.
- **One real behavioural difference, handled.** A heredoc piped to `python3`
  runs with `sys.path[0] == ''` (the working directory), so `import screen`
  resolved; a script file gets its own directory instead. `daily-screen-run.py`
  puts the repo root back explicitly, and the import is verified to resolve.
- All three are now in the `py_compile` gate in `ci.yml`, so a syntax error in
  the daily screening path fails CI instead of failing at 02:00 GST.
- Smoke-verified end to end: the screening step loads its inputs, degrades
  loudly on missing list files (the SOURCE OUTAGE path), loads the 326-name
  in-repo UAE EOCN list, and stops only at `GITHUB_ENV` - which exists only
  inside Actions.
- `.gitleaks.toml` gains a note that its allowlist is by value, not by path, so
  it followed the extracted code unchanged.

### Screening - the two engines are now compared to each other, and a silent JS false negative is closed (2026-07-29)

The sanctions matcher is implemented twice - `screen.py` (rapidfuzz) and
[`scripts/sanctions-match.mjs`](scripts/sanctions-match.mjs), the zero-dependency
reimplementation that drives the live screen in `sanctions-screen.yml`. Parity
between them was held by hand, by eighteen "mirrors screen.py" comments, and
**nothing compared the engines to each other**: the accuracy benchmarks score
each backend against its own floor, and `test/benchmark_eval.py` says so outright
- *"every floor is enforced per backend - the two are NOT comparable."*

- **A silent false negative, found by building that comparison.** The JS engine
  dropped tokens shorter than three characters from its candidate index. A
  subject whose shared tokens were two letters long therefore had **no candidate
  path at all** and screened **clear**, where `screen.py` hit it. Measured:
  `"Yu Li Pang"` against listed `YU LI PING` - Python 90, JS **clear**;
  `"Xi Da Wai"` against `XI DA WEI` - Python 89, JS **clear**. This is the same
  shape as the Turkish dotless-ı miss fixed earlier, and it bites hardest on
  transliterated CJK names. `sigTokens` now uses screen.py's `len(t) > 1` floor.
  The change is recall-monotone - it only ever ADDS candidates - and **moved no
  floor**: recall 97.5%, hard-negative clear 96.5%, adverse 100%, fn count 3, all
  unchanged.
- **The conservative gate it would have weakened is kept, explicitly.** Widening
  `sigTokens` would have let an all-two-letter name ("Yu Li") past the
  "not auto-screenable → MANUAL REVIEW" routing. New `screenableTokens()` keeps
  that gate on the stricter ≥3 rule, so candidate recall and the auto-screenable
  decision can no longer move together by accident - a fuzz property pins the
  subset relation.
- **[`test/matcher-parity.test.mjs`](test/matcher-parity.test.mjs)** - the guard
  that was missing, driving both engines over a shared corpus via
  [`scripts/matcher-parity-probe.py`](scripts/matcher-parity-probe.py). It
  asserts exact parity on the lost-script predicate (the anti-silent-clear gate)
  and on `normalize` for foldable names, and **directional** parity elsewhere:
  screen.py's significant tokens must be a *subset* of the JS engine's, and a
  screen.py hit must be reached by the JS engine too. Extra JS tokens are the
  recall-safe direction and are tolerated (it keeps the name particles `BIN`/`AL`
  that screen.py drops); keeping *fewer* is the silent-miss direction and fails.
  Scores are deliberately not compared - rapidfuzz and the JS Levenshtein
  legitimately differ by a point (93 vs 94), and CI's main job runs the difflib
  backend while the fuzz job runs rapidfuzz.
- Both historical parity failures are pinned in the corpus as permanent
  regressions, and the test fails if either pin is removed. Verified by
  reintroducing the bug: the guard catches the token divergence *and* both
  resulting false negatives.

### Compliance - Conflict of Interest policy, five unregistered instruments, and a sweep that can no longer miss them (2026-07-28)

Closing the two gaps a verification pass found after the policy pack landed.

- **Conflict of Interest & Staff Conduct Policy**
  ([docs/policies/conflict-of-interest-policy.md](docs/policies/conflict-of-interest-policy.md)) -
  the instrument the pack was missing. Declaration on arrival, on change and
  annually; withdrawal from the conflicted decision; four eyes on customer
  acceptance, screening dispositions and filing decisions; gifts and outside
  interests; **no commercial override of a compliance decision**; the MLRO's own
  conflicts routed to the Board chair rather than to management; and a conflicts
  register where an empty year is a finding, not a clean bill of health.
  Distinct from `CODE_OF_CONDUCT.md`, which governs open-source contributors.
- **Five instruments registered that were already operating** (POL-32 to
  POL-36): the business continuity plan, the AI decommissioning procedure, the
  data-quality plan, the internal audit programme, and the model-validation and
  change-control pack. All owned, all current, none previously in the register -
  so nothing tracked their approval or their next review date. Owner headers
  normalised where they were prose rather than a declaration.
- **The sweep that let two of them through is fixed.** `bcp.md` and
  `decommissioning.md` were invisible to the anti-shadow-policy check purely
  because of what they were called. It now runs on **two signals**: the widened
  filename rule (adds *plan*, *standard*, *methodology*, *bcp*) **and** an
  `**Approver:**` header, which is the one thing only an instrument claims.
  Coverage went from 11 documents to 34.

Thirty-six instruments registered, sixteen in force, twenty draft pending
approval under open-actions item 18.

### Compliance - the AML/CFT/CPF policy pack: seventeen governing instruments (2026-07-28)

The estate had controls, registers and evidence - and no policies. The registers
pointed at procedures and runbooks; the instruments that say *how the firm
applies* its obligations did not exist. This adds them, under `docs/policies/`,
grounded in Federal Decree-Law No. 10 of 2025, Cabinet Resolution No. 134 of
2025, Cabinet Decision No. 74 of 2020, the PDPL and the MoE circulars (2/2024,
3/2025, 4/2025, 6/2025).

- **Master:** [AML/CFT/CPF Policy](docs/policies/aml-cft-cpf-policy.md) - three
  pillars, governance and accountability, prohibited business, personal
  liability, and the evidence map. Everything else implements part of it.
- **Customer & counterparty:** [CDD/SDD/EDD](docs/policies/customer-acceptance-cdd-policy.md)
  (band outcomes and hard rules, UBO at 25% with nominees looked through, SDD
  eligibility *and* its documentation duty, PEP handling, review cycles) ·
  [Sanctions & TFS](docs/policies/sanctions-tfs-policy.md) (lists, 24-hour
  rescreen on list update, freeze-without-delay, PNMR/CNMR/FFR deadlines,
  DPMS circumvention indicators) ·
  [CPF](docs/policies/proliferation-financing-policy.md) - proliferation
  financing as a **standalone pillar**, not a footnote to sanctions ·
  [Responsible Sourcing](docs/policies/responsible-sourcing-policy.md) (OECD
  five steps, LBMA RGG, KYS, CAHRA/ASM).
- **Transactions & reporting:** [Monitoring & Reporting](docs/policies/transaction-monitoring-reporting-policy.md)
  (the **DPMSR-vs-STR** distinction, AED 55,000 thresholds with linked-series
  aggregation, AED 3,500 wire data, tipping-off) and the
  [goAML filing procedure](docs/policies/str-dpmsr-filing-procedure.md), which
  logs **no-action decisions** to the same standard as filings.
- **Programme:** [Governance Charter](docs/policies/compliance-governance-charter.md)
  (MLRO independence and authority, annual report, twelve-month cycle) ·
  [EWRA/BWRA methodology](docs/policies/risk-assessment-methodology.md) ·
  [Training](docs/policies/training-awareness-policy.md) ·
  [Independent Audit](docs/policies/independent-audit-policy.md) ·
  [Whistleblowing](docs/policies/whistleblowing-policy.md) - the speak-up
  element the estate had no instrument for ·
  [Regulatory Change Management](docs/policies/regulatory-change-management-procedure.md).
- **Data, security, suppliers:** [Record-Keeping & Retention](docs/policies/record-keeping-retention-policy.md)
  (five years, **48-hour production**, holds) ·
  [Data Privacy](docs/policies/data-privacy-policy.md) (PDPL lawful basis; a
  data-subject request never overrides tipping-off) ·
  [Information Security](docs/policies/information-security-policy.md) ·
  [Outsourcing & Third-Party](docs/policies/outsourcing-third-party-policy.md).

Every instrument is **DRAFT and not in force** until its approval block is
completed - Board for policies, MLRO for procedures - tracked as new
open-actions **item 18**. All seventeen are registered in
`data/policies.json` (30 instruments now) and CI holds the line: an owner
declared in the document itself, no approval date the document does not
record, no next-review date on a draft, and no policy-shaped file left
unregistered.

Two obligations added: **OB-20** proliferation financing as a standalone risk
(FDL 10/2025 Art. 3(3)) and **OB-21** wire-transfer originator/beneficiary data
at AED 3,500 (CR 134/2025). Every existing obligation now names the governing
instrument that discharges it. Compliance completion moves 37.5% → **33.3%**
because the denominator grew by two - a dilution the metric reports rather than
hides.

### Governance - policy register: ownership and approval records for every instrument (2026-07-28)

The last repo-side gap from the GRC map (core component 4, policy management).
The policies existed and were indexed; what nothing recorded was which had been
**approved**, by whom, when they fall due, and - for five of them - who owned
them at all.

- **Policy register** - [`data/policies.json`](data/policies.json)
  + [`docs/governance/policy-register.md`](docs/governance/policy-register.md)
  + `test/policies.test.mjs`. Thirteen governing instruments (policies,
  standards, procedures, runbooks, charters) with owner, approver, type,
  status, version, approval record and next review; eleven in force, two draft
  pending the same board sitting.
- **Ownership is now declared in the document, not only in the register.** CI
  requires an `**Owner:**` line in each instrument's own header, so ownership
  survives someone reading the document without the register. Five documents -
  the committee charter, backup & recovery, the app setup runbook, the
  red-team procedure and the history scrub runbook - had no declared owner
  until this register asked for one; headers were added in the same change.
- **Approval honesty.** A row may not claim a ratification the document itself
  does not record (checked in ISO and long-form date), a draft may not assert a
  next-review date (review clocks start at approval), and a draft must name the
  open-actions item that approves it.
- **Anti-shadow-policy sweep.** Every `docs/**` file whose name carries
  *policy*, *procedure*, *charter*, *runbook* or *sop* must be registered or
  excluded with a written reason - three external framework artefacts are
  excluded with theirs.

Also: the model-endpoint scan in `scripts/grc-metrics.mjs` is now an anchored
regex rather than a substring `includes()`. It reads source text, not URLs, so
there is no hostname to parse - but the substring shape is what CodeQL's
incomplete-URL-sanitization query fires on, and the intent is clearer stated as
a pattern match (`test/` is already excluded from CodeQL for exactly this class
of alert, per the CA-13 triage record).

### Governance - risk appetite, obligation register and a measured GRC layer (2026-07-28)

Closed the three gaps a modern-GRC self-check surfaced: no stated risk
appetite, no obligation inventory, and no management metrics. Same pattern as
the registers above - JSON source of truth, human view, CI guard.

- **Risk Appetite Statement** - [`data/risk-appetite.json`](data/risk-appetite.json)
  + [`docs/governance/risk-appetite-statement-2026.md`](docs/governance/risk-appetite-statement-2026.md).
  Eight positions (sanctions/TFS, customer acceptance, AI in decisions, personal
  data, prompt/agent change control, resilience, supply chain, remediation), the
  CDD ≤ 19 / SDD ≤ 22 / EDD acceptance scale with its hard rules, and nine KRIs.
  The statement describes the appetite the estate **already enforces**, and CI
  keeps it that way: `test/grc-metrics.test.mjs` parses `ZERO_TOLERANCE` out of
  `netlify/functions/brain-soul.js` and the band cutoffs out of `app.js` and
  fails if either diverges from the published text, in both directions. DRAFT
  until board resolution **R7** (new open-actions item 17, new R7 block in the
  minute template).
- **Obligation register** - [`data/obligations.json`](data/obligations.json)
  + [`docs/governance/obligation-register.md`](docs/governance/obligation-register.md).
  Nineteen obligations (16 regulatory, 3 voluntary/monitored) mapped to
  instrument, owner, controls, evidence, the Regulatory Watch source that would
  detect a change, and the compliance-calendar duty that files the reminder.
  `test/obligations.test.mjs` verifies every control and evidence path exists,
  every watch source and calendar duty id is real, each of the three UAE
  supervisors carries at least one obligation, every *partial* row names a live
  open-actions item, and - reusing the legal-citation guard's rule - that no
  obligation cites a repealed instrument (FDL 20/2018, CD 10/2019) as its basis.
- **GRC metrics** - [`scripts/grc-metrics.mjs`](scripts/grc-metrics.mjs),
  generated [`data/grc-metrics.json`](data/grc-metrics.json)
  + [`docs/governance/grc-metrics.md`](docs/governance/grc-metrics.md).
  Five of the six management ratios computed from committed artefacts - control
  effectiveness **100%** (60/60), compliance completion **37.5%** (6/16 met, 8
  partial waiting on a human act, 2 firm-side), KRI breach **12.5%** (1/8),
  third-party coverage **71.4%** (the two outstanding vendor confirmations),
  finding closure **95.2%** (HA-08, the transaction feed) - plus the counters
  the KRIs key on. The sixth, overdue-issue rate, reports **null with its
  reason** (open items carry owners and closing conditions but no target dates)
  and its KRI stays marked *not instrumented*, excluded from the breach
  denominator rather than scored as passing; instrumenting it is part of R7.
  Freshness is enforced by `node scripts/grc-metrics.mjs --check`, wired into
  both `ci.yml` and `scripts/run-tests.mjs` so a stale board figure fails the
  build instead of reaching a board pack.

Also: an explicit `SCANNERS` allowlist shared by the three scanning suites - a
file whose job is to detect model-API callers necessarily contains the patterns
it looks for, and must not be mistaken for one.

### Governance - prompt lifecycle and tool/connector registers, both CI-enforced (2026-07-28)

Closed the two coverage gaps left by the 10-concept AI-governance self-check:
prompt management (PromptOps) and MCP-class integration surfaces. Both follow
the established register pattern - machine-readable JSON as the source of
truth, a human view under `docs/governance/`, and a CI guard that fails on
drift rather than a page that quietly rots.

- **Prompt lifecycle register** - [`data/prompt-assets.json`](data/prompt-assets.json)
  + [`docs/governance/prompt-lifecycle-register.md`](docs/governance/prompt-lifecycle-register.md).
  Seven governed prompt artefacts across the three registered AI surfaces
  (`SOUL_CHARTER`, the knowledge-context template, the 16 persona suffixes,
  `GROUNDING_SYSTEM`, both `ai.py` user templates, and the reg-draft template),
  each pinned to a **SHA-256 of its exact source region** with a purpose, the
  risk if changed unreviewed, its runtime guards, its assurance controls, a
  version and an approval record. Editing a prompt now fails
  `test/prompt-register.test.mjs` until the change is reviewed and re-pinned
  (`node scripts/prompt-register.mjs --update`), so an instruction set cannot
  reach production without a recorded decision - the gap between
  `test/advisor-assurance.test.js` (which checks that phrases are *present*)
  and change control (which asks *who approved this wording*). The suite also
  runs an anti-shadow-prompt scan: any file calling the model API without a
  registered prompt is a red build, in both directions against
  `data/ai-assets.json`.
- **Tool & connector register** - [`data/tool-surfaces.json`](data/tool-surfaces.json)
  + [`docs/governance/tool-connector-register.md`](docs/governance/tool-connector-register.md).
  The capability view that sat between the asset register (which surfaces
  exist) and the third-party register (which processors we contract with):
  all ten agent actions with their credentials and holders, the nine connector
  surfaces with hosts, what leaves and kill switches, and the MCP posture -
  no server exposed, no client shipped, no repository secret ever handed to
  operator-side MCP tooling. `test/tool-register.test.mjs` cross-checks the
  action table, the agent roster and `ACTION_CREDENTIAL` against `agents.py`
  in **both** directions, re-verifies the runtime invariants
  (`asana.write` is DeliveryAgent's alone; no agent may file), confirms every
  declared credential is a real secret and every declared host appears in a
  declared caller, and - the load-bearing one - **fails if any model call ever
  declares `tools`/`tool_choice`** while the register says tool-calling is off.
  Re-opening the path from model output to a live connector is now a reviewed
  code change, not a configuration flip.

### Sanctions screening - TFS gap checklist intake: name-match procedure (PNMR/CNMR/FFR), internal watchlist, training cadence (2026-07-28)

Self-assessed the screening estate against a 36-item UAE TFS practitioner
checklist (Cabinet Decision 74/2020 context) - ~30 items pass with citable
evidence (`docs/governance/sanctions-screening-gap-checklist-2026.md`) - and
closed the three gaps it surfaced in the same change:

- **TFS name-match procedure** (`docs/aims/tfs-name-match-procedure.md`) - the
  material gap (checklist D3): a sanctions name match carries duties an
  ordinary alert does not, and the alert decision tree previously ended at
  "file STR/SAR" while the incident runbook cited a "TFS procedure" that did
  not exist. New procedure: suspend dealings **without delay** → same-day
  identifier verification → **PNMR** (potential) or **freeze + CNMR + FFR**
  (confirmed) via goAML → release only on written EOCN/FIU basis, with a §4
  TFS event log, tipping-off discipline, and the STR assessed in parallel -
  never instead. Wired in: TFS gate **1a** in the decision tree (list hits
  branch before the STR question), runbook link fixed, MLRO competency row +
  training-record topic, annual review/tabletop + training-refresh duties in
  the compliance calendar.
- **Internal firm watchlist** (checklist A4) - `data/internal-watchlist.json`
  screened by BOTH engines in addition to the official lists: supplementary
  tier in `screen.py` (added after the all-empty guard and floors so internal
  names can never satisfy a core-coverage fail-safe) and an `optional: true`
  curated source in `data/sanctions-extra.json` (JS engine). Empty is a valid
  state ("no internal designations") reported informationally - official
  lists keep the opposite fail-safe (empty = DEGRADED). Both daily narratives
  render the list's line; shape + wiring pinned by 10 new checks in
  `test/data-schema.test.js`; maintained under the EOCN SOP's new §8; hits
  route through the ordinary tree, never the TFS path.
- **Training cadence** (G1/J3) - sanctions-evasion typologies + TFS handling
  added to the competency baseline, with an annual refresh duty (also after
  material screening changes) and an internal-watchlist annual review in
  `data/compliance-calendar.json` (3 new duties).

Stated, not hidden: transaction screening stays the known R-13 feed gap;
input-side data quality accepted at current base size. Coverage matrix gains
the internal-watchlist control row and the TFS manual-assurance row.

### EU AI Act - Digital Omnibus amendment intake: assessment updated, EU watch source added (2026-07-28)

The Digital Omnibus AI amendments are now adopted law (Parliament 16 Jun 2026,
Council 29 Jun, final act signed 8 Jul; pending OJ publication) - one day after
the EU AI Act assessment was written against the original Regulation. Its §7.5
"Act evolution" re-assessment trigger fired; headline conclusions survive (not
territorially bound, not high-risk, Art. 50 disclosure implemented and
CI-asserted).

- **Assessment updated** (`docs/governance/eu-ai-act-assessment-2026.md`):
  Art. 5 sweep extended to the new ninth prohibition (NCII/CSAM generation -
  not present, text-only system); Art. 4 literacy note records the legal floor
  softening to "support the development" while **deliberately keeping the
  stricter original standard**; Art. 50(2) machine-readable-marking timing
  (2 Dec 2026, legacy) noted with the internal-use position; AI Office
  exclusive-competence note (same-provider GPAI systems - the opposite of this
  architecture); postponed high-risk dates recorded as runway in §7; dated
  assessment-log row added.
- **Watch gap closed** (`data/reg-sources.json`): §7.5 claimed Act evolution was
  watched via the regulatory-watch pipeline, but the source list contained no
  EU AI-regulation source - the Omnibus arrived via manual intake. A dedicated
  `eu-ai-act` source (Commission AI regulatory-framework page) is now
  fingerprinted daily like every other source; count references trued up
  (20 → 22 across the coverage matrix §1.4 and the stack scorecard).

### Operational AI Governance Stack - crosswalk §C, Level-4 evidence index, GovernanceScore + register review currency (2026-07-28)

Adopts the five-level *Operational AI Governance Stack* (visibility → monitoring
→ controls → evidence → continuous governance) as a third external crosswalk and
closes the two small gaps the mapping surfaced.

- **Crosswalk §C** (`docs/governance/ai-frameworks-crosswalk-2026.md`):
  level-by-level mapping, with the deliberate non-controls stated in the open
  (conversation monitoring - ephemeral by design, PDPL/data-minimisation;
  discovery/permission tooling - N/A while the estate is fully enumerated) and
  their re-trigger condition (adoption of platform-built agents).
- **Governance-evidence index**
  (`docs/governance/assurance-coverage-matrix.md` §1.10): the six Level-4
  evidence types (decision ledger, runtime evidence, override records,
  authorization chain, independent audit evidence, decision provenance) each
  mapped to the existing artefact and automated proof that satisfies it -
  monitoring says what happened; evidence proves who authorised it.
- **GovernanceScore** (`scripts/governance-report.mjs`): composite 0–100 health
  of the scored controls (pass=1, attention=0.5, fail=0; info rows excluded) in
  the daily card's title and body, with Δ against the previous report parsed
  from the task titles the idempotency listing already fetched (zero extra API
  calls). New KPI row in the coverage matrix §3.
- **Register review currency** (same script): `data/ai-assets.json` declares a
  quarterly review cadence but nothing enforced it - the daily card now carries
  a register-review row (pass / REVIEW OVERDUE past the 100-day window / fail on
  a missing or unreadable date), so an unreviewed inventory can only rot loudly.
  The schema test additionally requires a declared cadence and a parseable
  `last_reviewed` (shape only in CI - currency stays with the daily report, so
  no time-bomb tests).
- **Full five-level scorecard**
  (`docs/governance/operational-ai-governance-stack-2026.md`): tile-by-tile
  assessment in the house format of the 6-layer doc - all five levels ✅, the
  two absent tiles documented as deliberate non-controls with named re-trigger
  conditions (platform-built agents, tool/action permissions, a second
  operator). Cross-linked from the 6-layer doc, crosswalk §C and the
  governance-pack index.

### Screening accuracy hardening - measured 95% floors: benchmark corpus, shared transliteration, phonetic fold, one-way thresholds, adverse-media tiers (2026-07-28)

Six-phase programme raising the sanctions + adverse-media screening estate to
CI-enforced 95% accuracy floors, measured on a new labelled benchmark run
through **both real engines** - measurement landed first, so every phase is
falsifiable against a frozen pre-hardening baseline. All hardening is
**recall-monotone**: no change unflags, drops or suppresses anything; precision
comes from tiering and escalation weighting. Headline movement (identical on
py_rapidfuzz / py_difflib / js): sanctions recall **57.0%/62.0% → 97.5%**,
adverse-media classification **57.9%/77.3% → 100%**, repeat-signal accuracy
**50% → 100%**, hard negatives held (100% Python / 96.5% JS, documented).

- **Benchmark + frozen baseline** (`test/fixtures/screening-benchmark/`,
  `scripts/screening-benchmark.mjs`, `test/benchmark_eval.py`,
  `test/screening-benchmark.test.mjs`): 121 labelled true-equivalent pairs
  (per script group and catching mechanism), 85 hard negatives (one budgeted
  canary, n030), 114 labelled adverse headlines across 8 languages incl.
  description-only and wrong-subject cases, 6 multi-day repeat scenarios.
  Per-backend floors in `floors.json` ratchet only upward (MLRO sign-off to
  lower); the rapidfuzz backend gates in the fuzz job (real deps), the difflib
  stub in the bare test job. Governance:
  `docs/governance/screening-accuracy-benchmark.md`.
- **Shared transliteration source of truth** (`data/translit-groups.json`,
  89 disjoint groups / 267 members, loaded fail-loud by BOTH engines,
  schema-guarded by `test/translit-data.test.mjs`): closes the khaled/khalid
  class and every Cyrillic/Ukrainian romanization pair the duplicated 10-group
  in-code tables missed. Deliberate firewalls: salah≠saleh, sayed≠said,
  selim≠salim stay ungrouped. Variant cap 12→32 (`TRANSLIT_VARIANT_CAP`).
  Fail-before: khaled→khalid produced no variant pre-change.
- **Phonetic fold layer** (`phonetic_key`/`phoneticKey`, identical spec both
  engines, zero new dependencies): the model card's pinned "clears by design"
  residual - every significant token ≥2 edits off ("Muhamet Huseinn" ≈ 69) -
  now flags as a **WEAK (phonetic-only)** possible match at its real
  conservative score, never confirmed-looking. Strictly additive (property-
  tested: the layer never removes or re-scores a fuzzy hit); dedicated
  phonetic posting indexes keep blocked/unblocked screening bit-identical
  (hypothesis property extended over a multi-edit drift pool);
  `MATCH_PHONETIC` = 1 | shadow | 0. The negative-test pin is FLIPPED, with
  the kill-switch restoring the historical clear as the regression guard.
  Also: the JS engine now folds Turkish dotless ı (Kılıç ≡ Kilic - found by
  the corpus, screen.py parity).
- **One-way env-tunable thresholds + shadow challenger**: the four match
  cutoffs (85/82/97/93) are env-tunable, range-validated, and ONE-WAY -
  raising above the champion default needs the explicit `…ALLOW_RAISE=1`
  override; the champion/challenger doc's proposed 0.80 shadow run is now
  wired LOG-ONLY in both engines (`SHADOW_THRESHOLD` /
  `SCREEN_SHADOW_THRESHOLD`) - counted and logged, never a hit, case or
  delta entry.
- **Adverse media - precision without suppression**: feed descriptions
  captured and scanned alongside headlines (the largest measured recall
  loss); strong/weak keyword tiers (generic "political"/"lawsuit"/"ESG"
  headlines stay flagged for the record but need a second independent outlet
  to count toward escalation); the ≥3-stories/90-days repeat counter now
  counts DISTINCT canonical-URL fingerprints among counter-eligible entries -
  wrong-subject same-surname stories (relevance LOW) never count,
  cross-script (Arabic/Russian/Chinese) headlines are UNSCORABLE and always
  pass the relevance gate, one article re-served under rotating tracking
  params counts once, and legacy evidence entries stay eligible (no
  retroactive suppression). JS gains the stem terms its exact-word list
  missed ("sanctioned", "launder", "kickback", "guilty", "contraband" …).
  `ADVERSE_MAX_RESULTS` env (default 8, was hard-coded 5),
  `ADVERSE_LOCALES` default 5→8, source-credibility ranking tiers
  (`data/source-credibility.json` - annotation/ordering only).
- **Floors ratcheted** (`floors.json` v2): recall ≥95% with the miss budget
  capped at the 3 documented residuals per engine (triple-token drift with a
  phonetically ambiguous g/j pair; Turkish legal-form abbreviation on the
  Python min(full,core) side; two JS-only plain-Levenshtein prefix-cluster
  gaps); adverse/repeat at the achieved 100%. `test/bias_eval.py` floors
  70%→90% per group, gap 30%→10%, with new Cyrillic-expanded, CJK and
  Phonetic groups - 100% recall in all six groups under both backends, zero
  false positives.
- **One-time re-surface note**: standing subjects that now gain a phonetic or
  transliteration hit will alert once as new/changed (the conservative
  outcome, same as the audit-round precedent), bounded by the per-run case
  cap and backlog drain.
- Model cards revised (`sanctions-name-matcher.md` - residual flipped;
  `adverse-media-classifier.md` - also corrects the stale two-feed/5-locale
  description to the actual three feeds + watchlist net), `.env.example`
  knobs documented, README gains the benchmark section.

### JS engine follow-up: cleared-case reopen, fuzzy candidate blocking, empty-key dedupe (2026-07-27)

- **Cleared cases reopen on a re-flag** (owner-authorized design change - the
  old "manual reopen by design" pin is superseded): a subject re-flagged after
  its case was cleared now gets a FRESH case with an SLA restarting from the
  re-flag day, a "⚠ RE-FLAGGED AFTER CLEARANCE" banner linking the prior case
  and its cleared date, and state replaced wholesale (`reopenedFrom`/
  `reopenedAt` provenance) so aging restarts cleanly and a second clearance +
  third re-flag works identically. The daily digest resolves the subject to
  the NEW open case, not the old completed one. Rationale: the shipped config
  suppresses alerts, so the case board is the only delivery surface - a
  re-listed customer with no open case was a dropped-review risk.
- **Fuzzy candidate blocking** - the matcher's exact-token candidate index is
  now backed by trigram and prefix+length posting lists: a subject token with
  NO exact bucket admits near-tokens verified at `levenshtein ≤ 1` or
  InDel ≥ 88 ("Vladimyr Putyn" → flags at 86; "Wladimir Putin" → 93; both
  silently cleared before). Hot path unchanged within +0.8% (measured, 89k
  entries); recall-monotone; over-cap buckets used only as a last resort.
  Honest bound, pinned as a negative test: a name ≥2 edits off in every
  token still scores under the 85 gate and clears - recorded on the model
  card.
- **Empty-key dedupe** - two distinct symbol-only/unscreenable customers
  previously shared the empty normalization key and the second was dropped
  before screening; empty-normalization subjects now key on their raw name
  (collision-proof `raw:` prefix) and each surfaces its own MANUAL REVIEW row.

### Screening follow-up: case backlog, SEMA aliases, fallback matcher parity (2026-07-27)

Round two of the full-screening correctness audit - the items deferred for an
owner decision, now authorized:

- **MLRO case backlog** - items past `CASE_SUBTASK_CAP` (40/run), and items
  whose Asana subtask create failed, used to get a log line and nothing else:
  the delta engine marked them standing, so they never re-entered the case
  queue - reported once, cased never. They now ride a reserved backlog key in
  the delta state (`__meta_case_backlog__`, same pattern as the notes-budget
  key: survives pruning, persisted only on delivery) and drain on later runs
  whenever the day's NEW items leave capacity free - sanctions first, oldest
  first, with "(backlogged since …)" provenance on the case, same-name dedup
  against re-listed items, and a LOUD bound at 400 carried items.
- **Canada SEMA aliases** - `parse_canada` captured no `<Aliases>` content, so
  a party operating under a SEMA-listed a.k.a. screened clear against this
  supplementary list. Both published shapes now parse (nested `<Alias>`
  elements and flat semicolon-separated text), gated on the record carrying a
  primary name and filtered for placeholders.
- **Retired fallback workflow uses the real matcher** - the manual-dispatch
  `daily-sanctions-screen.yml` carried its own inline matcher (token_sort
  top-3, break on first hit, no core/subset/short-entry gates, no
  transliteration variants): a fallback that could clear names the daily
  engine flags, on exactly the days it would be dispatched. Its screening
  step now imports the engine and screens through `screen_name` (same gates,
  same C prefilter, placeholder `ASANA_TOKEN` at import - the step never
  calls Asana), keeps the results-file schema, surfaces unscreenable names as
  MANUAL REVIEW rows, and reserves "confirmed" for genuine exact (≥100)
  matches. Verified end-to-end offline against the in-repo EOCN list
  (exact → confirmed 100, transliteration variant → potential 96,
  Arabic-only → MANUAL REVIEW, unrelated → clear, outage degrade intact).

### JS sanctions engine: four silent-clear classes closed, unscreened days go red (2026-07-27)

The full-screening correctness audit's JS pass found the daily case engine
(`scripts/sanctions-screen.mjs` + `scripts/sanctions-match.mjs` - also the
TFS immediate-re-screen target) silently clearing four classes of subject
the Python engine flags, and passing an unscreened day as green. All fixed,
with regression tests verified to fail against the pre-fix code:

- **OFAC SDN aliases** - the JS engine loaded only `sdn.csv` primary names;
  a party operating under an SDN a.k.a. cleared. New `ofac-sdn-alt` source
  (`alt.csv`, `parseOfacAltCsv`) folds aliases into the primary list
  (`foldAliasSources`); alias-file failure marks the list `partial` - its
  standing matches are carried forward, never cleared off reduced coverage,
  and aliases are never screened alone when the primary failed.
- **Candidate blindness** - fuzzy candidates required an exact shared
  token, so routine transliteration drift ("Muhamad Husein" vs "MUHAMMAD
  HUSSEIN", similarity 87.5) was never even scored. `nameVariants` ports
  `ai.py`'s transliteration groups (shared source of truth) into
  candidate generation and scoring; `similarity()` gains a
  boilerplate-stripped core-vs-core arm ("Muhamad Hussein Trading LLC" vs
  "MUHAMMAD HUSSEIN": 46 → 94). Strictly recall-monotone. Residual,
  stated honestly: a typo outside the groups in EVERY significant token
  still finds no candidate (Python's cutoff prefilter has no such
  blindness) - recorded on the model card.
- **Token-subset names** - "Quds Force" vs the full IRGC chain (73) and
  "Usama Bin Ladin" vs the full patronymic chain (84) cleared at the 85
  bar. The Python subset gate is ported (`isTokenSubset` +
  `tokenSetRatio ≥ 93`, rapidfuzz InDel semantics via `indelRatio`),
  symmetric in both directions, recorded at the conservative score.
- **Unscreenable names** - a name folding to no distinctive tokens
  ("Yu Li", symbols-only) or carrying non-Latin-script letters the
  Latin-published lists can never match (`lostScriptLetters`, mirroring
  `screen.py:_lost_script_letters`) now routes to a **MANUAL REVIEW**
  finding instead of silently clearing; an exact or same-script curated
  match still wins. The marker alerts once, stands without re-alert spam,
  and clears the day the subject screens cleanly (`LOCAL_MARKER_LISTS`).
- **Red unscreened days** - `bailUnscreened` (Asana unreadable, no lists)
  wrote its report and exited 0: a green run the self-healing dispatcher
  would never retry and the freshness check counted as done. It now sets
  `process.exitCode = 1` after writing outputs; the issue step still fires
  (`always()`-guarded) and `control-retry` re-dispatches the day.
- **Hardening** - `SCREEN_MATCH_THRESHOLD` is validated as a fraction in
  (0,1] (copying screen.py's `85` would have set the cutoff to 8500 and
  cleared every fuzzy match - rejected loudly, default kept);
  `eocn-reconcile.yml`'s import-only step gets a placeholder
  `ASANA_TOKEN` (it never calls Asana; every prior run died on import);
  a standing sanctions match no longer loses its PEP/adverse-media
  evidence (nor fires a spurious CHANGED alert) when the enrichment
  lookup merely errored - prior evidence is carried forward.

### Screening engine: six silent-false-negative extraction/loading gaps closed (2026-07-27)

The full-screening correctness audit's pipeline pass found the engine's
matcher sound but its NAME EXTRACTION and one list-loading edge able to
clear subjects silently. All fixed, each with a regression test that fails
against the prior code:

- **Mixed-script names** - `"محمد صالح TRADING LLC"` normalizes to its Latin
  residue (`"TRADING LLC"`), which passed the old ≥4-char screenability test
  and fuzzy-matched boilerplate only, clearing the customer while the
  all-Latin transliteration of the same name hits. Any name whose letters
  are partly LOST by `normalize()` now also surfaces a MANUAL REVIEW hit
  (`_lost_script_letters`), for sanctions and for PEP (`check_pep`).
  Diacritic Latin (Müller/İnönü) folds cleanly and is not flagged.
- **Extractor either/or** - one recognised SECTION-4 block suppressed the
  regex `Name:` extractor entirely (`struct or regex`), so a `Name:` line in
  SECTION 5 or under a drifted header was never screened. Now a UNION of
  structured parse + regex extractor + owner-line individuals, deduped
  case/diacritic-insensitively (`_individuals_union`).
- **Owner lines naming non-corporate parties** - `"UBO: John Smith"` (no
  separate `Name:` line) or an unincorporated designated org
  (`"UBO: Islamic Revolutionary Guard Corps Quds Force"`) was dropped by
  BOTH extractors. New `extract_owner_individuals` screens them with
  control linkage.
- **En-dash separator** - `"UBO – Acme Holdings LLC"` (U+2013, the
  word-processor auto-conversion kyc.py already handles for its own
  headers) extracted nothing; the owner separator class now carries it.
- **Latin-only `Name:` pattern** - non-Latin `Name:` lines matched nothing,
  so those subjects bypassed extraction AND the manual-review net. The
  capture is now script-agnostic (guards unchanged), and inline commas no
  longer lose the whole line.
- **SKIP_TOKENS substring filter** - `"LLC" in "WILLCOX"` silently dropped
  real people; skip tokens now match on token boundaries only.
- **OFAC alias-only coverage** - with `sdn.csv` AND its mirror both down,
  folding `alt.csv` anyway left ~17k alias-only names - above the 9,000
  coverage floor, so the run read "OFAC SDN: OK" while every primary SDN
  name went unscreened. Aliases now fold into a LOADED primary only
  (`_fold_ofac_aliases`); an unloaded primary stays empty for the floor
  machinery to classify honestly (both load paths).
- **Legacy delivery gates** - manual-dispatch `full_batch` /
  `weekly_adverse` runs logged a failed Asana post and exited 0 (green,
  nothing delivered - the 2026-07-16 class the unified path already gates).
  Their posters now arm the same delivery gate (exit 5), and a failed
  confirmed-hit comment logs loudly instead of vanishing.

### Matcher: stale-norms guard on the prefilter cache (2026-07-27)

A full-screening correctness audit re-verified the C-side prefilter's
bit-identical claim with a 3,558-subject adversarial differential (blocking
on/off: 0 mismatches, 0 necessity violations) and found one latent defect:
`_entry_norms` caches a list's normalized names by object identity, so an
entries list mutated IN PLACE after first being screened would serve stale
norms - the prefilter would silently never survey the appended designation,
a sanctions false negative in blocked mode (probe: 0 hits blocked vs 1
unblocked). No production loader mutates a list today (every load path
builds its lists once), so no live run was affected; the cache now also
rebuilds on length change, with regression tests in the engine suite
(`_entry_norms` re-norm check) and the real-rapidfuzz property suite
(equivalence must survive in-place list growth - verified to fail against
the unguarded code).

### Matcher: exact C-side prefilter - ~6× faster screening pass, bit-identical results (2026-07-25)

The sweep scored every (subject, entry) pair in a Python loop - ~870
subjects × ~290k crime-watchlist names alone is ~250M pair evaluations
dominated by Python call overhead, a silent ~33-minute CPU grind that is
exactly the window the 24–25 Jul runner-VM deaths landed in. `screen_name`
now pre-filters each list with `rapidfuzz.process.extract` in C under two
cutoffs that the hit gates make *necessary conditions* (`token_sort_ratio ≥
THRESHOLD` for the primary and short-entry gates; `token_set_ratio ≥
TOKENSET_THRESHOLD` for the subset branch), then scores only the survivors
in the original order - so skipped pairs are exactly the pairs that could
never hit, and output is bit-identical with blocking on or off. Proven
three ways: adversarial fixtures in the engine suite, a hypothesis
equivalence property under the real rapidfuzz stack
(`test/fuzz_properties.py`), and a 100k-entry benchmark (5.8× on 2 cores,
identical hits). Degrades to the plain loop when `rapidfuzz.process` is
unavailable (the offline test stub); kill-switch `MATCH_BLOCKING=0`.

### Adverse media: Bing News RSS as an independent third news feed (2026-07-25)

Google News and GDELT meter shared runner IPs independently, and 10–14 Jul
showed both can refuse the same run - the crime watchlist kept deterministic
coverage, but fresh-story recall went to zero. `screen.py` now queries **Bing
News RSS** (free, no key, a third rate-limit pool) once per subject with the
English risk-term cluster, through the same contract as GDELT: run-global
adaptive pacing, a run-level circuit breaker (`BING_BREAKER_AFTER`, default
5), loud per-subject degradation, the shared multilingual keyword flagger,
cross-outlet dedupe, and the hardened XML parse. A subject covered only by
Bing now counts covered (no false `am_error`); zero-coverage alarms now
require all three news feeds to fail. Kill-switch `BING_NEWS=0`. Egress
allowlists for both screening workflows gain `www.bing.com:443`; engine tests
cover the parser, breaker, kill-switch, and third-net coverage semantics.

### EOCN review preparer, self-sufficient Netlify CD trigger, secret-rotation calendar (2026-07-25)

**EOCN Reconcile** (`eocn-reconcile.yml`, Mon & Thu 04:37 UTC): does the
mechanical half of the weekly EOCN review - downloads the OpenSanctions
`ae_local_terrorists` mirror, runs the daily screen's own
`crosscheck_eocn`, folds any missing designations in (exact mirror
rendering kept as an alias, the #315 pattern), stamps `lastReviewed` plus a
mirror-derived evidence note, and pushes the result to the rolling
`eocn-reconcile` branch with an Asana task linking the compare view. The
human act of opening and merging that PR records the MLRO sign-off; the
7-day review-age gate on the daily screening is deliberately untouched and
keeps enforcing if the branch is ignored. **Netlify deploy**: the
build-hook workflow gains a path-filtered `push`-to-main trigger - inert
(warn + green) until `NETLIFY_BUILD_HOOK_URL` exists, then production
re-publishes on every app-file merge independently of Netlify's broken Git
integration. **Compliance calendar**: quarterly rotation duties for
`ASANA_ACCESS_TOKEN` and `ANTHROPIC_API_KEY` (each with an end-to-end
verify step before revoking the old credential).

### Resilience hardening: repo-wide control self-healing + production-currency watchdog (2026-07-25)

Generalises the morning's screening-specific fix to the whole control estate.
**Control Retry** (`control-retry.yml`, 07:37 & 10:07 UTC): for each mandatory
daily control with no successful run today and nothing queued or running, it
fires one `workflow_dispatch` - so a transient runner death on ANY daily
control heals the same morning, before the freshness alarm. Deliberately
narrow: deterministic failures (e.g. the EOCN review-age gate) fail again on
re-dispatch and the day stays honestly red; mid-run controls are left alone;
one dispatch per control per pass. **Site Currency** (`site-currency.yml`,
08:07 UTC): compares the APP_VERSION the live site serves against HEAD of
main daily - the check whose absence let production deploys sit silently
stale from 27 Jun. Self-arming (warns-but-green while the known pre-split
outage persists), then red + Asana alert on any future drift beyond a 24h
grace. **Freshness Check** gains a second daily firing (12:09 UTC) so the
alarm re-verifies after the healing passes and its own badge recovers from a
transient same-day. License badge recolored red → steel blue (informational
label, not a status).

### Daily screening self-heals after runner deaths; Netlify production deploy path restored (2026-07-25)

The 24 and 25 Jul 00:07 UTC screening runs both died to runner-VM shutdowns
("The runner has received a shutdown signal") mid-way through the
OpenSanctions crime-watchlist pass and stayed red until manual re-runs hours
later - which also cascaded the 24 Jul Freshness Check red. The workflow now
fires a second, self-healing schedule at 03:07 UTC gated by a `preflight` job:
a no-op on days where a successful run already exists, a full sweep only when
the mandatory daily control would otherwise be missing (manual dispatches
always screen). The watchlist stage itself now streams the ~68 MB CSV through
a `TextIOWrapper` instead of decoding two extra full copies, and logs a
heartbeat every 100 subjects so the formerly-silent ~33-minute matching window
shows liveness (and any future death point) in the Actions log.

Separately: Netlify production deploys have not published since 27 Jun (no
production build triggers on main pushes; PR previews unaffected; the live
site still serves the pre-`app.js`-split bundle). The July workaround's
build-hook secret was never created. `netlify-production-deploy.yml` restores
that lever - POST the `NETLIFY_BUILD_HOOK_URL` build hook and verify the
publish reached the live site - plus `netlify-probe.yml`, a read-only
diagnostic of Netlify's commit statuses, the badge, and the served bundle.
One-time setup (Netlify UI): create a build hook for `main` and save its URL
as the `NETLIFY_BUILD_HOOK_URL` repository secret; re-linking the repository
in Build & deploy fixes push-triggered production builds permanently.

### Governance closures: breach-notification clock pinned; three sign-ready drafts (2026-07-24)

Register item 12 closed: the incident runbook now names the UAE Data Office
breach-notification clock (immediately; 72h internal ceiling pending the PDPL
Executive Regulations' final timeline; individuals without undue delay) beside
the FIU/goAML and EOCN/TFS paths, and the UAE-laws map row 9 flips to
addressed. Three decisions converted from write-from-scratch to sign-and-file:
a cross-border transfer position for counsel (register item 11), a DPO
determination paper with a minute block for the board sitting (item 13), and a
manual transaction-feed compensating control ready for MLRO adoption (item 6).
Register rows updated to point at the drafts; drift-guard figures trued
(127 docs / 110 curated).

### EOCN local list: 4 designations reconciled from the mirror; review evidence recorded (2026-07-24)

The daily run's cross-check (run 30064680613) alarmed on 4 OpenSanctions
`ae_local_terrorists` designations missing from
`data/eocn-local-terrorist-list.json` - a false-negative exposure on the TFS
freeze duty. All 4 added (Alaa Abdulrazzaq Ali Khanfurah; Bayt Al-Mal AL
Muslimeen; Hazem Mohsen Farhan; Coalition of 14 February (Bahrain)), each
keeping the exact mirror rendering as an alias so the cross-check resolves
deterministically; count 311 → 315. `lastReviewed` set to 2026-07-24 with a
`lastReviewedEvidence` note stating plainly that this reconciliation is
mirror-derived pending MLRO confirmation against the official EOCN
publication (the portal is PDF-only behind bot protection). Clears the
EOCN REVIEW OVERDUE exit-3 gate that failed the 24 Jul daily runs.

### Bank-grade model-risk & evaluation governance pack (2026-07-24)

Ten additions closing the gap between "governed AI estate" and a bank's
model-risk bar, each honest about what is live vs pending data or a human act:
an **MRM framework** with model tiering and a CBUAE MMS (2022) / SR 11-7
pillar map (`docs/governance/model-risk-management-2026.md`); a **backtesting
& outcomes-analysis protocol** with small-N guards - first cycle explicitly
blocked until ≥25 disposed cases (`backtesting-protocol-2026.md`); a one-way
**champion/challenger protocol** for the matcher threshold
(`champion-challenger-thresholds.md`); **ADR-001** recording why the operative
core is deterministic and the governed path to a first learned model
(`adr-001-deterministic-vs-learned.md`); **population-stability (PSI)
monitoring** with frozen-baseline discipline
(`docs/aims/population-stability-monitoring.md`); a **longitudinal eval
scorecard** backfilled from the real workflow-run history
(`eval-scorecard.md`); a **red-team campaign log** on top of the standing
CI corpus (`docs/aims/red-team-log.md`); the **citation-accuracy metric**
with its current exemption stated (`citation-accuracy-metric.md`); an
**operating model** (squads, RACI, MLRO delegation matrix,
`operating-model.md`); and a **cross-division use-case map**
(`docs/executive/cross-division-use-case-map.md`). The validation pack's
independence bullet now states the single-maintainer limitation plainly and
routes independent review to the Internal Audit thematic review; both README
indexes updated.

### Deep-audit fixes: screening correctness, alert integrity, workflow plumbing (2026-07-23)

A 13-area adversarially-verified audit of the whole estate. Screening
correctness: **non-Latin names no longer silently screen clear** -
`normalizeName` (and the workflow-embedded matcher's port of it) now folds to
letters/digits in any script instead of erasing Arabic/Cyrillic to an empty
key; **UK OFSI names are assembled in full** (Name 1–5 + surname, `"0"`
placeholders stripped) instead of screening the surname and given names as
separate fragments; the **OFAC mirror fallback** is checked before alt.csv
aliases fold in, so an sdn.csv outage with a live alt.csv can no longer defeat
the mirror; **EOCN counts toward the DEGRADED coverage status** like the core
list it is; two malformed EOCN entries (concatenated variants, a PDF line-wrap
split) were reshaped so their primary names actually match; the DFAT/SECO
curated fallbacks gained the `sanctions-extra.json` activation switch their
READMEs pointed at.

Alert integrity: `diffState` keeps a **coverage-stable match signature** - a
list that failed to load no longer fires a spurious "changed match" alert or
silently drops the unverified hit; the daily brief **skips routine scheduled
reports**, making ✅ ALL CLEAR reachable again; the AM/PEP daily task
distinguishes **new vs standing** hits and only claims the Regulations card
when one was actually filed; the reconcile drift card swaps `<pre>` (which
Asana's html_notes rejects) for `<code>`; `risk-backup` no longer creates a
duplicate mirror task after a transient lookup failure, and a malformed audit
row no longer 502s a whole backup.

Engine/app: non-cash transactions ≥ AED 55,000 get their **CDD-trigger alert**
(the cash-only THRESHOLD carve-out no longer exempts wires); the escalation
tool treats "none"/"n/a" in the sanctions field as no hit instead of returning
PROHIBITED; the client PII guard detects IBANs as its warning promises; advisor
telemetry buckets by local (UTC+4) day; FATF country matching folds
typographic apostrophes (Lao PDR, Côte d'Ivoire, DPRK variants); empty-payload
state decryption fixed (off-by-one); `str_dossier` reports malformed rows as
validation errors instead of crashing; Google News items with an empty
`<source/>` no longer crash the narrative builder; PEP cases only link
Wikidata for real Q-ids.

Workflows: the container publish is **dispatched explicitly from both release
workflows** (GITHUB_TOKEN release events never chain, so the `release:` trigger
alone could never fire); a failed `ls-remote` in anomaly-watch goes red instead
of silently grading frozen metrics; the function-health cron runs after
site-health as documented.

### GitHub Actions expansion: post-publication CVE watch, provenance re-verification, Dependabot auto-merge, compliance calendar (2026-07-21)

Four workflows close the estate's remaining coverage gaps. **Container Scan
(Trivy)** re-scans the published `ghcr.io` image weekly (plus on-demand
dispatch after a publish), failing on fixable HIGH/CRITICAL CVEs and filing
SARIF into code scanning - an image is at its most vulnerable months after
the build, and nothing re-checked it. **Attestation Verify** re-runs `gh attestation verify`
against `:latest` weekly, so the Sigstore provenance chain the publish
workflow creates is actually exercised end-to-end instead of trusted on
faith. **Dependabot Auto-Merge** arms GitHub auto-merge (squash) on
patch/minor/digest bumps - the owner's approval remains the trigger
(protection requires it, and each approval still feeds the Scorecard
Code-Review window); majors stay manual. Requires the new `allow_auto_merge`
repository setting (`.github/settings.yml`). **Compliance Calendar** turns
dated programme duties (annual governance-pack review, AI-awareness training
refresh, FATF plenary pre-briefs) into lead-time, due-dated Asana tasks from
the new MLRO-editable registry `data/compliance-calendar.json` - list CONTENT
was watched continuously, but calendar deadlines lived in document footers
nobody re-reads. Occurrence logic (month-end-clamped recurrence, lead window,
7-day grace tail, exact-title dedup) is pure and covered by 31 new offline
checks wired into CI; all three scheduled workflows are classified in the
freshness alarm's EXEMPT set with reasons, every new job is egress-blocked,
and the board figures / readiness-review counts are refreshed (47 → 51
workflows). First-run egress audits then tightened the allowlists the honest
way - observed-then-admitted: `get.trivy.dev` (trivy's binary installer) for
the container scan, and GitHub's own Sigstore TUF trust domain
(`tuf-repo.github.com` + its `tmaproduction` blob backend) for the
attestation verifier.

Both of today's deliveries needed a retry: even a 65,000-byte NUMERIC-ENTITY
WORST CASE was rejected by Asana's undocumented server-side accounting before
succeeding at 39,000. The budget that actually delivered is now remembered in
the delta-state (reserved key `__meta_asana_notes_budget__`, persisted only on
delivered runs, clamped on load) and reused as the next run's opening bid -
steady state becomes one API call with no rejection. A deterministic weekly
probe (+5%, capped at the documented max) re-tests headroom so detail lost to
a transient never becomes permanent, and a rejected probe falls straight back
to the known-good value; the 0.6× shrink chain down to the 12,000-byte floor
remains the universal safety net beneath everything (`notes_budget_plan`).
Ten new engine checks cover the plan, the clamp, and prune-safety of the
reserved key.

### README badges: live control signals added (2026-07-17)

Four live badges join CI / CodeQL / Scorecard / license in the README header,
each backed by a real, verifiable signal - no vanity chips: **daily screening**
(shields.io workflow-status on `weekly-adverse-media.yml@main` - the core
compliance control, green only when the last run delivered), **controls
freshness** (`freshness-check.yml@main` - the silent-failure alarm itself),
**latest release** (shields.io GitHub release), and **Netlify deploy status**
(official badge for the production site).

### The 9.0 milestone made self-enforcing: auto-filed verification on 2026-09-09 (2026-07-17)

9.0 cannot print before the Maintained age gate lifts on 2026-09-09 (repo
created 2026-06-11; the check hard-zeros any repo younger than 90 days), so
the milestone now enforces itself instead of relying on memory - the same
pattern as the quarterly methodology review:

- **`.github/workflows/scorecard-milestone.yml`** (cron 10:17 UTC, 9 Sep) +
  **`scripts/scorecard-milestone.mjs`**: files ONE Asana task carrying the
  9.0 verification checklist from
  [`scorecard-9.5-path.md`](docs/governance/scorecard-9.5-path.md) - confirm
  Maintained ≈ 10 / Branch-Protection 8 / Vulnerabilities 10 in the run
  SARIF, count reviewed changesets in the last-30 window, check the badge
  against the expected table (~8.8 with no reviews; **9.0–9.1 at ~9–10
  reviewed changesets**; 9.5–9.6 fully reviewed). Hard date guard (never
  files early, even via manual dispatch) + exact-title dedup (the yearly
  cron re-fire skips). Self-destruct note: delete the workflow after
  sign-off.
- `test/scorecard-milestone.test.mjs`: 11 offline checks on the date guard,
  dedup key, and checklist content.

### Vulnerabilities check restored to 10: justified suppression of the semgrep-venv `mcp` trio (2026-07-17)

Three GHSA advisories against `mcp` (the MCP Python SDK) landed in OSV on
2026-07-16 evening and read the Scorecard Vulnerabilities check at 7
(badge 8.1 → 7.9). All three are MCP **server-transport** flaws (tasks-feature
authorization, SSE/HTTP session hijack, WebSocket Host/Origin validation),
fixed in mcp 1.27.2/1.28.1 - but `mcp==1.23.3` sits in
`ci/semgrep-requirements.txt` only because **semgrep 1.169.0 hard-pins
`mcp==1.23.3`** (exact pin, verified from the wheel metadata; pip-compile
resolution with `mcp>=1.28.1` is impossible). The semgrep CI job is a one-shot
non-interactive scan in an egress-blocked runner that never starts an MCP
server, so the vulnerable code is unreachable - suppressed in
[`ci/osv-scanner.toml`](ci/osv-scanner.toml) under this file's standing rule
(unfixable-by-upgrade AND unreachable, reasoning written out), mirroring the
click precedent. Deleted the moment semgrep re-pins; Dependabot (`/ci`,
weekly) surfaces that automatically.

### Daily-screening delivery made unloseable: worst-case rich-text sizing, shrink-and-retry, delivery gate (2026-07-16)

Third and final round on the day's Asana delivery failures. After #269 (cap by
bytes, not characters) and #270 (cap by html-escaped bytes), the 19:56 UTC
verification run STILL got `400 Rich text value is too large` at ≤65,000
escaped bytes - Asana's server-side conversion can also entity-encode
non-ASCII code points (`→` → `&#8594;`), which `html.escape` accounting leaves
at 3 UTF-8 bytes. Worse, the run stayed GREEN while delivering nothing (no
task, no MLRO cases, delta-state not persisted), which blinds the Freshness
Check - it keys on run conclusions.

- **`_asana_notes_size` now budgets the worst case**: named-entity costs for
  HTML specials plus numeric-entity form (`&#NNNN;`) for every non-ASCII code
  point - a strict upper bound on the conversion (`≥` raw UTF-8 length,
  proven in tests), so the first attempt should always fit.
- **`post_unified_task` shrink-and-retries**: on a `400 … too large` it
  rebuilds the notes with a 40%-smaller budget (65,000 → 39,000 → … floor
  12,000) before conceding - delivery can no longer be lost to sizing, even if
  Asana's accounting changes again.
- **New delivery gate (exit 5)**: `run_unified`/`run_onboarding` now fail the
  run when the unified task was never created, so the freshness alarm and the
  Actions failure email fire instead of a silent green. Kill-switch
  `DELIVERY_HARD_FAIL=0` (mirrors `EOCN_REVIEW_HARD_FAIL`).
- `test/engine_test.py`: sizing unit checks (arrow=7, emoji=9, `&`=5,
  never-under-counts property), arrow-heavy cap regression, explicit retry
  budget, and both delivery-gate outcomes.

### Scorecard 7.7 explained + Branch-Protection raised to review-required (2026-07-16)

The README badge fell 8.1 → 7.7 on 2026-07-16 - not a regression but a
visibility event: applying live branch protection (hardening rows 1/10) made
the OpenSSF **Branch-Protection** check readable for the first time, so it
stopped erroring out of the aggregate (−1, weight excluded) and priced the
then-current single-maintainer config (0 required approvals, no code-owner
review) at **3/10**: 810 / 105 = 7.71. Verified in the run SARIFs: the
2026-07-15 18:23 UTC run has no Branch-Protection finding; every 2026-07-16
run scores it 3. [`scorecard-9.5-path.md`](docs/governance/scorecard-9.5-path.md)
had predicted the mechanism and now records the full event and updated path
(9.0 is arithmetically unreachable before the Maintained age gate lifts
~2026-09-09; ceiling today is 8.3).

- **Branch protection now requires review** (`.github/settings.yml`, applied
  automatically by the installed Settings app): `required_approving_review_count`
  0 → **1**, `require_code_owner_reviews` → **true**. Expected to lift
  Branch-Protection 3 → 6–8 (badge 7.9–8.1) on the next Scorecard run after
  merge.
- **`enforce_admins` → off, deliberately**: GitHub never counts the PR
  author's own approval and the sole code owner is the author, so with admin
  enforcement on, approvals ≥ 1 would make every owner-authored PR
  unmergeable - including the revert of the rule itself (the Settings app
  re-applies `settings.yml` on every push to `main`). The logged admin bypass
  is the documented solo merge path; bot-authored PRs (Dependabot) are to be
  **approved, not bypassed**, which also feeds the Code-Review check. Restore
  admin enforcement when a second maintainer joins.
- [`github-repository-hardening.md`](docs/governance/github-repository-hardening.md)
  §1 amended to match (approvals 1, code owners On, include-administrators Off
  with lockout rationale).

Every mechanical OpenSSF Scorecard check was already at 10 (aggregate 8.1),
so this pass hardens what the score cannot see and protects the 10s the
documented 8.5/9.5 milestones stand on
([`scorecard-9.5-path.md`](docs/governance/scorecard-9.5-path.md) now records
the explicit 8.5 routes: ~2026-09-09 automatic via the Maintained lift, or
earlier via reviewed merges).

- **zizmor now gates with a ZERO suppression baseline.** The six state-pushing
  workflows (sanctions-watch, regulatory-watch, sanctions-screen,
  onboarding-screen, weekly-adverse-media, fatf-watchdog) check out with
  `persist-credentials: false` and push their data branches through an
  ephemeral env-token URL - the `GITHUB_TOKEN` never touches `.git/config`.
  `asana-reconcile` never pushed at all (stale suppression) and is now
  credential-free too. `.github/zizmor.yml` is deleted; the only accepted
  finding left is the documented inline `dangerous-triggers` ignore in
  `labeler.yml`.
- **Write scopes moved to job level in 9 single-job workflows** (stale,
  pr-size, anomaly-watch, advisor-eval, advisor-bias-eval, asana-reconcile,
  weekly-summary, link-check, label-sync): top level is `contents: read`,
  each job declares exactly the `issues`/`pull-requests`/`actions` scopes it
  uses.
- **Egress block for the security tooling.** scorecard, workflow-lint,
  semgrep, osv-scanner and ci's fuzz job move from harden-runner egress
  `audit` to `block`, each allow-list read from its own egress-audit log;
  scorecard and dast-zap gain `disable-sudo`. Workflows that must stay on
  audit (browser CDNs, external targets, release-endpoint variance) now say
  why inline.
- **npm installs can no longer run dependency scripts**: all five `npm ci`
  invocations pass `--ignore-scripts` (browsers come from explicit
  `npx playwright install` steps), and `package.json` pins
  `packageManager: npm@10.9.7` for Corepack-reproducible tooling.
- **The self-host container now matches the edge.** BREAKING for
  self-hosters: the server runs as non-root (`USER 65532:65532`) on port
  **8080** - `docker run -p 8080:8080 …`. A new `sws.toml` serves the exact
  netlify.toml security-header set in-container (CSP with Trusted Types,
  HSTS, XFO, COOP/COEP/CORP; byte-parity locked by
  `test/security-headers.test.mjs`), `GET /health` is enabled for
  orchestrator probes, and a new path-filtered `docker-smoke` workflow
  builds the image at PR time and asserts headers/health/non-root before a
  regression can reach a release.
- **The Python screening engine gained blocking SAST invariants**: three
  ERROR-severity semgrep rules (no eval/exec, no shell-string execution -
  os.system/os.popen/subprocess `shell=True` -, no pickle) now scan
  screen/ai/agents/kyc/txn_monitor/monitoring in the semgrep gate, which
  previously covered only the JavaScript surface.

### Security & hardening (deep audit - 2026-07-14)

A full three-surface deep audit (Python engine, frontend/Netlify, CI/supply-chain)
found no new gaping hole in this already-hardened repo, but closed a coherent set
of residual gaps. Every change ships with tests; settings-only findings are
documented as maintainer actions.

- **Confidential Netlify mirrors are token-gated.** `asana-mirror` (whose
  `action:"read"` returns the **full assessment register + activity log**) and
  `risk-backup` (the risk-data override sheet) previously fell under the default
  auth mode, where a request with no `Origin` - or any browser `Origin` - passed
  without a token, so on the public URL an unauthenticated `curl` could read
  customer data (entity names, jurisdictions, outcomes). A new `dataTokenOk`
  gate (`netlify/functions/_auth.js`) requires `X-App-Token` on **every** path
  for these two endpoints whenever `APP_SHARED_TOKEN` is set (the forgeable-Origin
  exemption still used by the task-write endpoint no longer applies to them).
  No-token deployments are unchanged; `.env.example`, `README.md` and
  `SECURITY.md` now state loudly that a deployment holding **real** customer data
  must set `APP_SHARED_TOKEN` (ideally `APP_STRICT_TOKEN=1`) or use the on-device
  *tokenise (no PII)* delivery option. (`test/asana-functions.test.js` +6 checks.)
- **Session key no longer sits in localStorage in the clear.** The 1-hour
  cross-page unlock used to `exportKey` the raw AES-256-GCM key and store it
  base64 in `localStorage`, recoverable by any XSS or local read for the whole
  unlocked window. The key is now derived **non-extractable** and its CryptoKey
  object is cached in **IndexedDB**; only `{exp,seen}` metadata stays in
  localStorage. If IndexedDB is unavailable the session **fails closed**
  (passphrase re-prompt on navigation) - the key is never written to localStorage
  as a fallback - and a legacy `hsra.sess.v1` blob carrying a raw key is refused
  and scrubbed on boot. The read-only countdown chips in `console.js`/`advisor.js`
  no longer re-persist the full blob. Prevents key *exfiltration*; an active-page
  script during the unlocked window is unchanged (CSP + `esc()` remain the XSS
  defence). (`test/app.test.js` +8 checks.)
- **Hardened remote-XML parsing (billion-laughs / XXE).** The Google News RSS,
  UN Consolidated and Canada SEMA feeds went through stdlib `xml.etree`, exposed
  to entity-expansion and external-entity attacks in a malicious/MITM'd payload
  (parser-side, so egress-block does not cover it). A dependency-free
  `safe_xml_fromstring` (`screen.py`) refuses any DOCTYPE/ENTITY declaration and
  caps input size before parsing; the list parsers degrade loudly (coverage drift)
  on refusal. (`test/engine_test.py` +6 checks.)
- **Atomic state writes + diagnosable degrade (engine).** The delta-state,
  adverse-evidence and run-metrics/coverage writers now write via a temp file +
  `os.replace` (`monitoring.py` also stops calling `os.makedirs("")` on a dir-less
  path), so a crash mid-write cannot corrupt the baselines that gate the next
  run's alerting. The Google-News fetch loop now logs **why** a fetch/parse failed
  (bounded per kind) instead of swallowing it, and `kyc.load_jurisdiction_risk`
  warns loudly when its file is present-but-unreadable (vs the silent, expected
  absent-file no-op) so a risk input never vanishes without a trace.
- **Supply-chain.** `publish-container.yml` derives the provenance
  `subject-name` from `${{ github.repository }}` (the same value it builds/pushes)
  instead of a hardcoded `ghcr.io/trex0092/…`, so a fork/rename can no longer
  attest a name that isn't what was pushed. The gitleaks whole-file exemptions for
  `screen.py` and `daily-sanctions-screen.yml` were narrowed to the specific
  public Asana GIDs they contain (already covered by regex allowlist), restoring
  secret-scan coverage of those files.
- **Governance.** `docs/governance/github-repository-hardening.md` gains an
  *apply-now priority* block for the still-unticked, code-unreachable controls
  (Settings-app install so branch protection binds, `release`-environment
  reviewer, secret-scanning push protection, `v*` tag protection). SSRF on the
  config-supplied list fetch is documented as **accepted/contained** (harden-runner
  egress-block + the redirect-host drift guard) in the code-scanning triage doc.
  `SECURITY.md` fixes the stale `assets/brain-soul.js` path.

### Added (EOCN mirror cross-check - TFS drift detector, 2026-07-14)

- The **UAE Local Terrorist List** is curated as an in-repo JSON (the EOCN
  distributes updates by notification, not a machine endpoint); its failure
  mode is a STALE file - a new designation the file missed would screen
  clear, a false negative on a **freeze duty**. Every run now cross-checks
  the local list against the OpenSanctions `ae_local_terrorists` mirror and
  **alarms loudly** (coverage alarm → QA gate integrity issue → report §⑤ +
  run log) on any mirror designation missing locally, with the exact names
  and the remediation ("update `data/eocn-local-terrorist-list.json` from
  the EOCN notification; treat EOCN 'clear' as PROVISIONAL until resolved").
  The curated file remains the screening source - local-only names are never
  alarmed (the mirror may lag a de-listing), an unreachable mirror is a soft
  note (never a degraded core control), and the audit line's "screened vs N
  list names" count is unchanged (mirror names are not screened against).
  Kill-switch `EOCN_MIRROR_CROSSCHECK=0`; licensing covered by the existing
  OpenSanctions entry in `docs/aims/third-party-register.md`. 7 new offline
  engine checks (missing-designation detection, token-reorder tolerance,
  local-authority rule, soft-fail, kill-switch).

### Added (ISO/IEC 42001 mandatory-documents crosswalk, 2026-07-14)

- **`docs/aims/iso42001-mandatory-documents-index.md`** - one-page auditor
  crosswalk mapping all 33 mandatory documented-information items of
  ISO/IEC 42001:2023 (+ the 2026-focus additions: GenAI content management,
  adversarial/prompt-security controls, DPIA) to their evidence in this repo.
  Closes the three items that were enforced-but-unstated: measurable **AIMS
  objectives** (the CI/monitoring gates, stated as objectives with targets),
  the **communication process** (MLRO report → Asana, watcher issues with
  close-on-clear, transparency notice, SECURITY.md channel), and the
  **document-control procedure** (git + branch protection + CHANGELOG gate,
  stated as the controlled-documents procedure). Linked from the AIMS pack
  README as the audit entry point.

### Changed (legal framework migrated to FDL 10/2025, 2026-07-14)

- **New instrument register** `docs/research/uae-aml-legal-framework.md`: the
  six federal AML/CFT/CPF instruments (FDL 10/2025; Cabinet Resolution
  134/2025 Executive Regulations; Cabinet Decisions 109/2023 + 132/2023 on
  beneficial ownership; Cabinet Decision 74/2020 TFS; Federal Law 7/2014)
  with supersession notes, DPMS applicability, engine mapping and primary
  sources - corroborated against the official legislation portal (entry 3314),
  the CBUAE Rulebook and NAMLCFTC via the existing research trail.
- **Engine citations migrated off the repealed law**: the attestation
  (`agents.py`), STR/SAR regulatory-basis block (`ai.py`) and the report
  regulatory-basis + retention notices (`screen.py`) cited FDL 26/2021 /
  FDL 20/2018 / Cabinet 10/2019 - all repealed or superseded since
  14/10/2025 by FDL 10/2025 and Cabinet Resolution 134/2025. Retention
  notices now cite the current framework without asserting an unverified
  article number (the pre-repeal citation, FDL 26/2021 Art. 23, is kept as
  provenance). The Advisor web app already cited FDL 10/2025 - the engine
  narratives now match it.

### Changed (alert hygiene - escalate on coverage loss, report recall narrowing, 2026-07-14)

- **`counts.errors` and the `adverse_media` sustained anomaly now key on
  ACTIONABLE coverage failures** - a subject with zero adverse coverage from
  any net (`am_blackout`: news dead AND watchlist missing) or an individual
  unscreened for PEP on both sources. A news-only loss while the deterministic
  OpenSanctions watchlist stands is a *recall degradation*: still loud in the
  MLRO report (module status `DEGRADED (news)`, §② status line) and in the
  persisted `am_errors` counter, but no longer an error or an escalation.
  Rationale (supervisory alert-hygiene, cf. ECB/DORA operational-resilience
  expectations): the watchlist is the compensating control, and an escalation
  issue that can re-raise forever on a mitigated, environmental condition -
  news feeds throttling shared CI egress - trains people to ignore the alarm
  that matters. A true blackout (the compensating control ALSO missing) still
  escalates, and pre-watchlist history keeps its own honest judgment via an
  `am_errors` fallback in `monitoring._anomaly_types`/`analyze_run`.
  Scorecard ≥ 9.0 runbook (from tracking issue #228) recorded in
  `docs/governance/scorecard-9.5-path.md` so the issues tab can stay at zero.

### Fixed (screening integrity - issue #222 root causes, 2026-07-14)

- **Run metrics counted only surviving subjects** - `counts.subjects` was
  incremented only for subjects whose adverse sweep did NOT error, so on the
  14 Jul news-feed outage the denominator collapsed to 42 while the numerators
  covered the near-full book, printing impossible ratios ("error rate 2931%",
  "adverse-media errors 795/42 (1893%)"). The new pure `tally_enrichment`
  counts **every attempted subject** in `subjects` and each subject **at most
  once** in `errors` (a both-feeds failure is one degraded subject, not two
  errors - the old sum reached 1231 errors for 837 subjects), so
  `error_rate ≤ 100%` by construction and the anomaly thresholds compare true
  fractions of the book. Report header and §⑤ now show the honest counts, and
  new detail counters (`am_blackout`, `pep_errors`, `pep_mirror`, `watchlist`)
  persist per run. Semantics documented in `docs/aims/runtime-monitoring.md`.
- **PEP screening could silently zero out** - the live Wikidata lookup ran
  with no pacing and no circuit breaker: 8 workers burst the API from one
  shared runner IP, 436 lookups errored and the day's PEP count fell 4 → 0.
  `check_pep` now paces through a run-global adaptive rate gate (mirror of the
  Google News gate), opens a circuit after `PEP_BREAKER_AFTER` consecutive
  failures, sends the Wikimedia-policy User-Agent (tool + repo contact), and
  - when lookups still errored after the pool - the affected individuals are
  re-covered in one bulk pass against the **OpenSanctions consolidated PEP
  dataset** (`load_pep_mirror` / `pep_mirror_lookup`, exact-normalized index),
  provenance-marked "mirror" with the OpenSanctions entity URL as evidence.
  Kill-switch `PEP_MIRROR_FALLBACK=0`; licensing registered in
  `docs/aims/third-party-register.md` (bulk data is CC-BY-NC 4.0).
- **A news blackout meant ZERO adverse coverage** - when Google News and GDELT
  both refused the runner (10–14 Jul), 795/837 subjects finished with no
  adverse screening at all. The engine now runs a deterministic third net
  BEFORE the news sweep: the **OpenSanctions crime watchlist** (national
  wanted lists / enforcement actions), one bulk download matched locally with
  the exact sanctions matcher and thresholds. Findings are article-shaped
  with deterministic titles (delta-stable: NEW once, then STANDING), carry
  the entity URL as evidence, are excluded from the ≥3-stories/90d
  repeat-pattern counter (standing list presence is not a news story), and a
  news outage now reads "news recall narrowed - watchlist stood" instead of
  a blackout (`am_blackout` only counts subjects no net could screen).
  Kill-switch `ADVERSE_WATCHLIST=0`.
- **Onboarding snapshots poisoned the daily baselines** - `persist_run`
  dedups history by date, so a 2-subject onboarding snapshot could REPLACE
  the same day's full daily batch and drag `median_subjects` to 46.
  `monitor_run` gained `persist=` and onboarding runs no longer write
  history (they keep the absolute checks; sustained detection is the daily
  batch's job).
- **State-branch force-push race** - `weekly-adverse-media.yml` and
  `onboarding-screen.yml` both rebuild `screen-delta-state` as `<main>` + one
  data commit under DIFFERENT concurrency groups; an overlap could drop the
  other's just-persisted `run-metrics.json` (the exact file anomaly-watch
  reads). Both jobs now share one `screen-state` concurrency group
  (repo-wide, cross-workflow) - guarded by a new drift check in
  `test/screening-state.test.mjs`.
- **Alerts that never clear** - `anomaly-watch.yml` now posts a "cleared"
  comment and closes the escalation issue once the last-3-run window is
  clean (a missing/stale history reads as escalate, so the close path can
  never fire on a dead pipeline), and `link-check.yml` closes its tracking
  issue when every link resolves (both also honour `workflow_dispatch`, so a
  fix can be verified same-day). `mode=LLM` in the run log/report no longer
  overstates AI usage when the key is present but triage is gated off -
  the label now reads "LLM-standby (triage off)" (`_ai_mode_label`).

### Fixed (dead citations - issue #225, 2026-07-14)

- The five "dead" links split three ways, none a rotted citation: the UAE
  Ministry of Economy hosts (`moec.gov.ae`, `moet.gov.ae`) **block all
  datacenter/CI connections** - the canonical pages are live in a browser, so
  `scripts/link-check.mjs` gained a documented `ALLOWLIST_HOSTS` (skipped at
  probe time, never counted dead; `data/reg-sources.json` keeps `moet.gov.ae`
  as the watched source via its Internet Archive fallback); the truncated
  `www.moec.gov` in an older changelog entry is now written scheme-less so
  the checker never re-probes the known-bad URL that entry documents; the two
  deep `moet.gov.ae` research citations carry an explicit fetch note (no
  verifiable Wayback capture was reachable from the fix environment).
- `ci/osv-scanner.toml` (new): justified, documented suppression of
  PYSEC-2026-2132 / CVE-2026-7246 (`click==8.1.8` in the semgrep CI venv) -
  not remediable by upgrade (semgrep, incl. latest 1.169.0, pins
  `click~=8.1.8`) and the vulnerable `click.edit()` interactive-editor path
  is unreachable in the non-interactive CI job. Auto-heals via Dependabot
  the moment semgrep unpins. Scorecard arithmetic + the honest path to ≥9.5
  documented in `docs/governance/scorecard-9.5-path.md`;
  `docs/governance/github-repository-hardening.md` §1 now matches the LIVE
  single-maintainer branch-protection settings instead of claiming
  approvals ≥ 1.

### Fixed (screening ops - issue #222 disposition)

- **Anomaly-watch read a frozen metrics copy** - the runtime monitor read
  `data/run-metrics.json` from `main`, but the engine has persisted it on the
  `screen-delta-state` branch since `main` became push-protected; the copy on
  `main` froze at 2026-07-05 and the staleness heartbeat escalated a false
  "dead pipeline / dead cron" (issue #222) while the daily sweep was green.
  `anomaly-watch.yml` now overlays the state branch before detecting (missing
  branch = clean bootstrap fallback; failed fetch reds the job rather than
  silently regressing to stale data).
- **OFAC SDN and UN Consolidated silently screened empty** - both endpoints
  serve their files via 302 to presigned storage URLs
  (`wc2h-sls-prod-public-published.s3.us-gov-west-1.amazonaws.com` /
  `unsolprodfiles.blob.core.windows.net`); the egress-blocked screening jobs
  refused the redirect at connect time, so both core lists loaded ZERO names
  and every run reported *Sanctions DEGRADED*. The storage hosts are now
  allowlisted in `weekly-adverse-media.yml`, `onboarding-screen.yml` and
  `sanctions-screen.yml` (matching `sanctions-watch.yml`), and `screen.py`
  falls back to the OpenSanctions mirrors (`us_ofac_sdn` / `un_sc_sanctions`,
  same host that already serves EU FSF) with explicit MIRROR provenance when
  a primary yields nothing.
- **Adverse-media recall collapse under rate-limiting** - the 14-locale ×
  16-worker worldwide sweep tripped Google News' per-IP limiter (10–12 Jul:
  805/838 subjects at zero coverage, raised as `am_errors`), and a throttled
  feed was retried with zero delay (the polite pacing only ran on successes),
  keeping the limiter tripped all run; GDELT, connection-throttled from
  runner IPs, cost every subject a 20-second timeout. Defaults return to the
  proven 5 locales × 8 workers; every fetch is paced (success or failure); a
  subject whose first 4 fetches all fail transport-level stops hammering the
  feed (still degrading loudly unless GDELT covered it); and a run-level
  GDELT circuit breaker (`GDELT_BREAKER_AFTER`, default 5 consecutive hard
  failures) skips the feed for the rest of the run with one loud log line.
- **Drift guard** (`test/screening-state.test.mjs`) - asserts the state
  readers/writers all point at `screen-delta-state` and that every workflow
  allowlisting an OFAC/UN primary also allowlists its presigned storage
  host, so neither failure class can silently return.

### Added (security ops)

- **History scrub runbook** (`docs/security/history-scrub-runbook.md`) -
  owner-executable `git filter-repo` procedure that removes the
  pre-redaction data (screening-subject records, former firm name) from git
  history. Written so the document itself never contains a removed string:
  the scrub list is generated from the old history at execution time. Also
  records what a rewrite cannot fix (live state branches, old deploy
  permalinks, GitHub object cache) and the private-repo alternative.

### Added (container distribution)

- **Self-hosting container image** - `Dockerfile` (static-web-server base,
  pinned by multi-arch index digest) packages the client runtime set only;
  `publish-container.yml` builds, pushes to GHCR and provenance-attests the
  image on every release (blocked egress, GitHub-only endpoints, job-scoped
  write). Documented under *Setup → Self-host (container)* in `README.md`.
  Scorecard: the Packaging check now counts instead of being excluded.

### Changed (container distribution)

- **OpenSSF Best Practices evidence pack corrected** - `floss_license` is a
  passing-level MUST, so a proprietary project holds an *in-progress* entry
  (2/10 on CII-Best-Practices), not *passing*; the doc previously overstated
  this. Licensing decision recorded: proprietary stays (2026-07-11).

## [3.7.2] - 2026-07-11

*(Heading restored retroactively 2026-08-04 - v3.7.2 was tagged 2026-07-11
without its own section. Content per the tag's auto-generated notes: PRs #214
and #218.)*

### Added (perfection pass)

- **Meta descriptions on all three screens** - the one recurring sub-100
  Lighthouse metric (SEO 90) was the missing `meta description`; index,
  console and advisor now carry one (head-only, rendering unchanged).
- **Release provenance backfill workflow**
  (`release-provenance-backfill.yml`, manual-only, idempotent) - copies the
  existing Sigstore bundle of pre-`.intoto.jsonl` releases (v3.7.1) to the
  conventional provenance name, so every release in the Scorecard window is
  self-contained (Signed-Releases → 10).
- **OpenSSF Best Practices evidence pack**
  (`docs/governance/openssf-best-practices.md`) - maps every passing-level
  criterion to in-repo evidence so the owner's badge registration (the last
  Scorecard point requiring a human) is a copy-through.

### Added (scorecard follow-through)

- **Fuzzing the Scorecard detector actually sees.** New fast-check property
  suite `test/property-fuzz.test.js` (in ci.yml's `fuzz` job) fuzzes the two
  CommonJS security primitives behind every function call: the per-IP rate
  limiter (exact quota per window, per-IP isolation, spoofable-header
  fail-closed bucket, well-formed 429s) and the shared-token gate (off ⇒
  open, token mode gates the no-Origin path by exact match, strict mode
  ignores Origin). fast-check joins the lockfile-pinned toolchain; the
  hypothesis suite stays (Scorecard's Python detector only counts atheris,
  but the properties are valuable regardless).
- **Release provenance under its conventional name.** Both release workflows
  now also attach the Sigstore bundle as
  `hawkeye-sterling-ra-<v>.intoto.jsonl` (Scorecard's Signed-Releases
  provenance suffix) beside the `.sigstore` signature copy.

### Added (label taxonomy)

- **Full label taxonomy.** `settings.yml` now declares 32 labels: the
  issue-triage set the issue templates already referenced but that was never
  defined (`bug`, `enhancement`, `triage`, `review` - template auto-labelling
  silently failed without them - plus `question`, `duplicate`, `wontfix`) and
  a domain set (`engine`, `screening`, `advisor`, `governance`, `a11y`,
  `i18n`, `pwa`, `design`, `release`, `config`). `labeler.yml` grows matching
  path rules (20 auto-applied labels, incl. `security` and a `compliance`
  rule scoped to the firm-approved risk-baseline data files), and label-sync
  reconciles everything on merge.

## [3.7.1] - 2026-07-11

*(Heading restored retroactively 2026-08-04 - v3.7.1 was tagged 2026-07-11
without its own section; everything below through the 3.7.0 boundary shipped
in it. Exact PR list: the tag's auto-generated notes.)*

### Added / hardened (brand purge + supply-chain scoring) - v3.7.1

- **Brand initialism fully purged.** The former entity's initialism is gone
  from the tree: the production form-field class is now `.hs` (markup + CSS -
  rendering unchanged, verified against the committed visual baselines), the
  screening engine's User-Agent reads `HawkeyeSterlingCompliance/3.0`, design
  handoff assets are renamed `hs-*` (storage keys `hs_ra_*`, consts `HS_DARK_*`),
  and test labels no longer use the old shorthand. A new **brand guardrail**
  (`test/brand-guard.test.mjs`, wired into ci.yml) fails CI if any spacing/
  casing/concatenation variant of the former name ever reappears.
- **OpenSSF Scorecard hardening.**
  - *Token-Permissions*: all nine workflows that carried top-level
    `contents: write` now declare top-level `contents: read` and elevate at
    job level only (auto-release, branch-cleanup, fatf-watchdog,
    onboarding-screen, regulatory-watch, release, sanctions-screen,
    sanctions-watch, weekly-adverse-media).
  - *Pinned-Dependencies*: the semgrep and zizmor CI tools are now installed
    `--require-hashes` from `ci/semgrep-requirements.txt` /
    `ci/zizmor-requirements.txt` (pip-compile hash locks).
  - *Fuzzing*: new property-based suite `test/fuzz_properties.py`
    (hypothesis, derandomized) fuzzes the text-normalisation layer that
    fronts every sanctions/adverse-media match - normalize/_latin_fold/
    _normalize_ar/match_adverse_keywords/sha256_of invariants over arbitrary
    unicode; hypothesis is hash-locked into `ci/requirements.txt`.
  - *Signed-Releases*: release workflows now attach the Sigstore provenance
    bundle (`hawkeye-sterling-ra-<v>.sigstore`) beside the tarball + SBOM so
    releases are self-contained and machine-verifiable.
- **Security: `@playwright/test` 1.49.1 → 1.61.1** (dev-only toolchain;
  supersedes the Dependabot security PR that grouped `playwright` +
  `@playwright/test`). Visual baselines will be refreshed via the Visual
  Regression workflow's baseline mode after merge; the compare job is
  non-blocking by design.
- **APP_VERSION 3.7.1** (package.json / pyproject.toml / CITATION.cff synced;
  auto-release cuts `v3.7.1` with the new signed assets on merge).

### Added / changed (repo professionalization)

- **Committed npm toolchain.** New root `package.json` + `package-lock.json`
  pin the dev/CI tools exactly (`eslint 9.39.5`, `htmlhint 1.9.2`,
  `@playwright/test 1.49.1`, `@axe-core/playwright` / `axe-core 4.12.1` - the
  axe pair previously floated to latest in CI) and add npm scripts
  (`npm test` / `lint` / `lint:html` / `test:visual` / `test:e2e` / `sbom`).
  The app still ships **zero runtime npm dependencies**; lint/visual/
  cross-browser workflows now restore the toolchain with `npm ci`, pa11y is
  exact-pinned in `a11y.yml` (kept out of package.json so its puppeteer
  Chrome download can't break the blocked-egress lint job), and the SBOM
  generator reads package.json as its source of truth. New `npm`
  dependabot ecosystem keeps the toolchain patched (Playwright held to
  patch bumps to protect the committed visual baselines).
- **Version-sync guard.** `test/changelog.test.mjs` now asserts
  `package.json`, `pyproject.toml` and `CITATION.cff` carry the same version
  as `APP_VERSION` in `app.js` (the release tag source).
- **Contributor/editor hygiene.** New `.editorconfig`, `.gitattributes`
  (binary marks + linguist-generated for the corpus, baselines, design
  handoff and lockfile), `.nvmrc` (Node 22, same as CI) and a metadata-only
  `pyproject.toml` (Python runtime pins stay hash-locked in
  `ci/requirements.txt`).
- **README: table of contents + screenshots** of the three screens
  (`docs/screenshots/`), and npm-script instructions in README/CONTRIBUTING.
- **Personal data removed from the committed tree.** The screening-state
  seeds on `main` (`data/sanctions-screen-state.json`,
  `data/screen-delta-state.json`) are reset to empty baselines - the live
  state stays on the dedicated data branches the workflows already use - and
  test fixtures/comments now use fictional subject names.
- **Brand unification.** Internal legal-entity naming replaced with the
  public **Hawkeye Sterling** brand across engine headers, workflows, docs
  and test fixtures.

### Added / hardened (deep-test follow-up)

- **Corporate owners now get the adverse-media sweep.** `screen.py` sanctions-
  screened `entity_owners` (50%/control rule) but excluded them from the
  enrichment loop, so a designated parent's media coverage was never seen; they
  now join the sweep as `ENTITY (owner)` subjects (no PEP check - PEP status is
  a natural-person concept).
- **Deep-mode platform-timeout handling.** Netlify synchronous functions
  default to a ~10 s execution cap that only Netlify support can raise;
  Deep-mode Advisor calls can exceed it, and the resulting non-JSON 502 used to
  render as a misleading "check ANTHROPIC_API_KEY" error. The Advisor now
  detects the platform kill and says so (suggesting Balanced/Speed or the
  timeout raise); the constraint is documented in `.env.example`.
- **Cross-browser smoke now fails on `console.error` too**, not just uncaught
  exceptions - broken-but-caught code paths (failed asset decode, bad JSON) no
  longer ship silently. Service-worker registration noise on `file://` is
  excluded.
- **Sanctions Watch streak logic extracted and unit-tested.**
  `trackErrorStreaks` is now an exported pure function with tests covering
  threshold crossing, reset-on-success, the below-threshold case, and the
  unreachable entry shape the notifier depends on - this was the one alerting
  path with no test (and where the "dead list reported as changed" bug hid).
- **Small hardenings:** the AM/PEP same-day dedup now matches the date with
  boundaries ("9 Jul 2026" no longer matches inside "19 Jul 2026");
  `parse_uk`'s no-title-row fallback can no longer show a CSV column header as
  the list date; `countEntries` no longer subtracts a phantom header row for
  the headerless OFAC `sdn.csv` (registry gains `noHeader: true`).

### Fixed

- **Deep-test sweep - 23 defects fixed across every layer** (five parallel
  adversarial reviews of the app, engine, scripts and functions; every finding
  reproduced before fixing):
  - **Screening engine (`screen.py`)** - non-Latin adverse-media matching was
    case-sensitive (capitalized/all-caps Cyrillic & Greek headlines never
    matched; Turkish all-caps missed via dotless-ı casing) - now matched on the
    lower-cased headline with a diacritic-folded fallback; delta keys collapsed
    to one identical fingerprint for ALL unscreenable non-Latin subjects, so
    the 2nd+ such customer was born "standing" and never opened an MLRO case -
    empty normalizations now fall back to a hash of the NFC name; the daily
    narrative aborted (discarding sanctions results, posting nothing) when one
    subject's adverse-media sweep fully failed - now degrades loudly per
    subject; the `full_batch` path could post a green ✅ all-clear with zero
    loaded sanctions lists - the same FATAL fail-safe as `load_all_lists` now
    applies.
  - **R-09 coverage alarm was inert in production** - `data/source-coverage-state.json`
    was never restored from or committed to the `screen-delta-state` branch, so
    every run started with empty history and a silently-shrunk list could never
    alarm. Both screening workflows now persist it.
  - **QA gate false-failed forever on manual-review PEPs** - the designed
    no-Wikidata-id hand-off for non-Latin names was reported as a missing-source
    integrity violation on every run; the `review` flag now propagates and is
    exempt.
  - **Case lifecycle: carried-forward matches were auto-cleared** - a standing
    match kept when it could NOT be re-verified (enrichment error, failed list
    download, subject error) retained a stale `lastSeen`, so the case planner
    completed its Asana case with a false "not flagged" comment (and a cleared
    case never re-opens). Carry-forwards now read as still-active; regression
    tests added.
  - **Sanctions Watch reported a dead list as "content changed"** - persistent
    failure entries lacked `status`/`detail`, so the Asana card told the MLRO
    a designation list changed when it was actually unmonitored. Now rendered
    as unreachable with the streak, like Regulatory Watch.
  - **Regulatory Watch `state_dirty` was permanently true** - an unchanged
    direct fetch advances `contentAsOf` daily and the materiality projection
    didn't strip it; it does now (regression-tested).
  - **Bias eval scored API failures as levels** - a total outage exited green
    ("no unexplained divergences" without one model response) and a one-sided
    failure emitted a false bias finding; evaluation errors now fail the run
    distinctly as INCOMPLETE.
  - **Tokenised-delivery privacy (app)** - the "🔒 Asana: tokenise (no PII)"
    opt-in silently reset after every lock/unlock or reload on an encrypted
    device (key missing from `SECURE_KEYS`), and the register mirror ignored
    the opt-in entirely, shipping every entity's legal name/jurisdiction/
    activity to Asana on autosave. Both paths now honour it.
  - **RA reference burn** - every page load of a locked encrypted device
    permanently consumed one `RA-YYYYMMDD-NNN` sequence number; allocation is
    now skipped while the gate is up.
  - **Advisor race** - a slow Deep-mode response could land after a newer
    question (or after "Ask another") and render Q1's answer under Q2's
    heading; requests are now sequenced and stale responses dropped. Corrupt
    (valid-JSON-but-wrong-shape) telemetry in localStorage no longer leaves
    the Ask tab blank and dead.
  - **Persona routing** - 11 of 16 advisor personas silently fell back to the
    generic Sterling system prompt while the UI displayed the chosen
    specialist; all 16 now have server-side suffixes and Ember's suffix matches
    its UI role (PEP & adverse media).
  - **Asana functions** - a transient (429/5xx) failure updating the
    auto-backup mirror tasks created duplicates (`risk-backup`, `asana-mirror`;
    same bug class previously fixed in `asana-task`) - recreate now only on a
    genuine 404; a malformed mirror payload (e.g. `[null]`) returned 502
    "asana unreachable" instead of a 400.
  - **Strict-token mode was unusable from the browser** - the documented
    `<meta name="hsra-app-token">` mechanism didn't exist in any HTML/JS; the
    meta tag now ships on all three screens, all function calls attach
    `X-App-Token` when it is filled (the register mirror switches from
    sendBeacon to keepalive fetch to carry it), and CORS allows the header.
  - **Python modules** - `ai.py` prompt-injection screening skipped the RSS
    `date` field (now screened + wrapped) and `_ascii_fold` fragmented Turkish
    dotless-ı names ("Kılıç" → "k l c"; now folds to "kilic"); `txn_monitor.py`
    gained the two documented-but-missing typologies (CDD-trigger ≥ AED 15,000
    and repeated round-amount cash); `monitoring.py` runtime medians now always
    carry the seconds unit; `kyc.py` flags a document expiring today as
    expired.

### Security & hardening

- **AML monitoring pipeline hardening (round 3).** The ten AML/CTF monitoring
  workflows and their five Asana delivery streams:
  - **Egress lockdown completed - 10/10 on `block`.** The last two audit-mode
    jobs moved to harden-runner `egress-policy: block` with allowlists derived
    from their actual fetches: `anomaly-watch` (pure GitHub-API job) and
    `sanctions-screen` (Asana + OFAC/UN/EU/UK lists + Google News/GDELT +
    Wikidata + Interpol). A compromised dependency can no longer exfiltrate -
    any unlisted host fails loudly.
  - **Transient-failure retry on every delivery stream.** One shared policy
    (`asana-notify.mjs`): 429/5xx retried up to 3 attempts with exponential
    backoff, `Retry-After` honoured (capped 30s), other 4xx fail fast. Now used
    by the watch cards (sanctions/regulatory/advisor-eval), FATF watchdog,
    Daily Compliance Brief, governance report, the Node screener and the
    reconciliation reads - a rate-limit blip can no longer drop an alert or
    paint a control red. (`screen.py` already had this.)
  - **Re-run idempotency on alert cards.** `notifyAsana` and the watchdog's
    task creator now skip creation when an identical-name task already exists
    in the target project from the last 6 hours - a workflow re-run after a
    partial failure (e.g. the state commit failed after a successful post) can
    no longer file the same alert twice. Best-effort: if the check itself
    fails, the card still posts (losing an alert is worse than a rare
    duplicate). Pure logic unit-tested (`test/asana-notify.test.mjs`, in CI).
- **Workflow supply-chain hardening (post-audit).** From the full adversarial
  audit of all 38 GitHub Actions workflows:
  - **Egress lockdown** - the three internet-fetching jobs that hold
    `contents: write` (`onboarding-screen`, `weekly-adverse-media`,
    `regulatory-watch`) moved from harden-runner `egress-policy: audit` to
    **`block`** with explicit host allowlists derived from their actual fetch
    calls, closing the data-exfiltration path on the jobs that handle customer
    data. A missed host fails loudly, never silently.
  - **Script-injection class closed** - every `${{ steps.*.outputs.* }}` and
    free-text `${{ inputs.* }}` now crosses into `run:` shells via quoted `env:`
    (release, sanctions-watch, regulatory-watch, sanctions-screen,
    fatf-watchdog), and the watchers' `setOutput()` strips CR/LF and caps length
    before writing to `GITHUB_OUTPUT`, so a hostile value can neither become
    shell syntax nor forge extra step outputs.
  - **Function input gates completed** - all three Asana Netlify functions now
    reject non-JSON `Content-Type` (`415`) and oversized raw bodies (`413`
    before `JSON.parse`), matching the strictest of the three.
  - **Residual lockdown sweep** - the OWASP ZAP DAST image is pinned to an
    immutable `@sha256` digest; the pure-GitHub-API jobs (`stale`, `labeler`,
    `pr-size`) moved to egress `block`; and `visual.yml` was split so the
    everyday compare path runs read-only (write scopes only on the explicit
    baseline dispatch).
- **Screening fail-safes (no false all-clear).** The scheduled screening engine
  (`screen.py`, used by the onboarding + daily sweeps) now **refuses to run** -
  loudly, with a non-zero exit - when the Asana Customer Database read returns
  zero customers or when every core sanctions list (OFAC/UN/UK/EU/EOCN) fails to
  load. Previously such a run could post a green ✅ "all clear" for a customer
  base that was never actually screened; the manual `.mjs`/inline paths already
  had these guards, the active path now does too.
- **Pure-`'self'` Content-Security-Policy.** Removed `'unsafe-inline'` from both
  `script-src` and `style-src` and all third-party origins: page logic and CSS
  are external same-origin files (`app.js`/`app.css` + siblings), former inline
  `on*` handlers use event delegation, former inline styles use the CSSOM, and
  the Space Grotesk / JetBrains Mono / Manrope fonts are self-hosted under
  `assets/fonts/` (`fonts.css`). A `report-to`/`report-uri` sink
  ([`netlify/functions/csp-report.js`](netlify/functions/csp-report.js)) collects
  violations; `test/csp.test.mjs` + `test/csp-runtime.spec.mjs` guard against
  regressions (static + real-browser zero-violation checks).
- **Stricter linting.** Re-enabled `no-unused-vars`/`no-empty` and added the
  built-in injection-sink rules (`no-eval`, `no-implied-eval`, `no-new-func`,
  `no-script-url`); the app logic is now linted too.
- **Model validation.** Golden/regression set for the DPMS 0–30 scoring
  (`test/scoring-golden.test.js`) plus
  [`docs/governance/model-validation-2026.md`](docs/governance/model-validation-2026.md)
  with a quarterly MLRO sign-off log.
- **Disclosure → operational policy.** `SECURITY.md` gained a CVSS v3.1 severity
  matrix, remediation SLAs, evidence retention, and a blameless
  [post-incident template](docs/governance/incident-postmortem-template.md).
- **Tamper-evident log** appends are now serialised so concurrent events cannot
  lose an entry; **exports** carry a verifiable SHA-256 integrity envelope
  ([backup-recovery runbook](docs/governance/backup-recovery.md)).
- **Supply-chain provenance.** A CycloneDX SBOM
  ([`scripts/gen-sbom.mjs`](scripts/gen-sbom.mjs)) is generated in CI and
  attached to each release.
- **Test coverage.** Keyboard-only, print/PDF, mobile-viewport and runtime-CSP
  Playwright specs; a deterministic CSP guardrail; Lighthouse resource budgets.

### Added

- **Governance pack completion (2026-07-07)** - closes the gaps a full corpus
  audit (all 50+ governance/AIMS/model docs) found against ISO/IEC 42001, the EU
  AI Act, and lifecycle coverage:
  - **Internal Audit Programme** (`docs/aims/internal-audit.md`, ISO 42001 §9.2) -
    the missing leg of the 9.1→9.2→9.3→10.2 Check-Act loop: criteria, three-tier
    schedule (continuous automated evidence / quarterly thematic / annual
    full-system), single-maintainer independence handling (automated-evidence
    primacy, MLRO judgement, external-audit option), clause-by-clause checklist,
    findings loop into the CAPA log and management review.
  - **EU AI Act assessment** (`docs/governance/eu-ai-act-assessment-2026.md`) -
    deepens the one-line crosswalk classification into a full article-level
    assessment: territorial scope (voluntary benchmark today), provider/deployer
    role analysis incl. Anthropic as GPAI provider, honest Art. 5 and Annex III
    sweeps, Art. 50 transparency evidence (the CI-asserted on-screen notice),
    an **Art. 4 AI-literacy provision** per role recorded in competency-records,
    and **Art. 73-equivalent serious-incident clocks** wired into the incident
    runbook and mapped to the binding UAE duties (goAML/EOCN, PDPL breach).
  - **Decommissioning & retirement procedure** (`docs/aims/decommissioning.md`,
    ISO 42001 A.6 lifecycle end) - records-first archival (10-year AML retention
    survives the system), dependency-ordered switch-off incl. a self-destructing
    service worker so retired PWA clients don't boot from cache forever, key
    revocation walked from `.env.example`, vendor exit, register updates, and a
    verification checklist.
  - **Governance pack index** (`docs/governance/README.md`) - the 24-document
    pack was the only one without an index; rescues the orphaned
    `pqc-readiness.md` and `backup-recovery.md`, groups the corpus by function
    with framework refs, and is linked (with the AIMS and model-card indexes)
    from the root README. `docs/aims/README.md` gains the three missing rows
    (Anthropic DPA pack, internal audit, decommissioning).
- **Code-scanning triage executed (CA-13)** - all 46 open alerts dispositioned
  ([record](docs/security/code-scanning-triage-2026-07.md)): **10 fixed in
  code** (backslash escaping in the markdown-cell sanitizer, script/style
  end-tag regexes, two unclosed file handles in `screen.py`, dead guard in
  `lei-check.mjs`, unused locals/imports - the rapidfuzz availability probe now
  uses `importlib.util.find_spec`), **6 scoped out** via a justified CodeQL
  `paths-ignore` for `design/` mockups and `test/` fixtures, and **30
  classified for dismissal-with-reason** (by-design Scorecard posture on the
  state-committing workflows, watcher-pipeline data flows, two non-exploitable
  single-writer TOCTOU warnings). All 42 node tests + Python suites green after
  the fixes.
- **CBUAE April-2026 framework update - impact assessment**
  (`docs/research/2026-07-cbuae-april-2026-update.md`): the five communicated
  changes (standalone Proliferation Financing risk area, TBML/correspondent
  focus, continuous tech-driven transaction monitoring, FATF 5th-round Mutual
  Evaluation, inspection-readiness) mapped to this system's controls, with
  provenance caveats (primary text pending via the `uae-cbuae` reg-watch
  source) and four owned actions - incl. the **standalone PF risk assessment**
  (new gap, added to the management-review first-cycle prep) and a raised
  priority on the R-13 transaction-feed decision. Plus a global
  **AML regulators & FIUs reference directory**
  (`docs/research/aml-regulators-directory.md`) for counterparty/cross-border
  orientation, UAE bodies mapped to the watched sources.
- **Repo-hygiene & triage utilities** (both manual-only, least-privilege,
  egress-blocked to the GitHub API): `branch-cleanup.yml` deletes the 39
  verified squash-merged stale branches from issue #190 (dry-run by default;
  literal `DELETE` confirm to act; idempotent), and `alert-inventory.yml`
  enumerates every open code-scanning alert (tool, rule, severity, location)
  to the job summary - the triage list for CAPA CA-13 that the daily
  governance report only counts.
- **Schedule punctuality: all crons moved off the top of the hour.** Measured
  against fire times, GitHub's best-effort cron was running the daily
  compliance schedules 2–5 h late (e.g. Daily Screening 00:00→03:41, Daily
  Brief 07:00→11:39) - `:00` is the platform's most congested, most-delayed
  slot. All 18 top-of-hour schedules now fire at distinct odd minutes in the
  same hour (ordering preserved: screening → watchers → brief → governance
  report → freshness). This follows GitHub's own guidance and reduces -
  but cannot contractually eliminate - schedule drift; guaranteed-time
  execution would require an external dispatcher (documented option).
- **Tier-3 shared-secret gate armed** (`APP_SHARED_TOKEN` set in the Netlify
  environment). The gate ships in `_auth.js` but was dormant; with it armed, a
  request with no browser Origin (curl/bot) must present `X-App-Token`, closing
  the omit-Origin bypass of the origin allow-list. The repo's own six
  server-side callers (netlify-deploy / asana-delivery-diag verify curls,
  function-health probes) now send the site's own `Origin` header - the
  origin-guarded front door - so they work identically whether or not the gate
  is armed and need no GitHub-side secret. Takes live effect on the next
  production deploy (functions snapshot env at deploy time).
- **Branch-protection drift guard** (`test/protection-contexts.test.mjs`, in CI) -
  locks out both merge-deadlock classes fixed on 2026-07-07: every required
  status context in `.github/settings.yml` must equal a check name some workflow
  job actually reports (name mismatch → "Expected" forever), and every workflow
  carrying a required job must trigger on `pull_request` without a
  `paths`/`paths-ignore` filter (path-gated required check → non-matching PRs can
  never merge). Negative-tested against both regression classes.
- **Regression-proofing tests & gates (QA audit, 2026-07-07):**
  - **HTML asset-integrity test** (`test/asset-integrity.test.mjs`, in CI) - asserts
    every `href`/`src`, manifest icon, `sw.js` precache entry, `fonts.css` face and
    stylesheet `url()` on the three screens resolves to a shipped file, so a renamed
    or deleted asset can no longer 404 in production unnoticed.
  - **CI coverage drift guard** (`test/ci-coverage.test.mjs`, in CI) - fails if any
    `test/*.test.*` or `test/*.py` is not wired into `ci.yml`, or any `*.spec.mjs`
    is not matched by a Playwright config; new tests can no longer be silently
    orphaned in this no-runner repo.
  - **Wider link-check coverage** - `link-check.mjs` now also scans the top-level
    docs (README, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, SUPPORT, CHANGELOG), so
    a rotted README badge/link is caught too. Loopback and reserved-example
    placeholders (the README's `localhost:8000` quick-start) are skipped via a new
    `isProbeable()` helper so they aren't mis-reported as dead; unit-tested.
  - **Accessibility gate is now blocking** - the pa11y WCAG 2.1 AA audit
    (`a11y.yml`) drops `continue-on-error`; the three screens are clean, so a new
    violation fails the gate instead of merging silently.
- **Hash-locked Python dependencies** - `ci/requirements.txt` is now compiled from
  a new `ci/requirements.in` with `pip-compile --generate-hashes` (full transitive
  tree, sha256 for every artifact), and the three screening workflows install with
  `pip install --require-hashes`. A yanked-and-republished or tampered PyPI package
  at the same version can no longer be installed into the mandatory-daily screen.
  Verified with a clean `--require-hashes` install in a fresh venv.
- **Optional shared-secret endpoint gate** (`netlify/functions/_auth.js`, env
  `APP_SHARED_TOKEN`) - defence in depth for the Netlify functions. Unset by
  default (behaviour unchanged); when set, a request carrying no browser `Origin`
  (curl / server-to-server - the path that otherwise bypasses the origin guard)
  must present a matching `X-App-Token` header. The browser path stays gated by
  `Origin` (a static app cannot hold a secret). Wired into asana-task/asana-mirror/
  risk-backup/brain-soul with six regression tests; documented in `.env.example`
  and the Asana integration audit (supersedes the deferred B1 note).
- **AI-governance & cyber-financial-crime reference content** (Advisor knowledge
  expansion, `assets/super-data.js`):
  - **EU AI Act Q&A** - added to the "AI Governance, Cybersecurity & Data
    Protection" group: the four-tier classification (with the Annex III
    financial-fraud-detection carve-out for AML monitoring), the responsible-AI
    four-step adoption framework (Qualify → Classify → Risk-assess → Mitigate),
    and the transparency / human-oversight obligations (AI Act Art. 14 & 50).
  - **"Cybersecurity Terms (AML Context)" glossary group** - ten terms
    (Ransomware, BEC/phishing, deepfake & synthetic-identity fraud, threat
    intelligence, Zero Trust, SIEM, SOAR, SBOM/supply-chain, DLP/DSPM, prompt
    injection & agentic-AI risk), each defined *and* tied to why it matters to an
    MLRO, with citations.
  - **"AI Act Classifier" Super Tool** - a deterministic playbook that tiers an
    AI use under the AI Act and maps the resulting obligations, feeding the AI
    asset register (`data/ai-assets.json`).
  - **Post-Quantum readiness** - one "harvest-now-decrypt-later" Q&A plus
    [`docs/governance/pqc-readiness.md`](docs/governance/pqc-readiness.md): a
    crypto-agility watch item scoping this tool's (low) quantum exposure.
  - **Security tooling reference** - [`docs/security/tooling-reference.md`](docs/security/tooling-reference.md)
    honestly maps common free security tools to this repo's real attack surface
    (what is already in CI vs. what is not applicable to a static-site +
    serverless app).
  - The Advisor full-surface smoke test counts were updated to 60 groups / 350
    Q&A subjects / 187 tools (`test/advisor-smoke.test.js`).
- **Enterprise documentation package** (executive readiness follow-through):
  - **Executive layer** (`docs/executive/`) - brief, business value/ROI,
    regulatory-readiness pack (regulator-question → artefact map + EU AI Act
    positioning), roadmap, KPI dashboard spec.
  - **Model cards** (`docs/models/`) - one per AI/analytic feature (scoring
    engine, sanctions matcher, adverse-media classifier, PEP identifier, Advisor
    LLM, AI triage) on a fixed 14-field template, grounded in the code.
  - **Architecture diagrams** (`docs/architecture/`) - Mermaid set: system
    context, trust boundaries, risk-assessment swimlane, screening workflow,
    scoring decision flow, audit-trail flow, user journey.
  - **User/admin/API guides** (`docs/user-guides/`, `docs/api/`) - analyst,
    reviewer/MLRO and administrator guides plus the Netlify function contracts.
  - **Demo pack** (`docs/demo/`) - 10-minute demo script, four scenarios,
    fictional sample data.
  - **Independent enterprise-readiness review** (`docs/governance/enterprise-readiness-review-2026.md`)
    scoring the repo against ISO 42001, NIST AI RMF, EU AI Act, COSO, ISO 31000,
    FATF RBA, Wolfsberg and GDPR/PDPL.
  - **AI risk register reformatted to a 5×5 L×I model** with a residual heat map
    and three new rows (vendor failure, regulatory non-compliance, key-person
    dependency).
- **Adverse media to full strength (5 upgrades).**
  - **GDELT second source** - the daily engine (`screen.py`) now queries the
    GDELT DOC 2.0 global index (100+ languages, machine-translated) alongside
    Google News, so adverse coverage never depends on a single feed; a GDELT
    outage is logged, never silent.
  - **Arabic risk-term pass** - a dedicated AE:ar query using a curated Arabic
    keyword set (`ADVERSE_KEYWORDS_AR`, mapped to English equivalents so
    typology bucketing stays uniform) closes the recall gap where Arabic-only
    press never mentions the English terms.
  - **Committed evidence log** - every flagged headline (subject, source, URL,
    typology, date) is appended to `data/adverse-media-evidence.json`
    (400-day retention, committed by the screening workflows): an
    examiner-ready adverse-media history.
  - **Repeat-pattern escalation** - ≥3 distinct stories on the same subject
    inside 90 days is surfaced in the daily report (⚠ REPEAT ADVERSE-MEDIA
    PATTERN → EDD + STR assessment) and the run log.
  - **Sustained-degradation escalation** - a new `adverse_media` anomaly class
    (`monitoring.py`, >25% of subjects losing their adverse-media pass) feeds
    the existing Anomaly Watch: three consecutive degraded runs auto-open an
    MLRO issue, so a quiet feed outage can never hide.
  - **Quarterly methodology review, self-enforcing** - `quarterly-review.yml`
    files one Asana task per quarter (keywords, typologies, sources,
    thresholds, evidence-log sample, false-positive sample; two-week due date)
    in *Adverse Media & PEP Monitoring*; idempotent by quarter-unique title.
  - All pure logic unit-tested offline (12 new engine checks + 7 quarterly
    checks, wired into CI).
- **Daily AI Governance & Platform Report** (`governance-report.yml` +
  `scripts/governance-report.mjs`): one Asana task each morning in Ongoing
  Monitoring (section *AI & Platform Governance*) rolling up the latest state of
  the entire non-AML control suite - AI/advisor governance, security &
  supply-chain scans, CI/code quality, app/site health, release/repo hygiene
  (25 controls) - plus open code-scanning/Dependabot alert counts. Sibling of
  the Daily Compliance Brief: daily operating-effectiveness evidence for
  ISO/IEC 42001 A.6/A.8 and NIST AI RMF MEASURE/MANAGE. Scheduled controls that
  silently stop running are flagged **STALE** (the same "silence is never
  evidence" fail-safe as the screening engine); idempotent (one report per
  day); fully unit-tested offline (`test/governance-report.test.mjs`).
- **Assurance Coverage Matrix**
  ([`docs/governance/assurance-coverage-matrix.md`](docs/governance/assurance-coverage-matrix.md)):
  a single examiner-facing page mapping every claimed control to its automated
  proof (workflow/test), run frequency, and evidence location - plus a KPI
  catalog, the manual-assurance cadence (including a new **annual manual
  penetration test**), and an explicit known-gaps register so nothing is claimed
  without a verification path.
- **Asana integration - capability + hardening follow-up.** Building on the
  delivery-reliability audit ([`docs/asana-integration-audit.md`](docs/asana-integration-audit.md)):
  - **Native custom fields** - a completed assessment can populate real Asana
    custom fields (Reference / Risk Tier / Score / Next Review) via env-configured
    GIDs (`ASANA_CF_*`), applied best-effort so a bad GID never loses a delivery.
  - **External-ID idempotency** - each task is stamped with `external.gid = <ref>`
    and looked up by it (O(1)), a stable key that survives re-scores.
  - **Weekly reconciliation** - `scripts/asana-reconcile.mjs` + an Asana
    Reconciliation workflow diff the register mirror against live tasks (delivery
    gaps / orphans / mismatches / duplicates) and file a **PII-free** card, with a
    GitHub-issue fallback.
  - **Tokenised delivery mode** - a per-device toggle that keeps customer/staff
    PII on the device and sends Asana only reference, tier, score and dates.
  - **Register delivery-status chip** - each row shows `ASANA ✓ / ✗ / …`.
  - **429 auto-retry** with bounded backoff (5xx is never retried, so a create is
    never duplicated) and **`Content-Type` strictness** (non-JSON → `415`).
- **Progressive Web App (offline-capable):** a `manifest.webmanifest`, a
  network-first [service worker](sw.js) that precaches only the static app shell
  (never API responses or on-device risk data), and dependency-free PNG icons
  generated from the SVG (`scripts/gen-icons.mjs`). The three command-center
  screens install and run offline without changing the privacy posture.
- **Batch screening:** paste or upload a CSV of counterparties and score the
  whole list against the risk engine in one pass, exporting the results as CSV
  (in-app modal; pure helpers `batchParseCsv`/`scoreBatch`/`batchToCsv`).
- **UBO / ownership graph:** the principals field renders an at-a-glance
  beneficial-owner / controller / director graph in the sidebar.
- **Review scheduler:** the register summarises upcoming and overdue reviews
  (overdue flagged red, due-within-a-month amber) with at-a-glance counts.
- **Bilingual UI (English / العربية):** a language toggle with full RTL support
  across all three screens and JS-rendered content, persisted in `localStorage`
  (`hsra.lang`). Long-form legal/narrative report text intentionally stays
  English-only (the authoritative language for filed records) - see
  [`docs/i18n-ar-legal-review.md`](docs/i18n-ar-legal-review.md).
- **GLEIF LEI verification (opt-in):** confirm an organisation's Legal Entity
  Identifier, jurisdiction and registration status against the free GLEIF API
  (ISO 17442 / 7064 MOD 97-10 checksum; `scripts/lei-check.mjs`). A verification
  signal, never a risk hit - a non-match is "no LEI corroboration", not assurance.
- **Threat-intelligence enrichment (opt-in):** screen a subject against a
  STIX 2.1 bundle (OpenCTI / MISP / TAXII export) of threat-actors, intrusion-sets
  and identities (`scripts/threat-intel.mjs`); supplementary "must verify", never
  an authoritative designation.
- **Dependency-free XLSX reader** in `scripts/sanctions-match.mjs` (ZIP +
  sharedStrings + first-worksheet walk via `node:zlib`) plus a dedicated SECO
  XML parser, so the engine can ingest lists published only as `.xlsx` or in
  SECO's nested `<name>/<name-part>/<value>` shape. Both parsers are unit-tested.
  The Switzerland (SECO) and Australia (DFAT) sources are **configured but
  disabled** in `data/sanctions-extra.json`: a live screen showed SECO's `.xhtml`
  endpoint returns an HTML wrapper (0 names) and DFAT's file 404s to automated
  fetches (browser/bot-gated). They will be enabled once a verified
  machine-readable endpoint is confirmed on the runner - until then they stay off
  rather than leave the screen permanently flagged "degraded".
- **Cybersecurity Skills plugin:** pre-registers the Apache-2.0
  [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)
  library as a Claude Code plugin ([`.claude/settings.json`](.claude/settings.json));
  see [`docs/cybersecurity-skills.md`](docs/cybersecurity-skills.md) and the
  MITRE F3 typology mapping in [`docs/fraud-f3-mapping.md`](docs/fraud-f3-mapping.md).
- **Repository hardening (supply chain):** every GitHub Action is now pinned to a
  verified commit SHA (with a `# vX` comment so Dependabot still tracks updates);
  added an [OpenSSF Scorecard](.github/workflows/scorecard.yml) workflow and a
  `step-security/harden-runner` egress audit on all secret-bearing workflows.
- **Community-health files:** `LICENSE` (proprietary), `SECURITY.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `CITATION.cff`,
  `.github/CODEOWNERS`, a pull-request template, and issue templates
  (bug, feature, compliance review).

### Changed

- **"Regulations / Governance / Sanctions" merged into "Ongoing Monitoring".**
  The standalone watcher-alert project was consolidated: its 34 tasks moved into
  three new Ongoing Monitoring sections (*Regulatory changes* / *FATF list moves*
  / *Sanctions updates*) and the old project was removed. Every workflow and
  script that wrote to it (`sanctions-watch`, `regulatory-watch`, `fatf-watchdog`,
  `advisor-eval`, `daily-brief`, `asana-reconcile`, `sanctions-screen` alerts) now
  targets Ongoing Monitoring - via the `ASANA_REG_PROJECT_GID` /
  `ASANA_*_SECTION_GID` repo variables, with matching code defaults - so all
  monitoring output lives in one project. Comments and step names across the
  workflows/scripts were updated to the new project names.
- **Asana delivery target moved to the dedicated "HAWKEYE STERLING APP" project**
  (`1216203370612914`). The default project GID for the delivery functions and the
  scripts that default to the risk-assessments project (`asana-task`,
  `asana-mirror`, `risk-backup`, `asana-alert`, `asana-reconcile`, `fatf-watchdog`
  digest, `daily-brief`) now points there instead of the old per-entity Madison
  project. Set `ASANA_PROJECT_GID` in Netlify (functions) - and, if the GitHub
  Actions watchers should target it too, as the `ASANA_PROJECT_GID` repo variable.
- Dependabot now groups GitHub Actions updates into a single weekly PR.
- `codeql.yml` gained an explicit top-level least-privilege `permissions` block.

### Removed

- **"Monitoring Run Log" and "Transaction Monitoring Alerts" streams removed**
  from the Node screener (`scripts/sanctions-screen.mjs`): the per-run
  "Screening Run" log task, the auto-seeded ⚙ Transaction Monitoring alert
  template and their two auto-created Ongoing Monitoring sections no longer
  exist (the `ASANA_OM_LOG_SECTION_GID` override is gone with them). The daily
  Adverse Media & PEP audit task, the sanctions match alerts and the unified
  daily screen are unchanged - run evidence lives in the GitHub Actions run
  history and the Screening Daily Report section.

### Fixed

- **Stale governance claims corrected (2026-07-07).** The gap-analysis note
  saying "BIAS testing and the DPIA remain open" now records both as closed
  (advisor-bias-review + CI recall-parity test; dpia-2026.md), and the
  assurance-coverage-matrix known-gaps row for "await ratification signatures"
  records the 2026-07-02 ratification of the AI Policy and Stakeholder Impact
  Assessment. Docs must never claim a gap that reality has closed - or vice versa.
- **Required-check deadlock on non-code PRs.** `Dependency Review` and the
  Cross-Browser `smoke` job are REQUIRED statuses in branch protection but were
  path-gated, so any PR that touched only docs/tests/workflows waited on them
  forever ("Expected - waiting for status to be reported") and could never
  merge. Both now run on every pull request: dependency-review passes in
  seconds on an empty manifest diff, and the smoke always exercises the three
  committed screens, so the always-run is cheap and meaningful. The push
  trigger keeps its paths filter (nothing gates on push).
- **Required-context name mismatch.** Branch protection requires the status
  context `Dependency Review`, but the workflow's job reported its check as the
  job id (`review`), so the required slot stayed "Expected" even after the
  workflow passed. The job now carries `name: Dependency Review`, and
  `settings.yml` documents that each required context must equal the reporting
  job's display name.
- **Unmergeable-by-design review rule on a single-maintainer repo.**
  `settings.yml` required 1 approving review plus a code-owner review with
  `enforce_admins: true` - but GitHub never counts the PR author's own
  approval, and the sole code owner IS the only human with write access, so
  every owner-authored PR was permanently blocked with no admin bypass.
  Config-as-code now sets `required_approving_review_count: 0` and
  `require_code_owner_reviews: false` with the rationale inline (the binding
  controls are the required status checks); raise both back when a second
  maintainer joins. The live rule must be mirrored by hand in Settings →
  Branches if the Settings app is not installed.
- **QA audit (2026-07-07):** Corrected a truncated citation URL in
  `docs/research/auto/REG-UPDATE-2026-06-30.md` - the UAE Ministry of Economy AML
  page was cited with the truncated domain `www.moec.gov` (does not resolve;
  written scheme-less here so the link checker never re-probes the known-bad
  truncation this entry documents). Restored the canonical
  `https://www.moec.gov.ae/en/anti-money-laundering` already used in
  `data/reg-sources.json` and every sibling reg-watch doc, clearing the sole dead
  link the citation-health gate reported.
- **Deep bug hunt (2026-07-02):**
  - The re-run dedup window (was 48h) could silently suppress a *legitimate*
    next-day alert whose title repeats (daily watchers run 24h apart and titles
    like "Sanctions Watch - 1 list change" or the advisor regression alert are
    not date-stamped). Window reduced to **6h** - re-run idempotency preserved,
    daily alerts always survive; regression-tested.
  - The daily governance report classified a **failed** run that was also stale
    as ⚠ STALE (amber) instead of ❌ FAIL - staleness can no longer soften a red
    control; regression-tested.
  - The shared Asana client now retries **network-level** failures
    (reset/DNS/TLS) with the same bounded backoff as 429/5xx - previously only
    HTTP errors were retried and a single network blip killed the delivery.

- **Asana delivery reliability (source-level audit).** An adversarially-verified
  audit of the Asana integration ([`docs/asana-integration-audit.md`](docs/asana-integration-audit.md))
  found and fixed duplicate-task and lost-update paths and improved failure
  visibility:
  - **No more cross-device duplicates.** A completed assessment is now deduped in
    Asana by its stable **reference** (`findTaskByRef`), not by the whole task
    name - the name embeds the mutable outcome+score, so a re-scored assessment
    re-completed on another device used to create a second task.
  - **Transient failures no longer duplicate.** A failed task update only recreates
    on a genuine `404`; a `429`/`5xx`/auth failure now surfaces the status so the
    client retries the same reference instead of creating a duplicate.
  - **No lost updates.** The 60s dedup cache key now includes a hash of the
    notes + due date, so an edited re-submit is written through rather than masked
    by a stale cached result. Identical double-clicks still dedup.
  - **Delivery is auditable.** Every delivery outcome is recorded in the
    tamper-evident Activity Log (`asana.delivery.ok` / `asana.delivery.failed`),
    and the Retry control now surfaces and flushes **all** pending failed
    deliveries, not just the current assessment's.
  - **`asana-mirror` read surfaces token failure.** An expired token (`401`) now
    returns `401 "rotate ASANA_ACCESS_TOKEN"` instead of an empty-but-successful
    register that read as "no backups yet".
  - **Hardening.** Guarded created-task ids against malformed `2xx` bodies (clear
    error, not a masked `502`); capped the mirror's request body, item count and
    field lengths before normalization; and made `ensureSection` converge on a
    concurrent create instead of duplicating a section.

## [3.7.0] - 2026-06-26

Baseline release at the time this changelog was introduced. See the
[releases page](https://github.com/trex0092/HAWKEYE-STERLING-RA/releases) for
auto-generated notes on prior versions.

[Unreleased]: https://github.com/trex0092/HAWKEYE-STERLING-RA/compare/v3.7.0...HEAD
[3.7.0]: https://github.com/trex0092/HAWKEYE-STERLING-RA/releases/tag/v3.7.0
