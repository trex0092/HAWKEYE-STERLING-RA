# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the application follows the `APP_VERSION` constant in [`app.js`](app.js).
Release tags and notes are also generated automatically by the
[Auto Release workflow](.github/workflows/auto-release.yml) on every version
bump merged to `main`.

## [Unreleased]

### Security & hardening

- **AML monitoring pipeline hardening (round 3).** The ten AML/CTF monitoring
  workflows and their five Asana delivery streams:
  - **Egress lockdown completed — 10/10 on `block`.** The last two audit-mode
    jobs moved to harden-runner `egress-policy: block` with allowlists derived
    from their actual fetches: `anomaly-watch` (pure GitHub-API job) and
    `sanctions-screen` (Asana + OFAC/UN/EU/UK lists + Google News/GDELT +
    Wikidata + Interpol). A compromised dependency can no longer exfiltrate —
    any unlisted host fails loudly.
  - **Transient-failure retry on every delivery stream.** One shared policy
    (`asana-notify.mjs`): 429/5xx retried up to 3 attempts with exponential
    backoff, `Retry-After` honoured (capped 30s), other 4xx fail fast. Now used
    by the watch cards (sanctions/regulatory/advisor-eval), FATF watchdog,
    Daily Compliance Brief, governance report, the Node screener and the
    reconciliation reads — a rate-limit blip can no longer drop an alert or
    paint a control red. (`screen.py` already had this.)
  - **Re-run idempotency on alert cards.** `notifyAsana` and the watchdog's
    task creator now skip creation when an identical-name task already exists
    in the target project from the last 6 hours — a workflow re-run after a
    partial failure (e.g. the state commit failed after a successful post) can
    no longer file the same alert twice. Best-effort: if the check itself
    fails, the card still posts (losing an alert is worse than a rare
    duplicate). Pure logic unit-tested (`test/asana-notify.test.mjs`, in CI).
- **Workflow supply-chain hardening (post-audit).** From the full adversarial
  audit of all 38 GitHub Actions workflows:
  - **Egress lockdown** — the three internet-fetching jobs that hold
    `contents: write` (`onboarding-screen`, `weekly-adverse-media`,
    `regulatory-watch`) moved from harden-runner `egress-policy: audit` to
    **`block`** with explicit host allowlists derived from their actual fetch
    calls, closing the data-exfiltration path on the jobs that handle customer
    data. A missed host fails loudly, never silently.
  - **Script-injection class closed** — every `${{ steps.*.outputs.* }}` and
    free-text `${{ inputs.* }}` now crosses into `run:` shells via quoted `env:`
    (release, sanctions-watch, regulatory-watch, sanctions-screen,
    fatf-watchdog), and the watchers' `setOutput()` strips CR/LF and caps length
    before writing to `GITHUB_OUTPUT`, so a hostile value can neither become
    shell syntax nor forge extra step outputs.
  - **Function input gates completed** — all three Asana Netlify functions now
    reject non-JSON `Content-Type` (`415`) and oversized raw bodies (`413`
    before `JSON.parse`), matching the strictest of the three.
  - **Residual lockdown sweep** — the OWASP ZAP DAST image is pinned to an
    immutable `@sha256` digest; the pure-GitHub-API jobs (`stale`, `labeler`,
    `pr-size`) moved to egress `block`; and `visual.yml` was split so the
    everyday compare path runs read-only (write scopes only on the explicit
    baseline dispatch).
- **Screening fail-safes (no false all-clear).** The scheduled screening engine
  (`screen.py`, used by the onboarding + daily sweeps) now **refuses to run** —
  loudly, with a non-zero exit — when the Asana Customer Database read returns
  zero customers or when every core sanctions list (OFAC/UN/UK/EU/EOCN) fails to
  load. Previously such a run could post a green ✅ "all clear" for a customer
  base that was never actually screened; the manual `.mjs`/inline paths already
  had these guards, the active path now does too.
