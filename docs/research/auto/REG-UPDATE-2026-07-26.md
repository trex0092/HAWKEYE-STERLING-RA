# Regulatory update proposal — 2026-07-26

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor

- **What appears to have changed**: The detected ADDED and REMOVED segments are identical (homepage "important announcements" banner text, dated March 11 2021, referencing a trademarks bulletin and investment-promotion content). No AML/CFT-specific text appears in the delta.
- This is consistent with routine site churn — likely a re-render, banner/carousel rotation, or whitespace/encoding difference rather than a substantive content change.
- No changes are visible to AML/CFT sections (e.g., "مواجهة غسل الأموال وتمويل الإرهاب", "العقوبات المالية المستهدفة", "التسجيل في نظام goAML", or "تشريعات مواجهة جرائم غسل الاموال"), which still appear in the current page navigation.

- **Likely app impact**: None required. No Regulatory Q&A topics (DNFBP/DPMS obligations, goAML registration, targeted financial sanctions) or Super Tools citations in `assets/super-data.js` need updating based on this delta. No country/risk data in `index.html` is affected.

- **Suggested citation**: No update warranted from this delta. If a future substantive change is confirmed, cite generically as "UAE Ministry of Economy — AML/CFT supervision for DNFBPs (moec.gov.ae)" without inventing circular/resolution numbers.

SEVERITY: LOW — Identical added/removed banner text (2021 announcement); routine site churn with no AML/CFT content change.

### Dubai Gold & Jewellery Group / DMCC (sector)

- **What appears to have changed**: The added and removed segments are identical text ("DMCC signs landmark MoU with Botswana Stock Exchange Group..."), indicating a news-feed refresh rather than substantive content change. This is routine site churn on a rotating news/insights carousel.
- **Likely app impact**: None warranted. No AML/CFT obligations, thresholds, DPMS (Dealers in Precious Metals & Stones) reporting requirements, or free-zone supervisory changes are reflected. No updates needed to Regulatory Q&A topics, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`. The Botswana trade-corridor MoU is a commercial announcement, not a regulatory instrument.
- **Suggested citation**: None required. If DMCC's DPMS supervisory role is ever cited elsewhere, retain existing references (e.g., MOEC/DMCC AML guidance for DNFBPs) — but no new citation is triggered by this delta.

SEVERITY: LOW — Identical add/remove text reflects routine news-carousel churn with no regulatory content.

### LBMA — Responsible Sourcing
- **What appears to have changed**: The added segments are navigation menus, page headers, login prompts, and conference promotions (e.g., "register for the global precious metals conference in sorrento"). The removed segments were loading/verification placeholders ("one moment, please...", "please wait while your request is being verified..."). This indicates the crawler captured a fully rendered page versus a prior loader/bot-check screen — routine site churn, not a substantive content change.
- **Likely app impact**: No changes to obligations are evident. The visible page references existing frameworks that may already be cited in `assets/super-data.js` (e.g., LBMA Responsible Gold Guidance, Good Delivery List, responsible sourcing programme). Note only: RGG **v10** is at public consultation (not yet in force) and platinum/palladium price administration moves to IBA from 1 July 2026 — neither requires action now but could warrant future review if adopted. No country/risk data in `index.html` needs updating from this delta.
- **Suggested citation**: If an update is warranted later, cite "LBMA Responsible Gold Guidance" (current in-force version) and/or "LBMA Responsible Sourcing Programme" — do not cite RGG v10 until finalized.

SEVERITY: LOW — Delta reflects loader/bot-check page replaced by rendered nav content; no new obligations or thresholds.

### UN Security Council — Consolidated List
- **What appears to have changed**: The detected "added" and "removed" segments are identical strings listing the standing sanctions committees (ISIL/Al-Qaida, 1518, DRC, Sudan, 1636, 1718/DPRK, 1737, etc.). This is navigation/boilerplate text, not actual listing entries.
- **No change is visible to the underlying Consolidated List of designated individuals/entities** — the delta reflects re-ordering or re-rendering of the committee menu, i.e. routine site churn.
- No new instruments, thresholds, obligations or designations are evident in the extracted text.

- **Likely app impact**: None required based on this delta. The Consolidated List remains the authoritative sanctions screening source referenced in Regulatory Q&A (targeted financial sanctions / UNSC screening topics). No specific Super Tools citation in `assets/super-data.js` or country/risk data in `index.html` needs updating from this change. If a periodic sanctions-list refresh is due, verify current designations directly from the machine-readable XML feed rather than this HTML page.

- **Suggested citation**: *United Nations Security Council Consolidated List* (UN Security Council) — cite only if a genuine designation update is confirmed via the official list feed.

SEVERITY: LOW — Delta is duplicated navigation boilerplate (committee menu), no change to actual designations or obligations.
