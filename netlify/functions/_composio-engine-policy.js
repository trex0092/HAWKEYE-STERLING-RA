'use strict';

/* Conservative Composio read boundary for Hawkeye's business-app evidence.
 * A shared bearer token is NOT a user identity/MLRO approval. The tool router
 * must not expose the provider's mutating API as an unrestricted model tool.
 * Each read slug must be discovered via Composio, reviewed, then individually
 * approved in the deployment environment. Empty config is DENY ALL.
 *
 * Heuristic GET/LIST/SEARCH verbs are merely extra checks, NOT a substitute
 * for reviewing the actual upstream tool schema and OAuth scopes.
 */
const PREFIXES = Object.freeze({
  ASANA: 'asana',
  GMAIL: 'gmail',
  GOOGLEDRIVE: 'googledrive',
  SLACK: 'slack',
  GITHUB: 'github',
});
const READ_VERBS = new Set(['GET', 'LIST', 'FETCH', 'SEARCH', 'READ', 'QUERY', 'LOOKUP', 'CHECK']);
const SAFE_META = new Set(['COMPOSIO_SEARCH_TOOLS', 'COMPOSIO_GET_TOOL_SCHEMAS']);
const MAX_TOOL_ARGUMENT_BYTES = 8192;

function denial(reason) {
  const err = new Error(reason);
  err.statusCode = 403;
  throw err;
}

function readSlugs() {
  const raw = process.env.COMPOSIO_READ_TOOL_SLUGS || '';
  const slugs = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  if (slugs.length > 40) denial('Composio read-tool allowlist is too large');
  if (slugs.some(s => !/^[A-Z][A-Z0-9_]{3,119}$/.test(s)))
    denial('Invalid Composio approved read-tool configuration');
  return new Set(slugs);
}

function checkedSlug(slug, allowedToolkits) {
  if (typeof slug !== 'string' || !/^[A-Z][A-Z0-9_]{3,119}$/.test(slug))
    denial('A reviewed tool_slug is required');
  const parts = slug.split('_');
  if (parts.length < 3 || !PREFIXES[parts[0]] ||
      !READ_VERBS.has(parts[1]) ||
      !Array.isArray(allowedToolkits) ||
      !allowedToolkits.includes(PREFIXES[parts[0]]))
    denial('Composio tool outside approved read-only toolkit/action policy');
  if (!readSlugs().has(slug))
    denial('Composio tool has no explicit operator approval');
  return slug;
}

function readExecution(body, allowedToolkits) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(k => !['tool_slug', 'arguments', 'account'].includes(k)))
    denial('Invalid Composio read-tool envelope');
  const tool = checkedSlug(body.tool_slug, allowedToolkits);
  if (!body.arguments || typeof body.arguments !== 'object' ||
      Array.isArray(body.arguments))
    denial('Read-tool arguments must be a JSON object');
  let length = 0;
  try {
    length = Buffer.byteLength(JSON.stringify(body.arguments), 'utf8');
  } catch (_) {
    denial('Read-tool arguments must be bounded JSON');
  }
  if (!length || length > MAX_TOOL_ARGUMENT_BYTES)
    denial('Composio read-tool argument budget exceeded');
  if (body.account !== undefined &&
      (typeof body.account !== 'string' ||
       !/^[A-Za-z0-9_:@.-]{1,100}$/.test(body.account)))
    denial('Invalid Composio connected-account reference');
  return { tool_slug: tool, arguments: body.arguments,
    ...(body.account === undefined ? {} : { account: body.account }) };
}

function readMetaExecution(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(k => !['slug', 'arguments'].includes(k)))
    denial('Invalid Composio meta-tool envelope');
  if (!SAFE_META.has(body.slug))
    denial('Composio remote shell, multi-execute and account-changing meta tools are disabled');
  if (body.arguments !== undefined &&
      (typeof body.arguments !== 'object' || !body.arguments ||
       Array.isArray(body.arguments)))
    denial('Composio metadata search arguments must be an object');
  const raw = JSON.stringify(body.arguments || {});
  if (Buffer.byteLength(raw, 'utf8') > 2048)
    denial('Composio metadata-search budget exceeded');
  return { slug: body.slug, arguments: body.arguments || {} };
}

function approvedSessionTools(toolkits) {
  const approved = [...readSlugs()];
  const output = {};
  for (const toolkit of toolkits) {
    const prefix = Object.entries(PREFIXES).find(([, name]) => name === toolkit)?.[0];
    const enabled = approved.filter(slug => {
      try {
        return prefix && checkedSlug(slug, toolkits) && slug.startsWith(prefix + '_');
      } catch (_) { return false; }
    });
    // Explicit empty enable: Composio treats omitted tool filters as broad
    // discovery/execution, while an empty enable list means no app tools.
    output[toolkit] = { enable: enabled };
  }
  return output;
}

function hostedMcpAllowed() {
  return /^(1|true|yes|on)$/i.test(process.env.COMPOSIO_ALLOW_HOSTED_MCP || '');
}

module.exports = {
  readSlugs, readExecution, readMetaExecution, approvedSessionTools,
  hostedMcpAllowed,
  _test: { denial, PREFIXES, SAFE_META, MAX_TOOL_ARGUMENT_BYTES },
};
