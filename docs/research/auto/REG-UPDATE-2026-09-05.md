# Regulatory update proposal — 2026-09-05

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (same "الإعلانات الهامة – مارس 11 2021" announcements/promotional carousel block), indicating a re-ordering or re-rendering of homepage banner content rather than substantive new text.
- The current homepage still surfaces the standing AML/CFT navigation items — "مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", "التسجيل في نظام goAML", "الأنشطة الاقتصادية الواقعية" (real/actual economic activity), and "تشريعات مواجهة جرائم غسل الاموال" — with no visible new circular, decision, deadline or threshold.
- Marketing/campaign banners (commodity price platform, price-increase requests, Africa investment gateway, zero-bureaucracy, We the UAE 2031) dominate the delta; this reads as routine site churn / rotating homepage content.

- **Likely app impact**: No content change required at this time. If a refresh is undertaken opportunistically, verify in `assets/super-data.js` that DNFBP/DPMS Regulatory Q&A entries still correctly name the supervisor as the **Ministry of Economy and Tourism** (site title now reads "وزارة الاقتصاد والسياحة") rather than "Ministry of Economy", and that goAML registration and TFS (targeted financial sanctions) links point to the current MoE AML section paths. No changes indicated for country/risk data in `index.html`.

- **Suggested citation**: UAE Ministry of Economy (and Tourism) — "مواجهة غسل الأموال وتمويل الإرهاب" (AML/CFT) section and "تشريعات مواجهة جرائم غسل الأموال" legislation page, moec.gov.ae — cite only if the naming/URL refresh is adopted; no specific decision or circular number is visible in the captured text.

SEVERITY: LOW — Added and remov

### US OFAC — Recent Actions
- **What appears to have changed**: The listing page rolled forward — new top entries now include "Iran-related designations; issuance of Iran-related general license" (September 04, 2026) and "Cuba designations; Russia-related designation removal; issuance of amended Cuba general license" (September 03, 2026); the August 12, 2026 enforcement action (settlement with Rice Lake Weighing Systems, Inc.) has dropped off page 1.
- **Also visible on page 1**: removal of Syria's designation as a state sponsor of terrorism with associated sanctions list updates (August 24, 2026), ICC-related designations and general license (August 18, 2026), and multiple amended Venezuela-related general licenses/FAQs.
- **Assessment**: This is largely routine pagination churn on a high-frequency feed (3,152 results); no UAE-specific obligation changed. However, the underlying SDN/consolidated list updates are operationally relevant for screening.

- **Likely app impact**:
  - Regulatory Q&A topics on **targeted financial sanctions / name screening** (UAE Cabinet Decision No. 74 of 2020 obligations, use of the UAE Local Terrorist List and UNSC Consolidated List) may warrant a reminder note that non-UN lists such as OFAC SDN are risk-based/commercially adopted, not automatically legally binding in the UAE.
  - Super Tools citations in `assets/super-data.js` referencing OFAC list-screening sources: check any "last updated" or example-designation text against the September 2026 actions; refresh screening-frequency guidance (list changes are near-daily).
  - Country/risk data in `index.html`: review entries for **Syria** (US state sponsor of terrorism designation removed 24 Aug 2026), **Cuba**, **Iran**, **Venezuela**, and **Russia** where risk narratives reference US sanctions posture — Syria is the most likely to be materially stale.
  - No change to FATF grey/black list logic — do not conflate OF

### UN Security Council — Consolidated List

- **What appears to have changed**: The page's "last updated" statement moved from **27 August 2026** to **4 September 2026**; the wording is otherwise identical ("supersedes all previous versions").
- No change is visible in the extracted text to the list's structure, sanctions committees, or any listing/de-listing detail — only the version date line changed. The underlying XML/HTML list files themselves are not captured in this extract.
- This is consistent with the UN's routine periodic republication of the Consolidated List; however, each republication may carry substantive listing/amendment/de-listing changes not visible from the landing page alone.

- **Likely app impact**:
  - **Regulatory Q&A — targeted financial sanctions (TFS) topics**: any answer stating that FIs/DNFBPs must screen against the UN Consolidated List and the UAE Local Terrorist List, and must action listings "without delay" (commonly referenced as within 24 hours of publication by the UAE Executive Office for CTRS). Wording is unaffected; only the currency of the referenced list version.
  - **Super Tools citations in `assets/super-data.js`**: any sanctions-screening tool entries that cite the UN Consolidated List with a "last updated / version as at" date should be refreshed to 4 September 2026. Check for a hardcoded 27 August 2026 string.
  - **Country/risk data in `index.html`**: no change indicated. Only revisit if the underlying republication added or removed listings tied to a jurisdiction shown in the country/risk panel — this cannot be confirmed from the landing page and would require diffing the actual list file.
  - **Recommended reviewer action**: pull the current UN Consolidated List XML and the UAE Executive Office notice for the corresponding period to confirm whether any listings changed; update only the version date if not.

- **Suggested citation**: United Nations Security Council — Consolidated List, as updated 4 September 2026 (https://www.un.org/securitycouncil/content/un-sc-consolidated-list), read with the UAE Execut

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The only substantive difference in the member-directory listing is one certified member's location — "Smart Diamond" moved from *Preverenges, Switzerland* to *Le Locle, Switzerland*. The country member-count string (Brunei → China, incl. Canada (8), Chile (1), China (35)) was re-emitted with identical values.
- **What appears to have changed**: No change detected to RJC's Code of Practices, Chain of Custody, Laboratory Grown Material Standard, standards-development pages, or assurance/resigned-members content in the extracted text.
- **What appears to have changed**: This has the hallmarks of routine site churn — dynamic "Find a Member" directory refresh rather than a standards or governance update. (Homepage does reference an updated ESG Toolkit, a new communications toolkit, 2026 AGM board appointments and the 2026 Annual Progress Report, but these are not part of the detected delta and should be confirmed separately.)

- **Likely app impact**: Minimal. No change expected to Regulatory Q&A answers on DPMS obligations (CDD, KYC on precious-metals/stones dealers, AED 55,000 cash-threshold reporting, DPMSR filing via goAML) or to UAE-specific instruments. Optional low-priority checks: (a) any Super Tools citation in `assets/super-data.js` that references RJC certification as a supply-chain due-diligence benchmark or counterparty-assurance indicator — verify the RJC standards links still resolve; (b) no country/risk data in `index.html` requires change, as the directory counts (incl. any UAE figure) are unchanged in the delta. If the app cites RJC membership numbers ("2,100+ companies"), confirm the figure against the current homepage wording.

- **Suggested citation**: Responsible Jewellery Council, *Code of Practices* / *Chain of Custody Standard* / *Laboratory Grown Material Standard* and RJC "Find a Member" directory (responsibl
