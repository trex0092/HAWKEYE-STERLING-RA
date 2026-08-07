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

   Resumable: GitHub-hosted runners repeatedly died abnormally 1-3h into
   the serial WDQS-polite sweep (job frozen mid-step, logs gone), so the
   harvest is time-budgeted — at PEP_TIME_BUDGET_MIN it writes a checkpoint
   (positions, holder rows, label progress) and exits RESUME_EXIT_CODE; the
   workflow commits the checkpoint to the state branch and re-dispatches
   itself, and the next run resumes exactly where this one paused. Resumes
   are bounded (PEP_MAX_RESUMES) — a harvest that cannot converge fails
   loudly instead of dispatching forever.

   Usage: node scripts/pep-worldwide.mjs harvest <outfile>
   Pure helpers are exported for the unit suite; only harvest() networks. */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
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
  /* FATF senior government & judicial officials — prominent, one/few-per-country
     roles (never flood-prone like a generic "mayor"/"CEO" class would). Added
     optional so the harvest itself is the QID check: a wrong/empty QID logs
     "zero holders — pending live verification" and the run stays green, exactly
     as the trio above was introduced. ombudsman (Q169180) is cross-verified;
     the prosecutor/auditor QIDs are best-effort pending the first live sweep. */
  { key: 'ombudsman', label: 'Ombudsman', qid: 'Q169180', optional: true },
  { key: 'prosecutor-general', label: 'Attorney/Prosecutor general', qid: 'Q1501926', optional: true },
  { key: 'auditor-general', label: 'Auditor general (head of supreme audit institution)', qid: 'Q5785176', optional: true },
];

export const RECENCY_MONTHS = Number(process.env.PEP_RECENCY_MONTHS) || 24;
/* Positions per holders VALUES query. Smaller = each query returns fewer rows
   and stays under the WDQS 60s hard kill (the 150 default timed out a late
   batch and aborted a 62-minute harvest on 2026-08-05). */
export const HOLDER_BATCH = Number(process.env.PEP_HOLDER_BATCH) || 60;
export const LABEL_CHUNK = 50;
/* Label chunks are fetched CONCURRENTLY. The names phase is one wbgetentities
   round-trip per 50 persons — 8,445 of them for the 422,231 people the first
   live harvest found holding office — and a measured chain link banked only
   411 of those chunks inside its 40-min budget. Sequentially that is ~13 more
   links against a 12-resume cap: a harvest that provably never converges, and
   the chain died of it three times. The requests are independent (results land
   in a QID-keyed Map, order irrelevant), so a modest window turns the phase
   from hours into minutes.

   Measured on the first link that completed cleanly: at concurrency 5 a
   250-person window took ~30s (101 min banked 50,750 of 422,231 names).

   That link's log ALSO shows 64 HTTP 429s with backoff — Wikidata rate-limits
   this client, so widening the window inside ONE job fights the limiter rather
   than the latency and has a ceiling. maxlag=5 rides every request and a 429
   lands in fetchJson's retry-after backoff, so over-reach degrades into a
   slower harvest rather than a failed one, and PEP_LABEL_CONCURRENCY dials it
   back from repo variables with no code change. The lever that actually beats a
   per-client limit is more CLIENTS — see PEP_SHARD_COUNT below. */
export const LABEL_CONCURRENCY = Number(process.env.PEP_LABEL_CONCURRENCY) || 20;
export const LABEL_WINDOW = LABEL_CHUNK * LABEL_CONCURRENCY;

/* Sharding — the lever that beats a per-client rate limit, because each shard
   runs on its OWN GitHub runner and is therefore its own client with its own
   rate budget. Shard i labels the people whose position in the list is
   congruent to i mod COUNT: a stable, gapless partition needing no coordination
   between shards, so they never contend and none can miss or duplicate a
   person. COUNT=1 (the default) is exactly the single-job behaviour, so nothing
   changes for the ordinary weekly harvest.

   Shards deliberately do NOT push to the state branch — concurrent force-pushes
   to one ref would race and silently drop work. Each emits its slice of names
   as a workflow artifact and a separate merge step assembles the dataset. */
export const PEP_SHARD_COUNT = Math.max(1, Number(process.env.PEP_SHARD_COUNT) || 1);
export const PEP_SHARD_INDEX = Math.max(0, Number(process.env.PEP_SHARD_INDEX) || 0);

/* The people this shard is responsible for. Every QID lands in exactly one
   shard and every shard sees the same list in the same order, so the union over
   all shards is the input list with nothing lost and nothing counted twice. */
export function shardOf(qids, index = PEP_SHARD_INDEX, count = PEP_SHARD_COUNT) {
  if (count <= 1) return qids;
  return qids.filter((_, i) => i % count === index);
}

