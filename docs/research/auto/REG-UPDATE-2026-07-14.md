# Regulatory update proposal — 2026-07-14

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The only delta is the "total visitors" counter (from 2,094,452 to 2,097,113 / 2,097,115 in body text). No substantive content, obligations, or dates changed.
- **Likely app impact**: None. This is a dynamic visitor-count metric, not regulatory content. No updates needed to Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`.
- **Suggested citation**: None warranted. If FIU/goAML reporting guidance is referenced elsewhere, continue citing the existing "UAE FIU — goAML" source (page last updated 9 February 2024).

SEVERITY: LOW — Only the visitor counter changed; routine site churn with no regulatory impact.

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**:
  - A news/insights headline was updated to add a promotional statistic: "DMCC announces record USD 41.7 billion in diamond trade through Dubai in 2025."
  - The removed segment referenced a DMCC/London Diamond Bourse MoU and a "DMCC Cyber" launch item; this looks like routine rotation of the news carousel rather than a regulatory change.
  - No new AML/CFT obligations, thresholds, instruments, or deadlines are visible in the delta or current page text.

- **Likely app impact**:
  - Minimal. This is trade-volume/PR content, not regulatory guidance.
  - If DMCC/DPMS (dealers in precious metals & stones) trade-figure context is cited in `assets/super-data.js` (e.g., sector-risk narrative for gold/diamond trade), the 2025 USD 41.7bn figure could optionally refresh background stats.
  - No change needed to country/risk data in `index.html` — UAE DPMS designated-non-financial-business (DNFBP) risk framing is unaffected.

- **Suggested citation**: No new instrument to cite. If a background refresh is desired, cite DMCC news/insights page (https://www.dmcc.ae/) as a sector data source only — do not treat as a regulatory instrument.

SEVERITY: LOW — routine news-carousel rotation with a promotional trade statistic; no new obligations or instruments.

### LBMA — Responsible Sourcing

- **What appears to have changed**: The detected delta is dominated by site navigation/chrome text (menus, login prompts, conference banners) being captured, while the two removed segments were loader/verification placeholders ("one moment, please...", "please wait while your request is being verified..."). This indicates the crawler captured the fully rendered page rather than an interstitial — i.e., routine site churn, not a substantive policy change.
- The extracted text does reference ongoing items already known: a public consultation on **Responsible Gold Guidance version 10 (RGG10)** and **Disclosure Guidance version 3**, plus an ASM report covering 2022–2025. None of these appear newly introduced by this delta.

- **Likely app impact**: Minimal from this delta alone. If any review is triggered, it would be to confirm that Super Tools citations referencing LBMA responsible sourcing standards (e.g., Responsible Gold Guidance) still point to the current version. Watch RGG10 status — if it moves from consultation to final, precious-metals supply-chain due diligence answers in `assets/super-data.js` may need updating. No country/risk data in `index.html` is affected.

- **Suggested citation**: If an update is warranted, cite **LBMA Responsible Sourcing Programme — Responsible Gold Guidance (version in force; note RGG10 currently in public consultation)**. Do not cite RGG10 as effective until finalized.

SEVERITY: LOW — Delta is navigation/loader churn; no new obligations, thresholds, or deadlines visible.

### US OFAC — Recent Actions
- **What appears to have changed**: The Recent Actions feed rolled forward with new dated entries (e.g., cyber-related designations, Cuba designations, and issuance of a Cuba-related FAQ dated July 13, 2026), pushing older items (DRC general license, June 29–30 Russia-related removals/TSRA report) down the list.
- **What appears to have changed**: The delta is consistent with normal OFAC list-churn — new designations/general licenses/FAQs appended and boilerplate navigation text re-detected — not a structural or policy change to the page itself.
- **What appears to have changed**: No new UAE-specific obligation, threshold, or deadline is visible in the extracted text.

- **Likely app impact**: Low. Any Regulatory Q&A topics covering OFAC sanctions screening or the SDN/Consolidated lists should already reference the live OFAC feed rather than fixed dated entries; no answer text requires editing. If `assets/super-data.js` contains OFAC citation links, confirm the Recent Actions/SDN URLs still resolve. No country/risk data in `index.html` needs revision from this delta (UAE not implicated).

- **Suggested citation**: US OFAC — Recent Actions (https://ofac.treasury.gov/recent-actions), accessed July 2026 — cite only as the general feed; do not cite individual designation entries unless a specific matter requires it.

SEVERITY: LOW — Routine OFAC recent-actions churn with no new UAE-relevant obligations, thresholds, or deadlines.

### Egmont Group of FIUs
- **What appears to have changed**: The news feed rolled forward with new items: a "2026 Egmont Plenary, Baku, Azerbaijan Co-Chairs' Statement" (July 13, 2026) and confirmation of the 32nd Plenary in Baku (July 3, 2026). The previously featured "Strengthening ties with AMLA" item dropped from the top listing.
- **Likely app impact**: No obligation, threshold, or instrument changes. This is a news/events listing update, not a standard or typology publication. No changes required to Regulatory Q&A answers, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`. If desired, general references to Egmont Group activity (FIU information-sharing, plenary outputs) could optionally note the 2026 Baku Plenary, but nothing is mandatory.
- **Suggested citation**: Only if an update is warranted — "Egmont Group of FIUs, 2026 Egmont Plenary (Baku, Azerbaijan) Co-Chairs' Statement, 13 July 2026" — pending review of the actual statement text (not visible here).

SEVERITY: LOW — Routine news feed rollover (plenary announcements); no new obligations, thresholds, or instruments.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The "find a member" directory was updated — a few certified members were added/removed (e.g., "Emirates Minting Factory LLC, Dubai, UAE" now appears; "Melanie Pigeaud Jewelry, Amsterdam" and "Dhani Jewels Private Limited, Surat" removed). The per-country member counts (e.g., China, India, Belgium) shifted accordingly.
- **This is routine membership-directory churn**, not a change to standards, obligations, or the RJC framework itself.

- **Likely app impact**: Minimal. No Regulatory Q&A topic or threshold changes. If assets/super-data.js or index.html reference specific RJC-certified counterparties (e.g., for dealer/refiner due-diligence examples), the UAE entry "Emirates Minting Factory LLC, Dubai" could be noted as a current RJC member, but this is a data refresh, not a regulatory update. No country/risk classification impact.

- **Suggested citation**: If any refresh is warranted, cite generically: "Responsible Jewellery Council — Find a Member directory" (https://www.responsiblejewellery.com/). Do not cite a standard or circular, as no COP/CoC/LGMS change is evidenced.

SEVERITY: LOW — routine membership-directory update with no change to standards, obligations, or thresholds.
