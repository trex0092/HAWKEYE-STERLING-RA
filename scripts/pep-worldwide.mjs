#!/usr/bin/env node
/* Worldwide PEP list harvester — free, license-clean (Wikidata, CC0), zero deps.

   There is no genuinely free, commercial-use PEP list — the good feeds are
   licensed, and the OpenSanctions PEP set is non-commercial. Wikidata is the
   one worldwide, machine-readable, CC0 source of who holds PEP-grade public
   office. This module harvests it into a screenable LIST (a real recall
   surface, unlike the per-name wbsearchentities signal that stays as a
   second net):

     Phase 1  per PEP root class, enumerate position items (P279* subclass
              walk — cheap, seconds each);
     Phase 2  per batch of position QIDs (VALUES clause), fetch holders via
              p:P39 statements at BestRank, keeping current holders and
              those whose tenure ended within the recency window (P582);
     Phase 3  per chunk of person QIDs, pull labels + aliases in EVERY
              language via wbgetentities — Arabic/Cyrillic/Han names feed
              the matcher's transliteration nets.

   WDQS discipline (the reason for this shape): the query service kills
   queries at 60s, and LIMIT/OFFSET paging is unreliable without ORDER BY
   (which itself blows the budget on large sets). So: no monolithic query,
   no OFFSET — the query space is partitioned (class → position batch) so
   every request returns a complete small result. Serial execution with
   backoff honoring Retry-After; a descriptive User-Agent per Wikimedia
   policy.

   Degrade loudly: a failed batch after retries fails the harvest; a
   non-optional root class with zero holders fails the harvest; a harvest
   that shrinks past the floor/shrink guards refuses to overwrite the
   previous artifact. The daily screen only ever reads the committed
   artifact — a broken harvest can never silently thin the screened list.

   Usage: node scripts/pep-worldwide.mjs harvest <outfile>
   Pure helpers are exported for the unit suite; only harvest() networks. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PEP_LIST_NAME = 'PEP (Worldwide — Wikidata)';
export const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
export const WD_API = 'https://www.wikidata.org/w/api.php';
const UA = 'HawkeyeSterling-PEPHarvest/1.0 (compliance screening; contact via repo)';

/* PEP-grade root position classes. `optional: true` marks classes whose QID
   still needs live verification — zero holders there is reported, never
   fatal, until a first green harvest promotes them. FATF PEP definition
   coverage: heads of state/government, senior politicians (ministers,
   legislators, governors), senior judicial (supreme court), central bank,
   ambassadors. */
export const PEP_ROOT_CLASSES = [
  { key: 'head-of-state', label: 'Head of state', qid: 'Q48352' },
  { key: 'head-of-government', label: 'Head of government', qid: 'Q2285706' },
  { key: 'minister', label: 'Government minister', qid: 'Q83307' },
  { key: 'legislator', label: 'Member of parliament', qid: 'Q486839' },
  { key: 'governor', label: 'Governor', qid: 'Q132050' },
  { key: 'ambassador', label: 'Ambassador', qid: 'Q121998', optional: true },
  { key: 'supreme-court-judge', label: 'Supreme court judge', qid: 'Q589298', optional: true },
  { key: 'central-bank-governor', label: 'Central bank governor', qid: 'Q28598677', optional: true },
];

export const RECENCY_MONTHS = Number(process.env.PEP_RECENCY_MONTHS) || 24;
export const HOLDER_BATCH = Number(process.env.PEP_HOLDER_BATCH) || 150;
export const LABEL_CHUNK = 50;
/* Refuse-to-overwrite guards: an absolute floor plus a relative-shrink gate
   vs the previous artifact (a half-empty harvest is an outage upstream, not
   a mass global de-listing). */
export const PEP_FLOOR = Number(process.env.PEP_FLOOR) || 5000;
export const PEP_SHRINK_PCT = Number(process.env.PEP_SHRINK_PCT) || 0.6;

export function positionsQuery(rootQid) {
  return 'SELECT ?pos ?posLabel ?countryLabel WHERE {\n'
    + `  ?pos wdt:P279* wd:${rootQid} .\n`
    + '  OPTIONAL { ?pos wdt:P17 ?country }\n'
    + '  OPTIONAL { ?pos wdt:P1001 ?country }\n'
    + '  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }\n'
    + '}';
}

export function holdersQuery(posQids, sinceIso) {
  return 'SELECT ?person ?pos ?end WHERE {\n'
    + '  VALUES ?pos { ' + posQids.map(q => 'wd:' + q).join(' ') + ' }\n'
    + '  ?person p:P39 ?st .\n'
    + '  ?st ps:P39 ?pos .\n'
    + '  ?st a wikibase:BestRank .\n'
    + '  OPTIONAL { ?st pq:P582 ?end }\n'
    + `  FILTER( !BOUND(?end) || ?end >= "${sinceIso}"^^xsd:dateTime )\n`
    + '}';
}

