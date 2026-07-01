# Regulatory update proposal — 2026-07-01

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**:
  - The extracted text is almost entirely site-wide navigation/chrome (menus, headers, banners) in Arabic, with no substantive AML/CFT page content captured. This strongly indicates routine site churn or a rendering/extraction artifact rather than a genuine regulatory update.
  - The page appears to have shifted toward the broader "وزارة الاقتصاد والسياحة" (Ministry of Economy and Tourism) branding and navigation, suggesting a possible site restructure/rebrand affecting the URL's layout — but no AML-specific substantive change is visible.
  - AML-relevant menu items are still present in navigation (e.g., "مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", "التسجيل في نظام goAML", "الأنشطة الاقتصادية الواقعية"), so no evidence of removed obligations.

- **Likely app impact**:
  - **Probably none at content level.** No new instrument, deadline, or obligation is visible to justify editing Regulatory Q&A answers or Super Tools citations in `assets/super-data.js`.
  - If a **rebrand/URL restructure** is confirmed, low-priority housekeeping: verify the MoE source URL still resolves and update the supervisor label if "Ministry of Economy and Tourism" is now the official name.
  - No country/risk data in `index.html` is implicated by this extraction.
  - **Recommended action**: re-fetch/re-scrape the AML landing page (and its sub-pages: TFS, goAML registration, DNFBP/DPMS guidance) to obtain real content before any edit. Treat current diff as noise pending confirmation.

