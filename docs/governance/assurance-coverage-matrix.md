# Assurance Coverage Matrix

**Purpose.** One page that answers an examiner's first question: *for every control
the firm claims, where is the automated proof, how often does it run, and where is
the evidence?* Rows map each control to the workflow/test that exercises it. A
control with no automated proof appears in §4 (manual assurance) — nothing is
claimed without a verification path.

**How to read.** *Proof* = the artefact that exercises the control (test file or
GitHub Actions workflow). *Frequency* = when it runs. *Evidence* = where the
result is recorded. All referenced workflows live in `.github/workflows/`; tests
in `test/`.

_Last reviewed: 2026-07-02 · Owner: Compliance Engineering · Review: with each
material change, and at the quarterly management review._

---

## 1 · Control → proof matrix

### 1.1 Risk engine & scoring integrity

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| DPMS 0–30 scoring reproduces the approved baseline | `test/scoring-golden.test.js` (golden set) | Every push/PR (CI) | CI run log |
| Full app behaviour (bands, escalations, overrides, RBAC, policy gate) | `test/app.test.js` (280+ checks) | Every push/PR (CI) | CI run log |
| Hard-outcome rules (prohibitive/EDD triggers) cannot regress | `test/app.test.js` + `test/scoring-golden.test.js` | Every push/PR | CI run log |
| Model validation with MLRO sign-off | — (manual, §4) | Quarterly | [`model-validation-2026.md`](model-validation-2026.md) |

### 1.2 Asana delivery integrity (assessments → HAWKEYE STERLING APP)

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| One task per reference — no duplicates on re-score/re-complete (external-ID + ref dedup) | `test/asana-functions.test.js` | Every push/PR | CI run log |
| Transient Asana failures (429/5xx) never create duplicates; 429 auto-retried | `test/asana-functions.test.js` | Every push/PR | CI run log |
| Edited re-submissions are written through (no lost update) | `test/asana-functions.test.js` | Every push/PR | CI run log |
| Delivery outcomes recorded in the tamper-evident activity log | `test/app.test.js` (`asana.delivery.ok/failed` cases) | Every push/PR | CI run log + in-app log |
| Failed deliveries visible and retryable across assessments | `test/app.test.js` (retry-all + status chips) | Every push/PR | CI run log |
| App ↔ Asana drift detected (gaps / orphans / duplicates / mismatches) | `asana-reconcile.yml` → `scripts/asana-reconcile.mjs`; logic in `test/asana-reconcile.test.mjs` | Weekly (Mon 10:00 UTC) + per-push tests | PII-free card in *Ongoing Monitoring*; issue fallback |
| Delivery functions live and authenticated (probe expects 400, not 5xx) | `function-health.yml` | Daily 05:15 UTC | Run log; Asana alert on failure |

### 1.3 Sanctions / AM / PEP screening

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| Daily unified screen of the full customer base (sanctions + adverse media + PEP) | `weekly-adverse-media.yml` → `screen.py` | Daily 00:00 UTC | Task in *Ongoing Monitoring* (Screening Daily Report) |
| New customers screened near-onboarding | `onboarding-screen.yml` → `screen.py` | Every 6 h | Onboarding task in *Ongoing Monitoring* |
| **No false all-clear** — refuses to run on 0 customers or 0 loaded sanctions lists | Guards in `screen.py` (`get_all_customers`, `load_all_lists`); mirrored in `scripts/sanctions-screen.mjs` (`bailUnscreened`) | Every run | Red workflow run (non-zero exit) |
| Matching quality (fuzzy, transliteration, Arabic) with fairness bound | `test/sanctions-match.test.mjs`, `test/sanctions-match-fuzz.test.mjs`, `test/engine_test.py` (recall-gap check) | Every push/PR | CI run log |
| Screening engine unit coverage | `test/sanctions-screen.test.mjs` (50 checks) | Every push/PR | CI run log |
| Mandatory-daily controls actually ran today | `freshness-check.yml` → `scripts/freshness-check.mjs` | Daily 09:00 UTC | Asana alert on staleness |
| Screening observability metrics | `scripts/screening-metrics.mjs` (in `sanctions-screen.yml`) | Per screen run | Run log (§3 KPIs) |

### 1.4 Regulatory & list watch

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| Consolidated sanction-list changes detected (OFAC/UN/EU/UK) | `sanctions-watch.yml` (+ `test/sanctions-watch.test.mjs`) | Daily 05:00 UTC | Card in *Ongoing Monitoring* → Sanctions updates; issue fallback |
| Regulator source changes detected (20 UAE/global sources) | `regulatory-watch.yml` (+ `test/reg-watch.test.mjs`) | Daily 06:00 UTC | Card → Regulatory changes; issue fallback |
| FATF black/grey list moves + affected-assessment digest | `fatf-watchdog.yml` (+ `test/watchdog.test.mjs`) | Daily 06:00 UTC (digest monthly) | Card → FATF list moves; review task |
| Daily compliance brief composed from the monitoring projects | `daily-brief.yml` (+ `test/daily-brief.test.mjs`) | Daily 07:00 UTC | Brief card in *Ongoing Monitoring* |
| Anomaly watch over watcher outputs | `anomaly-watch.yml` | Daily | Run log / alert |

