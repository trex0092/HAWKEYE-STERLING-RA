# Regulatory update proposal — 2026-10-01

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (same "الإعلانات الهامة / مارس 11 2021 / نشرة العلامات التجارية" announcement block and investment promo copy), indicating re-rendering or re-ordering of homepage content rather than new substance.
- **No AML/CFT-relevant content is visible in the delta**: the AML navigation items (تشريعات مواجهة جرائم غسل الاموال، مواجهة غسل الأموال وتمويل الإرهاب، العقوبات المالية المستهدفة، التسجيل في نظام goAML) remain present and unchanged in the current page text.
- **Assessment**: routine site churn — carousel/banner and promotional content (e.g., commodity price platform, price-increase requests, "نحن الإمارات 2031") dominates the captured text; no new instrument, deadline or threshold is shown.

- **Likely app impact**: None identified at this time. No change required to Regulatory Q&A topics on DNFBP/DPMS supervision, goAML registration, or Targeted Financial Sanctions obligations; no Super Tools citation edits in `assets/super-data.js`; no country/risk data changes in `index.html`. Suggest keeping existing MoE links to the AML legislation and goAML registration pages as-is, and monitoring the dedicated AML/CFT and "الإصدارات" sub-pages (rather than the homepage) for substantive supervisor guidance.

- **Suggested citation**: If an update is later warranted, cite the MoE landing pages by title only — "UAE Ministry of Economy — مواجهة غسل الأموال وتمويل الإرهاب (Anti-Money Laundering and Combating the Financing of Terrorism)" and "UAE Ministry of Economy — التسجيل في نظام goAML (goAML Registration)", moet.gov.ae. No circular or article number is visible in this delta and none should be cited.

SEVERITY: LOW — Added

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The two "added" segments are textually identical to the two "removed" segments — both are fragments of the dynamic member directory (country member counts, e.g. canada (9), china (35); and the rotating "find a member" result list). This is consistent with re-ordering/re-rendering of the directory rather than substantive content change.
- **Homepage substance is unchanged in nature**: standards framework still listed as Code of Practices (CoP), Chain of Custody (CoC), and Laboratory Grown Material Standard (LGMS); promotional items reference an updated ESG toolkit, a new communications toolkit, 2026 AGM board appointments, and the 2026 Annual Progress Report — none of which alter standards requirements as visible in this extract.
- **Assessment**: routine site churn / dynamic listing refresh. No new obligation, threshold, instrument or deadline is visible in the captured text.

- **Likely app impact**: None required. If desired, a low-priority verification pass only:
  - `assets/super-data.js` — any DPMS/precious metals & stones Q&A or Super Tools citation that references RJC CoP / CoC / LGMS as a voluntary due-diligence or responsible-sourcing benchmark (confirm the three-standard naming, especially "Laboratory Grown Material Standard", is current).
  - `index.html` — no country/risk data change indicated; RJC member counts are not a risk input and should not be used as such.
  - Consider re-scoping the monitor to standards/policy pages (e.g. Standards, Code of Practices, Policies) instead of the homepage to reduce false positives from the member directory.

- **Suggested citation**: Responsible Jewellery Council — *Code of Practices*, *Chain of Custody Standard* and *Laboratory Grown Material Standard* (RJC, responsiblejewellery.com), cited only as a voluntary industry standard alongside the UAE AML/CF

### European Commission — EU AI Act regulatory framework (incl. Digital Omnibus amendments)

- **What appears to have changed**:
  - The only detected delta is in the "Latest news" teaser block: a press release item ("29 September 2026 — Commission seeks fee…") was replaced by a DigiByte item ("01 October 2026 — EDIC for agri-food launches…"). This is a rotating news feed, not substantive page content.
  - The substantive body text remains consistent with the current baseline: risk-based approach, nine prohibited practices (prohibitions 1–8 effective February 2025; prohibition 9 on non-consensual sexually explicit/CSAM "nudification" content effective December 2026, introduced via the AI Omnibus), and high-risk obligations applying from 2 December 2027.
  - Assessment: routine site churn (news carousel rotation), with no visible change to obligations, scope, thresholds or dates.

- **Likely app impact**:
  - No change required on this delta alone. No edits needed to Regulatory Q&A answers covering AI governance / automated decision-making in AML (e.g. AI-assisted transaction monitoring, sanctions screening model governance) or to Super Tools citations in `assets/super-data.js`.
  - Optional verification pass only: confirm any existing EU AI Act references in `assets/super-data.js` already reflect the current baseline dates (prohibition 9 from December 2026; high-risk obligations from 2 December 2027) and the "AI Omnibus"/Digital Omnibus simplification track, since these appear in the current page text.
  - No impact on country/risk data in `index.html` — the EU AI Act is not an AML/CFT listing instrument and does not affect UAE jurisdictional risk scoring.

- **Suggested citation**: Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence (EU AI Act), European Commission — "AI Act", Shaping Europe's Digital Future (as amended via the Digital/AI Omnibus) — only if an update is otherwise triggered.

S
