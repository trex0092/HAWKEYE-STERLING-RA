# Hawkeye Sterling: Sponsor Presentation

AI-enabled AML and CFT compliance intelligence for Dealers in Precious Metals and Stones (DPMS).

Product presentation, 6 August 2026. Reviewed against the `main` branch of this repository.

---

## 1. Overview

Hawkeye Sterling brings customer risk assessment, sanctions and PEP screening, adverse-media monitoring, case handling and compliance documentation into one workspace.

- **Built for:** a UAE DPMS, and adaptable to other reporting entities with similar obligations.
- **Used by:** MLROs, compliance analysts, reviewers and senior management.
- **Deployment:** self-hosted, with a lightweight architecture. No backend framework is required in the browser.
- **Price:** AED 1,500 per month for integrated access to the confirmed modules. Other commercial terms are subject to agreement.

## 2. The problem

Manual, fragmented compliance work accumulates risk quietly.

- Screening runs ad hoc rather than on a fixed daily cadence.
- Evidence is spread across spreadsheets and email.
- Review dates are tracked by hand and slip.
- Analyst judgement varies between people and over time.
- Documentation is rebuilt at examination time rather than maintained as work happens.

## 3. The solution

One connected chain from onboarding to filing:

1. Onboarding and identification
2. Risk assessment
3. Sanctions and PEP screening
4. Adverse-media monitoring
5. Ownership and UBO analysis
6. Ongoing monitoring
7. Advisory support
8. Case preparation and STR/SAR drafting
9. Documentation and audit trail

Humans decide at every step that matters. The platform assesses, screens, monitors, prioritises, summarises and drafts. Authorised reviewers alone make onboarding, escalation, freezing and filing decisions.

## 4. Why Hawkeye Sterling

| Area | Typical approach | Hawkeye Sterling |
|---|---|---|
| Risk assessment | Spreadsheet or standalone module | Built-in 0-30 scoring engine with CDD, SDD or EDD verdict |
| Sanctions screening | Often the only function of a point solution | One module of nine, screening core lists daily |
| PEP identification | Paid third-party lookup | Auto-detected via Wikidata, with relatives and close associates |
| Adverse media | Single news feed | Four independent, overlapping feeds, delta-led |
| Ownership analysis | Manual, file by file | Portfolio-level related-party and 50%-control detection |
| Ongoing monitoring | Periodic re-checks | 60 scheduled or CI workflows on fixed cadences |
| Case support | Tracked outside the tool | Cases opened, SLA-tracked and dispositioned in the workspace |
| Audit evidence | Rebuilt at examination time | Captured continuously and carried in the printed report |

## 5. Who it is for

- **MLRO:** owns the methodology, approves every assessment, and decides on escalation, freezing and filing.
- **Compliance analyst:** prepares assessments, reviews screening alerts and drafts narratives for MLRO sign-off.
- **Senior management and the Board:** receive governance and KPI reporting to oversee the compliance programme.
- **Regulators and auditors:** can be shown the control-to-evidence mapping and per-feature documentation on request.

## 6. Entity risk assessment

- **Identification first:** legal identity, location and contact, principals (beneficial owners, controllers, directors). Captured before any score.
- **Seven scored factors:** jurisdiction, business activity, onboarding channel, operational history, ownership and control, and two supply-chain factors (recycled and mined sources).
- **Risk bands:**
  - 0-19: CDD, reviewed every 12 months
  - 20-22: SDD, reviewed every 6 months
  - 23 and above: EDD, reviewed every 3 months
- **Hard outcomes override the band:** sanctions exposure, terrorist financing or proliferation financing leads to PROHIBITED. PEP exposure, FATF call-for-action jurisdictions and artisanal mining in high-risk jurisdictions force EDD.
- **Analyst override:** can only raise the outcome, and always needs a printed justification.
- **Sign-off:** the analyst assesses and the MLRO approves, with a formal attestation.
- **Reports:** a print-ready letterhead report with evidence trail, filed to a controlled workspace by risk band.

## 7. Automated screening