- **Pure-`'self'` Content-Security-Policy.** Removed `'unsafe-inline'` from both
  `script-src` and `style-src` and all third-party origins: page logic and CSS
  are external same-origin files (`app.js`/`app.css` + siblings), former inline
  `on*` handlers use event delegation, former inline styles use the CSSOM, and
  the Space Grotesk / JetBrains Mono / Manrope fonts are self-hosted under
  `assets/fonts/` (`fonts.css`). A `report-to`/`report-uri` sink
  ([`netlify/functions/csp-report.js`](netlify/functions/csp-report.js)) collects
  violations; `test/csp.test.mjs` + `test/csp-runtime.spec.mjs` guard against
  regressions (static + real-browser zero-violation checks).
- **Stricter linting.** Re-enabled `no-unused-vars`/`no-empty` and added the
  built-in injection-sink rules (`no-eval`, `no-implied-eval`, `no-new-func`,
  `no-script-url`); the app logic is now linted too.
- **Model validation.** Golden/regression set for the DPMS 0–30 scoring
  (`test/scoring-golden.test.js`) plus
  [`docs/governance/model-validation-2026.md`](docs/governance/model-validation-2026.md)
  with a quarterly MLRO sign-off log.
- **Disclosure → operational policy.** `SECURITY.md` gained a CVSS v3.1 severity
  matrix, remediation SLAs, evidence retention, and a blameless
  [post-incident template](docs/governance/incident-postmortem-template.md).
- **Tamper-evident log** appends are now serialised so concurrent events cannot
  lose an entry; **exports** carry a verifiable SHA-256 integrity envelope
  ([backup-recovery runbook](docs/governance/backup-recovery.md)).
- **Supply-chain provenance.** A CycloneDX SBOM
  ([`scripts/gen-sbom.mjs`](scripts/gen-sbom.mjs)) is generated in CI and
  attached to each release.
- **Test coverage.** Keyboard-only, print/PDF, mobile-viewport and runtime-CSP
  Playwright specs; a deterministic CSP guardrail; Lighthouse resource budgets.

### Added

- **Enterprise documentation package** (executive readiness follow-through):
  - **Executive layer** (`docs/executive/`) — brief, business value/ROI,
    regulatory-readiness pack (regulator-question → artefact map + EU AI Act
    positioning), roadmap, KPI dashboard spec.
  - **Model cards** (`docs/models/`) — one per AI/analytic feature (scoring
    engine, sanctions matcher, adverse-media classifier, PEP identifier, Advisor
    LLM, AI triage) on a fixed 14-field template, grounded in the code.
  - **Architecture diagrams** (`docs/architecture/`) — Mermaid set: system
    context, trust boundaries, risk-assessment swimlane, screening workflow,
    scoring decision flow, audit-trail flow, user journey.
  - **User/admin/API guides** (`docs/user-guides/`, `docs/api/`) — analyst,
    reviewer/MLRO and administrator guides plus the Netlify function contracts.
  - **Demo pack** (`docs/demo/`) — 10-minute demo script, four scenarios,
    fictional sample data.
  - **Independent enterprise-readiness review** (`docs/governance/enterprise-readiness-review-2026.md`)
    scoring the repo against ISO 42001, NIST AI RMF, EU AI Act, COSO, ISO 31000,
    FATF RBA, Wolfsberg and GDPR/PDPL.
  - **AI risk register reformatted to a 5×5 L×I model** with a residual heat map
    and three new rows (vendor failure, regulatory non-compliance, key-person
    dependency).
