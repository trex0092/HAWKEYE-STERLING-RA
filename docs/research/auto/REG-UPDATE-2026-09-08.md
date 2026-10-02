# Regulatory update proposal — 2026-09-08

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (the Arabic "الإعلانات الهامة – مارس 11 2021 – نشرة العلامات التجارية…" announcements/promotional carousel block). This indicates re-ordering, re-rendering or whitespace/encoding churn rather than substantive content change.
- The captured homepage text still shows the standard AML-relevant navigation items — "مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", "التسجيل في نظام goAML", "تشريعات مواجهة جرائم غسل الاموال" — with no new item, date, threshold or deadline visible.
- Remaining homepage changes are promotional/marketing (commodity price platform, investment portals, Zero Bureaucracy, We the UAE 2031); no DNFBP/DPMS supervisory notice is evident. This looks like routine site churn.

- **Likely app impact**: None expected. No change required to Regulatory Q&A topics on MoE-supervised DNFBP sectors (dealers in precious metals and stones, real estate brokers/agents, auditors, corporate service providers), goAML registration guidance, or TFS/UNSC listing obligations. Super Tools citations in `assets/super-data.js` pointing to the MoE homepage or its AML/CFT and TFS landing pages remain valid; no country or risk-rating fields in `index.html` are implicated. Optional housekeeping only: confirm deep links to the MoE AML/CFT and Targeted Financial Sanctions pages still resolve, since the homepage template appears to have been re-rendered.

- **Suggested citation**: No update warranted on this delta. If a citation refresh is nonetheless made, use: UAE Ministry of Economy — "مواجهة غسل الأموال وتمويل الإره

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: The two "added" segments are textually identical to the two "removed" segments (news carousel and events listing blocks). This is consistent with routine site churn — re-ordering/re-rendering of dynamic homepage modules rather than new content.
- **Content of note (pre-existing, not new)**: The news carousel references a "first tokenised commodity asset launched under DMCC-VARA framework" with a world-record silver bar, and DMCC establishing a "lab-grown diamond vertical"; the ecosystems navigation lists gold, diamonds, lab-grown diamonds, coloured gemstones, crypto and financial services/wealth hub.
- **No AML/CFT instrument, guidance, threshold or deadline is visible on the extracted page.** No DGJG-specific content is present in this capture — the monitored URL resolves to the DMCC corporate homepage.

- **Likely app impact**: Minimal / optional. If any refresh is undertaken on human review:
  - `assets/super-data.js` — DPMS/precious metals and stones topics could note that DMCC's free-zone ecosystem now formally includes a **lab-grown diamonds** vertical and **tokenised commodity** activity under a DMCC–VARA arrangement, which sits at the intersection of DPMS and virtual-asset obligations (relevant to CDD, source-of-funds and dual-supervision questions for DMCC-licensed dealers).
  - Any Q&A answer describing DMCC solely as a commodities free zone may be worth a wording check against the ecosystem list (gold, diamonds, lab-grown diamon
