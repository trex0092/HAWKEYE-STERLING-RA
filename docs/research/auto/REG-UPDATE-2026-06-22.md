# Regulatory update proposal — 2026-06-22

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**:
  - The extracted content is almost entirely site navigation/chrome (header menus, ministry sections, tourism, open data) with no substantive AML/CFT body text captured. The page title now reflects "وزارة الاقتصاد والسياحة" (Ministry of Economy and Tourism), suggesting a possible ministry rebrand/structural relabeling.
  - Visible AML-relevant nav items remain present: "مواجهة غسل الأموال وتمويل الإرهاب" (Combating ML/TF), "العقوبات المالية المستهدفة" (Targeted Financial Sanctions), "التسجيل في نظام goAML", and "تشريعات مواجهة جرائم غسل الاموال" (AML legislation).
  - This looks consistent with **routine site churn / navigation re-rendering** rather than a confirmed substantive policy change. No new instrument, article, or circular number is visible in the extract.

- **Likely app impact**:
  - Low confidence of substantive change — recommend **no edits** until a clean (non-truncated) extract confirms real content changes.
  - If the ministry name change is confirmed, review any Regulatory Q&A topics referencing the "Ministry of Economy (MoE)" as DNFBP/DPMS supervisor for naming accuracy in `assets/super-data.js`.
  - Verify Super Tools citations pointing to the MoE AML page (goAML registration, TFS obligations for DNFBPs/DPMS) still resolve to the correct landing URL.
  - No country/risk data in `index.html` appears affected.

- **Suggested citation**:
  - If an update is warranted, cite generically: **UAE Ministry of Economy — "Anti-Money Laundering" / "مواجهة غسل الأموال وتمويل الإرهاب"**, https://u.ae/en/information-and-services/business/combatting-money-laundering (accessed [date]). Do not cite a specific decision/article number — none is visible

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - Content "last updated on 9 February 2024" with a footer copyright reading "© 2026", suggesting only template/footer churn rather than substantive content changes.
  - No new STR/goAML reporting guidance, publications, or typology reports beyond previously dated items (latest substantive items: 2022 Annual Report; 2021 TBML and legal-entity abuse strategic analysis reports).
  - This looks like routine site churn (navigation, footer year, boilerplate), not a regulatory or procedural update.

- **Likely app impact**:
  - Minimal. No changes warranting updates to Regulatory Q&A topics on STR/SAR filing or goAML reporting workflows.
  - Verify that any goAML/FIU citation links in `assets/super-data.js` still point to the correct live URL (https://www.uaefiu.gov.ae/en/) — link-target check only.
  - No country/risk data changes needed in `index.html` based on this snapshot.

- **Suggested citation**:
  - If a citation refresh is warranted (link/date only), cite: **UAE Financial Intelligence Unit (FIU) — goAML portal**, https://www.uaefiu.gov.ae/en/ (page content last updated 9 February 2024). Do not cite specific reports unless directly referenced.

### LBMA — Responsible Sourcing

- **What appears to have changed**:
  - The extracted text shows a **Sourcing Advisory** explicitly covering **Brazil, the Democratic Republic of Congo, Sudan, United Arab Emirates, and Zimbabwe** — UAE is named as a flagged jurisdiction in LBMA's responsible sourcing guidance.
  - References to a **Public Consultation: Responsible Gold Guidance Version 10** and **Disclosure Guidance Version 3** appear, suggesting in-progress updates to core responsible sourcing standards.
  - Much of the remaining content is navigation/menu boilerplate (Good Delivery, pricing, events, membership) and reads as **routine site churn** rather than substantive change.

- **Likely app impact**:
  - **Regulatory Q&A topics**: Any answers addressing precious metals / gold supply-chain due diligence, DPMS (Dealers in Precious Metals and Stones) obligations, or OECD-aligned responsible sourcing may need a note that UAE is named in LBMA's Sourcing Advisory.
  - **Super Tools citations (assets/super-data.js)**: Check entries citing LBMA Responsible Gold Guidance — if they reference an older version, flag for review against the pending **Version 10** consultation (do not update version number until finalized).
  - **Country/risk data (index.html)**: Consider whether UAE's risk context should reference its inclusion in the LBMA Sourcing Advisory alongside higher-risk jurisdictions (DRC, Sudan, Zimbabwe).

- **Suggested citation**:
  - LBMA — Responsible Sourcing Programme / Sourcing Advisory (Brazil, DRC, Sudan, UAE, Zimbabwe), https://www.lbma.org.uk/responsible-sourcing
  - For pending standards: LBMA Responsible Gold Guidance (Version 10 — *in consultation, not yet final*) — verify status before citing.

*Note: No article, circular, or dated version-