- **Adverse media to full strength (5 upgrades).**
  - **GDELT second source** — the daily engine (`screen.py`) now queries the
    GDELT DOC 2.0 global index (100+ languages, machine-translated) alongside
    Google News, so adverse coverage never depends on a single feed; a GDELT
    outage is logged, never silent.
  - **Arabic risk-term pass** — a dedicated AE:ar query using a curated Arabic
    keyword set (`ADVERSE_KEYWORDS_AR`, mapped to English equivalents so
    typology bucketing stays uniform) closes the recall gap where Arabic-only
    press never mentions the English terms.
  - **Committed evidence log** — every flagged headline (subject, source, URL,
    typology, date) is appended to `data/adverse-media-evidence.json`
    (400-day retention, committed by the screening workflows): an
    examiner-ready adverse-media history.
  - **Repeat-pattern escalation** — ≥3 distinct stories on the same subject
    inside 90 days is surfaced in the daily report (⚠ REPEAT ADVERSE-MEDIA
    PATTERN → EDD + STR assessment) and the run log.
  - **Sustained-degradation escalation** — a new `adverse_media` anomaly class
    (`monitoring.py`, >25% of subjects losing their adverse-media pass) feeds
    the existing Anomaly Watch: three consecutive degraded runs auto-open an
    MLRO issue, so a quiet feed outage can never hide.
  - **Quarterly methodology review, self-enforcing** — `quarterly-review.yml`
    files one Asana task per quarter (keywords, typologies, sources,
    thresholds, evidence-log sample, false-positive sample; two-week due date)
    in *Adverse Media & PEP Monitoring*; idempotent by quarter-unique title.
  - All pure logic unit-tested offline (12 new engine checks + 7 quarterly
    checks, wired into CI).
- **Daily AI Governance & Platform Report** (`governance-report.yml` +
  `scripts/governance-report.mjs`): one Asana task each morning in Ongoing
  Monitoring (section *AI & Platform Governance*) rolling up the latest state of
  the entire non-AML control suite — AI/advisor governance, security &
  supply-chain scans, CI/code quality, app/site health, release/repo hygiene
  (25 controls) — plus open code-scanning/Dependabot alert counts. Sibling of
  the Daily Compliance Brief: daily operating-effectiveness evidence for
  ISO/IEC 42001 A.6/A.8 and NIST AI RMF MEASURE/MANAGE. Scheduled controls that
  silently stop running are flagged **STALE** (the same "silence is never
  evidence" fail-safe as the screening engine); idempotent (one report per
  day); fully unit-tested offline (`test/governance-report.test.mjs`).
- **Assurance Coverage Matrix**
  ([`docs/governance/assurance-coverage-matrix.md`](docs/governance/assurance-coverage-matrix.md)):
  a single examiner-facing page mapping every claimed control to its automated
  proof (workflow/test), run frequency, and evidence location — plus a KPI
  catalog, the manual-assurance cadence (including a new **annual manual
  penetration test**), and an explicit known-gaps register so nothing is claimed
  without a verification path.
- **Asana integration — capability + hardening follow-up.** Building on the
  delivery-reliability audit ([`docs/asana-integration-audit.md`](docs/asana-integration-audit.md)):
  - **Native custom fields** — a completed assessment can populate real Asana
    custom fields (Reference / Risk Tier / Score / Next Review) via env-configured
    GIDs (`ASANA_CF_*`), applied best-effort so a bad GID never loses a delivery.
  - **External-ID idempotency** — each task is stamped with `external.gid = <ref>`
    and looked up by it (O(1)), a stable key that survives re-scores.
  - **Weekly reconciliation** — `scripts/asana-reconcile.mjs` + an Asana
    Reconciliation workflow diff the register mirror against live tasks (delivery
    gaps / orphans / mismatches / duplicates) and file a **PII-free** card, with a
    GitHub-issue fallback.
  - **Tokenised delivery mode** — a per-device toggle that keeps customer/staff
    PII on the device and sends Asana only reference, tier, score and dates.
  - **Register delivery-status chip** — each row shows `ASANA ✓ / ✗ / …`.
  - **429 auto-retry** with bounded backoff (5xx is never retried, so a create is
    never duplicated) and **`Content-Type` strictness** (non-JSON → `415`).
- **Progressive Web App (offline-capable):** a `manifest.webmanifest`, a
  network-first [service worker](sw.js) that precaches only the static app shell
  (never API responses or on-device risk data), and dependency-free PNG icons
  generated from the SVG (`scripts/gen-icons.mjs`). The three command-center
  screens install and run offline without changing the privacy posture.
- **Batch screening:** paste or upload a CSV of counterparties and score the
  whole list against the risk engine in one pass, exporting the results as CSV
  (in-app modal; pure helpers `batchParseCsv`/`scoreBatch`/`batchToCsv`).
