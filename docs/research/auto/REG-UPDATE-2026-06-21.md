# Regulatory update proposal — 2026-06-21

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**:
  - The extracted content is almost entirely site-wide navigation/menu chrome (Arabic), now reflecting the ministry's combined "Economy and Tourism" branding ("وزارة الاقتصاد والسياحة"). No substantive AML/CFT page body text was captured in this extract.
  - Visible AML-relevant menu labels persist: "مواجهة غسل الأموال وتمويل الإرهاب" (Combating ML/TF), "العقوبات المالية المستهدفة" (Targeted Financial Sanctions), "التسجيل في نظام goAML" (goAML registration), and "تشريعات مواجهة جرائم غسل الاموال" (AML legislation).
  - This looks consistent with **routine site churn / navigation restructure** (rebranding + menu reshuffle) rather than a confirmed substantive AML policy change. The truncated extract does not let us confirm a new instrument.

- **Likely app impact**:
  - **Low / verification-only**, pending a full page-body re-check. If anything, update the MoE supervisor description in Regulatory Q&A to reflect the "Ministry of Economy and Tourism" naming.
  - Re-verify MoE-related citations in `assets/super-data.js`: goAML registration references for DNFBPs/DPMS, Targeted Financial Sanctions obligations, and any AML legislation links pointing to this URL (confirm the link still resolves to live AML content).
  - No clear trigger to change country/risk data in `index.html`. UAE risk scoring/lists appear unaffected by this extract.

- **Suggested citation**:
  - UAE Ministry of Economy — "مواجهة غسل الأموال وتمويل الإرهاب" (Combating Money Laundering and Terrorism Financing), AML/CFT supervisory page for DNFBPs/DPMS, https://u.ae/en/information-and-services/business/combatting-money-laundering (accessed [date]).

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - No substantive content change is evident. The "website last updated" date (9 February 2024) and "last updated" stamp on the About Us section both predate the current crawl, while the visible "what's new" items are old (2019–2022).
  - The only forward-dated element is a footer copyright reading "© 2026," which is likely a templated/auto-incremented value rather than a content update.
  - Assessment: this looks like **routine site churn** (dynamic visitor counter, templated footer year), not a material regulatory change.

- **Likely app impact**:
  - **Low / none.** No new STR/goAML reporting obligations, typologies, or guidance are visible in this extract.
  - If our Regulatory Q&A references FIU reporting channels (goAML registration, STR/SAR submission process, RFI process), no update is needed based on this text — those processes are referenced but unchanged.
  - Super Tools citations in `assets/super-data.js` pointing to the FIU homepage or goAML portal can remain as-is; only verify the URL still resolves.
  - Country/risk data in `index.html` (UAE entries) requires no change from this snapshot.

- **Suggested citation**:
  - No update warranted at this time. If a citation refresh is ever needed for the FIU landing/goAML reference, cite: **UAE Financial Intelligence Unit (FIU) — goAML portal**, https://www.uaefiu.gov.ae/en/ (page last updated 9 February 2024).
  - **Recommendation:** No action; re-monitor. Flag for review only if "what's new," publications, or STR-process pages show a newer dated item.

### Dubai Virtual Assets Regulatory Authority (VARA)

- **What appears to have changed**:
  - Two new items appear in the News & Announcements feed: an **AML/CFT Business Risk Assessment Guidance** publication (dated 12 Jun 2026) and a **Circular on the UAE Proliferation Financing National Risk Assessment (PF NRA) 2026 and required actions** (dated 1 Jun 2026).
  - The rest of the landing page (mandate, regulations, licensing, public register, enforcement messaging) appears to be standard/static content with no substantive change.

- **Likely app impact**:
  - **Regulatory Q&A topics** on VASP AML/CFT obligations and business risk assessments may need a refreshed pointer to VARA's new AML/CFT BRA guidance.
  - **Proliferation financing / sanctions risk** topics may need updating to reference the **PF NRA 2026** and any "required actions" for VASPs (note: actual required actions are not visible in the extracted text and should be confirmed from the source circular).
  - **Super Tools citations in `assets/super-data.js`** referencing VARA AML/CFT or PF materials should be checked for currency.
  - **Country/risk data in `index.html`** for UAE: the PF NRA 2026 may warrant a note under proliferation-financing risk context, pending review of the underlying document.

- **Suggested citation**:
  - VARA, *AML/CFT Business Risk Assessment Guidance* (published 12 Jun 2026).
  - VARA Circular, *Publication of UAE Proliferation Financing National Risk Assessment (PF NRA) 2026 and Required Actions* (1 Jun 2026).
  - (Confirm exact titles, document references, and any circular numbers from the linked publications before citing — not visible in extracted text.)

