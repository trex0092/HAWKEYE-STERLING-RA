/* Daily AI Governance & Platform Compliance Report — one consolidated Asana
   task each morning covering the NON-AML control suite: AI/advisor governance,
   security & supply-chain scanning, CI/code quality, app/site health and
   release/repo hygiene. The AML monitoring itself (sanctions, PEP, FATF,
   adverse media, regulatory) is already reported by the Daily Compliance
   Brief — this is its sibling for the platform/AI controls, so the MLRO has
   one daily operating-effectiveness record per pillar (ISO/IEC 42001 A.6/A.8,
   NIST AI RMF MEASURE/MANAGE).

   It ALWAYS files — "all green" on a quiet day — and is idempotent (one report
   per calendar day). Every control row carries the latest run's conclusion and
   date; scheduled controls that have silently stopped running are flagged
   STALE, so "no news" can never masquerade as "all good" (same fail-safe
   philosophy as the screening engine).

   Runs in GitHub Actions (.github/workflows/governance-report.yml).
   Needs ASANA_ACCESS_TOKEN (secret) + the runner's GITHUB_TOKEN (actions:read). */

/* Shared Asana client: bounded retry on 429/5xx so a transient blip never
   drops the day's report (idempotency is by title-prefix check in main). */
import { asana } from './asana-notify.mjs';

