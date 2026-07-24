# Regulatory update proposal — 2026-07-22

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The only detected delta is the visitor counter incrementing (from 2,110,390 to 2,111,527; the live page shows 2,111,529). No changes to content, obligations, dates, or instruments.
- This is routine site churn (dynamic visitor tally), not a substantive regulatory update. The "last updated" date remains 9 February 2024.
- No new publications, MoUs, STR/reporting-entity guidance, or deadlines were added or removed.

- **Likely app impact**: None warranted. No update needed to Regulatory Q&A topics (e.g., STR/goAML reporting process), Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`. Existing FIU/goAML references remain valid.

- **Suggested citation**: No new citation required. If a general reference is ever needed, cite: UAE Financial Intelligence Unit — goAML portal (https://www.uaefiu.gov.ae/en/), last updated 9 February 2024.

SEVERITY: LOW — Only the dynamic visitor counter changed; no obligations, instruments, or dates affected.

### FATF — guidance, recommendations & news

- **What appears to have changed**:
  - A new FATF publication appears on the page: the **seventh targeted update on implementation of the FATF Standards on virtual assets/VASPs** (global AML/CFT measures).
  - A report dated **3 March 2026** highlighting illicit finance risks linked to **criminals' misuse of stablecoins** is now surfaced/promoted on the landing page.
  - Removed segments reference an earlier FATF publication on **asset recovery guidance and best practices** (financial investigations, securing assets, victim compensation) — this looks like the older featured item rotating off the page, i.e. partly routine landing-page churn plus one genuinely new VA/VASP update.

- **Likely app impact**:
  - **Regulatory Q&A — Virtual Assets / VASPs**: answers referencing FATF VA/VASP implementation status may need refreshing to note the new (seventh) targeted update and stablecoin risk findings.
  - **Super Tools citations (assets/super-data.js)**: any citation pointing to a prior FATF VA/VASP targeted update or the asset-recovery guidance should be checked for currency; consider adding the new stablecoin risk report.
  - **Country/risk data (index.html)**: no direct country-listing change indicated; VA/stablecoin risk context only — low likelihood of data edits.

- **Suggested citation**:
  - FATF, *Targeted Update on Implementation of the FATF Standards on Virtual Assets and VASPs* (seventh update) — cite exact number/date once confirmed on the live page.
  - FATF report on illicit finance risks from misuse of stablecoins, dated **3 March 2026** — confirm full title before citing.

*Note: page returned HTTP 403; titles/dates above are drawn from delta text only and require verification against the live FATF publication before any edit.*

SEVERITY: MEDIUM — new FATF VA/VASP targeted update and stablecoin risk report worth review, but no confirmed new obligation or deadline.

### LBMA — Responsible Sourcing
- **What appears to have changed**: The added segments are navigation menus, headers, and standard site chrome (conference promo, membership, good delivery, login prompts); the removed segments were bot/loader verification placeholders ("one moment, please...", "please wait while your request is being verified..."). This indicates the crawler captured a fully rendered page instead of an interstitial loading screen.
- This is consistent with routine site churn / a successful page render rather than a substantive policy change.
- The only potentially substantive item visible is an ongoing **public consultation on Responsible Gold Guidance version 10 (RGG10)** and **Disclosure Guidance version 3**, plus an ASM/formal supply chain report (2022–2025) — but these are references, not confirmed new obligations, and RGG9 remains the operative standard until v10 is finalized.

- **Likely app impact**: No immediate change required. Monitor for RGG10 finalization, which could later affect:
  - Regulatory Q&A topics on precious metals due diligence / responsible sourcing for gold refiners in `assets/super-data.js`.
  - Any Super Tools citations referencing LBMA Responsible Gold Guidance (current version) — verify these still point to RGG v9 as the in-force standard.
  - Country/risk data in `index.html` if gold supply-chain origin risk references LBMA sourcing standards.

- **Suggested citation**: If an update is warranted after consultation closes: *LBMA Responsible Gold Guidance (currently v9; v10 in public consultation)* and *LBMA Responsible Sourcing Programme*. Do not cite RGG10 as in force until published.

SEVERITY: LOW — Delta is site chrome/loader churn; RGG10 remains a consultation, not a new obligation.

### Responsible Jewellery Council (RJC)

- **What appears to have changed**: The "Find a Member" directory counts updated — Albania moved from (0) to (1) certified member, with new listings appearing (e.g., an Albania refinery and jewellery production entry, "benno leeser holding b.v."). Some previously listed members (Israel, Italy, India, USA, UK entries) appear rotated out of the truncated view.
- This reflects routine membership directory churn (member additions/removals), not a change to standards, obligations, or certification requirements.
- No new instrument, threshold, deadline, or standards revision is visible in the delta.

- **Likely app impact**: Minimal. RJC is a voluntary industry standard-setting body, not a UAE AML/CFT regulator. If Super Tools or Regulatory Q&A reference RJC membership counts or specific certified entities as due-diligence indicators (e.g., DPMS/precious-metals supply-chain context), those figures could be refreshed, but no substantive AML/CFT logic changes. No country/risk data in index.html should require updates from this delta.

- **Suggested citation**: If an update is warranted, cite the RJC "Find a Member" directory (https://www.responsiblejewellery.com/) as an industry-membership reference only — not as a regulatory instrument. No RJC standard (COP/COC/LGMS) version is implicated by this change.

SEVERITY: LOW — Routine membership directory count/listing churn; no obligations, thresholds, or instruments changed.
