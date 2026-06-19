/* Sanctions Screen — daily ongoing screening of the live customer base against
   the consolidated designation + watchlists.

   Sibling to the Sanctions Watch (which fingerprints the LISTS for changes) and
   the FATF Watchdog (country black/grey list moves). Where the Watch answers
   "did a list change?", this answers the operative question: "is any of OUR
   customers/counterparties now ON a list?"

   Flow (runner): read the active counterparties from the Asana "Customer
   Database" project → screen them IN THIS PROCESS against the free consolidated
   lists (OFAC SDN/non-SDN, UN, EU, UK OFSI, the maintained UAE EOCN list, plus
   any extra source) via scripts/sanctions-match.mjs, with free adverse-media
   (Google News RSS) and a best-effort PEP signal (Wikidata) layered on → diff the
   results against the last run → on any NEW match raise one alert card in the
   "Sanctions updates" section of the "Regulations / Governance / Sanctions" Asana
   project for MLRO / four-eyes review. There is no external engine and no API key.
   Ongoing monitoring: a standing match is recorded once, not re-alerted every day;
   a new or CHANGED match always alerts.

   Detection is automatic; the freeze / decline / report action stays a reviewed
   decision (MLRO sign-off + dual attestation — UAE Federal Decree-Law No. 10 of
   2025 Art.16/18; FATF R.26). A "no match" is NEVER treated as clearance when no
   list could be loaded — that surfaces loudly (the run bails as unscreened, or is
   flagged degraded) instead of passing silently.

   Per-subject result shape (from sanctions-match.mjs, same as the old engine):
     { name, topScore (0-100), band, recommendation, hitCount, lists[] }
   A subject is a match when its band is high/critical, its score clears the
   threshold, or it has any list hit (sanctions, adverse media or PEP).

   Network (Asana read + list fetch + media/PEP lookups + Asana post) is isolated
   from the pure logic below so test/sanctions-screen.test.mjs runs fully offline. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { notifyAsana, esc, REG_PROJECT_GID, asanaEnabled } from './asana-notify.mjs';
import { loadSources } from './reg-watch.mjs';
import { normalizeName, parseList, buildIndex, screenName } from './sanctions-match.mjs';
import { checkAdverseMedia } from './adverse-media.mjs';
import { checkPep } from './pep-check.mjs';

/* normalizeName lives in sanctions-match.mjs (the single source of truth) and is
   re-exported here so existing importers (tests, runner) are unchanged. */
export { normalizeName };

export const STATE_FILE   = 'data/sanctions-screen-state.json';
export const REPORT_FILE  = 'sanctions-screen-report.md';
export const CHANGES_FILE = 'sanctions-screen-changes.json';

/* "Customer Database" project (workspace: Compliance Tasks) — the screening
   subject of record. Override with ASANA_CUSTOMER_PROJECT_GID. */
export const CUSTOMER_PROJECT_GID =
  process.env.ASANA_CUSTOMER_PROJECT_GID || '1214107620220121';

/* Consolidated designation lists screened against (data/sanctions-sources.json).
   Override the file with SANCTIONS_SOURCES_FILE. */
export const SANCTIONS_SOURCES_FILE = process.env.SANCTIONS_SOURCES_FILE || 'data/sanctions-sources.json';

/* The lists/signals screening covers (for the report/alert provenance line). */
export const COVERAGE = 'OFAC SDN/non-SDN · UN · EU · UK OFSI · UAE EOCN Local Terrorist List · adverse media (Google News) · PEP (Wikidata)';

/* A score at/above this fraction (engine scores are 0-100) is treated as a match
   even absent an explicit recommendation. Override with SCREEN_MATCH_THRESHOLD. */
export const DEFAULT_THRESHOLD = Number(process.env.SCREEN_MATCH_THRESHOLD) || 0.85;

/* Recommendations / bands that mean "no action". Anything else the engine returns
   is treated as a positive signal (conservative — errs toward flagging). */
const CLEAR_RE = /^(clear|no[_\s-]?match|no[_\s-]?hit|pass|passed|negative|none|nil|ok|false[_\s-]?positive|not[_\s-]?listed|low)$/i;
const HIGH_BANDS = new Set(['critical', 'high', 'severe', 'elevated', 'red', 'amber']);

