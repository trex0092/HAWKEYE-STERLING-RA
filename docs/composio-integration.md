# Composio orchestration integration

Hawkeye Sterling can use Composio as an optional outer orchestration layer for business systems. The integration is deliberately separated from sanctions, adverse-media, PEP, risk scoring and runtime assurance. A Composio outage therefore cannot turn a screening result into a pass or a clear.

## Supported surfaces

The governed default toolkit set is:

- Asana
- Gmail
- Google Drive
- Slack
- GitHub

The server-side bridge supports the current Composio Tool Router session model, per-user sessions, connected-account authentication, toolkit and tool discovery, tool execution, account link flows, hosted MCP session metadata, trigger discovery and lifecycle management, signed webhook delivery, optional raw proxy execution, and session mount file operations.

The implementation uses the documented Composio HTTP API directly. Hawkeye therefore keeps its zero-runtime-dependency browser application and does not expose the Composio project key to client JavaScript.

## Files

| File | Purpose |
|---|---|
| `netlify/functions/_composio.js` | Server-only API adapter with session tool filters |
| `netlify/functions/_composio-engine-policy.js` | Default-deny read-tool policy and bounded arguments |
| `composio_engine.py` | Offline evidence-reference coverage and freshness checker; no credentials or network |
| `netlify/functions/composio-router.js` | Authenticated administration and execution endpoint |
| `netlify/functions/composio-webhook.js` | HMAC-verified trigger receiver |
| `test/composio-integration.test.mjs` | Boundary, read-tool policy, auth, cost/privacy and webhook tests |
| `test/mcp_tools_test.py` | Engine evidence-contract and local MCP privacy/fail-closed tests |
| `.env.example` | Required configuration and kill switches |
| `data/tool-surfaces.json` | Machine-readable connector registration |

## Go-live gates

Keep `COMPOSIO_ENABLED=0` until all of the following are complete:

1. The Composio DPA, subprocessors, retention terms, processing region and UAE PDPL transfer basis are recorded in the third-party register.
2. A least-privilege Composio project key has been created with the permissions needed for the selected session, connected-account, trigger and webhook operations.
3. `APP_SHARED_TOKEN` is configured. The Composio router refuses to operate without it.
4. Each connected business account has been approved, with the narrowest practical provider scopes.
5. The approved toolkit list is recorded in `COMPOSIO_TOOLKITS`; individual read-only tool slugs discovered from that live Composio project are reviewed for side effects and approved separately in `COMPOSIO_READ_TOOL_SLUGS`. No tool execution is allowed while this is empty.
6. Trigger delivery is used only after `COMPOSIO_WEBHOOK_SECRET` has been stored server-side.

## Configuration

Server-side environment:

```text
COMPOSIO_API_KEY=
COMPOSIO_ENABLED=0
COMPOSIO_TOOLKITS=asana,gmail,googledrive,slack,github
COMPOSIO_READ_TOOL_SLUGS=
COMPOSIO_ALLOW_HOSTED_MCP=0
COMPOSIO_ALLOW_ADMIN_MUTATIONS=0
COMPOSIO_ALLOW_ADVANCED_SESSION=0
COMPOSIO_ALLOW_PRESIGNED_URLS=0
COMPOSIO_BASE_URL=https://backend.composio.dev
COMPOSIO_ALLOW_PROXY=0
COMPOSIO_WEBHOOK_SECRET=<subscription signing secret>
COMPOSIO_WEBHOOK_TOLERANCE_SECONDS=300
RATE_LIMIT_COMPOSIO=30
APP_SHARED_TOKEN=<strong independent Hawkeye application secret>
```

Do not use the old generic secret name `COMPOSIO`. After its credential value has been migrated to `COMPOSIO_API_KEY` in the required server environments, remove the old secret.

## Engine evidence-reconciliation surface (no Composio API calls)

