# Product Presentation: Summary (6 Aug 2026)

Summary of the Hawkeye Sterling product presentation ("HAWKEYE STERLING: AI-Enabled AML and CFT Compliance Intelligence", 66 pages), reviewed against `main` of this repository.

This is a product and business summary. It is not an audit, a certification, a regulatory approval or legal advice. Figures and commercial terms must be reconfirmed before any external use (see the checklist at the end).

## Positioning

Hawkeye Sterling is a self-hosted AML/CFT customer risk-assessment and screening platform for a UAE Dealer in Precious Metals and Stones (DPMS), adaptable to other reporting entities.

- **Users:** MLROs, compliance analysts, reviewers and senior management.
- **Screens:** Entity Risk Assessment (`index.html`), AI Operations Console (`console.html`), Hawkeye Sterling Advisor (`advisor.html`).
- **Role of AI:** risk-rating support, adverse-media triage, relationship signals and drafting. Outputs are labelled and always reviewed.
- **Decisions:** every onboarding, escalation, freeze or filing decision is made by an authorised human. The platform does not onboard, freeze, decline or file on its own.

## Capability chain

Onboarding, risk assessment, sanctions and PEP screening, adverse media, ownership and UBO analysis, monitoring, advisory support, case preparation and STR/SAR draft, documentation and audit trail.

## Entity risk assessment

- **Factors:** seven scored categories (jurisdiction, business activity, onboarding channel, operational history, ownership and control, recycled and mined supply chain).
- **Bands:** score 0-19 CDD (12-month review), 20-22 SDD (6-month review), 23+ EDD (3-month review).
- **Hard outcomes** override the band. Sanctions exposure of the entity or its principals, terrorist financing and proliferation financing lead to PROHIBITED. Mandatory EDD applies to PEP exposure, FATF call-for-action jurisdictions and ASM mined sources in high-risk jurisdictions.
- **Analyst override:** raise-only, with a mandatory printed justification. It never applies to PROHIBITED relationships.
- **Risk data:** a versioned firm baseline (`RISK_DATA_VERSION`). Local overrides are dated, reasoned and visible.
- **Reference format:** `RA-YYYYMMDD-NNN`.
- **Sign-off:** two-line segregation of duties. The analyst assesses; the MLRO reviews and approves.

## Automated screening

- **Daily unified run** on GitHub Actions (`screen.py`, `RUN_MODE=unified`), with the report delivered by 09:00 UAE. No paid data feed and no API key are required. An LLM is optional and opt-in.
- **Sanctions lists:** OFAC SDN and Consolidated, UN, EU FSF, UK OFSI and UAE EOCN as core lists. Canada SEMA, France DGT and Switzerland SECO as supplementary lists.
- **Matching:** fuzzy and transliteration-aware, with 89 shared groups (267 members) for Arabic and Turkish spelling variants. Material-match threshold 85/100. Phonetic-only matches are WEAK, never confirmed. Very short or non-Latin-only names go to MANUAL REVIEW.
- **PEP and RCA:** auto-detected through Wikidata, with the OpenSanctions PEP mirror as fallback. Documented as a best-effort signal, not screening-grade.
- **Adverse media:** Google News RSS, GDELT, Bing News RSS and the OpenSanctions crime watchlist. Every item links to its source.
- **Ownership:** a designated owner or UBO flags the company at 50% or more control linkage, even when the company name is clear.
- **Delta engine:** each report leads with what is new. Standing items are marked, never dropped. Repeat signals (3 or more stories in 90 days) are tracked.
- **Cadence:** 60 scheduled or CI workflows (see `data/board-figures.json`). Daily sanctions screen, 6-hourly onboarding screen, weekly adverse-media sweep, monthly FATF watchdog.
- **Cases:** a new match becomes an assigned, SLA-tracked case. Dispositions are set by the MLRO under four-eyes review.

## Failure handling

- **Refuse-to-clear:** if a required list cannot load, the run stops rather than reporting an all-clear.
- **Degrade loudly:** a source that fails or parses zero names is shown in the report.
- **Freshness alarm:** `freshness-check` flags a mandatory daily control that did not run.
- **Red run:** a run that cannot screen fails red and opens a GitHub issue automatically.

