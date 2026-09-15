# Regulatory update proposal — 2026-08-11

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are effectively identical text (the "الإعلانات الهامة / مارس 11 2021 / نشرة العلامات التجارية" announcements block plus promotional "القطاعات الواعدة / ملكية 100% للمستثمرين" carousel copy) — consistent with rotating banner/carousel ordering or whitespace-level re-rendering rather than content change.
- **No AML/CFT-specific content is visible in the delta**. The AML-relevant navigation items (مواجهة غسل الأموال وتمويل الإرهاب، العقوبات المالية المستهدفة، التسجيل في نظام goAML، تشريعات مواجهة جرائم غسل الاموال) remain present and unchanged in the extracted page text.
- Reads as routine site churn on the MoE homepage; the site now also carries the "وزارة الاقتصاد والسياحة" naming, which is a branding/portal matter rather than a regulatory one.

- **Likely app impact**: None expected. No change indicated for Regulatory Q&A topics on DNFBP/DPMS registration, goAML/SAR-STR filing, or Targeted Financial Sanctions obligations, nor for Super Tools citations in `assets/super-data.js` pointing at MoE DNFBP guidance. No country/risk data in `index.html` is affected. Optional housekeeping only: confirm any stored MoE links/labels still resolve (moec.gov.ae vs moet.gov.ae) and that the ministry name used in citations is current.

- **Suggested citation**: If any refresh is made, cite generically — "UAE Ministry of Economy — Anti-Money Laundering and Combating the Financing of Terrorism (DNFBP supervision) portal" and "UAE Ministry of Economy — Targeted Financial Sanctions / goAML registration pages". Do not attach any decision, circular or article number, as none appears in the captured text.

SEVERITY: LOW

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: The added and removed segments are textually identical (news carousel and events listing — "9% growth in indian companies", "Dubai Diamond Week", quarterly diamond tender 10–12 Aug 2026, member portal webinar 13 Aug 2026, Vietnam webinar 19 Aug 2026). This indicates re-ordering/re-rendering of dynamic promotional modules rather than substantive content change.
- **No AML/CFT-relevant content is visible in the delta**: no reference to DPMS obligations, DMCC AML rules, Goods AML/CFT (GoAML) registration, cash-transaction reporting, or supervisory notices.
- **The current page text is corporate/marketing in nature** (free zone positioning, corporate tax free-zone status, business setup steps) and contains no new compliance instrument. Assessed as routine site churn.

- **Likely app impact**: None required. No change to Regulatory Q&A answers on DPMS/gold-sector obligations, no change to Super Tools citations in `assets/super-data.js`, and no change to UAE sector/country risk data in `index.html`. Optionally note in the monitoring log that DMCC's homepage is a low-yield source for obligation changes; consider re-pointing the monitor to DMCC's compliance/AML pages or the MoE DPMS supervisory pages for higher signal.

- **Suggested citation**: None warranted from this delta. If a future substantive update appears, cite by visible title only — e.g. "DMCC — Compliance / AML-CFT guidance for DMCC member companies (dmcc.ae)" — alongside the existing UAE DPMS framework references (Federal Decree-Law No. 20 of 2018 and Cabinet Decision No. 10 of 2019) already used in the app.

SEVERITY: LOW — Identical added/removed news and events segments indicate routine dynamic-content churn with no obligation change.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The added and removed segments are textually identical (member-directory country counters, e.g. "canada (9) … china (35)"), indicating the diff was triggered by re-ordering/re-rendering of the "Find a member" country list rather than substantive content change.
- **No change detected** to RJC standards documents (Code of Practices, Chain of Custody, Laboratory Grown Material Standard), certification requirements, or policy pages in the extracted text.
- Homepage does reference an updated **ESG Toolkit**, **2026 Annual Progress Report** and post-**2026 AGM** board appointments, but these are not part of the detected delta and appear pre-existing on the page — flagged only for optional verification.
- Assessment: **routine site churn** (dynamic member counts), not a regulatory development.

- **Likely app impact**: None required. No action on `assets/super-data.js` Regulatory Q&A answers or Super Tools citations covering DPMS/precious metals and stones dealers (voluntary standards references), and no change to country/risk data in `index.html` — RJC member counts are not a risk-scoring input and the UAE figure is not visible in the truncated extract. If the reviewer wishes, a low-priority check that any existing RJC citation still points to the current CoP/CoC version numbers would be sufficient.

- **Suggested citation**: Only if an update is later warranted — "Responsible Jewellery Council, Code of Practices" and/or "Chain of Custody Standard" (RJC, global), cited as voluntary industry good practice alongside UAE Cabinet Decision No. (10) of 2019 obligations for DPMS and the MOE Guidance for DPMS; no article or circular numbers should be added on the basis of this delta.

SEVERITY: LOW — Identical added/removed text from dynamic member-directory counters; no obligation or standard change.

### European Commission — EU AI Act regulatory framework (incl. Digital Omnibus amendments)

- **What appears to have changed**:
  - The detected delta shows one added and one removed segment with effectively identical text (page footer/boilerplate: "last update 3 august 2026 … this site is managed by: directorate-general for communications networks, content and technology …"). This looks like routine site churn / re-extraction noise rather than a substantive amendment.
  - No change is visible in the substantive body text: the page still describes Regulation (EU) 2024/1689, the four-tier risk approach, and the nine prohibited practices.
  - Dates present in the current text and worth confirming against our stored content (not necessarily new in this delta): prohibitions 1–8 effective February 2025; prohibition 9 (AI-generated non-consensual sexually explicit/CSAM content, e.g. "nudification" apps), introduced via the AI Omnibus, effective December 2026; high-risk system obligations applying from 2 December 2027.

- **Likely app impact**:
  - Probably none required from this delta alone. If a check is done anyway, review any Regulatory Q&A entries in `assets/super-data.js` touching AI governance / AI-enabled transaction monitoring / model risk, to confirm the timeline references (Feb 2025 prohibitions, Dec 2026 prohibition 9, 2 Dec 2027 high-risk obligations) match the source.
  - Super Tools citations that reference the EU AI Act for AI-model or screening-tool governance should be verified for the correct regulation number (EU) 2024/1689 and current application dates.
  - EU country/risk data in `index.html`: no impact — this
