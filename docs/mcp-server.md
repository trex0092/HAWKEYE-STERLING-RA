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
| `hawkeye_screen_payment` | Screen the **parties of one payment** — originator, beneficiary, ultimate parties, banks in the chain and the payment reference — against a caller-supplied list. Reads a raw SWIFT MT103 or ISO 20022 pacs.008 message, or a `parties` array; flags FATF-listed party countries and a missing originator/beneficiary name (R.16). A potential match means hold the payment and apply POL-07. |
| `hawkeye_screen_internal_watchlist` | Screen against the firm's committed internal watchlist (`data/internal-watchlist.json`); an empty list is a valid "no designations" state, never a degraded screen. |
| `hawkeye_monitor_transactions` | Run the deterministic transaction-monitoring rules over one customer's supplied transaction records, including cash and gold trade-route/provenance evidence; MLRO review only. |
| `hawkeye_analyze_kyc_note` | Parse structured KYC notes, CDD gaps and operator-selected country PEP coverage QA reminders (Turkey, India, Papua New Guinea). The reminders are not PEP matches; identifiers are masked. |
| `hawkeye_compare_document_evidence` | Opt-in comparison of approved normalized document OCR evidence with one explicitly selected KYC individual. Privacy-safe field statuses, expiry and review findings; never an authenticity or identity verification result. |
| `hawkeye_assess_connected_evidence` | Offline assessment of metadata-only references from approved Composio Asana, Gmail, Drive, Slack and GitHub reads; flags missing, stale, unavailable or conflicting references. No connector calls, no customer data or automatic decisions. |
| `hawkeye_jurisdiction_risk` | Return the FATF / locally-designated risk tier for a country and/or principals' nationalities. |
| `hawkeye_name_variants` | Expand a name into the transliteration-equivalent spellings the matcher screens under (Mohammed/Muhammad, Abdul/Abdel, bin/ibn …) — makes fuzzy-match recall transparent. |
| `hawkeye_adverse_media_scan` | Deterministically scan a headline for the adverse-media keyword taxonomy (fraud, laundering, sanctions, corruption, terrorism …); no model, so it never invents an allegation. |
| `hawkeye_assemble_str_dossier` | Assemble a **DRAFT** goAML-aligned STR dossier from a case object; rejects an incomplete case with the exact missing fields. Draft only — the MLRO verifies and files. |
| `hawkeye_assemble_tfs_dossier` | Assemble a **DRAFT** FFR/PNMR dossier for a Targeted Financial Sanctions list hit (UN Consolidated List / UAE Local Terrorist List); recommends the report kind, never files or freezes. The TFS counterpart of `hawkeye_assemble_str_dossier`. |
| `hawkeye_compute_risk_rating` | Compute a LOW/MEDIUM/HIGH customer risk rating (FATF R.10) from already-known hits/PEP/adverse-media/CDD-gap findings, with contributing factors and the EDD requirement. Deterministic; does not itself screen anything. |
| `hawkeye_related_parties` | Surface hidden links across a book of customers: a shared owner/UBO across two or more customers, or a UBO who is also a customer entity. Pure graph analysis, no model. |


## Gold shipment route and PEP coverage QA (operator-supplied evidence only)

`hawkeye_monitor_transactions` now checks four gold-specific review states
using **explicit fields**, never guessed from the payment counterparty or a
customer's country. The transaction-monitoring engine is **inactive in daily
production** until an approved and complete transaction feed is connected.

| Rule | Required evidence | Outcome |
| --- | --- | --- |
| `GOLD_ROUTE_DEVIATION` | `gold_trade: true`; nonempty `gold_route_planned` and `gold_route_actual` (ordered two-letter country codes) | Actual route differs from documented agreed route |
| `GOLD_ROUTE_CHANGE` | `gold_trade: true`, `gold_route_changed_after_contract: true` | Post-contract route or consignee change |
| `GOLD_ORIGIN_UNVERIFIED` | `gold_trade: true`, `gold_origin_verified: false` | Origin explicitly cannot be verified |
| `GOLD_ROUTE_UNREADABLE` | `gold_trade: true` plus malformed supplied route | Require manual route verification, without hiding findings on other transactions |

For example, a **synthetic** transaction may carry these additional keys:

```json
{
  "gold_trade": true,
  "gold_route_planned": ["GH", "AE"],
  "gold_route_actual": ["GH", "TR", "AE"],
  "gold_route_changed_after_contract": true,
  "gold_origin_verified": false
}
```

The Payments Register supports `Gold trade (yes/no)`, `Gold planned route
(ISO2 comma separated)`, `Gold actual route (ISO2 comma separated)`,
`Gold route changed after contract (yes/no)` and `Gold origin verified
(yes/no)`. These also map to optional feed fields in
`data/transaction-feed.schema.json`. The rules inspect documentary evidence
only: **no automatic STR filing, risk classification, customer refusal, TFS
freeze or assumption of criminal conduct**. Invalid source data must be
corrected by an authorized reviewer; no shipments or customer details may
be committed to GitHub.

