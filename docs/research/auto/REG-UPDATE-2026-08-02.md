# Regulatory update proposal — 2026-08-02

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### FATF — guidance, recommendations & news

- **What appears to have changed**: The added and removed segments are effectively identical navigation/boilerplate text (site menu: "The FATF", "What we do", "Who we are", "Mandate", "Outcomes of meetings", etc.), indicating a re-render or minor reordering of the publications landing page rather than new substantive content.
- **The current page could not be re-fetched (HTTP 403)**, so no publication titles, dates, or document text were available to confirm whether any new guidance, recommendation, or statement was actually posted.
- **On the available evidence this looks like routine site churn**; no new instrument, threshold, obligation or deadline is visible in the delta.

- **Likely app impact**: None identified at this stage. No change proposed to Regulatory Q&A answers, Super Tools citations in `assets/super-data.js` (e.g. FATF Recommendations / Risk-Based Approach guidance references), or the FATF grey/black-list country and risk data in `index.html`. Recommend a manual re-check of the FATF publications page (and the "High-Risk and Other Monitored Jurisdictions" statements) after the next FATF Plenary, since the 403 means list changes cannot be ruled out from this crawl alone.

- **Suggested citation**: No update warranted on current evidence. If a re-check confirms substantive content, cite by exact document title as published, e.g. *FATF, "Publications" (fatf-gafi.org)* — and for list-related updates, the relevant *FATF Public Statement on High-Risk Jurisdictions subject to a Call for Action* / *Jurisdictions under Increased Monitoring*, using the published date only once verified.

SEVERITY: LOW — Delta is duplicated navigation boilerplate with no substantive content; page fetch blocked (403), so re-check advised.

### OECD — Responsible Mineral Supply Chains (CAHRA)

- **What appears to have changed**: The OECD Responsible Business Conduct landing page replaced the link/reference to the "NCPs Annual Report 2024" with the "NCPs Annual Report 2025" (PDF, ~2 MB); surrounding text on the 52 adherents to the OECD Declaration on International Investment (integrating the RBC Guidelines, first adopted 1976) is unchanged.
- A navigational item ("Find a National Contact Point") no longer appears in the extracted text — likely a menu/layout reshuffle rather than removal of the function.
- No change detected to the OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas (CAHRA), its five-step framework, or any CAHRA definitions/thresholds. This looks like routine annual-publication refresh and site churn.

- **Likely app impact**: Minimal. Optional housekeeping only:
  - `assets/super-data.js` — any Regulatory Q&A answer or Super Tools citation on DPMS/gold and precious metals supply-chain due diligence that cites OECD RBC materials could have the publication-year reference refreshed (2024 → 2025) if the NCP annual report is cited; the underlying CAHRA guidance citation stays as-is.
  - `index.html` — no country/risk or CAHRA jurisdiction list changes indicated; no update needed. UAE-specific obligations (Cabinet Decision-based DPMS/AML requirements and CBUAE/MoE guidance) are unaffected by this delta.

- **Suggested citation**: OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas (3rd edition) — with, if the NCP reference is retained, OECD, *Annual Report on the OECD Guidelines for Multinational Enterprises / National Contact Points Annual Report 2025*.

SEVERITY: LOW — Annual report