- **Suggested citation**:
  - No new instrument is evidenced; do **not** add a citation from this capture.
  - If confirming an existing reference, cite generically: *UAE Ministry of Economy — Anti-Money Laundering (AML/CFT

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: 
  - The captured page is the generic DMCC corporate homepage ("world's premier business destination") emphasizing business setup, free-zone tax status, and trade ecosystems — not AML/CFT-specific content.
  - No AML/CFT, DPMS (Dealers in Precious Metals and Stones), or compliance-obligation text is visible in the extract; the gold/jewellery angle appears only as one of several trade "ecosystems."
  - This looks consistent with routine corporate/marketing site churn rather than a substantive regulatory change.

- **Likely app impact**: 
  - Low/likely none for AML/CFT logic. This homepage is not a reliable source for regulatory Q&A citations.
  - If DMCC is currently cited in `assets/super-data.js` for DPMS/precious-metals supervisory obligations or free-zone AML expectations, that citation should be re-pointed to a dedicated DMCC compliance/AML page (or MOE/goAML guidance) rather than this marketing URL.
  - No change indicated for country/risk data in `index.html` (UAE risk classification unaffected by this page).

- **Suggested citation**: 
  - Do not cite this homepage for AML/CFT purposes. If an update is warranted, cite a DMCC AML/compliance-specific resource (e.g., DMCC Compliance/AML guidance for member firms) — exact title/URL to be confirmed by reviewer, as none is visible in this extract.

**Reviewer note**: Recommend no action beyond re-verifying that no existing citation relies on this generic DMCC homepage. Treat as routine site churn pending confirmation.

### Responsible Minerals Initiative (RMI)

- **What appears to have changed**:
  - New items appear in the news feed, including an "RMI statement regarding Global Witness report on coltan" (Jun 10, 2026) and "RMI All Minerals Standard achieves full LME recognition" (Jun 09, 2026).
  - A partnership item ("ILO and RMI partner to address child labour in mineral supply chains," May 08, 2026) and prior EU Commission recognition of RMI RMAP for conflict minerals compliance (Oct 20, 2025) are also present.
  - Remaining content is largely standard site navigation/menu churn; the substantive change is the new dated news entries at the top of the feed.

- **Likely app impact**:
  - Regulatory Q&A topics on responsible mineral sourcing / conflict minerals / OECD Due Diligence Guidance and CAHRAs may need review to reflect RMI RMAP's EU Commission recognition and the new All Minerals Standard scope.
  - Super Tools citations in `assets/super-data.js` referencing RMI standards, RMAP, DAP, or reporting templates (CMRT/EMRT/AMRT) may need version/scope updates.
  - Country/risk data in `index.html` touching DRC / Great Lakes region high-risk sourcing may warrant a review given the ongoing eastern DRC statements and the paused ITSCI recognition context.

- **Suggested citation**:
  - Responsible Minerals Initiative (RMI), *News & Events* page (https://www.responsiblemineralsinitiative.org/news/), citing the specific dated item(s) if used — e.g., "RMI All Minerals Standard achieves full LME recognition" (Jun 09, 2026) or "RMI RMAP first scheme recognized by European Commission for Conflict Minerals Regulation compliance" (Oct 20, 2025).

*Proposal for MLRO review — not a final edit. Dates and titles above are transcribed from the extracted page text; verify against the live source before updating.*

### US OFAC — Recent Actions

- **What appears to have changed**:
  - Recent Actions feed shows new dated entries through June 30, 2026, including counter-narcotics designations, TSRA licensing report publication, and multiple Russia-related designation removals.
  - Notable non-routine items: **launch of OFAC Reconsideration Portal** (June 29, 2026) and publication of an **OFAC-OFSI comparative overview** (June 23, 2026); also transnational criminal organizations (TCO) and Cuba designations, plus new Venezuela/Iran/DRC-related general licenses.
  - Mixed picture: much of this is routine sanctions-list churn (designations/removals), but the reconsideration portal and OFAC-OFSI overview are procedural/guidance developments worth noting.

- **Likely app impact**:
  - **Regulatory Q&A** — sanctions screening topics referencing OFAC lists (SDN/Consolidated) may warrant a note that OFAC introduced a reconsideration/delisting portal; relevant if answers describe delisting or reconsideration processes.
  - **Super Tools citations (assets/super-data.js)** — any citation pointing to OFAC "Recent Actions" as a live source should be revalidated; entries tied to specific programs (Russia, Iran, Venezuela, Cuba, TCO/counter-narcotics) may need date-stamp refresh.
  - **Country/risk data (index.html)** — no clear change to UAE-facing country risk tiers from this snapshot; TCO and counter-narcotics designations could matter only if specific named entities/jurisdictions (not visible here) tie to monitored counterparties.

- **Suggested citation**:
  - US Department of the Treasury, Office of Foreign Assets Control (OFAC), "Recent Actions," accessed via https://ofac.treasury.gov/recent-actions (entries dated June 22–30, 2026).
  - If citing the process change specifically: OFAC "Launch of OFAC Reconsideration Portal," June 29, 2026 (title as shown

### Responsible Jewellery Council (RJC)

- **What appears to have changed**:
  - Page reflects post-2026 activity: "new officer and board appointments following 2026 AGM" and a "2026 Annual Progress Report."
  - A "Standards & Audit Changes Information Pack" is referenced, indicating updates to standards, audit, and certification requirements (specifics not visible in extract).
  - Membership milestone updated to "2,000 members"; otherwise content is largely standard org/marketing copy. Much of this looks like routine site churn, but the standards/audit changes flag warrants a closer look.

- **Likely app impact**:
  - Regulatory Q&A topics covering DPMS (dealers in precious metals and stones) due diligence and responsible sourcing standards may reference RJC's Code of Practices (CoP) / Chain of Custody (CoC) — verify these still align if standards were revised.
  - Super Tools citations in `assets/super-data.js` pointing to RJC standards/audit guidance should be checked against any updated standards version.
  - Country/risk data in `index.html`: no direct AML/CFT risk change; UAE-relevant member counts (Bahrain 2, Jordan 2, etc.) are informational only and unlikely to affect risk scoring. UAE ("morocco" cut off — UAE not visible in truncated extract; confirm separately).

- **Suggested citation**:
  - RJC Code of Practices (CoP) — current version, if a revised edition is confirmed via the "Standards & Audit Changes Information Pack."
  - RJC Chain of Custody (CoC) Standard, if cited for supply-chain due diligence.
  - Do not cite specific version/circular numbers until confirmed on the RJC standards pages.

*Note: The truncated extract does not show the actual standards version numbers or effective dates. Human reviewer should open the "Standards & Audit Changes Information Pack" and the standards pages before any edit.*
