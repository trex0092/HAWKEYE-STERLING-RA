/* Sanctions Screen — daily ongoing screening of the live customer base against
   the consolidated designation + watchlists.

   Sibling to the Sanctions Watch (which fingerprints the LISTS for changes) and
   the FATF Watchdog (country black/grey list moves). Where the Watch answers
   "did a list change?", this answers the operative question: "is any of OUR
   customers/counterparties now ON a list?"

   Flow (runner): read the active counterparties from the Asana "Customer
   Database" project → batch-screen them against the Hawkeye Sterling engine
   (OFAC SDN/non-SDN, UN, EU, UK OFSI, UAE EOCN + Local Terrorist List, INTERPOL
   red notices and adverse media, per the engine's loaded corpus) → diff the
   results against the last run → on any NEW match raise one alert card in the
   "Regulations / Governance / Sanctions" Asana project for MLRO / four-eyes
   review. Ongoing monitoring: a standing match is recorded once, not re-alerted
   every day; a brand-new match always alerts.

   Detection is automatic; the freeze / decline / report action stays a reviewed
   decision (MLRO sign-off + dual attestation — UAE Federal Decree-Law No. 10 of
   2025 Art.16/18; FATF R.26). A "0 hits" result is NEVER treated as clearance
   when the engine could not be reached or reports itself degraded — that surfaces
   loudly instead of passing silently.

   Network (Asana read + engine screen + Asana post) is isolated from the pure
   logic below so test/sanctions-screen.test.mjs runs fully offline. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { notifyAsana, esc, REG_PROJECT_GID, asanaEnabled } from './asana-notify.mjs';

export const STATE_FILE   = 'data/sanctions-screen-state.json';
export const REPORT_FILE  = 'sanctions-screen-report.md';
export const CHANGES_FILE = 'sanctions-screen-changes.json';

/* "Customer Database" project (workspace: Compliance Tasks) — the screening
   subject of record. Override with ASANA_CUSTOMER_PROJECT_GID. */
export const CUSTOMER_PROJECT_GID =
  process.env.ASANA_CUSTOMER_PROJECT_GID || '1214107620220121';

/* The lists the engine screens against (for the report/alert provenance line).
   Coverage is the engine's, not this repo's — kept here only for the human note. */
export const COVERAGE = 'OFAC SDN/non-SDN · UN · EU · UK OFSI · UAE EOCN + Local Terrorist List · INTERPOL red notices · adverse media';

/* A score at/above this is treated as a material match. Conservative: a hit with
   no score is kept (never silently dropped). Override with SCREEN_MATCH_THRESHOLD. */
export const DEFAULT_THRESHOLD = Number(process.env.SCREEN_MATCH_THRESHOLD) || 0.85;

/* ── Pure helpers (no network; unit-tested) ───────────────────────────────── */

/* Fold a name to a stable comparison key: strip diacritics, lower-case, collapse
   non-alphanumerics. Turkish/Arabic trade names compare cleanly across runs. */