/* ── Pure helpers (no network; unit-tested) ───────────────────────────────── */

function matchField(notes, re) {
  const m = re.exec(String(notes || ''));
  return m ? m[1].trim().replace(/[\s.;,]+$/, '') : '';
}

/* Turn one Asana customer task into a screening subject. Name is the minimum;
   jurisdiction / id are parsed from the due-diligence notes when present so the
   engine can disambiguate. */
export function parseSubject(task) {
  const name = String((task && task.name) || '').trim();
  const notes = String((task && task.notes) || '');
  const jurisdiction = matchField(notes, /(?:Jurisdiction|Country of Incorporation|Country of Registration|Country)\s*[:\-]\s*([^\n]+)/i);
  const idNumber = matchField(notes, /(?:Trade Licence|Trade License|Licen[cs]e No\.?|Registration(?: No\.?| Number)?|Commercial Register(?:ation)?(?: No\.?)?)\s*[:\-]\s*([^\n]+)/i);
  return {
    key: normalizeName(name),
    name,
    entityType: 'organisation',
    jurisdiction: jurisdiction || undefined,
    idNumber: idNumber || undefined,
    gid: (task && task.gid) || undefined
  };
}

/* Active customers only (completed tasks are off-boarded / archived). */
export function parseSubjects(tasks) {
  const out = [];
  const seen = new Set();
  for (const t of (Array.isArray(tasks) ? tasks : [])) {
    if (t && t.completed) continue;
    const s = parseSubject(t);
    if (!s.name || seen.has(s.key)) continue;
    seen.add(s.key);
    out.push(s);
  }
  return out;
}

function num(v) { return typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && v.trim() && isFinite(Number(v)) ? Number(v) : null); }

/* Normalise one entry of a result's `lists` detail (string or object). */
export function normalizeHit(h) {
  if (h == null) return null;
  if (typeof h === 'string') return { list: h, hitName: '', score: null };
  if (typeof h !== 'object') return null;
  const list = h.list || h.listName || h.source || h.dataset || h.programme || h.program || h.regime || h.sanctionsList || h.name || '';
  const hitName = h.hitName || h.matchedName || h.caption || h.entity || (h.list ? h.name : '') || '';
  const score = num(h.matchScore != null ? h.matchScore : (h.score != null ? h.score : h.confidence));
  return { list: String(list), hitName: String(hitName || ''), score };
}

/* Normalise one engine result row (keyed back to the subject it screened so
   jurisdiction/gid survive). */
export function normalizeResult(r, src) {
  const raw = Array.isArray(r.lists) ? r.lists : (Array.isArray(r.hits) ? r.hits : (Array.isArray(r.matches) ? r.matches : []));
  const subjName = r.name || (r.subject && (r.subject.name || r.subject)) || r.query || '';
  return {
    key: src ? src.key : normalizeName(subjName),
    name: (src && src.name) || String(subjName),
    jurisdiction: src && src.jurisdiction,
    gid: src && src.gid,
    topScore: num(r.topScore != null ? r.topScore : (r.score != null ? r.score : r.matchScore)),
    band: String(r.band || r.riskBand || '').toLowerCase(),
    recommendation: String(r.recommendation || r.disposition || r.decision || '').toLowerCase(),
    hitCount: num(r.hitCount != null ? r.hitCount : r.elevatedCount) || 0,
    lists: raw.map(normalizeHit).filter(Boolean)
  };
}

/* Normalise the whole engine response to {results:[…], degraded}. Tolerates
   {results:[…]} | {data:[…]} | […] | a single result object. */
export function normalizeScreenResponse(json, subjects = []) {
  const byKey = new Map(subjects.map(s => [s.key, s]));
  let rows = [];
  if (Array.isArray(json)) rows = json;
  else if (json && Array.isArray(json.results)) rows = json.results;
  else if (json && Array.isArray(json.data)) rows = json.data;
  else if (json && (json.name || json.subject)) rows = [json];
  const degraded = !!(json && (json.degraded || (json._provenance && json._provenance.degraded)));
  const results = rows.map(r => {
    const key = normalizeName(r.name || (r.subject && (r.subject.name || r.subject)) || '');
    return normalizeResult(r, byKey.get(key));
  });
  return { results, degraded };
}

