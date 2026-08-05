/* Screening case lifecycle — runs right after the daily customer screen.

   Turns every screening flag into a managed Asana CASE with a real lifecycle
   instead of a fire-and-forget alert:

     🚨 Screening Cases — New            ← auto-created here, due = firstSeen + 5d
     🔎 Screening Cases — Under Review   ← human moves it when work starts
     ✅ Screening Cases — Cleared        ← auto: subject no longer flagged → moved,
                                           commented, completed
     ⚠️ Screening Cases — Escalated      ← human decision, never automated

   Aging: a case still open past the 5-day SLA gets one ⏰ comment (exactly
   once per case — tracked in state), so review debt is loud, not silent.

   Inputs:  data/sanctions-screen-state.json  (the screen's subject registry —
            name / band / recommendation / lists / firstSeen / lastSeen)
   State:   data/screening-cases-state.json   (case task GID + lifecycle flags
            per subject key; persisted on the screen-state branch)

   SAFETY: if the screen did not run today (state not updated today), this
   step does NOTHING — cases must never be auto-cleared off stale data.
   Pure planner exported for offline unit tests. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { asana, asanaEnabled, ensureSection, esc, runUrl, notifyAsana } from './asana-notify.mjs';

export const SCREEN_STATE_FILE = 'data/sanctions-screen-state.json';
export const CASES_FILE = 'data/screening-cases-state.json';
/* Written by scripts/sanctions-screen.mjs in the preceding workflow step; the
   daily results digest posts from HERE — after case creation — so every match
   on the Asana card links to its lifecycle case. */
export const RESULTS_FILE = 'sanctions-screen-results.json';
export const CASE_SLA_DAYS = 5;
export const CASE_SECTIONS = {
  new: '🚨 Screening Cases — New',
  review: '🔎 Screening Cases — Under Review',
  cleared: '✅ Screening Cases — Cleared',
  escalated: '⚠️ Screening Cases — Escalated'
};

