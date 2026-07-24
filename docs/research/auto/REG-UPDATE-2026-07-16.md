# Regulatory update proposal — 2026-07-16

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are near-identical navigation/menu boilerplate and homepage announcement banners (asset-publisher content), indicating routine re-rendering rather than substantive change. The only genuinely dropped content is a dated news item ("08 Jun 2026 — private joint-stock companies to hold general assemblies before 30 June 2026"), which is a corporate-governance news notice, not an AML/CFT obligation.
- **Likely app impact**: None warranted. No changes to DNFBP/DPMS AML obligations, TFS, or goAML registration content are visible. The persistent AML-relevant menu items (تشريعات مواجهة جرائم غسل الاموال, مواجهة غسل الأموال وتمويل الإرهاب, العقوبات المالية المستهدفة, التسجيل في نظام goAML) remain unchanged, so existing Regulatory Q&A topics and `assets/super-data.js` citations for MoE DNFBP supervision and goAML should still be accurate. No country/risk data in `index.html` needs updating.
- **Suggested citation**: If any refresh is later justified, cite the MoE landing page section "مواجهة غسل الأموال وتمويل الإرهاب" (AML/CFT) / "التسجيل في نظام goAML" — no specific article or circular number is visible in the extracted text and none should be invented.

SEVERITY: LOW — Detected delta is navigation/announcement boilerplate churn with no AML/CFT obligation, threshold, or deadline change.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The only delta is the visitor counter (from ~2,099,679 to ~2,101,045). No changes to content, obligations, instruments, or dates ("last updated 9 February 2024" is unchanged).
- **Likely app impact**: None. This is routine site churn (auto-incrementing visitor metric). No Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html` require updating based on this delta.
- **Suggested citation**: No update warranted. If a general reference to the FIU/goAML reporting portal is ever needed, cite: UAE Financial Intelligence Unit (FIU) — goAML, https://www.uaefiu.gov.ae/en/.

SEVERITY: LOW — Only the page visitor counter changed; no substantive content, obligations, or dates affected.

### Dubai Gold & Jewellery Group / DMCC (sector)
- **What appears to have changed**: The detected delta shows an identical text segment added and removed — a DMCC news/insights item about an MoU with the Botswana Stock Exchange Group for a trade corridor. This is a net-zero change (same string in/out), consistent with routine news-feed reordering or re-rendering.
- No AML/CFT obligation, threshold, instrument, or deadline is visible in the added/removed content or the current page text. The page is DMCC's general free-zone marketing landing content.

- **Likely app impact**: None indicated. No changes required to Regulatory Q&A topics/answers or Super Tools citations in `assets/super-data.js`, nor to country/risk data in `index.html`. If desired, the DMCC–Botswana commodity trade-corridor item could be noted as background context for DPMS (precious stones & metals) sector risk, but it carries no regulatory weight on its own.

- **Suggested citation**: None warranted from this delta. If DMCC's role as a DNFBP/free-zone supervisor is referenced elsewhere in the app, retain existing citations (e.g., Cabinet Decision No. 10 of 2019 and the DMCC AML/CFT framework) — do not add new references based on this change.

SEVERITY: LOW — Net-zero news-feed churn (identical segment added and removed); no obligations, thresholds, or instruments affected.

### Wolfsberg Group
- **What appears to have changed**: The homepage's featured news headline was updated — the lead item now promotes new "Guidance on the provision of banking services to non-bank payment service providers (PSPs)" (2026, English), which also appears as a new entry in the Resources list.
- The prior lead reference to "updated guidance on the risk-based approach" and some risk-based-approach narrative text (e.g., FAQs history and RBA "fear/ambitions" commentary) were removed from the visible homepage copy, though the RBA guidance itself still appears in the Resources list.
- Otherwise this looks largely like homepage carousel/news reordering rather than a change to underlying standards.

- **Likely app impact**:
  - **Regulatory Q&A**: Topics on correspondent banking / PSP relationships and payment transparency may warrant a note referencing the new non-bank PSP guidance. RBA-related answers should be checked for currency (updated 2026 RBA guidance now listed).
  - **Super Tools (assets/super-data.js)**: Any Wolfsberg citations for RBA, stablecoin/digital-asset banking services, or suspicious activity monitoring may benefit from year/title verification against the current 2025–2026 resource titles.
  - **Country/risk data (index.html)**: No direct UAE country or threshold impact identified; Wolfsberg materials are global best-practice, non-binding for DNFBPs/FIs unless referenced in guidance.

- **Suggested citation**: *The Wolfsberg Group — Guidance on the Provision of Banking Services to Non-Bank Payment Service Providers (PSPs), 2026* (verify exact title/date on source before citing).

SEVERITY: MEDIUM — New Wolfsberg PSP-banking guidance surfaced; substantive best-practice update worth reviewing, but no binding UAE obligation or threshold change.

### US OFAC — Recent Actions

- **What appears to have changed**: The Recent Actions feed rolled forward to newer dated entries — a July 15, 2026 update ("non-proliferation designations; counter terrorism designations") appears at the top, and an older "russia-related designations removals" segment scrolled off. This is consistent with routine feed churn as new designations are published.
- **Likely app impact**: No new obligation, threshold, or instrument is introduced. The added items are routine SDN/list updates (non-proliferation, counter-terrorism, Iran-related). No changes to Regulatory Q&A topics or Super Tools citations in `assets/super-data.js` are indicated by the delta itself. If the app relies on live OFAC SDN/Consolidated list screening, ensure the sanctions list feed is refreshed — but this is operational, not a content edit. No country/risk data in `index.html` requires updating based on this delta.
- **Suggested citation**: If any reference is warranted, cite generically: "US OFAC — Recent Actions" (https://ofac.treasury.gov/recent-actions). Do not cite specific program/GL numbers, as none are visible in the extracted text.

SEVERITY: LOW — Routine rollover of dated OFAC list-update entries; no new obligations, thresholds, or instruments.

### UK OFSI — Consolidated List of Targets

- **What appears to have changed**: The detected delta itself is cosmetic (punctuation/formatting: "published:" vs "published", "last updated:" vs "last updated"). However, the surrounding page text confirms a **material development**: the OFSI Consolidated List has **closed as of 28 January 2026**, and the page is now marked **[withdrawn]**.
- The **UK Sanctions List is now the sole source** for all UK sanctions designations; the consolidated list is no longer updated.
- Existing financial sanctions notices published before 28 January 2026 remain viewable, but no new entries will be added here.

- **Likely app impact**:
  - **Super Tools / `assets/super-data.js`**: Any citation or link pointing to the OFSI Consolidated List (gov.uk publication or the `sanctionssearchapp.ofsi.hmtreasury.gov.uk` search) should be repointed to the **UK Sanctions List**. Screening/name-check tool references to OFSI should be reviewed.
  - **Regulatory Q&A topics**: Any answer describing UK sanctions sources, sanctions screening against UK lists, or "which list to check" for UK-nexus clients needs updating to reflect the single authoritative UK Sanctions List.
  - **`index.html` country/risk data**: Low direct impact, but any UK sanctions-source references in methodology/notes should be updated for accuracy.

- **Suggested citation**: OFSI / HM Treasury — "Who is subject to financial sanctions in the UK?" (published 19 June 2013, withdrawn 28 January 2026), superseded by the **UK Sanctions List** (gov.uk). No circular/instrument number is visible in the text; cite the withdrawal notice and the UK Sanctions List as the replacement source.

SEVERITY: MEDIUM — Detected delta is formatting-only, but the page confirms the OFSI Consolidated List has closed and been replaced as the authoritative UK sanctions source, warranting citation/source review.

### Egmont Group of FIUs

- **What appears to have changed**: A new featured public statement was published (dated July 15, 2026) on "advancing the future of public-private partnerships in combating money laundering and terrorist financing." The 2026 Egmont Plenary co-chairs' statement (Baku, Azerbaijan, July 13, 2026) is now featured at the top of the news feed.
- **Removed segments** reflect ordinary feed rotation: earlier featured items (FATF June 2026 plenary collaboration, customs–FIU webinar, the strategy consultant RFP) have dropped from the featured/top position but generally still appear further down the page.
- Net effect: this is primarily news-feed reordering with one genuinely new item — the public-private partnership (PPP) public statement.

- **Likely app impact**:
  - **Regulatory Q&A**: Topics on FIU information sharing, public-private partnerships (PPPs), and international cooperation could reference the new Egmont statement as supporting context. No obligation or threshold change is evident — do not alter answer substance.
  - **Super Tools citations (assets/super-data.js)**: If any citation points to Egmont "news and events" as a general source, verify the link still resolves; no specific instrument citation needs updating.
  - **Country/risk data (index.html)**: No UAE-specific or country-risk data impact. UAE FIU obligations flow from CBUAE/goAML and national law, not from this Egmont news item.

- **Suggested citation** (only if an update is warranted for PPP-related context):
  - "Public Statement by the Egmont Group of Financial Intelligence Units – Advancing the Future of Public-Private Partnerships in Combating Money Laundering and Terrorist Financing" (Egmont Group, 15 July 2026).

SEVERITY: LOW — Feed reordering plus one non-binding public statement; no new obligations, thresholds, or deadlines.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The RJC member directory was updated — several certified members were added (e.g., Bhavya Gems & Jewels (India), Kendall Steven LLC dba Legacy Findings (USA), Colorline Inc., Ashoka Global (TH) Ltd.) and others removed (e.g., Vinodkumar Diamonds Pvt Ltd (India), La Quinta Stagione S.p.A (Italy), Montremo SA (Switzerland), Myer Jewelry Manufacturer Ltd (Hong Kong)).
- The per-country member counters and alphabetical listing reindexed as a result.
- No changes to standards, obligations, thresholds, or certification requirements are visible; this looks like routine membership-directory churn.

- **Likely app impact**: Minimal. RJC is relevant to DPMS (Dealers in Precious Metals and Stones) due diligence context. If assets/super-data.js references RJC membership as a counterparty due-diligence/verification aid, no citation number changes are needed — the directory is dynamic by design. No country/risk data in index.html requires updating from this delta. Confirm whether any specific member name is cited in the app's DPMS guidance; if so, verify current membership status directly via the RJC "find a member" portal rather than hardcoding.

- **Suggested citation**: Responsible Jewellery Council (RJC) — Member Directory / "Find a Member" (https://www.responsiblejewellery.com/). Cite only as a supplementary due-diligence reference, not as a regulatory instrument.

SEVERITY: LOW — Routine membership-directory churn; no obligations, thresholds, or instruments changed.
