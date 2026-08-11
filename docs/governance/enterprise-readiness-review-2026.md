# Enterprise Readiness Review — Hawkeye Sterling RA
### Independent consulting assessment: AI Governance · Compliance · Architecture · Executive Readiness

| | |
|---|---|
| **Scope** | Full repository (`trex0092/HAWKEYE-STERLING-RA`) — application, 37 workflows, 40+ governance documents, test estate |
| **Date** | 2 July 2026 |
| **Frameworks applied** | ISO/IEC 42001 · NIST AI RMF 1.0 · EU AI Act · OECD AI Principles · COSO IC · ISO 31000 · FATF RBA · Wolfsberg Group guidance · GDPR / UAE PDPL |
| **Method** | Every claim below is marked **[OBSERVED]** (verified in the repository) or **[PROPOSED]** (enhancement) |

---

## 1 · Executive Summary

Hawkeye Sterling RA is an unusually complete AML/CFT risk-assessment platform for its size: a
zero-backend static application with client-side encryption, paired with a 37-workflow automated
assurance estate and a two-directory governance corpus (`docs/aims/`, `docs/governance/`) that
already maps to ISO/IEC 42001, NIST AI RMF and the UAE AI Charter. Its distinguishing strength is
**verifiable governance** — nearly every documented control has an automated proof (test or
workflow) catalogued in the Assurance Coverage Matrix, which is a posture many enterprise
platforms claim and few demonstrate.

The gap is not substance but **packaging and audience-layering**. The repository speaks fluently
to engineers and to compliance specialists reading deep documents; it does not yet speak to a
board member with five minutes, an auditor building a walkthrough file, or a regulator asking
"show me the model documentation for each AI feature." The highest-value work is therefore:
an executive layer, per-feature model cards, an architecture diagram set with trust boundaries,
a KPI dashboard, and a demonstration pack — none of which require changing the application.

**Overall maturity: 3.9 / 5 — "Managed, approaching Optimised."** With the Critical and High
items below (estimated 6–9 working days total), a defensible **4.5 / 5**.

---

## 2 · Repository Maturity Assessment (scored 1–5)

| Dimension | Score | Basis |
|---|---:|---|
| AI governance framework | **4.5** | [OBSERVED] SoA, AI policy, AUP, risk register, asset register, incident runbook, red-team procedure, bias testing, management-review skeleton |
| Compliance documentation | **4.5** | [OBSERVED] DPIA, SIA, PDPL assessment, retention, explainability statement, UAE AI Charter + NIST mappings, ISO 42001 SoA |
| Controls & assurance | **4.5** | [OBSERVED] Assurance Coverage Matrix maps control → automated proof → cadence → evidence; 500+ offline checks in CI |
| Security engineering | **4.5** | [OBSERVED] Pure-self CSP, AES-256-GCM at rest, TOTP, RBAC, hash-chained audit log, 10/10 egress-blocked AML workflows, SHA-pinned actions, 7 scanning workflows, SECURITY.md |
| Risk management | **4.0** | [OBSERVED] AI risk register (R-01…R-13) with owner + mitigation; [PROPOSED] add likelihood/impact/inherent-vs-residual scoring format |
| Repository organisation | **4.0** | [OBSERVED] Community files complete (LICENSE, SECURITY, CONTRIBUTING, CITATION, SUPPORT, CoC); coherent docs tree; [PROPOSED] audience-first re-grouping |
| Architecture documentation | **3.5** | [OBSERVED] `docs/architecture.md` exists; [PROPOSED] diagram set incl. trust boundaries & data flow |
| UX | **4.0** | [OBSERVED] a11y CI gate, EN/AR i18n with legal review, reduced-motion, keyboardable; [PROPOSED] first-run tour, empty states |
| Model documentation | **3.0** | [OBSERVED] model-validation + explainability cover the scoring engine; [PROPOSED] per-feature model cards |
| Metrics & KPIs | **3.0** | [OBSERVED] KPI catalog in matrix + run-metrics history + daily reports; [PROPOSED] rendered dashboard |
| Executive readiness | **2.5** | [PROPOSED] no executive brief, ROI narrative, or board pack |
| Presentation/demo readiness | **2.5** | [PROPOSED] no demo script, screenshots, or walkthrough assets |
| **Overall** | **3.9** | |

---

## 3 · Strengths (all [OBSERVED])

1. **Assurance you can execute.** The Assurance Coverage Matrix + CI turn governance claims into
   running proofs — the single most persuasive artefact for an auditor.
2. **Fail-safe engineering culture.** "Silence is never evidence" is implemented, not aspirational:
   refuse-to-run on empty customer/list reads, STALE flags on stopped controls, degradation
   escalations, loud egress-block failures.
3. **Defence-in-depth on a zero-backend design.** Client-side encryption + tokenised delivery mode
   + serverless token proxy + strict CSP is a coherent, explainable privacy architecture (PDPL/GDPR
   data-minimisation by construction).
4. **Human-in-the-loop is structural.** Every AI/automation output routes to MLRO decision
   checkboxes; completion requires second-line role; one-way overrides never weaken PROHIBITED.
5. **Supply-chain posture.** SHA-pinned actions, Scorecard, OSV, gitleaks, harden-runner egress
   blocks with derived allowlists, Dependabot grouping.
6. **Localisation with legal care.** EN/AR including an Arabic legal review note and
   Arabic-language adverse-media screening — rare and directly relevant to the UAE market.
7. **Honest gap registers.** Known-gaps sections (R-13 transaction feed, deferred Netlify Identity)
   are stated rather than hidden — exactly what regulators reward.

## 4 · Weaknesses

1. **No executive layer** — value, risk-reduction and ROI story must be inferred. [PROPOSED §6-A]
2. **AI features lack individual model cards** — the scoring engine is validated, but the advisor
   LLM, sanctions matcher, adverse-media classifier, PEP signal and AI triage have no per-feature
   card a regulator can pull. [PROPOSED §6-B]
3. **Architecture is prose-first** — no system-context / data-flow / trust-boundary diagrams.
4. **KPIs exist as data, not as a dashboard** — `data/run-metrics.json` and daily reports carry the
   numbers; nothing renders them for management review.
5. **Demo/presentation assets absent** — no scripted scenario, sample dataset walkthrough, or
   screenshots for stakeholders who will never open the app.
