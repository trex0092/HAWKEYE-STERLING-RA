# CLAUDE.md — repo invariants for AI agents (and second operators)

Read this before changing anything. Every rule below is **enforced by CI** —
this file exists so you learn them here instead of by breaking the build.
The operating principle everywhere is **degrade loudly, never silently**: a
control that cannot verify itself fails red; never write code that reports
green on unverified state.

## What this is

An AML/CFT entity risk-assessment platform for a UAE precious-metals dealer,
in three surfaces:

1. **Static web app** (`index.html`/`app.js`, `console.*`, `advisor.*`) —
   zero-build, zero-runtime-dependency, deployed as-is to Netlify.
2. **Python screening engine** (`screen.py` + `ai.py`, `kyc.py`,
   `txn_monitor.py`, `monitoring.py`, `agents.py`, `str_dossier.py`) — runs in
   scheduled GitHub Actions, delivers alerts to Asana.
3. **MCP server** (`mcp_server.py`/`mcp_tools.py`) — stdlib-only stdio bridge
   exposing the engine to AI agents.

## Hard invariants (each has a CI guard)

- **Zero runtime dependencies.** `package.json` has no `dependencies` and the
  Python engine pins everything in `ci/requirements.txt` (hash-locked). Do not
  add a runtime dep to either surface; the MCP server stays stdlib-only.
- **Pure-`'self'` CSP.** No inline `<script>`, no inline styles or `on*`
  handlers, no third-party origins, self-hosted fonts. JS uses event
  delegation; style changes go through the CSSOM. Guard: `test/csp.test.mjs`.
- **Semgrep bans** (`.semgrep/hawkeye.yml`, blocking): no string-to-code
  (`eval`/`new Function`), no `document.write`, no `child_process` in scripts
  (use `fetch`; the one sanctioned exception is annotated in
  `scripts/run-tests.mjs`), no `process.env` reads in client-side JS; Python:
  no `eval`/`exec`, no `shell=True`, no `pickle`.
- **No secrets in the tree** (`.gitleaks.toml`; value-based allowlist only).
  Secrets live in GitHub Actions / Netlify environment settings.
- **The former entity name is banned.** `test/brand-guard.test.mjs` scans the
  whole tree for the pre-rebrand name (pattern assembled from parts inside the
  guard so it never matches itself). Never write that name anywhere — refer to
  "the former entity name" and let the guard's source define it.
- **Legal citations are guarded.** Repealed instruments must not be cited as
  operative law. `test/legal-citations.test.mjs` knows which; run it after
  touching any document that cites legislation.
- **Screening is recall-monotone.** Matcher changes must never lower recall:
  benchmark floors (`test/fixtures/screening-benchmark/floors.json`) only
  ratchet up, and the Python and JS matchers must agree
  (`test/matcher-parity.test.mjs`). If a "fix" drops a true positive, it is
  wrong even if precision improves.

## The version quintet

`APP_VERSION` in `app.js` is the single source; `package.json`,
`pyproject.toml`, `CITATION.cff` and `SERVER_VERSION` in `mcp_server.py` must
match it (guard: `test/changelog.test.mjs`). Merging an `APP_VERSION` bump to
`main` triggers `auto-release.yml` — publishing waits on the protected
`release` environment, but treat a version bump as a release decision, and
give the released version its own `## [x.y.z]` CHANGELOG section in the same
PR.

## Tests

- Suites are hand-rolled `check(name, cond)` harnesses — **no pytest, no
  jest**. Match that style.
- `npm test` (= `scripts/run-tests.mjs`) runs every `test/*.test.{js,mjs}`,
  the Python suites, and the generated-artefact drift checks — the same set as
  CI, sequentially.
- **Wiring is enforced in both directions** by `test/ci-coverage.test.mjs`: a
  new `test/*` file must be listed in `.github/workflows/ci.yml`, and every
  listed suite must exist. Prefer **extending an existing suite** — it needs
  no wiring at all.

## Generated artefacts (regen in the same commit, or CI reds)

| You changed | Run |
|---|---|
| `docs/governance/open-actions-register.md`, `data/obligations.json`, appetite/risk data | `node scripts/grc-metrics.mjs --write` |
| Added/removed any `docs/**/*.md` or workflow | `node scripts/board-figures.mjs --write` **and** update the newest "Verified at HEAD" line in `docs/governance/enterprise-readiness-review-2026.md` §18 |

`npm test` runs both `--check` modes and names the regen command on drift.

## Register discipline (`docs/governance/open-actions-register.md`)

Item numbers are stable IDs parsed by tests — never renumber. One state change
per PR. Never mark a human act done without the named owner's evidence. Target
dates on the governance rows are a **Board** act (item 17); only
maintainer-owned engineering rows carry maintainer-set dates.

## Local commands

```bash
npm ci                # dev toolchain (no runtime deps)
npm test              # every suite CI runs + drift checks
npm run lint          # ESLint; npm run lint:html for HTMLHint
ruff check .          # Python lint (pyflakes-level, deliberate)
python test/engine_test.py   # engine suite directly
```

## Authority

Engineering decisions are the maintainer's; Board/MLRO authority is fixed by
[`GOVERNANCE.md`](GOVERNANCE.md) — respect it in docs you touch: never write a
sign-off, approval, or date that belongs to a named human role.
