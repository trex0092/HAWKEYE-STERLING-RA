# Regulatory update proposal — 2026-07-24

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor
- **What appears to have changed**: The ADDED and REMOVED segments are identical ("الإعلانات الهامة مارس 11 2021 نشرة العلامات التجارية..." trademark bulletin / promising-sectors promotional banner text). This indicates a no-op delta — most likely cosmetic re-rendering or reordering of homepage marketing/announcement content.
- No changes are visible to any AML/CFT-relevant sections (e.g., "مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", "التسجيل في نظام goaml", "تشريعات مواجهة جرائم غسل الاموال").
- This looks like routine site churn, not a substantive regulatory change.

- **Likely app impact**: None expected. No updates warranted to Regulatory Q&A topics (DNFBP/DPMS obligations, goAML registration, TFS), Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`. If desired, verify the MoE AML landing pages ("مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", goAML registration) still resolve, but no content edit is indicated by this delta.

- **Suggested citation**: None required. If any future substantive change is confirmed, cite generically as *UAE Ministry of Economy — Anti-Money Laundering and Combating the Financing of Terrorism (DNFBP supervision)*, without inventing decision/circular numbers.

SEVERITY: LOW — identical added/removed marketing banner text; no AML/CFT obligation or instrument change detected.

### US OFAC — Recent Actions
- **What appears to have changed**: The top of the Recent Actions feed rolled over to a new dated entry (July 23, 2026) containing counter-terrorism designations, counter-narcotics designations, Cuba designations, a Belarus-related designation removal, and issuance of Cuba-related general licenses.
- **What appears to have changed**: Older entries (Russia-related updates, Venezuela FAQ, Hong Kong designations/removals, Iran/DRC general licenses) shifted down the list as newer items were added — consistent with the normal daily/weekly churn of the OFAC feed.
- **What appears to have changed**: No new UAE-specific obligation, threshold, or instrument is visible; this is routine SDN/sanctions-list turnover rather than a rule change.

- **Likely app impact**: Low direct impact. Review any Regulatory Q&A topics referencing OFAC sanctions screening, and any Super Tools citations in `assets/super-data.js` that point to OFAC SDN/consolidated lists — confirm they instruct users to check the live list rather than caching specific designations. Country/risk data in `index.html` covering Cuba, Belarus, Iran, Russia, Venezuela may warrant a light review only if the app hardcodes designation status (it should reference the live source instead).

- **Suggested citation**: US Department of the Treasury, Office of Foreign Assets Control (OFAC) — Recent Actions, entry dated July 23, 2026 (https://ofac.treasury.gov/recent-actions). Cite the specific SDN/consolidated list update only if a downstream screening reference is being changed.

SEVERITY: LOW — Routine OFAC feed turnover; no new UAE-facing obligations, thresholds, or instruments.

### UN Security Council — Consolidated List
- **What appears to have changed**: The list was updated from **16 July 2026 to 22 July 2026** (new version supersedes prior).
- The entity count increased by one: **entities and other groups from 274 to 275**; individual count unchanged at 736.
- This is a routine periodic list refresh (one net entity addition); no changes to obligations, thresholds, or listing mechanisms are visible.

- **Likely app impact**: Minimal. No Regulatory Q&A topic or Super Tools citation in `assets/super-data.js` should require substantive edits, since the underlying UNSC screening obligation is unchanged. If the app displays a "last updated" date or entity/individual counts for the UN Consolidated List, those static figures may need refreshing. No changes to country/risk data in `index.html` are indicated. Operational note only: screening feeds should already ingest the 22 July 2026 version automatically.

- **Suggested citation**: UN Security Council Consolidated List, last updated 22 July 2026 — https://www.un.org/securitycouncil/content/un-sc-consolidated-list

SEVERITY: LOW — Routine periodic list refresh (net +1 entity); no new obligations, thresholds, or instruments.

### Responsible Jewellery Council (RJC)

- **What appears to have changed**: The added and removed segments are effectively identical text from the "Find a Member" directory (country listings with member counts). This indicates the changes are limited to fluctuating per-country membership tallies rather than any substantive content, standard, or policy update.
- No changes to standards (CoP, CoC, LGMS), certification requirements, or governance are visible in the delta.
- This looks like routine site churn from a dynamically generated member-count directory.

- **Likely app impact**: None warranted. This delta does not touch AML/CFT obligations. No update needed to Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`. RJC is relevant only as a voluntary industry standard-setter for responsible sourcing in the DPMS/jewellery sector, not a regulatory source; note UAE precious metals/stones dealers remain governed by MoE/Cabinet DNFBP obligations regardless of RJC membership.

- **Suggested citation**: No new instrument to cite. If contextual reference to voluntary sourcing standards is ever needed, cite generically the "RJC Code of Practices (CoP)" — do not attribute any obligation or number to this change.

SEVERITY: LOW — Identical member-directory text re-indexed; only dynamic country member counts changed, no obligations affected.
