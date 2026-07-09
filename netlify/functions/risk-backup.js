/* Mirrors the compliance risk-data sheet (the officer's score overrides,
   which otherwise live only in the browser) into a single dedicated Asana
   task. A monthly GitHub Action then commits that mirror to the repository
   (data/risk-overrides-backup.json), giving the overrides an off-device
   backup and a git audit trail. Token stays server side. */
const { rateLimit } = require('./_ratelimit');
const { sharedTokenOk } = require('./_auth');
const DEFAULT_PROJECT_GID = '1216203370612914'; /* HAWKEYE STERLING APP */
const TASK_NAME = 'RISK DATA SHEET (auto-backup)';
/* Housekeeping mirror — file it under the ACTIVITY LOG section, not the default first one. */
const LOG_SECTION = 'ACTIVITY LOG';
const SHEET_OPEN = '===RISK DATA SHEET===';
const SHEET_CLOSE = '===END===';

/* CORS is applied here, at the function boundary — see asana-task.js. The
   wrapper answers preflight (OPTIONS) and stamps CORS headers onto every
   response the inner handler returns. */
exports.handler = async (event) => {
  const cors = corsHeaders(event);
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return originAllowed(event)
      ? { statusCode: 204, headers: cors, body: '' }
      : resp(403, { ok: false, error: 'origin not allowed' }, cors);
  }
  const res = await handle(event);
  res.headers = { ...(res.headers || {}), ...cors };
  return res;
};

