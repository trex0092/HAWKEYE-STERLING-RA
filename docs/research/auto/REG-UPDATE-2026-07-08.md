# Regulatory update proposal — 2026-07-08

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**:
  - Content last-updated date shows **9 February 2024**, while footer copyright reads **© 2026**, suggesting a template/footer rollover rather than substantive content change.
  - No new publications, STR/goAML process updates, or notifications are visible ("no new notifications"); the "What's New" list remains dated 2019–2022.
  - Appears to be **routine site churn** (footer year, visitor counter, template rendering) with no material regulatory or reporting-process change evident in the extracted text.

- **Likely app impact**:
  - **Minimal.** No STR process, goAML registration, or reporting-obligation changes are visible that would require edits to Regulatory Q&A answers on FIU reporting/STR filing.
  - Super Tools citations in `assets/super-data.js` referencing the FIU homepage or goAML remain valid; only verify the **URL and "last updated" date** if we display one.
  - No country/risk data in `index.html` is affected — this is an FIU operational page, not a jurisdictional risk source.

- **Suggested citation**:
  - If any update is warranted (URL/date refresh only): **UAE Financial Intelligence Unit (FIU) — goAML portal**, https://www.uaefiu.gov.ae/en/ (page last updated 9 February 2024).
  - No new instrument, circular, or article number is visible in the text; **do not cite one**.

**Recommendation:** No content edit required. Log as routine churn and re-monitor for future publications/STR-process updates.

### UAE Executive Office for Control & Non-Proliferation (EOCN)

- **What appears to have changed**: The extracted content shows only a "request rejected" / access-denied error page ("your support id is: [go back]"), not substantive source text. This indicates a blocked/failed fetch (e.g., WAF or bot-protection challenge) rather than a confirmed content change. No verifiable change to source material can be identified from this capture; likely a routine access/fetch issue, not editorial churn.

- **Likely app impact**: None warranted at this time. Because no actual EOCN content was retrieved, do not modify Regulatory Q&A topics/answers or Super Tools citations in `assets/super-data.js`, nor country/risk (targeted financial sanctions / proliferation financing) data in `index.html`. Any EOCN-linked entries (e.g., TFS obligations, UNSC list implementation, PF references) should remain unchanged pending a successful re-fetch.

- **Suggested citation**: None — defer citation until the live page is successfully retrieved and its actual instrument/title is confirmed. Recommend re-crawling the source (with appropriate access handling) before any edit is proposed.

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**:
  - The extracted content is the DMCC corporate homepage/marketing landing page (business setup, ecosystems, "Future of Trade" report, free zone/corporate tax positioning). No AML/CFT-specific content is visible.
  - No visible DPMS (dealers in precious metals and stones) compliance guidance, MLRO obligations, or sector AML circulars in this extract.
  - This looks like routine site churn / general homepage refresh rather than a substantive regulatory change.

- **Likely app impact**:
  - Low/none based on this extract. No trigger to update Regulatory Q&A topics on DNFBP/DPMS obligations, gold sector due diligence, or free zone AML supervision.
  - If our Super Tools citations in `assets/super-data.js` reference DMCC as a sector source/URL, verify the link still resolves (homepage still live) — no content-driven edit needed.
  - No change to country/risk data in `index.html` warranted from this page.

- **Suggested citation**:
  - None required from this page. If a DMCC AML reference is needed elsewhere, cite the DMCC-specific AML/DPMS compliance guidance page rather than the homepage (verify exact title/URL before citing). Do not cite the marketing homepage as a regulatory source.

### Responsible Minerals Initiative (RMI)

- **What appears to have changed**:
  - New June 2026 items: an RMI statement responding to a Global Witness report on coltan, and RMI's "All Minerals Standard" achieving full LME recognition.
  - May 2026: ILO–RMI partnership announced to address child labour in mineral supply chains.
  - Prior notable items still visible: RMI RMAP recognized by the European Commission for Conflict Minerals Regulation compliance (Oct 2025), new standard suite release (Apr 2025), and the eastern DRC conflict statement (Feb 2025). The most material *new* developments here are the LME recognition and the coltan/Global Witness statement.

- **Likely app impact**:
  - **Regulatory Q&A – DPMS / mineral supply chain due diligence**: answers referencing OECD-aligned schemes and CAHRAs (conflict-affected and high-risk areas) may benefit from noting RMI RMAP's EC recognition and the new All Minerals Standard scope.
  - **Super Tools citations in assets/super-data.js**: any RMI/RMAP or "responsible sourcing" reference should be checked for currency (standard suite, DAP alignment, EC recognition status).
  - **Country/risk data in index.html**: DRC / Great Lakes region risk flagging remains relevant (eastern DRC statement, coltan concerns, paused ITSCi recognition) — verify DRC is still flagged as high-risk for minerals sourcing.

- **Suggested citation**:
  - "Responsible Minerals Initiative (RMI), News & Events" — https://www.responsiblemineralsinitiative.org/news/ (cite specific item by title/date, e.g. "RMI RMAP is first scheme recognized by European Commission for Conflict Minerals Regulation compliance, Oct 20, 2025", once verified on the live page).

