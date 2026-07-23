# Regulatory update proposal — 2026-07-09

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The only delta is an increase in the "total visitors" counter (from 2,085,074 to 2,086,663; live page shows 2,086,670). This is a dynamic visitor tally, not content.
- **What appears to have changed**: The "last updated on 9 February 2024" date and all substantive page content (mandate, STR process, reporting entities, publications) are unchanged.
- **What appears to have changed**: This is routine site churn — no regulatory substance affected.

- **Likely app impact**: None. No Regulatory Q&A topics (e.g., STR/goAML reporting procedures) or Super Tools citations in `assets/super-data.js` require updating. No country/risk data in `index.html` is affected by a visitor-counter change.

- **Suggested citation**: No update warranted. If FIU/goAML reporting guidance is ever cited, use the general reference: "UAE Financial Intelligence Unit (FIU) — goAML portal, https://www.uaefiu.gov.ae/en/" (no dated instrument or circular number is visible in the text).

SEVERITY: LOW — Only the visitor counter changed; no obligations, thresholds, or instruments affected.

### UAE Executive Office for Control & Non-Proliferation (EOCN)

- **What appears to have changed**: The detected delta reflects a shift from a "request rejected / support ID" error page to a standard "page not found" (404) message in Arabic/English, now branded under "mofaie" (Ministry of Foreign Affairs). The current fetch also failed with a connection timeout.
- These are error/availability states, not substantive content changes; no regulatory text, obligations, or instruments are visible.
- This looks like routine site churn or infrastructure/hosting changes (possible domain or URL migration), not a policy update.

- **Likely app impact**: None substantive at this time. No Regulatory Q&A topics/answers, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html` require updating based on this delta. However, if EOCN content has migrated (e.g., under a mofaie/MOFA domain), the monitored URL may need to be re-pointed to avoid future dead-link/monitoring failures.

- **Suggested citation**: No new instrument to cite. If a source URL update is confirmed after re-verification, cite the UAE Executive Office for Control and Non-Proliferation (EOCN) landing page under its current/correct domain.

SEVERITY: LOW — Error-page/404 churn and a fetch timeout; no obligations, thresholds, or instruments changed.

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: The delta reflects rotation of event listings on the DMCC homepage (e.g., dates shifting to 20–24 Jul 2026 for a gaming/blockchain event, addition of a "Bonas Polished Diamond Tender" and a disputes centre training webinar; removal of "ChinaJoy 2026" and an India business event).
- The changes are limited to promotional events/webinar calendar entries, not regulatory or compliance content.
- This looks like routine site churn (event carousel refresh) with no AML/CFT substance.

- **Likely app impact**: None expected. No changes to DPMS (dealers in precious metals and stones) obligations, thresholds, or free-zone AML/CFT requirements are visible. No updates warranted to Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`.

- **Suggested citation**: No new instrument to cite. If DMCC/DPMS obligations are referenced elsewhere in the app, continue citing existing authorities (e.g., UAE Cabinet Decision No. 10 of 2019 and MoE DPMS AML guidance) — none of which are affected by this delta.

SEVERITY: LOW — Routine event-listing churn on the homepage; no obligations, thresholds, or instruments changed.

### LBMA — Responsible Sourcing
- **What appears to have changed**: The captured "current page text" is only an anti-bot/verification interstitial ("one moment, please... please wait while your request is being verified"), not actual content.
- The 76 removed segments are standard site navigation/menu text (market overview, membership, good delivery, login), consistent with the crawler being blocked rather than a genuine content removal.
- No substantive change to Responsible Sourcing standards, obligations, or requirements is observable; this looks like a failed fetch / bot-verification block, i.e. routine site churn or an access issue.

- **Likely app impact**: None warranted from this delta. Do not modify Regulatory Q&A topics on responsible gold/precious-metals sourcing, LBMA Good Delivery / Responsible Sourcing Programme references in `assets/super-data.js`, or any country/risk data in `index.html` based on this capture. Flag for a re-crawl once the page renders fully before any edit.

- **Suggested citation**: If a genuine update is later confirmed on re-crawl, cite "LBMA Responsible Sourcing Programme" (title only) with the source URL — no version, guidance or circular number is visible in this text to cite.

SEVERITY: LOW — Captured text is a bot-verification interstitial; no real content change detected.

### US OFAC — Recent Actions

- **What appears to have changed**: The detected delta reflects the recent-actions feed rolling forward by one entry — the top of the list now shows the July 08, 2026 amended Russia-related general license, pushing older June 24–25 entries (Russia-related designations removals) off the visible window. This is consistent with routine list-page pagination/churn.
- No new sanctions program, threshold, or reporting obligation is visible in the added segments; all changes are ordinary OFAC action postings (general licenses and sanctions list updates).
- The "reminder to file the 2026 annual report of blocked property" (July 01, 2026) is present but appears in both current text and removed segment — it is not a new item, just repositioned.

- **Likely app impact**: Minimal. No changes required to core Regulatory Q&A topics tied to UAE AML/CFT obligations. If assets/super-data.js maintains an OFAC-linked sanctions-screening reference or a "recent OFAC actions" pointer, verify the URL still resolves (it does). No country/risk data in index.html needs revision from this delta — Russia/Iran/Venezuela program references remain valid as-is.

- **Suggested citation**: If any update is warranted, cite generically: "US OFAC — Recent Actions, Office of Foreign Assets Control, U.S. Department of the Treasury" (https://ofac.treasury.gov/recent-actions). Do not cite a specific general license number — none is fully visible in the extracted text.

SEVERITY: LOW — routine recent-actions feed roll-forward; no new obligations, thresholds, or instruments visible.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The "find a member" directory listing was updated — a member entry appears to have been removed ("International Jewellery London (IJL), United Kingdom") while the surrounding member and country-count listings (e.g., China (36), Israel (41), India (292)) remained largely identical.
- This is consistent with routine directory/membership churn (member counts and individual member entries shifting), not a change to RJC standards, obligations, or certification requirements.
- No changes detected to the Code of Practices (CoP), Chain of Custody (CoC), Laboratory Grown Material Standard (LGMS), or any threshold, instrument, or deadline.

- **Likely app impact**: Minimal. RJC is a voluntary industry standard-setter, not a UAE regulator. If the app uses RJC in Regulatory Q&A topics on responsible gold/jewellery sourcing or DPMS (dealers in precious metals and stones) due diligence, no substantive update is needed. No changes warranted to country/risk data in index.html or Super Tools citations in assets/super-data.js from this delta.

- **Suggested citation**: No update warranted. If a general reference is ever needed, cite the "RJC Code of Practices" (current version) as the standing instrument — but not triggered by this change.

SEVERITY: LOW — Member directory churn only; no change to standards, obligations, or thresholds.