### 1.5 Supply-chain & code security

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| Secrets never committed (custom allowlist for public GIDs) | `gitleaks.yml` + GitGuardian app | Every push/PR | Check runs; SARIF artifact |
| SAST (JS + Python) | `semgrep.yml`, `codeql.yml` | Push/PR + weekly | Code-scanning alerts |
| Toolchain CVEs | `osv-scanner.yml` | Push + schedule | SARIF / run log |
| Dependency review on PRs | `dependency-review.yml` | Every PR | Check run |
| Workflow security lint (incl. injection patterns) | `workflow-lint.yml` (actionlint + zizmor) | Push/PR | Check run |
| Supply-chain posture score | `scorecard.yml` (OpenSSF) | Weekly | Scorecard dashboard / SARIF |
| All third-party actions SHA-pinned; runners hardened (harden-runner on all 38 workflows) | `workflow-lint.yml` + audited 2026-07 | Continuous | This doc; audit trail in PRs #159/#161 |
| Egress blocked with explicit allowlists on every `contents:write` job that fetches the internet | harden-runner `egress-policy: block` in `onboarding-screen`, `weekly-adverse-media`, `regulatory-watch`, `sanctions-watch`, `daily-sanctions-screen`, `fatf-watchdog`, `daily-brief`, `asana-reconcile`, `function-health`, `freshness-check` | Every run | Run logs (blocked-host = loud failure) |
| Release artefacts signed (Sigstore keyless) + SBOM | `release.yml` / `auto-release.yml` (+ `test/sbom.test.mjs`) | Per release | Release attestations; `sbom.cdx.json` |
| DAST baseline of the live site (image digest-pinned) | `dast-zap.yml` (OWASP ZAP) | Scheduled + dispatch | ZAP report artifact |

### 1.6 Application & edge security

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| Pure-`'self'` CSP, no unsafe-inline (static + real browser) | `test/csp.test.mjs`, `test/csp-runtime.spec.mjs` | Push/PR + cross-browser job | CI log; CSP violation sink (`csp-report` fn) |
| Full security-header set (HSTS, COOP/COEP, Permissions-Policy…) | `test/security-headers.test.mjs` | Every push/PR | CI run log |
| Service worker cache hygiene (no API/PII caching) | `test/sw.test.mjs` | Every push/PR | CI run log |
| Function input gates: JSON-only (415), 1 MB body cap (413), CORS/origin allow-list, per-IP rate limit | `test/asana-functions.test.js`, `test/ratelimit.test.js` | Every push/PR | CI run log |
| Live site renders and functions respond | `site-health.yml`, `function-health.yml` | Daily 05:00/05:15 UTC | Asana alert on failure |

### 1.7 Data protection & records

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| PII-minimised delivery available (tokenised mode: ref/tier/score only) | `test/app.test.js` (tokenised payload cases) | Every push/PR | CI run log |
| Tokenised (pseudonymised) audit-log export | `test/app.test.js`, `test/export-integrity.test.js` | Every push/PR | CI run log |
| Reconciliation is PII-free by construction | `test/asana-reconcile.test.mjs` ("leaks no entity names") | Every push/PR | CI run log |
| Tamper-evident (hash-chained) activity log | `test/app.test.js` (chain verify) | Every push/PR | CI run log |
| Client-side encryption of stored records; retention purge honours filed records | `test/crypto-b64.test.mjs`, `test/app.test.js` (retention cases) | Every push/PR | CI run log; [`data-retention.md`](data-retention.md) |
| Off-device backups (register/log/risk-data) with monthly commit to git | `risk-backup` fn + `fatf-watchdog.yml` backup step | Continuous / monthly | `data/risk-overrides-backup.json` history |

### 1.8 AI governance (Advisor)

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| Advisor guardrails (charter integrity, tipping-off, routing) | `test/advisor-assurance.test.js` (65 checks) + advisor smoke tests | Every push/PR | CI run log |
| Behavioural eval with Asana alert on regression | `advisor-eval.yml` → `scripts/advisor-eval.mjs` | Weekly (Mon 08:00 UTC) | Card / issue fallback |
| Bias eval (deterministic dimension; live-LLM pairs gated on DPA) | `advisor-bias-eval.yml` + `test/bias_eval.py` | Quarterly | [`advisor-bias-review-2026.md`](advisor-bias-review-2026.md) |
| Prompt-injection red team | `test/redteam_injection.py` | Every push/PR | CI run log; [`red-team-procedure`](../aims/red-team-procedure.md) |
| LLM egress gated until DPA executed (`LLM_TRIAGE=0`) | Env gate in `onboarding-screen.yml` / `weekly-adverse-media.yml` | Every run | Workflow env; [`third-party-register`](../aims/third-party-register.md) |

