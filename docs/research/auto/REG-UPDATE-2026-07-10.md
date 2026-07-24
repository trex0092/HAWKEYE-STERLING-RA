# Regulatory update proposal — 2026-07-10

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Financial Intelligence Unit (FIU) — goAML
- **What appears to have changed**: The only substantive delta is the visitor counter incrementing (2,086,663 → 2,088,683) between captures. No changes to obligations, guidance, or content.
- **Likely app impact**: None. This is routine site churn (dynamic visitor tally and search-template placeholders). No Regulatory Q&A topics/answers, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html` require updating.
- **Suggested citation**: No update warranted. If a general goAML/FIU reference is ever needed, cite: "UAE Financial Intelligence Unit (FIU) — goAML, uaefiu.gov.ae (page last updated 9 February 2024)."

SEVERITY: LOW — Only a dynamic visitor counter changed; no obligations, thresholds, or instruments affected.

### UAE Executive Office for Control & Non-Proliferation (EOCN)
- **What appears to have changed**: The monitored URL now returns a "request rejected" WAF/security block page ("your support id is: [go back]") instead of usable content.
- **What appears to have changed**: The previously detected text was itself an Arabic "page not found" (404) error, so both the old and new states are error pages, not substantive regulatory content.
- **What appears to have changed**: This looks like routine site churn / access-control behavior (blocked crawler or moved endpoint), not a change to any obligation, threshold, or instrument.

- **Likely app impact**: None indicated by the delta itself. No substantive EOCN content was captured, so no Regulatory Q&A topics/answers, no Super Tools citations in `assets/super-data.js`, and no country/risk data in `index.html` require changes based on this delta. Recommend re-checking the correct live EOCN URL to confirm the source path is still valid.

- **Suggested citation**: None warranted from this delta. If a working page is located, cite it generically as "UAE Executive Office for Control & Non-Proliferation (EOCN)" — do not attach any circular/decision number, as none is visible.

SEVERITY: LOW — Both old and new captures are error/block pages; no regulatory content or obligation changed.

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: The delta reflects routine content rotation on the DMCC homepage — a diamond tender event ("bonas rough diamond tender, 17–25 Jul 2026") was added to the events feed, while the events list otherwise reordered. News items (Dubai Diamond Exchange–London Diamond Bourse MoU; launch of "DMCC Cyber") persist across both versions.
- No new AML/CFT obligation, threshold, instrument, or deadline is visible in the extracted text; this looks like standard site/event-calendar churn.

- **Likely app impact**: None required. DMCC remains relevant as the designated free zone hosting DNFBP precious-metals/stones dealers (DPMS) under UAE AML/CFT. If Regulatory Q&A or Super Tools entries reference DMCC's role as a DPMS ecosystem/supervisory context, existing citations remain valid — no data change in `assets/super-data.js` or country/risk data in `index.html` is warranted from this delta alone.

- **Suggested citation**: None warranted. If a DMCC-specific reference is ever needed, cite the DMCC website (https://www.dmcc.ae/) as the sector/free-zone source; do not fabricate circular numbers. Any DPMS obligations should be sourced from the underlying UAE AML/CFT framework (e.g., Federal Decree-Law No. 20 of 2018 and Cabinet Decision No. 10 of 2019), not this page.

SEVERITY: LOW — Event-calendar reordering and persistent news items; no obligations, thresholds, or instruments changed.

### LBMA — Responsible Sourcing

- **What appears to have changed**: The detected delta is almost entirely navigation/menu boilerplate (site header, membership, good delivery, pricing menus) plus the removal of two loader/verification placeholder strings ("one moment, please...", "please wait while your request is being verified..."). This indicates the crawler captured the fully rendered page rather than an anti-bot interstitial — i.e., routine site churn, not a substantive policy change.
- **Substantive items visible (not necessarily new)**: The page references an active **public consultation on Responsible Gold Guidance version 10 (RGG10)** and **Disclosure Guidance version 3**, and an ASM (artisanal & small-scale mining) inclusion report covering 2022–2025. These are worth monitoring but no new binding obligation, threshold, or deadline is confirmed in the extracted text.
- **Likely app impact**: Minimal at this time. If RGG10 finalizes, review any Regulatory Q&A topics or Super Tools citations in `assets/super-data.js` referencing LBMA responsible sourcing / Responsible Gold Guidance for precious-metals dealers (DPMS/DNFBP context). No changes needed to country/risk data in `index.html` — LBMA guidance is standards-based, not jurisdiction risk data.
- **Suggested citation**: LBMA Responsible Sourcing Programme — Responsible Gold Guidance (currently v9; v10 in public consultation). Cite only the finalized version once published; do not cite RGG10 as effective yet.

SEVERITY: LOW — Detected delta is navigation boilerplate and loader-text removal; RGG10 remains a consultation, no new effective obligation.

### OECD — Responsible Mineral Supply Chains (CAHRA)

- **What appears to have changed**: The detected delta shows identical added and removed segments consisting of generic site navigation/boilerplate text ("regions publications publications browse all publications..."). No substantive content change to guidance, obligations, or CAHRA-related material is visible.
- This is consistent with routine site churn — likely a re-rendering of navigation menus or publication-listing scaffolding, not a policy update.
- The extracted page body is a generic OECD topics landing page and does not contain any changed CAHRA due-diligence obligations, thresholds, or instrument revisions.

- **Likely app impact**: None warranted at this time. No changes needed to Regulatory Q&A topics/answers or Super Tools citations in `assets/super-data.js`, nor to country/risk data in `index.html`. If any citation currently references this OECD landing URL as a proxy for the CAHRA guidance, consider re-pointing it to the specific *OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas* document rather than the topics hub — but this is optional housekeeping, not obligation-driven.

- **Suggested citation**: If an update is ever warranted, cite the *OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas* (no specific edition/number visible in the extracted text — verify before citing).

SEVERITY: LOW — Added/removed segments are duplicate navigation boilerplate; no obligation or content change detected.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The "find a member" directory refreshed its per-country member counts (added/removed segments are near-identical country listing blocks, e.g. the same `brunei darussalam ... china (36)` run), indicating updated membership tallies rather than content change.
- **A small set of member listings were surfaced** (e.g. "acf sas — france", "vishrut gems — india", "palm creation co. — thailand"), consistent with directory pagination/index updates.
- This looks like **routine site churn** — dynamic member-count and directory refresh, with no change to standards, obligations, or thresholds.

- **Likely app impact**: Minimal. No AML/CFT obligation, threshold, or instrument changed. If your Regulatory Q&A or Super Tools reference RJC as a supply-chain due-diligence standard-setter (e.g. DPMS/precious metals & stones due diligence), no substantive edit is needed. Country/risk data in `index.html` should not be updated from a member-count directory — these tallies are not risk indicators.

- **Suggested citation**: No new instrument to cite. If RJC is already referenced, retain the existing citation to the **RJC Code of Practices (COP)** and/or **RJC Chain of Custody (CoC) Standard** as voluntary responsible-sourcing standards; do not attach a specific version/number as none is visible in the extracted text.

SEVERITY: LOW — Member-directory counts refreshed; no change to obligations, thresholds, or instruments.
