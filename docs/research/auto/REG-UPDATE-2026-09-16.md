# Regulatory update proposal — 2026-09-16

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (same "الإعلانات الهامة – مارس 11 2021 – نشرة العلامات التجارية…" homepage banner/announcement block), indicating re-ordering or re-rendering of the same content rather than new content.
- **No AML/CFT-specific change is visible**: the AML-related navigation items (تشريعات مواجهة جرائم غسل الاموال، مواجهة غسل الأموال وتمويل الإرهاب، العقوبات المالية المستهدفة، التسجيل في نظام goAML) are present and unchanged in the extracted text; no new circular, guidance, deadline or threshold appears.
- Assessment: routine homepage/site churn (banner carousel, promotional tiles such as investment, tourism and "تصفير البيروقراطية" content), not a supervisory publication.

- **Likely app impact**: None expected. No edits indicated for Regulatory Q&A topics on DNFBP/DPMS obligations (MoE supervisory scope, goAML registration, TFS/UNSC list screening, CDD/record-keeping for dealers in precious metals and stones), nor for Super Tools citations in `assets/super-data.js`. No change to UAE country/risk parameters in `index.html`. Suggest keeping the existing MoE monitoring entry and re-checking the AML sub-pages (مواجهة غسل الأموال وتمويل الإرهاب / العقوبات المالية المستهدفة / الإصدارات) directly, since the homepage delta is not a reliable signal for supervisory updates.

- **Suggested citation**: No update warranted. If a future substantive change is confirmed, cite by page title as published, e.g. "UAE Ministry of Economy — مواجهة غسل الأموال وتمويل الإرهاب (Anti-Money Laundering and Combating the Financing of Terrorism)" or "UA

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The homepage news/media carousel rotated — an "ECOFEL training/workshop event" item was added ahead of the existing "2026 Eurasian Group (EAG) Forum" and "roundtable on misuse of legal persons" items, while a press release on the UAE FIU–Pakistan FMU MoU on information exchange dropped off the visible list.
- **Footer contact details were reformatted** (toll-free number now labelled as such: 02 691 5599 / +971 2 691 5599); navigation, policies & guidance, STR process, goAML/IEMS portal routing and publications structure are unchanged.
- No change detected to reporting obligations, thresholds, forms, deadlines or instruments; the substantive page content (Annual Report 2025, "Drug Trafficking Networks: Patterns and Threat Actors" strategic analysis) is unchanged from the current extract. This reads as routine news/media and footer churn.

- **Likely app impact**: Minimal. No edits required to Regulatory Q&A answers on STR/SAR filing via goAML, FIU enquiry handling via IEMS, or tipping-off/confidentiality topics. Optional housekeeping: (a) if `assets/super-data.js` cites FIU contact details or a "latest FIU news" snippet, refresh the toll-free number formatting; (b) if typology/risk-indicator citations exist, confirm they already point to the 2025 Annual Report and the updated drug-trafficking strategic analysis (2024–2025, with NDEA participation) rather than superseded editions; (c) `index.html` country/risk data — no change, as the Pakistan MoU item is an international-cooperation announcement, not a risk-rating or listing change, though it could be noted if the app tracks FIU bilateral MoUs.

- **Suggested citation**: UAE Financial Intelligence Unit — official website (uaefiu.gov.ae), News & Resources / Insights & Publications; where typology content is referenced: U

### OECD — Responsible Mineral Supply Chains (CAHRA)

- **What appears to have changed**: The 4 added and 4 removed segments are effectively identical — repeated site navigation/country-index menus ("regions… countries a - c afghanistan albania…"). This is navigation boilerplate re-ordering, not substantive content.
- **No change detectable in guidance substance**: the current page could not be fetched (HTTP 403), so no OECD Due Diligence Guidance text, CAHRA definitions, or annex content could be compared. Nothing in the delta evidences new or amended due diligence expectations.
- **Assessment**: routine site churn / crawler artefact on the OECD Responsible Business Conduct landing page.

- **Likely app impact**: None required at this time.
  - `assets/super-data.js`: no edits proposed to Regulatory Q&A entries on DPMS/precious metals & stones due diligence, supply-chain red flags, or gold sourcing risk, nor to Super Tools citations referencing OECD due diligence.
  - `index.html`: no changes to country/high-risk jurisdiction lists — the country strings in the delta are OECD site menu items, not a risk designation list, and must not be treated as a CAHRA or high-risk country list.
  - Suggested action: re-run capture with a browser-style fetch (403 blocked) and, if desired, monitor the dedicated minerals due diligence page directly rather than the RBC topics landing page to reduce false positives.

- **Suggested citation**: OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas (Third Edition) — cite only if a substantive update is confirmed on re-fetch; pair with UAE Cabinet/MoE DPMS due diligence requirements already cited in the app (no new article or circular numbers identified in this delta).

SEVERITY: LOW — Delta is duplicated site navigation/country

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The "find a member" country directory block was re-rendered with effectively identical content (same added/removed segment covering Brunei → China member counts), indicating a dynamic member-count refresh rather than a content change.
- **What appears to have changed**: A second added segment shows member listing fragments ("italy … avant india private limited india … herbert stephan lanka (pvt) ltd."), consistent with the member search/results widget loading individual member entries at crawl time.
- **What appears to have changed**: No change detected to RJC standards (Code of Practices, Chain of Custody, Laboratory Grown Material Standard), certification requirements, or policy pages in the extracted text. This looks like routine site/directory churn.

- **Likely app impact**: Minimal. No update needed to Regulatory Q&A answers on DPMS (dealers in precious metals and stones) obligations, KYC/CDD thresholds (AED 55,000 cash), goAML reporting, or FATF-aligned responsible sourcing guidance. Optional, low-priority checks:
  - Super Tools citations in `assets/super-data.js` referencing RJC standards as voluntary industry benchmarks — confirm they cite the standard documents (versioned) rather than the RJC homepage, so member-directory churn does not trigger repeat deltas.
  - Country/risk data in `index.html`: no change warranted; RJC member counts are not a risk indicator and should not feed jurisdiction risk scoring. If UAE-linked member counts are displayed anywhere as context, note they are dynamic and unsourced for AML purposes.

- **Suggested citation**: If any update is made, cite the substantive instrument rather than the homepage — e.g. "Responsible Jewellery Council, Code of Practices (current version)" and/or "Responsible Jewellery Council, Chain of Custody Standard (current version)", alongside the UAE-binding sources (Federal Decree-Law No. 20 of 2018 and