`hawkeye_analyze_kyc_note` adds a nullable `pep_country_qa` field for
each individual. For three **operator-selected QA test examples** (Turkey,
India and Papua New Guinea), this returns `PEP_COVERAGE_SPOT_CHECK`:
a reminder to inspect PEP/RCA name matching, variant/transliteration support,
source quality, and manual evidence. No match is implied by citizenship,
no country's app risk score is changed, and the output contains no
independent PEP determination. A missing public-source PEP hit is not a
definitive negative screen. All PEP/RCA screening and any positive findings
remain subject to appropriate independent corroboration and MLRO review.

The country score suggestions remain unchanged. In particular, **none of
the 53 lower recommendations is applied** by this PR, preserving existing
artisanal-gold high-risk/EDD escalation pending separately documented
model validation and MLRO signoff. Country Risk Asana task edits are
outside this branch's scope.

## Optional document evidence comparison (not production OCR)

The vendor-neutral adapter in \`kyc_document_evidence.py\` accepts normalized
document evidence, **not** photos, PDF files, images, base64 data, document
scans or a raw Doubango JSON payload. It has no OCR engine, model, network
calls, third-party library dependency or background processing. This design
reuses the *concept* of structured extraction without copying licensed
Doubango code or models.

The read-only \`hawkeye_compare_document_evidence\` tool must be invoked
explicitly; no scheduled screening, onboarding, scoring, CDD record, Asana
case or risk decision is changed. This feature is a **pilot-only comparison
capability** until the MLRO formally approves scope, DPIA, provider contract,
handling policy, retention and operational safeguards.

Synthetic example, with all identifiers fictitious:

\`\`\`json
{
  "notes": "SECTION 4\nIndividual 1 - Director\nName: Test Person\nNationality: Testland\nPassport/ID: XY000111\nPassport Expiry: 2030-01-01\nDate of Birth: 1990-01-01\nProof of Address: Obtained\n",
  "person_index": 0,
  "as_of": "2026-10-09",
  "evidence": {
    "schema_version": "hawkeye.document-evidence/v1",
    "evidence_id": "SYNTHETIC:document-01",
    "source": "synthetic_fixture",
    "document_type": "passport",
    "extraction_status": "extracted",
    "fields": {
      "full_name": "Test Person",
      "date_of_birth": "1990-01-01",
      "document_number": "XY000111",
      "expiry_date": "2030-01-01",
      "nationality": "Testland"
    }
  }
}
\`\`\`

The allowed \`document_type\` values are \`passport\`, \`emirates_id\`,
\`other_id\`, and \`unknown\`. \`fields\` may include only \`full_name\`,
\`date_of_birth\`, \`document_number\`, \`expiry_date\`,
\`nationality\`, and \`issuing_country\`. The last field is retained as
evidence context but **not compared** against the customer's country,
because issuing jurisdiction and nationality/customer domicile are different
concepts. Unknown/other document types do not borrow the passport/EID number
or expiry fields. \`extraction_status\` is \`extracted\` or \`failed\`.
A failed extraction must have no populated fields.

A provider-specific adapter must independently map vendor JSON to this
allowlist. Never accept its default/undocumented fields without review.
For multiple KYC individuals the operator must choose the zero-based
\`person_index\`; no name-based automatic association is performed.
The comparison reports \`MATCH\`, \`MISMATCH\`, missing/unreadable or
\`NOT_COMPARABLE\` per field, with \`EXPIRED\` for a document expiring
on or before \`as_of\`. The output contains no raw extracted values,
document number, date of birth or name. Existing CDD gaps remain unchanged.
The result **never** establishes identity, document authenticity, liveness,
fraud, onboarding eligibility or sanction clearance.

**Privacy and threat boundaries:** Only synthetic data should be sent through
an LLM-facing MCP tool until customer-PII egress and client retention are
approved. A real operational service must add authorized confidential intake,
transport and storage encryption, access control, malware/file validation,
retention/deletion enforcement, input image redaction rules, processor and
subprocessor due diligence, regional transfer assessment and operator audit.
No customer photos, ID numbers or unredacted outputs belong in GitHub logs,
issues, fixtures or repository history. Raw KYC notes still pass through the
MCP tool at invocation time, so client/transport confidentiality is essential.

Run the existing offline harness for regression checks:

\`\`\`bash
python test/mcp_tools_test.py
\`\`\`

## Resources (read-only reference data)

| URI | Contents |
| --- | --- |
| `hawkeye://reference/jurisdiction-risk` | The maintained higher-risk jurisdiction list. |
| `hawkeye://reference/fatf-assessments` | FATF black/grey lists with each jurisdiction's action-plan assessment, quoted from the FATF statements with source URLs. |
| `hawkeye://reference/country-indicators` | Public-source country context (US INCSR major money-laundering jurisdictions, US TIP tiers, EU tax list Annex I), each with publisher, edition, date and source URL. Never scored. |
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