## Measured accuracy (as stated in the deck)

| Measure | Figure | Source |
|---|---|---|
| Sanctions recall (CI-enforced floor 95%) | 97.5% (118/121); 100% on the listed cases | `docs/governance/screening-accuracy-benchmark.md`, dated 28 Jul 2026 |
| Hard-negative clear | Python; 96.5% JS | Same benchmark |
| Frozen pre-hardening baseline | 57.0% recall | Same benchmark |

These are repository-reported and CI-enforced. Reconfirm after any material code change.

## AI governance

- **Model inventory:** six model cards. Four are deterministic (entity risk scoring, sanctions name matcher, adverse-media classifier, PEP identifier). Two are LLM-backed (AI triage and the Advisor).
- **Labels:** AI output is marked `[AI]`, deterministic output `[Auto]`. Both appear beside the raw evidence.
- **No hallucinations (hard rule):** filed reports contain only real, sourced data. Generative prose is off by default. LLM triage classifies supplied headlines only.
- **Prompt injection:** fetched web text is stripped, wrapped and screened. Detected injections are never sent to the model. A CI red-team suite runs on every build.
- **Advisor:** cited-answer Q&A. It never asserts a named entity's sanctions or adverse-media status as fact. Output is withheld where it could tip off a subject.
- **Standards:** ISO/IEC 42001 (self-assessed, first management review pending), NIST AI RMF (mapped), EU AI Act (outside territorial scope), UAE PDPL (DPIA on file). These are self-assessments, not certifications.

## Data architecture and security

- **Browser:** deterministic scoring. Encrypted local storage (AES-256-GCM, PBKDF2, idle auto-lock). Hash-chained activity log (SHA-256).
- **Edge and serverless:** Netlify CDN with security headers. `brain-soul.js` holds `ANTHROPIC_API_KEY`.
- **Automation:** GitHub Actions holds the API key and Asana token.
- **Egress:** with no Anthropic key configured, no assessment or customer data leaves the device or the runner. Provisioning the key is a separate, authorised decision assessed under PDPL.
- **Controls:** pure-self CSP, CodeQL, Semgrep, Gitleaks, CycloneDX SBOM, Sigstore build provenance, branch protection and least-privilege tokens.

## Top residual risks (management attention)

| ID | Risk | Residual |
|---|---|---|
| R-13 | Transaction-monitoring blind spot (FATF R.16 engine built, inactive pending a data feed) | Medium (12) |
| R-17 | Key-person dependency (single operator; BCP drill and second trained operator) | Medium (12) |
| R-03 | Residual false-negative risk (inherent to screening) | Medium (10) |
| R-16 | Regulatory drift | Medium (8) |
| R-20 | AI incident-response documented but not yet drilled | Medium (8) |

## Current status

- **Active:** entity risk assessment, screening, monitoring, Advisor (when the key is set), case support and compliance docs.
- **Pending activation:** transaction monitoring. It needs a firm-provided data feed.
- **Optional and gated:** LLM-backed features. They ship off by default and need the firm's own service arrangements, including a signed Anthropic DPA.

## Commercial terms (as stated in the presentation)

AED 1,500 per month for integrated access to the confirmed modules. Other commercial terms are subject to agreement.

## Pre-publication verification checklist

Confirm each item before external use:

- [ ] AED 1,500/month price and implied commercial scope: confirm current terms.
- [ ] 97.5% sanctions-recall and related figures: confirm no material code change since 6 Aug 2026.
- [ ] Anthropic DPA status (shown as pending at review): confirm current status.
- [ ] Transaction-monitoring "inactive" status: confirm whether a feed has since been connected.
- [ ] `board-figures.json` counts (60 workflows, 183 docs): reconfirm as current.
- [ ] "Independent readiness score: 3.9/5" is the firm's own self-assessment, not a third-party audit result.
- [ ] ISO/IEC 42001, NIST AI RMF and EU AI Act positioning are self-assessments, not certifications.
- [ ] KPI dashboard monthly log is unpopulated ("tbc") at the reviewed date.

Any figure not explicitly sourced should be treated as not independently verified.
