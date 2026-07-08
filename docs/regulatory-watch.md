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

<!-- BEGIN:reg-sources -->
<!-- Auto-generated from data/reg-sources.json by scripts/reg-sources-doc.mjs. Do not edit by hand; run `node scripts/reg-sources-doc.mjs`. -->

Worldwide, UAE-weighted. The narrative is what each source is, why it is watched, and what it feeds in the app. _Edit the set in `data/reg-sources.json`; this table regenerates from it._

### UAE (primary focus)

| Source | Narrative |
| --- | --- |
| **UAE Ministry of Economy (MoE) — DNFBP / DPMS supervisor** | Federal supervisor for Designated Non-Financial Businesses and Professions, including Dealers in Precious Metals and Stones (DPMS) and real estate. Issues DPMS guidance, goAML registration rules and the cash-transaction reporting threshold (AED 55,000). Watched so DPMS/real-estate Q&A answers and sector tools stay current. |
| **UAE Financial Intelligence Unit (FIU) — goAML** | Receives Suspicious Transaction/Activity Reports via the goAML platform and issues filing guidance, formats and feedback. Watched so STR/AIF deadlines, narrative requirements and the goAML / FIU-reporting answers and the STR Drafter tool stay current. |
| **UAE National Committee for AML/CFT (NAMLCFTC)** | National coordination body owning the National Risk Assessment and AML/CFT strategy. Watched for new NRA outputs, national typologies and policy shifts that feed the EWRA, governance and typology answers/tools. |
| **UAE Executive Office for Control & Non-Proliferation (EOCN)** | Administers UAE targeted financial sanctions, the local consolidated list and freezing obligations. Watched for list updates and freeze-timeline guidance feeding the sanctions answers, the escalation/CFA logic and the risk data. |
| **UAE Central Bank (CBUAE) — AML/CFT** | Supervises licensed financial institutions and exchange houses for AML/CFT and issues circulars, the AML Standards/Guidance and examination expectations. Watched via the CBUAE Rulebook (the canonical home of regulations and standards; the marketing site centralbank.ae bot-blocks non-browser clients) so FI-facing answers, examination-readiness and transaction-monitoring tools stay current. |
| **Dubai Virtual Assets Regulatory Authority (VARA)** | Regulates virtual-asset activity in Dubai (ex-DIFC), including AML/CFT, travel-rule and licensing rulebooks. Watched so VASP / virtual-asset answers and the VARA compliance tool stay current. |
| **Dubai Gold & Jewellery Group / DMCC (sector)** | UAE gold and jewellery sector bodies issuing codes of practice and responsible-sourcing expectations (DMCC Rules for Risk-Based Due Diligence). Watched so sector-specific gold/jewellery answers and tools reflect current sector guidance. |

### Global

| Source | Narrative |
| --- | --- |
| **FATF — guidance, recommendations & news** | The global AML/CFT standard-setter. This entry watches FATF publications, guidance and Recommendation revisions (NOT the black/grey lists, which the FATF Watchdog handles). Feeds most Q&A citations and tool reference lists. |
| **Wolfsberg Group** | Bank-industry body issuing principles and questionnaires (correspondent banking, CDD, CBDDQ). Watched so correspondent-banking and CDD answers/tools reflect the latest Wolfsberg standards. |
| **Responsible Minerals Initiative (RMI)** | Runs the Responsible Minerals Assurance Process (RMAP) smelter audits and the Conflict Minerals Reporting Template (CMRT). Watched so the RMI / minerals answers reflect current audit protocols and templates. |
| **LBMA — Responsible Sourcing** | Sets the Responsible Gold Guidance (RGG) and Good Delivery refiner standards. Watched so LBMA answers and gold-sourcing logic reflect current RGG steps and refiner rules. |
| **OECD — Responsible Mineral Supply Chains (CAHRA)** | Owns the Due Diligence Guidance for Responsible Supply Chains of Minerals from Conflict-Affected and High-Risk Areas (the 5-step framework) and MNE Guidelines. Watched via the Responsible Business Conduct topic hub on oecd.org (the legacy mneguidelines.oecd.org host bot-blocks non-browser clients) so OECD answers and the high-risk-country / ASM risk floor reflect current guidance and Annex II shifts. |
| **US OFAC — Recent Actions** | US Treasury sanctions authority. Watched for designations/de-listings and 50%-rule guidance feeding the sanctions answers and the escalation/CFA logic (secondary-sanctions exposure for UAE gold trade). |
| **UN Security Council — Consolidated List** | The UN Security Council consolidated sanctions list, implemented in the UAE without delay. Watched for designations under 1267/1988/1718 etc. feeding the sanctions/TF/PF answers and freeze logic. |
| **EU — Financial Sanctions** | EU consolidated financial-sanctions list and ownership-and-control guidance. Watched so the EU 'ownership and control' answers and blocking-statute (Reg 2271/96) content stay current. |
| **UK OFSI — Consolidated List of Targets** | UK Office of Financial Sanctions Implementation consolidated list and guidance. Watched for UK designations relevant to correspondent and trade-finance exposure. |
| **Egmont Group of FIUs** | Global network of Financial Intelligence Units governing FIU-to-FIU information exchange. Watched so the Egmont information-request and cross-border cooperation answers/tools stay current. |
| **Basel AML Index** | Basel Institute composite country ML/TF risk scoring. Watched so the country-risk weighting in the EWRA and customer risk-rating logic can be recalibrated when scores are republished. |
| **UNODC — Money Laundering & Organised Crime** | UN Office on Drugs and Crime publishes money-laundering, organised-crime and predicate-offence typologies, the Vienna/Palermo convention guidance and the GPML programme outputs. Watched so the typology, predicate-offence and international-cooperation answers reflect current UN crime research and methodologies. |
| **EU — High-Risk Third Countries (AML/CFT)** | The European Commission list of third countries with strategic AML/CFT deficiencies (Delegated Regulation), which triggers mandatory EDD on relationships involving listed jurisdictions. Watched so the high-risk-jurisdiction EDD answers and country-risk weighting in the EWRA stay aligned with EU additions/removals. |
| **Responsible Jewellery Council (RJC)** | Sets the RJC Code of Practices and Chain-of-Custody standard for the jewellery and watch supply chain (responsible sourcing, KYC, conflict-sensitive due diligence). Watched so the gold/jewellery sector answers and responsible-sourcing tools reflect current RJC certification requirements. |

<!-- END:reg-sources -->

