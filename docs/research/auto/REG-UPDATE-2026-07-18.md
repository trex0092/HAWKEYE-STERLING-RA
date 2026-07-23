# Regulatory update proposal — 2026-07-18

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The only delta is the visitor counter on the "About Us" section (from 2,102,659 to 2,103,886; live page shows 2,103,889). No changes to content, dates, or obligations.
- **Likely app impact**: None. The "last updated" date (9 February 2024) and all substantive content (STR process, reporting entities, MoUs, publications) are unchanged. No Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html` require updating.
- **Suggested citation**: No update warranted. If a general reference to the UAE FIU / goAML reporting portal is needed, cite "UAE Financial Intelligence Unit (FIU) — goAML" (https://www.uaefiu.gov.ae/en/).

SEVERITY: LOW — Only an auto-incrementing visitor counter changed; no substantive content difference.

### FATF — guidance, recommendations & news

- **What appears to have changed**: The detected delta shows an identical ADDED and REMOVED segment (footer/boilerplate text with a "restricted access for FATF delegates only" link and unchanged HTML markup). This is a self-cancelling diff — the visible content is the same before and after.
- The change is consistent with routine site churn (dynamic `id` attributes, whitespace/encoding artifacts) rather than a substantive content update to publications, recommendations, or lists.
- No new obligation, threshold, instrument, or deadline is introduced by this delta.

- **Likely app impact**: None required based on this delta. However, the current page text surfaces recently published FATF items that may be worth a separate review if not already reflected in the app:
  - **assets/super-data.js** — virtual assets / stablecoins Q&A citations could reference the "Targeted report on stablecoins and unhosted wallets" (3 Mar 2026).
  - **assets/super-data.js** — cyber-enabled fraud / typologies answers could reference the "Cyber-enabled fraud" report (24 Feb 2026).
  - **index.html** — high-risk / increased-monitoring country lists may need checking against the FATF statements dated 19 June 2026 (latest shown).
  - Note: these are from the page body, not the detected delta, and should be verified independently before any edit.

- **Suggested citation**: No citation change warranted for this delta. If a separate update is pursued, candidates visible in the text are:
  - FATF, *Targeted Report on Stablecoins and Unhosted Wallets — Peer-to-Peer Transactions* (3 March 2026)
  - FATF, *Cyber-enabled Fraud* report (24 February 2026)
  - FATF, *Jurisdictions under Increased Monitoring / High-Risk Jurisdictions Subject to a Call for Action* (19 June 2026)

SEVERITY: LOW — the delta is a self-cancelling boilerplate/markup diff with no substantive content change.

### OECD — Responsible Mineral Supply Chains (CAHRA)
- **What appears to have changed**: The detected delta shows near-identical added/removed segments (navigation and boilerplate text about OECD statistics tools, data explorer, and MNE guidelines overview) — this is consistent with routine site churn / template re-rendering rather than substantive content change.
- **What appears to have changed**: The current page could not be fetched (HTTP 403), so no substantive content change can be confirmed. No new obligations, thresholds, or instruments are visible in the delta.
- **What appears to have changed**: The referenced material remains the OECD Guidelines for Multinational Enterprises on Responsible Business Conduct — no version, edition, or date change is evident from the extracted text.

- **Likely app impact**: Likely none at this time. If any citation exists in `assets/super-data.js` referencing the OECD Due Diligence Guidance for Responsible Mineral Supply Chains from Conflict-Affected and High-Risk Areas (CAHRA), verify the link still resolves. No changes indicated for country/risk data in `index.html`. Recommend re-checking once the page is fetchable (403 resolved) to confirm no underlying update was masked by the block.

- **Suggested citation**: OECD Due Diligence Guidance for Responsible Mineral Supply Chains from Conflict-Affected and High-Risk Areas (only if an update is later confirmed; do not cite based on this churn alone).

SEVERITY: LOW — Delta is duplicated navigation/boilerplate churn; substantive content unverified due to HTTP 403.

### US OFAC — Recent Actions

- **What appears to have changed**: The Recent Actions feed rolled forward with new dated entries (July 13–17, 2026), including Hong Kong-related designation updates/removals, Venezuela- and Cuba-related FAQs, and various Iran/DRC/Russia general licenses. Older entries (e.g., July 01, 2026 counter-terrorism/counter-narcotics items) shifted off the top-10 display.
- This is consistent with routine daily/weekly OFAC list churn rather than a structural or policy change to the page itself.
- No new AML/CFT obligation, threshold, or deadline is visible in the extracted text (the only date-driven item, the 2026 annual report of blocked property reminder, is a pre-existing US filing obligation, not a UAE one).

- **Likely app impact**: Minimal for UAE-focused content. If `assets/super-data.js` maintains a "sanctions screening / OFAC list monitoring" Q&A or Super Tools citation pointing to OFAC Recent Actions, confirm the URL still resolves (unchanged). Country/risk data in `index.html` need not change unless the app separately tracks Hong Kong, Venezuela, Iran, Cuba, DRC or Russia exposure — in which case flag these fresh OFAC actions for the screening-refresh reminder only, not for a data edit. No UAE Cabinet/Central Bank/EOCN item is affected.

- **Suggested citation**: If any update is warranted, cite generically as: "US Department of the Treasury, Office of Foreign Assets Control — Recent Actions" (https://ofac.treasury.gov/recent-actions). Do not cite specific designation notices unless the individual action is separately verified.

SEVERITY: LOW — Routine OFAC feed roll-forward; no new obligations, thresholds, or deadlines relevant to UAE AML/CFT.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The "find a member" directory listing was refreshed — one UAE-based member ("jf diamonds dmcc dubai, united arab emirates") appears removed from the added/removed segments, while other Dubai/DMCC entries (e.g., "kamyen dmcc dubai") remain listed.
- **Country member counts (e.g., China (36), India (290), Italy (333)) and the alphabetical country index appear unchanged**; the delta is consistent with routine directory churn as members are added/removed.
- No changes to standards, obligations, thresholds, or instruments are visible in the text.

- **Likely app impact**: Minimal. If the app maintains a list of RJC-certified UAE/DMCC entities (e.g., in `assets/super-data.js` for counterparty or supply-chain due-diligence references), the removal of "JF Diamonds DMCC" may warrant a spot-check. No changes to country/risk data in `index.html` are indicated, as jurisdiction counts remain stable. RJC's role as a voluntary responsible-sourcing standard (relevant to DPMS/gold-supply-chain due diligence) is unaffected.

- **Suggested citation**: Responsible Jewellery Council – Code of Practices (CoP) / Chain of Custody (CoC) Standard, and the RJC "Find a Member" directory (https://www.responsiblejewellery.com/) — cite only if a certified-member reference is being verified or updated.

SEVERITY: LOW — Routine member-directory churn; no obligations, thresholds, or instruments changed.
