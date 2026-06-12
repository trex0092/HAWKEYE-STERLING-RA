/* Creates an alert task in the RISK ASSESSMENTS Asana project, assigned and
   due today so it reaches the compliance officer's inbox immediately.
   Used by .github/workflows/site-health.yml on failure.
   Usage: node scripts/asana-alert.mjs "<title>" "<notes>" */
const PROJECT_GID = process.env.ASANA_PROJECT_GID || '1215653768729951'; /* RISK ASSESSMENTS */
const title = process.argv[2];
const notes = process.argv[3] || '';

if (!process.env.ASANA_ACCESS_TOKEN) { console.error('ASANA_ACCESS_TOKEN missing'); process.exit(1); }
if (!title) { console.error('usage: node scripts/asana-alert.mjs "<title>" "<notes>"'); process.exit(1); }

const r = await fetch('https://app.asana.com/api/1.0/tasks', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + process.env.ASANA_ACCESS_TOKEN,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  body: JSON.stringify({ data: { name: title, notes, projects: [PROJECT_GID], due_on: new Date().toISOString().slice(0, 10), assignee: 'me' } })
});
const d = await r.json();
if (!r.ok) { console.error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 300)); process.exit(1); }
console.log('alert task created: ' + d.data.permalink_url);
