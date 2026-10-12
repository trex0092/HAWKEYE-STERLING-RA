/* Source-gated local legal retrieval. No LLM call, vector store or egress.

   Only counsel/MLRO-verified obligation citations with a trusted official-source
   host are eligible. A query returning nothing MUST become "insufficient
   verified sources", not a fabricated statute or an implicit legal clearance.

   TRUST BOUNDARY: caller must provide the trusted host allowlist and verified
   server-side user role. Never accept these from untrusted browser parameters.
*/
import { createHash } from 'node:crypto';

const ELIGIBLE_ROLES = new Set(['Analyst', 'Reviewer-MLRO', 'Admin']);
const TENANT_ID = /^[A-Za-z0-9._:-]{1,96}$/;
const CITATION_KEYS = ['article', 'basis', 'locator', 'quote', 'source_url', 'verified_by', 'verified_on'];
const HUMAN_VERIFIERS = new Set(['MLRO', 'Counsel']);
const CITATION_ID = /^[A-Za-z0-9._:-]{1,96}$/;
const CONTROL_STATUSES = new Set(['met', 'partial', 'pending', 'monitored']);
const QUERY_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'these', 'those',
  'what', 'which', 'when', 'where', 'who', 'why', 'how', 'are', 'was',
  'were', 'has', 'have', 'had', 'you', 'your', 'our', 'their', 'can',
  'could', 'would', 'should', 'about', 'under', 'into', 'than'
]);

function citationShapeValid(c) {
  return !!c && typeof c === 'object' && !Array.isArray(c) &&
    Object.keys(c).sort().join('|') === [...CITATION_KEYS].sort().join('|');
}

/* Defense in depth, NOT comprehensive prompt-injection classification.
   All retrieved words remain untrusted source DATA, even if no signature is
   present. Refuse overt instruction/spoofing markers for human resourcing. */
function suspiciousSourceText(value) {
  if (typeof value !== 'string') return true;
  return /[\u0000-\u0008\u000B-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u.test(value) ||
    /<\s*\/?\s*(?:system|developer|assistant|tool)\s*>/i.test(value) ||
    /\[\s*\/?INST\s*\]/i.test(value) ||
    /\b(?:ignore|disregard|override|forget)\s+(?:(?:all|your|the)\s+)?(?:prior|previous|system|developer)\s+(?:instructions?|prompts?|rules?)\b/i.test(value) ||
    /\b(?:send|exfiltrate)\s+(?:the\s+)?(?:api\s*key|private\s*key|password|secret)\b/i.test(value);
}

/* Restricted corpus rows must opt in explicitly. The principal's role and
   tenant ID must come from VERIFIED backend identity, never a browser field.
   Rows without an access_scope belong ONLY to the current public law register;
   confidential data must not be added there without explicit scope metadata. */
function authorizedForScope(accessScope, principal = {}) {
  // An omitted scope is permitted only for the existing public-law register.
  // An explicitly null scope is ambiguous and cannot be treated as PUBLIC.
  if (accessScope === undefined) return true;
  if (accessScope === null) return false;
  if (!accessScope || typeof accessScope !== 'object' || Array.isArray(accessScope)) return false;
  const keys = Object.keys(accessScope);
  if (accessScope.visibility === 'public') {
    return keys.length === 1;
  }
  if (accessScope.visibility !== 'tenant' ||
      keys.some(key => !['visibility', 'tenant_id', 'allowed_roles'].includes(key)) ||
      keys.length !== 3 ||
      typeof accessScope.tenant_id !== 'string' || !TENANT_ID.test(accessScope.tenant_id) ||
      !Array.isArray(accessScope.allowed_roles) ||
      accessScope.allowed_roles.length === 0 ||
      accessScope.allowed_roles.length > ELIGIBLE_ROLES.size ||
      accessScope.allowed_roles.some(role => !ELIGIBLE_ROLES.has(role))) return false;
  return !!principal && typeof principal === 'object' &&
    typeof principal.tenantId === 'string' &&
    principal.tenantId === accessScope.tenant_id &&
    accessScope.allowed_roles.includes(principal.role);
}
const WORD_RE = /[\p{L}\p{N}]{3,}/gu;

function tokens(s) {
  const words = String(s || '').normalize('NFKC').toLowerCase().match(WORD_RE) || [];
  return [...new Set(words)].slice(0, 64);
}

function dateValid(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s + 'T00:00:00Z')) &&
    new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
}

function sourceHostAllowed(url, approvedHosts) {
  if (!Array.isArray(approvedHosts) || !approvedHosts.length) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      !parsed.hash && !parsed.port &&
      approvedHosts.includes(parsed.hostname.toLowerCase());
  } catch (_) { return false; }
}

