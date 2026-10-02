# Regulatory update proposal — 2026-08-05

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (same "الإعلانات الهامة – مارس 11 2021" announcement banner and investment-promotion carousel copy), indicating a re-render/re-ordering of homepage content rather than substantive new text.
- No AML/CFT-specific content changed in the delta: the standing navigation items (مواجهة غسل الأموال وتمويل الإرهاب، العقوبات المالية المستهدفة، التسجيل في نظام goAML، تشريعات مواجهة جرائم غسل الاموال، الأنشطة الاقتصادية الواقعية) remain present and unaltered.
- Assessment: routine site churn (banner/carousel rotation or CMS re-publication), not a regulatory publication.

- **Likely app impact**: None required. No changes needed to Regulatory Q&A topics on DNFBP/DPMS supervision, goAML registration, or Targeted Financial Sanctions obligations; no Super Tools citation updates in `assets/super-data.js`; no UAE country/risk data changes in `index.html`. Optional housekeeping only: confirm the MoE homepage/AML landing links still resolve (site now branded "وزارة الاقتصاد والسياحة" — Ministry of Economy and Tourism), and consider aligning the supervisor name label if the app still uses "Ministry of Economy" alone.

- **Suggested citation**: No new instrument to cite. If a label refresh is made, cite: UAE Ministry of Economy and Tourism — "مواجهة غسل الأموال وتمويل الإرهاب" / AML-CFT supervisory pages for DNFBPs (moec.gov.ae), retaining existing citations to Federal Decree-Law No. (20) of 2018 and Cabinet Decision No. (10) of 2019 as already referenced in the app.

SEVERITY: LOW — Added and removed segments are identical homepage banner text; no AML/CFT oblig

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: The added and removed segments are textually identical (DMCC events listing: "quarterly auction tender diamonds 10 Aug 2026 – 12 Aug 2026", "DMCC member portal training webinar 13 Aug 2026", "Vietnam webinar / Made for Trade 25 Aug 2026"), indicating a re-render or reordering of the events/"What's on" carousel rather than substantive content change.
- **Current page text is general corporate/marketing content** (free zone positioning, 26,000+ companies, corporate tax free-zone status, business setup steps, Future of Trade Report 2026). No AML/CFT obligations, DPMS-specific guidance, thresholds or deadlines are visible.
- **Assessment**: routine site churn — no regulatory delta detected on this capture.

- **Likely app impact**: None required. No change needed to Regulatory Q&A topics (DPMS/precious metals & stones due diligence, cash threshold reporting, DNFBP registration), Super Tools citations in `assets/super-data.js`, or UAE country/sector risk data in `index.html`. Optional housekeeping only: confirm the existing DMCC/DPMS sector references still resolve to live URLs, and note that the free-zone corporate tax reference (Federal Decree-Law No. 47 of 2022) appearing on the page is tax, not AML/CFT, and should not be cited as an AML source.

- **Suggested citation**: No update warranted. If a sector reference is nonetheless refreshed, cite the page generically as "DMCC — Official Website (Free Zone / Precious Stones & Metals Ecosystem), dmcc.ae, accessed [date]"; for substantive DPMS obligations continue to rely on the UAE AML/CFT framework (Federal Decree-Law No. 20 of 2018 and Cabinet Decision No. 10 of 2019) and M

### Responsible Minerals Initiative (RMI)

- **What appears to have changed**: The extracted page is now only a bot-verification interlude ("one moment, please… please wait while your request is being verified"), indicating the crawl was blocked by an anti-bot/WAF challenge rather than served the news index.
- **The 28 "removed" segments are the site's standard navigation, taxonomy (minerals due diligence, ASM, cobalt, ESG, OECD Annex II risks, CAHRAs, Global Risk Map, RRA) and news teasers — their disappearance reflects the blocked fetch, not content deletion.
- **No new obligation, standard revision, threshold or deadline is visible in the captured text. Treat as a monitoring/collection failure, i.e. routine churn rather than a substantive regulatory change.**

- **Likely app impact**: None warranted on this delta alone. No edits to Regulatory Q&A answers on DPMS/precious metals and minerals supply-chain due diligence, no changes to Super Tools citations in `assets/super-data.js` (OECD Due Diligence Guidance / RMI-linked references), and no changes to CAHRA or country/risk flags in `index.html`. Action is technical: re-fetch with a headless/allow-listed crawler or switch the monitored URL to RMI's press/announcements feed, then re-diff. One previously visible headline (RMI All Minerals Standard / LME recognition, dated in the removed text) should be re-verified on a successful fetch before any content decision, as it may be relevant to DPMS-sector guidance.

- **Suggested citation**: No new instrument to cite. If a successful re-fetch confirms substantive content, cite as: Responsible Minerals Initiative, "News" (RMI/RBA, undated web page, accessed [date]) — and, where DPMS due-diligence expectations are being described, anchor to the OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas alongside the applicable UAE DPMS guidance already cited in the

### LBMA — Responsible Sourcing

- **What appears to have changed**: The crawl returned only an anti-bot/verification interstitial ("one moment, please...", "please wait while your request is being verified..."), replacing the full page navigation and content text. No substantive policy or standard text was captured.
- **What appears to have changed**: The 78 removed segments are navigation, membership and Good Delivery menu boilerplate — consistent with a failed fetch rather than a content withdrawal. This is a monitoring artefact, not a detected amendment to the Responsible Sourcing Programme.
- **What appears to have changed**: No evidence of new or amended obligations, thresholds, deadlines or versions of the Responsible Gold/Silver Guidance in the captured text.

- **Likely app impact**: None warranted on this delta alone. If a manual re-check later confirms a genuine update, the areas to review would be: Regulatory Q&A topics on precious metals / DPMS due diligence and gold supply-chain sourcing; Super Tools citations in `assets/super-data.js` referencing LBMA Responsible Sourcing / Good Delivery List as an international benchmark alongside UAE Good Delivery Standard and OECD Due Diligence Guidance; and any high-risk gold-origin jurisdiction notes in `index.html` country/risk data. No changes recommended now.

- **Suggested citation**: LBMA — Responsible Sourcing Programme (https://www.lbma.org.uk/responsible-sourcing), to be re-verified on a successful fetch before any citation text is amended.

SEVERITY: LOW — Bot-verification interstitial captured instead of page content; no substantive change evidenced.

### Responsible Jewellery Council (RJC)
_AI draft unavailable (HTTP 529). Review manually: https://www.responsiblejewellery.com/_
