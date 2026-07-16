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
| AI Review Committee ToR | ✗ | [PROPOSED] `docs/governance/ai-review-committee-tor.md` — sized honestly for a small firm (MLRO + senior manager + external advisor, quarterly, quorum 2) |
| Responsible/Ethical AI | ✅ | AI policy principles + `ai-acceptable-use-policy.md` |
| Explainability / Transparency | ✅ | `docs/governance/explainability-statement-2026.md`; [AI] output labelling in-app |
| Fairness | ✅ | `docs/aims/bias-fairness-testing.md` + CI recall-gap bound + quarterly live bias eval (DPA-gated) |
| Accountability | ✅ | Role tables in AI policy §5; git-signed history |
| Data Governance / Privacy | ✅ | `data-quality-plan.md`, `pdpl-data-processing-assessment.md`, `dpia-2026.md`, `data-retention.md` |
| Security / Auditability | ✅ | `SECURITY.md`, `docs/security/`, hash-chained log, evidence trails |
| Model cards (per AI feature) | ✗ | [PROPOSED] `docs/models/` — see §6-B |
| Architecture diagram set | ✗ | [PROPOSED] `docs/architecture/` — see §11 |
| KPI dashboard | ✗ | [PROPOSED] `docs/executive/kpi-dashboard.md` (+ generated HTML) — see §12 |
| Demo pack | ✗ | [PROPOSED] `docs/demo/` — see §14 |
| Executive brief / ROI | ✗ | [PROPOSED] `docs/executive/` — see §6-A |
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

Verified at HEAD: 46 workflows · 109 markdown documents under docs/ (92 excluding docs/research/auto).
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
