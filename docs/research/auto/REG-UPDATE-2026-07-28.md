# Regulatory update proposal — 2026-07-28

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The ADDED and REMOVED segments are byte-for-byte identical ("الإعلانات الهامة مارس 11 2021 نشرة العلامات التجارية…"). This indicates no substantive content change — likely routine site churn (re-ordering, cache/render variation, or dynamic carousel/banner reload).
- The captured text is the homepage navigation and marketing banners (investment, tourism, entrepreneurship). No AML/CFT-specific content (goAML, TFS, DNFBP/DPMS obligations) shows any delta.
- No new thresholds, instruments, deadlines, or DNFBP/DPMS guidance are visible in the changed segments.

- **Likely app impact**: None expected. No changes needed to Regulatory Q&A topics/answers, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`. The MoE remains the DNFBP/DPMS AML supervisor; existing references to MoE supervision, goAML registration, and Targeted Financial Sanctions obligations are unaffected by this delta.

- **Suggested citation**: No update warranted from this delta. If a general MoE AML reference is ever needed, cite the MoE AML/CFT pages already linked on-site — "تشريعات مواجهة جرائم غسل الاموال" / "مواجهة غسل الأموال وتمويل الإرهاب" (MoE AML/CFT legislation & supervision pages) — without asserting any specific circular number not present here.

SEVERITY: LOW — Added and removed segments are identical; routine site churn with no AML/CFT content change.

### OECD — Responsible Mineral Supply Chains (CAHRA)

- **What appears to have changed**: The detected deltas are confined to navigation/promotional elements (podcast links, "featured events" listings, and event dates). The changes swap out one set of event promotions (e.g., "economic impact assessment of the global minimum tax") for another (e.g., "4th OECD Blue Sky Forum"). This is routine site churn, not a substantive change to CAHRA/due diligence guidance.
- **No substantive content change detected**: The core page could not be fetched (HTTP 403), so the actual Due Diligence Guidance text was not verified. The observed deltas relate only to rotating event/navigation banners and carry no AML/CFT obligation, threshold, or instrument change.

- **Likely app impact**: None indicated. No update appears warranted to Regulatory Q&A topics on responsible mineral sourcing / CAHRA due diligence, nor to Super Tools citations in `assets/super-data.js`, nor to country/risk data in `index.html`. If a future fetch reveals a new edition of the OECD Due Diligence Guidance, revisit gold/DPMS (dealers in precious metals and stones) risk answers then.

- **Suggested citation**: If a substantive update were later confirmed, cite the *OECD Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas* — but no citation change is justified by this delta.

SEVERITY: LOW — Changes are rotating event/navigation banners; no obligation, threshold, or instrument affected (core page blocked by HTTP 403).

### US OFAC — Recent Actions

- **What appears to have changed**: The page refreshed its "Recent Actions" listing with new dated entries, most notably July 27, 2026 (Iran-related designations, amended Russia/Venezuela GLs and FAQs, regulatory amendments) and updated July 15, 2026 Iran-related entries.
- The delta is dominated by list-ordering/refresh churn (menu/header text re-added, whitespace variants like "iran -related" vs "iran-related") plus a routine addition of "sanctions list removals" — consistent with OFAC's normal daily/weekly action rotation rather than a structural change.
- No new sanctions program, threshold, or obligation is visible; the changes are additions/removals of designations under existing programs (Iran, Russia, Venezuela, Cuba, counter-terrorism, counter-narcotics).

- **Likely app impact**: Low. If the app maintains a sanctions-screening or OFAC-linkage topic in the Regulatory Q&A, or an OFAC "Recent Actions" citation/link in Super Tools (assets/super-data.js), confirm the URL still resolves — no answer text changes appear warranted. Iran/Russia/Venezuela country-risk flags in index.html need no change absent a program-level shift; only verify screening guidance still points users to the live SDN/Consolidated lists.

- **Suggested citation**: US OFAC — Recent Actions, Office of Foreign Assets Control (https://ofac.treasury.gov/recent-actions); for underlying lists, cite the OFAC SDN List and Consolidated (Non-SDN) List.

SEVERITY: LOW — Routine designation rotation and page refresh churn; no new obligations, thresholds, or instruments.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The ADDED and REMOVED segments are textually identical, indicating no substantive content change in the affected "find a member" country directory.
- The delta reflects the dynamic member-count listing (e.g., country tallies) on the "find a member" page, which fluctuates as membership numbers update.
- No new standards, obligations, thresholds, or instruments are visible in the extracted text.

- **Likely app impact**: Minimal to none. This is a member-directory count, not a regulatory instrument. No Regulatory Q&A topics/answers or Super Tools citations in `assets/super-data.js` require updating. No country/risk data in `index.html` is affected, as RJC member counts are not risk indicators for AML/CFT purposes.

- **Suggested citation**: No update warranted. If RJC is referenced for DPMS (Dealers in Precious Metals and Stones) responsible-sourcing context, the appropriate citation remains the RJC **Code of Practices (COP)** or **Chain of Custody (CoC) Standard** — not this directory page.

SEVERITY: LOW — Identical added/removed segments reflect routine member-directory churn, not any regulatory change.
