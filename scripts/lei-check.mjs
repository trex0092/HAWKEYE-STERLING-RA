/* GLEIF LEI lookup — free, official, zero-deps, OPT-IN entity verification.

   The Global Legal Entity Identifier Foundation (GLEIF) publishes the
   authoritative LEI register under a free, open API (https://api.gleif.org,
   JSON:API). Given a counterparty's *legal* name this confirms the registered
   Legal Entity Identifier, legal jurisdiction, entity status (ACTIVE/INACTIVE)
   and registration status (ISSUED/LAPSED/RETIRED) — a strong identity /
   beneficial-ownership corroborator for the CDD file, the same per-subject
   enrichment shape as the Interpol / PEP / adverse-media layers.

   This is a VERIFICATION signal, not a risk hit:
     • LEIs are for ORGANISATIONS, so natural-person principals will not match;
     • a non-match is NEVER assurance the entity is fictitious — many real
       entities have no LEI — it just means "no LEI corroboration, verify by
       other means";
     • a LAPSED/RETIRED registration is a data-staleness flag, not a sanction.
   Authoritative sanction/PEP status still comes from the designation lists and
   the PEP layer. This is documented, not silently implied.

   Default OFF (enable with SCREEN_LEI=1) until verified on the runner. The pure
   helpers (URL builders, LEI checksum, scorer) are unit-tested offline; only
   checkLei touches the network. */

import { normalizeName, sigTokens } from './sanctions-match.mjs';

export const LEI_ENDPOINT = 'https://api.gleif.org/api/v1/lei-records';

/* Search the register for an entity by legal name. */
export function leiSearchUrl(name, { pageSize = 10 } = {}) {
  const n = String(name == null ? '' : name).trim();
  return LEI_ENDPOINT +
    '?filter[entity.legalName]=' + encodeURIComponent(n) +
    '&page[size]=' + pageSize;
}

/* Look a single record up by its LEI. */
export function leiLookupUrl(lei) {
  return LEI_ENDPOINT + '/' + encodeURIComponent(String(lei == null ? '' : lei).trim().toUpperCase());
}

/* ISO 17442 LEI: 18 alphanumerics + 2 check digits, validated by the ISO 7064
   MOD 97-10 scheme (the whole 20-char string, letters as A=10…Z=35, ≡ 1 mod 97). */
export function isValidLei(lei) {
  const s = String(lei == null ? '' : lei).trim().toUpperCase();
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(s)) return false;
  let rem = 0;
  for (const ch of s) {
    const v = ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55; // 'A' (65) → 10
    rem = (v > 9 ? rem * 100 + v : rem * 10 + v) % 97;
  }
  return rem === 1;
}

/* Pull LEI records out of a JSON:API response — `data` is an array (search) or a
   single object (lookup); tolerate either, plus a bare array. */
function recordsOf(json) {
  if (!json) return [];
  if (Array.isArray(json.data)) return json.data;
  if (json.data && typeof json.data === 'object') return [json.data];
  if (Array.isArray(json)) return json;
  return [];
}

function recordFields(rec) {
  const a = (rec && rec.attributes) || {};
  const ent = a.entity || {};
  const legalName = (ent.legalName && ent.legalName.name) || '';
  return {
    lei: a.lei || (rec && rec.id) || '',
    legalName,
    jurisdiction: ent.jurisdiction || '',
    entityStatus: ent.status || '',
    registrationStatus: (a.registration && a.registration.status) || '',
  };
}

/* All significant subject tokens must appear in the candidate's legal name —
   the corp-suffix-aware token rule from the matcher, so a shared "trading" or
   "llc" never manufactures a match. */
function nameMatches(subject, candidate) {
  const want = sigTokens(normalizeName(subject));
  const haveNorm = normalizeName(candidate);
  const have = new Set(normalizeName(candidate).split(' ').filter(Boolean));
  if (!want.length) return { exact: false, all: false };
  return { exact: normalizeName(subject) === haveNorm, all: want.every(t => have.has(t)) };
}

/* Score a GLEIF response for a subject legal name. Returns
   { hit, score, band, match:{lei,legalName,jurisdiction,entityStatus,registrationStatus}, count }. */
export function scoreLei(name, json) {
  const recs = recordsOf(json);
  const hits = [];
  for (const rec of recs) {
    if (!rec || typeof rec !== 'object') continue;
    const f = recordFields(rec);
    if (!f.legalName || !isValidLei(f.lei)) continue;
    const m = nameMatches(name, f.legalName);
    if (!m || !m.all) continue;
    hits.push({ ...f, score: m.exact ? 95 : 80 });
  }
  if (!hits.length) return { hit: false, score: 0, band: 'low', match: null, count: 0 };
  hits.sort((a, b) => b.score - a.score);
  const top = hits[0];
  // A confirmed LEI is a strong identity corroboration; a lapsed/retired
  // registration is still a match but flagged as stale via registrationStatus.
  const band = top.score >= 95 ? 'high' : 'medium';
  return { hit: true, score: top.score, band, match: top, count: hits.length };
}

/* Network: confirm one entity's LEI. Tolerant — on any error returns
   { errored:true } so the caller flags degraded enrichment, never a clean
   verification. */
export async function checkLei(name, { timeoutMs = 20000, pageSize = 10 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(leiSearchUrl(name, { pageSize }), {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'HawkeyeSterling-LEI/1.0 (compliance screening)', Accept: 'application/vnd.api+json' },
    });
    if (!res.ok) return { errored: true, error: 'HTTP ' + res.status };
    return scoreLei(name, await res.json());
  } catch (e) {
    return { errored: true, error: String(e && e.message || e).slice(0, 200) };
  } finally { clearTimeout(t); }
}