- **UBO / ownership graph:** the principals field renders an at-a-glance
  beneficial-owner / controller / director graph in the sidebar.
- **Review scheduler:** the register summarises upcoming and overdue reviews
  (overdue flagged red, due-within-a-month amber) with at-a-glance counts.
- **Bilingual UI (English / العربية):** a language toggle with full RTL support
  across all three screens and JS-rendered content, persisted in `localStorage`
  (`hsra.lang`). Long-form legal/narrative report text intentionally stays
  English-only (the authoritative language for filed records) — see
  [`docs/i18n-ar-legal-review.md`](docs/i18n-ar-legal-review.md).
- **GLEIF LEI verification (opt-in):** confirm an organisation's Legal Entity
  Identifier, jurisdiction and registration status against the free GLEIF API
  (ISO 17442 / 7064 MOD 97-10 checksum; `scripts/lei-check.mjs`). A verification
  signal, never a risk hit — a non-match is "no LEI corroboration", not assurance.
- **Threat-intelligence enrichment (opt-in):** screen a subject against a
  STIX 2.1 bundle (OpenCTI / MISP / TAXII export) of threat-actors, intrusion-sets
  and identities (`scripts/threat-intel.mjs`); supplementary "must verify", never
  an authoritative designation.
- **Dependency-free XLSX reader** in `scripts/sanctions-match.mjs` (ZIP +
  sharedStrings + first-worksheet walk via `node:zlib`) plus a dedicated SECO
  XML parser, so the engine can ingest lists published only as `.xlsx` or in
  SECO's nested `<name>/<name-part>/<value>` shape. Both parsers are unit-tested.
  The Switzerland (SECO) and Australia (DFAT) sources are **configured but
  disabled** in `data/sanctions-extra.json`: a live screen showed SECO's `.xhtml`
  endpoint returns an HTML wrapper (0 names) and DFAT's file 404s to automated
  fetches (browser/bot-gated). They will be enabled once a verified
  machine-readable endpoint is confirmed on the runner — until then they stay off
  rather than leave the screen permanently flagged "degraded".
- **Cybersecurity Skills plugin:** pre-registers the Apache-2.0
  [Anthropic Cybersecurity Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills)
  library as a Claude Code plugin ([`.claude/settings.json`](.claude/settings.json));
  see [`docs/cybersecurity-skills.md`](docs/cybersecurity-skills.md) and the
  MITRE F3 typology mapping in [`docs/fraud-f3-mapping.md`](docs/fraud-f3-mapping.md).
- **Repository hardening (supply chain):** every GitHub Action is now pinned to a
  verified commit SHA (with a `# vX` comment so Dependabot still tracks updates);
  added an [OpenSSF Scorecard](.github/workflows/scorecard.yml) workflow and a
  `step-security/harden-runner` egress audit on all secret-bearing workflows.