/* Merge shard name-slices back into one map. Later shards never overwrite an
   earlier shard's entry for the same QID — by construction they cannot collide,
   and if a re-run ever did produce an overlap the first (already-verified)
   value wins rather than a half-written one. */
export function mergeShardNames(slices) {
  const names = new Map();
  for (const slice of slices) {
    for (const [qid, nm] of slice || []) {
      if (!names.has(qid) && nm && nm.name) names.set(qid, nm);
    }
  }
  return names;
}
/* A harvest that lost more than this fraction of its holder batches to WDQS
   errors did not sweep enough of the graph to trust — fail loudly rather than
   write a thin list. Below it, a few flaky batches are tolerated (the run
   keeps what it got) and the floor/shrink gates still guard the write. */
export const PEP_MAX_BATCH_FAIL_PCT = Number(process.env.PEP_MAX_BATCH_FAIL_PCT) || 0.1;
/* Refuse-to-overwrite guards: an absolute floor plus a relative-shrink gate
   vs the previous artifact (a half-empty harvest is an outage upstream, not
   a mass global de-listing). */
export const PEP_FLOOR = Number(process.env.PEP_FLOOR) || 5000;
export const PEP_SHRINK_PCT = Number(process.env.PEP_SHRINK_PCT) || 0.6;
/* Time-budget resumability. The 40-min budget existed to duck an "abnormal
   runner death" at ~62 min — which turned out not to be runner fragility at
   all: harden-runner's egress block was denying GitHub's own hosted-compute
   watchdog (hosted-compute-watchdog-prod-<region>.githubapp.com), and a runner
   that cannot answer its watchdog gets reclaimed on a fixed timer. Three links
   died at 62m49s / 63m43s / ~63m with their step frozen mid-flight and the logs
   never uploaded — the signature of reclamation, not of a crash.

   With the watchdog allowed (every egress-blocked workflow now permits
   *.githubapp.com) that ceiling is gone, so the budget no longer has to hide
   under it. The remaining labels work is ~1,600 concurrent windows — roughly
   40-50 min — so a budget comfortably above that lets ONE link finish instead
   of pausing and handing off. The pause still exists and still works; it is now
   a safety net for a genuinely long harvest rather than the normal path. */
export const PEP_TIME_BUDGET_MIN = Number(process.env.PEP_TIME_BUDGET_MIN) || 100;
export const PEP_MAX_RESUMES = Number(process.env.PEP_MAX_RESUMES) || 12;
export const RESUME_EXIT_CODE = 75;   // EX_TEMPFAIL — planned pause, not a failure

export function checkpointPath(outfile) {
  return outfile.replace(/\.json$/i, '') + '-checkpoint.json';
}

/* The checkpoint is GZIPPED on disk. It holds every holder row and, in the
   labels phase, every banked person's names in EVERY language — the first live
   harvest reached 60MB of holder rows alone (~809k rows) and the names payload
   projects to several hundred MB. GitHub REFUSES a push containing a file over
   100MB, so an uncompressed checkpoint would take the whole chain down at the
   exact moment it had the most work banked. JSON of this shape compresses
   ~10-15x, which keeps the file far under the limit WITHOUT cutting harvest
   scope (no recall is traded for it). zlib is stdlib — no runtime dependency.

   Reads accept BOTH formats (gzip magic 1f 8b, else plain JSON) so a checkpoint
   written before this change still resumes instead of being discarded as
   "unrecognized" — losing hours of banked WDQS work. The path keeps its .json
   name: the workflow's overlay/persist steps address it literally, and git
   handles the binary content fine.

   The ARTIFACT gets the same treatment for the same reason: measured against
   the first live harvest (20,550 persons banked, 259 bytes of names each), the
   finished dataset projects to ~135MB for 422k persons — over the same 100MB
   push limit. Compressing it keeps every alias (recall is never traded for
   file size); readJsonMaybeGz is what every consumer uses to read it. */
export function readJsonMaybeGz(file) {
  const buf = readFileSync(file);
  const text = (buf[0] === 0x1f && buf[1] === 0x8b) ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  return JSON.parse(text);
}
export function writeJsonGz(file, obj) {
  writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(obj), 'utf8')));
}
export const readCheckpoint = readJsonMaybeGz;
export const writeCheckpoint = writeJsonGz;

/* Can this checkpoint be resumed? Three outcomes: resume it (ok), silently
   start fresh (not ok, not fatal — unrecognized shape or a stale leftover
   from a previous weekly cycle), or REFUSE loudly (fatal — the harvest has
   been resumed past the cap without completing; re-dispatching again would
   loop forever instead of surfacing the underlying failure). */