export function sparqlUrl(query) {
  return SPARQL_ENDPOINT + '?format=json&query=' + encodeURIComponent(query);
}

export function labelsUrl(qids) {
  return WD_API + '?action=wbgetentities&format=json&props=labels%7Caliases&maxlag=5&ids='
    + qids.join('%7C');
}

/* SPARQL JSON results → rows of { var: plainValue } (entity URIs reduced to
   their QID). Best-effort: an unrecognised shape yields [], and the caller's
   zero-guards take over. */
export function parseSparqlBindings(json) {
  const rows = [];
  const bindings = json && json.results && Array.isArray(json.results.bindings)
    ? json.results.bindings : [];
  for (const b of bindings) {
    const row = {};
    for (const [k, v] of Object.entries(b)) {
      if (!v || typeof v.value !== 'string') continue;
      row[k] = v.type === 'uri' ? v.value.replace(/^.*\/entity\//, '') : v.value;
    }
    rows.push(row);
  }
  return rows;
}

/* One wbgetentities entity → { name, aliases[] }: primary = en label, else
   mul, else the first label; every other-language label AND every alias in
   every language becomes an alias (dedup, keep original scripts — the
   matcher's transliteration nets want the Arabic/Cyrillic/Han forms). */
export function namesFromEntity(entity) {
  const labels = (entity && entity.labels) || {};
  const primary = (labels.en && labels.en.value)
    || (labels.mul && labels.mul.value)
    || (Object.values(labels)[0] && Object.values(labels)[0].value) || '';
  const all = new Set();
  for (const l of Object.values(labels)) if (l && l.value) all.add(l.value.trim());
  for (const arr of Object.values((entity && entity.aliases) || {})) {
    if (Array.isArray(arr)) for (const a of arr) if (a && a.value) all.add(a.value.trim());
  }
  all.delete(primary);
  all.delete('');
  return { name: primary.trim(), aliases: [...all] };
}

/* Assemble the artifact. holderRows: [{ person, pos, end?, classKey }];
   positions: Map(posQid → {label, country}); names: Map(personQid →
   {name, aliases}). Dedupe by person, first class in PEP_ROOT_CLASSES order
   wins the headline position (they're declared most-senior-first). */
export function buildPepDataset({ harvestedAt, holderRows, positions, names }) {
  const rank = new Map(PEP_ROOT_CLASSES.map((c, i) => [c.key, i]));
  const byPerson = new Map();
  for (const r of holderRows) {
    const prev = byPerson.get(r.person);
    if (prev && (rank.get(prev.classKey) ?? 99) <= (rank.get(r.classKey) ?? 99)) continue;
    const pos = positions.get(r.pos) || {};
    byPerson.set(r.person, {
      classKey: r.classKey,
      position: pos.label || r.pos,
      country: pos.country || '',
      current: !r.end,
    });
  }
  const entries = [];
  const classes = {};
  for (const [qid, meta] of byPerson) {
    const nm = names.get(qid);
    if (!nm || !nm.name) continue;   // unlabeled entity — nothing screenable
    classes[meta.classKey] = (classes[meta.classKey] || 0) + 1;
    entries.push({
      qid, name: nm.name, aliases: nm.aliases,
      position: meta.position, country: meta.country, current: meta.current,
    });
  }
  entries.sort((a, b) => (a.qid < b.qid ? -1 : 1));
  return { v: 1, list: PEP_LIST_NAME, harvested: harvestedAt, count: entries.length, classes, entries };
}

/* Refuse-to-overwrite guard. prev may be null (first harvest). */
export function datasetFloorOk(dataset, prev, { floor = PEP_FLOOR, shrinkPct = PEP_SHRINK_PCT } = {}) {
  const n = dataset && dataset.count || 0;
  if (n < floor) return { ok: false, reason: `harvest holds ${n} persons — below the ${floor} floor` };
  const p = prev && prev.count || 0;
  if (p && n < p * shrinkPct) {
    return { ok: false, reason: `harvest shrank to ${n} from ${p} (${Math.round(n / p * 100)}% — below the ${shrinkPct * 100}% gate)` };
  }
  return { ok: true, reason: '' };
}

/* Turn a committed dataset into the shapes the daily screen consumes: a
   list for the matcher index plus a normalized-name → context map so a hit
   can say WHICH office and country. */
export function pepListFromDataset(dataset) {
  const names = [];
  const meta = new Map();
  for (const e of (dataset && dataset.entries) || []) {
    const ctx = { position: e.position || '', country: e.country || '', current: !!e.current, qid: e.qid };
    for (const n of [e.name, ...(e.aliases || [])]) {
      if (!n) continue;
      names.push(n);
      if (!meta.has(n)) meta.set(n, ctx);
    }
  }
  return { list: { id: 'pep-worldwide', name: PEP_LIST_NAME, names }, meta, count: (dataset && dataset.count) || 0, harvested: (dataset && dataset.harvested) || '' };
}

/* ── network part (harvest CLI only) ───────────────────────────────────── */

async function fetchJson(url, { tries = 5 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/sparql-results+json, application/json' } });
      if (r.status === 429 || r.status === 500 || r.status === 502 || r.status === 503) {
        const ra = Number(r.headers.get('retry-after')) || (2 ** i * 5);
        console.error(`  http ${r.status} — backing off ${ra}s`);
        await new Promise(res => setTimeout(res, ra * 1000));
        lastErr = new Error('HTTP ' + r.status);
        continue;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 2 ** i * 2000));
    }
  }
  throw lastErr || new Error('fetch failed');
}

