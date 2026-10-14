---
name: github-workflow-security
description: Review and harden Hawkeye Sterling GitHub Actions changes, third-party starter workflow adoption, action pinning, permissions, labels, CODEOWNERS and agent skill manifests. Use for new workflows, action updates, repository protection reviews, or requests to import actions/starter-workflows templates.
---

# GitHub Workflow Security

## Inspect before adoption

- Read `.github/workflows/`, `.github/CODEOWNERS`, `.github/settings.yml`, `.github/dependabot.yml`, `.github/labeler.yml`, `SECURITY.md` and `package.json`.
- Compare the current repo to official `actions/starter-workflows` templates. Choose only missing jobs that apply to this repository's languages and real infrastructure.
- **This repo is a private Node package** (`package.json.private === true`). Never add npm/GitHub Packages publishing because a template exists.
- Preserve human review and the distinction between declarative policy and actual GitHub branch protection. Do not claim live protection without an API or UI read-back.

## Every workflow PR must pass

1. Every external `uses:` action must pin a full 40-character SHA and have a traceable upstream source.
2. Apply **minimum GITHUB_TOKEN permissions**, prefer `contents: read`; no `write-all` or new secrets without explicit approval.
3. Use non-privileged `pull_request` and read-only checkout (`persist-credentials: false`). Avoid `pull_request_target` and `workflow_run` code execution against untrusted PRs.
4. Add `timeout-minutes`, bounded concurrency, `step-security/harden-runner`, a documented egress policy, narrow path triggers, and operationally meaningful hard failures. Do not use `continue-on-error` to mask control failure.
5. Distinguish a report-only job from a required blocking check. A security scan's successful process exit does not necessarily mean vulnerabilities were fixed.
6. For SBOMs, upload short-retention **read-only evidence artifacts**. Do not enable release uploads or dependency submissions using a write-capable token without review.
7. Verify label names are in `.github/settings.yml` and auto-label paths in `.github/labeler.yml`. Priority and MLRO approval labels stay **manual**.
8. Run existing `node test/workflow-hardening.test.mjs`, `node test/ci-coverage.test.mjs`, `actionlint` and `zizmor` plus exact-head required GitHub PR checks. Merge only when required independent approvals and checks permit it.

## Scope and output

Deliver a small PR with the new control, tests, threat rationale, exact-head check URLs, permissions comparison and an outstanding-risk register. Keep security, operational screening and legal/compliance health separate.

Never edit, run, deploy, or inspect Netlify configuration as part of this skill. Never bypass MLRO approval, branch protection or unverified Asana screening outcomes.
