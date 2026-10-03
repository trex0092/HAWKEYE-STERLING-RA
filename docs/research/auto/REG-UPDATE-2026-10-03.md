# Regulatory update proposal — 2026-10-03

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (homepage "الإعلانات الهامة / مارس 11 2021" announcements block and promotional investment banners), indicating a re-render or reordering of the same content rather than a substantive edit.
- **Current page text remains standard MoE homepage navigation and marketing content**: AML/CFT-relevant menu items (مواجهة غسل الأموال وتمويل الإرهاب، العقوبات المالية المستهدفة، التسجيل في نظام goAML، تشريعات مواجهة جرائم غسل الاموال) are present and unchanged in wording.
- **No new instrument, circular, threshold, deadline or DNFBP/DPMS guidance is visible** in the delta or the extracted text. This looks like routine site churn (banner rotation / CMS re-publication).

- **Likely app impact**: None expected. No edits proposed to Regulatory Q&A answers on DNFBP/DPMS supervision, goAML registration, or TFS obligations in `assets/super-data.js`; no change to Super Tools citations; no change to country/risk data in `index.html`. Recommend no action beyond keeping the MoE AML/CFT sub-pages (rather than the homepage) under monitoring, since the homepage is dominated by rotating promotional content and is a low-signal watch target.

- **Suggested citation**: If any update were warranted, cite generically as "UAE Ministry of Economy — Anti-Money Laundering and Combating the Financing of Terrorism (مواجهة غسل الأموال وتمويل الإرهاب) pages, moec.gov.ae (accessed [date])". Do not cite a specific circular or article number — none is visible in the detected change.

SEVERITY: LOW — Added and removed segments are identical; routine homepage banner/CMS churn with no AML/CFT substance.

### US OFAC — Recent Actions

- **What appears to have changed**: The page-1 listing rolled forward by one or two entries — a new "Counter Terrorism Designations" action dated October 02, 2026 now heads the list, and the previously top-listed "Iran-related designations and designations updates…" item (October 01, 2026) has shifted down. Older items ("Russia-related designations removals", "Counter narcotics designation removal") have dropped off page 1 onto page 2.
- Total result count shows 3,167 recent actions; the delta is confined to the paginated index listing, not to any change in OFAC programs, licensing framework or page structure.
- This is consistent with **routine site churn** from OFAC's near-daily SDN/non-SDN list updates; no new sanctions program, general licence category or guidance instrument is visible in the extracted text.

- **Likely app impact**: Minimal. No change expected to Regulatory Q&A topics on UAE targeted financial sanctions (which key off UAE Cabinet Decision 74/2020 and the Executive Office for Control & Non-Proliferation / UNSC-UAE local list, not OFAC directly). Worth a light check that:
  - Any Super Tools sanctions-screening citation in `assets/super-data.js` referencing OFAC SDN/Consolidated lists still points to the live OFAC list pages (links unchanged in this delta).
  - Country/risk data in `index.html` is unaffected — no new country program appeared; Belarus, Iran, Cuba, Venezuela, DRC and Ethiopia items are all pre-existing programs.
  - Standing guidance that screening lists are refreshed continuously (so

### European Commission — EU AI Act regulatory framework (incl. Digital Omnibus amendments)

- **What appears to have changed**: The only detected delta is a one-word tense change in the "Latest news" teaser strip — "EDIC for agri-food launches" became "EDIC for agri-food launched" (DigiByte dated 01 October 2026). No change to the substantive AI Act body text.
- **This looks like routine site churn** (news-feed rotation/wording), not a regulatory amendment. The core framework text (risk-based tiers, prohibited practices, high-risk obligations) is unchanged in this diff.
- Note for context only: the current page text continues to reference the ninth prohibition (AI-generated non-consensual sexually explicit / CSAM material, incl. "nudification" apps) taking effect December 2026 via the AI Omnibus, and high-risk obligations applying from 2 December 2027. These were not introduced by this delta but should be confirmed as already reflected in our content.

- **Likely app impact**: None required from this delta. If a verification pass is desired, check:
  - `assets/super-data.js` — any Regulatory Q&A entries on AI/automated decision-making in AML (e.g. AI-driven transaction monitoring, biometric/remote identification in eKYC, credit/risk scoring) that cite the EU AI Act timeline; confirm the Dec 2026 / 2 Dec 2027 dates and the nine prohibited practices are current.
  - Super Tools citations referencing the EU AI Act as a cross-border/extraterritorial consideration for UAE firms deploying AI screening or customer-risk-rating tools.
  - `index.html` EU country/risk data — no change indicated; no FATF, sanctions or threshold implications.

- **Suggested citation**: Regulation (EU
