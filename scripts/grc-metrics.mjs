/* GRC management metrics — computed from the repository, never hand-quoted.

   The six ratios a GRC programme is measured by (control effectiveness,
   compliance completion, KRI breach, overdue issues, third-party assessment
   coverage, audit finding closure) plus the counters the KRIs in
   data/risk-appetite.json key on. Every value is derived from a committed
   artefact — the assurance matrix, the obligation register, the third-party
   register, the CAPA log, the prompt and tool registers — so a number in a
   board pack can be traced to the commit that produced it.

   data/grc-metrics.json is the committed snapshot; --check fails when the
   snapshot drifts from the live repository (same contract as board-figures),
   which is what stops a quoted metric from silently going stale.

   Usage:
     node scripts/grc-metrics.mjs           # print the computed metrics
     node scripts/grc-metrics.mjs --write   # refresh data/grc-metrics.json
     node scripts/grc-metrics.mjs --check   # exit 1 if the snapshot drifted */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const METRICS_FILE = 'data/grc-metrics.json';

const read = (root, rel) => readFileSync(join(root, rel), 'utf8');
const json = (root, rel) => JSON.parse(read(root, rel));
const pct = (n, d) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

/* ── Control effectiveness ────────────────────────────────────────────────
   Rows of the assurance matrix's §1 tables. A row is TESTED when its proof
   column names an artefact; it is EFFECTIVE when every artefact it names still
   exists. A matrix row pointing at a deleted test is precisely the "claimed
   control with no proof" this metric is meant to catch. */
