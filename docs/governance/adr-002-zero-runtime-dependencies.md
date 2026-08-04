# ADR-002 — Zero Runtime Dependencies

**Status:** Accepted (in force since first release; recorded retroactively
2026-08-04) · **Owner:** Maintainer · **Revisit:** on any trigger in §4.

The served application has **no runtime npm dependencies**, the MCP server is
**stdlib-only Python**, and the screening engine's only runtime deps are
hash-locked in `ci/requirements.txt`. This record states why, because "just
add a library" is the most natural wrong move a new contributor or AI agent
can make here.

## 1. Context

- The app is a static tree served as-is (`netlify.toml` publishes the repo
  root; no build step). Every byte served is a byte reviewed in a PR.
- This is a compliance tool: the supply chain is part of the audit surface.
  A single compromised transitive package would sit inside the CSP origin
  and inherit everything the app can do.
- OpenSSF Scorecard, `dependency-review`, OSV and Dependabot already police
  the **dev** toolchain — the cheapest way to keep the **runtime** surface
  clean is for it to stay empty.

## 2. Decision

- `package.json` carries `devDependencies` only. No runtime npm package,
  no CDN script, no bundler. App logic is hand-written in `app.js`,
  `console.js`, `advisor.js`.
- `mcp_server.py` implements MCP's stdio JSON-RPC framing in the standard
  library — no `mcp` SDK, no FastMCP — so exposing the engine to AI agents
  added **zero** new supply-chain surface.
- The Python engine may use runtime deps, but only pinned by hash in
  `ci/requirements.txt` and installed with `--require-hashes`.

## 3. Consequences

**Gained:** the served origin contains only first-party code; SBOMs are
short and honest; Scorecard/dependency gates stay tractable; the MCP server
runs anywhere Python 3.11 does.
**Paid:** conveniences are re-implemented by hand (fuzzy matching in
`scripts/sanctions-match.mjs`, JSON-RPC framing, UI components); some of that
hand-rolling created the dual-matcher burden ADR-005 records.

## 4. Revisit triggers

(a) a required capability that is genuinely unreasonable to hand-write
(e.g. a cryptographic protocol); (b) the firm adopts a build step for an
unrelated reason, changing the review model; (c) the MCP protocol drifts far
enough that stdlib framing becomes a correctness risk. Any adoption goes
through the model-validation change procedure and updates the SBOM story.