### Wolfsberg Group

- **What appears to have changed**:
  - New 2025 guidance published on **banking services to fiat-backed stablecoin issuers**, signalling a defined position on stablecoin issuer access to traditional banking.
  - New 2025 **Statement on the Risk-Based Approach** (re-establishing RBA commitment, with pledge to update 2006 RBA guidance and 2015 risk assessment FAQs).
  - New 2025 **Statement on Effective Monitoring for Suspicious Activity, Part II** (transitioning to innovation). Remaining items (appointments, forum, anniversary news) look like routine site churn.

- **Likely app impact**:
  - **Digital assets / stablecoins** Q&A topics: any answer addressing bank exposure to stablecoin issuers or VASP onboarding may warrant a refreshed reference to the new Wolfsberg stablecoin guidance.
  - **Risk-Based Approach** Q&A topics and Super Tools citations in `assets/super-data.js` referencing older Wolfsberg RBA material (2006 guidance / 2015 FAQs) should be flagged as potentially superseded by the 2025 RBA statement.
  - **Transaction monitoring / suspicious activity** topics: citations may need updating to reflect the 2025 Effective Monitoring Part II statement.
  - No change indicated for **country/risk data in index.html** — Wolfsberg is a global standard-setter, not a jurisdiction source.

- **Suggested citation** (if update warranted):
  - *Wolfsberg Group Guidance on the Provision of Banking Services to Fiat-Backed Stablecoin Issuers* (2025).
  - *The Wolfsberg Group — Statement on the Risk-Based Approach* (2025).
  - *The Wolfsberg Statement on Effective Monitoring for Suspicious Activity, Part II: Transitioning to Innovation* (2025).

*Proposal for MLRO review — confirm titles/dates against source PDFs before citing; no document reference numbers

### LBMA — Responsible Sourcing

- **What appears to have changed**:
  - The page now promotes a **Sustainability & Responsible Sourcing Summit (June 2026)** registration banner.
  - References to a **public consultation on Responsible Gold Guidance version 10** and **Disclosure Guidance version 3** are present (version numbers may indicate updated guidance in progress).
  - A **Sourcing Advisory** is highlighted covering Brazil, DRC, Sudan, **United Arab Emirates**, and Zimbabwe.
  - *Note*: Much of the extract is standard site navigation/menu text; aside from the items above, this looks largely like routine site churn rather than a substantive standards change.

- **Likely app impact**:
  - **Country/risk data in index.html**: The Sourcing Advisory explicitly lists the **UAE** among focus jurisdictions for precious metals responsible sourcing — worth flagging in any UAE gold/precious-metals risk context.
  - **Regulatory Q&A topics**: Any answers on **gold supply-chain due diligence / responsible sourcing for refiners (DPMS sector)** may need a refreshed reference to the in-consultation **Responsible Gold Guidance v10** once finalized (do not cite as final until confirmed).
  - **Super Tools citations in assets/super-data.js**: If LBMA responsible sourcing is cited as a standard for DPMS/refiner due diligence, verify the linked guidance version is current.

- **Suggested citation**:
  - LBMA — *Responsible Sourcing Programme* (Global), https://www.lbma.org.uk/responsible-sourcing
  - If updating DPMS guidance: LBMA — *Responsible Gold Guidance* (note: version 10 currently in public consultation; cite final version only when published).
  - For UAE-specific context: LBMA — *Sourcing Advisory* (covering UAE and other focus jurisdictions).

*For human review — version numbers and advisory scope should be confirmed against the live LBMA source before any edit is finalized

### US OFAC — Recent Actions

- **What appears to have changed**:
  - Recent Actions feed shows new dated entries through June 18, 2026, including counter-terrorism designations, Venezuela-related general licenses, and Cuba/Russia-related designation updates and removals.
  - An enforcement settlement is listed: OFAC and FTI Consulting, Inc. (dated June 01, 2026).
  - Total result count shown is 3,110 entries; the substantive items here are individual designation/licensing/enforcement actions rather than routine site churn.

- **Likely app impact**:
  - **Regulatory Q&A (assets/super-data.js)**: Topics covering OFAC/US sanctions screening obligations, SDN/Consolidated list update frequency, and the requirement to screen against current OFAC lists may warrant a refreshed "last reviewed" date. Answers referencing program-specific designations (Venezuela, Cuba, Russia, Iran, counter-terrorism, DRC) could note that new actions occurred in June 2026.
  - **Super Tools citations (assets/super-data.js)**: Any sanctions-screening tool citing OFAC SDN/Consolidated lists should confirm it points to the live list/feed rather than a static snapshot.
  - **Country/risk data (index.html)**: If risk weightings reference US sanctions exposure for Venezuela, Cuba, Russia, Iran, North Korea, or DRC, confirm these remain aligned; no change in country scope is evident here, so likely no edit needed beyond a review note.