/* Is this subject a material match? Trust the engine's own recommendation first;
   otherwise fall back to band / score / list hits. Threshold is a fraction (0-1);
   engine scores are 0-100. A "clear" recommendation is only overridden by a hard
   signal (an actual list hit or a maxed score). */
export function isMatch(r, threshold) {
  if (!r) return false;
  const thr = (typeof threshold === 'number' ? threshold : DEFAULT_THRESHOLD) * 100;
  const hasList = !!(r.lists && r.lists.length);
  if (r.recommendation && CLEAR_RE.test(r.recommendation)) {
    return hasList || (typeof r.topScore === 'number' && r.topScore >= 100);
  }
  if (r.recommendation) return true;                       /* any non-clear recommendation */
  if (r.band && HIGH_BANDS.has(r.band)) return true;
  if (typeof r.topScore === 'number' && r.topScore >= thr) return true;
  if (r.hitCount > 0) return true;
  return hasList;
}

/* A stable signature of the match so a standing match is not re-alerted but a
   CHANGED one (new list, escalated band) is. */
export function matchSignature(r) {
  const lists = (r.lists || []).map(h => h.list).filter(Boolean).sort().join(',');
  return [r.band || '', r.recommendation || '', lists].join('|');
}

/* Diff this run's matches against the recorded state. Returns the NEW/CHANGED
   matches to alert on, the cleared matches (informational), and the next state.
   Subjects that errored this run carry their prior state forward untouched —
   never wiped, never silently cleared. */
export function diffState(prevState, results, today, threshold) {
  const prev = (prevState && prevState.subjects) || {};
  const nextSubjects = { ...prev };
  const alerts = [];
  const cleared = [];
  let matchCount = 0;

  for (const r of results) {
    if (r.errored) continue;
    if (isMatch(r, threshold)) {
      matchCount++;
      const sig = matchSignature(r);
      const prior = prev[r.key];
      const firstSeen = (prior && prior.firstSeen) || today;
      nextSubjects[r.key] = {
        name: r.name, jurisdiction: r.jurisdiction, band: r.band, topScore: r.topScore,
        recommendation: r.recommendation, lists: (r.lists || []).map(h => h.list).filter(Boolean),
        signature: sig, firstSeen, lastSeen: today
      };
      if (!prior || prior.signature !== sig) {
        alerts.push({ key: r.key, name: r.name, jurisdiction: r.jurisdiction, gid: r.gid,
          band: r.band, topScore: r.topScore, recommendation: r.recommendation, lists: r.lists || [], isNew: !prior });
      }
    } else if (prev[r.key]) {
      cleared.push({ key: r.key, name: r.name, prior: prev[r.key] });
      delete nextSubjects[r.key];
    }
  }

  return { alerts, cleared, matchCount, nextState: { updated: today, subjects: nextSubjects } };
}

/* The governance footer every screening output carries — detection is automatic,
   the consequence is a reviewed, dual-attested decision. */
export const GOVERNANCE_NOTE =
  'Detection is automatic. Do NOT freeze, decline or report on a match before MLRO review and a two-person (four-eyes) sign-off — UAE Federal Decree-Law No. 10 of 2025 Art.16/18; FATF R.26. A possible name match is not confirmation: disambiguate against the customer’s identifiers first.';

/* One-line summary of a match for tables/cards. */
export function matchSummary(a) {
  const bits = [];
  if (a.band) bits.push(a.band.toUpperCase());
  if (typeof a.topScore === 'number') bits.push('score ' + a.topScore);
  if (a.recommendation) bits.push(a.recommendation);
  const lists = (a.lists || []).map(h => (typeof h === 'string' ? h : h.list)).filter(Boolean);
  if (lists.length) bits.push('lists: ' + lists.join(', '));
  return bits.join(' · ') || 'flagged';
}

