# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the application follows the `APP_VERSION` constant in [`app.js`](app.js).
Release tags and notes are also generated automatically by the
[Auto Release workflow](.github/workflows/auto-release.yml) on every version
bump merged to `main`.

## [Unreleased]

### Security & hardening

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

- Dependabot now groups GitHub Actions updates into a single weekly PR.
- `codeql.yml` gained an explicit top-level least-privilege `permissions` block.

### Fixed

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
