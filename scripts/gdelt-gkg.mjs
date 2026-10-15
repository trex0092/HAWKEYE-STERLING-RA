/* GDELT GKG bulk parsing and subject matching for the JS daily screen.

   Port of screen_gkg.py. Same windowing, same row parser, same token-set
   matching, so the two engines agree on which subjects a GKG row names.
   Pure functions only; network and zip I/O live in fetchGkgWindow below.
   No runtime dependencies: zip is read with Node's built-in zlib. */
import { inflateRawSync, constants as zlibConstants } from 'node:zlib';

const TITLE_RE = /<PAGE_TITLE>([\s\S]*?)<\/PAGE_TITLE>/i;
const SRCLC_RE = /srclc:([a-z]{2,3})/i;

/* Newest-first 15-minute GKG stamps (YYYYMMDDHHMMSS) for a complete window. */
export function gkgFileStamps(endUtc, hours, lagSlots) {
  const end = new Date(endUtc);
  end.setUTCSeconds(0, 0);
  const minuteBack = (end.getUTCMinutes() % 15) + 15 * lagSlots;
  const base = new Date(end.getTime() - minuteBack * 60000);
  const out = [];
  for (let i = 0; i < hours * 4; i++) {
    const d = new Date(base.getTime() - 15 * i * 60000);
    out.push(d.toISOString().replace(/[-:T]/g, '').slice(0, 14));
  }
  return out;
}

function gkgNames(field) {
  const out = [];
  const seen = new Set();
  for (const part of String(field || '').split(';')) {
    const comma = part.lastIndexOf(',');
    const name = (comma >= 0 ? part.slice(0, comma) : part).trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

function unescapeHtml(s) {
  return s.replace(/&(amp|lt|gt|quot|#39|#x27|apos);/g, (m, e) =>
    ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", apos: "'" })[e]);
}

/* Parse GKG 2.1 rows; malformed rows are counted, never hidden. */
export function parseGkgRows(text) {
  const rows = [];
  let bad = 0;
  for (const line of String(text || '').split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    if (f.length < 27) { bad++; continue; }
    const t = TITLE_RE.exec(f[26] || '');
    const l = SRCLC_RE.exec(f[25] || '');
    rows.push({
      date: f[1].slice(0, 8),
      stamp: f[1],
      source: f[3],
      url: f[4],
      persons: gkgNames(f[12]),
      orgs: gkgNames(f[14]),
      themes: String(f[7] || '').split(';').filter(Boolean),
      title: t ? unescapeHtml(t[1]).trim() : '',
      lang: l ? l[1].toLowerCase() : 'en',
    });
  }
  return { rows, bad };
}

/* Subject token index with caller-supplied name semantics (as in Python). */
export function gkgSubjectIndex(subjects, normalizeFn, coreTokensFn) {
  const full = new Map();
  const fl = new Map();
  const org = new Map();
  const add = (map, k, v) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(v); };
  for (const [key, name, kind] of subjects) {
    const toks = normalizeFn(name).split(/\s+/).filter(Boolean);
    if (kind === 'person') {
      if (toks.length < 2) continue;
      const set = new Set(toks);
      add(full, [...set].sort().join('|'), key);
      const flKey = toks[0] + '\u0000' + toks[toks.length - 1];
      if (!fl.has(flKey)) fl.set(flKey, []);
      fl.get(flKey).push({ key, tokens: set });
    } else {
      const core = coreTokensFn(normalizeFn(name));
      if (core.length >= 2) add(org, [...new Set(core)].sort().join('|'), key);
    }
  }
  return { full, fl, org };
}

/* Subject keys named by one parsed GKG row. */
export function gkgMatch(row, idx, normalizeFn, coreTokensFn) {
  const keys = new Set();
  for (const person of row.persons) {
    const toks = normalizeFn(person).split(/\s+/).filter(Boolean);
    if (toks.length < 2) continue;
    const set = new Set(toks);
    for (const k of idx.full.get([...set].sort().join('|')) || []) keys.add(k);
    for (const c of idx.fl.get(toks[0] + '\u0000' + toks[toks.length - 1]) || []) {
      if ([...set].every(t => c.tokens.has(t))) keys.add(c.key);
    }
  }
  for (const orgName of row.orgs) {
    const core = coreTokensFn(normalizeFn(orgName));
    if (core.length >= 2) {
      for (const k of idx.org.get([...new Set(core)].sort().join('|')) || []) keys.add(k);
    }
  }
  return keys;
}

/* Extract the single CSV entry from a GDELT GKG zip (local file header walk).
   Tolerates data-descriptor sizes by inflating to the end of the stream. */
export function unzipSingleEntry(buf) {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('gkg: not a zip local header');
  const method = buf.readUInt16LE(8);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const data = buf.subarray(30 + nameLen + extraLen);
  if (method === 0) return data.toString('utf8');
  if (method !== 8) throw new Error('gkg: unsupported zip method ' + method);
  return inflateRawSync(data, { finishFlush: zlibConstants.Z_SYNC_FLUSH }).toString('utf8');
}

export const GKG_HOST = 'https://data.gdeltproject.org/gdeltv2/';

/* Fetch and match one 48-hour GKG window (default: 192 files, 15 minutes each).
   Returns subject key -> article items shaped like the DOC API's, so the
   adverse-media scorer consumes them unchanged. Fails LOUD: if fewer than
   minFileRatio of the window loads, ok is false and the caller must fall back
   to the per-subject DOC API rather than report a partial window as complete. */
export async function fetchGkgWindowHits({
  subjects, normalizeFn, coreTokensFn, now = new Date(), hours = 48, lagSlots = 1,
  concurrency = 4, minFileRatio = 0.9, fetchFn = globalThis.fetch, timeoutMs = 120000,
}) {
  const stamps = gkgFileStamps(now, hours, lagSlots);
  const idx = gkgSubjectIndex(subjects, normalizeFn, coreTokensFn);
  const hitsBySubject = new Map();
  const counts = { filesOk: 0, filesMissing: 0, filesFailed: 0, rows: 0, badRows: 0 };
  let next = 0;
  const worker = async () => {
    while (next < stamps.length) {
      const stamp = stamps[next++];
      let text;
      try {
        const res = await fetchFn(GKG_HOST + stamp + '.gkg.csv.zip', {
          signal: globalThis.AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 404) { counts.filesMissing++; continue; }
        if (!res.ok) { counts.filesFailed++; continue; }
        text = unzipSingleEntry(Buffer.from(await res.arrayBuffer()));
      } catch {
        counts.filesFailed++;
        continue;
      }
      const parsed = parseGkgRows(text);
      counts.filesOk++;
      counts.rows += parsed.rows.length;
      counts.badRows += parsed.bad;
      for (const row of parsed.rows) {
        for (const key of gkgMatch(row, idx, normalizeFn, coreTokensFn)) {
          if (!hitsBySubject.has(key)) hitsBySubject.set(key, []);
          hitsBySubject.get(key).push({
            title: row.title || row.url,
            link: row.url,
            source: row.source,
            date: row.stamp,
          });
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  const total = stamps.length;
  const ok = counts.filesOk >= Math.ceil(total * minFileRatio);
  return { ok, total, hitsBySubject, ...counts };
}
