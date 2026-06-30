/* Creates an alert task in the RISK ASSESSMENTS Asana project, assigned and
   due today so it reaches the compliance officer's inbox immediately.
   Used by .github/workflows/site-health.yml on failure.
   Usage: node scripts/asana-alert.mjs "<title>" "<notes>" */
const PROJECT_GID = process.env.ASANA_PROJECT_GID || '1215653768729951'; /* RISK ASSESSMENTS */
const title = process.argv[2];
const notes = process.argv[3] || '';

if (!process.env.ASANA_ACCESS_TOKEN) { console.error('ASANA_ACCESS_TOKEN missing'); process.exit(1); }
if (!title) { console.error('usage: node scripts/asana-alert.mjs "<title>" "<notes>"'); process.exit(1); }

/* Bound the request: this runs in CI failure paths, so a hung Asana connection
   must not stall the alert step until the job timeout. Abort after 20s and exit
   non-zero (the workflow surfaces the failure). */
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 20000);
let r;
try {
  r = await fetch('https://app.asana.com/api/1.0/tasks', {
    method: 'POST',
    signal: ctrl.signal,
    headers: {
      Authorization: 'Bearer ' + process.env.ASANA_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ data: { name: title, notes, projects: [PROJECT_GID], due_on: new Date().toISOString().slice(0, 10), assignee: 'me' } })
  });
} catch (e) {
  console.error('Asana alert request failed: ' + String(e && e.message || e).slice(0, 200));
  process.exit(1);
} finally {
  clearTimeout(t);
}
/* Read the body as text first so a non-JSON response (e.g. an HTML 502 page from
   a gateway) reports cleanly instead of throwing an unhandled rejection — this
   script runs in CI failure paths, so its own error handling must not crash. */
const raw = await r.text();
let d;
try { d = JSON.parse(raw); }
catch { console.error('Asana ' + r.status + ': non-JSON response: ' + raw.slice(0, 300)); process.exit(1); }
if (!r.ok) { console.error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 300)); process.exit(1); }
console.log('alert task created: ' + (d?.data?.permalink_url || '(task created; no permalink returned)'));