export function checkpointUsable(cp, { maxResumes = PEP_MAX_RESUMES, nowMs = Date.now() } = {}) {
  if (!cp || cp.v !== 1 || !Number.isFinite(Date.parse(cp.sinceIso))
    || !Number.isFinite(Date.parse(cp.harvestedAt)) || !cp.phase) {
    return { ok: false, fatal: false, reason: 'unrecognized checkpoint shape — starting fresh' };
  }
  const age = nowMs - Date.parse(cp.harvestedAt);
  if (!(age >= 0) || age > 7 * 86400000) {
    return { ok: false, fatal: false, reason: 'checkpoint is stale (harvest began over 7 days ago) — starting fresh' };
  }
  if ((cp.resumeCount || 0) + 1 > maxResumes) {
    return { ok: false, fatal: true, reason: `already resumed ${cp.resumeCount} times without completing (max ${maxResumes}) — the harvest is not converging; investigate before re-dispatching` };
  }
  return { ok: true, fatal: false, reason: '' };
}

/* Rebuild harvest state from a checkpoint, REVALIDATING every value that can
   reach a query URL. The checkpoint rides a repo branch, so a poisoned or
   corrupted file must not be able to steer SPARQL/API requests: QIDs are
   re-derived through their numeric part (invalid entries drop), timestamps
   re-derive through Date.parse, counters and indices coerce to numbers.
   (Also the CodeQL js/outbound-network-request-with-dynamic-url guard.) */
const QID_RE = /^Q\d+$/;
const cleanQid = q => (typeof q === 'string' && QID_RE.test(q)) ? 'Q' + String(Number(q.slice(1))) : null;
export function restoreCheckpoint(cp) {
  const positions = new Map();
  for (const [q, p] of Array.isArray(cp.positions) ? cp.positions : []) {
    const qid = cleanQid(q);
    if (qid && p) positions.set(qid, { label: String(p.label || ''), country: String(p.country || ''), classKey: String(p.classKey || '') });
  }
  const posByClass = new Map();
  for (const [k, arr] of Array.isArray(cp.posByClass) ? cp.posByClass : []) {
    posByClass.set(String(k), (Array.isArray(arr) ? arr : []).map(cleanQid).filter(Boolean));
  }
  const holderRows = [];
  for (const r of Array.isArray(cp.holderRows) ? cp.holderRows : []) {
    const person = cleanQid(r && r.person), pos = cleanQid(r && r.pos);
    if (person && pos) holderRows.push({ person, pos, end: String(r && r.end || ''), classKey: String(r && r.classKey || '') });
  }
  const classHolders = {};
  for (const [k, v] of Object.entries(cp.classHolders || {})) classHolders[String(k)] = Number(v) || 0;
  const classBatchFailed = {};
  for (const [k, v] of Object.entries(cp.classBatchFailed || {})) classBatchFailed[String(k)] = Number(v) || 0;
  return {
    sinceIso: new Date(Date.parse(cp.sinceIso)).toISOString().slice(0, 19) + 'Z',
    harvestedAt: new Date(Date.parse(cp.harvestedAt)).toISOString(),
    resumeCount: (Number(cp.resumeCount) || 0) + 1,
    phase: cp.phase === 'labels' ? 'labels' : (cp.phase === 'positions' ? 'positions' : 'holders'),
    positions, posByClass, holderRows, classHolders, classBatchFailed,
    batchTotal: Number(cp.batchTotal) || 0,
    batchFailed: Number(cp.batchFailed) || 0,
    next: {
      classIdx: Number(cp.next && cp.next.classIdx) || 0,
      posIdx: Number(cp.next && cp.next.posIdx) || 0,
      labelIdx: Number(cp.next && cp.next.labelIdx) || 0,
    },
    labelQids: (Array.isArray(cp.labelQids) ? cp.labelQids : []).map(cleanQid).filter(Boolean),
    names: new Map((Array.isArray(cp.names) ? cp.names : [])
      .filter(e => Array.isArray(e) && cleanQid(e[0])).map(([q, n]) => [cleanQid(q), n])),
  };
}

/* QID-only on purpose: the original query joined the label SERVICE plus two
   OPTIONAL country clauses onto the full P279* walk, and on 2026-08-06 the
   head-of-government enumeration streamed ~9MB before WDQS's 60s kill cut the
   connection mid-body (JSON truncated at position 8964448 on every retry) —
   the same overweight query most plausibly underlies the earlier multi-hour
   stalls. A bare DISTINCT walk is cheap and small; position labels come from
   wbgetentities afterwards (the same hang-proof chunked path person labels
   use), and the country context rides the label pass when available. */
