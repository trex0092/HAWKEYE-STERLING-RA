# Regulatory update proposal — 2026-07-23

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The homepage has been restructured/redesigned with a new "Compliance & Guidance" section framed as "a practical guide to meeting your AML/CFT reporting obligations in the UAE," including navigation entries like "Who must report & how?" and "Frequently asked questions." The removed segments reflect the old site's navigation/menu structure (about us, publications, open data, guidelines listing, page-visitor footer) rather than substantive rule text.
- On balance this looks like a site redesign / navigation reorganisation (routine site churn) rather than a new obligation, threshold, or instrument. No new article, circular, deadline, or reporting threshold is visible in the delta.
- The current page references existing resources (goAML portal, IEMS portal, National Risk Assessment Report 2024, and a "Misuse of Virtual Assets in Financial Crime" typology report covering STRs/SARs Jul 2023–Jun 2025) — these are surfaced/linked, not newly created obligations, but the VA typology report is worth noting.

- **Likely app impact**:
  - **Regulatory Q&A topics/answers**: Verify goAML STR/SAR filing-process answers still align with the "STR process" / "How to submit a report" framing; check any answer referencing FIU enquiry responses now points to the **IEMS portal** for RFIs / freeze orders / case correspondence.
  - **Super Tools citations (assets/super-data.js)**: Confirm links to the FIU homepage and goAML/IEMS portals resolve to the new structure; add or refresh a citation for the VA/VASP typology report and NRA 2024 if these underpin any Super Tool answer.
  - **Country/risk data (index.html)**: Low likelihood of change; if UAE VA/VASP risk indicators are tracked, the "Misuse of Virtual Assets" typology findings (fraud, stablecoins, P2P, money-mule accounts, sanctions evasion) could optionally refresh supporting narrative — no risk-r

### Dubai Gold & Jewellery Group / DMCC (sector)
- **What appears to have changed**: The added and removed segments are identical text about a DMCC–Botswana Stock Exchange MoU news item. This indicates routine content re-ordering/republishing on the news feed rather than a substantive change.
- **Likely app impact**: None warranted. No new AML/CFT obligations, DPMS thresholds, or free-zone compliance requirements are introduced. No changes needed to Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`.
- **Suggested citation**: None required. If DMCC's precious-metals/DPMS supervisory framework is ever cited generally, the standing reference remains the UAE AML/CFT regime (Federal Decree-Law No. 20 of 2018 and Cabinet Decision No. 10 of 2019) — but no update is triggered by this delta.

SEVERITY: LOW — Identical add/remove of a trade-MoU news item; routine site churn with no regulatory content change.

### FATF — guidance, recommendations & news
- **What appears to have changed**:
  - A new **targeted report on regulatory challenges from decentralised finance (DeFi)** appears to have been added, updating/complementing FATF's 2021 updated VA guidance.
  - The **Seventh Targeted Update on implementation of the FATF Standards on Virtual Assets/VASPs** was re-ordered (shown as both added and removed), suggesting a repositioning rather than new content.
  - A **report on illicit finance risks linked to stablecoins** appears among added segments; a prior report on **cyber-enabled fraud (24 Feb 2026)** dropped from the visible list. This looks like the publications feed rolling forward with new VA/stablecoin/DeFi items (note: page returned HTTP 403, so content is unverified).

- **Likely app impact**:
  - **Regulatory Q&A (super-data.js)**: Virtual Asset / VASP topics may need refreshed FATF citations; consider a new/updated answer covering **DeFi regulatory challenges** and **stablecoin illicit-finance risks**.
  - **Super Tools citations**: Any VASP risk-assessment or VA travel-rule tooling referencing FATF's VA guidance should be checked for the latest targeted-update reference.
  - **index.html country/risk data**: No jurisdiction/greylist changes evident here; likely no update needed. Cyber-enabled fraud typologies, if referenced, remain valid content even though the item shifted off the visible list.

- **Suggested citation** (verify titles against the live page before use):
  - FATF, *Targeted Report on Regulatory Challenges from Decentralised Finance (DeFi)* (year to confirm)
  - FATF, *Seventh Targeted Update on Implementation of the FATF Standards on Virtual Assets/VASPs*
  - FATF, *Report on Illicit Finance Risks Linked to Stablecoins* (year/date to confirm)

SEVERITY: MEDIUM — new FATF VA/DeFi/stableco

### UN Security Council — Consolidated List

- **What appears to have changed**: The Consolidated List was updated from 8 July 2026 to **16 July 2026**, superseding all previous versions.
- Listing counts increased: individuals from 730 → **736** (+6) and entities/other groups from 272 → **274** (+2).
- This is a routine periodic refresh of the sanctions list (new/amended designations); no change to obligations, thresholds, or instruments is visible in the extracted text.

- **Likely app impact**: No wording changes needed to Regulatory Q&A logic or country/risk data in `index.html`. Screening-related Super Tools content in `assets/super-data.js` that references the UN Consolidated List should have its "last updated" reference and any cited list counts refreshed to the 16 July 2026 version. If the app quotes fixed figures for total designations, update those numbers; otherwise treat as a periodic-update reminder for screening/rescreening workflows.

- **Suggested citation**: UN Security Council Consolidated List, last updated 16 July 2026 (https://www.un.org/securitycouncil/content/un-sc-consolidated-list).

SEVERITY: LOW — Routine periodic list refresh (updated date + minor count changes), no new obligations or thresholds.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The added and removed segments are textually identical, both showing the member-directory country listing (e.g., "canada (9) ... chile (1) china (36)"). This indicates a change in the dynamic "find a member" per-country membership counter, not a substantive content update.
- **Likely app impact**: None expected. This is a live-updating member directory feed; the counts fluctuate as members join/resign. No AML/CFT obligation, threshold, or standard text is affected. No changes indicated to Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`.
- **Suggested citation**: No update warranted. If RJC is cited generally as an industry standard-setter, the existing reference to the RJC Code of Practices (CoP) / Chain of Custody (CoC) standards remains valid; no new instrument or version is visible in the text.

SEVERITY: LOW — Identical add/remove segments reflect routine member-directory counter churn, no obligation change.
