# Regulatory update proposal — 2026-06-29

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: 
  - The extracted content is almost entirely site-wide navigation/menu chrome (now reflecting "وزارة الاقتصاد والسياحة" / Ministry of Economy *and Tourism* branding, including tourism sections). No substantive AML/CFT body text, dates, or new instrument titles are visible in the extract.
  - This looks like routine site churn / a rebrand-and-restructure of the portal rather than a substantive AML policy change. Navigation still surfaces the expected AML touchpoints: "مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", and "التسجيل في نظام goAML".
  - Cannot confirm any change to guidance, deadlines, or obligations from this extract alone; the captured text is insufficient to verify the actual AML page content.

- **Likely app impact**: 
  - Low/likely none from this capture. If verified, the only probable update is cosmetic: the supervisor's name (now "Ministry of Economy and Tourism") in any source label used in `assets/super-data.js` Regulatory Q&A entries referencing the MoE as DNFBP/DPMS supervisor.
  - Check goAML registration guidance and Targeted Financial Sanctions (TFS) Q&A topics for the correct MoE landing URL, in case the path moved during the restructure.
  - No country/risk data in `index.html` is implicated by this change.

- **Suggested citation**: 
  - Cite the page generically as **UAE Ministry of Economy — Anti-Money Laundering (DNFBP/DPMS supervision)**, `https://www.moec.gov.ae/en/anti-money-laundering`. 
  - Do **not** add any article/circular number — none is present in the extract. Recommend a manual re-fetch of the live page to confirm whether substantive content (not just navigation) actually changed before editing.

---
*Reviewer note: This proposal is based on a truncated

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - The extracted content reflects general FIU homepage navigation, focus areas, and a "what's new" list whose most recent dated item is 9 February 2024 (website last updated), with no newer publications, MoUs, or guidance visible.
  - Footer shows a "© 2026" copyright marker, but this is a generic boilerplate/rollover and not evidence of substantive content change.
  - This looks like **routine site churn** (template/copyright/rendering changes) rather than a substantive AML/CFT regulatory update. No new STR/goAML process changes, laws, or decisions are visible in the extracted text.

- **Likely app impact**:
  - Low/no immediate impact. No changes to reporting obligations, STR/goAML submission process, or reporting-entity requirements are evident.
  - If desired, verify that any **goAML / STR process** references in `assets/super-data.js` (Regulatory Q&A on suspicious transaction reporting, FIU reporting workflow) still align with the live FIU page — but no update is warranted based on this extract.
  - No country/risk data changes in `index.html` indicated; FIU homepage churn does not affect jurisdictional risk ratings.

- **Suggested citation**:
  - No update warranted at this time. If a citation refresh is performed for the FIU reporting workflow, cite generically: **UAE Financial Intelligence Unit (FIU) — goAML portal**, https://www.uaefiu.gov.ae/en/ (page last updated 9 February 2024). Do not cite any specific report, MoU, or decision number, as none newer is confirmed in the extract.

### EU — Financial Sanctions

- **What appears to have changed**: 
  - The extracted content is the EU Commission's standard sanctions landing/navigation page, with no specific new sanctions regime, listing, or instrument visible in the text.
  - A reference to the "EU Sanctions Helpdesk" appears as a compliance support resource, but no dated update or regime change is evident.
  - This looks like routine site churn (navigation/menu restructuring, page refresh) rather than a substantive regulatory change.

- **Likely app impact**: 
  - **Low/none** based on this snapshot. No specific list, threshold, or obligation change to map.
  - If any Regulatory Q&A topic references the EU sanctions framework as a screening source, confirm the landing URL still resolves; no answer content change appears warranted.
  - Super Tools citations in `assets/super-data.js` referencing EU sanctions can remain unchanged; verify the linked URL is current.
  - No country/risk data in `index.html` requires updating from this change.

- **Suggested citation**: 
  - If a citation refresh is desired, cite generically: *European Commission — Sanctions (restrictive measures)*, EU and the world, DG FISMA (page URL above). 
  - Do **not** add any specific regulation/regime number — none is visible in the extracted text.

**Reviewer note**: Recommend no action pending confirmation. Suggest re-checking the "Overview of sanctions and related resources" and "Sanctions adopted following Russia's military aggression against Ukraine" sub-pages for substantive updates, as the monitored landing page itself shows only navigational content.
