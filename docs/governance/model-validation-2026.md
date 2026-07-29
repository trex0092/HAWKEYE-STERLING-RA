# Risk-Scoring Model Validation Pack (2026)

**Model:** Entity Risk Assessment scoring engine (DPMS) — `app.js` `computeAssessment()`
**Model version:** APP_VERSION `3.7.0` · Risk-data baseline `RISK_DATA_VERSION = 2026-06`
**Owner:** MLRO / Head of Compliance (`@trex0092`)
**Approver:** MLRO · Registered as POL-36 in the [policy register](policy-register.md)
**Status:** Validated · next review **2026-09-30** (quarterly)

This pack is the independent validation record for the firm's customer (entity)
risk-rating model. It documents the model's purpose, methodology (factors,
weights, thresholds, hard outcomes), the validation evidence, the change-control
process, and the quarterly MLRO sign-off. It satisfies the model-governance
expectations of **FATF Recommendation 1** (risk-based approach), **R.10/R.12**
(CDD/PEPs) and the firm's AML/CFT Risk Assessment Methodology.

---

## 1. Model purpose, scope and classification

- **Purpose:** produce a defensible, repeatable customer-risk rating that drives
  the diligence level (CDD / SDD / EDD) and review cadence for a reporting
  entity, with mandatory "hard outcomes" for designated-party and high-risk
  exposure.
- **Scope:** the deterministic scoring logic in `app.js` and the firm-approved
  baseline reference data (`COUNTRIES`, `ACTIVITIES`, `RECYCLED`, `MINED`, and the
  `QUESTIONS_OC` rule set) plus officer overrides.
- **Classification:** **deterministic and fully explainable — not AI/ML.** Every
  output is a pure function of the inputs and the published weights; there is no
  training data, no inference, and no stochastic behaviour. The optional AI
  *Advisor* is a separate system governed by the AI Management System
  (`docs/aims/`, `docs/governance/`); it provides decision **support** only and
  never feeds the score. This separation is itself a control: the regulated
  rating cannot be perturbed by model drift or prompt injection.

---

## 2. Methodology — factors, weights and thresholds

The score is the **sum of all factor scores**; the numeric band follows fixed
boundaries; hard outcomes then override the numeric band where required.

### 2.1 Factor weights

| Factor | Source | Score range | Rationale |
|---|---|---|---|
| Jurisdiction of incorporation & operation | `COUNTRIES` baseline | 1 (low) – 3 (high) | Country AML/CFT risk; FATF lists weighted at the top of the range |
| Nature & complexity of business activity | `ACTIVITIES` baseline | 1 – 3 | Inherent sector risk (DPMS sectors score high) |
| 11 ownership/control/compliance questions (`QUESTIONS_OC`) | Yes/No | 1 or 3 each | Standard (`vlok`): Yes = 3 / No = 1. Control-adequacy (`vlok2`, AML/CFT controls): Yes = 1 / No = 3 |
| Onboarding channel | Yes/No | 1 or 3 | In-person = 1, remote / non-face-to-face = 3 |
| Operational history (entity) | years | 1 – 3 | ≤ 0 yr = 3, 1 yr = 2, ≥ 2 yr = 1 |
| Relationship duration | years | 1 – 3 | Same curve as operational history |
| Recycled material sources (×3) | `RECYCLED` baseline | 0 – 3 each | Supply-chain ML/TF risk (responsible sourcing) |
| Mined material sources (×3) | `MINED` baseline | 0 – 3 each | LSM/MSM = 2, ASM (artisanal) = 3 |

Implementation: `computeAssessment()` (`app.js`), helpers `scoreFromYesNo()`,
`yearsToScore()`, `effCountry()` / `effOf()` (apply officer overrides).

### 2.2 Numeric band boundaries

| Total | Band | Diligence | Review cycle (`REVIEW_MONTHS`) |
|---|---|---|---|
| 0 – 19 | **CDD** | Customer Due Diligence | 12 months |
| 20 – 22 | **SDD** | Simplified Due Diligence | 6 months |
| 23 + | **EDD** | Enhanced Due Diligence | 3 months |

### 2.3 Hard outcomes (override the numeric band)

Applied in priority order in `computeAssessment()`:

1. **PROHIBITED — do not onboard.** Any of: sanctions on owners/directors/
   management, sanctions on the entity, terrorist-financing or proliferation-
   financing connections (`QUESTIONS_OC` items flagged `prohibit:true`). Funds
   frozen where held; the MLRO decides on an FIU report under UAE Federal
   Decree-Law No. (10) of 2025.
