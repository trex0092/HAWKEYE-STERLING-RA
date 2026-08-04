# Maintainers

## Current

| Role | Who | Scope |
|---|---|---|
| Maintainer / repo owner | [@trex0092](https://github.com/trex0092) | All paths (see [`.github/CODEOWNERS`](.github/CODEOWNERS)); merge + release authority per [`GOVERNANCE.md`](GOVERNANCE.md) |

Contact: GitHub issues for routine matters ([`SUPPORT.md`](SUPPORT.md)),
private security advisories for vulnerabilities ([`SECURITY.md`](SECURITY.md)).

## Succession

Single-maintainer operation is a recorded risk (**R-17**, residual Medium-12,
in [`docs/aims/ai-risk-register.md`](docs/aims/ai-risk-register.md)). If the
maintainer is unavailable:

1. **HS Management designates a successor** per
   [`docs/aims/bcp.md`](docs/aims/bcp.md). GitHub org/repo ownership transfer
   is theirs to execute.
2. The successor follows [`docs/app-setup-runbook.md`](docs/app-setup-runbook.md)
   to stand up a second operator environment, then reads
   [`CLAUDE.md`](CLAUDE.md) for the enforced invariants before touching code.
3. Credentials are never in this tree: secrets live in GitHub Actions and
   Netlify environment settings, inventoried by group in
   [`.env.example`](.env.example). Rotation on takeover is step one — the BCP
   drill (R-17's closing mitigation) rehearses exactly that.

Adding a maintainer is a change to this file plus CODEOWNERS, via PR, under
[`GOVERNANCE.md`](GOVERNANCE.md)'s amendment rule.
