/* Regulatory Watch — worldwide, UAE-weighted.

   Fingerprints each source in data/reg-sources.json and, on any change,
   produces a change report. The GitHub Actions workflow
   (.github/workflows/regulatory-watch.yml) then opens a PULL REQUEST carrying
   the updated state + report (and, if an ANTHROPIC_API_KEY secret is present,
   an AI-drafted update proposal) for MLRO review. Detection is automatic;
   updating the regulator-grade wording stays a reviewed decision.

   Country black/grey LIST changes are handled by the FATF Watchdog
   (scripts/fatf-watchdog.mjs); this watcher covers regulations, circulars,
   procedures and guidance across the wider source set.

   Modes:  check (default — compare + write report)  |  seed (record current
   fingerprints, no change flagged).

   Pure logic is exported for offline unit tests (test/reg-watch.test.mjs);
   network fetching is injected so tests never hit the network.
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const SOURCES_FILE  = 'data/reg-sources.json';
export const STATE_FILE    = 'data/reg-watch-state.json';
export const SNAPSHOT_DIR  = 'data/reg-watch-snapshots';
export const REPORT_FILE   = 'reg-watch-report.md';
export const CHANGES_FILE  = 'reg-watch-changes.json';

/* ── Registry ── */
export function loadSources(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const list = Array.isArray(data) ? data : data.sources;
  if (!Array.isArray(list)) throw new Error('reg-sources: no sources array');
  const ids = new Set();
  for (const s of list) {
    if (!s.id || !s.name || !s.url) throw new Error('reg-sources: each source needs id, name, url (offender: ' + JSON.stringify(s) + ')');
    if (ids.has(s.id)) throw new Error('reg-sources: duplicate id ' + s.id);
    ids.add(s.id);
    if (!/^https?:\/\//.test(s.url)) throw new Error('reg-sources: ' + s.id + ' url must be http(s)');
  }
  return list;
}

/* ── Content normalisation + fingerprint ──
   Strip script/style/comments and tags, collapse whitespace, lowercase, so
   that only meaningful text changes move the fingerprint (not markup churn or
   one-off whitespace). Imperfect by design — the PR review gate absorbs the
   occasional false positive; we never auto-publish. */
export function extractText(raw) {
  return denoise(String(raw || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script\b[^>]*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/* Strip volatile-but-meaningless tokens so a page's timestamps, session ids,
   nonces and cache-busters don't shift the fingerprint on every fetch and open
   a spurious PR. Tuned to leave real regulatory figures intact: only digit runs
   of 8+ are removed, so thresholds like 55,000 / 60,000 still register. */
export function denoise(text) {
  return text
    .replace(/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}(:\d{2})?(\.\d+)?z?/g, ' ')   // ISO datetimes
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')                                   // ISO dates
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' ')                           // d/m/y dates
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?/g, ' ')                   // clock times
    .replace(/(©|copyright)\s*\d{4}(\s*[-–]\s*\d{4})?/g, ' ')             // copyright years
    .replace(/\b[0-9a-f]{20,}\b/g, ' ')                                   // long hex / nonces
    .replace(/(csrf|nonce|token|sessionid|sid|jsessionid|phpsessid|_ga|_gid|utm_[a-z]+|requestid|request-id|cache[-_]?bust|build|ver|v|ts)=[a-z0-9._-]+/g, ' ')
    .replace(/\d{8,}/g, ' ');                                             // long digit runs (timestamps/ids)
}
export function fingerprint(raw) {
  return createHash('sha256').update(extractText(raw), 'utf8').digest('hex');
}

/* ── Persistent-failure alerting ──
   A single failed fetch is routine (site hiccup, runner egress blip) and is
   re-checked next run. A source failing this many CONSECUTIVE runs is a
   monitoring gap — it gets flagged on the Asana card exactly once, when the
   streak crosses the threshold, so an outage can never decay silently. */
export const ERROR_STREAK_ALERT = 3;
export function persistentErrors(changes) {
  return changes.filter(c => c.status === 'error' && c.errorStreak === ERROR_STREAK_ALERT);
}

/* ── Wayback fallback helpers (also used by fatf-watchdog for the same
   reason: several regulators 403/418 datacenter fetchers). A snapshot is
   trusted only when fresh, and always requested with the id_ flag so the
   bytes are the origin's own HTML (no wayback toolbar/rewriting) and the
   fingerprint stays comparable with direct fetches. */
export const SNAPSHOT_STALE_DAYS = 7;
export const BASELINE_SNAPSHOT_MAX_DAYS = 90;
export function snapshotAgeDays(ts, now = Date.now()) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(ts || ''));
  if (!m) return Infinity;
  return (now - Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) / 86400000;
}
export function rawSnapshotUrl(url) {
  return String(url || '').replace(/^http:/, 'https:').replace(/(\/web\/\d{14})\//, '$1id_/');
}
export function tsToIsoDate(ts) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(ts || ''));
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}
/* Whether an archived capture is safe to fingerprint. Unlike the FATF
   Watchdog (which diffs list SEMANTICS and must refuse anything stale), the
   Regulatory Watch only needs a monotonic baseline: a capture can never
   raise a reversed/false "changed" alert as long as it is not OLDER than
   the content we already recorded (notBefore = the source's changedAt).
   For a source with no baseline at all, any capture within
   BASELINE_SNAPSHOT_MAX_DAYS beats zero coverage — its age is recorded as
   `via` provenance so the reviewer sees exactly what was fingerprinted. */
