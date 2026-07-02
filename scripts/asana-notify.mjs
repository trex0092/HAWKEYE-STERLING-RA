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

async function asana(path, opts = {}) {
  const r = await fetch('https://app.asana.com/api/1.0' + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + process.env.ASANA_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(opts.headers || {})
    }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) {
      throw new Error('Asana 401 Unauthorized — ASANA_ACCESS_TOKEN may have expired or been revoked. Rotate it in GitHub Settings → Secrets → ASANA_ACCESS_TOKEN.');
    }
    throw new Error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 300));
  }
  return d;
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
    const what = c.status === 'new' ? 'first snapshot recorded' : 'content changed';
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