*Note: Reviewer to confirm dated items on the live page before editing; no article/circular numbers are asserted here beyond those visible in the extract.*

### LBMA — Responsible Sourcing

- **What appears to have changed**:
  - A public consultation on **Responsible Gold Guidance version 10 (RGG10)** is referenced, described as drawing on implementation experience since v9 and developments in responsible sourcing practice.
  - **Disclosure Guidance version 3** is listed among guidance documents.
  - A new report on **responsibly sourced ASM (artisanal and small-scale mining) gold (2022–2025)** and an LBMA position on the North Mara mine claim are referenced.
  - Note: much of the extracted text is navigation/site chrome (menus, events, pricing). The substantive signals are the RGG10 consultation and Disclosure Guidance v3; the rest appears to be routine site churn.

- **Likely app impact**:
  - Any Regulatory Q&A topic covering **precious metals / gold supply chain due diligence** or **responsible sourcing for refiners** may need a version note (RGG v9 → v10 pending consultation).
  - Super Tools citations in `assets/super-data.js` that reference LBMA Responsible Gold Guidance or Disclosure Guidance should be checked for version numbers (avoid citing v10 as final until consultation concludes).
  - Country/risk data in `index.html` relating to **gold origin / ASM sourcing risk** could be reviewed against the new ASM report, though no new country designations are evident from this text.

- **Suggested citation**:
  - LBMA, *Responsible Sourcing Programme* — https://www.lbma.org.uk/responsible-sourcing
  - LBMA, *Responsible Gold Guidance (public consultation, version 10)* — cite as consultation draft only.
  - LBMA, *Disclosure Guidance version 3* (if referenced in an updated answer).

*Proposal for MLRO review — version numbers above are as visibly stated; RGG10 is in consultation and should not be cited as an in-force instrument.*

### US OFAC — Recent Actions

- **What appears to have changed**:
  - New recent actions posted through **July 07, 2026**, including an amended Iran-related general license (Jul 07) and the **2026 annual report of blocked property** filing reminder (Jul 01).
  - Multiple sanctions list updates in late June 2026: counter narcotics, counter terrorism, Russia-related designations/removals, Sudan-related and DRC-related designations, plus a Venezuela-related general license.
  - Notable non-list items: **launch of the OFAC Reconsideration Portal** (Jun 29) and publication of a **TSRA licensing activities report** (Jun 30). Overall this looks like routine OFAC recent-actions churn, though the reconsideration portal is a procedural addition worth noting.

- **Likely app impact**:
  - Regulatory Q&A topics on **sanctions screening / SDN list obligations** may need a refreshed "last reviewed" date and a note that OFAC updates SDN/consolidated lists on a rolling basis.
  - Super Tools citations in `assets/super-data.js` referencing OFAC list-update cadence or the SDN/Consolidated Sanctions List should be checked for currency (no substantive UAE-facing rule change identified).
  - Country/risk data in `index.html` for **Iran, Russia, Venezuela, Sudan, DRC** may warrant a review flag, but no new country listing appears — designations here are entity/individual-level, not new jurisdictions.
  - Consider adding a reference to the **OFAC Reconsideration Portal** if any Q&A covers delisting/appeal procedures.

- **Suggested citation**:
  - US Department of the Treasury, Office of Foreign Assets Control — *Recent Actions* (recent actions dated through July 07, 2026), https://ofac.treasury.gov/recent-actions.
  - If citing a specific item, use the visible action titles (e.g., "Issuance of amended Iran-related General License, July 07, 2026" or "Launch of OFAC Reconsideration Portal

### Responsible Jewellery Council (RJC)
- **What appears to have changed**:
  - Homepage now references governance updates: "new officer and board appointments following 2026 AGM" and a "2026 annual progress report."
  - A "Standards & Audit Changes Information Pack" is referenced, indicating updates to standards, audits, and certification requirements (specific version/date not visible in text).
  - Remaining content (membership, three standards — CoP, CoC, LGMS — member directory) appears to be routine site churn with no substantive AML/CFT policy change visible.

- **Likely app impact**:
  - **Low/indirect impact.** RJC is a voluntary industry standard-setter, not a UAE regulator; changes here do not alter UAE AML/CFT legal obligations.
  - Any Super Tools citation in `assets/super-data.js` referencing RJC standards for DPMS (dealers in precious metals and stones) responsible-sourcing due diligence may warrant a version/date check if "Standards & Audit Changes" reflect a new Code of Practices edition.
  - No country/risk data in `index.html` needs updating — the member-count directory is not a risk indicator and should not be treated as one.

- **Suggested citation**:
  - If an update is warranted, cite the **RJC Code of Practices (COP)** and/or **RJC Chain of Custody (CoC) Standard** — verify the current edition/year on the Standards page before citing, as no specific version number is visible in the extracted text.

*Note: Recommend confirming the actual standards/audit changes via the referenced information pack before any edit, as the homepage text does not state a version or effective date.*
