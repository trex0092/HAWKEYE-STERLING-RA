/* Shared Asana notifier for the monitoring workflows (Regulatory Watch,
   Sanctions Watch, FATF Watchdog list moves). Every detected change becomes
   one card in the dedicated "Ongoing Monitoring" project so
   all automated alerts stay in one organised place — separate from the client
   HAWKEYE STERLING APP project.

   Notifications target ASANA_REG_PROJECT_GID, falling back to the hardcoded
   project below. The Asana token stays server-side (ASANA_ACCESS_TOKEN, a
   GitHub Actions secret). No-ops with a clear log when the token is absent, so
   local/dry runs never fail.

   Reuses the task-creation pattern from scripts/fatf-watchdog.mjs. */

// "Ongoing Monitoring" (merged target; workspace: Compliance Tasks)
export const REG_PROJECT_GID =
  process.env.ASANA_REG_PROJECT_GID || '1213914392047129';

export function asanaEnabled() {
  return !!process.env.ASANA_ACCESS_TOKEN;
}

/* ── Transient-failure policy (shared by every watcher that posts to Asana) ──
   Rate limits (429) and server errors (5xx) are retried with bounded backoff so
   a blip never drops a monitoring alert; other 4xx are real errors and fail
   fast. Retry-After is honoured when Asana sends one (capped at 30s). */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
export function isRetryable(status) { return RETRYABLE.has(Number(status)); }
export function retryDelayMs(attempt, retryAfter) {
  const ra = Number(retryAfter);
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra * 1000, 30000);
  return Math.min(1000 * 2 ** attempt, 8000);
}
const sleep = ms => new Promise(res => setTimeout(res, ms));
const MAX_ATTEMPTS = 3;

export async function asana(path, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    let r;
    try {
      r = await fetch('https://app.asana.com/api/1.0' + path, {
        ...opts,
        headers: {
          Authorization: 'Bearer ' + process.env.ASANA_ACCESS_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(opts.headers || {})
        }
      });
    } catch (e) {
      /* Network-level failure (reset, DNS, TLS) — as transient as a 503; retry
         with the same bounded backoff instead of dying on the first blip. */
      if (attempt < MAX_ATTEMPTS - 1) {
        const delay = retryDelayMs(attempt);
        console.warn('asana-notify: network error (' + (e && e.message || e) + ') — retry ' + (attempt + 1) + '/' + (MAX_ATTEMPTS - 1) + ' in ' + delay + 'ms');
        await sleep(delay);
        continue;
      }
      throw e;
    }
    const d = await r.json().catch(() => ({}));
    if (r.ok) return d;
    if (r.status === 401) {
      throw new Error('Asana 401 Unauthorized — ASANA_ACCESS_TOKEN may have expired or been revoked. Rotate it in GitHub Settings → Secrets → ASANA_ACCESS_TOKEN.');
    }
    if (attempt < MAX_ATTEMPTS - 1 && isRetryable(r.status)) {
      const delay = retryDelayMs(attempt, r.headers && r.headers.get && r.headers.get('retry-after'));
      console.warn('asana-notify: Asana ' + r.status + ' — retry ' + (attempt + 1) + '/' + (MAX_ATTEMPTS - 1) + ' in ' + delay + 'ms');
      await sleep(delay);
      continue;
    }
    throw new Error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 300));
  }
}

/* ── Re-run idempotency ──────────────────────────────────────────────────────
   A workflow re-run (or a retry after a failure DOWNSTREAM of a successful
   post) must not file the same alert card twice. A task in the target project
   with the identical name created inside the window is treated as this alert
   already delivered. The window is deliberately SHORT (6h): re-runs happen
   within minutes/hours, while the daily watchers run 24h apart and may
   legitimately produce an identical title two days running ("Sanctions Watch —
   1 list change") — a wider window would silently suppress day two's real
   alert. Pure; unit-tested. */
export function findRecentDuplicate(tasks, name, nowMs, windowHours = 6) {
  const cutoff = nowMs - windowHours * 3600000;
  const want = String(name).slice(0, 250);
  return (tasks || []).find(t => String(t && t.name || '') === want
    && (Date.parse((t && t.created_at) || '') || 0) >= cutoff) || null;
}

/* Resolve a section GID by name within a project, creating it if absent —
   idempotent (an existing name is reused), shared by the schedulers that file
   under a named column. */