export function captureAcceptable(ts, notBefore, now = Date.now()) {
  const day = tsToIsoDate(ts);
  if (!day) return false;
  if (snapshotAgeDays(ts, now) > BASELINE_SNAPSHOT_MAX_DAYS) return false;
  if (notBefore) return day >= notBefore;
  return true;
}

/* ── Detailed content diff ──
   The fingerprint says THAT a page changed; this says WHAT changed, so the
   Asana card can deliver additions/deletions in detail instead of "content
   changed — go look". Segments are sentences of the normalised extract;
   membership diffing (not LCS) is deliberate: it is order-insensitive, cheap,
   and a modification simply shows as one removal plus one addition. Excerpts
   are capped so a full page rewrite cannot blow up the card. */
export function diffTexts(oldText, newText, { maxExcerpts = 4, maxLen = 220 } = {}) {
  const seg = t => String(t || '')
    .split(/(?<=[.!?;])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);
  const a = seg(oldText), b = seg(newText);
  const aSet = new Set(a), bSet = new Set(b);
  const added = b.filter(s => !aSet.has(s));
  const removed = a.filter(s => !bSet.has(s));
  const clip = arr => arr.slice(0, maxExcerpts).map(s => s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s);
  return { addedCount: added.length, removedCount: removed.length, added: clip(added), removed: clip(removed) };
}

/* ── Change-severity triage ──
   Labels every detected change LOW / MEDIUM / HIGH so the Asana card says
   what to read first. Heuristic (always available, offline-testable):
   regulatory instrument language in the delta → HIGH; a multi-segment delta
   → MEDIUM; cosmetic churn → LOW. The AI draft step may override with its
   own judgement (reg-draft.mjs); the heuristic is the floor, never silent. */
const SEVERITY_HIGH_RE = /(threshold|circular|regulation|decree|resolution|directive|deadline|penalt|prohibit|obligat|must|shall|licen[cs]|freez|sanction|designat|guidance|standard|amendment|article \d)/i;
export function classifySeverity(diff) {
  if (!diff) return { severity: 'MEDIUM', reason: 'content changed — no itemised delta available yet, review the page' };
  const texts = [...(diff.added || []), ...(diff.removed || [])];
  const hit = texts.find(t => SEVERITY_HIGH_RE.test(t));
  if (hit) {
    const term = (hit.match(SEVERITY_HIGH_RE) || [])[0];
    return { severity: 'HIGH', reason: 'delta contains regulatory-instrument language ("' + term + '")' };
  }
  const moved = (diff.addedCount || 0) + (diff.removedCount || 0);
  if (moved >= 3) return { severity: 'MEDIUM', reason: moved + ' content segments moved — substantive page update' };
  return { severity: 'LOW', reason: 'small delta with no regulatory-instrument language — likely routine site churn' };
}