export function positionsQuery(rootQid) {
  return 'SELECT DISTINCT ?pos WHERE {\n'
    + `  ?pos wdt:P279* wd:${rootQid} .\n`
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
export function buildPepDataset({ harvestedAt, holderRows, positions, names, expected }) {
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
  /* `expected` is how many people the harvest KNOWS it has to label. When the
     dataset is written mid-harvest it carries fewer, and the shortfall is
     recorded so every consumer can say so out loud: a PEP who has not been
     harvested yet screens CLEAN, and silence must never be read as "not a PEP".
     A complete harvest omits the flag entirely. */
  const partial = Number.isFinite(expected) && expected > 0 && entries.length < expected;
  return {
    v: 1, list: PEP_LIST_NAME, harvested: harvestedAt, count: entries.length, classes, entries,
    ...(partial ? { partial: true, expected } : {}),
  };
}

/* Holder-batch failure gate: a harvest that lost too large a fraction of its
   WDQS batches did not sweep enough of the graph to trust. Pure for tests. */
export function batchFailureOk(failed, total, pct = PEP_MAX_BATCH_FAIL_PCT) {
  if (!total) return { ok: true, reason: '' };
  const rate = failed / total;
  return rate > pct
    ? { ok: false, reason: `${failed}/${total} holder batches failed (${Math.round(rate * 100)}% > ${Math.round(pct * 100)}% gate) — WDQS outage, not a trustworthy sweep` }
    : { ok: true, reason: '' };
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
  return {
    list: { id: 'pep-worldwide', name: PEP_LIST_NAME, names }, meta,
    count: (dataset && dataset.count) || 0, harvested: (dataset && dataset.harvested) || '',
    /* Carried through so the screen can say it out loud. A partial list means a
       PEP who has not been harvested yet produces NO hit — absence of a match is
       not evidence that a subject is not a PEP, and the run log has to say so. */
    partial: !!(dataset && dataset.partial), expected: (dataset && dataset.expected) || 0,
  };
}

/* ── network part (harvest CLI only) ───────────────────────────────────── */

/* Per-ATTEMPT hard timeout: chain link 1 of the checkpointed harvest died at
   64 min with the budget pause never firing — the budget is only checked
   BETWEEN requests, so a single hung socket (no timeout on fetch) stalls the
   loop straight past the pause point until the runner dies. 90s covers the
   WDQS 60s server-side kill with margin; a hung attempt becomes a retryable
   error instead of an unbounded stall. */
const ATTEMPT_TIMEOUT_MS = 90000;

async function fetchJson(url, { tries = 6 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'application/sparql-results+json, application/json' } });
      if (r.status === 429 || r.status === 500 || r.status === 502 || r.status === 503 || r.status === 504) {
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
    } finally {
      clearTimeout(kill);
    }
  }
  throw lastErr || new Error('fetch failed');
}

/* Non-throwing variant: returns null after exhausting retries so ONE flaky
   WDQS response cannot abort a multi-thousand-query harvest. The caller counts
   nulls and the batch-failure gate decides whether the sweep is trustworthy. */
async function fetchJsonSafe(url) {
  try { return await fetchJson(url); }
  catch (e) { console.error('  batch failed after retries: ' + String(e && e.message || e).slice(0, 120)); return null; }
}

/* One window of label chunks, in flight together. Returns the parsed responses
   with nulls where a chunk exhausted its retries — the caller drops those
   persons exactly as it did serially (an unlabelled entity is not screenable),
   so concurrency changes the RATE and nothing about what counts as a hit. */
async function fetchLabelWindow(qids, start) {
  const jobs = [];
  for (let off = start; off < Math.min(start + LABEL_WINDOW, qids.length); off += LABEL_CHUNK) {
    jobs.push(fetchJsonSafe(labelsUrl(qids.slice(off, off + LABEL_CHUNK))));
  }
  return Promise.all(jobs);
}