- **Daily run:** one unified screen covers every company and every recorded owner, director or UBO. The report is ready for the MLRO by 09:00 UAE.
- **No paid feed required:** the screening runs on GitHub Actions with no API key for core operation. An AI layer is optional and opt-in.
- **Sanctions lists:** OFAC (SDN and Consolidated), UN, EU, UK OFSI and UAE EOCN as core lists, with Canada SEMA, France DGT and Switzerland SECO as supplementary lists.
- **Matching:** fuzzy and transliteration-aware, with groups covering Arabic and Turkish spelling variants. Phonetic-only matches are marked weak, never confirmed. Very short or non-Latin names go to manual review.
- **Adverse media:** Google News, GDELT, Bing News and the OpenSanctions crime watchlist. Every item links to its real source.
- **Delta engine:** each report leads with what is new. Standing items are marked and never dropped.
- **Safe failure:** if a list cannot be loaded, the run stops rather than reporting an all-clear. A failed source is shown in the report.

## 8. Measured screening recall

- **Sanctions recall:** 97.5% (118 of 121 labelled cases), against a 95% floor enforced in continuous integration.
- **Hard negatives cleared:** 100% in Python and 96.5% in JavaScript.
- **Improvement:** up from 57.0% recall on the frozen pre-hardening baseline (28 July 2026).

These figures come from the repository's screening benchmark and are re-tested on every build.

## 9. AI in the platform

Every AI output is decision support. It is never the decision.

- **Where AI helps:** risk-rating suggestions, adverse-media triage, plain-language alert summaries, STR/SAR narrative drafts and related-party signals.
- **Always labelled:** AI output is tagged [AI] and deterministic output is tagged [Auto]. Both appear beside the raw evidence.
- **Grounded:** AI classifies only real, supplied headlines and list entries. It does not generate facts.
- **Fallback:** if a model fails, the platform falls back to deterministic logic and says so.
- **Advisor:** a cited-answer AML Q&A with verdict, legal basis and recommended steps. It is always advisory.
- **Opt-in:** AI features are off by default and need the firm's own service arrangements.

## 10. Architecture and data

- **Browser:** the risk engine runs on the device. Data is encrypted in local storage and never leaves the device unless the firm enables an AI feature.
- **Activity log:** a tamper-evident log records completions, overrides, exports and unlocks.
- **Edge and serverless:** a CDN with strict security headers, and a relay for the optional Advisor.
- **Automation:** scheduled screening runs on GitHub Actions.
- **Security:** static analysis on every push, software bill of materials, and build provenance on every release.

## 11. Business value

- **Consistent assessments:** the same methodology applied to every entity, every time.
- **Faster access to information:** screening evidence and case history in one place.
- **Better alert focus:** delta detection and AI triage highlight what is new.
- **Stronger documentation:** evidence is assembled as work happens.
- **Clearer rationale:** narrative templates and evidence citations support analyst reasoning.
- **Management visibility:** KPI and governance reporting for senior management and the Board.

No financial saving or return-on-investment figure is asserted.

## 12. Implementation journey

1. **Configure:** subscription activation, user and role setup, policy and methodology alignment.
2. **Connect:** risk-data configuration, screening-source configuration, and AI-service configuration (optional).
3. **Launch:** user training and a controlled operational launch.
4. **Govern:** performance monitoring and ongoing governance.

No implementation durations are asserted.

## 13. Current status

- **Live today:** entity risk assessment, automated screening, monitoring, case support and compliance documentation.
- **Pending activation:** transaction monitoring, which is built and tested against FATF Recommendation 16 and needs a firm-provided data feed.
- **Optional:** LLM-backed features, which ship gated off and need a signed data-processing agreement with the AI provider.

## 14. Subscription

**AED 1,500 per month**

- Risk assessment
- Sanctions screening
- PEP screening
- Adverse media
- AI compliance advisor
- Monitoring
- Case support
- Compliance documentation

Terms beyond the monthly price are subject to agreement.

## 15. Next step

- **See it in your workflow:** a product demonstration covering an entity assessment, a screening alert, a monitoring event and a governed AI-assisted review.
- **Discuss deployment and configuration** for your firm.

---

*Figures and commercial terms are stated as at 6 August 2026. Confirm current figures and terms before external use.*