2. **Mandatory EDD floor.** Any of: PEP exposure (FATF R.12), a FATF
   call-for-action jurisdiction (Iran, North Korea, Myanmar — `cfa:true`), or
   artisanal (ASM) gold sourced from a high-risk jurisdiction (OECD Annex II).

### 2.4 Analyst override (one-way ratchet)

An analyst/MLRO may **raise** the operative outcome (CDD→SDD/EDD, SDD→EDD) with a
mandatory written justification. The override can never **weaken** the engine
outcome and never applies to a PROHIBITED relationship. Enforced in
`computeAssessment()` via the `RANK` comparison; the printed report records the
override and its reason.

---

## 3. Validation evidence

- **Golden / regression set:** [`test/scoring-golden.test.js`](../../test/scoring-golden.test.js)
  freezes representative entities and the exact engine output (total, band,
  escalations, override behaviour). It runs on every push/PR in CI
  (`.github/workflows/ci.yml`, step "Run scoring model-validation golden set").
  A change to any frozen value is, by definition, a change to firm-approved
  methodology and requires the sign-off in §5.
- **Functional coverage:** [`test/app.test.js`](../../test/app.test.js) exercises
  the engine, register, report rendering and persistence (272 checks).
- **Reproducibility:** the model is deterministic and dependency-free; the same
  inputs always yield the same output, on any browser, offline.
- **Independence:** validation logic (the golden set) is authored and reviewed
  separately from the engine, and CI-frozen — a change to any frozen value
  fails the build, so the validation evidence cannot drift silently with the
  code it checks. **Stated limitation:** in today's single-maintainer estate,
  build and validation both sit under `@trex0092` (CODEOWNERS); with the
  mechanical safeguards that is *self-validation with guards*, not independent
  validation in the SR 11-7 / CBUAE MMS sense. Independent review is therefore
  routed to the Internal Audit thematic review (open-actions item 8), scoped
  per the [MRM framework](model-risk-management-2026.md) §3
  "Independent validation" row; its findings land in the §5 log below.

### 3.1 Reference examples (frozen)

| ID | Scenario | Total | Band | Operative outcome |
|---|---|---|---|---|
| G1 | Baseline UK precious-metal trader (defaults) | 19 | CDD | CDD |
| G2 | One year operating history | 20 | SDD | SDD |
| G2 | New + greenfield relationship | 23 | EDD | EDD (by score) |
| G3 | Sanctions / TF / PF flag = Yes | (n/a) | — | **PROHIBITED** |
| G4 | PEP exposure | 21 | SDD | **EDD** (R.12 floor) |
| G5 | FATF call-for-action jurisdiction (Iran) | 21 | SDD | **EDD** (floor) |
| G6 | Nigeria + ASM mined gold | 24 | EDD | EDD (OECD Annex II) |
| G7 | Analyst override CDD → EDD (with reason) | 19 | CDD | EDD (forced) |

---

## 4. Change-control process

1. Any change to scoring logic, factor weights, band thresholds, hard-outcome
   rules, or the baseline reference data is made by **pull request**.
2. CODEOWNERS routes compliance-sensitive paths (`app.js`, `data/`,
   `docs/governance/`) to the MLRO for review (`.github/CODEOWNERS`).
3. CI must be green, including the golden set; any intended change to a frozen
   value is updated in the same PR with rationale in the PR description.
4. The baseline data carries `RISK_DATA_VERSION`; bump it when the arrays change.
   Git history is the official audit trail (FATF R.11 record-keeping).
5. The change and its approval are recorded in the sign-off log below.

---

## 5. Quarterly MLRO sign-off log