/* ── Diff fetched content against stored state ──
   fetched: object (or Map) id -> { ok, status, body, error }
   Returns { changes:[...], state }. Each change has a status:
     new        — first time we see a brand-new source (counts as a change)
     changed    — text moved versus the last good snapshot (counts)
     recovered  — first good snapshot after a prior fetch error (does NOT count)
     unchanged  — text identical to last snapshot
     error      — fetch failed OR an "ok" response had empty content
   Errors and empty 200s never count as content changes and never overwrite a
   known-good hash, so a 404, a flaky network, or an empty gateway page cannot
   raise a false PR. */
export function computeChanges(sources, prevState, fetched, today) {
  const prev = (prevState && prevState.sources) || {};
  const stateSources = {};
  const changes = [];
  const base = s => ({ id: s.id, name: s.name, jurisdiction: s.jurisdiction, url: s.url });
  for (const s of sources) {
    const f = fetched[s.id] || fetched.get?.(s.id);
    const old = prev[s.id];
    const okResponse = f && f.ok !== false && !f.error && typeof f.body === 'string';
    const text = okResponse ? extractText(f.body) : '';
    if (!okResponse || text.length === 0) {
      const detail = okResponse ? 'empty response (no text content)'
        : (f && (f.error || ('HTTP ' + (f && f.status)))) || 'fetch failed';
      const status = (f && f.status) || 'error';
      const errorStreak = ((old && old.errorStreak) || 0) + 1;
      stateSources[s.id] = old
        ? { ...old, checkedAt: today, status, error: detail, errorStreak }
        : { hash: null, bytes: 0, checkedAt: today, changedAt: null, status, error: detail, errorStreak };
      changes.push({ ...base(s), status: 'error', detail, errorStreak });
      continue;
    }
    const hash = fingerprint(f.body);
    const bytes = text.length;
    /* Provenance: how the content was obtained (direct vs wayback fallback). */
    const via = f.via ? { via: f.via } : {};
    /* contentAsOf = the date the content itself is from: the capture's own
       timestamp for archive fetches, today for direct fetches. This — not
       the day WE recorded it — is the floor future captures must clear,
       otherwise a source recovered from a capture rejects that same capture
       next run (its ts predates our recording day) and flip-flops to error. */
    const asOf = (f.snapshotTs && tsToIsoDate(f.snapshotTs)) || today;
    if (!old) {
      stateSources[s.id] = { hash, bytes, checkedAt: today, changedAt: today, contentAsOf: asOf, status: f.status || 200, ...via };
      changes.push({ ...base(s), status: 'new', newHash: hash, ...via });
    } else if (old.hash == null) {
      /* first good snapshot after a prior error — record silently, no PR */
      stateSources[s.id] = { hash, bytes, checkedAt: today, changedAt: today, contentAsOf: asOf, status: f.status || 200, ...via };
      changes.push({ ...base(s), status: 'recovered', newHash: hash, ...via });
    } else if (old.hash !== hash) {
      stateSources[s.id] = { hash, bytes, checkedAt: today, changedAt: today, contentAsOf: asOf, status: f.status || 200, prevHash: old.hash, ...via };
      changes.push({ ...base(s), status: 'changed', prevHash: old.hash, newHash: hash, prevBytes: old.bytes, newBytes: bytes, ...via });
    } else {
      /* Rebuild rather than spread so a stale error/errorStreak from a past
         failed run is cleared the moment the source fetches clean again.
         contentAsOf only moves forward (same content, newest confirmation). */
      const prevAsOf = old.contentAsOf || old.changedAt || '';
      stateSources[s.id] = { hash: old.hash, bytes: old.bytes, checkedAt: today, changedAt: old.changedAt, contentAsOf: asOf > prevAsOf ? asOf : prevAsOf, status: f.status || 200, ...(old.prevHash ? { prevHash: old.prevHash } : {}), ...via };
      changes.push({ ...base(s), status: 'unchanged' });
    }
  }
  return { changes, state: { updated: today, sources: stateSources } };
}