### 1.9 Quality & accessibility

| Control | Automated proof | Frequency | Evidence |
|---|---|---|---|
| WCAG 2.1 AA (axe + pa11y + keyboard e2e) | `a11y.yml`, `test/axe.spec.mjs`, `test/keyboard.spec.mjs` | Weekly + path-triggered | Run log (advisory) |
| Cross-engine rendering (Chromium/Firefox/WebKit) | `cross-browser.yml` | Path-triggered | Run log (advisory) |
| Performance/SEO budgets | `lighthouse.yml` | Path-triggered | LHCI artifact |
| Visual regression vs committed baseline | `visual.yml` (read-only compare; write scopes only on baseline dispatch) | Path-triggered | Playwright report artifact |
| Documentation link integrity + changelog format | `link-check.yml`, `test/changelog.test.mjs` | Weekly + push | CI run log |

---

## 2 · Where the outputs land

All monitoring/alert output converges on **two Asana projects**:
**HAWKEYE STERLING APP** (assessment deliveries + register/log/risk-data mirrors +
site/function-health alerts + FATF review digests) and **Ongoing Monitoring**
(screening reports, watcher cards, daily brief, reconciliation). Every alerting
workflow has a loud failure path (red run, GitHub-issue fallback, or Asana alert)
— **silence is never success**.

## 3 · KPI catalog

| KPI | Source | Cadence |
|---|---|---|
| Delivery success rate (`asana.delivery.ok` vs `.failed`) | In-app activity log (tokenised export) | Continuous |
| Reconciliation discrepancies (gaps/orphans/duplicates/mismatches) | Weekly reconcile card | Weekly |
| Screening coverage (subjects screened / customer base) + hit counts | Screening task titles + `screening-metrics.mjs` | Daily |
| Sanctions-list freshness (per-list date/hash) | Screening report §list status; `freshness-check` | Daily |
| Watcher change volume (reg/sanctions/FATF cards) | *Ongoing Monitoring* sections | Daily |
| CI health (suite pass rate, 45 test files) | GitHub Actions | Per push |
| Supply-chain score | OpenSSF Scorecard | Weekly |
| Advisor eval outcomes (guardrail regressions, bias divergence) | Eval workflow runs / review docs | Weekly / quarterly |

## 4 · Manual assurance cadence (no automated proof — by design)

| Activity | Owner | Cadence | Record |
|---|---|---|---|
| Model validation sign-off | MLRO | Quarterly (next due 2026-09-30) | [`model-validation-2026.md`](model-validation-2026.md) |
| Management review of the AIMS | Senior mgmt / MLRO | Quarterly | [`management-review.md`](../aims/management-review.md) |
| **Manual penetration test** of the live app + functions (beyond the automated ZAP baseline): authenticated-flow abuse, business-logic, rate-limit bypass, CORS/origin edge cases | Firm (external tester recommended) | **Annual** | Report filed in `docs/governance/`; findings → [`corrective-actions.md`](../aims/corrective-actions.md) |
| Review of deferred architectural decisions (function auth / Netlify Identity, distributed rate limiting, WebAuthn) | Firm | Annual or on risk change | This doc + [`ai-governance-gap-analysis-2026.md`](ai-governance-gap-analysis-2026.md) |
| Asana token custody: scoped service account + rotation on personnel change | Firm (Asana admin) | On change / annual | [`third-party-register.md`](../aims/third-party-register.md) |

## 5 · Known gaps (stated, not hidden)

| Gap | Status |
|---|---|
| Transaction monitoring (FATF R.16) engine **inactive** pending a real feed | Risk **R-13** in [`ai-risk-register.md`](../aims/ai-risk-register.md) |
| LLM triage + live-LLM bias pairs **off** pending Anthropic DPA signature | Gated by `LLM_TRIAGE=0`; [`third-party-register.md`](../aims/third-party-register.md) |
| Write endpoints are unauthenticated by design (browser cannot hold a secret); compensating controls: origin allow-list, rate limit, input gates, no data readback | Deferred decision — Netlify Identity would close it |
| ~~AI Policy & Stakeholder Impact Assessment await ratification signatures~~ **Closed 2026-07-02** — both ratified | [`ai-policy.md`](ai-policy.md) §9 (v1.0 ratified 2 July 2026); [`stakeholder-impact-assessment-2026.md`](stakeholder-impact-assessment-2026.md) sign-off table |
