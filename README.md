# Hawkeye Sterling - Entity Risk Assessment (RA)

**Project:** [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [License](LICENSE) · [Support](SUPPORT.md) · [Governance](GOVERNANCE.md) · [Maintainers](MAINTAINERS.md)

**Technical & compliance:** [Architecture](docs/architecture/README.md) · [Compliance Methodology](docs/policies/README.md) · [Screening Coverage](data/screening-country-coverage.json) · [Data Sources](data/sanctions-sources.json) · [Controls](data/controls/README.md) · [Operations](docs/operations/README.md) · [Changelog](CHANGELOG.md) · [Citation](docs/research/README.md) · [Docs index](docs/README.md)

<!-- Runtime assurance badges are intentionally neutral on the default branch.
     The live screening status is tracked by workflow evidence rather than a stale
     branch artifact. -->
[![Sanctions runtime](https://img.shields.io/badge/Sanctions%20runtime-tracked%20by%20workflow-blue)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/screening-assurance.yml)
[![Adverse media runtime](https://img.shields.io/badge/Adverse%20media%20runtime-tracked%20by%20workflow-orange)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/screening-assurance.yml)
[![PEP runtime](https://img.shields.io/badge/PEP%20runtime-tracked%20by%20workflow-purple)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/screening-assurance.yml)
[![Screening assurance](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/screening-assurance.yml?branch=main&label=runtime%20assurance)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/screening-assurance.yml)

<!-- Configured scope: generated from the engine's own configuration by scripts/coverage-figures.mjs, CI drift-checked.
     These badges describe intended geographic applicability, not proof that a particular run succeeded. -->
[![Sanctions National Source Depth](data/badges/sanctions-worldwide.svg)](data/screening-country-coverage.json)
[![Adverse Media Configured Scope](data/badges/adverse-media-worldwide.svg)](data/screening-country-coverage.json)
[![PEP Configured Scope](data/badges/pep-worldwide.svg)](data/screening-country-coverage.json)

**Worldwide screening scope:** the configured sanctions, adverse-media and PEP controls apply to the full 195-country subject universe. Runtime operational status is reported separately above from the actual daily-screen evidence. Dedicated national sanctions sources and dedicated Google News editions are depth metrics shown below.

[![Sanctions Lists Screened](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fcoverage-figures.json&query=%24.figures.sanctionsListsScreened&label=Sanctions%20Lists%20Screened)](data/screening-country-coverage.json)
[![Sanctions Jurisdictions](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fcoverage-figures.json&query=%24.figures.sanctionsJurisdictions&label=Sanctions%20Jurisdictions)](data/screening-country-coverage.json)
[![Sanctions Countries Researched](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fcoverage-figures.json&query=%24.figures.sanctionsCountriesResearched&label=Sanctions%20Countries%20Researched)](data/screening-country-coverage.json)
[![Adverse Media Editions](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fcoverage-figures.json&query=%24.figures.adverseMediaEditions&label=Adverse%20Media%20Editions)](data/screening-country-coverage.json)
[![Adverse Media Countries](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fcoverage-figures.json&query=%24.figures.adverseMediaCountries&label=Adverse%20Media%20Countries)](data/screening-country-coverage.json)
[![Adverse Media Languages](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fcoverage-figures.json&query=%24.figures.adverseMediaLanguages&label=Adverse%20Media%20Languages)](data/screening-country-coverage.json)
[![Adverse media backbones](https://img.shields.io/badge/adverse%20media%20backbones-Google%20News%20%C2%B7%20GDELT%20%C2%B7%20Bing-e67e22)](scripts/adverse-media.mjs)
[![PEP source](https://img.shields.io/badge/PEP-worldwide%20%28Wikidata%29%20%2B%20RCA-8e44ad)](screen.py)
[![PEP Harvest](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/pep-worldwide.yml?branch=main&label=pep%20harvest)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/pep-worldwide.yml)
[![PEP Chain Watchdog](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/pep-chain-watchdog.yml?branch=main&label=pep%20chain%20watchdog)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/pep-chain-watchdog.yml)
[![EOCN Reconcile](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/eocn-reconcile.yml?branch=main&label=eocn%20reconcile)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/eocn-reconcile.yml)

[![CI](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/ci.yml/badge.svg)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/ci.yml)
[![CodeQL](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/codeql.yml/badge.svg)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/codeql.yml)
[![Daily Screening](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/weekly-adverse-media.yml?branch=main&label=daily%20screening)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/weekly-adverse-media.yml)
[![Controls Freshness](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/freshness-check.yml?branch=main&label=controls%20freshness)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/freshness-check.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/trex0092/HAWKEYE-STERLING-RA/badge)](https://scorecard.dev/viewer/?uri=github.com/trex0092/HAWKEYE-STERLING-RA)
[![Latest Release](https://img.shields.io/github/v/release/trex0092/HAWKEYE-STERLING-RA?label=release)](https://github.com/trex0092/HAWKEYE-STERLING-RA/releases)
[![Netlify Status](https://api.netlify.com/api/v1/badges/475b8e6f-bfe0-40fd-99bc-4a9282853475/deploy-status)](https://app.netlify.com/projects/hawkeye-sterling-ra/deploys)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-steelblue.svg)](LICENSE)

<!-- Code quality & security gates (push/PR + scheduled) -->
[![Lint](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/lint.yml?branch=main&label=lint)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/lint.yml)
[![Semgrep](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/semgrep.yml?branch=main&label=semgrep)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/semgrep.yml)
[![Gitleaks](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/gitleaks.yml?branch=main&label=gitleaks)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/gitleaks.yml)
[![OSV-Scanner](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/osv-scanner.yml?branch=main&label=osv-scanner)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/osv-scanner.yml)
[![Workflow Lint](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/workflow-lint.yml?branch=main&label=workflow%20lint)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/workflow-lint.yml)
[![DAST](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/dast-zap.yml?branch=main&label=dast%20%28zap%29)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/dast-zap.yml)
[![Accessibility](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/a11y.yml?branch=main&label=a11y)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/a11y.yml)
[![Cross-browser](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/cross-browser.yml?branch=main&label=cross-browser)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/cross-browser.yml)
[![Visual Regression](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/visual.yml?branch=main&label=visual)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/visual.yml)
[![Docker Smoke](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/docker-smoke.yml?branch=main&label=docker%20smoke)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/docker-smoke.yml)
[![Container Scan](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/container-scan.yml?branch=main&label=container%20scan)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/container-scan.yml)
[![Attestation Verify](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/attestation-verify.yml?branch=main&label=attestation%20verify)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/attestation-verify.yml)
[![Bandit](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/bandit.yml?branch=main&label=bandit)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/bandit.yml)
[![Fortify](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/fortify.yml?branch=main&label=fortify)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/fortify.yml)
[![Dependency Review](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/dependency-review.yml?branch=main&label=dependency%20review)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/dependency-review.yml)
[![Lighthouse](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/lighthouse.yml?branch=main&label=lighthouse)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/lighthouse.yml)
[![Scorecard](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/scorecard.yml?branch=main&label=scorecard)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/scorecard.yml)

<!-- Live compliance controls (scheduled watchers - a red badge IS the alarm) -->
[![Regulatory Watch](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/regulatory-watch.yml?branch=main&label=regulatory%20watch)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/regulatory-watch.yml)
[![FATF Watchdog](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/fatf-watchdog.yml?branch=main&label=fatf%20watchdog)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/fatf-watchdog.yml)
[![Sanctions Watch](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/sanctions-watch.yml?branch=main&label=sanctions%20watch)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/sanctions-watch.yml)
[![Citations](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/link-check.yml?branch=main&label=citations)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/link-check.yml)
[![Site Health](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/site-health.yml?branch=main&label=site%20health)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/site-health.yml)
[![Function Health](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/function-health.yml?branch=main&label=function%20health)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/function-health.yml)
[![Site Currency](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/site-currency.yml?branch=main&label=site%20currency)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/site-currency.yml)
[![Delivery Watchdog](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/delivery-watchdog.yml?branch=main&label=delivery%20watchdog)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/delivery-watchdog.yml)
[![Control Retry](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/control-retry.yml?branch=main&label=control%20retry)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/control-retry.yml)
[![Production Deploy](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/netlify-production-deploy.yml?branch=main&label=production%20deploy)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/netlify-production-deploy.yml)

<!-- Scheduled ops, reporting & AI assurance (live workflow status) -->
[![Anomaly Watch](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/anomaly-watch.yml?branch=main&label=anomaly%20watch)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/anomaly-watch.yml)
[![Daily Brief](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/daily-brief.yml?branch=main&label=daily%20brief)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/daily-brief.yml)
[![Weekly Summary](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/weekly-summary.yml?branch=main&label=weekly%20summary)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/weekly-summary.yml)
[![Governance Report](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/governance-report.yml?branch=main&label=governance%20report)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/governance-report.yml)
[![Quarterly Review](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/quarterly-review.yml?branch=main&label=quarterly%20review)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/quarterly-review.yml)
[![Onboarding Screen](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/onboarding-screen.yml?branch=main&label=onboarding%20screen)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/onboarding-screen.yml)
[![Compliance Calendar](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/compliance-calendar.yml?branch=main&label=compliance%20calendar)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/compliance-calendar.yml)
[![Asana Reconcile](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/asana-reconcile.yml?branch=main&label=asana%20reconcile)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/asana-reconcile.yml)
[![Advisor Eval](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/advisor-eval.yml?branch=main&label=advisor%20eval)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/advisor-eval.yml)
[![Advisor Bias Eval](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/advisor-bias-eval.yml?branch=main&label=advisor%20bias%20eval)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/advisor-bias-eval.yml)
[![Container Build](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/publish-container.yml?label=container%20build)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/publish-container.yml)
[![Housekeeping](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/stale.yml?branch=main&label=housekeeping)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/stale.yml)

<!-- Live site scans (external, continuous) -->
[![Mozilla Observatory](https://img.shields.io/mozilla-observatory/grade/hawkeye-sterling-ra.netlify.app?label=observatory)](https://developer.mozilla.org/en-US/observatory/analyze?host=hawkeye-sterling-ra.netlify.app)
[![Site Up](https://img.shields.io/website?url=https%3A%2F%2Fhawkeye-sterling-ra.netlify.app&label=site%20up)](https://hawkeye-sterling-ra.netlify.app)

<!-- Estate counts (dynamic - read from drift-guarded committed data, never hand-counted) -->
[![Workflows](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fboard-figures.json&query=%24.figures.workflows&label=Workflows)](data/board-figures.json)
[![Docs](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fboard-figures.json&query=%24.figures.docsTotal&label=Docs)](data/board-figures.json)
[![Egress-blocked jobs](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fboard-figures.json&query=%24.figures.egressBlockedJobs&label=Egress-blocked%20jobs)](data/board-figures.json)
[![Reg sources watched](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Freg-sources.json&query=%24.sources.length&label=Reg%20sources%20watched)](data/reg-sources.json)
[![Sanctions sources watched](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftrex0092%2FHAWKEYE-STERLING-RA%2Fmain%2Fdata%2Fsanctions-sources.json&query=%24.sources.length&label=Sanctions%20sources%20watched)](data/sanctions-sources.json)

<!-- Repository stats (live) -->
[![Last Commit](https://img.shields.io/github/last-commit/trex0092/HAWKEYE-STERLING-RA?label=last%20commit)](https://github.com/trex0092/HAWKEYE-STERLING-RA/commits/main)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/trex0092/HAWKEYE-STERLING-RA?label=commits)](https://github.com/trex0092/HAWKEYE-STERLING-RA/graphs/commit-activity)
[![Contributors](https://img.shields.io/github/contributors/trex0092/HAWKEYE-STERLING-RA?label=contributors)](https://github.com/trex0092/HAWKEYE-STERLING-RA/graphs/contributors)
[![Open Issues](https://img.shields.io/github/issues/trex0092/HAWKEYE-STERLING-RA?label=issues)](https://github.com/trex0092/HAWKEYE-STERLING-RA/issues)
[![Open PRs](https://img.shields.io/github/issues-pr/trex0092/HAWKEYE-STERLING-RA?label=PRs)](https://github.com/trex0092/HAWKEYE-STERLING-RA/pulls)
[![Repo Size](https://img.shields.io/github/repo-size/trex0092/HAWKEYE-STERLING-RA?label=repo%20size)](https://github.com/trex0092/HAWKEYE-STERLING-RA)
[![Code Size](https://img.shields.io/github/languages/code-size/trex0092/HAWKEYE-STERLING-RA?label=code%20size)](https://github.com/trex0092/HAWKEYE-STERLING-RA)
[![Release Date](https://img.shields.io/github/release-date/trex0092/HAWKEYE-STERLING-RA?label=released)](https://github.com/trex0092/HAWKEYE-STERLING-RA/releases)

<!-- Platform & posture facts (static) -->
[![Node ≥22](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](package.json)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)](pyproject.toml)
[![PWA](https://img.shields.io/badge/PWA-offline--ready-5A0FC8)](sw.js)
[![Zero runtime deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](package.json)
[![Container](https://img.shields.io/badge/container-ghcr.io-2496ED?logo=docker&logoColor=white)](Dockerfile)
[![CSP](https://img.shields.io/badge/CSP-pure%20%27self%27-blueviolet)](netlify.toml)
[![Trusted Types](https://img.shields.io/badge/Trusted%20Types-enforced-blueviolet)](sw-register.js)
[![WCAG](https://img.shields.io/badge/WCAG-2.1%20AA-1f7f4c)](test/axe.spec.mjs)
[![i18n](https://img.shields.io/badge/i18n-EN%20%2F%20AR-informational)](i18n.js)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa)](CODE_OF_CONDUCT.md)
[![AI Governance](https://img.shields.io/badge/AI%20governance-ISO%2042001--aligned-004b8d)](docs/governance/README.md)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-brightgreen?logo=dependabot)](.github/dependabot.yml)

A static web application for **AML/CFT customer (entity) risk assessment**, built as a template for **Dealers in Precious Metals and Stones (DPMS)** and adaptable to other reporting entities.

**Live:** https://hawkeye-sterling-ra.netlify.app

The core application lives in [`index.html`](index.html) with its logic in the sibling [`app.js`](app.js) and styles in [`app.css`](app.css) - no build step, no backend, no bundler. Page logic and scaffold maintenance reside in the repo as documented in the project structure below.

## Contents

- [The command-center suite](#the-command-center-suite)
- [Screenshots](#screenshots)
- [Features](#features)
- [Automated daily screening engine + AI layer](#automated-daily-screening-engine--ai-layer)
- [MCP server (AI-agent access to the engine)](#mcp-server-ai-agent-access-to-the-engine)
- [Risk methodology](#risk-methodology)
- [Data management & privacy](#data-management--privacy)
- [Device security](#device-security)
- [Setup](#setup)
- [Tests](#tests)
- [Accessibility](#accessibility)
- [Project structure](#project-structure)
- [System state & known limitations](#system-state--known-limitations)
- [Contributing & support](#contributing--support)
- [Security](#security)
- [License](#license)
- [Disclaimer](#disclaimer)

## The command-center suite

A dark neon, AI-persona "command center" spanning three sibling pages - pure HTML/CSS/JS, no framework, cross-linked from the header nav and sharing the six robot portraits in [`assets/`](assets).

| Page | File | Purpose |
|---|---|---|
| **Entity Risk Assessment** | [`index.html`](index.html) | The primary tool - live 0–30 risk scoring, animated gauge, CDD/SDD/EDD verdict, analyst override, Risk-Data editor, register and activity logging. |
| **AI Operations Console** | [`console.html`](console.html) | A live monitoring HUD - a robot "analyst on duty" inside an animated radar, an operator switcher, count-up stat tiles, a live alert feed, and a command board. |
| **Hawkeye Sterling Advisor** | [`advisor.html`](advisor.html) | A cited-answer AML Q&A - a question composer with a swappable AI persona that returns a verdict, cited legal basis, decision guidance and a policy-relevant summary. |

The **AI Risk Advisor** in the assessment sidebar is a robot whose head and HUD colour follow the operative outcome - **Vale** (teal) for CDD, **Cypher** (amber) for SDD, **Ember** (red) for EDD.

## Screenshots

Desktop captures of the three screens (Chromium, 1280×900 - sources in [`docs/screenshots/`](docs/screenshots)):

| Entity Risk Assessment | AI Operations Console | Hawkeye Sterling Advisor |
|---|---|---|
| [![Entity Risk Assessment - live scoring, gauge and CDD verdict](docs/screenshots/index.png)](docs/screenshots/index.png) | [![AI Operations Console - analyst on duty, stat tiles and alert stream](docs/screenshots/console.png)](docs/screenshots/console.png) | [![Hawkeye Sterling Advisor - cited AML answers and persona switcher](docs/screenshots/advisor.png)](docs/screenshots/advisor.png) |

## Features

- **Structured risk scoring** across jurisdiction, business activity, onboarding channel, operational history, relationship duration, ownership/control/compliance questions, and supply-chain materials.
- **Risk data maintenance** - a built-in *Risk Data* panel where the compliance officer can override any country, activity, or material score (and the FATF call-for-action flag) on top of the firm baseline.
- **Dark neon interface** - six numbered form sections beside a sticky risk-summary sidebar: an animated 270° SVG risk gauge, the required-diligence verdict with threshold chips, a 0–30 risk-position track and the breakdowns.
- **Live verdict** - total score, numeric band (CDD / SDD / EDD), and boundary warnings one point below each band edge, recomputed on every change.
- **Hard outcomes** - designated-party exposure (sanctions on the entity or its principals, terrorist financing, proliferation financing) produces a **PROHIBITED - Do Not Onboard** verdict with formal reporting consequences.
- **Analyst override** - the operative outcome can be raised above the computed one (one-way ratchet: CDD → SDD/EDD, SDD → EDD) with a mandatory justification that prints on the report.
- **Screening evidence** - record the system/provider, date, and reference ID for sanctions, PEP, and adverse-media checks; printed in the report as audit evidence.
- **Assessment metadata** - auto-generated reference (`RA-YYYYMMDD-NNN`), assessment date, assessor name and role.
- **Expanded entity identification** - legal and trading names, registration/licence number, jurisdiction, registered address, website/email, principals (beneficial owners / controllers / directors) and notes.
- **Analyst notes & rationale** - free-text section included in the printed report, with a one-click **Narrative Template** that writes a formal, plain-language risk rationale.
- **FATF Watchdog** - a monthly GitHub Action reads FATF's published black/grey lists, compares them with the app's country data, and raises alerts on change.
- **Regulatory Watch** - a weekly GitHub Action monitors a worldwide, UAE-weighted set of regulatory sources.
- **Sanctions Watch** - a daily GitHub Action fingerprints major designation lists and tracks changes over time.
- **Sanctions Screen** - a daily GitHub Action answers the operative question: *"is any of our customers now on a list?"*.
- **Screening accuracy benchmark (95% floors, CI-enforced)** - screening quality is measured, not asserted.
- **Asana delivery** - marking an assessment *Complete* on the deployed site creates a task in the firm's **RISK ASSESSMENTS** Asana project.
- **Assessment register** - every assessment with an entity name files itself into a built-in register keyed by reference.
- **Operations robots** - *Site Health*, *Function Health*, *Control Retry* and associated watchdogs verify live site behaviour and operational continuity.
- **Sign-off & attestation** - first-line and second-line review blocks with name, title, date and signature lines under a formal attestation statement.
- **Print-ready report** - a formal black/pink A4 letterhead report with result box, notes and sign-off blocks.
- **Persistence** - drafts autosave to `localStorage` and are restored on reload.
- **Record completeness indicator** in the risk-summary sidebar.

## Automated daily screening engine + AI layer

Beyond the on-device assessment tool, the repository runs an automated, audit-grade daily screening engine over the firm's live customer base, augmented by a governance-first AI layer.

## MCP server (AI-agent access to the engine)

A Model Context Protocol server exposes the deterministic screening engine as tools, resources and prompts for AI agents.

## Risk methodology

### Scored factors

| Factor | Scoring |
|---|---|
| Jurisdiction of incorporation & operation | Per-country score (1 Low / 2 Medium / 3 High) from the embedded country list |
| Nature & complexity of business activities | Per-activity score (Regulated Financial Entities = 1; trading, mining, refining, jewellery, wholesale/pawn = 3) |
| Ownership, control & compliance (11 questions) | Yes = 3, No = 1 - except *AML/CFT control adequacy*, which is inverted (Yes = 1, No = 3) |
| Onboarding channel | In-person = 1, Remote / non-face-to-face = 3 |
| Operational history & relationship duration | < 1 year = 3, 1 year = 2, 2+ years = 1 |
| Supply chain - recycled sources (×3 suppliers) | Per-material score 0–3 |
| Supply chain - mined sources (×3 suppliers) | LSM / MSM = 2, ASM (artisanal) = 3, N/A = 0 |

### Numeric risk bands

| Total score | Band | Outcome | Suggested review cycle |
|---|---|---|---|
| 0–19 | **CDD** | Customer Due Diligence | 12 months |
| 20–22 | **SDD** | Simplified Due Diligence review | 6 months |
| 23+ | **EDD** | Enhanced Due Diligence | 3 months |

## Data management & privacy

- **Autosave** - the working draft is saved to `localStorage` in the user's browser only.
- **Print report** - produces an audit-ready PDF via the browser's print dialog.

## Device security

For an offline, zero-backend tool, sensitive data is protected **on the device** rather than behind a server.

## Setup

### Asana integration

Copy `.env.example` to `.env` and fill in the values, then add them to your hosting environment.

### Getting started

**Open directly** - download `index.html` and open it in any modern browser.

**Serve locally:**

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

**Deploy** - the Netlify project publishes the repo root as-is (`netlify.toml`, no build step).

## Tests

The scoring engine, hard-outcome escalations, persistence, and report rendering are covered by a dependency-free test suite.

## Accessibility

The application targets WCAG 2.1 Level AA for its core assessment workflow.

**Known limitations:** some badge colours have not been independently audited.

## Project structure

```text
.
├── index.html
├── app.js
├── app.css
├── console.html
├── advisor.html
├── docs/
├── data/
├── scripts/
├── test/
├── .github/workflows/
├── netlify.toml
├── package.json
├── README.md
└── LICENSE
```

## System state & known limitations

- **Transaction monitoring is built and inert.** The FATF R.16 rules engine is implemented and unit-tested but inactive until a transaction feed is connected.
- **Part of the policy pack is draft.** Some procedures remain pending approval.
- **Function endpoints are effectively public by design.** A static browser app cannot keep a real secret; origin and shared-token checks deter but do not authenticate.
- **Assessments persist on-device only** (`localStorage`).
- **The LLM layer ships disabled.** Every LLM path is fail-closed behind `ANTHROPIC_API_KEY` plus explicit opt-in.
- **Alert delivery is Asana-only.** Delivery failure fails the run loudly.
- **Arabic coverage is partial.** The assessment screen is fully translated; console/advisor carry minimal AR chrome.

## Contributing & support

- **Contributing:** see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the test suite, branch/commit conventions, and PR gates.
- **Community standards:** [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- **Getting help:** [`SUPPORT.md`](SUPPORT.md), or open an issue with the templates in [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE).

## Security

Found a vulnerability? **Do not open a public issue** - follow the disclosure process in [`SECURITY.md`](SECURITY.md).

## License

**Proprietary - All Rights Reserved.** See [`LICENSE`](LICENSE).

## Disclaimer

This tool is for **internal compliance use only**. It supports, and does not replace, professional judgement, firm policy and applicable AML/CFT obligations.