async function harvest(outfile) {
  const sinceIso = new Date(Date.now() - RECENCY_MONTHS * 30.44 * 86400000).toISOString().slice(0, 19) + 'Z';
  const harvestedAt = new Date().toISOString();
  console.log(`pep-worldwide: harvesting (recency window ${RECENCY_MONTHS} months → since ${sinceIso})`);

  const positions = new Map();       // posQid → { label, country, classKey }
  const posByClass = new Map();      // classKey → [posQid]
  for (const cls of PEP_ROOT_CLASSES) {
    const rows = parseSparqlBindings(await fetchJson(sparqlUrl(positionsQuery(cls.qid))));
    const qids = [];
    for (const r of rows) {
      if (!r.pos || !/^Q\d+$/.test(r.pos)) continue;
      if (!positions.has(r.pos)) positions.set(r.pos, { label: r.posLabel || '', country: r.countryLabel || '', classKey: cls.key });
      qids.push(r.pos);
    }
    posByClass.set(cls.key, [...new Set(qids)]);
    console.log(`  ${cls.key}: ${posByClass.get(cls.key).length} position items`);
    if (!posByClass.get(cls.key).length && !cls.optional) {
      console.error(`pep-worldwide: root class ${cls.key} (${cls.qid}) yielded ZERO position items — refusing a hollow harvest`);
      process.exit(1);
    }
  }

  const holderRows = [];
  for (const cls of PEP_ROOT_CLASSES) {
    const qids = posByClass.get(cls.key) || [];
    let classHolders = 0;
    for (let i = 0; i < qids.length; i += HOLDER_BATCH) {
      const batch = qids.slice(i, i + HOLDER_BATCH);
      const rows = parseSparqlBindings(await fetchJson(sparqlUrl(holdersQuery(batch, sinceIso))));
      for (const r of rows) {
        if (!r.person || !/^Q\d+$/.test(r.person)) continue;
        holderRows.push({ person: r.person, pos: r.pos, end: r.end || '', classKey: cls.key });
        classHolders++;
      }
      console.log(`  ${cls.key}: batch ${Math.floor(i / HOLDER_BATCH) + 1}/${Math.ceil(qids.length / HOLDER_BATCH)} — ${classHolders} holder rows so far`);
    }
    if (!classHolders && !cls.optional) {
      console.error(`pep-worldwide: root class ${cls.key} yielded ZERO holders — refusing a hollow harvest`);
      process.exit(1);
    }
    if (!classHolders && cls.optional) console.log(`  ${cls.key}: zero holders (optional class — QID pending live verification)`);
  }

  const personQids = [...new Set(holderRows.map(r => r.person))];
  console.log(`pep-worldwide: ${holderRows.length} holder rows → ${personQids.length} distinct persons; fetching multilingual names`);
  const names = new Map();
  for (let i = 0; i < personQids.length; i += LABEL_CHUNK) {
    const chunk = personQids.slice(i, i + LABEL_CHUNK);
    const data = await fetchJson(labelsUrl(chunk));
    for (const [qid, ent] of Object.entries((data && data.entities) || {})) names.set(qid, namesFromEntity(ent));
    if ((i / LABEL_CHUNK) % 20 === 0) console.log(`  names: ${Math.min(i + LABEL_CHUNK, personQids.length)}/${personQids.length}`);
  }

  const dataset = buildPepDataset({ harvestedAt, holderRows, positions: new Map([...positions].map(([q, p]) => [q, p])), names });
  let prev = null;
  if (existsSync(outfile)) { try { prev = JSON.parse(readFileSync(outfile, 'utf8')); } catch { prev = null; } }
  const gate = datasetFloorOk(dataset, prev);
  if (!gate.ok) {
    console.error('pep-worldwide: REFUSING to write — ' + gate.reason + (prev ? ' (previous artifact kept)' : ''));
    process.exit(1);
  }
  writeFileSync(outfile, JSON.stringify(dataset));
  console.log(`pep-worldwide: wrote ${dataset.count} persons (${Object.entries(dataset.classes).map(([k, v]) => k + ':' + v).join(', ')}) → ${outfile}`);
  return 0;
}

async function main(argv) {
  if (argv[0] === 'harvest' && argv[1]) return harvest(argv[1]);
  console.error('usage: pep-worldwide.mjs harvest <outfile>');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
}
