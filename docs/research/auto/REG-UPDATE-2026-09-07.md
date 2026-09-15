# Regulatory update proposal — 2026-09-07

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The added and removed segments are textually identical (Arabic homepage banner content: "الإعلانات الهامة مارس 11 2021 نشرة العلامات التجارية…", promotional investment/100% ownership carousel copy). This indicates a re-ordering, re-rendering or whitespace/markup shift rather than a content change.
- **No new AML/CFT substance is visible**: no reference to DNFBP or DPMS obligations, registration deadlines, goAML/SACM notices, thresholds or penalties appears in the delta.
- **Verification gap**: the current page could not be fetched (`UND_ERR_CONNECT_TIMEOUT`), so the live homepage state is unconfirmed. Treat as routine site churn pending a successful re-crawl; the dynamic carousel on the MoE homepage is a known source of false-positive deltas.

- **Likely app impact**: None expected at this stage.
  - `assets/super-data.js`: no change needed to DNFBP/DPMS Regulatory Q&A answers (MoE supervisory role, DPMS AED 55,000 cash/wire threshold reporting, registration on the MoE/AML systems) or to Super Tools citations pointing at MoE as DNFBP supervisor.
  - `index.html`: no change to UAE country/risk data or supervisor mapping.
  - Suggested action: re-crawl and, if possible, monitor the MoE AML/DNFBP sub-pages and "Publications/الاصدارات" and circulars sections directly rather than the homepage, to reduce carousel-driven noise.

- **Suggested citation**: No new instrument to cite. If a future substantive update is confirmed, cite generically as "UAE Ministry of Economy — AML/CFT guidance for DNFBPs / Dealers in Precious Metals and Stones (MoE website, accessed [date])"

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: Two previously separate text segments on the homepage ("go to iems portal&nbsp;" and "unsure about your reporting obligations?") now appear merged into a single extracted segment ("go to iems portal unsure about your reporting obligations?"). No wording, links, or substantive content differ.
- The underlying homepage content is unchanged: goAML portal for STR/SAR submission, IEMS portal for FIU enquiries/freeze orders/case correspondence, and a "view detailed reporting guidance" link all remain present.
- This looks like routine site churn — a whitespace/DOM segmentation artefact from the extractor, not a regulatory or content update.

- **Likely app impact**: None expected. Existing Regulatory Q&A answers referencing goAML registration/STR-SAR filing and the IEMS enquiry-response channel remain accurate; no Super Tools citations in `assets/super-data.js` or country/risk data in `index.html` require amendment. Optional low-priority check only: confirm any stored FIU portal descriptions still distinguish goAML (report submission) from IEMS (RFI responses, freeze orders) — the page continues to support that split.

- **Suggested citation**: UAE Financial Intelligence Unit — goAML / IEMS reporting portals, uaefiu.gov.ae homepage ("Reporting & Enquiries"), accessed [date]. No article, circular or instrument number is visible on the page to cite.

SEVERITY: LOW — Whitespace/segment-merge artefact only; no change to obligations, thresholds or instruments.

### Dubai Gold & Jewellery Group / DMCC (sector)
- **What appears to have changed**: The homepage news/insights carousel rotated its headline items. A new item appears: "first tokenised commodity asset launched under DMCC-VARA framework with world-record silver bar"; the lab-grown diamond vertical item remains but the DMCC Gaming Centre / Serbian Games Association item dropped off the visible rotation.
- **What appears to have changed**: No change detected to licensing, compliance, DPMS/precious-metals AML content, or free zone regulatory text in the extracted body; the corporate tax free-zone paragraph and ecosystem listings are unchanged.
- **What appears to have changed**: Largely promotional carousel churn — but the new item references a named regulatory framework (DMCC–VARA) applied to a tokenised physical commodity, which is substantively relevant to our sector coverage rather than pure churn.

- **Likely app impact**:
  - Regulatory Q&A: any answer covering DPMS / precious metals & stones dealers in UAE free zones may warrant a note that DMCC commodity assets can now be issued in tokenised form under a DMCC–VARA arrangement, which blurs the DPMS / virtual asset boundary (customer due diligence, source of funds, and beneficial ownership of the underlying bar vs. the token holder).
  - Regulatory Q&A: virtual asset / VASP topics referencing VARA supervision in Dubai may need a cross-reference that tokenised commodities within DMCC sit alongside DMCC's own free zone regime — worth checking whether existing answers imply VARA-only or DMCC-only supervision.
  - Super Tools citations in `assets/super-data.js`: DMCC / DPMS-related sector citations pointing at dmcc.ae homepage content should be re-pointed to the stable DMCC compliance/precious metals pages rather than the rotating news carousel, to avoid future false-positive deltas.
  - Country/risk data in `index.html`: no change required to UAE ris

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The member directory listing on the homepage refreshed — one additional certified member entry appears in the "recently added / find a member" carousel ("bbhg sa, switzerland") alongside existing entries (Namdar Namibia, Pe Jay Creations, Dwarka Jewel, 01 Jewelry, Marbelli Srl).
- The per-country member counter block was re-rendered with no visible change in the truncated figures (e.g. Canada (8), China (35), India (298), Italy (331), Israel (42), Hong Kong (86), Bahrain (2), Jordan (2), Egypt (5)); UAE counts are beyond the truncation and were not verifiable in this delta.
- No change detected to RJC standards documents (Code of Practices, Chain of Custody, Laboratory Grown Material Standard), assurance rules, or governance/policy pages. This reads as routine directory/site churn rather than a standards update.

- **Likely app impact**: Minimal. No changes needed to obligation-bearing content.
  - `assets/super-data.js`: no citation edits required. If any DPMS/precious-metals-and-stones Q&A answer references RJC certification or the "find a member" directory as a counterparty due-diligence aid, the wording remains valid; only re-verify that the URL still resolves.
  - `index.html` country/risk data: no impact — no jurisdiction risk classification derives from RJC member counts, and no sanctioned/high-risk jurisdiction gained members in the visible delta.
  - Optional housekeeping: refresh any "as at" date on RJC-sourced supply-chain due diligence guidance references.

- **Suggested citation**: Responsible Jewellery Council, *Code of Practices* / *Chain of Custody Standard* (and RJC "Find a Member" directory, responsiblejewellery.com) — cite only if an update to DPMS supply-chain due diligence guidance is separately warranted; nothing in this delta requires a new citation.

SEVERIT
