/* Creates an Asana task in the RISK ASSESSMENTS project when an assessment
   is marked Complete. The Asana token lives in the Netlify environment
   (ASANA_ACCESS_TOKEN) and never reaches the browser. */
const DEFAULT_PROJECT_GID = '1215653768729951'; /* RISK ASSESSMENTS */

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { ok: false, error: 'method not allowed' });

  const token = process.env.ASANA_ACCESS_TOKEN;
  if (!token) return resp(500, { ok: false, error: 'ASANA_ACCESS_TOKEN not configured' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return resp(400, { ok: false, error: 'invalid JSON' }); }

  const name = String(payload.name || '').trim().slice(0, 250);
  const notes = String(payload.notes || '').slice(0, 60000);
  const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.due_on || '')) ? payload.due_on : null;
  if (!name) return resp(400, { ok: false, error: 'name required' });

  const project = process.env.ASANA_PROJECT_GID || DEFAULT_PROJECT_GID;
  const data = { name, notes, projects: [project] };
  if (dueOn) data.due_on = dueOn;
  try {
    const r = await fetch('https://app.asana.com/api/1.0/tasks', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ data })
    });
    const d = await r.json();
    if (!r.ok) {
      const msg = (d && d.errors && d.errors[0] && d.errors[0].message) || ('asana responded ' + r.status);
      return resp(r.status, { ok: false, error: msg });
    }
    return resp(200, { ok: true, gid: d.data.gid, url: d.data.permalink_url });
  } catch (e) {
    return resp(502, { ok: false, error: 'asana unreachable' });
  }
};

function resp(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