/* Plain-text report — the no-token preview, the issue-fallback body, the run log. */
export function buildScreenReport(alerts, cleared, today, meta = {}) {
  const lines = [];
  lines.push('# Sanctions Screen — ' + today, '');
  lines.push('Screened **' + (meta.screened != null ? meta.screened : '?') + '** active counterparties from the Customer Database against: ' + COVERAGE + '.', '');
  if (meta.degraded) lines.push('> ⚠ The screening engine reported **degraded** coverage on this run — treat any "no match" as provisional and re-run.', '');
  if (meta.errored) lines.push('> ⚠ **' + meta.errored + '** subject(s) could not be screened this run (engine error/timeout) — their prior status was kept, not cleared.', '');

  if (!alerts.length) {
    lines.push('No **new** sanctions/watchlist matches.', '');
  } else {
    lines.push('**' + alerts.length + ' customer(s) with a new/changed match — review immediately.**', '');
    lines.push('| Customer | Jurisdiction | Match |', '| --- | --- | --- |');
    for (const a of alerts) {
      lines.push('| ' + a.name + ' | ' + (a.jurisdiction || '') + ' | ' + matchSummary(a) + ' |');
    }
    lines.push('');
  }
  if (cleared && cleared.length) {
    lines.push('<details><summary>' + cleared.length + ' previously-recorded match(es) no longer returned (no action — informational)</summary>', '');
    for (const c of cleared) lines.push('- ' + c.name + ' — was ' + matchSummary(c.prior || {}));
    lines.push('', '</details>', '');
  }
  lines.push('_' + GOVERNANCE_NOTE + '_');
  return lines.join('\n');
}

/* Asana rich-text body (html_notes) for the alert card. */
export function buildScreenHtml(alerts, { runLink, today, degraded } = {}) {
  const items = alerts.map(a => {
    const juris = a.jurisdiction ? ' (' + esc(a.jurisdiction) + ')' : '';
    return '<li><strong>' + esc(a.name) + '</strong>' + juris + ' — ' + esc(matchSummary(a)) + '</li>';
  }).join('');
  const n = alerts.length;
  const parts = ['<body>'];
  parts.push('<h2>⚠ Sanctions screen — ' + n + ' customer' + (n === 1 ? '' : 's') + ' with a new match' + (today ? ' (' + esc(today) + ')' : '') + '</h2>');
  parts.push('<strong>' + n + ' active counterpart' + (n === 1 ? 'y' : 'ies') + ' in the Customer Database now match a sanctions/watchlist. Review immediately.</strong>');
  if (degraded) parts.push('<em>⚠ Engine coverage was degraded this run — treat any non-match as provisional.</em>');
  if (items) parts.push('<ul>' + items + '</ul>');
  parts.push('<em>' + esc(GOVERNANCE_NOTE) + '</em>');
  parts.push('<strong>Screened against:</strong> ' + esc(COVERAGE));
  if (runLink) parts.push('<a href="' + esc(runLink) + '">View the workflow run</a>');
  parts.push('</body>');
  return parts.join('');
}

/* Map alerts to the {date, mode, changes:[…]} artifact shape (parity with the
   other watchers) so the change is never lost even if Asana posting fails. */
export function buildChangesArtifact(alerts, today) {
  return {
    date: today,
    mode: 'screen',
    changes: alerts.map(a => ({
      name: a.name + ' — sanctions match (' + matchSummary(a) + ')',
      jurisdiction: a.jurisdiction || '',
      status: 'new',
      band: a.band,
      topScore: a.topScore,
      recommendation: a.recommendation,
      lists: (a.lists || []).map(h => (typeof h === 'string' ? h : h.list)).filter(Boolean)
    }))
  };
}

/* ── Network (runner only; not imported by tests) ─────────────────────────── */

async function withTimeout(promiseFactory, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await promiseFactory(ctrl.signal); }
  finally { clearTimeout(t); }
}

async function asanaGet(url, token, timeoutMs = 30000) {
  return withTimeout(async (signal) => {
    const r = await fetch(url, { signal, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 200));
    return d;
  }, timeoutMs);
}

