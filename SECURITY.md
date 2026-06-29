# Security Policy

Hawkeye Sterling — Entity Risk Assessment (RA) is an AML/CFT compliance tool.
We take the security of the application, its data handling, and its supply
chain seriously. This document explains how to report a vulnerability and what
to expect in return.

## Supported versions

The application is a static, no-build site that is deployed continuously from
`main`. Only the **latest released version** (see the
[releases](https://github.com/trex0092/HAWKEYE-STERLING-RA/releases) page and
`APP_VERSION` in [`app.js`](app.js)) is supported and patched.

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

## Severity classification and remediation SLAs

Confirmed vulnerabilities are scored with **CVSS v3.1** (base score; a v3.1
vector string is recorded on the advisory, and a CVSS v4.0 vector may be added
where it better captures the impact). The severity sets the remediation target:

| Severity | CVSS v3.1 base | Illustrative for this app | Remediation target |
|---|---|---|---|
| **Critical** | 9.0 – 10.0 | Server-side token/secret exposure; remote code execution in a function; bypass of a PROHIBITED/sanctions hard outcome; role/2FA gate bypass | Mitigate ≤ **48 hours**, fix ≤ **7 days** |
| **High** | 7.0 – 8.9 | Stored XSS or a CSP bypass that executes script; tampering with the hash-chained audit log; decryption of at-rest data | Fix ≤ **14 days** |
| **Medium** | 4.0 – 6.9 | Reflected XSS with mitigations; CSRF on a relay function; disclosure of non-secret internal data | Fix ≤ **30 days** |
| **Low** | 0.1 – 3.9 | Missing hardening header; rate-limit edge case; minor info leak | Fix ≤ **90 days** / next release |
| **Informational** | 0.0 | Best-practice suggestions, defence-in-depth ideas | Backlog / risk-accepted with rationale |

**Ownership and SLA accountability.** The MLRO / repository maintainer
(`@trex0092`) is the **security owner**: they acknowledge the report, assign the
CVSS score and severity, own the remediation SLA, approve any risk acceptance,
and authorise disclosure. AI-specific incidents (Advisor) additionally follow
the [AI Incident Runbook](docs/governance/ai-incident-runbook.md), including the
`ADVISOR_ENABLED=false` kill switch. Every confirmed Critical/High incident gets
a blameless post-incident review using the
[post-incident review template](docs/governance/incident-postmortem-template.md).

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

## Evidence retention

For every confirmed incident we preserve, in the private GitHub advisory and the
repository's audit trail: the report and correspondence, the reproduction /
proof-of-concept, relevant logs, the CVSS vector and severity decision, the
remediating commit/PR, and the post-incident review. Records are retained for at
least **10 years** (aligning with the firm's AML/CFT record-keeping under UAE
Federal Decree-Law No. (26) of 2021, Art. 23, applied elsewhere in this repo).
**No live secrets, tokens, or customer PII are stored in evidence** — sensitive
values are redacted before they are attached, consistent with the app's
no-secret-logging posture.

## Related governance

Incident response, containment, and the Advisor kill switch are documented in
the [AI Incident Runbook](docs/governance/ai-incident-runbook.md); the
[post-incident review template](docs/governance/incident-postmortem-template.md)
captures the blameless retrospective for any confirmed incident. Broader control
coverage is in the
[AI Governance & Security Gap Analysis](docs/governance/ai-governance-gap-analysis-2026.md).