async function harvest(outfile) {
  const cpFile = checkpointPath(outfile);
  const startedMs = Date.now();
  const overBudget = () => Date.now() - startedMs > PEP_TIME_BUDGET_MIN * 60000;

  /* Read-and-catch, no existence pre-check (CodeQL js/file-system-race):
     an absent or unreadable checkpoint simply means a fresh harvest. */
  let cp = null;
  try { cp = readCheckpoint(cpFile); } catch { cp = null; }
  if (cp) {
    const use = checkpointUsable(cp);
    if (use.fatal) {
      console.error('pep-worldwide: REFUSING to resume — ' + use.reason);
      process.exit(1);
    }
    if (!use.ok) { console.log('pep-worldwide: ' + use.reason); cp = null; }
  }
  const st = cp ? restoreCheckpoint(cp) : null;   // revalidated — cp is not used past here

  /* The recency window and harvest timestamp come from the ORIGINAL run so
     every resume filters the same graph slice. */
  const sinceIso = st ? st.sinceIso : new Date(Date.now() - RECENCY_MONTHS * 30.44 * 86400000).toISOString().slice(0, 19) + 'Z';
  const harvestedAt = st ? st.harvestedAt : new Date().toISOString();
  const resumeCount = st ? st.resumeCount : 0;

  const positions = st ? st.positions : new Map();   // posQid → { label, country, classKey }
  const posByClass = st ? st.posByClass : new Map(); // classKey → [posQid]
  const holderRows = st ? st.holderRows : [];
  const classHolders = st ? st.classHolders : {};    // classKey → holder rows (across resumes)
  const classBatchFailed = st ? st.classBatchFailed : {};   // classKey → lost batches (per-class zero-holders gate)
  let batchTotal = st ? st.batchTotal : 0;
  let batchFailed = st ? st.batchFailed : 0;

  /* Write the artifact through the SAME floor + shrink gates the final write
     uses. Read-and-catch, no existence pre-check (CodeQL js/file-system-race):
     an absent or unreadable previous artifact simply means first-harvest
     semantics for the shrink gate. */
  const writeArtifact = (dataset) => {
    let prev = null;
    try { prev = readJsonMaybeGz(outfile); } catch { prev = null; }
    const gate = datasetFloorOk(dataset, prev);
    if (!gate.ok) return { ...gate, hadPrev: !!prev };
    writeJsonGz(outfile, dataset);
    return { ok: true, hadPrev: !!prev };
  };

  /* Ship what we have. The harvest takes several links to label everyone, and
     until now the artifact appeared only at the very end — so a chain that was
     28% done delivered NOTHING to the daily screen. Each pause now also writes
     the dataset built from the names banked so far, flagged partial, so the PEP
     layer goes live early and improves link by link. The floor and shrink gates
     still apply unchanged: a partial that is thinner than 60% of the artifact
     already on the branch is REFUSED, which is exactly what stops a fresh cycle
     from replacing last week's complete list with its first few thousand. Set
     by the labels loop, because that is the only phase with names to write. */
  let shipPartial = null;

  const writeCp = (phase, extra) => writeCheckpoint(cpFile, ({
    v: 1, sinceIso, harvestedAt, resumeCount, phase,
    positions: [...positions], posByClass: [...posByClass],
    holderRows, classHolders, classBatchFailed, batchTotal, batchFailed, ...extra,
  }));

  /* Best-effort: a partial that fails the gates (too thin, or thinner than the
     artifact already published) simply is not written — the harvest carries on
     and the previous artifact stands. Never fatal; only the FINAL write is. */
  const shipPartialNow = () => {
    if (!shipPartial) return;
    try {
      const d = shipPartial();
      const g = writeArtifact(d);
      console.log(g.ok
        ? `pep-worldwide: PARTIAL artifact published — ${d.count} of ${d.expected} persons (${Math.round(100 * d.count / d.expected)}%); the screen will flag it as partial coverage`
        : `pep-worldwide: partial artifact NOT published — ${g.reason}`);
    } catch (e) {
      console.error('pep-worldwide: partial artifact write failed: ' + (e && e.message || e));
    }
  };

  const pause = (phase, extra) => {
    writeCp(phase, extra);
    shipPartialNow();
    console.log(`pep-worldwide: time budget (${PEP_TIME_BUDGET_MIN} min) reached — checkpoint written (phase ${phase}, resume ${resumeCount}, ${holderRows.length} holder rows so far); exiting ${RESUME_EXIT_CODE} for the workflow to re-dispatch`);
    process.exit(RESUME_EXIT_CODE);
  };

  /* Bank progress when the RUN is killed, not just when the budget is reached.
     A cancelled Actions job SIGTERMs the step, and until now that threw away
     everything the link had harvested — two cancelled links lost 83 and 34
     minutes of WDQS work that was already in memory. The phase loops keep this
     pointing at a closure that serialises their current position, so an
     interrupt writes exactly the checkpoint a budget pause would have, and the
     workflow's persist step (which runs on cancellation too) commits it.
     Cheap insurance: a signal that arrives before any loop sets it just exits. */
  let bankProgress = null;
  const onSignal = (sig) => {
    if (!bankProgress) { console.log(`pep-worldwide: ${sig} before any harvest progress — nothing to bank`); process.exit(RESUME_EXIT_CODE); }
    try {
      bankProgress();
      shipPartialNow();
      console.log(`pep-worldwide: ${sig} received — checkpoint written (${holderRows.length} holder rows banked); the next run resumes from it`);
    } catch (e) {
      console.error('pep-worldwide: could not bank progress on ' + sig + ': ' + (e && e.message || e));
    }
    process.exit(RESUME_EXIT_CODE);
  };
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));

  if (st) {
    console.log(`pep-worldwide: RESUMING from checkpoint (resume ${resumeCount}/${PEP_MAX_RESUMES}, phase ${st.phase}, ${holderRows.length} holder rows banked, window since ${sinceIso})`);
  } else {
    console.log(`pep-worldwide: harvesting (recency window ${RECENCY_MONTHS} months → since ${sinceIso})`);
  }

  if (!st || st.phase === 'positions') {
    for (const cls of PEP_ROOT_CLASSES) {
      /* The positions phase is normally seconds per class, but a WDQS brownout
         (retry backoffs stack up to minutes per class) could eat the whole
         budget before the holders loop ever checks it — pause here too. */
      if (overBudget()) pause('positions', { next: { classIdx: 0, posIdx: 0 } });
      /* A required class whose P279* enumeration times out is a transient WDQS
         failure, not "the class is empty" — retry hard, and only fail loudly if
         it STILL yields nothing after retries. Optional classes tolerate zero. */
      const pdata = await fetchJsonSafe(sparqlUrl(positionsQuery(cls.qid)));
      const rows = pdata ? parseSparqlBindings(pdata) : [];
      const qids = [];
      for (const r of rows) {
        if (!r.pos || !/^Q\d+$/.test(r.pos)) continue;
        if (!positions.has(r.pos)) positions.set(r.pos, { label: '', country: '', classKey: cls.key });
        qids.push(r.pos);
      }
      /* A FAILED re-enumeration must never overwrite what a previous link
         already banked: on resume the checkpoint's position list is the better
         evidence, and blanking it would silently zero an already-enumerated
         class (fatal for a required one, silent recall loss for an optional). */
      if (pdata || !(posByClass.get(cls.key) || []).length) {
        posByClass.set(cls.key, [...new Set(qids)]);
      } else {
        console.log(`  ${cls.key}: re-enumeration failed — keeping ${posByClass.get(cls.key).length} banked position items from the checkpoint`);
      }
      console.log(`  ${cls.key}: ${posByClass.get(cls.key).length} position items`);
      if (!posByClass.get(cls.key).length && !cls.optional) {
        console.error(`pep-worldwide: root class ${cls.key} (${cls.qid}) enumerated ZERO position items (query ${pdata ? 'returned empty' : 'failed after retries'}) — refusing a hollow harvest`);
        process.exit(1);
      }
    }
  }

  /* Holders phase. Resume indices address the position ARRAY (posIdx), not
     batch ordinals, so a changed HOLDER_BATCH between runs cannot skew the
     restart point. A labels-phase checkpoint skips this loop entirely. */
  const startClass = st && st.phase === 'holders' ? st.next.classIdx : 0;
  const startPos = st && st.phase === 'holders' ? st.next.posIdx : 0;
  if (!st || st.phase === 'positions' || st.phase === 'holders') {
    for (let ci = startClass; ci < PEP_ROOT_CLASSES.length; ci++) {
      const cls = PEP_ROOT_CLASSES[ci];
      const qids = posByClass.get(cls.key) || [];
      for (let i = ci === startClass ? startPos : 0; i < qids.length; i += HOLDER_BATCH) {
        bankProgress = () => writeCp('holders', { next: { classIdx: ci, posIdx: i } });
        if (overBudget()) pause('holders', { next: { classIdx: ci, posIdx: i } });
        const batch = qids.slice(i, i + HOLDER_BATCH);
        batchTotal++;
        const hdata = await fetchJsonSafe(sparqlUrl(holdersQuery(batch, sinceIso)));
        if (hdata === null) {                              // flaky batch — counted, not fatal
          batchFailed++;
          classBatchFailed[cls.key] = (classBatchFailed[cls.key] || 0) + 1;
          continue;
        }
        for (const r of parseSparqlBindings(hdata)) {
          if (!r.person || !/^Q\d+$/.test(r.person)) continue;
          holderRows.push({ person: r.person, pos: r.pos, end: r.end || '', classKey: cls.key });
          classHolders[cls.key] = (classHolders[cls.key] || 0) + 1;
        }
        console.log(`  ${cls.key}: batch ${Math.floor(i / HOLDER_BATCH) + 1}/${Math.ceil(qids.length / HOLDER_BATCH)} — ${classHolders[cls.key] || 0} holder rows so far`);
      }
      // A required class that ended with zero holders AND lost batches OF ITS
      // OWN is an outage, not an empty class; the batch-failure gate below
      // catches it. Gating on the GLOBAL counter disarmed this guard entirely —
      // one flaky batch anywhere earlier (or restored from a checkpoint) let a
      // genuinely empty required class pass as screened coverage.
      if (!classHolders[cls.key] && !cls.optional && !classBatchFailed[cls.key]) {
        console.error(`pep-worldwide: root class ${cls.key} yielded ZERO holders on a clean sweep — refusing a hollow harvest`);
        process.exit(1);
      }
      if (!classHolders[cls.key] && cls.optional) console.log(`  ${cls.key}: zero holders (optional class — QID pending live verification)`);
    }
  }
  const bgate = batchFailureOk(batchFailed, batchTotal);
  if (!bgate.ok) {
    console.error('pep-worldwide: REFUSING to write — ' + bgate.reason + ' (previous artifact kept)');
    process.exit(1);
  }
  if (batchFailed) console.log(`pep-worldwide: tolerated ${batchFailed}/${batchTotal} flaky holder batches (within the ${Math.round(PEP_MAX_BATCH_FAIL_PCT * 100)}% gate)`);

  /* Office labels — AFTER holders and scoped to positions that actually have
     one. Labelling every enumerated position cost 1,614 requests (80,677 QIDs)
     and ate a whole 40-min budget at 25% done, for a field that is cosmetic:
     buildPepDataset falls back to the position QID, and PERSON-name recall
     never depends on it. Best-effort throughout — a lost chunk just leaves
     those offices QID-labelled. */
  if (!st || st.phase !== 'labels') {
    const heldQids = [...new Set(holderRows.map(r => r.pos))].filter(q => positions.has(q));
    console.log(`pep-worldwide: labelling ${heldQids.length} offices that have holders (of ${positions.size} enumerated)`);
    for (let i = 0; i < heldQids.length; i += LABEL_WINDOW) {
      if (overBudget()) pause('labels', { labelQids: [...new Set(holderRows.map(r => r.person))], names: [], next: { labelIdx: 0 } });
      for (const data of await fetchLabelWindow(heldQids, i)) {
        if (!data) continue;
        for (const [qid, ent] of Object.entries((data && data.entities) || {})) {
          const p = positions.get(qid);
          if (p) p.label = namesFromEntity(ent).name || p.label;
        }
      }
      if ((i / LABEL_WINDOW) % 8 === 0) console.log(`  office labels: ${Math.min(i + LABEL_WINDOW, heldQids.length)}/${heldQids.length}`);
    }
  }

  /* Labels phase — resumable per chunk; banked names ride the checkpoint. */
  let personQids, names, labelStart;
  if (st && st.phase === 'labels') {
    personQids = st.labelQids;
    names = st.names;
    labelStart = st.next.labelIdx;
    console.log(`pep-worldwide: resuming names at ${labelStart}/${personQids.length} (${names.size} banked)`);
  } else {
    personQids = [...new Set(holderRows.map(r => r.person))];
    names = new Map();
    labelStart = 0;
    console.log(`pep-worldwide: ${holderRows.length} holder rows → ${personQids.length} distinct persons; fetching multilingual names`);
  }

  /* Take only this shard's slice. Applied AFTER the resume branch so a shard
     resumes against its own slice and its own labelIdx, and skipped entirely
     when COUNT is 1 — the ordinary weekly harvest is byte-for-byte unchanged.
     Whatever the shard has already banked for people OUTSIDE its slice (from a
     checkpoint written before sharding) is kept, never discarded. */
  if (PEP_SHARD_COUNT > 1) {
    const all = personQids;
    /* A shard drives its slice from ZERO, not from the checkpoint's labelIdx —
       that index counts into the FULL list, so reusing it would make a shard
       skip most of its own work. Instead it simply drops the people already
       labelled in the checkpoint, which is the same "don't redo finished work"
       guarantee expressed against the data rather than a position. */
    personQids = shardOf(all).filter(q => !names.has(q));
    labelStart = 0;
    console.log(`pep-worldwide: SHARD ${PEP_SHARD_INDEX}/${PEP_SHARD_COUNT} — ${personQids.length} unlabelled of ${shardOf(all).length} in this slice (${all.length} total); shards never push, the merge step assembles the dataset`);
  }
  /* Publish what the checkpoint already carries, at STARTUP rather than waiting
     for this link's pause. A resumed link runs for its whole budget before it
     pauses, so without this the names banked by the PREVIOUS link sit unused for
     another hour and a half. Same gated write, so a partial too thin to publish
     is still refused. */
  shipPartial = () => buildPepDataset({
    harvestedAt, holderRows, positions: new Map([...positions].map(([q, p]) => [q, p])),
    names, expected: personQids.length,
  });
  if (names.size) shipPartialNow();

  /* labelIdx advances only after a WHOLE window resolves, so a pause mid-window
     re-fetches at most that window on resume — idempotent, since every result
     is a Map set keyed by QID. */
  for (let i = labelStart; i < personQids.length; i += LABEL_WINDOW) {
    bankProgress = () => writeCp('labels', { labelQids: personQids, names: [...names], next: { labelIdx: i } });
    shipPartial = () => buildPepDataset({
      harvestedAt, holderRows, positions: new Map([...positions].map(([q, p]) => [q, p])),
      names, expected: personQids.length,
    });
    if (overBudget()) pause('labels', { labelQids: personQids, names: [...names], next: { labelIdx: i } });
    for (const data of await fetchLabelWindow(personQids, i)) {   // a lost label chunk just leaves those persons unnamed (dropped)
      if (data) for (const [qid, ent] of Object.entries((data && data.entities) || {})) names.set(qid, namesFromEntity(ent));
    }
    if ((i / LABEL_WINDOW) % 4 === 0) console.log(`  names: ${Math.min(i + LABEL_WINDOW, personQids.length)}/${personQids.length}`);
  }

  /* A shard's job ends here: it emits the names it holds and writes NOTHING to
     the artifact or the state branch. Assembling the dataset needs every
     shard's slice, and only the merge step has them all — a shard writing its
     own view would publish a list missing everyone else's people, which the
     shrink gate would then hold against the real one. */
  if (PEP_SHARD_COUNT > 1) {
    writeJsonGz(outfile, { v: 1, shard: PEP_SHARD_INDEX, of: PEP_SHARD_COUNT, harvestedAt, names: [...names] });
    console.log(`pep-worldwide: shard ${PEP_SHARD_INDEX}/${PEP_SHARD_COUNT} done — ${names.size} names emitted to ${outfile} for the merge step`);
    return 0;
  }

  const dataset = buildPepDataset({ harvestedAt, holderRows, positions: new Map([...positions].map(([q, p]) => [q, p])), names });
  const gate = writeArtifact(dataset);
  if (!gate.ok) {
    console.error('pep-worldwide: REFUSING to write — ' + gate.reason + (gate.hadPrev ? ' (previous artifact kept)' : ''));
    process.exit(1);
  }
  /* Harvest complete — the checkpoint (if any) is spent; clearing it here
     makes the persist step drop it from the state branch too. */
  try { unlinkSync(cpFile); console.log('pep-worldwide: checkpoint cleared'); } catch { /* none to clear */ }
  console.log(`pep-worldwide: wrote ${dataset.count} persons (${Object.entries(dataset.classes).map(([k, v]) => k + ':' + v).join(', ')}) → ${outfile}`);
  return 0;
}

