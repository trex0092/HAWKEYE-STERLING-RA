# Regulatory update proposal — 2026-06-24

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: 
  - The extracted content is almost entirely site-wide navigation/menu chrome (bilingual header, ministry sections, investment/tourism links) with no substantive AML/CFT body text captured.
  - Visible AML-relevant menu items remain consistent with prior structure: "مواجهة غسل الأموال وتمويل الإرهاب" (Countering ML/TF), "العقوبات المالية المستهدفة" (Targeted Financial Sanctions), "التسجيل في نظام goAML", and "تشريعات مواجهة جرائم غسل الاموال" (AML legislation).
  - This looks like **routine site churn / navigation re-render** rather than a substantive regulatory change — no new instrument, circular, or guidance text is visible in the extract.

- **Likely app impact**: 
  - Likely **none requiring edits**, given no new substantive content is confirmed. Do not change citations based on this extract alone.
  - If a manual recheck of the live page confirms new guidance, candidate areas to review: DNFBP/DPMS obligations in the Regulatory Q&A (registration, supervisory expectations), goAML registration steps in Super Tools, and any TFS-related answers in `assets/super-data.js`.
  - No indication of changes to country/risk lists in `index.html`.

- **Suggested citation**: 
  - Only if a live recheck confirms updated content, cite generically as: **UAE Ministry of Economy — "Anti-Money Laundering" (DNFBP supervision portal)**, https://u.ae/en/information-and-services/business/combatting-money-laundering. Do not attach specific article/circular numbers — none are visible in the extracted text.

**Reviewer note**: Recommend a manual re-fetch of the live page (JavaScript-rendered content may be missing from this extract) before any data update.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - The visible "website last updated" and "about us last updated" dates show **9 February 2024**, while the footer copyright now reads **© 2026** — suggesting a template/footer rollover rather than substantive content change.
  - No new publications, guidance, or STR-process content is evident in the extract; the "what's new" items remain dated 2019–2022.
  - This looks like **routine site churn** (footer/copyright/visitor-counter updates) rather than a material regulatory change.

- **Likely app impact**:
  - **Low / likely none.** No change to STR/SAR reporting obligations, goAML registration steps, or reporting-entity duties is visible.
  - Verify that any Regulatory Q&A topic referencing the **FIU/goAML STR reporting process** still points to the correct landing URL and navigation labels (e.g., "STR process," "reporting entities," "goAML").
  - No country/risk data in `index.html` and no Super Tools citations in `assets/super-data.js` appear to require updating based on this extract.

- **Suggested citation**:
  - If a citation refresh is warranted for the goAML/STR reporting reference, cite: **UAE Financial Intelligence Unit (FIU) — goAML portal, https://www.uaefiu.gov.ae/en/ (page last updated 9 February 2024).**
  - No new instrument, circular, or article number is visible in the text; do **not** add one without confirmation.

*Recommendation: No action required beyond confirming the URL/labels resolve correctly. Flag for routine re-check at next monitoring cycle.*

### Responsible Jewellery Council (RJC)

- **What appears to have changed**:
  - The homepage references **2026 governance updates** — new officer and board appointments following the "2026 AGM," and the publication of a **2026 Annual Progress Report**.
  - A **"Standards & Audit Changes Information Pack"** is now promoted, indicating updates to standards, audit, and certification requirements (no version numbers visible in the extract).
  - Membership count is now cited at **2,000+ members**; remaining content (standards overview, COP/CoC/LGMS framing) appears to be routine site refresh / 20th-anniversary marketing.

- **Likely app impact**:
  - **Regulatory Q&A topics**: Any answers referencing RJC standards for the precious metals/stones (DPMS) sector — particularly the three standards (Code of Practices, Chain of Custody, Laboratory Grown Material Standard) — may need a review against the flagged "Standards & Audit Changes" pack to confirm current scope and certification requirements.
  - **Super Tools citations (assets/super-data.js)**: Verify any RJC-related citation references the latest standard version and the 2026 documents rather than older editions.
  - **Country/risk data (index.html)**: No direct AML risk-rating impact. The member-count-by-country directory is informational only (e.g., UAE not separately enumerated in the truncated extract) and is unlikely to require risk-data changes.

- **Suggested citation**:
  - *Responsible Jewellery Council — Standards & Audit Changes Information Pack* (2026), and/or *RJC 2026 Annual Progress Report*, pending confirmation of exact standard version/edition numbers from the source. Cite only after verifying the underlying standards documents, as no specific version numbers are visible in the extracted text.

---
*Note: This is a proposal for MLRO review. The substantive change (standards/audit updates) should be confirmed by opening the linked information pack before any app edits, as the homepage extract does not disclose version numbers or effective dates.*
