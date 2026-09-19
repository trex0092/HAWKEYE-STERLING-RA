# Regulatory update proposal — 2026-09-03

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (Arabic homepage banner content: "الإعلانات الهامة – مارس 11 2021 – نشرة العلامات التجارية…", promotional 100% investor-ownership and investment-sector tiles). This is a null diff — most likely carousel/banner re-ordering, whitespace or markup churn rather than substantive content change.
- **No AML/CFT-specific content is visible in the delta**: no reference to DNFBP/DPMS obligations, goAML registration, targeted financial sanctions, or supervisory circulars/penalties.
- **Current page could not be fetched** (`UND_ERR_CONNECT_TIMEOUT`), so the live state is unverified; the diff alone does not evidence a regulatory update. Recommend a re-fetch on the next cycle before any action.

- **Likely app impact**: None expected at this time.
  - `assets/super-data.js`: no change proposed to Regulatory Q&A entries covering DNFBP supervision, DPMS AML obligations, goAML registration/reporting, or MoE supervisory role; existing MoE citations remain valid.
  - `index.html`: no change to UAE country/risk data, DNFBP sector risk flags, or supervisor mapping.
  - Action for reviewer: re-poll the MoE site (and the MoE AML/CFT sub-pages, which are the more reliable monitoring target than the homepage) to confirm nothing substantive was missed behind the failed fetch.

- **Suggested citation**: None warranted from this delta. If a re-fetch surfaces substantive AML content, cite generically as "UAE Ministry of Economy — Anti-Money Laundering / DNFBP supervision pages (moec.gov.ae)" with the retrieval date; do not attribute a circular or article number unless it is visible on the page. Note also that MoE's canonical domain is now `moec.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The homepage news/media carousel rotated. A new item referencing a UAEFIU-convened roundtable on **the misuse of legal persons** and strengthening AML/CFT efforts replaced the earlier item on the inaugural UAE–UK "Combined Anti-Money Laundering Operational Team" meeting.
- The UAEFIU–Pakistan FMU MoU press release remains present; only the trailing item in that block changed (a second, unnamed MoU reference dropped out). The EAG 2026 forum item is unchanged.
- No change is visible to reporting obligations, STR/SAR processes, goAML/IEMS portal instructions, thresholds or deadlines. This reads as routine news-carousel churn on the homepage rather than a regulatory update.

- **Likely app impact**:
  - Low/no mandatory impact. Optional refresh candidates only:
    - `assets/super-data.js` — any UAEFIU citation strings pointing to homepage news items (e.g. international cooperation/MoU or FIU outreach references) could be re-pointed to stable pages (STR process, Insights & Publications) rather than rotating homepage content.
    - Legal-persons / beneficial-ownership Q&A topics (misuse of corporate structures, shell companies) — the roundtable is a signal, not a new rule; no answer text change needed unless a resulting publication appears.
    - `index.html` country/risk data — no change; the Pakistan MoU is information-exchange cooperation and does not alter any UAE country risk rating or listing.
  - Watch item: the published **"Drug Trafficking Networks: Patterns and Threat Actors" (2024–2025 strategic analysis, with NDEA)** and **UAEFIU Annual Report 2025** are visible on the page — confirm these are already cited in typology/red-flag Q&A content; if not, they are stronger update candidates than this delta.

- **Suggested citation**: If any update proceeds, cite UA

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: The added and removed segments are textually identical (news/insights carousel strip referencing "DMCC establishes lab-grown diamond vertical as UAE trade reaches record 76.9 million carats" and the DMCC Gaming Centre / Serbian Games Association item). This indicates re-ordering or re-rendering of a dynamic homepage module rather than substantive new content.
- **No AML/CFT-specific content is visible in the delta**: no changes to compliance notices, DPMS obligations, registration/licensing requirements, thresholds or deadlines appear in the extracted text.
- **Assessment**: routine site churn on a marketing/homepage. The underlying themes (lab-grown diamonds vertical, gaming/crypto/AI ecosystems) are already reflected in the current page navigation and are not new as of this delta.