export function controlEffectiveness(root = ROOT) {
  const md = read(root, 'docs/governance/assurance-coverage-matrix.md');
  const section = md.split(/\n## 2 · /)[0];
  const rows = [...section.matchAll(/^\|(?!\s*-)([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|\s*$/gm)]
    .filter((m) => !/^\s*Control\s*$/i.test(m[1]));
  let tested = 0, effective = 0;
  const broken = [];
  for (const m of rows) {
    const proof = m[2];
    const refs = [...proof.matchAll(/`([\w./-]+\.(?:mjs|js|py|yml))`/g)].map((r) => r[1]);
    if (refs.length === 0) continue;           // manual row (—) — counted in §4, not here
    tested++;
    const missing = refs.filter((r) => !resolvePath(root, r));
    if (missing.length === 0) effective++; else broken.push({ control: m[1].trim(), missing });
  }
  return { tested, effective, broken, rate: pct(effective, tested) };
}

/* Matrix cells name artefacts the way a reader would: a bare workflow file, a
   test path, a script path. Resolve all three shapes. */
function resolvePath(root, ref) {
  const candidates = ref.includes('/')
    ? [ref]
    : [ref.endsWith('.yml') ? join('.github/workflows', ref) : null, join('test', ref),
       join('scripts', ref), join('netlify/functions', ref), ref].filter(Boolean);
  return candidates.find((c) => existsSync(join(root, c))) || null;
}

/* ── Compliance completion ───────────────────────────────────────────────── */
export function complianceCompletion(root = ROOT) {
  const reg = json(root, 'data/obligations.json');
  const regulatory = reg.obligations.filter((o) => o.category === 'regulatory');
  const met = regulatory.filter((o) => o.status === 'met').length;
  const partial = regulatory.filter((o) => o.status === 'partial').length;
  const pending = regulatory.filter((o) => o.status === 'pending').length;
  return { met, partial, pending, total: regulatory.length, rate: pct(met, regulatory.length) };
}

/* ── Third-party assessment coverage ──────────────────────────────────────
   A vendor is ASSESSED when its safeguard/DPA cell records a settled position.
   A cell still asking for a confirmation, or carrying an unticked box, is not
   coverage — it is an outstanding assessment. */
export function thirdPartyCoverage(root = ROOT) {
  const md = read(root, 'docs/aims/third-party-register.md');
  const table = md.split(/\n## Data residency/)[0];
  /* The vendor cell may carry a qualifier after the bold name
     (e.g. "**OpenSanctions** (`data.opensanctions.org`)"), so the name capture
     is followed by the rest of its own cell before the column walk begins. */
  const rows = [...table.matchAll(/^\|\s*\*\*([^*]+)\*\*[^|\n]*\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|/gm)];
  const vendors = rows.map((m) => ({ vendor: m[1].trim(), safeguard: m[5].trim() }));
  const assessed = vendors.filter((v) => v.safeguard && !/confirm|☐/i.test(v.safeguard));
  return {
    assessed: assessed.length,
    total: vendors.length,
    outstanding: vendors.filter((v) => !assessed.includes(v)).map((v) => v.vendor),
    rate: pct(assessed.length, vendors.length)
  };
}

/* ── Audit finding closure ────────────────────────────────────────────────
   The CAPA log: corrective actions (CA-nn) and hardening actions (HA-nn). */
export function findingClosure(root = ROOT) {
  const md = read(root, 'docs/aims/corrective-actions.md');
  const rows = [...md.matchAll(/^\|\s*((?:CA|HA)-\d+)\s*\|(.+)$/gm)];
  const closed = rows.filter((m) => /\|\s*Closed[^|]*\|?\s*$/i.test(m[2]));
  return {
    closed: closed.length,
    total: rows.length,
    open: rows.filter((m) => !closed.includes(m)).map((m) => m[1]),
    rate: pct(closed.length, rows.length)
  };
}

/* ── Counters the KRIs key on ─────────────────────────────────────────────── */

/* Files whose JOB is to scan for model-API callers necessarily contain the
   host string and the tool-calling patterns they look for. They call nothing.
   Kept as an explicit, greppable list rather than a cleverer regex, and shared
   with test/tool-register.test.mjs and test/prompt-register.test.mjs. */
export const SCANNERS = new Set(['scripts/grc-metrics.mjs']);

/* Source-text scan, NOT URL validation: the question is whether a FILE mentions
   the model endpoint at all, so there is no URL value to parse and compare a
   hostname against. Written as an anchored regex rather than a substring
   `includes()` so the intent is explicit and the code does not take the shape
   of an incomplete URL check (CodeQL js/incomplete-url-substring-sanitization,
   which fires on that shape regardless of whether a URL is involved). */
const MODEL_ENDPOINT = /(^|[^\w.])api\.anthropic\.com([^\w.]|$)/;

/* Any model call declaring tools would put a model one step from a connector. */
export function modelToolDeclarations(root = ROOT) {
  const dirs = ['', 'scripts', 'netlify/functions'];
  let count = 0;
  for (const d of dirs) {
    for (const f of readdirSync(d ? join(root, d) : root)) {
      if (!/\.(js|mjs|py)$/.test(f)) continue;
      const rel = d ? d + '/' + f : f;
      if (SCANNERS.has(rel)) continue;
      const src = read(root, rel);
      if (!MODEL_ENDPOINT.test(src)) continue;
      if (/["']tools["']\s*:/.test(src) || /tool_choice/.test(src)) count++;
    }
  }
  return count;
}

/* Prompt fingerprints that no longer match, plus agent-capability rows that no
   longer match agents.py: both mean production behaviour moved without a
   recorded decision. Summed because the appetite is the same — zero. */
export async function governanceDrift(root = ROOT) {
  const { auditRegister } = await import('./prompt-register.mjs');
  const promptDrift = auditRegister(root).filter((r) => r.status !== 'ok').length;

  const agentsSrc = read(root, 'agents.py');
  const rosterBlock = (agentsSrc.match(/AGENTS = \[([\s\S]*?)\n\]/) || [])[1] || '';
  const codeAgents = [...rosterBlock.matchAll(/"name":\s*"([^"]+)",\s*"role":\s*"([^"]*)",\s*"authz":\s*\[([^\]]*)\]/g)]
    .map((m) => ({ name: m[1], authz: m[3].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean).sort() }));
  const reg = json(root, 'data/tool-surfaces.json');
  const byName = new Map(reg.agents.map((a) => [a.name, [...(a.authz || [])].sort()]));
  let agentDrift = Math.abs(reg.agents.length - codeAgents.length);
  for (const a of codeAgents) {
    const declared = byName.get(a.name);
    if (!declared || declared.join('|') !== a.authz.join('|')) agentDrift++;
  }
  return { promptDrift, agentDrift, total: promptDrift + agentDrift };
}

/* Suppression is acceptable; silent suppression is not. */
export function unjustifiedSuppressions(root = ROOT) {
  const toml = read(root, 'ci/osv-scanner.toml');
  const entries = toml.split(/\[\[IgnoredVulns\]\]/).slice(1);
  return entries.filter((e) => !/^\s*reason\s*=/m.test(e)).length;
}

export function obligationHygiene(root = ROOT) {
  const reg = json(root, 'data/obligations.json');
  return {
    withoutOwner: reg.obligations.filter((o) => !o.owner || !String(o.owner).trim()).length,
    withoutWatchSource: reg.obligations.filter((o) => !o.watch_source).length
  };
}

/* ── Assembly ─────────────────────────────────────────────────────────────── */
export async function computeMetrics(root = ROOT) {
  const ce = controlEffectiveness(root);
  const cc = complianceCompletion(root);
  const tp = thirdPartyCoverage(root);
  const fc = findingClosure(root);
  const drift = await governanceDrift(root);
  const hygiene = obligationHygiene(root);

  const counters = {
    modelToolDeclarations: modelToolDeclarations(root),
    governanceDriftCount: drift.total,
    unjustifiedSuppressions: unjustifiedSuppressions(root),
    obligationsWithoutOwner: hygiene.withoutOwner,
    obligationsWithoutWatchSource: hygiene.withoutWatchSource
  };

  const values = {
    controlEffectivenessRate: ce.rate,
    complianceCompletionRate: cc.rate,
    thirdPartyAssessmentCoverage: tp.rate,
    auditFindingClosureRate: fc.rate,
    ...counters
  };

  /* KRI evaluation — a KRI is breached when its metric violates the threshold.
     Uninstrumented KRIs are excluded from the rate and reported with reasons,
     never counted as passing. */
  const appetite = json(root, 'data/risk-appetite.json');
  const kris = appetite.kris.map((k) => {
    if (!k.instrumented) return { id: k.id, label: k.label, metric: k.metric, value: null, instrumented: false, breached: null };
    const value = values[k.metric] === undefined ? null : values[k.metric];
    const t = k.threshold;
    const breached = value === null ? null
      : t.operator === '>=' ? !(value >= t.value)
      : t.operator === '<=' ? !(value <= t.value)
      : null;
    return { id: k.id, label: k.label, metric: k.metric, value, threshold: t, instrumented: true, breached };
  });
  const measurable = kris.filter((k) => k.instrumented && k.breached !== null);
  const breachedCount = measurable.filter((k) => k.breached).length;

  return {
    schema: 'hawkeye-sterling.grc-metrics/v1',
    generated_by: 'scripts/grc-metrics.mjs --write (never hand-edited; test/grc-metrics.test.mjs and the CI drift check compare this snapshot to the live repository)',
    metrics: {
      controlEffectivenessRate: { value: ce.rate, numerator: ce.effective, denominator: ce.tested, basis: 'Assurance-matrix §1 rows whose named proof artefacts all exist ÷ rows with an automated proof. Manual rows (§4) are excluded by design.' },
      complianceCompletionRate: { value: cc.rate, numerator: cc.met, denominator: cc.total, basis: 'Obligations at status "met" ÷ regulatory obligations. "partial" means the control is built and evidenced but a human act is outstanding — see the open-actions item on each row.', partial: cc.partial, pending: cc.pending },
      kriBreachRate: { value: pct(breachedCount, measurable.length), numerator: breachedCount, denominator: measurable.length, basis: 'Instrumented KRIs in breach ÷ instrumented KRIs. Uninstrumented KRIs are listed with their reason and excluded from the denominator rather than scored as passing.' },
      overdueIssueRate: { value: null, numerator: null, denominator: null, basis: 'Not instrumented: open items carry an owner and a closing condition but no target date, so nothing can be aged. See KRI-09 in data/risk-appetite.json.' },
      thirdPartyAssessmentCoverage: { value: tp.rate, numerator: tp.assessed, denominator: tp.total, basis: 'Vendors whose safeguard/DPA position is settled ÷ vendors in the third-party register. A cell still asking for a confirmation counts as outstanding.', outstanding: tp.outstanding },
      auditFindingClosureRate: { value: fc.rate, numerator: fc.closed, denominator: fc.total, basis: 'CAPA rows (CA-nn corrective + HA-nn hardening) at status Closed ÷ all CAPA rows.', open: fc.open }
    },
    counters,
    kris,
    control_gaps: ce.broken
  };
}

/* Stable comparison: the snapshot carries no timestamp, so identical repo state
   always produces an identical file. */
const digest = (obj) => createHash('sha256').update(JSON.stringify(obj)).digest('hex');

if (process.argv[1] && process.argv[1].endsWith('grc-metrics.mjs')) {
  const computed = await computeMetrics();
  const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'print';

  if (mode === 'write') {
    writeFileSync(join(ROOT, METRICS_FILE), JSON.stringify(computed, null, 2) + '\n');
    console.log('wrote ' + METRICS_FILE);
  } else if (mode === 'check') {
    let committed = null;
    try { committed = json(ROOT, METRICS_FILE); } catch { /* missing or malformed */ }
    if (!committed || digest(committed) !== digest(computed)) {
      console.error('grc-metrics: ' + METRICS_FILE + ' is stale — regenerate with: node scripts/grc-metrics.mjs --write');
      process.exit(1);
    }
    console.log('grc-metrics: ' + METRICS_FILE + ' is in sync.');
  } else {
    for (const [k, m] of Object.entries(computed.metrics)) {
      const v = m.value === null ? 'not instrumented' : m.value + '%  (' + m.numerator + '/' + m.denominator + ')';
      console.log('  ' + k.padEnd(30) + v);
    }
    console.log('\n  counters: ' + JSON.stringify(computed.counters));
    const breached = computed.kris.filter((k) => k.breached);
    console.log('  KRIs in breach: ' + (breached.length ? breached.map((k) => k.id + ' ' + k.label).join(', ') : 'none'));
  }
}