The local deterministic HAWKEYE MCP tool
\`hawkeye_assess_connected_evidence\` takes a
\`hawkeye.composio-evidence/v1\` **metadata-only** manifest.
It checks reference existence, query freshness, duplication and source outage,
never raw files, email bodies, Slack text, ID scans or customer names.

Supported references (not independently verified facts):

| Provider | Approved reference categories | Typical AML/KYC use |
|---|---|---|
| Asana | \`kyc_case\`, \`remediation\`, \`mlro_case\` | CDD case, missing-document follow-up, manual review record |
| Gmail | \`evidence_request\`, \`compliance_response\` | Source correspondence references, not the underlying messages |
| Google Drive | \`policy\`, \`provenance\`, \`identity_file\` | Approved policy, supply-chain origin and KYC file references, not document authenticity |
| Slack | \`review_thread\`, \`escalation_thread\` | Escalation discussion for locating the formal decision, never an MLRO authorization |
| GitHub | \`control_change\`, \`ci_result\`, \`deploy_record\` | Versioned change, assurance run, release record (does **not** prove the live Netlify site updated) |

First, a verified human/operator uses an approved connected account to read the
minimal reference metadata with named Composio tools. That trusted caller
selects the specific categories that are actually relevant and transforms the
provider response to this allowlisted shape, with an explicit date. Example,
entirely synthetic:

\`\`\`json
{
  "manifest": {
    "schema_version": "hawkeye.composio-evidence/v1",
    "as_of": "2026-10-09",
    "freshness_days": 30,
    "requirements": ["asana.kyc_case", "googledrive.provenance", "github.ci_result"],
    "observations": [
      {"check": "asana.kyc_case", "status": "available", "checked_at": "2026-10-09", "reference": "ASANA:synthetic-001"},
      {"check": "googledrive.provenance", "status": "not_found", "checked_at": "2026-10-09", "reference": null},
      {"check": "github.ci_result", "status": "error", "checked_at": "2026-10-09", "reference": null}
    ]
  }
}
\`\`\`

Status is \`available\`, \`not_found\`, \`unavailable\` or \`error\`.
\`reference\` is an opaque 8-128 character reference for an available entry and
\`null\` otherwise. \`requirements\` must have 1-16 distinct registered
\`source.category\` codes; \`observations\` is capped at 60, and unrequested
or vendor-native fields are rejected. A future-dated read or malformed date is
invalid. Duplicate observations for the same check are explicitly marked
ambiguous instead of choosing the favorable result. All states stay
**human-review required**; a located reference is not an approved policy,
authentic ID, complete CDD file, cleared sanctions/PEP screening, an authorized
release, or a filed MLRO decision.

The tool returns only check IDs, source categories and normalized states,
not original document IDs, message references, provider payloads or subject
names. It does not create a Composio account, connect to Composio, read email,
or change customer records. The existing outer Netlify endpoint remains the
**only** Composio network/credential surface; do not copy
\`COMPOSIO_API_KEY\` into the Python engine or a local MCP client.

### Exact read-tool scoping and costs

1. Keep \`COMPOSIO_ENABLED=0\` pending the vendor-assurance gate (OA-29).
2. Discover available tool slugs in an authorized Composio session using
   \`tools.list\` or \`tools.search\`. **Do not invent tool slug names.**
3. Review the actual tool schema, data transferred, side effects, OAuth scopes
   and external-provider billing/quota. Approve only necessary read operations
   and configure their comma-separated exact slugs in
   \`COMPOSIO_READ_TOOL_SLUGS\` as a server-side environment setting.
4. Prefer stable references, field-limited provider lookups, retained
   user-scoped sessions and an explicit result budget (8 KB of serialized
   arguments per call). Avoid polling, large file downloads and broad
   account-wide searches. The Netlify rate-limit bucket is per instance,
   **not** a global spend cap.
5. Leave raw proxy, hosted MCP, mutating admin operations, presigned files and
   remote session attachment disabled. These are separate high-trust services
   and are never exposed to the Python evidence checker or an AI model.

A Composio read-tool allowlist or a Composio API key is **not** a privacy,
vendor-assurance, production go-live or per-user RBAC approval. For current
Composio session/filter semantics, see
[Configuring Sessions](https://docs.composio.dev/docs/configuring-sessions).
Do not turn on additional toolkits simply because they exist in the catalog.

## Router

Endpoint:

```text
POST /.netlify/functions/composio-router
X-App-Token: <APP_SHARED_TOKEN>
Content-Type: application/json
```

### Create a per-user session

```json
{
  "action": "session.create",
  "user_id": "operator_123",
  "toolkits": ["asana", "gmail", "googledrive", "slack", "github"],
  "manageConnections": true,
  "mcp": false
}
```

Session tool filters are now enforced server-side from the EXACT read-only tool allowlist. Caller-supplied tool or workbench overrides are rejected; the default is a session with zero executable app tools. Hosted MCP sessions require a separately approved server setting (`COMPOSIO_ALLOW_HOSTED_MCP=1`) and may expose Composio's own meta tools, so **do not** enable this for an untrusted model or client. Persist the returned session ID in a trusted calling system and reuse it for the same verified user.

### Discover and execute tools

List tools:

```json
{
  "action": "tools.list",
  "session_id": "trs_..."
}
```

Search:

```json
{
  "action": "tools.search",
  "session_id": "trs_...",
  "query": {
    "query": "find unread compliance emails"
  }
}
```

Execute:

```json
{
  "action": "tools.execute",
  "session_id": "trs_...",
  "execution": {
    "tool_slug": "GMAIL_FETCH_EMAILS",
    "arguments": {}
  }
}
```

`tools.execute` now accepts **only an individually approved read-only Composio slug**, from an allowed toolkit, using at most 8,192 bytes of JSON arguments. A verb that resembles read-only is not evidence of side-effect safety: the human reviewer must inspect the actual Composio tool schema, authentication scopes and execution behavior. By default the configured slug allowlist is empty, so this example returns HTTP 403 until approved. `tools.execute_meta` permits schema/search metadata only: remote bash, remote workbench, account-modifying meta tools and bundled multi-execute are blocked. Composio tool arguments are passed to external providers; use narrow IDs and do not transmit full customer records or credentials.

## Account authentication

Use `auth.link` to request a Composio connection flow for one of the approved toolkits. The resulting authorization URL is completed by the human account owner. The Hawkeye router never accepts or stores the provider password.

Example:

```json
{
  "action": "auth.link",
  "session_id": "trs_...",
  "link": {
    "toolkit": "gmail"
  }
}
```

## Hosted MCP

A session created with `"mcp": true` can return hosted MCP metadata. Hawkeye itself does not connect its screening engines or Advisor model to that endpoint. It is available only as an integration surface for an explicitly approved external MCP client.

This does not change `model_tool_calling.enabled=false` in Hawkeye's capability register.

## Triggers

The router supports trigger type discovery and listing. Trigger creation, enable/disable, update and deletion require `COMPOSIO_ALLOW_ADMIN_MUTATIONS=1` on top of the disabled-by-default Composio master gate, and are **not available to the engine**. Session deletion, mount upload/delete and webhook subscription edits or secret rotation use the same high-privilege gate. Mount download URLs require `COMPOSIO_ALLOW_PRESIGNED_URLS=1`, and attaching remote sessions requires `COMPOSIO_ALLOW_ADVANCED_SESSION=1`. Do not enable these under a shared browser token; implement verified operator RBAC and independent approvals first.

Example trigger creation:

```json
{
  "action": "triggers.create",
  "user_id": "operator_123",
  "slug": "GITHUB_COMMIT_EVENT",
  "trigger_config": {
    "owner": "example",
    "repo": "example"
  }
}
```

Trigger actions only configure event delivery. They do not automatically run a Hawkeye compliance action.

## Signed webhook receiver

Configure the Composio project webhook subscription to deliver to:

```text
https://<hawkeye-host>/.netlify/functions/composio-webhook
```

Store the returned signing secret as `COMPOSIO_WEBHOOK_SECRET`.

The receiver verifies:

- `webhook-id`
- `webhook-timestamp`
- `webhook-signature`
- HMAC-SHA256 over `<id>.<timestamp>.<raw payload>`
- replay-window tolerance

A valid webhook is audit-labelled and acknowledged. It does not automatically execute a connected-app tool.

## Google Drive files and workbench mounts

Session mount operations are available through:

- `mount.items`
- `mount.upload_url`
- `mount.download_url`
- `mount.delete`

Presigned URLs should be treated as temporary credentials. Do not log them or persist them into public repository state.

Google Drive provider actions can also be discovered and executed through the normal Tool Router surface.

## Raw proxy execution

`proxy.execute` is implemented but disabled by default. It requires:

```text
COMPOSIO_ALLOW_PROXY=1
```

Keep this off unless a reviewed integration genuinely requires an authenticated provider API request that has no suitable named Composio tool. Named tools are easier to inventory and audit.

## Security boundaries

The integration preserves these constraints:

- `COMPOSIO_API_KEY` and `COMPOSIO_WEBHOOK_SECRET` are server-side only.
- Every router request requires `APP_SHARED_TOKEN`.
- The router has an independent rate-limit bucket.
- Toolkits are allow-listed.
- Raw proxy execution is a separate opt-in.
- Webhooks are signature-checked and replay-bounded.
- No screening result depends on Composio availability.
- No LLM in Hawkeye receives Composio tools.
- Trigger receipt does not automatically execute a tool.
- Provider connected accounts can be revoked independently of Hawkeye.

## Removal

To disable immediately:

```text
COMPOSIO_ENABLED=0
COMPOSIO_ALLOW_PROXY=0
```

Then revoke connected accounts in Composio and unset `COMPOSIO_API_KEY`.

For a complete removal, also delete the Composio webhook subscription and unset `COMPOSIO_WEBHOOK_SECRET`.
