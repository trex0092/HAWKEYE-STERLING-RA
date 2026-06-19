/* Shared Asana notifier for the monitoring workflows (Regulatory Watch,
   Sanctions Watch, FATF Watchdog list moves). Every detected change becomes
   one card in the dedicated "Regulations / Governance / Sanctions" project so
   all automated alerts stay in one organised place — separate from the client
   RISK ASSESSMENTS project.

   Notifications target ASANA_REG_PROJECT_GID, falling back to the hardcoded
   project below. The Asana token stays server-side (ASANA_ACCESS_TOKEN, a
   GitHub Actions secret). No-ops with a clear log when the token is absent, so
   local/dry runs never fail.

   Reuses the task-creation pattern from scripts/fatf-watchdog.mjs. */

// "Regulations / Governance / Sanctions" (workspace: Compliance Tasks)
export const REG_PROJECT_GID =
  process.env.ASANA_REG_PROJECT_GID || '1215844297069727';

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

/* Create one alert card in the Regulations/Governance/Sanctions project.
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
    notes: String(notes).slice(0, 60000),
    projects: [project],
    due_on: due
  };
  if (opts.assignee !== null) data.assignee = opts.assignee || 'me';
  const d = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data }) });
  return d.data && d.data.permalink_url;
}

/* Helper: a GitHub Actions run URL for "open the run" links in card notes. */
export function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID)
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : '';
}