async function fetchAsanaSubjects(projectGid, token) {
  const tasks = [];
  let offset = null, pages = 0;
  do {
    const u = new URL('https://app.asana.com/api/1.0/projects/' + projectGid + '/tasks');
    u.searchParams.set('opt_fields', 'name,completed,notes');
    u.searchParams.set('limit', '100');
    if (offset) u.searchParams.set('offset', offset);
    const json = await asanaGet(u, token);
    for (const t of (json.data || [])) tasks.push(t);
    offset = json.next_page && json.next_page.offset;
  } while (offset && ++pages < 50);
  return parseSubjects(tasks);
}

/* Fetch one consolidated list — a remote URL, or an in-repo curated file
   (source.file, e.g. the UAE EOCN list). Returns the raw body or throws. */
async function fetchListBody(source, timeoutMs = 60000) {
  if (source.file) {
    if (!existsSync(source.file)) throw new Error('curated file missing: ' + source.file);
    return readFileSync(source.file, 'utf8');
  }
  /* The URL comes from the in-repo sources config; still validate the scheme so a
     tampered/extra source can only ever trigger an ordinary http(s) GET (never
     file:, ftp:, etc.) before it reaches fetch. */
  let parsed;
  try { parsed = new URL(source.url); } catch { throw new Error('invalid url'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('unsupported url scheme: ' + parsed.protocol);
  return withTimeout(async (signal) => {
    const r = await fetch(parsed.href, { signal, redirect: 'follow', headers: { 'user-agent': 'HawkeyeSterling-SanctionsScreen/1.0' } });
    const body = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return body;
  }, timeoutMs);
}

/* Fetch + parse every enabled source into [{ id, name, names[] }]. A source that
   fails to fetch or yields zero names degrades coverage (reported, never a silent
   all-clear); a curated list with no entries degrades too. */
async function loadSanctionsLists(cfg) {
  let sources;
  try { sources = loadSources(readFileSync(cfg.sourcesFile, 'utf8')).filter(s => s.enabled !== false); }
  catch (e) { return { lists: [], degraded: true, fetched: 0, total: 0, notes: ['sources file unreadable: ' + (e && e.message || e)] }; }

  /* Extra / curated lists (e.g. the UAE EOCN file, or extra national XML lists)
     are loaded leniently — a curated entry has `file` instead of `url`, which the
     strict loadSources validator rejects. */
  if (existsSync(cfg.extraFile)) {
    try {
      const extra = JSON.parse(readFileSync(cfg.extraFile, 'utf8'));
      for (const s of ((extra && extra.sources) || [])) if (s && s.enabled !== false && (s.url || s.file)) sources.push(s);
    } catch (e) { console.error('sanctions-screen: extra sources unreadable (' + (e && e.message || e) + ')'); }
  }

  const lists = [], notes = [];
  let fetched = 0;
  await Promise.all(sources.map(async (s) => {
    try {
      const body = await fetchListBody(s, cfg.listTimeoutMs);
      const names = parseList(s, body);
      if (!names.length) { notes.push(s.name + ' parsed 0 names — coverage degraded'); console.error('sanctions-screen: ' + s.id + ' parsed 0 names'); return; }
      lists.push({ id: s.id, name: s.name, names });
      fetched++;
      console.log('sanctions-screen: loaded ' + s.name + ' (' + names.length + ' designated names)');
    } catch (e) {
      notes.push(s.name + ' could not be loaded (' + (e && e.message || e) + ') — coverage degraded');
      console.error('sanctions-screen: ' + s.id + ' failed — ' + (e && e.message || e));
    }
  }));
  return { lists, degraded: fetched < sources.length, fetched, total: sources.length, notes };
}

/* Run an async fn over items with bounded concurrency (keeps the per-subject
   adverse-media / PEP lookups polite). */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return out;
}

const BAND_RANK = { critical: 4, high: 3, medium: 2, low: 1, '': 0 };
const strongerBand = (a, b) => ((BAND_RANK[a] || 0) >= (BAND_RANK[b] || 0) ? a : b);

/* Screen every subject locally: sanctions name-match against the loaded lists,
   plus (optional) adverse-media and PEP signals. Produces the SAME normalised
   per-subject rows the engine path produced, so diff/alert/report are unchanged.
   Each signal contributes a `lists[]` entry; a subject with any hit is material. */
async function screenLocally(subjects, cfg) {
  const loaded = await loadSanctionsLists(cfg);
  /* No list at all = we cannot screen sanctions — never infer a clean result. */
  if (!loaded.lists.length) return { results: [], anyOk: false, degraded: true, errored: 0, notes: loaded.notes, coverage: loaded };

  const index = buildIndex(loaded.lists);
  const thr = cfg.threshold * 100;
  console.log('sanctions-screen: indexed ' + index.size + ' designated names from ' + loaded.lists.length + ' list(s); matching ' + subjects.length + ' subjects (threshold ' + thr + ')');

  let degraded = loaded.degraded, amErrors = 0, pepErrors = 0;
  const results = await mapLimit(subjects, cfg.concurrency, async (s) => {
    const raw = screenName(s.name, index, thr);   // { name, topScore, band, recommendation, hitCount, lists[] }
    const lists = [...raw.lists];
    let band = raw.lists.length ? raw.band : '';
    let topScore = raw.lists.length ? raw.topScore : 0;

    if (cfg.adverseMedia) {
      const am = await checkAdverseMedia(s.name, { timeoutMs: cfg.checkTimeoutMs });
      if (am.errored) { amErrors++; degraded = true; }
      else if (am.hit) {
        lists.push({ list: 'Adverse media (Google News)', hitName: (am.top && am.top.title || '').slice(0, 180) + (am.terms.length ? ' [' + am.terms.join(', ') + ']' : ''), score: am.score });
        band = strongerBand(band, am.band); topScore = Math.max(topScore, am.score);
      }
    }
    if (cfg.pep) {
      const pp = await checkPep(s.name, { timeoutMs: cfg.checkTimeoutMs });
      if (pp.errored) { pepErrors++; degraded = true; }
      else if (pp.hit) {
        lists.push({ list: 'PEP (Wikidata)', hitName: (pp.match && (pp.match.label + ' — ' + pp.match.description) || '').slice(0, 180), score: pp.score });
        band = strongerBand(band, pp.band); topScore = Math.max(topScore, pp.score);
      }
    }

    const hasSanctions = raw.lists.length > 0;
    const recommendation = hasSanctions ? 'sanctions-match' : (lists.length ? 'review' : 'clear');
    const merged = {
      name: s.name,
      topScore: lists.length ? topScore : raw.topScore,
      band: lists.length ? band : 'low',
      recommendation,
      hitCount: lists.length,
      lists
    };
    return normalizeResult(merged, s);
  });

  if (amErrors) console.error('sanctions-screen: adverse-media lookup failed for ' + amErrors + ' subject(s)');
  if (pepErrors) console.error('sanctions-screen: PEP lookup failed for ' + pepErrors + ' subject(s)');
  return { results, anyOk: true, degraded, errored: 0, notes: loaded.notes, coverage: loaded };
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { updated: null, subjects: {} };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { console.warn('sanctions-screen: state unreadable, starting fresh (' + e.message + ')'); return { updated: null, subjects: {} }; }
}

function setOutput(key, val) {
  if (process.env.GITHUB_OUTPUT) { try { writeFileSync(process.env.GITHUB_OUTPUT, key + '=' + val + '\n', { flag: 'a' }); } catch {} }
}

function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID)
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : '';
}

