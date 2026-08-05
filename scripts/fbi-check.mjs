/* FBI Wanted screening — free, best-effort, zero deps, OPT-IN.

   The FBI publishes its wanted notices through a free public JSON API
   (https://api.fbi.gov/wanted/v1/list, no key) but NO bulk consolidated file
   to fingerprint — the list endpoint is paginated and queried by title. So,
   exactly like Interpol Red Notices, FBI Wanted fits the screen as a
   per-subject enrichment signal, not as a hash-tracked list.

   This is intentionally a WEAK, supplementary signal:
     • the API carries every poster class the Bureau publishes — wanted
       fugitives, but also MISSING PERSONS and seeking-information appeals —
       so poster classes that are not "wanted" are excluded from the hit
       (a missing-person poster must never read as an adverse finding);
     • wanted notices are for INDIVIDUALS, so company counterparties will
       not match;
     • a NON-hit is NEVER assurance (state/local wanted persons, sealed
       indictments and Interpol diffusions are not in this API);
     • a hit means "verify" (MLRO / four-eyes), never an auto-decision.
   Authoritative designation status still comes from the consolidated
   sanctions lists. This is documented, not silently implied.

   Default OFF (enable with SCREEN_FBI=1) until verified on the runner.
   Pure helpers (URL + scoring) are unit-tested offline; only checkFbi
   touches the network. */

export const FBI_ENDPOINT = 'https://api.fbi.gov/wanted/v1/list';

/* Poster classes that mean "law enforcement wants this person" — anything
   else (missing, victim, seeking information, ECAP) is excluded from the
   adverse signal. Kept as an explicit allowlist so a new class the Bureau
   adds is excluded until reviewed, never silently promoted. */
export const FBI_WANTED_CLASSES = new Set(['default', 'ten', 'terrorist', 'fugitive']);

/* Build the public Wanted API query URL for a subject name. */
export function fbiSearchUrl(name, { pageSize = 20 } = {}) {
  const n = String(name == null ? '' : name).trim();
  return FBI_ENDPOINT + '?pageSize=' + pageSize + '&title=' + encodeURIComponent(n);
}

function normalize(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/* All significant subject tokens must appear in the item's title or one of
   its aliases — same namesake guard as the Interpol / PEP layers. */
function titleMatches(subject, item) {
  let want = normalize(subject).split(' ').filter(t => t.length >= 3);
  if (!want.length) want = normalize(subject).split(' ').filter(t => t.length >= 2);
  if (!want.length) return false;
  const candidates = [item && item.title || ''];
  const aliases = item && item.aliases;
  if (Array.isArray(aliases)) candidates.push(...aliases.map(a => String(a || '')));
  else if (typeof aliases === 'string') candidates.push(aliases);
  return candidates.some(c => { const have = normalize(c); return have && want.every(t => have.includes(t)); });
}

/* Score an FBI Wanted API response for a subject. Returns
   { hit, score, band, match:{title,classification,url}, count, excluded }. */
export function scoreFbi(name, json) {
  const items = (json && Array.isArray(json.items)) ? json.items : [];
  const hits = [];
  let excluded = 0;
  for (const it of items) {
    if (!titleMatches(name, it)) continue;
    const cls = String(it.poster_classification || 'default').toLowerCase();
    if (!FBI_WANTED_CLASSES.has(cls)) { excluded++; continue; }   // missing/victim/information posters are not adverse
    /* person_classification: only 'Main' subjects screen — a Victim or
       Accomplice row naming the subject must never read as "wanted".
       status: 'na' means active; a captured/recovered poster is history. */
    const pc = String(it.person_classification || 'Main').toLowerCase();
    if (pc !== 'main') { excluded++; continue; }
    const st = String(it.status || 'na').toLowerCase();
    if (st !== 'na') { excluded++; continue; }
    hits.push({
      title: String(it.title || '').trim(),
      classification: cls,
      url: String(it.url || ''),
      subjects: Array.isArray(it.subjects) ? it.subjects.slice(0, 3) : [],
    });
  }
  if (!hits.length) return { hit: false, score: 0, band: 'low', match: null, count: 0, excluded };
  // A published FBI wanted poster matching the name is a strong "must verify" signal.
  return { hit: true, score: 85, band: 'high', match: hits[0], count: hits.length, excluded };
}

/* Network: look up one subject's FBI Wanted signal. Tolerant — on any error
   returns { errored:true } so the caller flags degraded enrichment, never a
   clean result. */
export async function checkFbi(name, { timeoutMs = 20000, pageSize = 20 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(fbiSearchUrl(name, { pageSize }), {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'HawkeyeSterling-FBI/1.0 (compliance screening)', Accept: 'application/json' },
    });
    if (!res.ok) return { errored: true, error: 'HTTP ' + res.status };
    return scoreFbi(name, await res.json());
  } catch (e) {
    return { errored: true, error: String(e && e.message || e).slice(0, 200) };
  } finally { clearTimeout(t); }
}
