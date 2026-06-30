/* Interpol Red Notice screening — free, best-effort, zero deps, OPT-IN.

   Unlike OFAC / UN / EU / UK OFSI, Interpol publishes NO bulk consolidated file
   to fingerprint. It exposes a public Notices web service
   (https://ws-public.interpol.int/notices/v1/red) that is queried PER NAME and
   returns JSON. So Interpol fits the screen as a per-subject enrichment signal,
   the same shape as the adverse-media (Google News) and PEP (Wikidata) layers —
   not as a hash-tracked list.

   This is intentionally a WEAK, supplementary signal:
     • the public API exposes only the PUBLISHED subset of Red Notices (many are
       not public), so a NON-hit is NEVER assurance the subject is not wanted;
     • Red Notices are for INDIVIDUALS, so company counterparties will not match;
     • a hit means "verify" (MLRO / four-eyes), never an auto-decision.
   Authoritative wanted/sanctioned status still comes from the consolidated
   designation lists. This is documented, not silently implied.

   Default OFF (enable with SCREEN_INTERPOL=1) until verified on the runner.
   Pure helpers (URL + scoring) are unit-tested offline; only checkInterpol
   touches the network. */

export const INTERPOL_ENDPOINT = 'https://ws-public.interpol.int/notices/v1/red';

/* Build the public Red Notices query URL for a subject name. */
export function interpolSearchUrl(name, { resultPerPage = 10 } = {}) {
  const n = String(name == null ? '' : name).trim();
  return INTERPOL_ENDPOINT + '?resultPerPage=' + resultPerPage + '&name=' + encodeURIComponent(n);
}

function normalize(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* All significant subject tokens (>=3 chars) must appear in the notice's
   forename+name — guards against unrelated namesakes, same rule as the PEP
   layer's labelMatches. */
function nameMatches(subject, notice) {
  // ≥3-char tokens normally; fall back to ≥2 for short multi-token names
  // (e.g. "Xi Bo") so a real Red Notice namesake is not silently missed.
  let want = normalize(subject).split(' ').filter(t => t.length >= 3);
  if (!want.length) want = normalize(subject).split(' ').filter(t => t.length >= 2);
  const have = normalize((notice.forename || '') + ' ' + (notice.name || ''));
  return want.length > 0 && want.every(t => have.includes(t));
}

/* Extract the notices array from the HAL response (or a plain array fallback). */
function noticesOf(json) {
  if (json && json._embedded && Array.isArray(json._embedded.notices)) return json._embedded.notices;
  if (Array.isArray(json && json.notices)) return json.notices;
  if (Array.isArray(json)) return json;
  return [];
}

/* Score an Interpol Red Notices response for a subject. Returns
   { hit, score, band, match:{name,id,nationalities}, count }. */
export function scoreInterpol(name, json) {
  const notices = noticesOf(json);
  const hits = [];
  for (const nt of notices) {
    if (!nameMatches(name, nt)) continue;
    const full = [nt.forename, nt.name].filter(Boolean).join(' ').trim();
    hits.push({
      id: nt.entity_id || (nt._links && nt._links.self && nt._links.self.href) || '',
      name: full,
      nationalities: Array.isArray(nt.nationalities) ? nt.nationalities : [],
      dob: nt.date_of_birth || '',
    });
  }
  if (!hits.length) return { hit: false, score: 0, band: 'low', match: null, count: 0 };
  // A published Red Notice that matches the name is a strong "must verify" signal.
  return { hit: true, score: 85, band: 'high', match: hits[0], count: hits.length };
}

/* Network: look up one subject's Interpol Red Notice signal. Tolerant — on any
   error returns { errored:true } so the caller flags degraded enrichment, never
   a clean result. */
export async function checkInterpol(name, { timeoutMs = 20000, resultPerPage = 10 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(interpolSearchUrl(name, { resultPerPage }), {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'HawkeyeSterling-Interpol/1.0 (compliance screening)', Accept: 'application/json' },
    });
    if (!res.ok) return { errored: true, error: 'HTTP ' + res.status };
    return scoreInterpol(name, await res.json());
  } catch (e) {
    return { errored: true, error: String(e && e.message || e).slice(0, 200) };
  } finally { clearTimeout(t); }
}