/* Write outputs + artifacts and exit in the "could not screen" state — loudly,
   never as a false all-clear. */
function bailUnscreened(reason, today) {
  const report = '# Sanctions Screen — ' + today + '\n\n> ⚠ **Screening did NOT run: ' + reason + '**\n>\n> No clearance can be inferred from this run. Fix the configuration and re-run.\n\n_' + GOVERNANCE_NOTE + '_\n';
  mkdirSync('data', { recursive: true });
  writeFileSync(REPORT_FILE, report);
  writeFileSync(CHANGES_FILE, JSON.stringify({ date: today, mode: 'screen', changes: [] }, null, 2) + '\n');
  console.error('sanctions-screen: ' + reason);
  console.log(report);
  setOutput('has_changes', 'false');
  setOutput('match_count', '0');
  setOutput('screen_error', 'true');
  setOutput('asana_posted', 'false');
  setOutput('title', 'Sanctions Screen — could not run (' + reason + ')');
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const cfg = {
    sourcesFile: SANCTIONS_SOURCES_FILE,
    extraFile: process.env.SANCTIONS_EXTRA_FILE || 'data/sanctions-extra.json',
    threshold: Number(process.env.SCREEN_MATCH_THRESHOLD) || DEFAULT_THRESHOLD,
    adverseMedia: process.env.SCREEN_ADVERSE_MEDIA !== '0',   // default on
    pep: process.env.SCREEN_PEP !== '0',                      // default on
    listTimeoutMs: Number(process.env.SCREEN_LIST_TIMEOUT_MS) || 60000,
    checkTimeoutMs: Number(process.env.SCREEN_CHECK_TIMEOUT_MS) || 20000,
    concurrency: Number(process.env.SCREEN_CONCURRENCY) || 4
  };
  const asanaToken = process.env.ASANA_ACCESS_TOKEN || '';

  if (!asanaToken) return bailUnscreened('ASANA_ACCESS_TOKEN not set — cannot read the Customer Database', today);

  let subjects;
  try { subjects = await fetchAsanaSubjects(CUSTOMER_PROJECT_GID, asanaToken); }
  catch (e) { return bailUnscreened('could not read the Customer Database (' + (e && e.message || e) + ')', today); }
  if (!subjects.length) return bailUnscreened('the Customer Database returned 0 active customers', today);

  console.log('sanctions-screen: screening ' + subjects.length + ' active customers against the free consolidated lists'
    + (cfg.adverseMedia ? ' + adverse media' : '') + (cfg.pep ? ' + PEP' : ''));
  const screen = await screenLocally(subjects, cfg);
  if (!screen.anyOk) return bailUnscreened('no sanctions list could be loaded — ' + ((screen.notes || []).join('; ') || 'all sources failed'), today);

  const prevState = loadState();
  const { alerts, cleared, matchCount, nextState } = diffState(prevState, screen.results, today, cfg.threshold);
  const meta = { screened: subjects.length, degraded: screen.degraded, errored: screen.errored };
  const report = buildScreenReport(alerts, cleared, today, meta);
  const changes = buildChangesArtifact(alerts, today);

  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2) + '\n');
  writeFileSync(REPORT_FILE, report + '\n');
  writeFileSync(CHANGES_FILE, JSON.stringify(changes, null, 2) + '\n');

  console.log(report);
  console.log('\nscreened=' + subjects.length + '  new-matches=' + alerts.length + '  total-matches=' + matchCount + '  degraded=' + screen.degraded + '  errored=' + screen.errored);

  const title = alerts.length
    ? '⚠ Sanctions Screen — ' + alerts.length + ' customer match' + (alerts.length === 1 ? '' : 'es')
    : 'Sanctions Screen — no new matches (' + subjects.length + ' screened)';

  let asanaPosted = false;
  if (alerts.length && asanaEnabled()) {
    try {
      const html = buildScreenHtml(alerts, { runLink: runUrl(), today, degraded: screen.degraded });
      const section = process.env.ASANA_SECTION_GID || undefined;
      /* match alerts are higher-severity than list-change notes — pull the review date in */
      const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const url = await notifyAsana(title, report, { project: REG_PROJECT_GID, html, section, due });
      asanaPosted = true;
      console.log('sanctions-screen: Asana alert created' + (url ? ' — ' + url : ''));
    } catch (e) {
      console.error('sanctions-screen: Asana alert failed (' + (e && e.message || e) + ') — workflow will open a GitHub issue.');
    }
  }

  setOutput('has_changes', alerts.length ? 'true' : 'false');
  setOutput('match_count', String(alerts.length));
  setOutput('screen_error', 'false');
  setOutput('asana_posted', asanaPosted ? 'true' : 'false');
  setOutput('title', title);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