/* Assemble a sharded harvest: base checkpoint (holder rows, positions, the full
   person list) + every shard's slice of names → the artifact. Runs once, on one
   runner, so there is exactly one writer of the state branch and no race.

   Fails LOUDLY on a missing shard rather than publishing a list with a slice
   silently absent: a dataset quietly short of a shard's people would screen
   those PEPs as clean, which is precisely the silent-degradation this codebase
   refuses. The usual floor and shrink gates still guard the write on top. */
async function mergeShards(outfile, cpFile, shardFiles) {
  const cp = readJsonMaybeGz(cpFile);
  const st = restoreCheckpoint(cp);
  const slices = [];
  for (const f of shardFiles) {
    let s = null;
    try { s = readJsonMaybeGz(f); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.names)) {
      console.error(`pep-worldwide: REFUSING to merge — shard file ${f} is missing or unreadable; publishing without it would silently drop those people from the screened list`);
      return 1;
    }
    console.log(`  shard ${s.shard}/${s.of}: ${s.names.length} names`);
    slices.push(s.names);
  }
  const names = mergeShardNames([[...st.names], ...slices]);
  const expected = st.labelQids.length;
  const dataset = buildPepDataset({
    harvestedAt: st.harvestedAt, holderRows: st.holderRows, positions: st.positions, names,
    expected,
  });
  let prev = null;
  try { prev = readJsonMaybeGz(outfile); } catch { prev = null; }
  const gate = datasetFloorOk(dataset, prev);
  if (!gate.ok) {
    console.error('pep-worldwide: REFUSING to write — ' + gate.reason + (prev ? ' (previous artifact kept)' : ''));
    return 1;
  }
  writeJsonGz(outfile, dataset);
  if (!dataset.partial) {
    try { unlinkSync(cpFile); console.log('pep-worldwide: harvest COMPLETE — checkpoint cleared'); } catch { /* none to clear */ }
  }
  console.log(`pep-worldwide: merged ${slices.length} shards → ${dataset.count} of ${expected} persons${dataset.partial ? ' (PARTIAL)' : ' (complete)'} → ${outfile}`);
  return 0;
}

async function main(argv) {
  if (argv[0] === 'harvest' && argv[1]) return harvest(argv[1]);
  if (argv[0] === 'merge-shards' && argv.length >= 4) return mergeShards(argv[1], argv[2], argv.slice(3));
  console.error('usage: pep-worldwide.mjs harvest <outfile>\n       pep-worldwide.mjs merge-shards <outfile> <checkpoint> <shard-file>...');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
}
