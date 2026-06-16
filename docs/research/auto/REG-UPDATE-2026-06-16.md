# Regulatory update proposal — 2026-06-16

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor
_AI draft unavailable (HTTP 500). Review manually: https://www.moec.gov.ae/en/anti-money-laundering_

### UAE Financial Intelligence Unit (FIU) — goAML
_AI draft unavailable (HTTP 500). Review manually: https://www.uaefiu.gov.ae/en/_

### UAE Executive Office for Control & Non-Proliferation (EOCN)
_AI draft unavailable (HTTP 500). Review manually: https://www.uaeiec.gov.ae/en/_

### Dubai Virtual Assets Regulatory Authority (VARA)
_AI draft unavailable (HTTP 500). Review manually: https://www.vara.ae/en/_

### Wolfsberg Group
_AI draft unavailable (HTTP 500). Review manually: https://www.wolfsberg-principles.com/_

### LBMA — Responsible Sourcing
_AI draft unavailable (HTTP 500). Review manually: https://www.lbma.org.uk/responsible-sourcing_

### US OFAC — Recent Actions

- **What appears to have changed**:
  - The feed shows recent actions dated through June 11, 2026, including a Cuba designation, Russia-related designations/removals and update, and issuance of amended Russia-related general licenses and FAQs.
  - Other recent entries include non-proliferation, Iran-related, counter-terrorism, DRC-related, and Venezuela-related designations and general licenses, plus an enforcement settlement (FTI Consulting, Inc., June 1, 2026) and publication of an "Introduction to OFAC" guide.
  - Total result count is 3,108 across 311 pages; this reflects OFAC's normal high-frequency update cadence (largely routine list churn), though several program-level designation/removal actions are present.

- **Likely app impact**:
  - **assets/super-data.js (Super Tools citations)**: Sanctions-screening tool references to OFAC SDN/Consolidated lists may need a "last reviewed" date refresh; confirm citations point to the live SDN and Non-SDN list service.
  - **Regulatory Q&A topics**: Answers on UAE obligations to screen against UN/OFAC and other sanctions lists, and on de-listing/removal handling, may warrant a date check (note that designations *and removals* both occurred — removals matter for false-positive management).
  - **index.html country/risk data**: Review exposure tagging for Russia, Iran, Cuba, Venezuela, DRC, and North Korea, as these programs saw recent activity. No new jurisdiction appears added.

- **Suggested citation**:
  - US Department of the Treasury, Office of Foreign Assets Control (OFAC), *Recent Actions* — https://ofac.treasury.gov/recent-actions (entries dated through June 11, 2026).
  - If citing the enforcement matter specifically: OFAC Settlement Agreement with FTI Consulting, Inc. (June 1, 2026).

*Note: This is a proposal for MLRO review. No specific list entry numbers or circular references are asserted beyond what is visible

### EU — Financial Sanctions

- **What appears to have changed**: 
  - No substantive sanctions-list or regime change is visible in the extracted text; the content is the standard landing/overview page for EU restrictive measures.
  - Page reflects routine site/navigation churn (updated commissioner name "Maria Luís Albuquerque," social links including Mastodon/Bluesky, "EU Sanctions Helpdesk" promotion).
  - This appears to be cosmetic/structural rather than a regulatory update to specific sanctions regimes.

- **Likely app impact**: 
  - Low. No Regulatory Q&A topic or Super Tools citation in `assets/super-data.js` should require substantive change based on this page alone.
  - If we cite the EU sanctions landing URL anywhere (e.g., country/risk references in `index.html` or sanctions-screening guidance), verify the link still resolves — the URL appears stable.
  - Note for MLRO: actual designations/listings are managed via the EU Consolidated Sanctions List and Official Journal regulations, not this overview page; monitoring should point there for substantive list changes.

- **Suggested citation**: 
  - "European Commission — EU Sanctions (Restrictive Measures), Directorate-General for Financial Stability, Financial Services and Capital Markets Union" (overview page), if a general reference is needed.
  - No specific regulation, article, or list version is visible in the text to cite.

*Reviewer note: Recommend no edit at this time; treat as routine site churn pending confirmation against the EU Consolidated Sanctions List for any actual listing changes.*

### UK OFSI — Consolidated List of Targets

- **What appears to have changed**: 
  - The OFSI Consolidated List has **closed and been withdrawn** as of 28 January 2026; the publication is now marked `[withdrawn]`.
  - From 28 January 2026, the **UK Sanctions List** is stated to be the **only source** for all UK sanctions designations.
  - This is a material structural change (not routine churn): the monitored source/URL is now deprecated, and the authoritative source has moved.

- **Likely app impact**: 
  - Any Regulatory Q&A topic or answer referencing the **OFSI Consolidated List** as a live screening source should be updated to point to the **UK Sanctions List**.
  - **Super Tools citations in `assets/super-data.js`** that cite the OFSI Consolidated List URL (`gov.uk/.../financial-sanctions-consolidated-list-of-targets`) need the URL/source name updated to the UK Sanctions List.
  - **Country/sanctions-risk data in `index.html`** referencing UK sanctions lists as a screening input should be reviewed so the cited UK source reflects the consolidated-to-single-list transition.
  - Note for reviewers: this affects UK-source citations only; UAE/local primary sources are unaffected.

- **Suggested citation**: 
  - **UK Sanctions List** (HM Treasury / Office of Financial Sanctions Implementation), replacing the withdrawn "Financial sanctions: Consolidated List of Targets" (OFSI Consolidated List closed 28 January 2026).

*Proposal for MLRO review — confirm the exact replacement URL and update all affected citations before publishing.*

### Basel AML Index

- **What appears to have changed**:
  - The page now references the **2025 public edition** of the Basel AML Index, including a launch webinar with the ECB, Wolfsberg Group, and Malawi Financial Intelligence Authority.
  - Coverage figures are stated as **17 indicators / 5 domains / 177 jurisdictions** (public edition) and **203 countries/jurisdictions** (expert edition, updated quarterly).
  - This looks like a substantive **annual edition refresh** (2025 cycle) rather than routine site churn, though the extracted text does not show specific country risk scores.

- **Likely app impact**:
  - **Country/risk data in `index.html`**: Any UAE Basel AML Index risk score or ranking displayed should be checked against the 2025 public edition; prior-year scores may now be outdated.
  - **Regulatory Q&A topics**: Answers referencing the Basel AML Index methodology, number of indicators/domains, or jurisdictions covered may need to align with the 2025 figures (17 indicators / 5 domains / 177 public-edition jurisdictions).
  - **Super Tools citations in `assets/super-data.js`**: Any citation pointing to a prior-year Basel AML Index edition should be updated to the 2025 edition; confirm the actual UAE score from source before changing displayed values.

- **Suggested citation**:
  - *Basel AML Index 2025 (Public Edition), Basel Institute on Governance* — https://index.baselgovernance.org/

*Note: Specific UAE score/rank not visible in the extracted text; verify against the live ranking/methodology pages before any data edit.*