export function contentChanges(changes) {
  return changes.filter(c => c.status === 'new' || c.status === 'changed');
}

/* True when anything other than checkedAt/contentAsOf moved (hash, status,
   error, errorStreak, provenance). Drives the workflow's state commit so error
   streaks persist across runs even when no content changed — without it a
   source could fail every day and the streak would reset each run.
   contentAsOf must be stripped too: an unchanged direct fetch advances it to
   today on every run, so leaving it in would make EVERY run "materially
   changed" and this function permanently true. A genuine content change still
   registers via hash/changedAt. */
export function stateMateriallyChanged(prevState, nextState) {
  const strip = st => JSON.stringify(Object.fromEntries(
    Object.entries((st && st.sources) || {}).map(([id, v]) => {
      const { checkedAt: _checkedAt, contentAsOf: _contentAsOf, ...rest } = v || {};
      return [id, rest];
    })
  ));
  return strip(prevState) !== strip(nextState);
}

/* ── Human-readable report (PR body + committed artifact) ── */
export function buildReport(changes, today, mode) {
  const moved = contentChanges(changes);
  const errors = changes.filter(c => c.status === 'error');
  const seeded = changes.filter(c => c.status !== 'error').length;
  const lines = [];
  if (mode === 'seed') {
    lines.push('# Regulatory Watch — baseline — ' + today);
    lines.push('');
    lines.push('Recorded baseline fingerprints for **' + seeded + '** of ' + changes.length + ' monitored source(s). A seed run flags no changes; future weekly runs compare against this baseline.');
    if (errors.length) appendErrors(lines, errors);
    lines.push('');
    lines.push('_Detection is automatic; wording changes are a reviewed decision. Country black/grey list moves are handled by the FATF Watchdog._');
    return lines.join('\n');
  }
  lines.push('# Regulatory Watch — ' + today);
  lines.push('');
  if (!moved.length) {
    lines.push('No regulatory content changes detected across ' + changes.length + ' monitored sources.');
  } else {
    lines.push('**' + moved.length + ' source(s) changed** out of ' + changes.length + ' monitored. Review and apply any needed updates to `assets/super-data.js` (Q&A answers / tool citations) and `index.html` (country / risk data).');
    lines.push('');
    lines.push('| Source | Jurisdiction | Change | Link |');
    lines.push('| --- | --- | --- | --- |');
    for (const c of moved) {
      lines.push('| ' + c.name + ' | ' + (c.jurisdiction || '') + ' | ' + (c.status === 'new' ? 'first snapshot' : 'content changed') + ' | ' + c.url + ' |');
    }
    const detailed = moved.filter(c => c.diff || c.diffNote);
    if (detailed.length) {
      lines.push('');
      lines.push('**What changed — additions and deletions in detail:**');
      for (const c of detailed) {
        if (c.diff) {
          const sev = c.severity ? ' — severity **' + c.severity + '**' + (c.severityReason ? ' (' + c.severityReason + ')' : '') : '';
          lines.push('- **' + c.name + '** — ' + c.diff.addedCount + ' added / ' + c.diff.removedCount + ' removed segment(s)' + sev);
          for (const s of c.diff.added) lines.push('  - ➕ added: “' + s + '”');
          for (const s of c.diff.removed) lines.push('  - ➖ removed: “' + s + '”');
          if (c.diff.addedCount > c.diff.added.length || c.diff.removedCount > c.diff.removed.length) {
            lines.push('  - … excerpts capped; full text in data/reg-watch-snapshots/' + c.id + '.txt history');
          }
        } else {
          lines.push('- **' + c.name + '** — ' + c.diffNote);
        }
      }
    }
  }
  const stuck = errors.filter(e => (e.errorStreak || 0) >= ERROR_STREAK_ALERT);
  if (stuck.length) {
    lines.push('');
    lines.push('**⚠ ' + stuck.length + ' source(s) persistently unreachable — a monitoring gap, investigate:**');
    lines.push('');
    for (const e of stuck) lines.push('- ' + e.name + ' — ' + e.detail + ' — failing ' + e.errorStreak + ' consecutive runs (' + e.url + ')');
  }
  const transient = errors.filter(e => (e.errorStreak || 0) < ERROR_STREAK_ALERT);
  if (transient.length) appendErrors(lines, transient);
  lines.push('');
  lines.push('_Detection is automatic; wording changes are a reviewed decision. Country black/grey list moves are handled by the FATF Watchdog._');
  return lines.join('\n');
}

