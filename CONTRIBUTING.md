# Contributing to Hawkeye Sterling — Entity Risk Assessment (RA)

Thank you for helping improve Hawkeye Sterling. This is an AML/CFT compliance
tool, so correctness, auditability, and a clean change history matter as much as
the feature itself. Please read this guide before opening a pull request.

> **License note:** this is proprietary software (see [`LICENSE`](LICENSE)).
> Contributions are accepted only from authorized collaborators. By submitting a
> contribution you confirm you have the right to do so and assign it to the
> project owner.

## Project model

- **No build step, no backend, no bundler.** The core application is
  [`index.html`](index.html) with its logic in [`app.js`](app.js) and styles in
  [`app.css`](app.css), plus two more pages (`console.html`/`console.js`/`console.css`,
  `advisor.html`/`advisor.js`/`advisor.css`). Logic AND CSS live in same-origin
  external files (never inline) so the CSP is a pure `'self'` policy (no
  `'unsafe-inline'` in `script-src` or `style-src`, no third-party origins);
  former inline `on*` handlers use event delegation and former inline styles use
  the CSSOM. Fonts are self-hosted (`fonts.css` + `assets/fonts/`). Keep it that
  way — the `test/csp.test.mjs` guardrail fails the build if an inline
  script/style or a Google Fonts link reappears. It deploys to any static host as-is.
- All assessment data stays on the user's device (`localStorage`). Server-side
  secrets live only in Netlify/GitHub environment variables.
- Automation (FATF watchdog, Regulatory Watch, Sanctions Watch/Screen, site
  health, releases) lives in `scripts/` and `.github/workflows/`.

## Getting set up

```bash
# Serve the app locally — no install needed
python3 -m http.server 8000
# → http://localhost:8000
```

Node is only needed to run the test/automation scripts (Node 20+ recommended).

## Before you open a PR

Run the checks locally — CI (`.github/workflows/ci.yml`) runs the same ones plus
two headless-Chrome smoke tests, and they must pass:

```bash
node test/app.test.js         # scoring engine, register, report, Asana delivery & backup, edge cases
node test/watchdog.test.mjs   # FATF list parsing, alerts, digest, backup extraction
node test/reg-watch.test.mjs  # Regulatory Watch fingerprinting
npx eslint .                  # lint (config in eslint.config.mjs)
```

Other gates that run automatically on your PR:

- **Dependency Review** — a blocking gate; new dependencies with known
  vulnerabilities will fail the PR.
- **CodeQL** and **gitleaks** — code-scanning and secret-scanning.
- **PR size** (`.github/workflows/pr-size.yml`) — keep PRs focused and small;
  large diffs are flagged. Split unrelated changes into separate PRs.
- **Lighthouse / a11y / link-check / visual** — front-end quality gates.
- **CSP guardrail** (`test/csp.test.mjs`) and **scoring golden set**
  (`test/scoring-golden.test.js`) — blocking; a re-introduced inline handler or
  an unintended change to a frozen scoring outcome fails the PR.
- **CHANGELOG + SBOM** — `test/changelog.test.mjs` checks the Keep-a-Changelog
  format and a non-empty `[Unreleased]`; `test/sbom.test.mjs` validates the
  CycloneDX generator. Add a bullet under `## [Unreleased]` in
  [`CHANGELOG.md`](CHANGELOG.md) for any user-visible change; on an `APP_VERSION`
  bump, move `[Unreleased]` into a dated version section. The release workflow
  attaches a CycloneDX SBOM (`sbom.cdx.json`) automatically.

## Branch protection & protected environments

The complete, authoritative list of required repository settings — with the
exact values, the rationale for each, and an audit checklist — lives in
[`docs/governance/github-repository-hardening.md`](docs/governance/github-repository-hardening.md).
The general settings, labels, and branch protection are also encoded as
config-as-code in [`.github/settings.yml`](.github/settings.yml) (applied
automatically when the [Settings GitHub App](https://github.com/apps/settings)
is installed). The summary baseline (configured in GitHub Settings, not in the
diff):

- **Branch protection on `main`:** require a pull request before merging;
  require CODEOWNERS review (`.github/CODEOWNERS` routes compliance-sensitive
  paths to the MLRO); require status checks to pass (CI, CodeQL, gitleaks,
  Dependency Review); require branches to be up to date; restrict force-pushes
  and deletion.
- **Protected `release` environment:** `auto-release.yml` runs in the `release`
  environment — add **required reviewers** to it so publishing a GitHub release
  requires human approval. (Until configured, GitHub auto-creates it unprotected.)
- **Autonomous daily controls are intentionally NOT gated by required reviewers**
  (Sanctions/Regulatory/FATF watchers, freshness, site-health): they must run
  unattended. They are instead hardened with least-privilege `permissions:`,
  `step-security/harden-runner` egress policies, and "degrade-loudly" alerting.

## Branches and commits

- Branch from `main`; use a descriptive branch name
  (e.g. `fix/gauge-contrast`, `feat/eu-fsf-source`).
- Write clear, imperative commit messages that explain **why**, not just what.
- Reference the issue number where one exists (e.g. `… (#123)`).
- Keep each PR to a single logical change.

## Compliance-sensitive changes

Because this tool drives regulated decisions, take extra care when touching:

- **Risk scoring, hard outcomes, or escalation logic** in `index.html`.
- **Country / activity / material scores** or FATF flags — these are firm-approved
  baseline data; explain the source and rationale.
- **The Advisor** (`assets/brain-soul.js`, `assets/super-data.js`) and its
  guardrails.
- **Governance docs** under `docs/governance/` — if your change alters system
  behavior, update the relevant document (asset register, gap analysis, etc.)
  in the same PR.

Note any compliance impact in the PR description so reviewers (and the MLRO,
where relevant) can sign off.

## Reporting bugs and requesting features

Use the issue templates under
[`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE). For **security** issues, do
**not** open a public issue — follow [`SECURITY.md`](SECURITY.md) instead.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating
you agree to uphold it.
