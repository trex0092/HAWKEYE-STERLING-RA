# Contributing to Hawkeye Sterling — Entity Risk Assessment (RA)

Thank you for helping improve Hawkeye Sterling. This is an AML/CFT compliance
tool, so correctness, auditability, and a clean change history matter as much as
the feature itself. Please read this guide before opening a pull request.

> **License note:** this is proprietary software (see [`LICENSE`](LICENSE)).
> Contributions are accepted only from authorized collaborators. By submitting a
> contribution you confirm you have the right to do so and assign it to the
> project owner.

## Project model

- **No build step, no backend, no bundler.** The core application is a single
  file — [`index.html`](index.html) — with two sibling pages (`console.html`,
  `advisor.html`). It deploys to any static host as-is.
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