function appendErrors(lines, errors) {
  lines.push('');
  lines.push('<details><summary>' + errors.length + ' source(s) could not be fetched (no action — re-checked next run)</summary>');
  lines.push('');
  for (const e of errors) lines.push('- ' + e.name + ' — ' + e.detail + ' (' + e.url + ')');
  lines.push('');
  lines.push('</details>');
}

/* ── Network (only used by the runner, not by tests) ──
   Browser-equivalent headers (same as fatf-watchdog): several regulators
   (CBUAE, FATF, OECD, NAMLCFTC, UN) reject non-browser user-agents from
   datacenter IPs, which starved those sources of any snapshot at all. */
const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en'
};

async function fetchDirect(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: BROWSER_HEADERS });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: res.ok ? body : '', error: res.ok ? null : ('HTTP ' + res.status) };
  } catch (e) {
    /* undici hides the real network failure (TLS, DNS, reset) in e.cause —
       surface it, or "fetch failed" is all the state ever records. */
    const cause = e && e.cause && (e.cause.code || e.cause.message);
    const msg = String(e && e.message || e) + (cause ? ' (' + cause + ')' : '');
    return { ok: false, status: 'error', body: '', error: msg.slice(0, 200) };
  } finally {
    clearTimeout(t);
  }
}

/* Serialize Save Page Now requests: anonymous SPN rate-limits per IP, and
   GitHub-hosted runners share IP pools, so parallel bursts guarantee 429s.
   One request at a time with a courtesy gap maximizes the chance of a slot. */
let spnChain = Promise.resolve();
function enqueueSpn(fn) {
  const run = spnChain.then(fn, fn);
  spnChain = run.then(() => new Promise(r => setTimeout(r, 3000)), () => {});
  return run;
}

/* Authenticated Save Page Now (SPN2 job API). With an archive.org API key —
   set ARCHIVE_SPN_KEYS="accesskey:secret" from https://archive.org/account/s3.php —
   captures are queued with a real per-account quota instead of the anonymous
   per-IP lottery that 429s GitHub's shared runners. Returns the header value
   or null when the env var is missing/malformed. */
export function spnAuthHeader(keys) {
  const v = String(keys || '').trim();
  return /^[^:\s]+:[^:\s]+$/.test(v) ? 'LOW ' + v : null;
}