- **Suggested citation**:
  - US Department of the Treasury, Office of Foreign Assets Control (OFAC) — *Recent Actions*, https://ofac.treasury.gov/recent-actions (entries dated through 18 June 2026).
  - For the enforcement item, cite: OFAC Enforcement Action — *Settlement Agreement between OFAC and FTI Consulting, Inc.* (01 June 2026) — verify settlement reference number on the linked page before citing.

*Note: This is a proposal for

### EU — Financial Sanctions

- **What appears to have changed**: 
  - The extracted content is the standard European Commission "Sanctions (restrictive measures)" landing/navigation page, with no specific new regime, legal act, or listing update visible in the text.
  - This appears to be routine site churn (navigation menus, language selectors, general descriptive text) rather than a substantive sanctions change.
  - No dated guidance, FAQ revision, or new restrictive measure is identifiable from the truncated extract.

- **Likely app impact**: 
  - No immediate change required to Regulatory Q&A topics or Super Tools citations in `assets/super-data.js` based on this snapshot.
  - If EU sanctions are referenced as a screening source in country/risk data or sanctions-list citations in `index.html`, confirm the URL remains valid (it does) and that any "EU consolidated list" pointer is unaffected — but no edit is warranted from this churn alone.

- **Suggested citation**: 
  - If an update is later confirmed, cite: *European Commission — Sanctions (restrictive measures)*, https://finance.ec.europa.eu/eu-and-world/sanctions-restrictive-measures_en.
  - No specific regulation, implementing act, or article number is visible in the text; do not cite one until a substantive change is identified.

**Reviewer note**: Recommend no action beyond logging this as routine page churn. Re-flag if a subsequent capture shows a new regime, guidance document, or FAQ update.

### UK OFSI — Consolidated List of Targets

- **What appears to have changed**:
  - The publication has been **withdrawn as of 28 January 2026**. The OFSI Consolidated List has closed and is no longer being updated.
  - From 28 January 2026, the **UK Sanctions List is the sole source** for all UK sanctions designations. The page now displays a "[withdrawn]" status and directs users to the new source.
  - This is a **material structural change**, not routine site churn — the monitored source itself is being retired.

- **Likely app impact**:
  - Any Regulatory Q&A topic or answer in `assets/super-data.js` that references the **OFSI Consolidated List** as the authoritative source for UK sanctions screening should be reviewed and repointed to the **UK Sanctions List**.
  - Super Tools citations linking to the gov.uk Consolidated List publication URL or the OFSI consolidated list search app may now be stale and should be updated.
  - Country/risk or sanctions-source reference data in `index.html` that names "OFSI Consolidated List" should be checked and amended to reflect the new single-source position.
  - Note: this affects UK sanctions screening references; UAE-specific obligations (e.g., UN/UAE Local Terrorist Lists) are unaffected, but UK-list cross-screening guidance may need wording updates.

- **Suggested citation**:
  - **UK Sanctions List**, HM Treasury / OFSI — the consolidated source for all UK sanctions designations from 28 January 2026.
  - Where historical context is needed, reference: *"OFSI Consolidated List of Targets (withdrawn 28 January 2026)."*

*Proposal for MLRO review — no edits applied. Recommend verifying the new UK Sanctions List URL before updating citations.*

### Egmont Group of FIUs

- **What appears to have changed**: The news feed now lists recent items dated May–June 2026, headlined by participation in the FATF June 2026 Plenary (June 19, 2026) and International FIU Day (June 9). Two notable substantive items: publication of the **2024–2025 Annual Report** (May 25, 2026) and a leadership transition (thanks to outgoing Hennie Verbeek-Kusters; Chair now Elżbieta Franków-Jaśkiewicz, Vice-Chair Daniel Thelesklaf). This is largely routine news/event churn, with two items (annual report, leadership change) potentially worth noting.

- **Likely app impact**: Low to moderate. Most items are event coverage with no direct rule changes for UAE obligated entities. Check whether `assets/super-data.js` references Egmont leadership names or cites the prior annual report year — if so, update the Annual Report reference to 2024–2025 and refresh leadership names. MENA-relevant context (ECOFEL Riyadh workshop with SAFIU) may be worth flagging for any FIU cooperation/international information-sharing Q&A topic, but no UAE-specific obligation changes are evident. No country/risk data in `index.html` likely requires updating.

