# OpenSSF Best Practices badge — evidence pack

The last OpenSSF Scorecard point the repository cannot earn from code alone is
**CII-Best-Practices**: it requires a (free) self-attested badge on
[bestpractices.dev](https://www.bestpractices.dev/en). Only the project owner
can register (it authenticates via your GitHub account). This document maps
every **passing**-level criterion to the evidence already in this repository,
so the questionnaire is a copy-through.

**How to register (≈10 minutes):**

1. Sign in at <https://www.bestpractices.dev/en> with GitHub.
2. *Add project* → repository URL `https://github.com/trex0092/HAWKEYE-STERLING-RA`.
3. Answer the passing-level questions using the table below (most are "Met").
4. When the badge shows **passing**, Scorecard's weekly run picks it up
   automatically (or dispatch the *Scorecard supply-chain security* workflow).
5. Optional: add the badge to `README.md` under the existing badges:
   `[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/<ID>/badge)](https://www.bestpractices.dev/projects/<ID>)`

## Passing-criteria evidence map

| Criterion | Answer | Evidence |
|---|---|---|
| Project website / description | Met | `README.md`, live site <https://hawkeye-sterling-ra.netlify.app> |
| Information on how to contribute | Met | `CONTRIBUTING.md` (process, checks, branch rules) |
| Contribution requirements stated | Met | `CONTRIBUTING.md` + PR template (`.github/PULL_REQUEST_TEMPLATE.md`) |
| FLOSS license | **Unmet** (proprietary — deliberate) | `LICENSE`; answer honestly: the license criteria allow "Met" only for FLOSS. Mark the license questions as Unmet; passing tolerates a small number of Unmet where justified — every other criterion holds. |
| License posted in standard location | Met | `/LICENSE` |
| Basic documentation | Met | `README.md`, `docs/` (99+ files: user guides, API, architecture) |
| HTTPS for project sites | Met | GitHub + Netlify (HSTS preload, `netlify.toml`) |
| Discussion mechanism | Met | GitHub Issues with templates (`.github/ISSUE_TEMPLATE/`) |
| English supported | Met | All docs in English |
| Version control (public, tracked) | Met | GitHub, full history |
| Unique version numbering | Met | `APP_VERSION` (semver) — synced across `package.json` / `pyproject.toml` / `CITATION.cff` by `test/changelog.test.mjs` |
| Release notes per release | Met | Auto-generated notes on every release + `CHANGELOG.md` (Keep-a-Changelog, CI-gated) |
| Bug-reporting process | Met | Issue templates; `SUPPORT.md` |
| Vulnerability-reporting process | Met | `SECURITY.md` (private disclosure, SLAs) |
| Working build system | Met | Build-less by design; `npm ci` restores the pinned dev toolchain |
| Automated test suite | Met | 46 Node suites + 4 Python suites + Playwright, all wired in CI (`test/ci-coverage.test.mjs` enforces no orphan tests) |
| New functionality includes tests | Met | Policy in `CONTRIBUTING.md`; enforced culturally + CI coverage guard |
| Warning flags / linters enabled | Met | ESLint (blocking), HTMLHint, actionlint + zizmor (blocking), Semgrep app invariants (blocking) |
| Secure development knowledge | Met | `docs/architecture.md` (STRIDE), `docs/governance/` (AIMS, DPIA), hardening history in `CHANGELOG.md` |
| Use basic good cryptographic practices | Met | AES-256-GCM at rest (Web Crypto), SHA-256 hash-chained audit log, timing-safe token compare (`netlify/functions/_auth.js`); no custom crypto |
| Secured delivery against MITM | Met | HTTPS + HSTS everywhere; SHA-pinned actions; hash-locked pip; lockfile-pinned npm |
| Publicly known vulnerabilities fixed | Met | Dependabot + OSV-Scanner + Dependency Review (blocking); Scorecard Vulnerabilities = 10 |
| Static code analysis | Met | CodeQL (all commits) + Semgrep + zizmor + gitleaks |
| Dynamic analysis | Met | ZAP DAST workflow (`dast-zap.yml`), Playwright runtime CSP checks, **property-based fuzzing** (fast-check + hypothesis) |

## Beyond passing

Silver/gold need: two-person review (single-maintainer today — see
`settings.yml` rationale), signed releases (already: Sigstore bundle +
`.intoto.jsonl` provenance on every release since v3.7.2, backfilled for
v3.7.1), and reproducible builds (the release tarball is a deterministic
`git archive`). Revisit when a second maintainer joins.