async function spnAuthenticatedCapture(url, auth) {
  const jsonHeaders = { 'accept': 'application/json', 'authorization': auth, 'user-agent': BROWSER_HEADERS['user-agent'] };
  try {
    const r = await fetch('https://web.archive.org/save', {
      method: 'POST',
      headers: { ...jsonHeaders, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'url=' + encodeURIComponent(url)
    });
    const j = r.ok ? await r.json().catch(() => ({})) : {};
    console.log('spn2 submit ' + url + ': HTTP ' + r.status + (j.job_id ? ' job ' + j.job_id : ''));
    if (!r.ok || !j.job_id) return null;
    for (let i = 0; i < 15; i++) {
      await new Promise(res => setTimeout(res, 6000));
      const s = await fetch('https://web.archive.org/save/status/' + j.job_id, { headers: jsonHeaders });
      if (!s.ok) continue;
      const st = await s.json().catch(() => ({}));
      if (st.status === 'success' && st.timestamp) {
        console.log('spn2 captured ' + url + ' @ ' + st.timestamp);
        return String(st.timestamp);
      }
      if (st.status === 'error') {
        console.log('spn2 error for ' + url + ': ' + (st.status_ext || st.message || 'unknown'));
        return null;
      }
    }
    console.log('spn2 timed out waiting for capture of ' + url);
  } catch (e) {
    console.warn('spn2 failed for ' + url + ': ' + String(e && e.message || e).slice(0, 120));
  }
  return null;
}

/* Direct fetch with one retry on transient network failure, then the same
   two-stage Wayback fallback the FATF Watchdog uses for sources whose bot
   protection 403/418s the runner outright:
     2. Save Page Now — archive.org fetches the LIVE page from its side and
        returns a timestamped capture (their crawler is not bot-blocked);
     3. failing that, archive.org's most recent EXISTING capture.
   Only a FRESH capture is ever trusted (never stale — diffing an old
   snapshot would raise reversed/false alerts), and the content is always
   re-fetched with the id_ flag so the bytes are the origin's own HTML and
   fingerprints stay comparable with direct fetches.
   `fetchFn` is injectable so tests never hit the network. */
export async function fetchWithFallback(url, fetchFn = fetchDirect, opts = {}) {
  const notBefore = opts.notBefore || null; /* ISO date of the content we already hold */
  let direct = await fetchFn(url);
  if (direct.ok) return direct;
  if (direct.status === 'error') {
    /* transient network failure/timeout — one retry before falling back */
    await new Promise(r => setTimeout(r, 3000));
    direct = await fetchFn(url);
    if (direct.ok) return direct;
  }
  /* 2a. Authenticated Save Page Now, when an API key is configured — a real
     per-account quota, so a capture is guaranteed rather than a rate-limit
     lottery. Serialized like the anonymous path. */
  const auth = spnAuthHeader(process.env.ARCHIVE_SPN_KEYS);
  if (auth) {
    const ts = await enqueueSpn(() => spnAuthenticatedCapture(url, auth));
    if (ts && captureAcceptable(ts, notBefore)) {
      const snap = await fetchFn('https://web.archive.org/web/' + ts + 'id_/' + url);
      console.log('spn2 capture fetch ' + ts + ' for ' + url + ': ' + (snap.ok ? 'OK' : (snap.error || snap.status)));
      if (snap.ok && snap.body) return { ...snap, status: 200, via: 'web.archive.org save-page-now ' + ts, snapshotTs: ts };
    }
  }
  /* 2b. Anonymous Save Page Now — serialized (see enqueueSpn) and honoring
     Retry-After, because anonymous SPN rate-limits shared runner IPs hard.
     Every outcome is logged — a silent fallback is undiagnosable from a
     green run. */
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await enqueueSpn(async () => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 75000); /* SPN crawls live — allow longer than a direct fetch */
        try {
          return await fetch('https://web.archive.org/save/' + url, { headers: BROWSER_HEADERS, redirect: 'follow', signal: ctrl.signal });
        } finally { clearTimeout(t); }
      });
      const ts = (/\/web\/(\d{14})/.exec(r.url || '') || [])[1] || '';
      console.log('save-page-now ' + url + ' (attempt ' + attempt + '): HTTP ' + r.status + ' -> ' + (r.url || '(no url)'));
      if (r.ok && ts && captureAcceptable(ts, notBefore)) {
        const snap = await fetchFn('https://web.archive.org/web/' + ts + 'id_/' + url);
        console.log('save-page-now capture fetch ' + ts + ' for ' + url + ': ' + (snap.ok ? 'OK' : (snap.error || snap.status)));
        if (snap.ok && snap.body) return { ...snap, status: 200, via: 'web.archive.org save-page-now ' + ts, snapshotTs: ts };
      }
      if (r.ok) break;
      if (r.status !== 429 && r.status < 500) break; /* only 429/5xx are worth retrying */
      if (attempt < 2) {
        const ra = Math.min(30, Number(r.headers?.get?.('retry-after')) || 0) * 1000;
        await new Promise(res => setTimeout(res, ra || 8000));
      }
    } catch (e) {
      console.warn('save-page-now failed for ' + url + ' (attempt ' + attempt + '): ' + String(e && e.message || e).slice(0, 120));
      if (attempt < 2) await new Promise(r => setTimeout(r, 8000));
    }
  }
  /* 3. Most recent existing capture, if acceptable as a baseline. */
  const ts = await waybackLatestTs(url);
  if (ts && captureAcceptable(ts, notBefore)) {
    const snap = await fetchFn('https://web.archive.org/web/' + ts + 'id_/' + url);
    console.log('wayback capture fetch ' + ts + ' for ' + url + ': ' + (snap.ok ? 'OK' : (snap.error || snap.status)));
    if (snap.ok && snap.body) return { ...snap, status: 200, via: 'web.archive.org snapshot ' + ts, snapshotTs: ts };
  } else if (ts) {
    console.log('wayback: latest capture of ' + url + ' is ' + ts + ' (' + Math.round(snapshotAgeDays(ts)) + 'd old'
      + (notBefore ? ', baseline ' + notBefore : '') + ') — not acceptable');
  } else {
    console.log('wayback: no capture found for ' + url);
  }
  return direct; /* original failure — recorded as status:error, re-checked next run */
}

