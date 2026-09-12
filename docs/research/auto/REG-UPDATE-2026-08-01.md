# Regulatory update proposal — 2026-08-01

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (Arabic homepage navigation/menu block and the "الإعلانات الهامة" announcements carousel, still dated مارس 11 2021 for the trademarks bulletin). This is consistent with routine re-rendering/re-ordering of the homepage boilerplate rather than substantive content change.
- No new AML/CFT instrument, threshold, deadline or guidance is visible in the delta. AML-relevant navigation items remain unchanged: "تشريعات مواجهة جرائم غسل الاموال", "مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", "التسجيل في نظام goAML", "الأنشطة الاقتصادية الواقعية".
- Note only: the page title now reads "وزارة الاقتصاد والسياحة" (Ministry of Economy and Tourism) with tourism sections present — a naming/mandate presentation point that may affect how the supervisor is labelled in our content, but no obligation change is evidenced here.

- **Likely app impact**: No content change required at this time.
  - `assets/super-data.js`: DNFBP/DPMS Q&A answers citing MoE as the DNFBP supervisor (registration/goAML, TFS screening, DPMS AED 55,000 cash-transaction reporting via DPMSR, real-estate reporting) — no edit needed; optionally verify deep links to the AML legislation and goAML registration pages still resolve, as homepage menus were re-rendered.
  - Super Tools citation labels naming "UAE Ministry of Economy" — flag for a possible cosmetic review against the "Ministry of Economy and Tourism" branding.
  - `index.html` country/risk data for the UAE: no change warranted; no FATF/risk-relevant signal in this delta.

- **Suggested citation**: If any refresh is made, cite generically: UAE Ministry of Economy — "موا

### OECD — Responsible Mineral Supply Chains (CAHRA)

- **What appears to have changed**: The added and removed segments are textually identical ("read the declaration… OECD Guidelines for Multinational Enterprises on Responsible Business Conduct… discover the guidelines (PDF…"), indicating a re-ordering, re-rendering or minor markup change rather than substantive new content.
- **Current page text could not be retrieved (HTTP 403)**, so the live content cannot be verified against the delta; the diff is based on cached/prior extraction only.
- **On the evidence available this is routine site churn** — no new instrument, threshold, obligation or deadline is visible. No change to the OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas is indicated.

- **Likely app impact**: Probably none. If a re-check confirms no substantive change, leave as-is. Items to spot-check only if a later fetch succeeds and shows real changes:
  - `assets/super-data.js` — Super Tools citations referencing OECD responsible business conduct / CAHRA due diligence in the DPMS / gold and precious metals dealer tooling.
  - `assets/super-data.js` — Regulatory Q&A entries on DNFBP obligations for dealers in precious metals and stones, responsible sourcing and supply-chain due diligence expectations.
  - `index.html` — CAHRA-linked country/jurisdiction risk flags used in country risk scoring (no update warranted on this delta).

- **Suggested citation**: OECD Guidelines for Multinational Enterprises on Responsible Business Conduct (2023 edition) and, for CAHRA-specific references, the OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas (Third Edition) — cite only if a verified substantive change is confirmed.

SEVERITY: LOW — Identical added/removed text plus a 403 fetch indicates routine site churn, not a substantive

### Responsible Jewellery Council (RJC)

- **What appears to have changed**: The "Find a Member" directory listing is the only affected block — one member record was re-labelled (previously "pistis daniele valenza, italy", now "pistis gioielli di pistis daniele … italy"). Surrounding entries (Gem and Jewelry Institute of Thailand, Jam Jewels Inc, United Brothers Jewelry Inc, East Arts Jewelry Mfy Ltd) are unchanged.
- The added and removed country-count segments (Afghanistan through China, e.g. Belgium 134, India 294, Italy 333, Hong Kong 84) appear identical in the captured text, indicating re-rendering of the same directory rather than a substantive count change. No UAE-specific figure is visible in the truncated extract.
- No change detected to standards, Code of Practices, Chain of Custody, LGMS, audit/certification requirements, or governance pages. This reads as routine directory/site churn.

- **Likely app impact**: None expected. If a review is undertaken, the only candidates are: (a) any Regulatory Q&A answer referencing RJC certification as a DPMS due-diligence/counterparty credibility indicator, to confirm the "verify membership status on the RJC member directory" wording still holds; (b) Super Tools citations in `assets/super-data.js` that point to RJC standards documents — unaffected by this delta; (c) country/risk data in `index.html` — no change warranted, as no UAE member count or jurisdiction-level data shift is evidenced. Recommend no edit at this time.

- **Suggested citation**: Responsible Jewellery Council, *Find a Member* directory (responsiblejewellery.com) — cite only as a voluntary industry-scheme verification source, subordinate to CBUAE

### European Commission — EU AI Act regulatory framework (incl. Digital Omnibus amendments)

- **What appears to have changed**: The governance section has been retitled from "Governance and implementation" to "Governance and enforcement" and now attaches a start date — the AI Office and Member State authorities are responsible for implementing, supervising and enforcing the AI Act **from 2 August 2026**.
- **New explicit statement of AI Office enforcement powers over GPAI models**: it can request technical documentation, evaluate models, require corrective measures and issue fines for non-compliance. The AI Board / scientific panel / advisory forum language is unchanged (re-ordered only).
- A standalone "find out more" link and the prior "application timeline" narrative block were removed; the current page instead carries dated milestones in the risk-tier sections (prohibitions
