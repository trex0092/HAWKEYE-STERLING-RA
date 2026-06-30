# GitHub Repository Hardening — Required Configuration

**Status:** authoritative configuration record
**Owner:** @trex0092 (MLRO / repository admin)
**Last reviewed:** 2026-06-30
**Companion config-as-code:** [`.github/settings.yml`](../../.github/settings.yml)

This repository ships a production AML/CFT system, so its GitHub controls are
treated as compliance controls: they must be auditable, reproducible, and not
dependent on one admin remembering to tick a box. This document is the single
authoritative record of the **required** repository configuration.

Two layers keep it honest:

1. **Config-as-code** — [`.github/settings.yml`](../../.github/settings.yml) declares
   general settings, labels, and branch protection. If the
   [Settings GitHub App](https://github.com/apps/settings) is installed, GitHub
   applies that file automatically on every push to the default branch. **Installing
   that app is the recommended way to enforce everything in Section 1 and 2 below.**
2. **This runbook** — the human procedure for the items that have **no API/file
   representation** (security toggles, environments, tag protection) and must be set
   in the GitHub UI, plus the rationale and the audit checklist.

A control is "applied" only when the checkbox in [Section 7](#7-audit-checklist) is
ticked with a date and reviewer.

---

## 1. Branch protection — `main`

Encoded in `.github/settings.yml` (`branches[main].protection`). Apply via the
Settings app, or manually at **Settings → Branches → Add branch ruleset / protect `main`**:

| Control | Required value | Why |
|---|---|---|
| Require a pull request before merging | **On** | No direct pushes to the deploy branch. |
| Required approvals | **≥ 1** | Four-eyes on every change. |
| Dismiss stale approvals on new commits | **On** | Re-review after the diff changes. |
| Require review from Code Owners | **On** | Enforces [`.github/CODEOWNERS`](../../.github/CODEOWNERS). |
| Require status checks to pass | **On** | No merging on red CI. |
| Require branches up to date before merge | **On** (`strict`) | Tests run against the post-merge tree. |
| Required checks | `test`, `lint`, `smoke`, `analyze` (CodeQL), `semgrep`, `gitleaks`, `size`, `Dependency Review` | The blocking gates that prove correctness, style, runtime-CSP/Trusted-Types safety, code scanning (CodeQL + Semgrep app-invariants), secret scanning, size, and dependency licensing/vulns. |
| Require conversation resolution | **On** | No unresolved review threads at merge. |
| Require linear history | **On** | Matches squash-only merging. |
| Include administrators | **On** (`enforce_admins`) | The rules bind everyone, including admins. |
| Allow force pushes | **Off** | History is immutable. |
| Allow deletions | **Off** | `main` cannot be deleted. |

> Check names must match the **job** names exactly. If a workflow job is renamed,
> update both the ruleset and `.github/settings.yml`.

---

## 2. General repository settings

Encoded in `.github/settings.yml` (`repository:`). Apply via the Settings app, or
manually at **Settings → General**:

- **Description, homepage, topics** — populated (improves discoverability and the
  "About" panel). Topics: `aml`, `cft`, `compliance`, `sanctions-screening`,
  `pep-screening`, `risk-assessment`, `regtech`, `dpms`, `netlify`, `codeql`.
- **Merge button** — *Squash* only; *Merge commits* and *Rebase* disabled →
  linear history.
- **Automatically delete head branches** — **On** (self-cleans merged feature and
  auto-generated branches such as `visual/baseline`).
- **Allow auto-merge** — On (lets a green, approved PR merge itself).
- **Features** — Wiki / Projects / Downloads **off** (unused); Issues **on**.
- **Social preview image** — upload a branded card (**Settings → General → Social
  preview**). *UI-only; not representable in `settings.yml`.*

---

## 3. Security & analysis  *(UI-only — Settings → Code security)*

These have **no `settings.yml` representation** and must be enabled in the UI.
`enable_vulnerability_alerts` / `enable_automated_security_fixes` in `settings.yml`
cover Dependabot alerts + security PRs; the rest are manual:

- [ ] **Dependency graph** — On.
- [ ] **Dependabot alerts** — On.
- [ ] **Dependabot security updates** — On. *(Version bumps are already handled by
  [`.github/dependabot.yml`](../../.github/dependabot.yml).)*
- [ ] **Secret scanning** — On.
- [ ] **Secret scanning push protection** — On (blocks pushing a detected secret).
  *(Belt-and-braces with the `gitleaks` and GitGuardian checks already in CI.)*
- [ ] **Code scanning (CodeQL)** — confirmed green; ensure the alert view has **0
  open** alerts (see [Section 6](#6-code-scanning-alerts)).
- [ ] **Private vulnerability reporting** — On (pairs with
  [`SECURITY.md`](../../SECURITY.md) disclosure SLA + CVSS matrix).

---

## 4. Protected environments  *(UI-only — Settings → Environments)*

The release/publish automation must wait for a human. No file representation —
configure in the UI:

- [ ] Create environment **`release`** with a **required reviewer** (@trex0092 or a
  designated approver). `auto-release.yml` / `release.yml` then pause for approval
  before publishing a tag/release.
- [ ] (Optional) Gate any state-mutating watcher workflow that writes back to the
  repo behind the same or a dedicated environment.

---

## 5. Tag protection  *(UI-only — Settings → Tags)*

- [ ] Add a tag protection rule for **`v*`** so only maintainers can create/modify
  release tags. Protects the provenance of versioned releases (SBOM is attached per
  release in CI).

---

## 6. Code-scanning alerts

The CodeQL **workflow** is green on every recent `main` commit, which proves the
scan runs and the latest diffs introduced no new findings. Separately, confirm the
cumulative alert list is clear:

- [ ] **Security → Code scanning** shows **0 open** alerts (triage or fix any that
  appear; the two historical `js/incomplete-string-escaping` findings were fixed in
  PRs #136 and the test-file cleanup).

---

## 7. Audit checklist

Tick with date + initials when verified in the live repo. Re-review quarterly
alongside the MLRO sign-off.

| # | Control | Applied (date / by) |
|---|---|---|
| 1 | Branch protection on `main` (Section 1) | ☐ |
| 2 | General settings: squash-only, auto-delete branches, features (Section 2) | ☐ |
| 3 | Description / topics / social preview (Section 2) | ☐ |
| 4 | Dependency graph + Dependabot alerts + security updates (Section 3) | ☐ |
| 5 | Secret scanning + push protection (Section 3) | ☐ |
| 6 | Private vulnerability reporting (Section 3) | ☐ |
| 7 | `release` environment with required reviewer (Section 4) | ☐ |
| 8 | Tag protection `v*` (Section 5) | ☐ |
| 9 | Code-scanning: 0 open alerts (Section 6) | ☐ |
| 10 | Settings GitHub App installed (auto-applies Sections 1–2) | ☐ |

---

## Notes

- **Why some items are UI-only:** GitHub exposes branch protection and general
  settings to the Settings app / API, but secret-scanning toggles, environments,
  and tag protection are not representable in `settings.yml` today — hence the
  manual checklist. When GitHub adds API/app support, fold them into
  `.github/settings.yml` and delete the corresponding manual rows.
- **Change control:** edits to this file or to `.github/settings.yml` are owned by
  @trex0092 (see CODEOWNERS) and require a reviewed PR like any other change.