- **Community-health files:** `LICENSE` (proprietary), `SECURITY.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `CITATION.cff`,
  `.github/CODEOWNERS`, a pull-request template, and issue templates
  (bug, feature, compliance review).

### Changed

- **"Regulations / Governance / Sanctions" merged into "Ongoing Monitoring".**
  The standalone watcher-alert project was consolidated: its 34 tasks moved into
  three new Ongoing Monitoring sections (*Regulatory changes* / *FATF list moves*
  / *Sanctions updates*) and the old project was removed. Every workflow and
  script that wrote to it (`sanctions-watch`, `regulatory-watch`, `fatf-watchdog`,
  `advisor-eval`, `daily-brief`, `asana-reconcile`, `sanctions-screen` alerts) now
  targets Ongoing Monitoring — via the `ASANA_REG_PROJECT_GID` /
  `ASANA_*_SECTION_GID` repo variables, with matching code defaults — so all
  monitoring output lives in one project. Comments and step names across the
  workflows/scripts were updated to the new project names.
- **Asana delivery target moved to the dedicated "HAWKEYE STERLING APP" project**
  (`1216203370612914`). The default project GID for the delivery functions and the
  scripts that default to the risk-assessments project (`asana-task`,
  `asana-mirror`, `risk-backup`, `asana-alert`, `asana-reconcile`, `fatf-watchdog`
  digest, `daily-brief`) now points there instead of the old per-entity Madison
  project. Set `ASANA_PROJECT_GID` in Netlify (functions) — and, if the GitHub
  Actions watchers should target it too, as the `ASANA_PROJECT_GID` repo variable.
- Dependabot now groups GitHub Actions updates into a single weekly PR.
- `codeql.yml` gained an explicit top-level least-privilege `permissions` block.

### Removed

- **"Monitoring Run Log" and "Transaction Monitoring Alerts" streams removed**
  from the Node screener (`scripts/sanctions-screen.mjs`): the per-run
  "Screening Run" log task, the auto-seeded ⚙ Transaction Monitoring alert
  template and their two auto-created Ongoing Monitoring sections no longer
  exist (the `ASANA_OM_LOG_SECTION_GID` override is gone with them). The daily
  Adverse Media & PEP audit task, the sanctions match alerts and the unified
  daily screen are unchanged — run evidence lives in the GitHub Actions run
  history and the Screening Daily Report section.

### Fixed

- **Deep bug hunt (2026-07-02):**
  - The re-run dedup window (was 48h) could silently suppress a *legitimate*
    next-day alert whose title repeats (daily watchers run 24h apart and titles
    like "Sanctions Watch — 1 list change" or the advisor regression alert are
    not date-stamped). Window reduced to **6h** — re-run idempotency preserved,
    daily alerts always survive; regression-tested.
  - The daily governance report classified a **failed** run that was also stale
    as ⚠ STALE (amber) instead of ❌ FAIL — staleness can no longer soften a red
    control; regression-tested.
  - The shared Asana client now retries **network-level** failures
    (reset/DNS/TLS) with the same bounded backoff as 429/5xx — previously only
    HTTP errors were retried and a single network blip killed the delivery.

- **Asana delivery reliability (source-level audit).** An adversarially-verified
  audit of the Asana integration ([`docs/asana-integration-audit.md`](docs/asana-integration-audit.md))
  found and fixed duplicate-task and lost-update paths and improved failure
  visibility:
  - **No more cross-device duplicates.** A completed assessment is now deduped in
    Asana by its stable **reference** (`findTaskByRef`), not by the whole task
    name — the name embeds the mutable outcome+score, so a re-scored assessment
    re-completed on another device used to create a second task.
  - **Transient failures no longer duplicate.** A failed task update only recreates
    on a genuine `404`; a `429`/`5xx`/auth failure now surfaces the status so the
    client retries the same reference instead of creating a duplicate.
  - **No lost updates.** The 60s dedup cache key now includes a hash of the
    notes + due date, so an edited re-submit is written through rather than masked
    by a stale cached result. Identical double-clicks still dedup.
  - **Delivery is auditable.** Every delivery outcome is recorded in the
    tamper-evident Activity Log (`asana.delivery.ok` / `asana.delivery.failed`),
    and the Retry control now surfaces and flushes **all** pending failed
    deliveries, not just the current assessment's.
  - **`asana-mirror` read surfaces token failure.** An expired token (`401`) now
    returns `401 "rotate ASANA_ACCESS_TOKEN"` instead of an empty-but-successful
    register that read as "no backups yet".
  - **Hardening.** Guarded created-task ids against malformed `2xx` bodies (clear
    error, not a masked `502`); capped the mirror's request body, item count and
    field lengths before normalization; and made `ensureSection` converge on a
    concurrent create instead of duplicating a section.

## [3.7.0] — 2026-06-26

Baseline release at the time this changelog was introduced. See the
[releases page](https://github.com/trex0092/HAWKEYE-STERLING-RA/releases) for
auto-generated notes on prior versions.

[Unreleased]: https://github.com/trex0092/HAWKEYE-STERLING-RA/compare/v3.7.0...HEAD
[3.7.0]: https://github.com/trex0092/HAWKEYE-STERLING-RA/releases/tag/v3.7.0
