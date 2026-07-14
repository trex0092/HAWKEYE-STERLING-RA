# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the application follows the `APP_VERSION` constant in [`app.js`](app.js).
Release tags and notes are also generated automatically by the
[Auto Release workflow](.github/workflows/auto-release.yml) on every version
bump merged to `main`.

## [Unreleased]

### Changed (alert hygiene — escalate on coverage loss, report recall narrowing, 2026-07-14)

- **`counts.errors` and the `adverse_media` sustained anomaly now key on
  ACTIONABLE coverage failures** — a subject with zero adverse coverage from
  any net (`am_blackout`: news dead AND watchlist missing) or an individual
  unscreened for PEP on both sources. A news-only loss while the deterministic
  OpenSanctions watchlist stands is a *recall degradation*: still loud in the
  MLRO report (module status `DEGRADED (news)`, §② status line) and in the
  persisted `am_errors` counter, but no longer an error or an escalation.
  Rationale (supervisory alert-hygiene, cf. ECB/DORA operational-resilience
  expectations): the watchlist is the compensating control, and an escalation
  issue that can re-raise forever on a mitigated, environmental condition —
  news feeds throttling shared CI egress — trains people to ignore the alarm
  that matters. A true blackout (the compensating control ALSO missing) still
  escalates, and pre-watchlist history keeps its own honest judgment via an
  `am_errors` fallback in `monitoring._anomaly_types`/`analyze_run`.
  Scorecard ≥ 9.0 runbook (from tracking issue #228) recorded in
  `docs/governance/scorecard-9.5-path.md` so the issues tab can stay at zero.

### Fixed (screening integrity — issue #222 root causes, 2026-07-14)

- **Run metrics counted only surviving subjects** — `counts.subjects` was
  incremented only for subjects whose adverse sweep did NOT error, so on the
  14 Jul news-feed outage the denominator collapsed to 42 while the numerators
  covered the near-full book, printing impossible ratios ("error rate 2931%",
  "adverse-media errors 795/42 (1893%)"). The new pure `tally_enrichment`
  counts **every attempted subject** in `subjects` and each subject **at most
  once** in `errors` (a both-feeds failure is one degraded subject, not two
  errors — the old sum reached 1231 errors for 837 subjects), so
  `error_rate ≤ 100%` by construction and the anomaly thresholds compare true
  fractions of the book. Report header and §⑤ now show the honest counts, and
  new detail counters (`am_blackout`, `pep_errors`, `pep_mirror`, `watchlist`)
  persist per run. Semantics documented in `docs/aims/runtime-monitoring.md`.
- **PEP screening could silently zero out** — the live Wikidata lookup ran
  with no pacing and no circuit breaker: 8 workers burst the API from one
  shared runner IP, 436 lookups errored and the day's PEP count fell 4 → 0.
  `check_pep` now paces through a run-global adaptive rate gate (mirror of the
  Google News gate), opens a circuit after `PEP_BREAKER_AFTER` consecutive
  failures, sends the Wikimedia-policy User-Agent (tool + repo contact), and
  — when lookups still errored after the pool — the affected individuals are
  re-covered in one bulk pass against the **OpenSanctions consolidated PEP
  dataset** (`load_pep_mirror` / `pep_mirror_lookup`, exact-normalized index),
  provenance-marked "mirror" with the OpenSanctions entity URL as evidence.
  Kill-switch `PEP_MIRROR_FALLBACK=0`; licensing registered in
  `docs/aims/third-party-register.md` (bulk data is CC-BY-NC 4.0).
- **A news blackout meant ZERO adverse coverage** — when Google News and GDELT
  both refused the runner (10–14 Jul), 795/837 subjects finished with no
  adverse screening at all. The engine now runs a deterministic third net
  BEFORE the news sweep: the **OpenSanctions crime watchlist** (national
  wanted lists / enforcement actions), one bulk download matched locally with
  the exact sanctions matcher and thresholds. Findings are article-shaped
  with deterministic titles (delta-stable: NEW once, then STANDING), carry
  the entity URL as evidence, are excluded from the ≥3-stories/90d
  repeat-pattern counter (standing list presence is not a news story), and a
  news outage now reads "news recall narrowed — watchlist stood" instead of
  a blackout (`am_blackout` only counts subjects no net could screen).
  Kill-switch `ADVERSE_WATCHLIST=0`.
- **Onboarding snapshots poisoned the daily baselines** — `persist_run`
  dedups history by date, so a 2-subject onboarding snapshot could REPLACE
  the same day's full daily batch and drag `median_subjects` to 46.
  `monitor_run` gained `persist=` and onboarding runs no longer write
  history (they keep the absolute checks; sustained detection is the daily
  batch's job).
- **State-branch force-push race** — `weekly-adverse-media.yml` and
  `onboarding-screen.yml` both rebuild `screen-delta-state` as `<main>` + one
  data commit under DIFFERENT concurrency groups; an overlap could drop the
  other's just-persisted `run-metrics.json` (the exact file anomaly-watch
  reads). Both jobs now share one `screen-state` concurrency group
  (repo-wide, cross-workflow) — guarded by a new drift check in
  `test/screening-state.test.mjs`.
- **Alerts that never clear** — `anomaly-watch.yml` now posts a "cleared"
  comment and closes the escalation issue once the last-3-run window is
  clean (a missing/stale history reads as escalate, so the close path can
  never fire on a dead pipeline), and `link-check.yml` closes its tracking
  issue when every link resolves (both also honour `workflow_dispatch`, so a
  fix can be verified same-day). `mode=LLM` in the run log/report no longer
  overstates AI usage when the key is present but triage is gated off —
  the label now reads "LLM-standby (triage off)" (`_ai_mode_label`).

### Fixed (dead citations — issue #225, 2026-07-14)

- The five "dead" links split three ways, none a rotted citation: the UAE
  Ministry of Economy hosts (`moec.gov.ae`, `moet.gov.ae`) **block all
  datacenter/CI connections** — the canonical pages are live in a browser, so
  `scripts/link-check.mjs` gained a documented `ALLOWLIST_HOSTS` (skipped at
  probe time, never counted dead; `data/reg-sources.json` keeps `moet.gov.ae`
  as the watched source via its Internet Archive fallback); the truncated
  `www.moec.gov` in an older changelog entry is now written scheme-less so
  the checker never re-probes the known-bad URL that entry documents; the two
  deep `moet.gov.ae` research citations carry an explicit fetch note (no
  verifiable Wayback capture was reachable from the fix environment).
- `ci/osv-scanner.toml` (new): justified, documented suppression of
  PYSEC-2026-2132 / CVE-2026-7246 (`click==8.1.8` in the semgrep CI venv) —
  not remediable by upgrade (semgrep, incl. latest 1.169.0, pins
  `click~=8.1.8`) and the vulnerable `click.edit()` interactive-editor path
  is unreachable in the non-interactive CI job. Auto-heals via Dependabot
  the moment semgrep unpins. Scorecard arithmetic + the honest path to ≥9.5
  documented in `docs/governance/scorecard-9.5-path.md`;
  `docs/governance/github-repository-hardening.md` §1 now matches the LIVE
  single-maintainer branch-protection settings instead of claiming
  approvals ≥ 1.

### Fixed (screening ops — issue #222 disposition)

- **Anomaly-watch read a frozen metrics copy** — the runtime monitor read
  `data/run-metrics.json` from `main`, but the engine has persisted it on the
  `screen-delta-state` branch since `main` became push-protected; the copy on
  `main` froze at 2026-07-05 and the staleness heartbeat escalated a false
  "dead pipeline / dead cron" (issue #222) while the daily sweep was green.
  `anomaly-watch.yml` now overlays the state branch before detecting (missing
  branch = clean bootstrap fallback; failed fetch reds the job rather than
  silently regressing to stale data).
- **OFAC SDN and UN Consolidated silently screened empty** — both endpoints
  serve their files via 302 to presigned storage URLs
  (`wc2h-sls-prod-public-published.s3.us-gov-west-1.amazonaws.com` /
  `unsolprodfiles.blob.core.windows.net`); the egress-blocked screening jobs
  refused the redirect at connect time, so both core lists loaded ZERO names
  and every run reported *Sanctions DEGRADED*. The storage hosts are now
  allowlisted in `weekly-adverse-media.yml`, `onboarding-screen.yml` and
  `sanctions-screen.yml` (matching `sanctions-watch.yml`), and `screen.py`
  falls back to the OpenSanctions mirrors (`us_ofac_sdn` / `un_sc_sanctions`,
  same host that already serves EU FSF) with explicit MIRROR provenance when
  a primary yields nothing.
- **Adverse-media recall collapse under rate-limiting** — the 14-locale ×
  16-worker worldwide sweep tripped Google News' per-IP limiter (10–12 Jul:
  805/838 subjects at zero coverage, raised as `am_errors`), and a throttled
  feed was retried with zero delay (the polite pacing only ran on successes),
  keeping the limiter tripped all run; GDELT, connection-throttled from
  runner IPs, cost every subject a 20-second timeout. Defaults return to the
  proven 5 locales × 8 workers; every fetch is paced (success or failure); a
  subject whose first 4 fetches all fail transport-level stops hammering the
  feed (still degrading loudly unless GDELT covered it); and a run-level
  GDELT circuit breaker (`GDELT_BREAKER_AFTER`, default 5 consecutive hard
  failures) skips the feed for the rest of the run with one loud log line.
- **Drift guard** (`test/screening-state.test.mjs`) — asserts the state
  readers/writers all point at `screen-delta-state` and that every workflow
  allowlisting an OFAC/UN primary also allowlists its presigned storage
  host, so neither failure class can silently return.

### Added (security ops)

- **History scrub runbook** (`docs/security/history-scrub-runbook.md`) —
  owner-executable `git filter-repo` procedure that removes the
  pre-redaction data (screening-subject records, former firm name) from git
  history. Written so the document itself never contains a removed string:
  the scrub list is generated from the old history at execution time. Also
  records what a rewrite cannot fix (live state branches, old deploy
  permalinks, GitHub object cache) and the private-repo alternative.

### Added (container distribution)

- **Self-hosting container image** — `Dockerfile` (static-web-server base,
  pinned by multi-arch index digest) packages the client runtime set only;
  `publish-container.yml` builds, pushes to GHCR and provenance-attests the
  image on every release (blocked egress, GitHub-only endpoints, job-scoped
  write). Documented under *Setup → Self-host (container)* in `README.md`.
  Scorecard: the Packaging check now counts instead of being excluded.

### Changed (container distribution)

- **OpenSSF Best Practices evidence pack corrected** — `floss_license` is a
  passing-level MUST, so a proprietary project holds an *in-progress* entry
  (2/10 on CII-Best-Practices), not *passing*; the doc previously overstated
  this. Licensing decision recorded: proprietary stays (2026-07-11).

### Added (perfection pass)

- **Meta descriptions on all three screens** — the one recurring sub-100
  Lighthouse metric (SEO 90) was the missing `meta description`; index,
  console and advisor now carry one (head-only, rendering unchanged).
- **Release provenance backfill workflow**
  (`release-provenance-backfill.yml`, manual-only, idempotent) — copies the
  existing Sigstore bundle of pre-`.intoto.jsonl` releases (v3.7.1) to the
  conventional provenance name, so every release in the Scorecard window is
  self-contained (Signed-Releases → 10).
- **OpenSSF Best Practices evidence pack**
  (`docs/governance/openssf-best-practices.md`) — maps every passing-level
  criterion to in-repo evidence so the owner's badge registration (the last
  Scorecard point requiring a human) is a copy-through.