function buildVerifiedLegalCorpus(registry, approvedHosts, asOf, principal = {}) {
  if (!registry || !Array.isArray(registry.obligations) || !dateValid(asOf)) return [];
  // A malformed server-side allowlist must fail closed, not crash a caller
  // or accidentally turn into an unrestricted source list.
  const approved = Array.isArray(approvedHosts)
    ? [...new Set(approvedHosts.filter(x => typeof x === 'string')
      .map(x => x.trim().toLowerCase()))]
    : [];
  // Citation IDs are provenance keys, not display names. Duplicate IDs are
  // ambiguous even if each row claims to be signed off; reject every copy
  // rather than allowing a downstream consumer to pick an arbitrary record.
  const ids = new Set();
  const ambiguousIds = new Set();
  for (const row of registry.obligations) {
    if (row && typeof row.id === 'string') {
      if (ids.has(row.id)) ambiguousIds.add(row.id);
      ids.add(row.id);
    }
  }
  const out = [];
  for (const row of registry.obligations) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        typeof row.id !== 'string' || !CITATION_ID.test(row.id) || ambiguousIds.has(row.id) ||
        (row.status !== undefined && !CONTROL_STATUSES.has(row.status)) ||
        typeof row.obligation !== 'string' || !row.obligation.trim() || row.obligation.length > 3000 ||
        typeof row.instrument !== 'string' || !row.instrument.trim() || row.instrument.length > 512) continue;
    const c = row.source_citation;
    if (!citationShapeValid(c) || c.basis !== 'sourced' ||
        typeof c.article !== 'string' || !c.article.trim() || c.article.length > 256 ||
        typeof c.quote !== 'string' || c.quote.trim().length < 20 || c.quote.length > 5000 ||
        typeof c.locator !== 'string' || !c.locator.trim() || c.locator.length > 512 ||
        !HUMAN_VERIFIERS.has(c.verified_by) ||
        !dateValid(c.verified_on) || c.verified_on > asOf ||
        // Check ALL fields that could be inserted into an LLM context,
        // not only the quoted legislation. This is a narrow refusal guard,
        // not a substitute for treating the entire returned record as data.
        [row.obligation, row.instrument, c.article, c.locator, c.quote].some(suspiciousSourceText) ||
        /\bPROPOSED\b/i.test(c.quote) || /\.\.\.|\u2026/u.test(c.quote) ||
        !authorizedForScope(row.access_scope, principal) ||
        !sourceHostAllowed(c.source_url, approved)) continue;
    out.push({
      id: row.id,
      obligation: row.obligation,
      instrument: row.instrument,
      article: c.article,
      quote: c.quote,
      locator: c.locator,
      source_url: c.source_url,
      verified_by: c.verified_by,
      verified_on: c.verified_on,
      control_status: row.status || 'unknown',
      /* Change detection only: a hash is NOT publisher authenticity or
         an electronic MLRO signature. No customer data is hashed here. */
      content_sha256: createHash('sha256')
        // Bind every returned claim and its source authorization metadata.
        // Previously, changing the obligation, locator, verifier or visibility
        // left the alleged evidence hash unchanged.
        .update(JSON.stringify([
          row.id, row.obligation, row.instrument, c.source_url, c.article,
          c.quote, c.locator, c.verified_by, c.verified_on, row.status || 'unknown',
          row.access_scope === undefined ? null : {
            visibility: row.access_scope.visibility,
            tenant_id: row.access_scope.tenant_id || null,
            allowed_roles: Array.isArray(row.access_scope.allowed_roles)
              ? [...row.access_scope.allowed_roles].sort() : null,
          }
        ]))
        .digest('hex'),
      untrusted_source_text: true
    });
  }
  return out;
}

function retrieveVerifiedLegal(registry, query, options = {}) {
  /* Caller authentication must occur before this deterministic scoped library. */
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      !ELIGIBLE_ROLES.has(options.role)) return { status: 'forbidden', results: [] };
  if (typeof query !== 'string' || !query.trim() || query.length > 400) {
    return { status: 'invalid_query', results: [] };
  }
  const asOf = options.asOf || new Date().toISOString().slice(0, 10);
  if (!dateValid(asOf)) return { status: 'invalid_date', results: [] };
  const corpus = buildVerifiedLegalCorpus(registry, options.approvedHosts, asOf,
    { role: options.role, tenantId: options.tenantId });
  // Filler words alone must not turn an unrelated quotation into apparent
  // legal evidence. The public token helper is unchanged for other callers.
  const terms = tokens(query).filter(term => !QUERY_STOPWORDS.has(term));
  if (!terms.length) return { status: 'invalid_query', results: [] };
  const ranked = [];
  for (const item of corpus) {
    const primary = tokens(item.obligation + ' ' + item.article + ' ' + item.instrument);
    const quote = tokens(item.quote);
    const score = terms.reduce((sum, word) =>
      sum + (primary.includes(word) ? 4 : 0) + (quote.includes(word) ? 1 : 0), 0);
    if (score > 0) ranked.push({ score, ...item });
  }
  ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const count = Number.isInteger(options.limit) ? Math.max(1, Math.min(8, options.limit)) : 5;
  const results = ranked.slice(0, count);
  return {
    status: results.length ? 'verified_source_matches' : 'insufficient_verified_sources',
    as_of: asOf,
    results
  };
}

export { tokens, suspiciousSourceText, authorizedForScope, buildVerifiedLegalCorpus, retrieveVerifiedLegal };
