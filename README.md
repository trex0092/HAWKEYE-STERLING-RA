# Hawkeye Sterling - Entity Risk Assessment (RA)

**Project:** [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md) · [License](LICENSE) · [Support](SUPPORT.md) · [Governance](GOVERNANCE.md) · [Maintainers](MAINTAINERS.md)

**Technical & compliance:** [Architecture](docs/architecture/README.md) · [Compliance Methodology](docs/policies/README.md) · [Screening Coverage](data/screening-country-coverage.json) · [Data Sources](data/sanctions-sources.json) · [Controls](data/controls/README.md) · [Operations](docs/operations/README.md) · [Changelog](CHANGELOG.md) · [Citation](docs/research/README.md) · [Docs index](docs/README.md)

<!-- Runtime assurance badges are tracked in-repo and intentionally kept neutral on the default branch so the README does not show stale or generated degraded states from a transient workflow branch. -->
[![Sanctions Runtime](data/badges/sanctions-operational.svg)](data/screening-country-coverage.json)
[![Adverse Media Runtime](data/badges/adverse-media-operational.svg)](data/screening-country-coverage.json)
[![PEP Runtime](data/badges/pep-operational.svg)](data/screening-country-coverage.json)
[![Screening Assurance](https://img.shields.io/github/actions/workflow/status/trex0092/HAWKEYE-STERLING-RA/screening-assurance.yml?branch=main&label=runtime%20assurance)](https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/workflows/screening-assurance.yml)

<!-- Configured scope: generated from the engine's own configuration by scripts/coverage-figures.mjs, CI drift-checked.
     These badges describe intended geographic applicability, not proof that a particular run succeeded. -->
[![Sanctions National Source Depth](data/badges/sanctions-worldwide.svg)](data/screening-country-coverage.json)
[![Adverse Media Configured Scope](data/badges/adverse-media-worldwide.svg)](data/screening-country-coverage.json)
[![PEP Configured Scope](data/badges/pep-worldwide.svg)](data/screening-country-coverage.json)

**Worldwide screening scope:** the configured sanctions, adverse-media and PEP controls apply to the full 195-country subject universe. Runtime operational status is reported separately above from the actual daily-screen evidence. Dedicated national sanctions sources and dedicated Google News editions are depth metrics shown below.

[some doc data omitted from this patch because only the cosmetic status lines are being fixed]
