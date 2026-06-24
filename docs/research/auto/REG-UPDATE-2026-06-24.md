# Regulatory update proposal — 2026-06-24

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The extracted text is almost entirely site navigation/chrome (menus, headers, ministry sections) with no substantive AML/CFT content visible. Notably, the page reflects the rebranded "Ministry of Economy and Tourism" (وزارة الاقتصاد والسياحة) naming. No specific AML article numbers, circulars, or guidance text are present in the extract. This looks like routine site churn / navigation re-rendering rather than a substantive AML policy change.

- **Likely app impact**: Low likelihood of needing content changes based on this extract alone. Possible touchpoints to verify only if confirmed by a fuller capture:
  - Regulatory Q&A topics referencing the MoE as DNFBP/DPMS supervisor — confirm the supervisor name/branding ("Ministry of Economy" vs. "Ministry of Economy and Tourism") in `assets/super-data.js`.
  - Super Tools citations pointing to the MoE AML page — verify the URL still resolves and the label is current.
  - goAML registration references (the menu lists "التسجيل في نظام goAML" / Targeted Financial Sanctions) — no change indicated, but worth a spot-check.
  - No country/risk data in `index.html` is implicated by this extract.

- **Suggested citation**: If an update is warranted, cite generically as **UAE Ministry of Economy — Anti-Money Laundering (DNFBP/DPMS supervision)**, URL: https://www.moec.gov.ae/en/anti-money-laundering. Do not attach any specific decision/circular number, as none is visible in the extracted text.

**Reviewer note**: Recommend re-extracting the page with JavaScript-rendered content (or the English AML landing page directly) before any edit; current extract is insufficient to confirm a substantive change.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - No substantive content change is evident. The page reflects a "website last updated" date of **9 February 2024**, with most listed publications/MOUs dating from 2019–2022 (no new items).
  - A footer copyright year of **© 2026** is present, but this is a boilerplate/templating artifact and not a meaningful content update.
  - Overall this looks like **routine site churn / re-extraction noise** (navigation, search scaffolding, RSS/subscribe widgets), not a regulatory change.

- **Likely app impact**:
  - **Low / likely none.** No new STR/goAML reporting obligations, typologies, or guidance are visible that would require edits.
  - If verifying live, check Regulatory Q&A topics on **STR/SAR reporting via goAML**, **reporting entity registration**, and **FIU role/mandate** for currency — but no trigger to change them based on this extract.
  - Super Tools citations in `assets/super-data.js` referencing the FIU homepage URL or "last updated" date could be refreshed only if they assert a specific date.
  - No country/risk data changes for `index.html` (UAE risk profile unaffected by this extract).

- **Suggested citation**:
  - If a citation refresh is warranted, cite: **UAE Financial Intelligence Unit (FIU) — goAML portal / homepage**, https://www.uaefiu.gov.ae/en/ (page last updated 9 February 2024).
  - For STR-specific content, prefer the FIU's **"STR Process"** and **"Reporting Entities"** pages over the homepage. Do **not** cite specific article/circular numbers — none are visible in this text.

**Reviewer note:** Recommend no action pending human confirmation; treat as routine churn unless live review shows new publications or guidance.

### US OFAC — Recent Actions
- **What appears to have changed**:
  - The Recent Actions feed shows new dated entries through June 23, 2026, including transnational criminal organizations (TCO) designations, Cuba and Russia-related designations/removals, multiple counter terrorism designations, Iran and Venezuela-related general licenses, and a published OFAC–OFSI comparative overview.
  - Total result count stands at 3,113 — consistent with ongoing routine SDN/Consolidated list churn plus a few notable items (TCO GL issuance, OFAC–OFSI comparative overview).
  - No single structural change to the page; this is primarily routine recurring update activity with a few new guidance/GL items worth noting.