- **Suggested citation**: *Egmont Group of Financial Intelligence Units — 2024–2025 Annual Report* (cite only if an update on global FIU cooperation is warranted), with the news index (https://egmontgroup.org/news/) as the source page. Do not cite specific article/circular numbers, as none appear in the text.

### Basel AML Index

- **What appears to have changed**:
  - The page now references the **2025 public edition launch** (with a webinar featuring the ECB, Wolfsberg Group, and Malawi FIU), indicating a new annual edition has been published.
  - Coverage figures are stated as **177 jurisdictions** (public edition) and **203 countries/jurisdictions** (expert edition), based on **17 sources** across **5 domains** — worth verifying against currently cited figures.
  - Otherwise the structure (methodology, public/expert editions, free access terms) appears to be standard site content, not a substantive methodology change.

- **Likely app impact**:
  - Any Regulatory Q&A topic citing Basel AML Index **risk scores, rankings, or the UAE's position** should be checked against the 2025 public edition figures.
  - Super Tools citations in `assets/super-data.js` referencing the Basel AML Index edition year, source count (17), or jurisdiction coverage (177/203) may need updating to reflect the 2025 edition.
  - Country/risk data in `index.html` that quotes a prior-year Basel score or rank for the UAE (or comparator jurisdictions) may be outdated if it predates the 2025 edition.

- **Suggested citation**:
  - *Basel AML Index 2025 (Public Edition), Basel Institute on Governance — International Centre for Asset Recovery (ICAR)*, https://index.baselgovernance.org/

*Note: The exact 2025 UAE score/rank is not visible in the extracted text; confirm the figure from the live ranking before any answer is updated.*

### UNODC — Money Laundering & Organised Crime

- **What appears to have changed**:
  - The extracted content is dominated by site-wide navigation/boilerplate (menus, regional listings, treaty bodies), with only the standard high-level GPML overview text on money laundering, terrorist financing, and proliferation financing.
  - No new substantive policy statement, report, or dated publication is visible in this extract; the core ML definition and Global Programme description match the page's long-standing framing.
  - This looks like **routine site churn / navigation restructuring** rather than a substantive content change to the AML/CFT material.

- **Likely app impact**:
  - **Low / likely none.** This page is a general overview, not a primary source for specific obligations or thresholds, so no Regulatory Q&A answers or Super Tools citations in `assets/super-data.js` should require changes based on this extract.
  - If UNODC is cited anywhere as a generic background/definitional reference (e.g., "what is money laundering"), verify the URL still resolves to the GPML landing page; no wording update appears warranted.
  - No country/risk data in `index.html` is affected — this page contains no UAE-specific or country-risk content.

- **Suggested citation** (only if an update is warranted):
  - UNODC, *Global Programme against Money Laundering, Proceeds of Crime and the Financing of Terrorism (GPML)* — Money Laundering overview page, https://www.unodc.org/unodc/en/money-laundering/

**Reviewer note:** Recommend **no edit**; flag as monitored-source churn unless a diff against a prior snapshot reveals a new dated publication or policy statement not visible in this truncated extract.

### Responsible Jewellery Council (RJC)

- **What appears to have changed**:
  - Page reflects updated time-stamped content: references to the **2026 AGM** (new officer/board appointments), the **2026 Annual Progress Report**, and a **Standards & Audit Changes information pack**.
  - A new **Communications Toolkit** and "20 years" (2025 anniversary) milestone content, with stated membership now exceeding **2,000 companies**.
  - Most of the visible text is standard navigation/marketing and the country member directory; absent the standards changes detail, this is largely routine site refresh, but the referenced "changes to standards, audits, and certification requirements" warrant a closer look.

- **Likely app impact**:
  - Any Regulatory Q&A topic referencing RJC's three standards — **Code of Practices (CoP)**, **Chain of Custody (CoC)**, and **Laboratory Grown Material Standard (LGMS)** — may need review if the standards/audit changes pack alters certification requirements relevant to UAE precious metals/stones DNFBP guidance.
  - Super Tools citations in `assets/super-data.js` pointing to RJC standards or certification language should be checked for version currency.
  - No direct country/risk data change in `index.html` is indicated; the member directory is informational only (note: UAE not visible in truncated list, so no specific UAE count confirmed here).

- **Suggested citation**:
  - "Responsible Jewellery Council (RJC) — Standards & Audit Changes Information Pack" and/or the relevant standard (Code of Practices / Chain of Custody / Laboratory Grown Material Standard), citing the current published version once confirmed on the RJC site. Do not cite a version/date not yet verified.