/* Newest capture timestamp for a URL. The CDX index is authoritative; the
   availability API (kept as a backup) often serves a stale cache. */
async function waybackLatestTs(url) {
  try {
    const r = await fetch('https://web.archive.org/cdx/search/cdx?url=' + encodeURIComponent(url)
      + '&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=-1', { headers: BROWSER_HEADERS });
    console.log('wayback cdx ' + url + ': HTTP ' + r.status);
    if (r.ok) {
      const rows = await r.json();
      const last = Array.isArray(rows) && rows.length > 1 ? rows[rows.length - 1] : null;
      if (last && last[0]) return String(last[0]);
    }
  } catch (e) {
    console.warn('wayback cdx failed for ' + url + ': ' + String(e && e.message || e).slice(0, 120));
  }
  try {
    const av = await fetch('https://archive.org/wayback/available?url=' + encodeURIComponent(url), { headers: BROWSER_HEADERS });
    console.log('wayback availability ' + url + ': HTTP ' + av.status);
    if (av.ok) {
      const closest = (await av.json())?.archived_snapshots?.closest;
      if (closest && closest.timestamp) return String(closest.timestamp);
    }
  } catch (e) {
    console.warn('wayback availability failed for ' + url + ': ' + String(e && e.message || e).slice(0, 120));
  }
  return null;
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { updated: null, sources: {} };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { console.warn('reg-watch: state file unreadable, starting fresh (' + e.message + ')'); return { updated: null, sources: {} }; }
}

function setOutput(key, val) {
  /* Sanitize before writing to GITHUB_OUTPUT: a CR/LF in the value (e.g. an upstream
     error message folded into a title) could inject additional output lines; cap the
     length so a pathological message can't bloat the step context. */
  const clean = String(val == null ? '' : val).replace(/[\r\n]+/g, ' ').slice(0, 300);
  if (process.env.GITHUB_OUTPUT) { try { writeFileSync(process.env.GITHUB_OUTPUT, key + '=' + clean + '\n', { flag: 'a' }); } catch {} }
}

