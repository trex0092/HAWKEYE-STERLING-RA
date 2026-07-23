# Regulatory update proposal — 2026-07-13

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Financial Intelligence Unit (FIU) — goAML

- **What appears to have changed**: The only delta is the visitor counter (from ~2,092,665 to ~2,094,452). No substantive content, obligations, or dates changed — the "last updated" date remains 9 February 2024.
- **Likely app impact**: None. No Regulatory Q&A topics/answers, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html` require updating based on this delta.
- **Suggested citation**: No update warranted. If FIU/goAML reporting context is ever cited, reference "UAE Financial Intelligence Unit (FIU) — goAML" (https://www.uaefiu.gov.ae/en/) without any article/circular number, as none is visible.

SEVERITY: LOW — Only the page visitor counter incremented; no content, obligation, or date change.

### LBMA — Responsible Sourcing
- **What appears to have changed**: The extracted content shows only a bot-verification/interstitial page ("one moment, please... please wait while your request is being verified..."), not the actual Responsible Sourcing page.
- The removed segments are standard site navigation/boilerplate (menus, membership, login), consistent with the crawler being blocked rather than genuine content removal.
- No substantive change to sourcing standards, obligations, or thresholds is observable; this looks like a bot-detection/access artifact, not real site churn or a policy update.

- **Likely app impact**: None warranted from this delta. Do not modify Regulatory Q&A topics on responsible gold/precious-metals sourcing, `assets/super-data.js` Super Tools citations, or country/risk data in `index.html` based on an unverifiable capture. Re-crawl with proper access before assessing.

- **Suggested citation**: No update warranted. If/when the real page is captured, cite "LBMA Responsible Sourcing Programme" (https://www.lbma.org.uk/responsible-sourcing) — do not cite specific guidance versions or numbers until visible.

SEVERITY: LOW — Capture shows a bot-verification interstitial, not a genuine content change.

### Responsible Jewellery Council (RJC)
- **What appears to have changed**: The RJC "find a member" directory was updated — one member (`twinklediam nv`, Antwerp, Belgium) was removed from the listing while other entries (Germany, India, Belgium) persist. This reflects a change to the certified-member roster.
- **What appears to have changed**: No changes to standards, obligations, thresholds, or governance text; the delta is confined to the member directory listing. This looks like routine directory churn.
- **What appears to have changed**: Country member counts remain visible (e.g., UAE not shown in truncated text, but Bahrain (2), India (291), Belgium (132), Hong Kong (84)), with no structural change to the standards framework.

- **Likely app impact**: Minimal. If `assets/super-data.js` or `index.html` references RJC certification as a due-diligence/mitigating factor for jewellery/DPMS (dealers in precious metals and stones) counterparties, no citation update is needed — only member-verification lookups would be affected. Any tool that names specific RJC-certified members should note the directory is dynamic and should be verified live rather than cached.

- **Suggested citation**: If an update is warranted, cite the RJC "Find a Member" directory (https://www.responsiblejewellery.com/, member portal / find-a-member) as a supplementary counterparty-verification resource — not as a regulatory instrument. No RJC standard version or circular number is visible in the text to cite.

SEVERITY: LOW — single member removed from directory; no change to obligations, standards, or thresholds.