export function normalizeName(s) {
  return String(s == null ? '' : s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

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

/* Normalise a single engine hit (the REST/MCP shapes vary across fields). */
export function normalizeHit(h) {
  if (!h || typeof h !== 'object') return null;
  const hitName = h.hitName || h.name || h.caption || h.matchedName || h.entity || '';
  const list = h.list || h.listName || h.source || h.dataset || h.programme || h.program || h.regime || h.sanctionsList || '';
  const score = num(h.matchScore != null ? h.matchScore : (h.score != null ? h.score : h.confidence));
  const hitId = h.hitId || h.id || h.entityId || h.canonicalId || '';
  const category = h.hitCategory || h.category || h.topic || h.schema || h.type || '';
  return { hitName: String(hitName), list: String(list), score, hitId: String(hitId), category: String(category) };
}

/* Normalise the whole engine response to {results:[{key,name,hits,degraded}], degraded}.
   Tolerates {results:[…]} | {data:[…]} | […] | a single {subject,hits}. Each result
   is re-keyed to the subject it screened so jurisdiction/gid survive. */
export function normalizeScreenResponse(json, subjects = []) {
  const byKey = new Map(subjects.map(s => [s.key, s]));
  let rows = [];
  if (Array.isArray(json)) rows = json;
  else if (json && Array.isArray(json.results)) rows = json.results;
  else if (json && Array.isArray(json.data)) rows = json.data;
  else if (json && (json.subject || json.name || json.hits)) rows = [json];

  let degraded = !!(json && (json.degraded || (json._provenance && json._provenance.degraded)));
  const results = rows.map(r => {
    const subjName = (r.subject && (r.subject.name || r.subject)) || r.name || r.query || r.input || '';
    const key = normalizeName(subjName);
    const src = byKey.get(key);
    const rawHits = Array.isArray(r.hits) ? r.hits : (Array.isArray(r.matches) ? r.matches : []);
    const hits = rawHits.map(normalizeHit).filter(Boolean);
    if (r.degraded) degraded = true;
    return {
      key,
      name: (src && src.name) || String(subjName),
      jurisdiction: src && src.jurisdiction,
      gid: src && src.gid,
      hits,
      degraded: !!r.degraded
    };
  });
  return { results, degraded };
}

export function isMaterial(hit, threshold) {
  if (!hit) return false;
  if (hit.score == null) return true;            /* unscored hit → keep (conservative) */
  return hit.score >= (typeof threshold === 'number' ? threshold : DEFAULT_THRESHOLD);
}

export function hitKey(hit) {
  return normalizeName((hit.list || 'list') + ' :: ' + (hit.hitId || hit.hitName || 'hit'));
}

/* Diff this run's material hits against the recorded state. Returns the NEW
   matches to alert on (a standing match recorded last run does not re-alert),
   the cleared matches (informational), and the next state to persist. Subjects
   that errored this run carry their prior state forward untouched. */
export function diffState(prevState, results, today, threshold) {
  const prev = (prevState && prevState.subjects) || {};
  const nextSubjects = { ...prev };
  const alerts = [];
  const cleared = [];
  let materialCount = 0;

  for (const r of results) {
    if (r.errored) continue;                      /* keep prior state; never wipe on an error */
    const material = (r.hits || []).filter(h => isMaterial(h, threshold));
    materialCount += material.length;
    const prevHits = (prev[r.key] && prev[r.key].hits) || {};
    const nextHits = {};
    const newHits = [];
    for (const h of material) {
      const k = hitKey(h);
      const firstSeen = (prevHits[k] && prevHits[k].firstSeen) || today;
      nextHits[k] = { hitName: h.hitName, list: h.list, score: h.score, category: h.category, firstSeen };
      if (!prevHits[k]) newHits.push(h);
    }
    for (const k of Object.keys(prevHits)) {
      if (!nextHits[k]) cleared.push({ key: r.key, name: r.name, hit: prevHits[k] });
    }
    if (material.length) nextSubjects[r.key] = { name: r.name, jurisdiction: r.jurisdiction, lastScreenedAt: today, hits: nextHits };
    else if (nextSubjects[r.key]) delete nextSubjects[r.key]; /* fully cleared */
    if (newHits.length) alerts.push({ key: r.key, name: r.name, jurisdiction: r.jurisdiction, gid: r.gid, newHits });
  }

  return { alerts, cleared, materialCount, nextState: { updated: today, subjects: nextSubjects } };
}

/* The governance footer every screening output carries — detection is automatic,
   the consequence is a reviewed, dual-attested decision. */
export const GOVERNANCE_NOTE =
  'Detection is automatic. Do NOT freeze, decline or report on a match before MLRO review and a two-person (four-eyes) sign-off — UAE Federal Decree-Law No. 10 of 2025 Art.16/18; FATF R.26. A possible name match is not confirmation: disambiguate against the customer’s identifiers first.';

function hitLine(h) {
  const score = h.score == null ? '' : ' (' + Math.round(h.score * 100) + '%)';
  const list = h.list ? ' [' + h.list + ']' : '';
  return (h.hitName || 'match') + list + score;
}

/* Plain-text report — the no-token preview, the issue-fallback body, the run log. */
export function buildScreenReport(alerts, cleared, today, meta = {}) {
  const lines = [];
  lines.push('# Sanctions Screen — ' + today, '');
  lines.push('Screened **' + (meta.screened != null ? meta.screened : '?') + '** active counterparties from the Customer Database against: ' + COVERAGE + '.', '');
  if (meta.degraded) lines.push('> ⚠ The screening engine reported **degraded** coverage on this run — treat any "no match" as provisional and re-run. Hits below are still valid.', '');
  if (meta.errored) lines.push('> ⚠ **' + meta.errored + '** subject(s) could not be screened this run (engine error) — their prior status was kept, not cleared.', '');

  if (!alerts.length) {
    lines.push('No **new** sanctions/watchlist matches.', '');
  } else {
    lines.push('**' + alerts.length + ' customer(s) with a NEW match — review immediately.**', '');
    lines.push('| Customer | Jurisdiction | Matched |', '| --- | --- | --- |');
    for (const a of alerts) {
      lines.push('| ' + a.name + ' | ' + (a.jurisdiction || '') + ' | ' + a.newHits.map(hitLine).join('; ') + ' |');
    }
    lines.push('');
  }
  if (cleared && cleared.length) {
    lines.push('<details><summary>' + cleared.length + ' previously-recorded match(es) no longer returned (no action — informational)</summary>', '');
    for (const c of cleared) lines.push('- ' + c.name + ' — ' + hitLine(c.hit));
    lines.push('', '</details>', '');
  }
  lines.push('_' + GOVERNANCE_NOTE + '_');
  return lines.join('\n');
}

/* Asana rich-text body (html_notes) for the alert card. */
export function buildScreenHtml(alerts, { runLink, today, degraded } = {}) {
  const items = alerts.map(a => {
    const juris = a.jurisdiction ? ' (' + esc(a.jurisdiction) + ')' : '';
    const hits = a.newHits.map(h => esc(hitLine(h))).join('; ');
    return '<li><strong>' + esc(a.name) + '</strong>' + juris + ' — matched ' + hits + '</li>';
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
      name: a.name + ' — sanctions match: ' + a.newHits.map(h => h.list || 'list').filter(Boolean).join(', '),
      jurisdiction: a.jurisdiction || '',
      status: 'new',
      hits: a.newHits
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

async function postEngine(cfg, body, timeoutMs = 90000) {
  return withTimeout(async (signal) => {
    const r = await fetch(cfg.url.replace(/\/$/, '') + cfg.path, {
      method: 'POST',
      signal,
      headers: { Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error('engine ' + r.status + ': ' + JSON.stringify((d && (d.error || d.errors)) || d || '').slice(0, 200));
    return d;
  }, timeoutMs);
}

async function screenViaEngine(subjects, cfg) {
  const results = [];
  let anyOk = false, degraded = false, errored = 0;
  for (let i = 0; i < subjects.length; i += cfg.batchSize) {
    const batch = subjects.slice(i, i + cfg.batchSize);
    try {
      const json = await postEngine(cfg, { subjects: batch.map(s => ({ name: s.name, entityType: s.entityType, jurisdiction: s.jurisdiction, idNumber: s.idNumber })) });
      const norm = normalizeScreenResponse(json, batch);
      anyOk = true;
      if (norm.degraded) degraded = true;
      /* engine may return fewer rows than subjects — backfill missing as clean-but-screened */
      const got = new Set(norm.results.map(r => r.key));
      for (const r of norm.results) results.push(r);
      for (const s of batch) if (!got.has(s.key)) results.push({ key: s.key, name: s.name, jurisdiction: s.jurisdiction, gid: s.gid, hits: [] });
    } catch (e) {
      console.error('sanctions-screen: batch ' + (Math.floor(i / cfg.batchSize) + 1) + ' failed — ' + (e && e.message || e));
      for (const s of batch) { results.push({ key: s.key, name: s.name, jurisdiction: s.jurisdiction, gid: s.gid, hits: [], errored: true }); errored++; }
    }
  }
  return { results, anyOk, degraded, errored };
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
    url: process.env.HAWKEYE_API_URL || '',
    key: process.env.HAWKEYE_API_KEY || '',
    path: process.env.HAWKEYE_SCREEN_PATH || '/api/screen',
    batchSize: Number(process.env.SCREEN_BATCH_SIZE) || 100,
    threshold: DEFAULT_THRESHOLD
  };
  const asanaToken = process.env.ASANA_ACCESS_TOKEN || '';

  if (!asanaToken) return bailUnscreened('ASANA_ACCESS_TOKEN not set — cannot read the Customer Database', today);
  if (!cfg.url || !cfg.key) return bailUnscreened('HAWKEYE_API_URL / HAWKEYE_API_KEY not set — screening engine not configured', today);

  let subjects;
  try { subjects = await fetchAsanaSubjects(CUSTOMER_PROJECT_GID, asanaToken); }
  catch (e) { return bailUnscreened('could not read the Customer Database (' + (e && e.message || e) + ')', today); }
  if (!subjects.length) return bailUnscreened('the Customer Database returned 0 active customers', today);

  const screen = await screenViaEngine(subjects, cfg);
  if (!screen.anyOk) return bailUnscreened('the screening engine was unreachable for every batch', today);

  const prevState = loadState();
  const { alerts, cleared, materialCount, nextState } = diffState(prevState, screen.results, today, cfg.threshold);
  const meta = { screened: subjects.length, degraded: screen.degraded, errored: screen.errored };
  const report = buildScreenReport(alerts, cleared, today, meta);
  const changes = buildChangesArtifact(alerts, today);

  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2) + '\n');
  writeFileSync(REPORT_FILE, report + '\n');
  writeFileSync(CHANGES_FILE, JSON.stringify(changes, null, 2) + '\n');

  console.log(report);
  console.log('\nscreened=' + subjects.length + '  new-matches=' + alerts.length + '  material-hits=' + materialCount + '  degraded=' + screen.degraded + '  errored=' + screen.errored);

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