- **Likely app impact**: None required at this time. For awareness only, if a future substantive DMCC update lands, the candidates would be: (a) Regulatory Q&A entries on DNFBP/DPMS obligations for precious metals and stones dealers operating in free zones (DMCC as the sector supervisor/free-zone authority context); (b) any Super Tools citation in `assets/super-data.js` pointing to DMCC as a source for DPMS/gold-sector guidance — the URL and title remain valid, so no citation edit is needed; (c) `index.html` country/risk data for the UAE — unchanged, as no risk-relevant designation, threshold or typology is introduced. Optional low-priority note: the "lab-grown diamonds" ecosystem line could be flagged for a future review of whether existing DPMS Q&A wording captures lab-grown/synthetic stones, but this is a content-completeness question, not a change triggered by this delta.

- **Suggested citation**: No new citation warranted. If an update is later made, cite the existing

### US OFAC — Recent Actions

- **What appears to have changed**: A new top-of-list entry dated **September 02, 2026** — "Reminder to file the 2026 Annual Report of Blocked Property; Issuance of Amended Venezuela-related General Licenses and Frequently Asked Question" (categorised as *General Licenses*). No deadline date is stated in the extracted text.
- Page-1 rotation: the older **August 06, 2026** Cuba-related designations / Cuba FAQ items have been pushed off page 1 by the new entry; the August 28 (Iran / counter-terrorism), August 27 (Venezuela GLs) and August 07 (Iran FAQ) items remain but shifted position. Result count unchanged in substance (3,150 results).
- Net: mostly routine list churn, with **one genuinely new item** (the blocked-property annual report reminder plus amended Venezuela GLs/FAQ).

- **Likely app impact**:
  - `assets/super-data.js` — Sanctions Screening / Targeted Financial Sanctions Super Tool: OFAC "Recent Actions" reference date may need refreshing; consider whether the Venezuela general-licence position noted in any GL/exemption guidance is still current.
  - Regulatory Q&A topics on **US secondary sanctions exposure / correspondent banking / USD clearing

### Responsible Jewellery Council (RJC)

- **What appears to have changed**: The added/removed segments are effectively identical strings from the "Find a member" country directory (member counts per jurisdiction, e.g. canada (8), chile (1), china (35)) — this is a re-render/count refresh of the member-lookup widget, not a change to standards text.
- **A second added segment lists individual member entries ("vicenza, italy… hilal gold kuyumculuk mücevherat san."), consistent with the rotating/expanding member directory listing.**
- No visible change to the Code of Practices, Chain of Custody, Laboratory Grown Material Standard, assurance/audit requirements, or any policy document; homepage narrative content (2,100+ members, 2026 APR, ESG toolkit, 2026 AGM appointments) is unchanged in substance. This looks like routine site churn.

- **Likely app impact**: Minimal. No mandatory edits identified.
  - `assets/super-data.js`: any DPMS/precious metals & stones Q&A that cites RJC CoP/CoC as a voluntary due-diligence benchmark (e.g. responsible sourcing, supply-chain due diligence for gold/diamond dealers) remains valid — no version or clause change to reflect.
  - `index.html` country/risk data: no change required; RJC member counts are commercial membership data, not risk indicators, and should not be used as a jurisdiction risk input.
  - Optional housekeeping only: if any Super Tool references an RJC annual report or toolkit, note that a **2026 Annual Progress Report**, updated **ESG Toolkit** and new **Communications Toolkit** are now published and could be re-linked at the next scheduled refresh.

- **Suggested citation**: Only if a refresh is made — *Responsible Jewellery Council, Code of Practices* and/or *Chain of Custody Standard* (with *RJC 2026 Annual Progress Report* for the toolkit/reporting reference). No UAE instrument citation change warranted; UAE DPMS obligations continue to rest on the AML