/* The "Ongoing Monitoring" project holds the daily evidence trail. */
export const REG_PROJECT_GID = process.env.ASANA_REG_PROJECT_GID || '1213914392047129';
/* Section resolved BY NAME at runtime (created if missing); GID overrides it. */
export const GOV_SECTION_NAME = 'AI & Platform Governance';
const GOV_SECTION_GID = process.env.ASANA_GOV_SECTION_GID || '';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateLabel(d) { return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

/* The control suite, grouped as reported. `cadence` drives the staleness
   fail-safe: scheduled controls must have run inside their window; event-driven
   controls (push/PR, on demand) are never stale — they run when there is work. */
export const CONTROL_GROUPS = [
  {
    title: '🤖 AI / ADVISOR GOVERNANCE',
    workflows: [
      { file: 'advisor-eval.yml', label: 'Advisor Eval (guardrails: charter, tipping-off, routing)', cadence: 'weekly' },
      { file: 'advisor-bias-eval.yml', label: 'Advisor Bias Eval (fairness across protected attributes)', cadence: 'quarterly' }
    ]
  },
  {
    title: '🔐 SECURITY & SUPPLY-CHAIN',
    workflows: [
      { file: 'codeql.yml', label: 'CodeQL (static analysis)', cadence: 'weekly' },
      { file: 'semgrep.yml', label: 'Semgrep SAST', cadence: 'push/PR' },
      { file: 'gitleaks.yml', label: 'Secret Scan (gitleaks)', cadence: 'push/PR' },
      { file: 'osv-scanner.yml', label: 'OSV-Scanner (toolchain CVEs)', cadence: 'weekly' },
      { file: 'scorecard.yml', label: 'Scorecard (supply-chain posture)', cadence: 'weekly' },
      { file: 'dast-zap.yml', label: 'DAST (OWASP ZAP baseline)', cadence: 'weekly' },
      { file: 'dependency-review.yml', label: 'Dependency Review (PR gate)', cadence: 'push/PR' }
    ]
  },
  {
    title: '✅ CI / CODE QUALITY',
    workflows: [
      { file: 'ci.yml', label: 'CI (full unit + engine test suite)', cadence: 'push/PR' },
      { file: 'lint.yml', label: 'Lint', cadence: 'push/PR' },
      { file: 'a11y.yml', label: 'Accessibility (a11y)', cadence: 'weekly' },
      { file: 'cross-browser.yml', label: 'Cross-Browser Smoke', cadence: 'push/PR' },
      { file: 'lighthouse.yml', label: 'Lighthouse (perf/a11y budgets)', cadence: 'push/PR' },
      { file: 'visual.yml', label: 'Visual Regression', cadence: 'push/PR' },
      { file: 'workflow-lint.yml', label: 'Workflow lint (actionlint + zizmor)', cadence: 'push/PR' }
    ]
  },
  {
    title: '💓 APP / SITE HEALTH',
    workflows: [
      { file: 'site-health.yml', label: 'Site Health (uptime + headers)', cadence: 'daily' },
      { file: 'function-health.yml', label: 'Function Health (Asana delivery path)', cadence: 'daily' },
      { file: 'freshness-check.yml', label: 'Freshness Check (monitoring data currency)', cadence: 'daily' },
      { file: 'link-check.yml', label: 'Link Check (docs integrity)', cadence: 'weekly' }
    ]
  },
  {
    title: '🚀 RELEASE & REPO HYGIENE',
    workflows: [
      { file: 'auto-release.yml', label: 'Auto Release (version tags)', cadence: 'push/PR' },
      { file: 'release.yml', label: 'Release (manual)', cadence: 'on demand' },
      { file: 'labeler.yml', label: 'Labeler', cadence: 'push/PR' },
      { file: 'pr-size.yml', label: 'PR Size Gate', cadence: 'push/PR' },
      { file: 'stale.yml', label: 'Stale issue/PR sweep', cadence: 'daily' }
    ]
  }
];

/* Days a scheduled control may go without a run before it is flagged STALE.
   Generous by one cycle so a single slow/queued day never false-alarms. */
const STALE_DAYS = { daily: 2, weekly: 9, quarterly: 100 };

/* Classify one control from its latest run (or absence of one).
   Returns { icon, state, detail } where state ∈ pass|fail|attention|info. */
export function classifyRun(wf, run, nowMs) {
  if (!run) {
    /* Event-driven controls with no run yet simply have had no trigger. */
    if (!(wf.cadence in STALE_DAYS)) return { icon: '▫', state: 'info', detail: 'no run yet (' + wf.cadence + ')' };
    return { icon: '❌', state: 'fail', detail: 'NEVER RAN — scheduled ' + wf.cadence };
  }
  const when = Date.parse(run.created_at || '') || 0;
  const age = Math.floor((nowMs - when) / 86400000);
  const dateStr = when ? dateLabel(new Date(when)) : 'unknown date';
  if (run.status && run.status !== 'completed') {
    return { icon: '🔄', state: 'info', detail: 'in progress (' + dateStr + ')' };
  }
  const limit = STALE_DAYS[wf.cadence];
  /* A failed last run stays a FAILURE even when it is also stale — staleness
     must never soften a red control to amber. */
  if (limit && age > limit && !['failure', 'timed_out', 'startup_failure'].includes(run.conclusion)) {
    return { icon: '⚠', state: 'attention', detail: 'STALE — last run ' + dateStr + ' (' + age + 'd ago, ' + wf.cadence + ' cadence)' };
  }
  switch (run.conclusion) {
    case 'success': return { icon: '✅', state: 'pass', detail: 'pass — ' + dateStr };
    case 'failure': case 'timed_out': case 'startup_failure':
      return { icon: '❌', state: 'fail', detail: (run.conclusion === 'failure' ? 'FAILED' : run.conclusion.toUpperCase().replace('_', ' ')) + ' — ' + dateStr };
    case 'action_required': return { icon: '⚠', state: 'attention', detail: 'action required — ' + dateStr };
    case 'cancelled': return { icon: '⚠', state: 'attention', detail: 'cancelled — ' + dateStr };
    case 'skipped': case 'neutral': return { icon: '▫', state: 'info', detail: run.conclusion + ' — ' + dateStr };
    default: return { icon: '⚠', state: 'attention', detail: (run.conclusion || 'unknown') + ' — ' + dateStr };
  }
}

/* Roll the whole suite up: rows per group + counters + one-line verdict. */
export function summarise(latestByFile, nowMs, groups = CONTROL_GROUPS) {
  const out = { groups: [], pass: 0, fail: 0, attention: 0, info: 0, total: 0 };
  for (const g of groups) {
    const rows = g.workflows.map(wf => {
      const c = classifyRun(wf, latestByFile[wf.file], nowMs);
      out[c.state]++; out.total++;
      return { ...wf, ...c };
    });
    out.groups.push({ title: g.title, rows });
  }
  out.verdict = out.fail
    ? '❌ ' + out.fail + ' CONTROL' + (out.fail === 1 ? '' : 'S') + ' FAILING — investigate today'
    : out.attention
      ? '⚠ ' + out.attention + ' CONTROL' + (out.attention === 1 ? '' : 'S') + ' NEED' + (out.attention === 1 ? 'S' : '') + ' ATTENTION'
      : '✅ ALL CONTROLS GREEN (' + out.pass + ' passing / ' + out.total + ' controls)';
  return out;
}

export function buildTaskName(label, summary) {
  const flag = summary.fail ? '❌ ' + summary.fail + ' failing'
    : summary.attention ? '⚠ ' + summary.attention + ' attention'
      : '✅ all green';
  return 'AI Governance & Platform Report — ' + label + ' — ' + flag;
}

/* Plain-text task body, same monospace-ledger style as the other audit tasks. */
export function buildReportNotes({ label, summary, alerts = {}, runLink }) {
  const L = [];
  L.push('AI GOVERNANCE & PLATFORM COMPLIANCE — DAILY REPORT');
  L.push('Date: ' + label);
  if (runLink) L.push('Run:  ' + runLink);
  L.push('');
  L.push('OVERALL: ' + summary.verdict);
  L.push('Controls: ' + summary.pass + ' pass · ' + summary.fail + ' fail · '
    + summary.attention + ' attention · ' + summary.info + ' info — ' + summary.total + ' total');
  for (const g of summary.groups) {
    L.push('');
    L.push(g.title);
    for (const r of g.rows) L.push('  ' + r.icon + ' ' + r.label + ' — ' + r.detail);
  }
  L.push('');
  L.push('— Open findings —');
  L.push('Code-scanning alerts (CodeQL/Semgrep): ' + (alerts.codeScanning == null ? 'n/a (no permission)' : alerts.codeScanning + ' open'));
  L.push('Dependabot alerts:                     ' + (alerts.dependabot == null ? 'n/a (no permission)' : alerts.dependabot + ' open'));
  L.push('');
  L.push('— Governance mapping —');
  L.push('This task is the daily operating-effectiveness evidence for the automated');
  L.push('control suite: ISO/IEC 42001 A.6 (AI system life cycle) & A.8 (monitoring),');
  L.push('NIST AI RMF MEASURE/MANAGE, FATF R.15 (new technologies). Event-driven');
  L.push('controls (push/PR) show their latest triggered run; scheduled controls are');
  L.push('flagged STALE if a cycle is missed — silence is never evidence.');
  L.push('');
  L.push('Detection is automatic; remediation stays a reviewed decision.');
  return L.join('\n');
}

/* ---- I/O below; the functions above are pure and unit-tested. ---- */

const GH_API = 'https://api.github.com';

async function gh(path, token) {
  const r = await fetch(GH_API + path, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!r.ok) { const e = new Error('GitHub ' + r.status + ' on ' + path); e.status = r.status; throw e; }
  return r.json();
}

/* Latest run per workflow file (any event — PR-gate controls only ever run on
   pull_request). One listing call per control keeps this well inside rate limits. */
async function fetchLatestRuns(repo, token) {
  const listing = await gh('/repos/' + repo + '/actions/workflows?per_page=100', token);
  const byFile = {};
  for (const w of (listing.workflows || [])) byFile[String(w.path || '').replace(/^\.github\/workflows\//, '')] = w.id;
  const latest = {};
  for (const g of CONTROL_GROUPS) {
    for (const wf of g.workflows) {
      const id = byFile[wf.file];
      if (!id) continue; /* absent workflow → classifyRun flags it */
      try {
        const runs = await gh('/repos/' + repo + '/actions/workflows/' + id + '/runs?per_page=1', token);
        if (runs.workflow_runs && runs.workflow_runs[0]) {
          const r = runs.workflow_runs[0];
          latest[wf.file] = { status: r.status, conclusion: r.conclusion, created_at: r.created_at };
        }
      } catch (e) { console.warn('governance-report: could not read runs for ' + wf.file + ' (' + e.message + ')'); }
    }
  }
  return latest;
}

/* Open-alert counts are best-effort extras: a 403 (token lacks the scope) must
   degrade to "n/a", never fail the report. */
async function countAlerts(repo, token, kind) {
  try {
    const d = await gh('/repos/' + repo + '/' + kind + '/alerts?state=open&per_page=100', token);
    return Array.isArray(d) ? (d.length === 100 ? '100+' : d.length) : null;
  } catch { return null; }
}

async function listTaskNames(projectGid) {
  const names = [];
  const base = '/projects/' + projectGid + '/tasks?limit=100&opt_fields=name';
  let path = base;
  while (path) {
    const d = await asana(path);
    for (const t of (d.data || [])) names.push(String(t.name || ''));
    path = d.next_page ? base + '&offset=' + d.next_page.offset : null;
  }
  return names;
}

/* Resolve the section GID by name, creating it if absent (idempotent). */
async function ensureSection(projectGid, name) {
  if (GOV_SECTION_GID) return GOV_SECTION_GID;
  const d = await asana('/projects/' + projectGid + '/sections?limit=100&opt_fields=name');
  const want = name.trim().toLowerCase();
  const found = (d.data || []).find(s => String(s.name || '').trim().toLowerCase() === want);
  if (found) return found.gid;
  const created = await asana('/projects/' + projectGid + '/sections', { method: 'POST', body: JSON.stringify({ data: { name } }) });
  return created.data && created.data.gid;
}

function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID)
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : '';
}

async function main() {
  if (!process.env.ASANA_ACCESS_TOKEN) throw new Error('ASANA_ACCESS_TOKEN secret is not configured in GitHub Actions');
  const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!ghToken) throw new Error('GITHUB_TOKEN is not available (needs actions:read)');
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is not set');

  const now = new Date();
  const label = dateLabel(now);

  /* Idempotent: one report per calendar day. */
  const names = await listTaskNames(REG_PROJECT_GID);
  const already = names.find(n => n.startsWith('AI Governance & Platform Report — ' + label));
  if (already) { console.log('report already exists: ' + already); return; }

  const latest = await fetchLatestRuns(repo, ghToken);
  const summary = summarise(latest, now.getTime());
  const alerts = {
    codeScanning: await countAlerts(repo, ghToken, 'code-scanning'),
    dependabot: await countAlerts(repo, ghToken, 'dependabot')
  };

  const title = buildTaskName(label, summary);
  const notes = buildReportNotes({ label, summary, alerts, runLink: runUrl() });
  const today = now.toISOString().slice(0, 10);
  const made = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data: { name: title, notes, projects: [REG_PROJECT_GID], due_on: today, assignee: 'me' } }) });
  const gid = made.data && made.data.gid;
  if (gid) {
    try {
      const sectionGid = await ensureSection(REG_PROJECT_GID, GOV_SECTION_NAME);
      if (sectionGid) await asana('/sections/' + sectionGid + '/addTask', { method: 'POST', body: JSON.stringify({ data: { task: gid } }) });
    } catch (e) { console.warn('governance-report: could not file under section (' + (e && e.message || e) + ')'); }
  }
  console.log('governance report created (' + summary.verdict + '): ' + (made.data && made.data.permalink_url));
}

if (process.argv[1] && process.argv[1].endsWith('governance-report.mjs')) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
