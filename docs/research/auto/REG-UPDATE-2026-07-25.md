# Regulatory update proposal — 2026-07-25

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: The added and removed segments are identical text about a DMCC–Botswana Stock Exchange MoU news item. This indicates routine news-feed rotation/re-ordering on the homepage rather than any regulatory or obligation change.
- **Likely app impact**: None expected. No AML/CFT thresholds, DPMS obligations, or licensing rules are affected. No changes needed to Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`. The MoU (Botswana trade corridor) is a commercial/market-access item, not an AML/CFT instrument.
- **Suggested citation**: None warranted. If DMCC's DPMS/free-zone AML context is ever referenced, cite the standing source (DMCC AML/CFT obligations for designated non-financial businesses) — but no new instrument is visible here.

SEVERITY: LOW — Identical added/removed text reflects routine homepage news churn with no obligation, threshold, or instrument change.

### LBMA — Responsible Sourcing
- **What appears to have changed**: The extracted content is a bot-verification/loading interstitial ("one moment, please..." / "please wait while your request is being verified"), not substantive page content.
- The 76 removed segments correspond to standard site navigation/menu text (membership, good delivery, login), consistent with the crawler capturing an anti-bot challenge page rather than the actual Responsible Sourcing content.
- This looks like routine site churn / a crawl artifact, not a genuine change to LBMA's Responsible Sourcing standards or obligations.

- **Likely app impact**: None warranted at this time. No verified change to the Responsible Sourcing Programme, the Responsible Gold/Silver Guidance, or any due diligence obligations. Do not update Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html` based on this delta. Recommend re-crawling with anti-bot handling to capture the real page before any action.

- **Suggested citation**: If a substantive update is later confirmed, cite by visible title only: "LBMA — Responsible Sourcing (Global)" with the source URL. No instrument/version number is visible in the captured text.

SEVERITY: LOW — Captured page is a bot-verification interstitial; delta reflects crawl artifact, not a content change.

### US OFAC — Recent Actions
- **What appears to have changed**: The top "Recent Actions" feed rolled forward to new entries dated July 24, 2026: Iran-related designations, an amended Russia-related general license and FAQs, and an amended Venezuela-related FAQ, plus publication of regulatory amendments.
- The removed segments (counter terrorism designations; earlier Iran and DRC general licenses dated July 10, 2026) reflect older items scrolling off the first page rather than any withdrawal of obligations.
- This is largely routine feed churn, but the new Iran designations and amended Russia/Venezuela licenses are substantive OFAC updates worth confirming against the underlying SDN/list changes.

- **Likely app impact**: 
  - Regulatory Q&A topics on sanctions screening (OFAC lists, SDN screening obligations) — verify guidance still references OFAC "Recent Actions" and SDN/Consolidated lists as the authoritative feed.
  - Country/risk data in `index.html` for Iran, Russia, Venezuela — confirm risk tags/notes remain accurate; new designations may warrant a review note but no threshold changes are visible.
  - Super Tools citations in `assets/super-data.js` referencing OFAC sanctions programs — confirm URLs still point to the live OFAC Recent Actions / SDN list pages (no URL change detected).

- **Suggested citation**: US Department of the Treasury, Office of Foreign Assets Control (OFAC) — "Recent Actions" (updated 24 July 2026), https://ofac.treasury.gov/recent-actions. Do not cite specific designation or license numbers unless verified from the underlying OFAC notice.

SEVERITY: LOW — New designations/amended licenses are normal OFAC feed rollover with no new UAE obligations, thresholds or deadlines visible.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The added and removed segments are identical, indicating a member-directory count fluctuation (the "find a member" per-country tally). No change to standards, obligations, or thresholds is visible.
- **This is routine site churn**: The delta reflects dynamic member-count updates on the "find a member" page, not a substantive policy or standards change.

- **Likely app impact**: None expected. RJC is a voluntary standard-setting body, not a UAE regulator. No Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html` need updating based on this delta. If RJC is cited anywhere as a responsible-sourcing/due-diligence reference for the DPMS (Dealers in Precious Metals & Stones) sector, no change is warranted from this specific delta.

- **Suggested citation**: No update warranted. If RJC standards are ever referenced generally, cite "Responsible Jewellery Council – Code of Practices (COP)" as the standard-setting instrument (no version/number visible in text).

SEVERITY: LOW — Identical added/removed segments reflect routine member-directory count churn, no obligation or instrument change.
