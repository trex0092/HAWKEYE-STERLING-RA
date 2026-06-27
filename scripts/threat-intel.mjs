/* Threat-intelligence enrichment — STIX 2.1 bundle screening, zero-deps, OPT-IN.

   Lets the screen ingest a STIX 2.1 bundle exported from an OpenCTI / MISP /
   TAXII feed (threat-actors, intrusion-sets, identities, malware, campaigns) and
   screen a subject name against the named objects and their aliases. It is the
   adversary-side counterpart to the sanctions/PEP/adverse-media layers — useful
   where a counterparty name appears in a curated threat feed (e.g. a fraud or
   sanctions-evasion network published as STIX), mapping to the Threat
   Intelligence skills (STIX/TAXII, MISP, OpenCTI) in the cybersecurity-skills
   plugin.

   This is a SUPPLEMENTARY "must verify" signal, never an authoritative
   designation:
     • coverage is exactly whatever bundle you supply — a non-hit is NOT
       assurance, only "absent from this feed";
     • feed quality varies, so a hit means MLRO / four-eyes verification, never
       an auto-decision.
   Authoritative sanction status still comes from the consolidated lists.

   Default OFF (enable with SCREEN_THREAT_INTEL=1 and a bundle source). The pure
   parse/score helpers are unit-tested offline; only loadStixBundle /
   checkThreatIntel touch the network or filesystem. */

import { readFile } from 'node:fs/promises';
import { normalizeName, similarity } from './sanctions-match.mjs';

/* STIX Domain Objects that carry a screenable real-world / adversary name. */
const NAMED_SDO_TYPES = new Set(['threat-actor', 'intrusion-set', 'identity', 'malware', 'campaign', 'tool']);

/* Parse a STIX 2.1 bundle (or a bare objects array) into
   [{ id, type, name, aliases:[...] }] for named SDOs only. Aliases cover both
   the STIX `aliases` field and the ATT&CK `x_mitre_aliases` extension. */
export function parseStixBundle(bundle) {
  const objects = (bundle && Array.isArray(bundle.objects)) ? bundle.objects
    : Array.isArray(bundle) ? bundle : [];
  const out = [];
  for (const o of objects) {
    if (!o || !NAMED_SDO_TYPES.has(o.type) || !o.name) continue;
    const aliases = []
      .concat(Array.isArray(o.aliases) ? o.aliases : [])
      .concat(Array.isArray(o.x_mitre_aliases) ? o.x_mitre_aliases : [])
      .map(a => String(a).trim())
      .filter(a => a && a !== o.name);
    out.push({ id: o.id || '', type: o.type, name: String(o.name), aliases: [...new Set(aliases)] });
  }
  return out;
}

/* Flat list of every screenable name (primary names + aliases) in a bundle. */
export function stixNames(bundle) {
  const names = [];
  for (const e of parseStixBundle(bundle)) { names.push(e.name); for (const a of e.aliases) names.push(a); }
  return names;
}

/* Screen a subject name against a STIX bundle. Returns
   { hit, score, band, match:{name,type,id,matchedOn}, count }. Uses the
   matcher's similarity (edit-distance + token-set) so reordered / partial
   actor names still surface. */
export function screenStix(name, bundle, { threshold = 85 } = {}) {
  const subj = normalizeName(name);
  if (!subj) return { hit: false, score: 0, band: 'low', match: null, count: 0 };
  const entries = parseStixBundle(bundle);
  const hits = [];
  let best = 0;
  for (const e of entries) {
    for (const candidate of [e.name, ...e.aliases]) {
      const sc = similarity(subj, normalizeName(candidate));
      if (sc > best) best = sc;
      if (sc >= threshold) {
        hits.push({ name: e.name, type: e.type, id: e.id, matchedOn: candidate, score: Math.round(sc) });
        break; // one hit per SDO (best alias)
      }
    }
  }
  if (!hits.length) return { hit: false, score: Math.round(best), band: 'low', match: null, count: 0 };
  hits.sort((a, b) => b.score - a.score);
  const top = hits[0];
  return { hit: true, score: top.score, band: top.score >= 95 ? 'high' : 'medium', match: top, count: hits.length };
}

/* Load a STIX bundle from a URL (TAXII/OpenCTI export) or a local file. */
export async function loadStixBundle({ url = '', file = '', timeoutMs = 20000 } = {}) {
  if (file) return JSON.parse(await readFile(file, 'utf8'));
  if (!url) throw new Error('loadStixBundle: a url or file is required');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'HawkeyeSterling-ThreatIntel/1.0 (compliance screening)', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

/* Network/file: screen one subject against a STIX feed. Tolerant — on any
   error returns { errored:true } so the caller flags degraded enrichment. */
export async function checkThreatIntel(name, { url = '', file = '', threshold = 85, timeoutMs = 20000 } = {}) {
  try {
    const bundle = await loadStixBundle({ url, file, timeoutMs });
    return screenStix(name, bundle, { threshold });
  } catch (e) {
    return { errored: true, error: String(e && e.message || e).slice(0, 200) };
  }
}