export async function ensureSection(projectGid, name) {
  const d = await asana('/projects/' + projectGid + '/sections?limit=100&opt_fields=name');
  const want = String(name).trim().toLowerCase();
  const found = (d.data || []).find(sec => String(sec.name || '').trim().toLowerCase() === want);
  if (found) return found.gid;
  const created = await asana('/projects/' + projectGid + '/sections', { method: 'POST', body: JSON.stringify({ data: { name } }) });
  return created.data && created.data.gid;
}

/* All tasks in a project (name, created_at, permalink) — for the dedup guard. */
export async function listProjectTasks(projectGid) {
  const out = [];
  const base = '/projects/' + projectGid + '/tasks?limit=100&opt_fields=name,created_at,permalink_url';
  let path = base;
  while (path) {
    const d = await asana(path);
    out.push(...(d.data || []));
    path = d.next_page ? base + '&offset=' + d.next_page.offset : null;
  }
  return out;
}

/* Create one alert card in the Ongoing Monitoring project.
   Pass opts.html for an Asana rich-text body (html_notes — bold headings,
   bulleted sources, clickable links); otherwise notes is sent as plain text.
   Pass opts.section (a section GID) to file the card under that section so the
   project stays organised (Regulatory changes / Sanctions updates / etc.).
   Returns the task permalink, or null when no token is configured. */
export async function notifyAsana(name, notes, opts = {}) {
  const project = opts.project || REG_PROJECT_GID;
  if (!asanaEnabled()) {
    console.log('asana-notify: ASANA_ACCESS_TOKEN not set — skipping Asana card ("' + name + '")');
    return null;
  }
  const due = opts.due || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const data = {
    name: String(name).slice(0, 250),
    projects: [project],
    due_on: due
  };
  /* Idempotency guard — never double-post the same card on a workflow re-run.
     Best-effort: if the check itself fails we still post (losing an alert is
     worse than a rare duplicate). */
  try {
    const dup = findRecentDuplicate(await listProjectTasks(project), data.name, Date.now());
    if (dup) {
      console.log('asana-notify: identical card already filed within 6h — skipping ("' + data.name + '")');
      return dup.permalink_url || null;
    }
  } catch (e) {
    console.warn('asana-notify: duplicate check failed (' + (e && e.message || e) + ') — posting anyway');
  }
  if (opts.html) data.html_notes = String(opts.html).slice(0, 60000);
  else data.notes = String(notes).slice(0, 60000);
  if (opts.assignee !== null) data.assignee = opts.assignee || 'me';
  const d = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data }) });
  const gid = d.data && d.data.gid;
  /* File the new task under its section, so it lands in the right column/list
     group instead of the project's default section. Non-fatal if it fails — the
     task already exists in the project. */
  if (gid && opts.section) {
    try {
      await asana('/sections/' + opts.section + '/addTask', { method: 'POST', body: JSON.stringify({ data: { task: gid } }) });
    } catch (e) {
      console.warn('asana-notify: could not move task to section ' + opts.section + ' (' + (e && e.message || e) + ')');
    }
  }
  return d.data && d.data.permalink_url;
}

/* Escape text for safe inclusion in Asana html_notes (XML-strict). */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Build an Asana-safe rich-text body from a watcher's structured changes
   ({id,name,jurisdiction,url,status}). Asana rich text has no tables, so each
   changed source becomes a list item. Returns a single <body>…</body> root. */
export function buildHtmlBody({ heading, summary, changes = [], runLink }) {
  const items = changes.map(c => {
    const what = c.status === 'new' ? 'first snapshot recorded'
      : c.status === 'unreachable' ? ('UNREACHABLE — ' + esc(c.detail || 'fetch failing repeatedly') + ' — monitoring gap, investigate')
      : 'content changed';
    const link = c.url ? ' — <a href="' + esc(c.url) + '">open source</a>' : '';
    const juris = c.jurisdiction ? ' (' + esc(c.jurisdiction) + ')' : '';
    return '<li><strong>' + esc(c.name) + '</strong>' + juris + ' — ' + what + link + '</li>';
  }).join('');
  const parts = ['<body>'];
  if (heading) parts.push('<h2>' + esc(heading) + '</h2>');
  if (summary) parts.push('<strong>' + esc(summary) + '</strong>');
  if (items) parts.push('<ul>' + items + '</ul>');
  parts.push('<em>Detection is automatic; applying any wording change stays a reviewed decision.</em>');
  if (runLink) parts.push('<a href="' + esc(runLink) + '">View the workflow run</a>');
  parts.push('</body>');
  return parts.join('');
}

/* Helper: a GitHub Actions run URL for "open the run" links in card notes. */
export function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID)
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : '';
}
