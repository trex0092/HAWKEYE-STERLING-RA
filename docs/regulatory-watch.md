# Regulatory Watch

Automated monitoring of the regulations, circulars, procedures and guidance the
Hawkeye Sterling app relies on — **worldwide coverage, UAE-weighted**. When a
monitored source changes, the system opens a **pull request** so the change can
be reviewed and applied to the app's content (the Regulatory Q&A answers and
Super Tools citations in `assets/super-data.js`, and the country/risk data in
`index.html`).

> **Why a pull request, not an auto-edit?** Regulator-grade wording must be
> verified against the primary source before it goes live. Detection is fully
> automatic; the wording change is a reviewed decision. (Country black/grey
> **list** moves are handled separately by the [FATF Watchdog](../scripts/fatf-watchdog.mjs).)

## How it works

1. **Schedule** — `.github/workflows/regulatory-watch.yml` runs every **Monday 06:00 UTC**, and on demand via *Run workflow*.
2. **Fingerprint** — `scripts/reg-watch.mjs` fetches each source in [`data/reg-sources.json`](../data/reg-sources.json), strips markup, normalises the text, and hashes it. The hash is compared with the last-seen value in `data/reg-watch-state.json`. Markup-only churn does not move the hash; a real text change does. Fetch errors (404, timeouts) are recorded but never counted as a content change, so they cannot raise a false PR.
3. **On change** — the workflow opens/updates a PR on branch `regulatory-watch/update` carrying the updated fingerprint state and a change report (which sources moved, with links).
4. **Optional AI draft** — if an `ANTHROPIC_API_KEY` repository secret is set, `scripts/reg-draft.mjs` fetches each changed page and asks Claude (`claude-sonnet-4-6`) to draft a reviewer-facing proposal — what changed and which app entries likely need updating — written to `docs/research/auto/REG-UPDATE-<date>.md` and included in the PR. Without the secret, the PR is detection-only. The AI step **never** edits `super-data.js` directly.

### First-time setup

Run the workflow once with **`mode = seed`** (*Run workflow → mode: seed*) to
record the current fingerprints without raising change noise. Thereafter the
weekly run flags only genuine changes. Optionally add the `ANTHROPIC_API_KEY`
secret to enable AI-drafted proposals.

### Adding or removing a source

Edit [`data/reg-sources.json`](../data/reg-sources.json). Each entry needs a
stable `id`, a `name`, a `url`, a `type`, and a `narrative` (what it is, why it
is watched, and what it feeds in the app). The unit tests
(`test/reg-watch.test.mjs`, run in CI) enforce unique ids, valid URLs, and that
every source carries a narrative.

## The sources and their narrative

Worldwide, UAE-weighted. "Feeds" = what each source keeps current in the app.

### UAE (primary focus)

| Source | What it is | Why watched / app impact |
| --- | --- | --- |
| **UAE Ministry of Economy (MoE)** | Federal supervisor for DNFBPs — dealers in precious metals & stones (DPMS) and real estate | DPMS guidance, goAML registration, the AED 55,000 cash-reporting threshold → DPMS/real-estate Q&A and sector tools |
| **UAE FIU (goAML)** | Receives STRs/SARs and issues filing guidance & feedback | STR/AIF deadlines, formats, narrative requirements → goAML/FIU answers and the STR Drafter tool |
| **UAE NAMLCFTC** | National AML/CFT committee; owns the National Risk Assessment | NRA outputs, national typologies, policy → EWRA, governance, typology answers/tools |
| **UAE EOCN** | Executive Office for Control & Non-Proliferation; UAE targeted financial sanctions | Consolidated-list updates, freeze-timeline guidance → sanctions answers, escalation/CFA logic, risk data |
| **UAE Central Bank (CBUAE)** | Supervises financial institutions & exchange houses | AML circulars, Standards/Guidance, exam expectations → FI answers, exam-readiness & transaction-monitoring tools |
| **Dubai VARA** | Dubai virtual-assets regulator | VASP AML/CFT, travel-rule, licensing rulebooks → virtual-asset answers and the VARA tool |
| **Dubai Gold & Jewellery Group / DMCC** | UAE gold/jewellery sector bodies | Codes of practice, DMCC responsible-sourcing rules → sector-specific gold/jewellery answers and tools |

### Global

| Source | What it is | Why watched / app impact |
| --- | --- | --- |
| **FATF (guidance & news)** | The global AML/CFT standard-setter | Guidance and Recommendation revisions → most Q&A citations and tool references. *(Black/grey lists → FATF Watchdog.)* |
| **Wolfsberg Group** | Bank-industry standards body | Principles & questionnaires (correspondent banking, CDD, CBDDQ) → those answers/tools |
| **RMI** | Responsible Minerals Initiative | RMAP smelter audits, CMRT template → RMI/minerals answers |
| **LBMA** | London Bullion Market Association | Responsible Gold Guidance, Good Delivery refiner rules → LBMA answers and gold-sourcing logic |
| **OECD** | Due Diligence Guidance for minerals from CAHRA (5-step); MNE Guidelines | Guidance revisions, Annex II shifts → OECD answers and the high-risk-country / ASM risk floor |
| **US OFAC** | US Treasury sanctions authority | Designations/de-listings, 50%-rule guidance → sanctions answers and escalation/CFA logic |
| **UN Security Council** | UNSC consolidated sanctions list | Designations under 1267/1988/1718 etc. → sanctions/TF/PF answers and freeze logic |
| **EU** | EU financial-sanctions list & guidance | Ownership-and-control test, blocking statute (Reg 2271/96) → EU sanctions answers |
| **UK OFSI** | UK financial-sanctions implementation | UK consolidated list & guidance → correspondent/trade-finance exposure answers |
| **Egmont Group** | Global network of FIUs | FIU-to-FIU information-exchange rules → Egmont request/cooperation answers and tools |
| **Basel AML Index** | Basel Institute country ML/TF risk scoring | Republished scores → recalibrate country-risk weighting in the EWRA and customer risk ratings |

_Adjust the set any time in `data/reg-sources.json`._
