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
| `netlify/functions/_composio.js` | Server-only API adapter |
| `netlify/functions/composio-router.js` | Authenticated administration and execution endpoint |
| `netlify/functions/composio-webhook.js` | HMAC-verified trigger receiver |
| `test/composio-integration.test.mjs` | Boundary, authentication and webhook tests |
| `.env.example` | Required configuration and kill switches |
| `data/tool-surfaces.json` | Machine-readable connector registration |

## Go-live gates

Keep `COMPOSIO_ENABLED=0` until all of the following are complete:

1. The Composio DPA, subprocessors, retention terms, processing region and UAE PDPL transfer basis are recorded in the third-party register.
2. A least-privilege Composio project key has been created with the permissions needed for the selected session, connected-account, trigger and webhook operations.
3. `APP_SHARED_TOKEN` is configured. The Composio router refuses to operate without it.
4. Each connected business account has been approved, with the narrowest practical provider scopes.
5. The approved toolkit list is recorded in `COMPOSIO_TOOLKITS`.
6. Trigger delivery is used only after `COMPOSIO_WEBHOOK_SECRET` has been stored server-side.

## Configuration

Server-side environment:

```text
COMPOSIO_API_KEY=<project API key>
COMPOSIO_ENABLED=0
COMPOSIO_TOOLKITS=asana,gmail,googledrive,slack,github
COMPOSIO_BASE_URL=https://backend.composio.dev
COMPOSIO_ALLOW_PROXY=0
COMPOSIO_WEBHOOK_SECRET=<subscription signing secret>
COMPOSIO_WEBHOOK_TOLERANCE_SECONDS=300
RATE_LIMIT_COMPOSIO=30
APP_SHARED_TOKEN=<strong independent Hawkeye application secret>
```

Do not use the old generic secret name `COMPOSIO`. After its credential value has been migrated to `COMPOSIO_API_KEY` in the required server environments, remove the old secret.

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
  "mcp": true
}
```

Sessions can be restricted further with auth configs, connected accounts, per-toolkit tool policy and preload settings. Persist the returned Composio session ID in the calling system and reuse it rather than creating a new session for every turn.

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

Composio tool arguments are passed to the selected external provider. Do not send a full customer record when the action only needs a task ID, document ID, email ID, or other narrow identifier.

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

The router supports trigger type discovery, creation, listing, enabling, disabling, updating and deletion.

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