### Added (scorecard follow-through)

- **Fuzzing the Scorecard detector actually sees.** New fast-check property
  suite `test/property-fuzz.test.js` (in ci.yml's `fuzz` job) fuzzes the two
  CommonJS security primitives behind every function call: the per-IP rate
  limiter (exact quota per window, per-IP isolation, spoofable-header
  fail-closed bucket, well-formed 429s) and the shared-token gate (off ⇒
  open, token mode gates the no-Origin path by exact match, strict mode
  ignores Origin). fast-check joins the lockfile-pinned toolchain; the
  hypothesis suite stays (Scorecard's Python detector only counts atheris,
  but the properties are valuable regardless).
- **Release provenance under its conventional name.** Both release workflows
  now also attach the Sigstore bundle as
  `hawkeye-sterling-ra-<v>.intoto.jsonl` (Scorecard's Signed-Releases
  provenance suffix) beside the `.sigstore` signature copy.

### Added (label taxonomy)

- **Full label taxonomy.** `settings.yml` now declares 32 labels: the
  issue-triage set the issue templates already referenced but that was never
  defined (`bug`, `enhancement`, `triage`, `review` — template auto-labelling
  silently failed without them — plus `question`, `duplicate`, `wontfix`) and
  a domain set (`engine`, `screening`, `advisor`, `governance`, `a11y`,
  `i18n`, `pwa`, `design`, `release`, `config`). `labeler.yml` grows matching
  path rules (20 auto-applied labels, incl. `security` and a `compliance`
  rule scoped to the firm-approved risk-baseline data files), and label-sync
  reconciles everything on merge.

### Added / hardened (brand purge + supply-chain scoring) — v3.7.1

- **Brand initialism fully purged.** The former entity's initialism is gone
  from the tree: the production form-field class is now `.hs` (markup + CSS —
  rendering unchanged, verified against the committed visual baselines), the
  screening engine's User-Agent reads `HawkeyeSterlingCompliance/3.0`, design
  handoff assets are renamed `hs-*` (storage keys `hs_ra_*`, consts `HS_DARK_*`),
  and test labels no longer use the old shorthand. A new **brand guardrail**
  (`test/brand-guard.test.mjs`, wired into ci.yml) fails CI if any spacing/
  casing/concatenation variant of the former name ever reappears.
- **OpenSSF Scorecard hardening.**
  - *Token-Permissions*: all nine workflows that carried top-level
    `contents: write` now declare top-level `contents: read` and elevate at
    job level only (auto-release, branch-cleanup, fatf-watchdog,
    onboarding-screen, regulatory-watch, release, sanctions-screen,
    sanctions-watch, weekly-adverse-media).
  - *Pinned-Dependencies*: the semgrep and zizmor CI tools are now installed
    `--require-hashes` from `ci/semgrep-requirements.txt` /
    `ci/zizmor-requirements.txt` (pip-compile hash locks).
  - *Fuzzing*: new property-based suite `test/fuzz_properties.py`
    (hypothesis, derandomized) fuzzes the text-normalisation layer that
    fronts every sanctions/adverse-media match — normalize/_latin_fold/
    _normalize_ar/match_adverse_keywords/sha256_of invariants over arbitrary
    unicode; hypothesis is hash-locked into `ci/requirements.txt`.
  - *Signed-Releases*: release workflows now attach the Sigstore provenance
    bundle (`hawkeye-sterling-ra-<v>.sigstore`) beside the tarball + SBOM so
    releases are self-contained and machine-verifiable.
- **Security: `@playwright/test` 1.49.1 → 1.61.1** (dev-only toolchain;
  supersedes the Dependabot security PR that grouped `playwright` +
  `@playwright/test`). Visual baselines will be refreshed via the Visual
  Regression workflow's baseline mode after merge; the compare job is
  non-blocking by design.
- **APP_VERSION 3.7.1** (package.json / pyproject.toml / CITATION.cff synced;
  auto-release cuts `v3.7.1` with the new signed assets on merge).

### Added / changed (repo professionalization)

- **Committed npm toolchain.** New root `package.json` + `package-lock.json`
  pin the dev/CI tools exactly (`eslint 9.39.5`, `htmlhint 1.9.2`,
  `@playwright/test 1.49.1`, `@axe-core/playwright` / `axe-core 4.12.1` — the
  axe pair previously floated to latest in CI) and add npm scripts
  (`npm test` / `lint` / `lint:html` / `test:visual` / `test:e2e` / `sbom`).
  The app still ships **zero runtime npm dependencies**; lint/visual/
  cross-browser workflows now restore the toolchain with `npm ci`, pa11y is
  exact-pinned in `a11y.yml` (kept out of package.json so its puppeteer
  Chrome download can't break the blocked-egress lint job), and the SBOM
  generator reads package.json as its source of truth. New `npm`
  dependabot ecosystem keeps the toolchain patched (Playwright held to
  patch bumps to protect the committed visual baselines).
- **Version-sync guard.** `test/changelog.test.mjs` now asserts
  `package.json`, `pyproject.toml` and `CITATION.cff` carry the same version
  as `APP_VERSION` in `app.js` (the release tag source).
- **Contributor/editor hygiene.** New `.editorconfig`, `.gitattributes`
  (binary marks + linguist-generated for the corpus, baselines, design
  handoff and lockfile), `.nvmrc` (Node 22, same as CI) and a metadata-only
  `pyproject.toml` (Python runtime pins stay hash-locked in
  `ci/requirements.txt`).
- **README: table of contents + screenshots** of the three screens
  (`docs/screenshots/`), and npm-script instructions in README/CONTRIBUTING.
- **Personal data removed from the committed tree.** The screening-state
  seeds on `main` (`data/sanctions-screen-state.json`,
  `data/screen-delta-state.json`) are reset to empty baselines — the live
  state stays on the dedicated data branches the workflows already use — and
  test fixtures/comments now use fictional subject names.
- **Brand unification.** Internal legal-entity naming replaced with the
  public **Hawkeye Sterling** brand across engine headers, workflows, docs
  and test fixtures.

### Added / hardened (deep-test follow-up)

- **Corporate owners now get the adverse-media sweep.** `screen.py` sanctions-
  screened `entity_owners` (50%/control rule) but excluded them from the
  enrichment loop, so a designated parent's media coverage was never seen; they
  now join the sweep as `ENTITY (owner)` subjects (no PEP check — PEP status is
  a natural-person concept).
- **Deep-mode platform-timeout handling.** Netlify synchronous functions
  default to a ~10 s execution cap that only Netlify support can raise;
  Deep-mode Advisor calls can exceed it, and the resulting non-JSON 502 used to
  render as a misleading "check ANTHROPIC_API_KEY" error. The Advisor now
  detects the platform kill and says so (suggesting Balanced/Speed or the
  timeout raise); the constraint is documented in `.env.example`.
- **Cross-browser smoke now fails on `console.error` too**, not just uncaught
  exceptions — broken-but-caught code paths (failed asset decode, bad JSON) no
  longer ship silently. Service-worker registration noise on `file://` is
  excluded.
- **Sanctions Watch streak logic extracted and unit-tested.**
  `trackErrorStreaks` is now an exported pure function with tests covering
  threshold crossing, reset-on-success, the below-threshold case, and the
  unreachable entry shape the notifier depends on — this was the one alerting
  path with no test (and where the "dead list reported as changed" bug hid).
- **Small hardenings:** the AM/PEP same-day dedup now matches the date with
  boundaries ("9 Jul 2026" no longer matches inside "19 Jul 2026");
  `parse_uk`'s no-title-row fallback can no longer show a CSV column header as
  the list date; `countEntries` no longer subtracts a phantom header row for
  the headerless OFAC `sdn.csv` (registry gains `noHeader: true`).

### Fixed

- **Deep-test sweep — 23 defects fixed across every layer** (five parallel
  adversarial reviews of the app, engine, scripts and functions; every finding
  reproduced before fixing):
  - **Screening engine (`screen.py`)** — non-Latin adverse-media matching was
    case-sensitive (capitalized/all-caps Cyrillic & Greek headlines never
    matched; Turkish all-caps missed via dotless-ı casing) — now matched on the
    lower-cased headline with a diacritic-folded fallback; delta keys collapsed
    to one identical fingerprint for ALL unscreenable non-Latin subjects, so
    the 2nd+ such customer was born "standing" and never opened an MLRO case —
    empty normalizations now fall back to a hash of the NFC name; the daily
    narrative aborted (discarding sanctions results, posting nothing) when one
    subject's adverse-media sweep fully failed — now degrades loudly per
    subject; the `full_batch` path could post a green ✅ all-clear with zero
    loaded sanctions lists — the same FATAL fail-safe as `load_all_lists` now
    applies.
  - **R-09 coverage alarm was inert in production** — `data/source-coverage-state.json`
    was never restored from or committed to the `screen-delta-state` branch, so
    every run started with empty history and a silently-shrunk list could never
    alarm. Both screening workflows now persist it.
  - **QA gate false-failed forever on manual-review PEPs** — the designed
    no-Wikidata-id hand-off for non-Latin names was reported as a missing-source
    integrity violation on every run; the `review` flag now propagates and is
    exempt.
  - **Case lifecycle: carried-forward matches were auto-cleared** — a standing
    match kept when it could NOT be re-verified (enrichment error, failed list
    download, subject error) retained a stale `lastSeen`, so the case planner
    completed its Asana case with a false "not flagged" comment (and a cleared
    case never re-opens). Carry-forwards now read as still-active; regression
    tests added.
  - **Sanctions Watch reported a dead list as "content changed"** — persistent
    failure entries lacked `status`/`detail`, so the Asana card told the MLRO
    a designation list changed when it was actually unmonitored. Now rendered
    as unreachable with the streak, like Regulatory Watch.
  - **Regulatory Watch `state_dirty` was permanently true** — an unchanged
    direct fetch advances `contentAsOf` daily and the materiality projection
    didn't strip it; it does now (regression-tested).
  - **Bias eval scored API failures as levels** — a total outage exited green
    ("no unexplained divergences" without one model response) and a one-sided
    failure emitted a false bias finding; evaluation errors now fail the run
    distinctly as INCOMPLETE.
  - **Tokenised-delivery privacy (app)** — the "🔒 Asana: tokenise (no PII)"
    opt-in silently reset after every lock/unlock or reload on an encrypted
    device (key missing from `SECURE_KEYS`), and the register mirror ignored
    the opt-in entirely, shipping every entity's legal name/jurisdiction/
    activity to Asana on autosave. Both paths now honour it.
  - **RA reference burn** — every page load of a locked encrypted device
    permanently consumed one `RA-YYYYMMDD-NNN` sequence number; allocation is
    now skipped while the gate is up.
  - **Advisor race** — a slow Deep-mode response could land after a newer
    question (or after "Ask another") and render Q1's answer under Q2's
    heading; requests are now sequenced and stale responses dropped. Corrupt
    (valid-JSON-but-wrong-shape) telemetry in localStorage no longer leaves
    the Ask tab blank and dead.
  - **Persona routing** — 11 of 16 advisor personas silently fell back to the
    generic Sterling system prompt while the UI displayed the chosen
    specialist; all 16 now have server-side suffixes and Ember's suffix matches
    its UI role (PEP & adverse media).
  - **Asana functions** — a transient (429/5xx) failure updating the
    auto-backup mirror tasks created duplicates (`risk-backup`, `asana-mirror`;
    same bug class previously fixed in `asana-task`) — recreate now only on a
    genuine 404; a malformed mirror payload (e.g. `[null]`) returned 502
    "asana unreachable" instead of a 400.
  - **Strict-token mode was unusable from the browser** — the documented
    `<meta name="hsra-app-token">` mechanism didn't exist in any HTML/JS; the
    meta tag now ships on all three screens, all function calls attach
    `X-App-Token` when it is filled (the register mirror switches from
    sendBeacon to keepalive fetch to carry it), and CORS allows the header.
  - **Python modules** — `ai.py` prompt-injection screening skipped the RSS
    `date` field (now screened + wrapped) and `_ascii_fold` fragmented Turkish
    dotless-ı names ("Kılıç" → "k l c"; now folds to "kilic"); `txn_monitor.py`
    gained the two documented-but-missing typologies (CDD-trigger ≥ AED 15,000
    and repeated round-amount cash); `monitoring.py` runtime medians now always
    carry the seconds unit; `kyc.py` flags a document expiring today as
    expired.

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

- **Governance pack completion (2026-07-07)** — closes the gaps a full corpus
  audit (all 50+ governance/AIMS/model docs) found against ISO/IEC 42001, the EU
  AI Act, and lifecycle coverage:
  - **Internal Audit Programme** (`docs/aims/internal-audit.md`, ISO 42001 §9.2) —
    the missing leg of the 9.1→9.2→9.3→10.2 Check-Act loop: criteria, three-tier
    schedule (continuous automated evidence / quarterly thematic / annual
    full-system), single-maintainer independence handling (automated-evidence
    primacy, MLRO judgement, external-audit option), clause-by-clause checklist,
    findings loop into the CAPA log and management review.
  - **EU AI Act assessment** (`docs/governance/eu-ai-act-assessment-2026.md`) —
    deepens the one-line crosswalk classification into a full article-level
    assessment: territorial scope (voluntary benchmark today), provider/deployer
    role analysis incl. Anthropic as GPAI provider, honest Art. 5 and Annex III
    sweeps, Art. 50 transparency evidence (the CI-asserted on-screen notice),
    an **Art. 4 AI-literacy provision** per role recorded in competency-records,
    and **Art. 73-equivalent serious-incident clocks** wired into the incident
    runbook and mapped to the binding UAE duties (goAML/EOCN, PDPL breach).
  - **Decommissioning & retirement procedure** (`docs/aims/decommissioning.md`,
    ISO 42001 A.6 lifecycle end) — records-first archival (10-year AML retention
    survives the system), dependency-ordered switch-off incl. a self-destructing
    service worker so retired PWA clients don't boot from cache forever, key
    revocation walked from `.env.example`, vendor exit, register updates, and a
    verification checklist.
  - **Governance pack index** (`docs/governance/README.md`) — the 24-document
    pack was the only one without an index; rescues the orphaned
    `pqc-readiness.md` and `backup-recovery.md`, groups the corpus by function
    with framework refs, and is linked (with the AIMS and model-card indexes)
    from the root README. `docs/aims/README.md` gains the three missing rows
    (Anthropic DPA pack, internal audit, decommissioning).
- **Code-scanning triage executed (CA-13)** — all 46 open alerts dispositioned
  ([record](docs/security/code-scanning-triage-2026-07.md)): **10 fixed in
  code** (backslash escaping in the markdown-cell sanitizer, script/style
  end-tag regexes, two unclosed file handles in `screen.py`, dead guard in
  `lei-check.mjs`, unused locals/imports — the rapidfuzz availability probe now
  uses `importlib.util.find_spec`), **6 scoped out** via a justified CodeQL
  `paths-ignore` for `design/` mockups and `test/` fixtures, and **30
  classified for dismissal-with-reason** (by-design Scorecard posture on the
  state-committing workflows, watcher-pipeline data flows, two non-exploitable
  single-writer TOCTOU warnings). All 42 node tests + Python suites green after
  the fixes.
- **CBUAE April-2026 framework update — impact assessment**
  (`docs/research/2026-07-cbuae-april-2026-update.md`): the five communicated
  changes (standalone Proliferation Financing risk area, TBML/correspondent
  focus, continuous tech-driven transaction monitoring, FATF 5th-round Mutual
  Evaluation, inspection-readiness) mapped to this system's controls, with
  provenance caveats (primary text pending via the `uae-cbuae` reg-watch
  source) and four owned actions — incl. the **standalone PF risk assessment**
  (new gap, added to the management-review first-cycle prep) and a raised
  priority on the R-13 transaction-feed decision. Plus a global
  **AML regulators & FIUs reference directory**
  (`docs/research/aml-regulators-directory.md`) for counterparty/cross-border
  orientation, UAE bodies mapped to the watched sources.
- **Repo-hygiene & triage utilities** (both manual-only, least-privilege,
  egress-blocked to the GitHub API): `branch-cleanup.yml` deletes the 39
  verified squash-merged stale branches from issue #190 (dry-run by default;
  literal `DELETE` confirm to act; idempotent), and `alert-inventory.yml`
  enumerates every open code-scanning alert (tool, rule, severity, location)
  to the job summary — the triage list for CAPA CA-13 that the daily
  governance report only counts.
- **Schedule punctuality: all crons moved off the top of the hour.** Measured
  against fire times, GitHub's best-effort cron was running the daily
  compliance schedules 2–5 h late (e.g. Daily Screening 00:00→03:41, Daily
  Brief 07:00→11:39) — `:00` is the platform's most congested, most-delayed
  slot. All 18 top-of-hour schedules now fire at distinct odd minutes in the
  same hour (ordering preserved: screening → watchers → brief → governance
  report → freshness). This follows GitHub's own guidance and reduces —
  but cannot contractually eliminate — schedule drift; guaranteed-time
  execution would require an external dispatcher (documented option).
- **Tier-3 shared-secret gate armed** (`APP_SHARED_TOKEN` set in the Netlify
  environment). The gate ships in `_auth.js` but was dormant; with it armed, a
  request with no browser Origin (curl/bot) must present `X-App-Token`, closing
  the omit-Origin bypass of the origin allow-list. The repo's own six
  server-side callers (netlify-deploy / asana-delivery-diag verify curls,
  function-health probes) now send the site's own `Origin` header — the
  origin-guarded front door — so they work identically whether or not the gate
  is armed and need no GitHub-side secret. Takes live effect on the next
  production deploy (functions snapshot env at deploy time).
- **Branch-protection drift guard** (`test/protection-contexts.test.mjs`, in CI) —
  locks out both merge-deadlock classes fixed on 2026-07-07: every required
  status context in `.github/settings.yml` must equal a check name some workflow
  job actually reports (name mismatch → "Expected" forever), and every workflow
  carrying a required job must trigger on `pull_request` without a
  `paths`/`paths-ignore` filter (path-gated required check → non-matching PRs can
  never merge). Negative-tested against both regression classes.
- **Regression-proofing tests & gates (QA audit, 2026-07-07):**
  - **HTML asset-integrity test** (`test/asset-integrity.test.mjs`, in CI) — asserts
    every `href`/`src`, manifest icon, `sw.js` precache entry, `fonts.css` face and
    stylesheet `url()` on the three screens resolves to a shipped file, so a renamed
    or deleted asset can no longer 404 in production unnoticed.
  - **CI coverage drift guard** (`test/ci-coverage.test.mjs`, in CI) — fails if any
    `test/*.test.*` or `test/*.py` is not wired into `ci.yml`, or any `*.spec.mjs`
    is not matched by a Playwright config; new tests can no longer be silently
    orphaned in this no-runner repo.
  - **Wider link-check coverage** — `link-check.mjs` now also scans the top-level
    docs (README, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, SUPPORT, CHANGELOG), so
    a rotted README badge/link is caught too. Loopback and reserved-example
    placeholders (the README's `localhost:8000` quick-start) are skipped via a new
    `isProbeable()` helper so they aren't mis-reported as dead; unit-tested.
  - **Accessibility gate is now blocking** — the pa11y WCAG 2.1 AA audit
    (`a11y.yml`) drops `continue-on-error`; the three screens are clean, so a new
    violation fails the gate instead of merging silently.
- **Hash-locked Python dependencies** — `ci/requirements.txt` is now compiled from
  a new `ci/requirements.in` with `pip-compile --generate-hashes` (full transitive
  tree, sha256 for every artifact), and the three screening workflows install with
  `pip install --require-hashes`. A yanked-and-republished or tampered PyPI package
  at the same version can no longer be installed into the mandatory-daily screen.
  Verified with a clean `--require-hashes` install in a fresh venv.
- **Optional shared-secret endpoint gate** (`netlify/functions/_auth.js`, env
  `APP_SHARED_TOKEN`) — defence in depth for the Netlify functions. Unset by
  default (behaviour unchanged); when set, a request carrying no browser `Origin`
  (curl / server-to-server — the path that otherwise bypasses the origin guard)
  must present a matching `X-App-Token` header. The browser path stays gated by
  `Origin` (a static app cannot hold a secret). Wired into asana-task/asana-mirror/
  risk-backup/brain-soul with six regression tests; documented in `.env.example`
  and the Asana integration audit (supersedes the deferred B1 note).
- **AI-governance & cyber-financial-crime reference content** (Advisor knowledge
  expansion, `assets/super-data.js`):
  - **EU AI Act Q&A** — added to the "AI Governance, Cybersecurity & Data
    Protection" group: the four-tier classification (with the Annex III
    financial-fraud-detection carve-out for AML monitoring), the responsible-AI
    four-step adoption framework (Qualify → Classify → Risk-assess → Mitigate),
    and the transparency / human-oversight obligations (AI Act Art. 14 & 50).
  - **"Cybersecurity Terms (AML Context)" glossary group** — ten terms
    (Ransomware, BEC/phishing, deepfake & synthetic-identity fraud, threat
    intelligence, Zero Trust, SIEM, SOAR, SBOM/supply-chain, DLP/DSPM, prompt
    injection & agentic-AI risk), each defined *and* tied to why it matters to an
    MLRO, with citations.
  - **"AI Act Classifier" Super Tool** — a deterministic playbook that tiers an
    AI use under the AI Act and maps the resulting obligations, feeding the AI
    asset register (`data/ai-assets.json`).
  - **Post-Quantum readiness** — one "harvest-now-decrypt-later" Q&A plus
    [`docs/governance/pqc-readiness.md`](docs/governance/pqc-readiness.md): a
    crypto-agility watch item scoping this tool's (low) quantum exposure.
  - **Security tooling reference** — [`docs/security/tooling-reference.md`](docs/security/tooling-reference.md)
    honestly maps common free security tools to this repo's real attack surface
    (what is already in CI vs. what is not applicable to a static-site +
    serverless app).
  - The Advisor full-surface smoke test counts were updated to 60 groups / 350
    Q&A subjects / 187 tools (`test/advisor-smoke.test.js`).
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

- **Stale governance claims corrected (2026-07-07).** The gap-analysis note
  saying "BIAS testing and the DPIA remain open" now records both as closed
  (advisor-bias-review + CI recall-parity test; dpia-2026.md), and the
  assurance-coverage-matrix known-gaps row for "await ratification signatures"
  records the 2026-07-02 ratification of the AI Policy and Stakeholder Impact
  Assessment. Docs must never claim a gap that reality has closed — or vice versa.
- **Required-check deadlock on non-code PRs.** `Dependency Review` and the
  Cross-Browser `smoke` job are REQUIRED statuses in branch protection but were
  path-gated, so any PR that touched only docs/tests/workflows waited on them
  forever ("Expected — waiting for status to be reported") and could never
  merge. Both now run on every pull request: dependency-review passes in
  seconds on an empty manifest diff, and the smoke always exercises the three
  committed screens, so the always-run is cheap and meaningful. The push
  trigger keeps its paths filter (nothing gates on push).
- **Required-context name mismatch.** Branch protection requires the status
  context `Dependency Review`, but the workflow's job reported its check as the
  job id (`review`), so the required slot stayed "Expected" even after the
  workflow passed. The job now carries `name: Dependency Review`, and
  `settings.yml` documents that each required context must equal the reporting
  job's display name.
- **Unmergeable-by-design review rule on a single-maintainer repo.**
  `settings.yml` required 1 approving review plus a code-owner review with
  `enforce_admins: true` — but GitHub never counts the PR author's own
  approval, and the sole code owner IS the only human with write access, so
  every owner-authored PR was permanently blocked with no admin bypass.
  Config-as-code now sets `required_approving_review_count: 0` and
  `require_code_owner_reviews: false` with the rationale inline (the binding
  controls are the required status checks); raise both back when a second
  maintainer joins. The live rule must be mirrored by hand in Settings →
  Branches if the Settings app is not installed.
- **QA audit (2026-07-07):** Corrected a truncated citation URL in
  `docs/research/auto/REG-UPDATE-2026-06-30.md` — the UAE Ministry of Economy AML
  page was cited with the truncated domain `www.moec.gov` (does not resolve;
  written scheme-less here so the link checker never re-probes the known-bad
  truncation this entry documents). Restored the canonical
  `https://www.moec.gov.ae/en/anti-money-laundering` already used in
  `data/reg-sources.json` and every sibling reg-watch doc, clearing the sole dead
  link the citation-health gate reported.
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