| Quarter | Model / baseline version | Validation run (golden set) | Findings | Signed off (MLRO) | Date |
|---|---|---|---|---|---|
| 2026 Q2 | APP 3.7.0 / data 2026-06 | PASS (35/35) | No exceptions. Methodology, weights, thresholds and hard outcomes confirmed against the AML/CFT Risk Assessment Methodology. | MLRO / Head of Compliance | 2026-06-29 |
| 2026 Q3 — **advisor model change** | APP 3.7.2 / advisor `claude-sonnet-5` (balanced), `claude-opus-5` (deep), `claude-haiku-4-5` (speed) | PASS — full suite 72/72 incl. advisor assurance (76 checks), prompt-injection red team (100% detection / non-execution / no-downgrade) and the scoring golden set (35/35) | Provider model change under §4, recorded here per §4 step 5. **No scoring, hard-outcome or escalation logic changed** — the deterministic engine is untouched by this and the golden set is unmoved. Request shape unchanged (no `temperature`, `top_p` or `thinking` parameter). Two coupled changes: the governed routing (`MODEL_BY_MODE`) and `data/ai-assets.json` move together, pinned by CI; and the advisor's abort budget now derives from the platform execution cap, so a deep-mode request can no longer be killed mid-flight with its guardrails unrun. **Live confirmation:** the behavioural eval was dispatched against the real API the same day — [run 30452220311](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/runs/30452220311), all guardrail cases held on `claude-sonnet-5`, zero regressions (the workflow's fail-on-regression step did not fire, and the egress log shows the `api.anthropic.com` call). Two follow-through controls landed with it: the eval now covers **every model of the governed routing** (haiku, sonnet-5, opus-5), not only the balanced default; and it **fires automatically on any push to `main` that touches `brain-soul.js`, `data/ai-assets.json` or the eval itself** — a model swap can no longer wait up to a week for its live confirmation, which is exactly what this row's original residual limitation described. | **HS MLRO** | 2026-07-29 |
| 2026 Q3 — **matcher recall (deterministic engine)** | APP 3.7.2 / `screen.py` name matcher | PASS — full suite 73/73; screening-accuracy benchmark **recall 118/121 → 119/121 (97.5% → 98.3%) on BOTH Python backends, hard-negative clear rate unchanged at 85/85 (100%)**; cross-engine parity 12/12; blocking-equivalence property green under real rapidfuzz | **Two sanctions FALSE NEGATIVES closed, plus a nondeterminism defect.** (1) A designation embedded in a customer name could screen CLEAR: the near-exact gate for short entries tested only `min(full, core)`, which legal-form boilerplate drags down — "Hamas General Trading LLC" vs designated "HAMAS" scored full=33/core=100 and cleared, while the JS engine scored the same pair 100/critical. (2) The same shape for long entries whose distinctive core is ONE token — "Al Qaeda General Trading" vs "AL QAEDA" (full=50; the token-subset gate cannot fire because `_is_token_subset` requires ≥2 core tokens and AL is a particle). (3) **Screening was nondeterministic**: the per-variant winner was "first variant scoring strictly higher" over a Python **set**, so on a score tie the recorded core — and whether the pair passed the core gates — depended on the process hash seed; measured, the Al Qaeda pair flipped HIT/CLEAR across `PYTHONHASHSEED` 0–9. Fixes: the near-exact test now also runs on the distinctive core (both entry-length branches), and variant selection is sorted with a core-then-full tie-break. The `min()` control is untouched — it guards the OPPOSITE shape (full high / core low, shared boilerplate). Recall gain carries **zero** false-positive cost on the 85 hard negatives; `fn_count_max` ratcheted 3 → 2 on both Python backends so the recovered case cannot silently regress. Found by an adversarial audit of the screening stack; both false negatives are now pinned in `test/fixtures/matcher-parity/corpus.json` and `test/engine_test.py`. | _pending MLRO sign-off_ | _pending_ |
| 2026 Q3 — quarterly | _pending_ | _pending_ | | | 2026-09-30 |

---

## 6. Governance alignment

- **MRM:** this pack is the Tier-1 validation record under the firm's
  [Model Risk Management framework](model-risk-management-2026.md) (CBUAE MMS
  / SR 11-7 crosswalk); outcomes analysis is delegated to the
  [backtesting protocol](backtesting-protocol-2026.md) and threshold challenge
  to the [champion/challenger protocol](champion-challenger-thresholds.md).
- **FATF:** R.1 (risk-based approach), R.10/R.12 (CDD/PEP), R.11 (records), R.26
  (supervision via the daily screening engine).
- **NIST AI RMF / ISO 42001:** the deterministic model complements the AI
  Management System mappings in `docs/governance/nist-ai-rmf-mapping-2026.md`
  and `docs/governance/iso-42001-soa-2026.md` (the "Measure"/validation function
  here is the golden set; "Govern" is this pack + CODEOWNERS + sign-off).
- **OECD AI Principles** (transparency & explainability, robustness/security,
  accountability) and the continuous **govern → manage → monitor** AI-governance
  lifecycle apply to the AI *Advisor*; this model's explainability (per-factor
  contributions surfaced in every report) and human-in-the-loop sign-off are the
  deterministic-model equivalents.
