# Security Policy

Hawkeye Sterling — Entity Risk Assessment (RA) is an AML/CFT compliance tool.
We take the security of the application, its data handling, and its supply
chain seriously. This document explains how to report a vulnerability and what
to expect in return.

## Supported versions

The application is a single-file, no-build static site that is deployed
continuously from `main`. Only the **latest released version** (see the
[releases](https://github.com/trex0092/HAWKEYE-STERLING-RA/releases) page and
`APP_VERSION` in [`index.html`](index.html)) is supported and patched.

| Version | Supported |
|---|---|
| Latest release (`main`) | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through either channel:

1. **GitHub Private Vulnerability Reporting** (preferred) — use the
   **Security → Report a vulnerability** button on this repository. This opens
   a private advisory visible only to maintainers.
2. **Email** — <hawkeye.sterling.v2@gmail.com> with the subject line
   `SECURITY: Hawkeye Sterling RA`.

Please include, where possible:

- A description of the issue and its impact.
- Steps to reproduce (proof-of-concept, affected URL/page, browser/version).
- Any relevant logs, screenshots, or configuration.

## What to expect

| Stage | Target |
|---|---|
| Acknowledgement of your report | within **3 business days** |
| Initial assessment / triage | within **7 business days** |
| Fix or mitigation plan for confirmed issues | communicated after triage |

We will keep you informed of progress and will credit reporters who wish to be
acknowledged once a fix is released. Please allow us reasonable time to remediate
before any public disclosure (coordinated disclosure).

## Scope

In scope:

- The on-device deterministic risk-scoring engine and UI (`index.html`,
  `console.html`, `advisor.html`).
- The optional LLM-backed **Advisor** (`assets/brain-soul.js`) and its runtime
  guardrails (PII flag, output-structure validator, budget flag, kill switch).
- The Netlify relay functions under `netlify/functions/` and the automation
  scripts under `scripts/`.
- The CI/CD and watchdog workflows under `.github/workflows/`.

Out of scope:

- Third-party services the app integrates with (Asana, Netlify, regulator
  source sites) — report those to the respective providers.
- Findings that require a compromised end-user device or browser.
- Best-practice suggestions without a demonstrable security impact.

## Data-handling note

By design, assessment data stays **on the user's device** (`localStorage`); the
deterministic engine has no backend. Secrets (API tokens) are held server-side
in Netlify/GitHub environment variables and never reach the browser. Secret
hygiene is enforced in CI by **gitleaks** ([`.gitleaks.toml`](.gitleaks.toml))
and dependency risk by **CodeQL** and **Dependency Review**.

## Related governance

Incident response, containment, and the Advisor kill switch are documented in
the [AI Incident Runbook](docs/governance/ai-incident-runbook.md). Broader
control coverage is in the
[AI Governance & Security Gap Analysis](docs/governance/ai-governance-gap-analysis-2026.md).