export function addDays(isoDay, days) {
  const t = Date.parse(String(isoDay || '').slice(0, 10));
  if (Number.isNaN(t)) return null;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

export function ageInDays(fromDay, today) {
  const a = Date.parse(String(fromDay || '').slice(0, 10)), b = Date.parse(today);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function caseTitle(key, s) {
  const gidTail = (String(key).split('|')[2] || '').slice(-6);
  return '🧾 CASE-' + (gidTail || 'XXXXXX') + ' — ' + (s.name || 'unknown subject') + ' — ' + (s.recommendation || 'review');
}

/* Pure planner: decide every case action from plain data.
     create — subject flagged today, no case yet; OR re-flagged after its case
              was cleared (owner-authorized design change: in the shipped
              case-engine config alerts are suppressed, so the case board is
              the ONLY delivery surface — a re-listed customer must get a
              fresh OPEN case, not a digest line pointing at a completed one).
              A re-flag create carries priorCase {taskGid, clearedAt} so the
              new case references the history ("re-flagged after clearance"
              is investigation-relevant).
     age    — case open past the SLA, aging comment not yet posted
     clear  — subject no longer flagged today (or gone from the registry)
   Nothing is planned for under-review/escalated moves — those are human. */
export function planCaseActions(subjects, casesState, today) {
  const actions = [];
  const seen = new Set();
  for (const [key, s] of Object.entries(subjects || {})) {
    seen.add(key);
    const cs = (casesState || {})[key];
    const active = s.lastSeen === today;
    if (active && !cs) {
      actions.push({ type: 'create', key, subject: s, dueOn: addDays(s.firstSeen || today, CASE_SLA_DAYS) });
    } else if (active && cs && cs.cleared) {
      /* RE-FLAGGED after clearance → a fresh case. SLA restarts from the
         re-flag day (today), and the executor REPLACES the cleared state
         entry (newCaseStateEntry) so aging restarts cleanly and a later
         clearance + third re-flag runs through this same branch again. */
      actions.push({ type: 'create', key, subject: s, dueOn: addDays(today, CASE_SLA_DAYS),
        priorCase: { taskGid: cs.taskGid || null, clearedAt: cs.clearedAt || null } });
    } else if (active && cs && !cs.cleared) {
      const age = ageInDays(s.firstSeen || cs.createdAt, today);
      if (!cs.agingAlerted && age > CASE_SLA_DAYS) {
        actions.push({ type: 'age', key, subject: s, caseGid: cs.taskGid, ageDays: age });
      }
    } else if (!active && cs && !cs.cleared) {
      actions.push({ type: 'clear', key, subject: s, caseGid: cs.taskGid });
    }
  }
  for (const [key, cs] of Object.entries(casesState || {})) {
    if (!seen.has(key) && !cs.cleared) actions.push({ type: 'clear', key, subject: null, caseGid: cs.taskGid });
  }
  return actions;
}

/* The state entry recorded for a just-created case. A re-flag create REPLACES
   the cleared entry wholesale — carrying reopenedFrom/reopenedAt — so the SLA
   and the one-shot aging alert restart cleanly, and the digest's caseGidFor
   resolves the subject to the NEW open case, never the old completed one. */
export function newCaseStateEntry(gid, today, priorCase) {
  const entry = { taskGid: gid, createdAt: today, agingAlerted: false, cleared: false };
  if (priorCase && priorCase.taskGid) { entry.reopenedFrom = priorCase.taskGid; entry.reopenedAt = today; }
  return entry;
}

export function caseHtml(key, s, runLink, priorCase) {
  const customerGid = String(key).split('|')[2] || '';
  const h = ['<body>'];
  h.push('<h1>Screening case — ' + esc(s.name || 'unknown') + '</h1>');
  h.push('<strong>' + (s.recommendation === 'sanctions-match' ? '⛔ POTENTIAL SANCTIONS MATCH — immediate MLRO escalation path applies' : '⚠️ Screening flag — review required') + '</strong>');
  h.push('<ul>');
  h.push('<li><strong>Subject:</strong> ' + esc(s.name || '') + (s.jurisdiction ? ' (' + esc(s.jurisdiction) + ')' : '') + '</li>');
  h.push('<li><strong>Recommendation:</strong> ' + esc(s.recommendation || 'review') + ' · band ' + esc(s.band || '?') + ' · score ' + esc(String(s.topScore ?? '?')) + '</li>');
  h.push('<li><strong>Matched on:</strong> ' + esc((s.lists || []).join(', ') || 'see screening record') + '</li>');
  h.push('<li><strong>First flagged:</strong> ' + esc(s.firstSeen || '?') + ' — SLA: review within ' + CASE_SLA_DAYS + ' days</li>');
  if (customerGid) h.push('<li><strong>Customer record:</strong> <a data-asana-gid="' + esc(customerGid) + '"/></li>');
  /* Re-flag provenance: a subject returning to the lists after a clearance is
     investigation-relevant — the MLRO must see the prior case and when it was
     cleared, not treat this as a first-time flag. */
  if (priorCase && priorCase.taskGid) {
    h.push('<li><strong>⚠ RE-FLAGGED AFTER CLEARANCE:</strong> prior case <a data-asana-gid="' + esc(priorCase.taskGid) + '"/>'
      + (priorCase.clearedAt ? ' (cleared ' + esc(priorCase.clearedAt) + ')' : '')
      + ' — review the prior disposition before clearing again.</li>');
  }
  h.push('</ul>');
  h.push('<h2>Lifecycle</h2>');
  h.push('<ol><li>Move to <strong>Under Review</strong> when work starts (manual).</li>'
    + '<li>Disposition: clear as false positive, or move to <strong>Escalated</strong> (manual — MLRO decision).</li>'
    + '<li>If the subject stops being flagged by the daily screen, this case is <strong>auto-moved to Cleared</strong> with an audit comment.</li></ol>');
  h.push('<em>Created automatically by the daily screening case manager. Aging past the SLA is flagged with a ⏰ comment. Retention: 10 years (Federal Decree-Law No. 26 of 2021, Art. 23).</em>');
  if (runLink) h.push('<a href="' + esc(runLink) + '">View the screening run</a>');
  h.push('</body>');
  return h.join('');
}

/* Daily results digest — the screening run's RESULT surface in Asana. Posted
   every run (a clean day is affirmative evidence, not silence). Pure builder:
   `results` is the artifact written by sanctions-screen.mjs; `caseGidFor(alert)`
   resolves an alert to its case-task GID so the card links straight to it. */
const BAND_BADGE = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
export function buildResultsDigestHtml(results, caseGidFor = () => null) {
  const r = results || {};
  const h = ['<body>'];
  h.push('<h1>Daily sanctions screening — ' + esc(r.date || '') + '</h1>');
  h.push('<strong>' + esc(String(r.screened ?? '?')) + ' subjects screened ('
    + esc(String(r.entities ?? '?')) + ' entities + ' + esc(String(r.individuals ?? '?'))
    + ' principals/UBOs) · ' + esc(String(r.matchCount ?? 0)) + ' standing match(es) · '
    + esc(String(r.newMatches ?? 0)) + ' new</strong>');
  if (r.degraded) h.push('<em>⚠ Coverage was DEGRADED this run (a list failed to load) — treat any &quot;no match&quot; as provisional; details under Coverage below.</em>');

  h.push('<h2>New matches</h2>');
  const alerts = Array.isArray(r.alerts) ? r.alerts : [];
  if (!alerts.length) {
    h.push('No new or changed matches — every subject screened clean against the loaded lists today.');
  } else {
    h.push('<ul>');
    for (const a of alerts) {
      const badge = BAND_BADGE[String(a.band || '').toLowerCase()] || '⚪';
      const caseGid = caseGidFor(a);
      h.push('<li>' + badge + ' <strong>' + esc(a.name || '') + '</strong>'
        + (a.jurisdiction ? ' (' + esc(a.jurisdiction) + ')' : '')
        + ' — ' + esc(String(a.band || '').toUpperCase()) + ' · score ' + esc(String(a.topScore ?? '?'))
        + ' · ' + esc(a.recommendation || 'review')
        + ' — matched on: ' + esc((a.lists || []).join(', ') || 'see case')
        + (caseGid ? ' — <a data-asana-gid="' + esc(caseGid) + '"/>' : ' — case pending')
        + '</li>');
    }
    h.push('</ul>');
  }
  if (r.clearedCount) h.push('<em>' + esc(String(r.clearedCount)) + ' previously recorded match(es) no longer returned — auto-moved to Cleared (informational).</em>');

  const lists = Array.isArray(r.lists) ? r.lists : [];
  const total = lists.reduce((n, L) => n + (L.count || 0), 0);
  h.push('<h2>Coverage — ' + lists.length + ' list(s), ' + esc(String(total)) + ' designated names</h2>');
  h.push('<ul>');
  for (const L of lists) h.push('<li>✅ ' + esc(L.name || '') + ' — ' + esc(String(L.count ?? '?')) + ' names</li>');
  for (const f of (r.failures || [])) h.push('<li>⚠️ ' + esc(f) + '</li>');
  h.push('</ul>');
  const en = r.enrichment || {};
  if (en.amErrors || en.amPartial || en.pepErrors || en.skipped) {
    h.push('<em>Enrichment (best-effort, does not weaken the sanctions result): '
      + (en.amErrors ? en.amErrors + ' adverse-media lookup(s) errored · ' : '')
      + (en.amPartial ? en.amPartial + ' subject(s) had NARROWED adverse-media coverage (some news editions/GDELT did not answer) · ' : '')
      + (en.pepErrors ? en.pepErrors + ' PEP lookup(s) errored · ' : '')
      + (en.skipped ? en.skipped + ' subject(s) skipped enrichment at the time budget' : '')
      + '</em>');
  }
  if (en.amLocalesPerSubject) {
    h.push('<em>Adverse-media sweep: ' + esc(String(en.amLocalesPerSubject))
      + ' news edition(s) per subject this run (pinned core + daily rotation over the worldwide matrix) + GDELT global index.</em>');
  }
  h.push('<em>Detection is automatic. Do NOT freeze, decline or report on a match before MLRO review and a two-person (four-eyes) sign-off — UAE Federal Decree-Law No. 10 of 2025 Art. 16/18; FATF R.26.</em>');
  const link = runUrl();
  if (link) h.push('<a href="' + esc(link) + '">View the screening run</a>');
  h.push('</body>');
  return h.join('');
}

export function resultsDigestTitle(results) {
  const r = results || {};
  return '🛡️ Sanctions Screen — ' + (r.date || '') + ' — '
    + (r.newMatches ? r.newMatches + ' new match(es)' : 'no new matches')
    + ' · ' + (r.screened ?? '?') + ' screened';
}

/* ── Runner ── */
function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const projectGid = process.env.ASANA_CASES_PROJECT_GID || '1216203370612914';
  const assignee = process.env.ASANA_CASE_ASSIGNEE_GID || '1213645083721304';

  if (!asanaEnabled()) {
    console.error('screening-cases: ASANA_ACCESS_TOKEN not set — cannot manage cases.');
    process.exit(3);
  }
  const screen = readJson(SCREEN_STATE_FILE);
  if (!screen || !screen.subjects) {
    console.log('screening-cases: no screening state — nothing to manage.');
    return;
  }
  if (screen.updated !== today) {
    /* Never clear (or age) cases off stale data: if today's screen did not
       run, skip cleanly. The workflow ordering makes this unusual. */
    console.log('screening-cases: screen state is from ' + screen.updated + ', not today — skipping (no action on stale data).');
    return;
  }

  const casesState = readJson(CASES_FILE) || {};
  const actions = planCaseActions(screen.subjects, casesState, today);
  console.log('screening-cases: ' + actions.length + ' action(s) — '
    + ['create', 'age', 'clear'].map(t => t + '=' + actions.filter(a => a.type === t).length).join(' '));

  const link = runUrl();
  let failed = 0;
  let secNew, secCleared;
  if (actions.length) {
    secNew = await ensureSection(projectGid, CASE_SECTIONS.new);
    secCleared = await ensureSection(projectGid, CASE_SECTIONS.cleared);
    /* Ensure the two human sections exist too, so the board reads as a flow. */
    await ensureSection(projectGid, CASE_SECTIONS.review);
    await ensureSection(projectGid, CASE_SECTIONS.escalated);
  } else {
    console.log('screening-cases: all cases already in the right state.');
  }
  for (const a of actions) {
    try {
      if (a.type === 'create') {
        const d = await asana('/tasks', {
          method: 'POST',
          body: JSON.stringify({ data: {
            name: caseTitle(a.key, a.subject).slice(0, 250),
            html_notes: caseHtml(a.key, a.subject, link, a.priorCase),
            due_on: a.dueOn || addDays(today, CASE_SLA_DAYS),
            assignee,
            projects: [projectGid],
            memberships: [{ project: projectGid, section: secNew }]
          } })
        });
        const gid = d.data && d.data.gid;
        /* REPLACES a cleared entry on a re-flag, so the digest's caseGidFor
           resolves to this new open case and the SLA/aging restart cleanly. */
        casesState[a.key] = newCaseStateEntry(gid, today, a.priorCase);
        console.log('  ' + (a.priorCase ? 're-opened (fresh case after clearance — prior ' + a.priorCase.taskGid + ') ' : 'created case ')
          + caseTitle(a.key, a.subject) + (d.data && d.data.permalink_url ? ' — ' + d.data.permalink_url : ''));
      } else if (a.type === 'age') {
        await asana('/tasks/' + a.caseGid + '/stories', {
          method: 'POST',
          body: JSON.stringify({ data: { text: '⏰ AGING — this screening case has been open ' + a.ageDays + ' days (SLA: ' + CASE_SLA_DAYS + '). Review and disposition required.' } })
        });
        casesState[a.key] = { ...casesState[a.key], agingAlerted: true };
        console.log('  aging comment on case ' + a.key + ' (' + a.ageDays + 'd)');
      } else if (a.type === 'clear') {
        await asana('/sections/' + secCleared + '/addTask', {
          method: 'POST',
          body: JSON.stringify({ data: { task: a.caseGid } })
        });
        await asana('/tasks/' + a.caseGid + '/stories', {
          method: 'POST',
          body: JSON.stringify({ data: { text: '✅ AUTO-CLEARED — the subject was not flagged by the ' + today + ' screening run. Moved to Cleared and completed. Reopen if a manual review is still owed.' } })
        });
        await asana('/tasks/' + a.caseGid, { method: 'PUT', body: JSON.stringify({ data: { completed: true } }) });
        casesState[a.key] = { ...casesState[a.key], cleared: true, clearedAt: today };
        console.log('  auto-cleared case ' + a.key);
      }
    } catch (e) {
      failed++;
      const msg = String(e && e.message || e);
      /* A 404 means the human deleted the case task — record it cleared so we
         stop acting on it, and say so. Anything else is a real failure. */
      if (a.caseGid && /404/.test(msg)) {
        casesState[a.key] = { ...casesState[a.key], cleared: true, clearedAt: today, note: 'task deleted in Asana' };
        console.warn('  case task for ' + a.key + ' no longer exists in Asana — marked closed in state.');
      } else {
        console.error('  action ' + a.type + ' failed for ' + a.key + ': ' + msg.slice(0, 200));
      }
    }
  }

  if (actions.length) {
    mkdirSync('data', { recursive: true });
    writeFileSync(CASES_FILE, JSON.stringify(casesState, null, 2) + '\n');
    console.log('screening-cases: state written (' + Object.keys(casesState).length + ' case(s) tracked)'
      + (failed ? ' — ' + failed + ' action(s) FAILED (workflow will surface this)' : ''));
  }

  /* The screening RESULTS live in Asana: post the daily digest every run —
     a clean day is affirmative evidence, never silence. Runs after case
     creation so each match links to its case; notifyAsana dedups the title
     within 6h so a same-day re-run cannot double-post. Failure to deliver
     the digest fails the step loudly. */
  const results = readJson(RESULTS_FILE);
  if (results && results.date === today) {
    try {
      const html = buildResultsDigestHtml(results, a => (casesState[a.key] || {}).taskGid || null);
      const sectionGid = process.env.ASANA_SCREEN_RESULTS_SECTION_GID || '1216203370612916';
      /* Mirror the daily case digest into the queue the MLRO actually works
         (see the MIRROR note in asana-notify). One task, two memberships. */
      const mirror = process.env.ASANA_MIRROR_PROJECT_GID
        ? [{ project: process.env.ASANA_MIRROR_PROJECT_GID,
             section: process.env.ASANA_MIRROR_SECTION_GID || undefined }]
        : [];
      /* dedupPrefix: the digest title embeds match/screened counts, so a re-run
         with different counts is still TODAY's digest — dedup on the stable
         date-scoped prefix, not the exact title. */
      const url = await notifyAsana(resultsDigestTitle(results), '', { project: projectGid, section: sectionGid, html, assignee: assignee, mirror,
        dedupPrefix: '🛡️ Sanctions Screen — ' + today });
      console.log('screening-cases: daily results digest posted to Asana' + (url ? ' — ' + url : ''));
    } catch (e) {
      failed++;
      console.error('screening-cases: daily results digest could NOT be posted (' + String(e && e.message || e).slice(0, 200) + ')');
    }
  } else {
    console.log('screening-cases: no fresh results artifact (' + RESULTS_FILE + ') — digest not posted.');
  }

  if (failed) process.exit(1); /* loud — the workflow's failure path takes over */
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
