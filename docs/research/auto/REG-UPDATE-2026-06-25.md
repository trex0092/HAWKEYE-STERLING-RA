# Regulatory update proposal — 2026-06-25

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: 
  - The extracted content is almost entirely site-wide navigation/menu chrome (now branded "وزارة الاقتصاد والسياحة" / Ministry of Economy and Tourism), with no substantive AML/CFT body text captured.
  - No new circular, decision, or guidance title is visible — only standard menu links (e.g., "مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", "التسجيل في نظام goAML", "تشريعات مواجهة جرائم غسل الاموال").
  - This looks like **routine site churn / template change** (rebrand to include Tourism, navigation restructuring) rather than a substantive AML/CFT policy update. Possible URL/structure migration worth confirming manually.

- **Likely app impact**: 
  - Low/none on substance. If anything, the **MoE name and remit** may need updating where cited as "Ministry of Economy" vs. "Ministry of Economy and Tourism" in Regulatory Q&A topics covering DNFBP/DPMS supervision.
  - Verify the source URL in any Super Tools citation (assets/super-data.js) still resolves — page may have moved under the new branding.
  - No change indicated to country/risk data in index.html.

- **Suggested citation**: 
  - Only cite from the live AML page if substantive content is confirmed. Visible candidate labels: "مواجهة غسل الأموال وتمويل الإرهاب" (Anti-Money Laundering & Combating the Financing of Terrorism) and "التسجيل في نظام goAML" — UAE Ministry of Economy (DNFBP supervisor), https://www.moec.gov.ae/en/anti-money-laundering.
  - **Do not** cite any decision/article number — none is present in the extracted text.

*Reviewer note: Re-pull the page rendered (JS-loaded) content before any edit; current extract is insufficient to confir

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - No substantive content change is evident. The "website last updated" date (9 February 2024) and the "what's new" items (latest dated 7 October 2022) are unchanged from prior known states.
  - The visible footer copyright now reads "© 2026," which suggests a routine template/year rollover rather than a regulatory or content update.
  - Overall this looks like routine site churn (boilerplate/footer refresh), not a new instrument, guidance, or process change.

- **Likely app impact**:
  - Likely none required. No new STR/goAML process guidance, typology report, or reporting-entity obligation appears on this extract that would alter existing Regulatory Q&A answers.
  - If any Super Tools citation in `assets/super-data.js` references this page's "last updated" date or footer year, verify it still points to the FIU homepage and goAML reporting process rather than a specific dated artifact.
  - No country/risk data in `index.html` is implicated by this change.

- **Suggested citation**:
  - If (and only if) a citation refresh is warranted, cite generically: **UAE Financial Intelligence Unit (FIU) — goAML portal/homepage**, `https://www.uaefiu.gov.ae/en/` (page last updated 9 February 2024).
  - Do not cite any specific circular or article number; none is visible in the extracted text.

*Reviewer note: Recommend no edit pending MLRO confirmation; treat as monitoring log entry for routine churn.*

### US OFAC — Recent Actions

- **What appears to have changed**:
  - The Recent Actions feed shows new dated entries through June 24, 2026, including transnational criminal organization (TCO) designations, Cuba designations, counter-terrorism designations, non-proliferation designations, and Iran/Venezuela/Russia-related actions.
  - Notable items: a TCO-related general license issuance and publication of an OFAC–OFSI comparative overview (June 23–24, 2026).
  - This is largely routine SDN/sanctions-list churn (designations, removals, and general licenses), consistent with OFAC's normal update cadence rather than a structural change.

- **Likely app impact**:
  - **Super Tools / sanctions-screening citations** in `assets/super-data.js`: verify that references to OFAC SDN List, Consolidated (non-SDN) List, and the Sanctions List Service still align with the current OFAC list-update language.
  - **Regulatory Q&A topics** on sanctions screening, name-matching, and list refresh obligations: confirm guidance reflects OFAC's ongoing daily/recent-action update model and the existence of TCO and counter-terrorism designation streams.
  - **Country/risk data in `index.html`**: low priority, but if any country risk notes reference Russia, Iran, Cuba, Venezuela, or North Korea sanctions status, ensure they note that designations/removals are ongoing (no single event here warrants a country-tier change).
  - The OFAC–OFSI comparative overview may be worth referencing in any UK/US sanctions-comparison Q&A, if such content exists.

- **Suggested citation**:
  - US Department of the Treasury, Office of Foreign Assets Control (OFAC) — *Recent Actions*, https://ofac.treasury.gov/recent-actions (entries through 24 June 2026). Cite specific dated actions only if a substantive update is confirmed; do not assign internal reference numbers not shown on the page.

*Reviewer note: No specific designation list/identifier numbers are visible in the extract, so none are

### Responsible Jewellery Council (RJC)

- **What appears to have changed**:
  - The homepage now references "Standards & Audit changes information pack" indicating updates to standards, audits, and certification requirements (specifics not visible in extract).
  - New officer/board appointments following the 2026 AGM and a 2026 Annual Progress Report are referenced, suggesting governance/content refresh.
  - Much of the remaining content (membership, three standards — CoP, CoC, LGMS, member directory) appears to be routine site churn / standing navigation rather than substantive regulatory change.

- **Likely app impact**:
  - **Super Tools citations (assets/super-data.js)**: Any reference to RJC standards (Code of Practices, Chain of Custody, Laboratory Grown Material Standard) used to support precious metals/stones (DPMS) due-diligence guidance may need a version/date check against the announced "Standards & Audit changes."
  - **Regulatory Q&A topics**: Answers covering DNFBP/DPMS responsible sourcing, supply-chain due diligence, or voluntary industry standards may warrant a freshness review.
  - **Country/risk data (index.html)**: Low priority — member-count-by-country listing is dynamic directory data, not risk-rated content; no update warranted.

- **Suggested citation**:
  - RJC Standards & Audit Changes Information Pack (2026) — for the standards/audit/certification updates.
  - RJC Code of Practices / Chain of Custody / Laboratory Grown Material Standard (cite latest published version once confirmed) — only if the changes pack materially alters cited due-diligence requirements.

*Note: No article or circular numbers are visible in the extract; reviewer should confirm the specific standard version/effective date before any edit.*
