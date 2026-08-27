# MCP Server — Hawkeye Sterling AML/CFT engine

The **Model Context Protocol (MCP)** server exposes the Hawkeye Sterling
screening engine — sanctions/watchlist name screening, transaction monitoring,
KYC/CDD gap analysis and jurisdiction-risk tiering — as MCP **tools**,
**resources** and **prompts** that an AI agent (Claude Desktop, an SDK client,
or the MCP Inspector) can discover and call.

MCP is the open standard that lets an AI model connect to external tools and
data through one uniform interface. This server is the bridge between an agent
and the deterministic AML engine that already powers the daily screening
workflow.

## Why it exists

The engine's matchers and monitors are deterministic, auditable and
already-tested. Wrapping them as MCP tools lets a compliance analyst drive them
conversationally ("screen this UBO against these names", "what CDD gaps does this
KYC note have?") while the **decisions stay with the human MLRO** — every tool is
decision-support only, exactly like the rest of the system.

## Zero new dependencies

Consistent with the rest of this repository (the web app ships no runtime npm
dependencies; the engine's only runtime pins are its matcher libraries), the
server implements the MCP **stdio transport** — newline-delimited JSON-RPC 2.0
over stdin/stdout — in the Python standard library alone. There is no
`mcp`/FastMCP install and therefore **no new supply-chain surface**: nothing was
added to `ci/requirements.txt`.

- `mcp_server.py` — the stdio JSON-RPC 2.0 transport (protocol only).
- `mcp_tools.py` — the pure, deterministic wrappers over `screen.py`,
  `kyc.py` and `txn_monitor.py` (business logic; no protocol code).
- `test/mcp_tools_test.py` — unit tests for both, wired into `ci.yml`.

## Running it

```bash
# The engine's runtime deps must be importable (rapidfuzz/pdfplumber); install
# the pinned set once, then start the server on stdio:
pip install --require-hashes -r ci/requirements.txt
python3 mcp_server.py
```

Point any MCP client at that command. Protocol diagnostics go to **stderr**;
only JSON-RPC frames go to **stdout**. Example Claude Desktop config entry:

```json
{
  "mcpServers": {
    "hawkeye-sterling": { "command": "python3", "args": ["mcp_server.py"] }
  }
}
```

## Tools

All tools are **read-only**, **deterministic**, **offline** and
**decision-support only**. Arguments arrive from an LLM and are treated as
untrusted: each is type-checked and size-capped before it reaches the engine.

| Tool | Purpose |
| --- | --- |
| `hawkeye_normalize_name` | Canonicalise a name the way the matcher does (transliteration, diacritics, phonetic tokens). |
| `hawkeye_screen_name` | Fuzzy-screen a subject against a caller-supplied list of names; returns matches with score/confidence/context or an explicit CLEARED result. |
| `hawkeye_screen_internal_watchlist` | Screen against the firm's committed internal watchlist (`data/internal-watchlist.json`); an empty list is a valid "no designations" state, never a degraded screen. |
| `hawkeye_monitor_transactions` | Run the FATF R.16 rule-set (cash threshold, structuring, velocity, round-amount, high-risk geography, CDD trigger) over one customer's transactions. |
| `hawkeye_analyze_kyc_note` | Parse a structured KYC note into identity records + the CDD gaps an MLRO must close; ID numbers are privacy-masked. |
| `hawkeye_jurisdiction_risk` | Return the FATF / locally-designated risk tier for a country and/or principals' nationalities. |
| `hawkeye_name_variants` | Expand a name into the transliteration-equivalent spellings the matcher screens under (Mohammed/Muhammad, Abdul/Abdel, bin/ibn …) — makes fuzzy-match recall transparent. |
| `hawkeye_adverse_media_scan` | Deterministically scan a headline for the adverse-media keyword taxonomy (fraud, laundering, sanctions, corruption, terrorism …); no model, so it never invents an allegation. |
| `hawkeye_assemble_str_dossier` | Assemble a **DRAFT** goAML-aligned STR dossier from a case object; rejects an incomplete case with the exact missing fields. Draft only — the MLRO verifies and files. |
| `hawkeye_assemble_tfs_dossier` | Assemble a **DRAFT** FFR/PNMR dossier for a Targeted Financial Sanctions list hit (UN Consolidated List / UAE Local Terrorist List); recommends the report kind, never files or freezes. The TFS counterpart of `hawkeye_assemble_str_dossier`. |
| `hawkeye_compute_risk_rating` | Compute a LOW/MEDIUM/HIGH customer risk rating (FATF R.10) from already-known hits/PEP/adverse-media/CDD-gap findings, with contributing factors and the EDD requirement. Deterministic; does not itself screen anything. |
| `hawkeye_related_parties` | Surface hidden links across a book of customers: a shared owner/UBO across two or more customers, or a UBO who is also a customer entity. Pure graph analysis, no model. |

## Resources (read-only reference data)

| URI | Contents |
| --- | --- |
| `hawkeye://reference/jurisdiction-risk` | The maintained higher-risk jurisdiction list. |
| `hawkeye://reference/internal-watchlist` | The firm-internal watchlist file. |

## Prompts

| Name | Purpose |
| --- | --- |
| `adverse_media_triage` | Grounded template to classify whether an adverse-media headline is about a subject, with the engine's anti-hallucination + prompt-security contract (`<<UNTRUSTED>>` markers). |
| `str_dossier_outline` | Outline the grounds for a **DRAFT** goAML suspicious-transaction report — draft only; the MLRO verifies and files. |

## Protocol surface

`initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`,
`resources/list`, `resources/read`, `prompts/list`, `prompts/get`. Tool errors
(bad arguments, unknown tool, engine faults) are returned **in-band** as an MCP
result with `isError: true` so the model sees the message and can correct itself;
malformed JSON yields a JSON-RPC `-32700` frame and never crashes the loop.

## Safety posture

- **No decisions.** Nothing here onboards, files, freezes or declines.
- **Deterministic.** No model call, no network, no randomness — same input, same
  output, fully auditable.
- **Untrusted input.** Every argument is validated and capped at the boundary.
- **No secrets.** The server reads no credentials and returns none; it only
  wraps the local deterministic engine.

## Audit trail

Tool calls arriving over MCP record to the same append-only `agents.AgentLog`
every other engine entry point uses (added 2026-08-04 — MCP was briefly the
one unlogged path into the engine). The server acts as **`McpAgent`**, whose
allow-list is exactly `["mcp.tool"]`:

- Every call appends `{agent, action, detail, authorized, ok}` — the detail is
  `<tool>: <outcome>` where outcome is `ok`, `unknown-tool`,
  `invalid-arguments`, `missing-tool-name` or `error:<ExceptionType>`.
- **Argument values never enter the trail** — screening subjects are PII and
  the trail is renderable into reports. Outcome labels only.
- The same line is mirrored to stderr (stdout stays reserved for JSON-RPC
  frames), so a session transcript shows what was called without showing who
  was screened.
- `McpAgent` holds no credentialed action: `agents.CredentialBroker` can never
  issue it a secret. Guards: the audit-trail section of
  [`test/mcp_tools_test.py`](../test/mcp_tools_test.py).
