# Regulatory update proposal — 2026-06-30

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**:
  - The extracted content is predominantly site-wide navigation/chrome (Arabic menu structure, investment/tourism/open-data links, homepage banners) with no substantive AML/CFT body text captured.
  - No new instrument, circular, dated guidance, or DNFBP/DPMS-specific announcement is visible in the extract.
  - This looks like routine site churn / navigation or template refresh (note the entity now renders as "وزارة الاقتصاد والسياحة" — Ministry of Economy and Tourism — rather than just Ministry of Economy), rather than a substantive AML/CFT policy update. Visible AML-relevant menu items (مواجهة غسل الأموال وتمويل الإرهاب، العقوبات المالية المستهدفة، التسجيل في نظام goAML) remain present but unchanged in substance.

- **Likely app impact**:
  - **Low / likely none** based on this extract. No confirmed change to substantive obligations.
  - Watchpoints only (verify against the live page, not this truncated text):
    - Regulatory Q&A topics on **DNFBP/DPMS supervision**, **goAML registration**, and **Targeted Financial Sanctions (TFS)** obligations — confirm wording/links still match MoE.
    - Super Tools citations in `assets/super-data.js` referencing MoE as DNFBP supervisor — check the **supervisor name** ("Ministry of Economy" vs. possible "Ministry of Economy and Tourism" rebrand) and the source URL.
    - `index.html` country/risk data: no UAE risk-rating impact indicated.
  - Recommend **no edit** until a substantive page (with a dated title or instrument) is retrieved.

- **Suggested citation**:
  - If an update is later warranted, cite generically: **UAE Ministry of Economy — "Anti-Money Laundering" (AML/CFT for DNFBPs)**, https://www.moec.gov.ae/en/anti-money-laundering

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - The extracted snapshot shows a content "last updated" date of **9 February 2024**, while the footer copyright reads **© 2026** — suggesting a template/footer refresh rather than substantive content changes.
  - No new STR/goAML process content, reporting guidance, or publications are visible beyond legacy items (annual report 2021, 2021 typology reports, pre-2021 MoUs). The "what's new" section appears stale.
  - This looks consistent with **routine site churn** (footer/year auto-update, template tweaks) rather than a material regulatory change.

- **Likely app impact**:
  - **Low / likely none.** No new instrument, deadline, or process change is evident.
  - If anything, verify that goAML / STR-reporting references in `assets/super-data.js` (Regulatory Q&A on suspicious transaction reporting, FIU reporting obligations) still point to the live `uaefiu.gov.ae` domain and the goAML portal entry path.
  - No country/risk data in `index.html` appears affected — this source supports reporting-process Q&A, not jurisdictional risk scoring.

- **Suggested citation** (only if an update is warranted after human review):
  - **UAE Financial Intelligence Unit (FIU) — goAML**, https://www.uaefiu.gov.ae/en/ (content last updated 9 February 2024; accessed [date]).

> **Reviewer note:** No new article, circular, or decision numbers are present in the extracted text. Recommend **no change** pending confirmation that the difference is only the footer year/template. Flag for re-check if a future snapshot shows updated STR-process or publications content.

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**:
  - The extracted content is the DMCC corporate/marketing homepage (business setup, free zone benefits, ecosystems, "Future of Trade Report 2026"). No AML/CFT-specific content (DPMS guidance, goAML, supervisory notices, KYC obligations) is visible in this capture.
  - Notable non-AML references: corporate tax framing (qualified free zone under Federal Decree-Law No. 47 of 2022), and a "Future of Trade Report 2026" promotion.
  - This looks like routine homepage/marketing churn rather than a substantive AML/CFT regulatory change.

- **Likely app impact**:
  - **Low / likely none.** No Regulatory Q&A topic or Super Tools citation should be changed based on this homepage capture alone.
  - If any existing citation in `assets/super-data.js` points to the DMCC homepage URL as an *AML/CFT authority* (e.g., DNFBP/DPMS supervision, registration), flag for revalidation against DMCC's compliance pages — the homepage no longer evidences that content.
  - No change to country/sector risk data in `index.html` warranted; UAE/DMCC precious-metals-and-stones sector risk classification is unaffected by this marketing update.

- **Suggested citation**:
  - None warranted from this page. If a DMCC reference must remain, cite the DMCC corporate site generically (DMCC, https://www.dmcc.ae/) and pair AML/CFT claims with the relevant **DMCC compliance / DPMS** page or the **UAE MOE DNFBP supervisory guidance**, not the homepage.
  - Do **not** cite a specific circular/article number; none is visible in the extracted text.

*Recommendation: No edit; mark source reviewed and re-point any AML-specific dependency to a DMCC compliance subpage before next review cycle.*

### Wolfsberg Group

- **What appears to have changed**:
  - New **2026 Guidance on the Risk-Based Approach** now appears as the lead resource/headline, alongside a related **2025 Statement on the Risk-Based Approach** (re-committing to RBA and pledging to update legacy 2006 guidance and 2015 risk-assessment FAQs).
  - New **2025 Guidance on the provision of banking services to fiat-backed stablecoin issuers** and a **second statement on effective monitoring for suspicious activity (Part II: Transitioning to Innovation, 2025)** have been published.
  - Governance/operational items (new co-chairs, management committee appointments, 2026 Wolfsberg Forum, "htworldcup" 314b note) appear to be routine news churn and likely not citation-relevant.

- **Likely app impact**:
  - **Regulatory Q&A — Risk-Based Approach**: answers referencing Wolfsberg RBA guidance may need to point to the 2026 guidance / 2025 statement rather than legacy 2006 material; check for stale "2006" references.
  - **Regulatory Q&A — Digital Assets / Stablecoins**: any topic on banking services to VASPs/stablecoin issuers should reference the new 2025 stablecoin-issuer guidance.
  - **Regulatory Q&A — Transaction Monitoring / Suspicious Activity**: answers on effective monitoring should incorporate the Part II (2025) statement on innovation in monitoring.
  - **Super Tools citations (assets/super-data.js)**: review any Wolfsberg citations for outdated titles/years (RBA, monitoring, digital assets).
  - **index.html country/risk data**: no direct impact — Wolfsberg is a global standards body, not a jurisdiction-specific source.

- **Suggested citation** (pending reviewer confirmation; cite only as supplementary best-practice guidance, not UAE law):
  - *Wolfsberg Group — Guidance on the Risk-Based Approach (2026)* and/or *