- **Likely app impact**:
  - **Regulatory Q&A topics** referencing OFAC sanctions screening obligations may need a freshness check (designations through June 2026) — confirm we still point users to the live SDN/Consolidated lists rather than static names.
  - **Super Tools citations in assets/super-data.js**: review any OFAC sanctions-list or screening-source citations to ensure the "Recent Actions" / SDN / Consolidated list references and dates are current.
  - **Country/risk data in index.html**: low impact, but Iran, Venezuela, Cuba, Russia, and DRC entries may warrant a review given new designations and general licenses — verify any country-risk notes still align.
  - Note: OFAC is a US (non-UAE) source; relevance is for cross-border screening context, not a UAE local-list update.

- **Suggested citation**:
  - US Department of the Treasury, Office of Foreign Assets Control (OFAC) — *Recent Actions*, entry dated June 23, 2026 (TCO designations; Cuba designations; Russia-related removals; issuance of TCO-related general license; OFAC–OFSI comparative overview), https://ofac.treasury.gov/recent-actions. Cite specific program/GL only after confirming exact instrument numbers on the linked detail pages (not visible in extracted text).

### EU — Financial Sanctions

- **What appears to have changed**: The extracted text is the EU Commission's standard "Sanctions (restrictive measures)" landing page — navigation menus, section headers, and general descriptions of sanctions as a CFSP tool. No specific new sanctions regime, listing, or instrument is visible in the truncated content. This appears to be routine site/navigation churn rather than a substantive regulatory update.

- **Likely app impact**: Likely minimal at this stage. If verified as substantive, potential touchpoints would be:
  - Regulatory Q&A topics covering international/EU sanctions screening obligations and cross-referencing UAE-listed designations against EU lists.
  - Super Tools citations in `assets/super-data.js` referencing EU sanctions sources or links to the EU sanctions overview page.
  - Country/risk data in `index.html` only if a specific new EU regime or designation (e.g., a sanctioned jurisdiction) were confirmed — none is visible here.

- **Suggested citation**: If an update is warranted, cite the page generically as **EU — Sanctions (Restrictive Measures), European Commission** (https://finance.ec.europa.eu/eu-and-world/sanctions-restrictive-measures_en). Do not attach any regulation or implementing-act number, as none is present in the extracted text.

**Reviewer note**: Recommend no change pending confirmation of a substantive update. Suggest re-checking the linked EU Sanctions Map / consolidated list for the actual designation changes, since this landing page itself is not the authoritative source for listing-level data.

### Responsible Jewellery Council (RJC)

- **What appears to have changed**:
  - Page now references the **2026 AGM** (new officer/board appointments) and a **2026 Annual Progress Report**, indicating a content refresh to the latest governance/reporting cycle.
  - A **"Standards & Audit Changes Information Pack"** is highlighted, suggesting updates to standards, audit, and certification requirements (specifics not visible in extracted text).
  - Membership count referenced as having reached **2,000+ members**; remainder appears to be routine site churn (navigation, member directory listings).

- **Likely app impact**:
  - **Super Tools citations (assets/super-data.js)**: Any reference to RJC's Code of Practices (CoP), Chain of Custody (CoC), or Laboratory Grown Material Standard (LGMS) used in DPMS/precious metals & stones dealer due-diligence guidance may need version/date review given the flagged standards & audit changes.
  - **Regulatory Q&A topics**: Answers covering responsible sourcing / supply-chain due diligence for DNFBPs (jewellers, dealers in precious metals and stones) referencing RJC certification should be checked for currency.
  - **Country/risk data (index.html)**: Low/no direct impact — UAE is not specifically broken out in the extracted member directory, and these are membership counts, not risk indicators. No country-risk update warranted on this basis.

- **Suggested citation**:
  - Responsible Jewellery Council — *Standards & Audit Changes Information Pack* (referenced on homepage), and/or RJC *Code of Practices*, *Chain of Custody Standard*, and *Laboratory Grown Material Standard* (current editions). Exact version numbers/dates not visible in extracted text — **confirm on source before citing.**

*Note: This is a proposal for reviewer (MLRO) assessment. The substantive standards/audit changes are referenced but not detailed in the extracted text; recommend pulling the linked information pack to confirm whether an app update is warranted versus routine refres