async function main() {
  const mode = process.argv[2] || 'check';
  const sources = loadSources(readFileSync(SOURCES_FILE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const prevState = loadState();

  const fetched = {};
  await Promise.all(sources.map(async s => {
    /* A source with recorded content must never be fingerprinted from an
       archive capture older than that content (reversed-alert guard).
       contentAsOf is the content's own date — for archive-recovered sources
       that is the capture timestamp, so the same capture stays acceptable. */
    const prev = (prevState.sources || {})[s.id];
    const notBefore = prev && prev.hash ? (prev.contentAsOf || prev.changedAt || null) : null;
    fetched[s.id] = await fetchWithFallback(s.url, undefined, { notBefore });
  }));
  for (const s of sources) {
    const f = fetched[s.id];
    if (f && f.via) console.log(s.id + ': via ' + f.via);
    else if (f && !f.ok) console.log(s.id + ': ' + (f.error || ('HTTP ' + f.status)));
  }

  const { changes, state } = computeChanges(sources, prevState, fetched, today);
  const moved = contentChanges(changes);
  const errors = changes.filter(c => c.status === 'error');
  const seeded = changes.filter(c => c.status !== 'error').length;

  /* Detailed delivery: diff each changed source against its previous text
     snapshot, then refresh snapshots for every good fetch. Snapshots live on
     the reg-watch-state branch alongside the fingerprint state. */
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  for (const c of changes) {
    const f = fetched[c.id];
    if (!f || !f.ok || typeof f.body !== 'string') continue;
    const newText = extractText(f.body);
    if (!newText) continue;
    const snapFile = SNAPSHOT_DIR + '/' + c.id + '.txt';
    if (c.status === 'changed') {
      let oldText = '';
      try { oldText = readFileSync(snapFile, 'utf8'); } catch {}
      if (oldText) {
        c.diff = diffTexts(oldText, newText);
        console.log(c.id + ': diff +' + c.diff.addedCount + ' / -' + c.diff.removedCount + ' segment(s)');
      } else {
        c.diffNote = 'first detailed snapshot recorded — additions/deletions will be itemised from the next change';
      }
      const sev = classifySeverity(c.diff);
      c.severity = sev.severity;
      c.severityReason = sev.reason;
      console.log(c.id + ': severity ' + c.severity + ' — ' + sev.reason);
    }
    writeFileSync(snapFile, newText + '\n');
  }

  const report = buildReport(changes, today, mode);

  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  writeFileSync(REPORT_FILE, report + '\n');

  /* A source crossing the persistent-failure threshold is flagged on the
     Asana card alongside content changes — a dead source is itself a
     monitoring event, not something to bury in a gitignored report. */
  const alerts = mode === 'seed' ? [] : persistentErrors(changes).map(c => ({
    ...c, status: 'unreachable',
    detail: (c.detail || 'fetch failed') + ' — failing ' + c.errorStreak + ' consecutive runs'
  }));
  const flagged = mode === 'seed' ? [] : [...moved, ...alerts];
  writeFileSync(CHANGES_FILE, JSON.stringify({ date: today, mode, changes: flagged }, null, 2) + '\n');

  const plural = n => n === 1 ? '' : 's';
  let prTitle;
  if (mode === 'seed') {
    prTitle = 'Regulatory Watch — baseline (' + seeded + ' source' + plural(seeded) + ')';
  } else if (moved.length && alerts.length) {
    prTitle = 'Regulatory Watch — ' + moved.length + ' source change' + plural(moved.length) + ' + ' + alerts.length + ' unreachable';
  } else if (alerts.length) {
    prTitle = 'Regulatory Watch — ' + alerts.length + ' source' + plural(alerts.length) + ' unreachable';
  } else if (moved.length) {
    prTitle = 'Regulatory Watch — ' + moved.length + ' source change' + plural(moved.length);
  } else {
    prTitle = 'Regulatory Watch — state refresh (no content changes)';
  }

  console.log(report);
  console.log('\nmode=' + mode + '  content-changes=' + moved.length + '  errors=' + errors.length + '  unreachable-alerts=' + alerts.length + '  seeded=' + seeded);
  setOutput('has_changes', flagged.length ? 'true' : 'false');
  /* Commit state whenever anything beyond checkedAt moved (e.g. an error
     streak advanced) so persistent-failure tracking survives between runs. */
  setOutput('state_dirty', stateMateriallyChanged(prevState, state) ? 'true' : 'false');
  setOutput('changed_count', String(mode === 'seed' ? seeded : moved.length));
  setOutput('pr_title', prTitle);
  setOutput('report_file', REPORT_FILE);
}

/* Run only when invoked directly (node scripts/reg-watch.mjs), never when
   imported by a test or by reg-draft.mjs. pathToFileURL handles path encoding
   and avoids the substring false-match that endsWith() would allow. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
