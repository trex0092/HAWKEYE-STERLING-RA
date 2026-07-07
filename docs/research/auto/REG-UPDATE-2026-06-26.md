# Regulatory update proposal — 2026-06-26

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The extracted content is almost entirely site navigation/chrome (menus, headers, footer links) with no substantive AML/CFT policy text visible. The page now reflects the rebranded "Ministry of Economy and Tourism" (وزارة الاقتصاد والسياحة) naming. No new circulars, regulations, or guidance numbers are visible in the extracted text. This looks consistent with routine site churn / navigation restructuring rather than a substantive AML/CFT policy update.

- **Likely app impact**: Low. Possible touchpoints to review:
  - Any Regulatory Q&A topic referencing the **Ministry of Economy** as the DNFBP/DPMS supervisor — confirm whether the entity name should be updated to reflect the "Ministry of Economy and Tourism" branding (verify against an authoritative source before changing).
  - Super Tools citations in `assets/super-data.js` pointing to this MoE AML page — confirm the URL still resolves and links to the intended AML/CFT landing content (note the visible navigation references **goAML registration**, **targeted financial sanctions**, and **AML/CFT legislation**, but no specific instrument text was captured).
  - No country/risk data changes in `index.html` indicated.

- **Suggested citation**: If an update is warranted, cite the page generically as **UAE Ministry of Economy — Anti-Money Laundering (DNFBP supervision)**, URL: https://u.ae/en/information-and-services/business/combatting-money-laundering. Do **not** add specific law/circular numbers, as none are visible in the extracted text; re-fetch the live page to confirm the instrument title before citing.

*Recommendation: Defer substantive edits. Re-extract full page body (non-navigation content) to confirm whether any AML/CFT guidance actually changed, and verify the current official ministry name.*

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - The extracted content shows only standard homepage/navigation elements with a "website last updated: 9 February 2024" stamp and a "© 2026" footer — no new substantive publications, STR/goAML process changes, or guidance visible.
  - The most recent dated items ("what's new") remain unchanged (latest is 7 October 2022 Annual Report 2021), indicating no fresh regulatory output captured here.
  - This looks like routine site churn (footer year roll, template/cookie/search-widget artifacts) rather than a material regulatory change.

- **Likely app impact**:
  - **Low / none expected** based on this snapshot. No update appears warranted to Regulatory Q&A topics on STR/SAR filing via goAML, reporting-entity obligations, or FIU mandate.
  - If verifying, check whether any Super Tools citations in `assets/super-data.js` reference a specific FIU page "last updated" date — if so, confirm against the 9 February 2024 stamp.
  - No country/risk data in `index.html` is implicated by this change.

- **Suggested citation** (only if an update is later confirmed):
  - "UAE Financial Intelligence Unit (FIU) — goAML," uaefiu.gov.ae, last updated 9 February 2024.
  - **Recommendation**: No edit required at this time. Re-verify against the live site/changelog before any change, as the extracted text contains rendering artifacts and may not reflect dynamic content.

### US OFAC — Recent Actions

- **What appears to have changed**:
  - The Recent Actions feed shows new dated entries through June 25, 2026, including DRC-related designations, TCO designations, counter-terrorism designations, Cuba designations, multiple Russia-related removals, and several Iran/Venezuela general licenses.
  - Notable item: publication of an "OFAC-OFSI comparative overview" (June 23, 2026), suggesting new cross-jurisdictional guidance material.
  - This looks like a mix of routine sanctions-list churn (designations/removals/general licenses) plus one potentially substantive guidance publication worth a closer look.

- **Likely app impact**:
  - **Regulatory Q&A topics**: Any answer referencing OFAC SDN/Consolidated list screening cadence may warrant a "last reviewed" refresh; no substantive change to UAE obligations is evident.
  - **Super Tools citations (assets/super-data.js)**: Check any sanctions-screening or list-source citations pointing to OFAC Recent Actions for freshness; update date stamps if present.
  - **Country/risk data (index.html)**: Possible relevance for entries tied to DRC, Cuba, Iran, Venezuela, Russia, and TCO/counter-terrorism risk flags — verify whether designations/removals affect any named-country risk notes. The OFAC-OFSI comparative overview may be worth citing if cross-border (US/UK) screening guidance is referenced.

- **Suggested citation**:
  - "US OFAC — Recent Actions" (https://ofac.treasury.gov/recent-actions), entries dated June 18–25, 2026.
  - If the guidance item is incorporated: "OFAC-OFSI comparative overview" (per Recent Actions entry, June 23, 2026) — confirm exact title before citing.

*Note: This is a proposal for MLRO review. No specific OFAC notice/instrument numbers were visible in the extracted text; verify exact titles and IDs on the source page before finalizing.*

### Egmont Group of FIUs

- **What appears to have changed**: The news feed now shows updated headlines through June 2026, with a featured item on virtual assets and financial intelligence ("Virtual assets are reshaping financial intelligence, is your FIU ready?", 25 June 2026), references to the FATF June 2026 Plenary, customs–FIU collaboration, and publication of the 2024–2025 Annual Report. This is a content refresh of the news listing rather than a structural or policy change to the site.
- **Likely app impact**: Largely routine news churn — no immediate change required to most Regulatory Q&A topics. Two items may warrant review if substantively relevant: (1) the virtual assets / FIU workshop theme could support refreshing VA/VASP information-sharing context in Q&A or Super Tools citations; (2) the 2024–2025 Annual Report and MENA-relevant activity (e.g., Riyadh regional workshop) may be worth noting where `assets/super-data.js` cites Egmont on FIU cooperation or international information exchange. No country/risk data in `index.html` appears affected.
- **Suggested citation**: Egmont Group of FIUs — *News and Events* (egmontgroup.org/news); if the annual report is used, cite "Egmont Group 2024–2025 Annual Report" (verify exact title and publication date on the source before citing).

*Note: For human review only. Specific article titles/dates above are drawn verbatim from the extracted page; confirm against the live source before any edit.*

### Basel AML Index

- **What appears to have changed**:
  - The page now references the **2025 public edition** launch (including a webinar with the European Central Bank, Wolfsberg Group, and Malawi FIU), indicating a new annual data release.
  - Coverage figures are stated as **177 jurisdictions** (public edition) and **203 countries/jurisdictions** (expert edition), based on **17 sources / 5 domains**.
  - This looks like a **substantive annual update** (new 2025 edition), not routine site churn — the underlying risk scores and rankings have likely been refreshed.

- **Likely app impact**:
  - Any **country/jurisdiction risk scores or rankings** sourced from Basel AML Index in `index.html` (e.g., UAE risk score, regional/world average comparisons) may be outdated and should be checked against the 2025 edition.
  - **Regulatory Q&A topics** referencing Basel AML Index methodology counts (sources, domains, jurisdiction totals) should be reconciled with the current figures (17 sources / 5 domains / 177 public / 203 expert).
  - **Super Tools citations in `assets/super-data.js`** that cite the Basel AML Index for country risk benchmarking should be updated to the 2025 edition and re-dated.

- **Suggested citation**:
  - *Basel AML Index 2025 — Public Edition*, Basel Institute on Governance (International Centre for Asset Recovery), https://index.baselgovernance.org/
  - (For detailed/quarterly data: *Basel AML Index — Expert Edition / Expert Edition Plus*, same source.)

*Note: Confirm the exact UAE score and publication date directly from the 2025 edition before editing; specific figures are not visible in the extracted text.*
