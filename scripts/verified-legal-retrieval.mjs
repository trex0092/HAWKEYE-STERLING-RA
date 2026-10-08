/* Source-gated local legal retrieval. No LLM call, vector store or egress.

   Only counsel/MLRO-verified obligation citations with a trusted official-source
   host are eligible. A query returning nothing MUST become "insufficient
   verified sources", not a fabricated statute or an implicit legal clearance.

   TRUST BOUNDARY: caller must provide the trusted host allowlist and verified
   server-side user role. Never accept these from untrusted browser parameters.
*/
const ELIGIBLE_ROLES = new Set(['Analyst', 'Reviewer-MLRO', 'Admin']);
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

function buildVerifiedLegalCorpus(registry, approvedHosts, asOf) {
  if (!registry || !Array.isArray(registry.obligations) || !dateValid(asOf)) return [];
  const approved = [...new Set((approvedHosts || [])
    .filter(x => typeof x === 'string').map(x => x.trim().toLowerCase()))];
  const out = [];
  for (const row of registry.obligations) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' ||
        typeof row.obligation !== 'string' || typeof row.instrument !== 'string') continue;
    const c = row.source_citation;
    if (!c || c.basis !== 'sourced' || typeof c.article !== 'string' || !c.article.trim() ||
        typeof c.quote !== 'string' || c.quote.trim().length < 20 ||
        c.quote.length > 5000 || typeof c.locator !== 'string' || !c.locator.trim() ||
        typeof c.verified_by !== 'string' || !c.verified_by.trim() ||
        !dateValid(c.verified_on) || c.verified_on > asOf ||
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
      control_status: row.status || 'unknown'
    });
  }
  return out;
}

function retrieveVerifiedLegal(registry, query, options = {}) {
  /* Caller authentication must occur before this deterministic scoped library. */
  if (!ELIGIBLE_ROLES.has(options.role)) return { status: 'forbidden', results: [] };
  if (typeof query !== 'string' || !query.trim() || query.length > 400) {
    return { status: 'invalid_query', results: [] };
  }
  const asOf = options.asOf || new Date().toISOString().slice(0, 10);
  if (!dateValid(asOf)) return { status: 'invalid_date', results: [] };
  const corpus = buildVerifiedLegalCorpus(registry, options.approvedHosts, asOf);
  const terms = tokens(query);
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

export { tokens, buildVerifiedLegalCorpus, retrieveVerifiedLegal };