6. **COSO / ISO 31000 linkage implicit** — controls exist; the crosswalk naming COSO components and
   ISO 31000 process steps does not.
7. **Single-maintainer key-person risk** — governance assigns roles, but continuity depends on one
   operator (partially mitigated by `bcp.md`). Flag honestly in the risk register.

## 5 · Gap Analysis — requested artefacts vs repository

Legend: ✅ exists · ◐ partial (extend, don't create) · ✗ missing (create)

| Artefact (§3–§4 of the brief) | Status | Location today / [PROPOSED] target |
|---|---|---|
| AI Governance Framework | ✅ | `docs/AI-GOVERNANCE.md` + `docs/governance/agentic-ai-governance-6layers-2026.md` |
| AI Governance Charter | ◐ | Fold a 1-page charter (mandate, scope, authorities) into `docs/governance/ai-policy.md` §0 or new `ai-governance-charter.md` |
| AI Risk Register | ✅ | `docs/aims/ai-risk-register.md` — [PROPOSED] add L×I scoring columns (§9 below) |
| AI Inventory / Asset Register | ✅ | `docs/aims/ai-system-inventory.md`, `docs/governance/ai-asset-register.md` |
| AI Approval Workflow | ◐ | Model-validation §4 change procedure — [PROPOSED] generalise to any new AI feature |
| AI Model Lifecycle | ◐ | `docs/governance/pbg-lifecycle-map-2026.md` — [PROPOSED] add retirement criteria per model card |
| Human Oversight Framework | ✅ | Distributed (policy §human-in-loop, SIA, explainability) — [PROPOSED] 1-page consolidation |
| AI Incident Management | ✅ | `docs/governance/ai-incident-runbook.md` + postmortem template |
| AI Monitoring Strategy | ✅ | `docs/aims/runtime-monitoring.md` + daily AI Governance Report |
| AI Change Management | ✅ | `docs/governance/model-validation-2026.md` §4–5 (frozen values, sign-off log) |
| AI Vendor / Third-Party Risk | ✅ | `docs/aims/third-party-register.md` (Anthropic DPA state, Asana, GitHub, Netlify) |
| AI Review Committee ToR | ◐ | Drafted as `docs/governance/ai-governance-committee-charter.md` (MLRO + senior manager + external advisor, quorum 2); **adoption block awaits the item-4 board sitting** — flipped from ✗ 2026-08-04 |
| Responsible/Ethical AI | ✅ | AI policy principles + `ai-acceptable-use-policy.md` |
| Explainability / Transparency | ✅ | `docs/governance/explainability-statement-2026.md`; [AI] output labelling in-app |
| Fairness | ✅ | `docs/aims/bias-fairness-testing.md` + CI recall-gap bound + quarterly live bias eval (DPA-gated) |
| Accountability | ✅ | Role tables in AI policy §5; git-signed history |
| Data Governance / Privacy | ✅ | `data-quality-plan.md`, `pdpl-data-processing-assessment.md`, `dpia-2026.md`, `data-retention.md` |
| Security / Auditability | ✅ | `SECURITY.md`, `docs/security/`, hash-chained log, evidence trails |
| Model cards (per AI feature) | ✅ | `docs/models/` — six cards + README (§6-B delivered; flipped from ✗ 2026-08-04) |
| Architecture diagram set | ✅ | `docs/architecture/diagrams.md` — context, trust boundaries, swimlanes, decision flow (§11 delivered; flipped from ✗ 2026-08-04) |
| KPI dashboard | ✅ | `docs/executive/kpi-dashboard.md` (§12 delivered; flipped from ✗ 2026-08-04) |
| Demo pack | ✅ | `docs/demo/` — script, sample data, scenarios (§14 delivered; flipped from ✗ 2026-08-04) |
| Executive brief / ROI | ✅ | `docs/executive/executive-brief.md` + `docs/executive/business-value.md` (§6-A delivered; flipped from ✗ 2026-08-04) |
| COSO / ISO 31000 crosswalk | ✗ | [PROPOSED] extend `ai-frameworks-crosswalk-2026.md` with two columns |

---

## 6 · Detailed Recommendations

### 6-A · Executive layer [PROPOSED — Critical]
Create `docs/executive/` with four short documents (1–2 pages each, no new facts — repackage
what exists):
1. **`executive-brief.md`** — what the platform is, in board language: *"a self-hosted AML
   risk-assessment and screening estate whose every control is machine-verified daily."* One
   diagram, five bullets of capability, current maturity score, open decisions (the DPA, the
   transaction feed).
2. **`business-value.md`** — value pillars with defensible numbers: analyst-hours saved per
   assessment (measure once in the demo run); screening coverage (customers × lists × daily) vs a
   manual equivalent; incident-avoidance framing (cost of a single missed sanctions match vs
   platform cost ≈ hosting-only); audit-preparation time (evidence pre-assembled by matrix + logs).
3. **`regulatory-readiness.md`** — one table: regulator question → artefact → location (draws on
   §5 above and the coverage matrix). This is the pre-exam pack.
4. **`roadmap.md`** — the §15 roadmap below, kept current.

### 6-B · Model cards [PROPOSED — Critical]
Create `docs/models/`, one card per AI/analytic feature, using a fixed template
(Purpose · Business owner · Technical owner · Inputs · Outputs · Training/knowledge source ·
Prompt strategy · Limitations · Known risks · Bias assessment · Human oversight · Monitoring ·
Performance metrics · Retirement criteria):

| Card | Feature (all [OBSERVED] in code) |
|---|---|
| `risk-scoring-engine.md` | Deterministic 0–30 scoring (`app.js`) — validated in `model-validation-2026.md`; card mostly cross-references |
| `sanctions-name-matcher.md` | Fuzzy/transliteration matcher (`sanctions-match.mjs` / `screen.py screen_name`) — cite recall-gap bound |
| `adverse-media-classifier.md` | Keyword/typology classifier + GDELT/Google News feeds (EN+AR) |
| `pep-identifier.md` | Wikidata PEP signal — note best-effort nature, MANUAL REVIEW fallback |
| `advisor-llm.md` | Cited-answer Advisor (`brain-soul.js`, charter guardrails, weekly eval) — the card regulators will actually read; include prompt strategy + injection red-team reference |
| `ai-triage.md` | LLM adverse-media triage (gated `LLM_TRIAGE=0` until DPA) — card states the gate explicitly |

### 6-C · Risk register upgrade [PROPOSED — High]
Reformat `ai-risk-register.md` rows to: Risk · Likelihood (1–5) · Impact (1–5) · **Inherent** ·
Controls (linked) · **Residual** · Owner · Review cadence · Mitigation. Ensure rows exist for:
hallucination, bias, prompt injection, data leakage, model drift, privacy, cybersecurity,
incorrect recommendation, regulatory non-compliance, vendor failure, **key-person dependency**.
(Most exist as R-01…R-13; this is a formatting + 2-row addition, not a rewrite.)

### 6-D · Controls framework naming [PROPOSED — Medium]
The controls all exist; add a **Preventive / Detective / Corrective** column to the Assurance
Coverage Matrix and a COSO-component + ISO 31000-step mapping appendix to
`ai-frameworks-crosswalk-2026.md`. Zero new controls needed — this is vocabulary alignment for
audit committees.

---

## 7 · Suggested Repository Structure [PROPOSED]

Keep code layout untouched (no-build static app is a feature). Re-group documentation by audience:

```
docs/
├── executive/          ← NEW: brief, business value, regulatory readiness, roadmap, KPI dashboard
├── governance/         ← as today (add charter, committee ToR, this review)
├── aims/               ← as today (ISO 42001 management-system records)
├── models/             ← NEW: model cards (6)
├── architecture/       ← NEW: architecture.md moves here + diagrams (mermaid sources)
├── security/           ← as today
├── operations/         ← app-setup-runbook, regulatory-watch ops, reconciliation runbook
├── user-guides/        ← NEW: analyst guide, reviewer (MLRO) guide, administrator guide
├── api/                ← NEW: Netlify function contracts (asana-task, asana-mirror, risk-backup, brain-soul)
└── demo/               ← NEW: script, scenarios, sample data, screenshots
```

Release documentation and version history are already handled ([OBSERVED] `CHANGELOG.md`
Keep-a-Changelog + Auto Release workflow) — link them from `docs/executive/`.

## 8 · AI Governance Framework — verdict
Framework substance is **in place** (see §5 table). Actions: write the 1-page **Charter** and the
**Review Committee ToR** (sized for the firm — do not fabricate a committee that cannot meet);
hold and minute the **first management review** (already scheduled Q3 2026); generalise the change
procedure into an **AI approval workflow** covering *new* AI features, not only scoring changes.

## 9 · AI Compliance Framework — verdict
Complete on substance (Responsible AI, explainability, fairness, privacy, auditability — all
[OBSERVED]). Actions are §6-C formatting, §6-D vocabulary, plus one **EU AI Act positioning
statement** (half page in `regulatory-readiness.md`): no EU establishment or Union-market
offering ⇒ outside territorial scope today; if that changes, the platform's human-oversight,
logging, transparency and validation posture aligns with Annex III high-risk obligations — name
the delta (CE-style conformity assessment, EU registration).

## 10 · Documentation Roadmap

| Phase | Deliverables | Effort |
|---|---|---|
| Now (week 1) | Executive layer (4 docs) · model cards (6) · risk-register reformat | 3–4 days |
| Next (weeks 2–3) | Architecture diagrams · KPI dashboard · user/admin guides · API docs · COSO/31000 crosswalk · charter + ToR | 3–4 days |
| Then (month 2) | Demo pack + screenshots · walkthrough video · first management-review minutes | 2 days + meeting |

## 11 · Architecture Recommendations [PROPOSED — High]
Add `docs/architecture/` with **Mermaid** sources (render on GitHub, no tooling):
System Context (browser ⇄ Netlify functions ⇄ Asana/Anthropic; GitHub Actions ⇄ lists/feeds) ·
Data-Flow Diagram with **PII annotations** (what never leaves the device; tokenised mode path) ·
**Trust-Boundary Diagram** (device / Netlify / GitHub runner / third parties — pairs with the
egress allowlists) · Compliance & risk-assessment workflow (swimlane: analyst → reviewer → Asana
evidence) · Audit-trail flow (hash-chain → mirror → reconciliation). The existing
`docs/architecture.md` prose becomes the narrative around the diagrams.

## 12 · Metrics & KPI Recommendations [PROPOSED — High]
Source data already exists ([OBSERVED]: `data/run-metrics.json`, screening deltas, register, daily
reports). Build one generated page (extend `scripts/screening-metrics.mjs` or a small sibling) that
renders: assessments count & risk-band distribution · EDD rate · screening volume & coverage ·
match/false-positive dispositions · processing time trend · AI usage + human-override rate (log
`[AI]`-assist acceptance in the activity log — small app change) · control effectiveness
(green-rate from the daily Governance Report) · open audit findings. Publish as
`docs/executive/kpi-dashboard.md` + auto-committed HTML; review monthly (feeds management review).

## 13 · Security Recommendations
[OBSERVED] strong baseline (see §3). Remaining, in priority order:
1. **Netlify Identity/JWT on write endpoints** — the one accepted architectural gap; decide, date it, record compensating controls (already documented) in the risk register.
2. **Distributed rate limiting** (Upstash/Edge) — current per-instance limiter is best-effort by design.
3. **Passkeys/WebAuthn** upgrade over TOTP (phishing resistance) — later cycle.
4. **Key-person continuity drill** — test `bcp.md` once: can a second person rotate secrets and operate? Minute it.
5. Annual **manual pentest** — already scheduled; book the engagement (open item).
6. DR statement: document Netlify/GitHub/Asana as the recovery triangle with RTO/RPO in `backup-recovery.md` (mostly exists — add explicit RTO/RPO numbers).

## 14 · UX & Presentation Recommendations
UX [OBSERVED]: a11y CI, EN/AR, reduced-motion, keyboard nav, print reports. [PROPOSED]: first-run
guided tour (3 tooltips: risk data → assess → deliver); empty-state copy for register/log; unify
toast patterns for failed delivery vs retry-all; mobile pass on the console page tables.
Presentation pack (`docs/demo/`): a 10-minute **demo script** (TEST-000 happy path → sanctions-hit
path → tokenised mode → evidence in Asana → daily reports), 2 scripted scenarios with **sample
dataset** (clearly fake names), 8–10 annotated screenshots, and a 1-slide architecture image
exported from §11.

## 15 · Roadmap

| Horizon | Items | Effort | Impact |
|---|---|---|---|
| **Short (≤1 month)** | Executive layer · model cards · diagrams · KPI dashboard · risk-register format · demo pack · sign DPA → enable triage + bias cycle · custom fields + TEST-000 go-live | ~7–9 days work + signatures | Presentation-ready; regulator pack complete |
| **Medium (1–3 months)** | Transaction feed (closes R-13, activates R.16 engine) · first management review + committee ToR in operation · pentest #1 · KPI trend automation · user/admin guides | feed dependent; 3–4 days docs/eng | Full FATF R.16 coverage; ISO 42001 cycle complete |
| **Long (3–12 months)** | Netlify Identity on writes · distributed rate limiting · passkeys · commercial adverse-media/PEP feed evaluation (LSEG/World-Check) · ISO/IEC 42001 external certification readiness assessment | project-sized | Zero-trust write path; certifiable AIMS |

## 16 · Prioritized Action Plan

| # | Recommendation | Priority | Business benefit | Compliance benefit | Complexity | Effort | Depends on | Location |
|---|---|---|---|---|---|---|---|---|
| 1 | Executive layer (4 docs) | **Critical** | Board/investor-ready story | Exam-ready narrative | Low | 1.5 d | — | `docs/executive/` |
| 2 | Model cards ×6 | **Critical** | Feature clarity, onboarding | ISO 42001 A.6 / EU-AI-Act-style documentation | Low | 1.5 d | — | `docs/models/` |
| 3 | Demo pack + screenshots | **Critical** | Sales/management demos | Auditor walkthrough | Low | 1 d | TEST-000 run | `docs/demo/` |
| 4 | Architecture diagram set | High | Faster onboarding/review | Trust-boundary evidence (COSO IT) | Low-Med | 1 d | — | `docs/architecture/` |
| 5 | KPI dashboard | High | Management visibility | Management-review input (42001 §9) | Med | 1–2 d | metrics data (exists) | `docs/executive/` + script |
| 6 | Risk-register L×I format + 2 rows | High | Prioritised mitigation | ISO 31000 conformity | Low | 0.5 d | — | `docs/aims/ai-risk-register.md` |
| 7 | COSO/ISO 31000 crosswalk columns | Medium | Audit-committee fluency | COSO mapping | Low | 0.5 d | — | `ai-frameworks-crosswalk-2026.md` |
| 8 | Charter + Review-Committee ToR | Medium | Clear authorities | 42001 §5 leadership | Low | 0.5 d | — | `docs/governance/` |
| 9 | User/Admin/API guides | Medium | Support burden ↓ | Operating-procedure evidence | Med | 1.5 d | — | `docs/user-guides/`, `docs/api/` |
| 10 | AI-acceptance/override metric in app log | Medium | Real oversight KPI | Human-oversight evidence | Med | 0.5 d | app change | `app.js` + dashboard |
| 11 | UX polish (tour, empty states, mobile) | Low | Adoption | — | Med | 1–2 d | — | app |
| 12 | Walkthrough video | Low | Async demos | — | Low | 0.5 d | demo pack | `docs/demo/` |

*(Security items are tracked in §13 with their own sequence; go-live signatures are pre-requisites
outside this plan.)*

## 17 · Final Maturity Score & Pre-Presentation Checklist

**Final score: 3.9 / 5 today → 4.5 / 5 on completion of items 1–8.**

**Checklist — before presenting to executives, auditors, or regulators:**
- [ ] Executive brief + business value + regulatory-readiness docs merged (`docs/executive/`)
- [ ] All 6 model cards present and dated
- [ ] Architecture + trust-boundary diagrams render on GitHub
- [ ] KPI dashboard shows current month with real numbers
- [ ] AI Policy v1.0 + Stakeholder Impact Assessment **ratified** (signature rows filled)
- [ ] DPIA §6 residual-risk acceptance signed by MLRO
- [ ] Anthropic DPA executed — or its pending status stated on slide 1 (never discovered mid-meeting)
- [ ] TEST-000 end-to-end evidence captured (screenshots in demo pack; task in HAWKEYE STERLING APP)
- [ ] Daily Compliance Brief + AI Governance Report from *this week* exportable as evidence
- [ ] Assurance Coverage Matrix reviewed — every row's proof ran green in the last cycle
- [ ] Risk register: R-13 (transaction feed) status honestly current; key-person row present
- [ ] Latest release tag matches deployed site; CHANGELOG current
- [ ] Demo script rehearsed once end-to-end on the live site
- [ ] Known-gaps list rehearsed — every gap has an owner, date, and compensating control

---
*Prepared as an independent readiness review; observations verified against the repository at the
date above. Recommendations align to ISO/IEC 42001, NIST AI RMF, EU AI Act, OECD AI Principles,
COSO, ISO 31000, FATF RBA, Wolfsberg guidance, and GDPR/PDPL as cited inline.*

---

## 18 · Re-score addendum · 15 July 2026

*Appended as an addendum: sections 1-17 above are the 2 July point-in-time record and are
deliberately left unedited (same convention as the code-scanning triage record). Every claim below
is [OBSERVED] against commit `8576ad61` unless marked otherwise.*

*Estate re-verification · 21 July 2026 — the GitHub Actions expansion added four workflows
(container-scan, attestation-verify, dependabot-automerge, compliance-calendar; every new job
egress-blocked). Coverage additions only — no scored control changed; scores stand as re-scored
on 15 July.*

*Estate re-verification · 22 July 2026 — badge remediation + governance additions (#302): two curated
documents added (GRC↔cybersecurity model, alert-investigation decision tree) and the auto-release
two-stage split added one egress-blocked check job. Coverage additions only — no scored control changed.*

*Estate re-verification · 23 July 2026 — regulatory-applicability additions: two curated documents
added (UAE AI & data laws 2026 posture map, seven-stage operational governance lifecycle).
Coverage additions only — no scored control changed.*

*Estate re-verification · 24 July 2026 — two changes this day: (i) three sign-ready governance
drafts added with the Data Office breach-clock pin (#316), taking the curated set from 107 to 110
(the interim verification recorded 127 total documents); and (ii) state-branch sync (#314): fifteen
auto-generated regulatory-watch digests (docs/research/auto/) folded into main from the
reg-watch-state branch. Curated additions and auto docs only — no scored control changed.*

Verified at HEAD: 62 workflows · 184 markdown documents under docs/ (151 excluding docs/research/auto).
*(11 August — **sharded screening design**. One curated document
(`docs/architecture/sharded-screening-design.md`), explicitly marked NOT YET
BUILT: a design-only record of how the adverse-media coverage collapse would be
fixed by sharding, and of the merge hazards found while scoping it. No workflow
added, no code, no scored control changed.)*

*(7 August — **PEP shard harvest**. One dispatch-only workflow
(`pep-shard-harvest.yml`, egress-blocked) that clears a PEP label backlog across
eight runners at once. Wikidata rate-limits a client — a completed link's log
carries 64 HTTP 429s — so parallelism inside one job has a ceiling that more
clients do not. Additive: the weekly `pep-worldwide.yml` chain is untouched, each
shard writes only its own branch, and a single merge job is the sole writer of
the state branch and REFUSES to publish a set with any shard missing. Throughput
only — no scored control changed, and the same floor/shrink gates guard the
write.)*
*(6 August — **PEP chain watchdog**. One workflow (`pep-chain-watchdog.yml`, egress-blocked) that
restarts a PEP harvest link whose GitHub-hosted runner died abnormally. The harvest's own
time-budget pause cannot cover that case: a dead runner never reaches its re-dispatch step, so the
chain stopped three times with banked work stranded on the state branch. The watchdog checks out
nothing and executes no repository code — it reads the harvest's run history and POSTs a
workflow_dispatch, bounded to two auto-restarts before failing red. Availability of an existing
control only — nothing screened, no state written, no scored control changed.)*
*(5 August, third pass — **source-probe diagnostic instrument**. One dispatch-only workflow
(`source-probe.yml` + `scripts/source-probe.mjs`) that fetches sources already configured in the
screening registry (by id — the input cannot aim it at an arbitrary URL) with realistic browser
headers and publishes status/headers/body-sample/JSON-key-paths/sheet-headers as a step summary +
artifact — the instrument that turns "disabled with a guessed reason" into "disabled with the
observed response, or re-enabled with the right field mapping" for the five sources the first
worldwide live run disabled on evidence. Diagnostic only: nothing screened, no state written, no
secrets in the environment — no scored control changed.)*

Verified at HEAD: 59 workflows · 183 markdown documents under docs/ (150 excluding docs/research/auto).
*(5 August, second pass — **worldwide coverage expansion**. The 13-region source survey landed as
data: twelve new machine-readable national/institutional sanctions lists screen daily (plus DFAT
direct restored, beginning the OpenSanctions-mirror retirement), non-integrable sources became
documented disabled stubs inside the registry itself, the regulator-bulletin net gained five
enforcement feeds (DOJ/CFTC/OCC/DFSA/Europol), an opt-in FBI Wanted per-subject signal joined
Interpol, and one workflow was added — the weekly `pep-worldwide.yml` Wikidata (CC0) harvest that
builds a genuinely license-clean worldwide PEP list (floor + shrink gates; artifact on its own data
branch; the daily screen consumes it as a review-tier local index, capped at band medium). Coverage
additions and one scheduled harvest only — no scored control changed.)*

Verified at HEAD: 58 workflows · 183 markdown documents under docs/ (150 excluding docs/research/auto).
*(5 August — **yente matching benchmark (experimental instrument)**. One dispatch-only workflow
(`yente-bench.yml`) boots the MIT-licensed yente matching engine (the software behind the
OpenSanctions API) on the runner and scores it against the repo's own frozen screening-benchmark
fixtures via `scripts/yente-bench.mjs` — no OpenSanctions data is downloaded (the published database
carries a non-commercial licence; the indexed dataset is generated from our fixtures), no screening
state, cases, or Asana surface is touched, and the report lands as a step summary + 30-day artifact.
Measurement instrument only — no scored control changed.)*

Verified at HEAD: 57 workflows · 183 markdown documents under docs/ (150 excluding docs/research/auto).
*(4 August, thirteenth pass — **deploy self-heal + self-identifying drift**. Same-day follow-through on
register item 26's first half after four runner-shutdown kills ended production-deploy verifications as
red with the deploy itself healthy: `netlify-production-deploy.yml` gains a `retry` job (`needs: deploy`,
failure-only, push-triggered runs only) that re-dispatches the workflow once via `workflow_dispatch` —
the same chaining pattern auto-release uses, because the workflow-lint zizmor gate keeps `workflow_run`
chaining off the table by design (a first draft as a standalone `workflow_run` workflow was correctly
rejected by that gate and never merged). The failed job keeps its red; a 3-runs-per-UTC-day cap goes red
itself rather than looping the build hook. And the afternoon's HTML-drift diagnosis (three shells mutated
at serve time, every other asset byte-identical) took Netlify API archaeology because `site-currency.mjs`
reported hashes only — it now prints a bounded excerpt of the first divergent region per stale asset, so
the next injector names itself in the failing log. Verification + automation additions only — no scored
control changed.)*

Verified at HEAD: 57 workflows · 183 markdown documents under docs/ (150 excluding docs/research/auto).
*(4 August, twelfth pass — **the self-accounting cycle**. The August 2026 full-repo audit closed the
estate's accounting gaps: a documentation map (`docs/README.md`), a data-provenance dictionary
(`data/README.md`, incl. the retain-on-change semantics of `data/retention/`), four retroactive ADRs
(002 zero-runtime-deps · 003 pure-'self' CSP · 004 client-side persistence with its registered exit
path · 005 dual-engine matcher), a deploy-rollback runbook, and root governance for the repository
itself (`GOVERNANCE.md`, `MAINTAINERS.md`, `CLAUDE.md` — see the 2026-08-04 register update for the
nine dated engineering items). §5 was re-verified against disk the same day: six rows still claiming
✗/[PROPOSED] for artefacts that meanwhile shipped (model cards, architecture set, KPI dashboard, demo
pack, executive brief, committee charter) were flipped with dates, and a CI guard now fails any ✗ row
whose `docs/` path exists — a gap table that rots is worse than no gap table. Documentation and
verification additions only — no scored control changed.)*

Verified at HEAD: 57 workflows · 177 markdown documents under docs/ (144 excluding docs/research/auto).
*(4 August, eleventh pass — **Dependabot auto-rebase**. `dependabot-autorebase.yml` closes the automation
gap that strict up-to-date protection left in the Dependabot flow: when one armed bump merged, every other
approved, CI-green bump was stranded "behind" until a hand-clicked "Update branch" (#383/#384 this morning).
The sweep comments `@dependabot rebase` on armed-but-behind Dependabot PRs — Dependabot's own force-push
re-runs the checks, so the approve-once-lands-itself promise of `dependabot-automerge.yml` now holds across
a multi-PR weekly batch. Egress-blocked, comment-only, majors untouched. Automation addition only — no
scored control changed.)*

Verified at HEAD: 56 workflows · 177 markdown documents under docs/ (144 excluding docs/research/auto).
*(3 August, tenth pass — an **MCP server**. `mcp_server.py` exposes the deterministic screening engine
(sanctions/watchlist name screening, FATF R.16 transaction monitoring, KYC/CDD gap analysis, jurisdiction-risk
tiering) to AI agents over the Model Context Protocol, implemented in the Python standard library alone —
zero new dependencies, nothing added to `ci/requirements.txt`, no new supply-chain surface. `mcp_tools.py`
holds the deterministic, decision-support-only tool wrappers (arguments validated and size-capped at the
boundary) and `test/mcp_tools_test.py` — wired into ci.yml — covers both the tool layer and the JSON-RPC 2.0
protocol surface. One curated document added (`docs/mcp-server.md`); no workflow added; no scored control
changed — every tool is decision-support only, consistent with the existing engine posture.)*

Verified at HEAD: 56 workflows · 176 markdown documents under docs/ (143 excluding docs/research/auto).
*(29 July, ninth pass — the **governance chain**. The estate slices its governance four ways — a five-level
stack, a six-layer agentic model, a seven-stage lifecycle, an eleven-stage PbG map — and every one is a
slicing of the same territory. None of them recorded which control's output another control *consumes*, so
there was no control-to-control map anywhere: the assurance matrix is control → proof, §8a of the model card
is pillar → control. `governance-chain.md` draws the missing edge — **Visibility → Explainability →
Accountability → Trust** — with the failure propagation each break causes downstream, using real
dependencies: a stale AI asset register voids the explainability statement's **scope claim**, which voids
every accountability record built on it, because the records then describe a system that is not the one
running. Read upward the table is a diagnostic: a trust indicator that will not hold is rarely a trust
problem. **Trust** is also defined narrowly enough to be measured — the share of what the estate claims that
an outsider can re-derive from the repository without asking anyone — with four indicators that already
exist, two of which deliberately do not read green. One curated document added; no workflow added; no scored
control changed.)*

Verified at HEAD: 56 workflows · 175 markdown documents under docs/ (142 excluding docs/research/auto).
*(29 July, eighth pass — **ISO/IEC 42001 clause 6.1.2 and 6.1.4 separated**. Neither clause number appeared
anywhere in `docs/`: the estate satisfied both in substance and had never distinguished them, which matters
because a risk assessment is routinely offered as though it answered both and it does not. A false negative
is severe to the firm and slight to the screened person; a false positive is the reverse, and is the most
damaging thing this system can do to someone. The two readings point in **opposite directions**, so a
control set tuned only on the 6.1.2 column is tuned the wrong way for the people it acts on.
`iso-42001-clause-6-1-mapping.md` records which artefact answers which sub-clause and carries **bidirectional
R-nn ↔ Annex A** traceability — before it, no register row cited an Annex A control and neither SoA cited a
risk ID, so *"which control treats R-13?"* had no answer anywhere in the tree. Requiring both directions in
CI immediately found two asymmetries. The stakeholder impact assessment is designated the canonical 6.1.4
artefact and extended with unfair/discriminatory outcomes (**"discriminatory" appeared once in the entire
tree**) and an availability clause — every row a comparison between populations rather than a count, because
that is where discrimination lives. Its ratified v1.0 was **not** silently amended: the additions are v1.1
pending approval. And the two statements of applicability, which contradicted each other on A.5.4, are
reconciled — with three status-vocabulary defects fixed, including a page that called the AI policy's
ratification *pending* twenty-five lines after recording it as ratified. One curated document added; no
workflow added; no scored control changed.)*

Verified at HEAD: 56 workflows · 174 markdown documents under docs/ (141 excluding docs/research/auto).
*(29 July, seventh pass — **appetite became tolerance**. Each of the eight appetite positions now carries
a numeric **residual ceiling**, a named operational **owner** and an **escalation SLA** — the three things
a boundary needs that a direction does not. That makes two of the firm's own written rules enforceable for
the first time: the methodology's *"anything above appetite requires a treatment plan with an owner and a
date"* and the register's auditor checkpoint *"residual scores sit within appetite"*, neither of which
could be evaluated while no position stated a number to be above. Ceilings are derived from the
methodology's own published bands by position type (ZERO 6, LOW 9, BANDED/MEASURED 12), not chosen risk by
risk, and only the Board may move them. All twenty register risks are now claimed by exactly one position
— CI fails on a risk claimed twice or by nobody — and `residualAboveAppetite` scores every one on each run.
It reports **1**: R-03, the sanctions false negative, at residual 10 against a ZERO position's ceiling of 6,
with a treatment carrying an owner and a cadence but no date. The measure was breached the day it was
created, which is what it is for. Also added: amber warning bands as a sibling key (only where the red line
has headroom — a threshold of 0 or 100% has none), KRI owners and SLAs carried into the snapshot projection
so the governance data cannot exist unmeasured, and `kri-breach-ledger.md`, the append-only breach history
the byte-compared snapshot cannot carry. One curated document added; no workflow added; no scored control
changed.)*

Verified at HEAD: 56 workflows · 173 markdown documents under docs/ (140 excluding docs/research/auto).
*(29 July, sixth pass — the **risk vocabulary**: `risk-glossary.md` translates the thirty terms of the
risk lens into business language and, in each case, points at the authoritative definition already in
the estate rather than restating it — so the glossary cannot drift from the register it explains. It
records what is **not** governed as plainly as what is: risk capacity, target residual risk, control
owner, loss event and a severity scale have no home here, and the page says so instead of implying a
control that does not exist. It also disambiguates `near-miss`, which in this repository already means
a matcher-score margin and not a failure that was caught in time. Shipped with it, a relative-link
guard (`test/doc-links.test.mjs`): the existing checker probes external URLs only, so a cross-reference
to a file that does not exist was invisible to CI across 1,182 links. Zero were broken — the guard is
preventive, and it verified this page's own forty-four links on the way in. One curated document added;
no workflow added; no scored control changed.)*

Verified at HEAD: 56 workflows · 172 markdown documents under docs/ (139 excluding docs/research/auto).
*(28 July, fifth pass — policy-pack completion: the Conflict of Interest & Staff Conduct policy (the
instrument the pack was missing — declaration duties, recusal, four-eyes, gifts, no commercial override,
and the MLRO's own conflicts routed to the Board chair), plus five instruments that already existed and
were operating but had never been registered: the business continuity plan, the decommissioning
procedure, the data-quality plan, the internal audit programme and the model-validation pack (POL-32 to
POL-36). The anti-shadow-policy sweep was widened after it let two of those through on filename alone:
it now keys on an `**Approver:**` header as well as the name pattern. One curated document added; no
workflow added; no scored control changed. Thirty-six instruments registered, sixteen in force.)*

Verified at HEAD: 56 workflows · 171 markdown documents under docs/ (138 excluding docs/research/auto).
*(28 July, fourth pass — the AML/CFT/CPF **policy pack**: seventeen governing instruments drafted under
`docs/policies/` (master policy, CDD/SDD/EDD, sanctions & TFS, CPF, transaction monitoring & reporting,
goAML filing procedure, EWRA methodology, responsible sourcing, record-keeping, training, governance
charter, whistleblowing, data privacy, information security, outsourcing, independent audit, regulatory
change management). Registered as **draft** pending approval (open-actions item 18) — the estate had the
controls and the registers, but not the instruments that say how the controls are applied. Two obligations
added: OB-20 proliferation financing as a standalone pillar, OB-21 wire-transfer data at AED 3,500.
Eighteen curated documents added; no workflow added; no scored control changed. Compliance completion
moves 37.5% → 33.3% because the denominator grew by two — an honest dilution, not a regression.)*

Verified at HEAD: 56 workflows · 153 markdown documents under docs/ (120 excluding docs/research/auto).
*(28 July, third pass — policy register (`data/policies.json` + `policy-register.md`): thirteen
governing instruments with owner, type, status, approval record and next review, eleven in force and
two draft pending the same board sitting. CI now requires each instrument to declare its owner in its
own header — five documents had none until the register asked — an approval date to be evidenced by
the document itself, a draft to assert no review date, and every policy/procedure/charter/runbook/SOP
under docs/ to be registered or excluded with a reason. One curated document added; no scored control
changed.)*

Verified at HEAD: 56 workflows · 152 markdown documents under docs/ (119 excluding docs/research/auto).
*(28 July, second pass — GRC framework completion: Risk Appetite Statement (DRAFT, board R7), obligation
register and the GRC metrics layer, with `data/risk-appetite.json`, `data/obligations.json` and a
generated `data/grc-metrics.json` behind them. Three curated governance documents added; no workflow
added. New enforced invariants: the stated appetite must match the zero-tolerance list and band cutoffs
the code applies, every obligation must reach a live control and a watch source, and the metrics
snapshot fails CI when stale. Scored controls unchanged — but the estate is now measured: control
effectiveness 100%, compliance completion 37.5%, third-party coverage 71.4%, finding closure 95.2%,
one KRI in breach (vendor assessments, already open-actions items 2 and 5).)*

Verified at HEAD: 56 workflows · 149 markdown documents under docs/ (116 excluding docs/research/auto).
*(28 July — AI-governance register completion: the prompt lifecycle register (PromptOps) and the
tool & connector register, each with a machine-readable source of truth (`data/prompt-assets.json`,
`data/tool-surfaces.json`), a human view, and a CI drift guard (`test/prompt-register.test.mjs`,
`test/tool-register.test.mjs`). Two curated governance documents added; no workflow added. Control
coverage ADDED — prompt change control and the agent-capability inventory were previously
ungoverned — and one new enforced invariant: a model call declaring `tools`/`tool_choice` now fails
CI. No scored control weakened.)*

Verified at HEAD: 56 workflows · 147 markdown documents under docs/ (114 excluding docs/research/auto).
*(28 July — screening accuracy hardening programme: labelled benchmark corpus with per-backend
CI floors (recall 57→97.5%, adverse 58→100%, repeat 50→100%), shared transliteration data,
phonetic fold layer, one-way threshold config + log-only shadow challenger, adverse-media
description scanning / keyword tiers / gated repeat counter. One curated governance document
added (screening-accuracy-benchmark.md). Detection controls STRENGTHENED — no scored control
weakened; bias floors raised 70→90%/group.)*

Verified at HEAD on 25 July (third pass): 56 workflows · 143 markdown documents under docs/ (110 excluding docs/research/auto).
*(25 July, third pass: the EOCN Reconcile preparer — twice-weekly mirror cross-check pushed to a
review branch whose human merge records the MLRO sign-off; the review-age gate itself is
unchanged. Netlify deploy gains a path-filtered push trigger (inert until its secret exists);
quarterly secret-rotation duties added to the compliance calendar. Tooling only — no scored
control changed.)*

Verified at HEAD on 25 July (second pass): 55 workflows · 143 markdown documents under docs/ (110 excluding docs/research/auto).
*(25 July, second pass — resilience hardening: the Control Retry self-healing dispatcher
(re-fires any daily control missing its day's success, two passes before the freshness alarm)
and the Site Currency probe (live APP_VERSION vs main, self-arming, Asana-alerting — closes the
gap that let production deploys sit silently stale from 27 Jun). Freshness Check gains a second
daily firing. Tooling only — no scored control changed.)*

Verified at HEAD on 25 July (earlier): 53 workflows · 143 markdown documents under docs/ (110 excluding docs/research/auto).
*(25 July: two operations workflows added by the badge-failure investigation — the Netlify
production-deploy lever (build hook) and the read-only Netlify probe — plus the daily screening's
self-healing 03:07 UTC retry firing inside the existing workflow. Tooling only — no scored control
changed.)*

Verified at HEAD on 11 August: 62 workflows · 184 markdown documents under docs/ (151 excluding docs/research/auto).
*(Adds docs/architecture/sharded-screening-design.md — a design-only record for
sharded screening, explicitly marked NOT YET BUILT. No control changed, nothing
scored; it exists so the hazards found while scoping the work are not
rediscovered the hard way.)*

Verified at HEAD on 24 July: 51 workflows · 143 markdown documents under docs/ (110 excluding docs/research/auto).
(Evening sync of the same day added the 24 July regulatory-watch digest — one auto doc.)

Verified at HEAD on 23 July: 51 workflows · 124 markdown documents under docs/ (107 excluding docs/research/auto).

Verified at HEAD on 22 July: 51 workflows · 112 markdown documents under docs/ (95 excluding docs/research/auto).

Verified at HEAD on 21 July: 51 workflows · 110 markdown documents under docs/ (93 excluding docs/research/auto).

Verified at HEAD on 15 July: 47 workflows · 110 markdown documents under docs/ (93 excluding docs/research/auto).
(Refreshed with this cycle's curated-list update SOP, which added one governance document.)
(The 2 July scope line said 37 workflows and 40+ governance documents; the estate has grown and the
counts are now asserted by `test/readiness-review.test.mjs`, which fails CI when this line drifts
from the repository.)

### 18.1 Delivered since 2 July (the Critical/High items of §16)

| §16 item | Status 15 Jul | Evidence |
|---|---|---|
| 1. Executive layer (4 docs) | **Delivered** | `docs/executive/` (executive-brief, business-value, regulatory-readiness, roadmap) |
| 2. Model cards ×6 | **Delivered** | `docs/models/` (risk-scoring-engine, sanctions-name-matcher, adverse-media-classifier, pep-identifier, advisor-llm, ai-triage + README) |
| 3. Demo pack + screenshots | **Delivered** (no walkthrough video yet) | `docs/demo/` (demo-script, scenarios, sample-data) + `docs/screenshots/` |
| 4. Architecture diagram set | **Delivered** | `docs/architecture/diagrams.md` (7 Mermaid diagrams incl. trust boundaries) |
| 5. KPI dashboard | **Partially delivered** | `docs/executive/kpi-dashboard.md` (catalogue + monthly log; KPI 10 still needs the in-app accept/override logging; no auto-rendered page yet) |
| 6. Risk-register L×I format | **Delivered** | `docs/aims/ai-risk-register.md` (Likelihood/Impact scales, inherent vs residual) |
| 7. COSO / ISO 31000 crosswalk | **Not delivered** | no COSO mapping in `ai-frameworks-crosswalk-2026.md` |
| 8. Charter + Review-Committee ToR | **Not delivered** | committee remains unchartered (register item P2, Board) |
| 9. User/Admin/API guides | **Delivered** | `docs/user-guides/` (3 guides) + `docs/api/functions.md` |
| 10. AI-acceptance metric in app log | **Not delivered** | pending app change (feeds KPI 10) |

Also delivered since 2 July, relevant to scoring: AI Policy v1.0, Stakeholder Impact Assessment and
DPIA §6 residual-risk acceptance are **ratified 2026-07-02** (`ai-policy.md` §9, `stakeholder-impact-assessment-2026.md`
sign-off, `dpia-2026.md` §6); ISO/IEC 42001 mandatory-documents index added; workflow-hardening pass
(job-level tokens, egress blocks, non-root container with a PR-time container smoke test).

### 18.2 Re-scored dimensions

| Dimension | 2 Jul | 15 Jul | Basis for change |
|---|---:|---:|---|
| AI governance framework | 4.5 | 4.5 | unchanged |
| Compliance documentation | 4.5 | 4.5 | unchanged |
| Controls & assurance | 4.5 | 4.5 | unchanged |
| Security engineering | 4.5 | 4.5 | unchanged (hardening continued; GitHub UI controls still open, see P23-P25) |
| Risk management | 4.0 | 4.5 | L×I inherent/residual format delivered |
| Repository organisation | 4.0 | 4.5 | audience-first docs tree of §7 delivered (executive/models/architecture/user-guides/api/demo) |
| Architecture documentation | 3.5 | 4.5 | diagram set incl. trust boundaries delivered |
| UX | 4.0 | 4.0 | unchanged (tour/empty states still proposed) |
| Model documentation | 3.0 | 4.5 | all 6 model cards delivered |
| Metrics & KPIs | 3.0 | 3.5 | dashboard spec + log delivered; rendering + KPI 10 outstanding |
| Executive readiness | 2.5 | 4.0 | executive layer delivered |
| Presentation/demo readiness | 2.5 | 4.0 | demo pack + screenshots delivered; video outstanding |
| **Overall** | **3.9** | **4.3** | mean of the twelve dimensions |

### 18.3 §17 checklist, refreshed

- [x] Executive brief + business value + regulatory-readiness docs merged (`docs/executive/`)
- [x] All 6 model cards present and dated
- [x] Architecture + trust-boundary diagrams render on GitHub (`docs/architecture/diagrams.md`)
- [ ] KPI dashboard shows current month with real numbers (log present; current-month row to complete)
- [x] AI Policy v1.0 + Stakeholder Impact Assessment ratified (2026-07-02, signature rows filled)
- [x] DPIA §6 residual-risk acceptance signed by MLRO (2026-07-02)
- [ ] Anthropic DPA executed (still DRAFT: `docs/aims/anthropic-dpa-execution-pack.md`; state it on slide 1)
- [ ] TEST-000 end-to-end evidence captured
- [ ] Daily Compliance Brief + AI Governance Report from *this week* exportable as evidence
- [ ] Assurance Coverage Matrix reviewed: every row's proof ran green in the last cycle
- [x] Risk register: R-13 (transaction feed) status honestly current; key-person row present
- [x] Latest release tag matches the released version line (v3.7.2 released 2026-07-11)
- [ ] Demo script rehearsed once end-to-end on the live site
- [ ] Known-gaps list rehearsed: every gap has an owner, date, and compensating control

### 18.4 Outstanding to reach 4.5

COSO/ISO 31000 crosswalk columns (§6-D) · charter + committee ToR (§8, register P2) · KPI 10
app-log change + rendered dashboard (§12) · walkthrough video (§14) · executed Anthropic DPA
(register P3) with the live bias cycle it unlocks (P6) · GitHub UI hardening checklist rows
(register P23-P25). Re-score at least quarterly and on any figure drift (CI-enforced).