const handle = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { ok: false, error: 'method not allowed' });
  if (!originAllowed(event)) return resp(403, { ok: false, error: 'origin not allowed' });
  if (!sharedTokenOk(event)) return resp(401, { ok: false, error: 'missing or invalid X-App-Token' });

  /* Per-IP rate limit (normal endpoint): default 100 req/min, tunable via env. */
  const limited = rateLimit(event, { name: 'risk-backup', limit: Number(process.env.RATE_LIMIT_DEFAULT) || 100, windowMs: 60000 });
  if (limited) return limited;

  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) return resp(500, { ok: false, error: 'ASANA_ACCESS_TOKEN not configured' });

  /* Accept JSON only (same gate as asana-task.js) — the browser caller sends JSON. */
  const ctype = String((event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '');
  if (ctype && !/application\/json/i.test(ctype)) return resp(415, { ok: false, error: 'content-type must be application/json' });

  /* Reject an oversized body BEFORE JSON.parse — the 50 KB sheet cap below only
     fires after the whole body has been parsed. 1 MB is generous headroom. */
  if (String(event.body || '').length > 1000000) return resp(413, { ok: false, error: 'request body too large' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return resp(400, { ok: false, error: 'invalid JSON' }); }

  const sheet = payload.sheet;
  if (!sheet || typeof sheet !== 'object' || !sheet.overrides || typeof sheet.overrides !== 'object') {
    return resp(400, { ok: false, error: 'sheet with overrides required' });
  }
  /* Validate size against the actual pretty-printed form that is sent to Asana,
     which can be ~30 % larger than compact JSON due to indentation. */
  const json = JSON.stringify(sheet, null, 2);
  if (json.length > 50000) return resp(413, { ok: false, error: 'sheet too large' });

  const project = process.env.ASANA_PROJECT_GID || DEFAULT_PROJECT_GID;
  if (!process.env.ASANA_PROJECT_GID) console.warn('ASANA_PROJECT_GID not set — using hardcoded default project GID');
  const notes = 'Automatic mirror of the in-app risk-data overrides. Do not edit by hand; '
    + 'the monthly watchdog commits this sheet to the repository as data/risk-overrides-backup.json.\n'
    + 'Updated: ' + new Date().toISOString() + '\n\n'
    + SHEET_OPEN + '\n' + json + '\n' + SHEET_CLOSE;

  try {
    let gid = null;
    let path = '/projects/' + project + '/tasks?limit=100&opt_fields=name';
    let iterations = 0;
    while (path && !gid && iterations < 50) { /* guard against malformed pagination loops */
      iterations++;
      const page = await api(token, 'GET', path);
      if (!page.ok) break;
      const hit = (page.body.data || []).find(t => String(t.name || '') === TASK_NAME);
      if (hit) gid = hit.gid;
      path = (page.body.next_page && page.body.next_page.offset)
        ? '/projects/' + project + '/tasks?limit=100&opt_fields=name&offset=' + page.body.next_page.offset : null;
    }

    /* File the mirror under the ACTIVITY LOG section; a section problem must never lose it. */
    let section = null;
    try { section = await ensureSection(token, project, LOG_SECTION); } catch (e) { section = null; }
    const fileInSection = async (taskGid) => {
      if (!section) return;
      try { await api(token, 'POST', '/sections/' + section + '/addTask', { data: { task: taskGid } }); }
      catch (e) { /* leave the task where it is rather than lose it */ }
    };

    if (gid) {
      const upd = await api(token, 'PUT', '/tasks/' + gid, { data: { notes } });
      if (upd.ok) { await fileInSection(gid); return resp(200, { ok: true, gid, updated: true }); }
      /* Only a genuine 404 means the mirror task was deleted — recreate it. A
         transient (429/5xx) or auth failure must NOT fall through to a create,
         or a still-existing mirror gets a duplicate and later runs update
         whichever paginates first while the other goes stale (asana-task.js
         fixed this same class of bug). */
      if (upd.status !== 404) {
        const msg = (upd.body && upd.body.errors && upd.body.errors[0] && upd.body.errors[0].message) || ('asana update failed (' + upd.status + ')');
        return resp(upd.status || 502, { ok: false, error: msg });
      }
    }
    const made = await api(token, 'POST', '/tasks', { data: { name: TASK_NAME, notes, projects: [project] } });
    if (!made.ok) {
      const msg = (made.body && made.body.errors && made.body.errors[0] && made.body.errors[0].message) || ('asana responded ' + made.status);
      return resp(made.status, { ok: false, error: msg });
    }
    /* Guard a malformed 2xx (empty/non-JSON body) so a null body can't throw and be
       masked as a generic 502 'unreachable'. */
    const newGid = made.body && made.body.data && made.body.data.gid;
    if (!newGid) return resp(502, { ok: false, error: 'asana returned no task id' });
    await fileInSection(newGid);
    return resp(200, { ok: true, gid: newGid, updated: false });
  } catch (e) {
    return resp(502, { ok: false, error: 'asana unreachable' });
  }
};

/* Abort a hung Asana call rather than letting it block until the platform kills
   the function. Overridable via ASANA_TIMEOUT_MS (kept small in tests). */
const ASANA_TIMEOUT_MS = Number(process.env.ASANA_TIMEOUT_MS) || 15000;

async function api(token, method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ASANA_TIMEOUT_MS);
  let r;
  try {
    r = await fetch('https://app.asana.com/api/1.0' + path, {
      method,
      signal: ctrl.signal,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } finally {
    clearTimeout(timer);
  }
  /* Asana normally returns JSON; tolerate an empty or non-JSON body (e.g. a 5xx
     gateway page) so the caller surfaces the real status instead of throwing. */
  const d = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body: d };
}

/* Find the section by name (case-insensitive) or create it. Mirrors asana-task.js. */
async function ensureSection(token, project, name) {
  const list = await api(token, 'GET', '/projects/' + project + '/sections?limit=100');
  if (list.ok) {
    const hit = (list.body.data || []).find(s => String(s.name || '').trim().toUpperCase() === name.toUpperCase());
    if (hit) return hit.gid;
  }
  const made = await api(token, 'POST', '/projects/' + project + '/sections', { data: { name } });
  if (made.ok && made.body && made.body.data) return made.body.data.gid;
  /* Create failed or raced a concurrent create — re-list and reuse the existing one. */
  const relist = await api(token, 'GET', '/projects/' + project + '/sections?limit=100');
  if (relist.ok) {
    const hit = (relist.body.data || []).find(s => String(s.name || '').trim().toUpperCase() === name.toUpperCase());
    if (hit) return hit.gid;
  }
  return null;
}

/* The site's own production origin — see asana-task.js. Override the whole
   allow-list with the ALLOWED_ORIGINS env var (e.g. a custom domain). */
const PRIMARY_ORIGIN = process.env.PRIMARY_ORIGIN || 'https://hawkeye-sterling-ra.netlify.app';

function allowedOrigins() {
  const extra = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return [PRIMARY_ORIGIN, ...extra];
}

/* Cross-origin guard: see asana-task.js. Missing Origin (server-to-server, curl,
   same-origin posts) is allowed; a present Origin must be same-origin as the host
   or in the allow-list, else 403. */
function originAllowed(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  if (!origin) return true;
  const host = h.host || h.Host || '';
  const originHost = String(origin).replace(/^[a-z]+:\/\//i, '').split('/')[0];
  if (host && originHost === host) return true;
  return allowedOrigins().includes(origin);
}

/* CORS response headers: reflect the Origin only when it passes the guard, so a
   disallowed origin gets no Access-Control-Allow-Origin and the browser blocks it. */
function corsHeaders(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin;
  const headers = { 'Vary': 'Origin' };
  if (origin && originAllowed(event)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-App-Token';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function resp(statusCode, obj, extra) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...(extra || {}) }, body: JSON.stringify(obj) };
}
