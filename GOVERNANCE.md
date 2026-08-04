# Repository Governance

This file states who decides what for **this repository**. It complements
[`docs/governance/`](docs/governance/), which governs the AI system the
repository ships — the two layers are deliberate: an instrument's approver is
fixed by its type, and the same rule applies to the repo itself.

## Roles and authority

| Role | Holds | Decides |
|---|---|---|
| **Board (HS Management)** | Ultimate accountability | Policies, standards and charters ([register](docs/governance/open-actions-register.md) item 18); target dates on the register's governance rows (item 17); ISO 42001 path (item 10); spend (e.g. persistence tier, item 23) |
| **HS MLRO** | The MLRO mandate | Procedures; compliance sign-offs; register acts within the mandate; the compliance impact call on [compliance-sensitive changes](CONTRIBUTING.md#compliance-sensitive-changes) |
| **Repo owner / maintainer** | The engineering estate | Merge authority; releases; engineering commitments (register items 20–28); everything [`MAINTAINERS.md`](MAINTAINERS.md) records |

Nothing here transfers Board or MLRO authority to the maintainer: a change to
this file that would alter *their* authority is itself a Board act.

## Merge authority

- `main` accepts pull requests only, with CODEOWNERS review and the required
  status checks. The authoritative settings list — exact values and rationale —
  is [`docs/governance/github-repository-hardening.md`](docs/governance/github-repository-hardening.md),
  encoded as config-as-code in [`.github/settings.yml`](.github/settings.yml)
  and drift-guarded by `test/protection-contexts.test.mjs`.
- `enforce_admins` is intentionally off: the sole maintainer merges
  owner-authored PRs after CI passes. That bypass is a **documented,
  risk-accepted** consequence of single-maintainer operation (risk **R-17**),
  not an oversight — see the hardening doc for the compensating controls.

## Release authority

A release is cut by merging an `APP_VERSION` bump to `main`
(`.github/workflows/auto-release.yml`). Publishing then waits on the protected
`release` environment — a human approval that belongs to the repo owner
(register item 3 calls this "the release gate working as designed"). Tags,
SBOM, Sigstore provenance and the container image all flow from that approval.

## Continuity

Single-maintainer key-person risk is carried openly as **R-17** in the
[AI risk register](docs/aims/ai-risk-register.md), mitigated by
[`docs/aims/bcp.md`](docs/aims/bcp.md), the
[setup runbook](docs/app-setup-runbook.md) (which enables a second operator),
and the succession record in [`MAINTAINERS.md`](MAINTAINERS.md). If the
maintainer is unavailable, HS Management designates a successor per the BCP;
the successor's first read is [`CLAUDE.md`](CLAUDE.md), which carries the
repo's enforced invariants.

## Amendments

Engineering-process changes to this file are a maintainer act via ordinary PR.
Anything touching Board or MLRO authority follows the register's rule: the
named owner signs, or it does not happen.
