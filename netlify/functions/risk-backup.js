/* Mirrors the compliance risk-data sheet (the officer's score overrides,
   which otherwise live only in the browser) into a single dedicated Asana
   task. A monthly GitHub Action then commits that mirror to the repository
   (data/risk-overrides-backup.json), giving the overrides an off-device
   backup and a git audit trail. Token stays server side. */
const DEFAULT_PROJECT_GID = '1215653768729951'; /* RISK ASSESSMENTS */
const TASK_NAME = 'RISK DATA SHEET (auto-backup)';
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

  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) return resp(500, { ok: false, error: 'ASANA_ACCESS_TOKEN not configured' });

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

    if (gid) {
      const upd = await api(token, 'PUT', '/tasks/' + gid, { data: { notes } });
      if (upd.ok) return resp(200, { ok: true, gid, updated: true });
      /* mirror task deleted between lookup and update — fall through to create */
    }
    const made = await api(token, 'POST', '/tasks', { data: { name: TASK_NAME, notes, projects: [project] } });
    if (!made.ok) {
      const msg = (made.body && made.body.errors && made.body.errors[0] && made.body.errors[0].message) || ('asana responded ' + made.status);
      return resp(made.status, { ok: false, error: msg });
    }
    return resp(200, { ok: true, gid: made.body.data.gid, updated: false });
  } catch (e) {
    return resp(502, { ok: false, error: 'asana unreachable' });
  }
};

async function api(token, method, path, body) {
  const r = await fetch('https://app.asana.com/api/1.0' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json();
  return { ok: r.ok, status: r.status, body: d };
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
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function resp(statusCode, obj, extra) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...(extra || {}) }, body: JSON.stringify(obj) };
}
