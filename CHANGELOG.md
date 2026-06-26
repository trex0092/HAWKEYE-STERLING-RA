# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the application follows the `APP_VERSION` constant in [`index.html`](index.html).
Release tags and notes are also generated automatically by the
[Auto Release workflow](.github/workflows/auto-release.yml) on every version
bump merged to `main`.

## [Unreleased]

### Added

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

## [3.7.0] — 2026-06-26

Baseline release at the time this changelog was introduced. See the
[releases page](https://github.com/trex0092/HAWKEYE-STERLING-RA/releases) for
auto-generated notes on prior versions.

[Unreleased]: https://github.com/trex0092/HAWKEYE-STERLING-RA/compare/v3.7.0...HEAD
[3.7.0]: https://github.com/trex0092/HAWKEYE-STERLING-RA/releases/tag/v3.7.0
