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

/* Open-actions items carrying no target date.
   KRI-09 (overdue issue rate) reports null because its GOVERNANCE rows cannot
   be aged: dating them is a board act — open-actions item 17 — so the metric
   cannot honestly be instrumented from this side, and inventing dates to make a
   KRI green would be the exact failure the register exists to prevent.
   What CAN be measured is the size of the gap itself. This counts the items an
   overdue-rate would have nothing to measure against, so the Board has a number
   in front of it when it takes item 17, and so the day dates start appearing the
   figure falls on its own.

   It keys on a dedicated "target date" COLUMN, not on any date appearing in the
   row. Scanning the prose was tried and is wrong: item 18 quotes 2026-07-28 as
   the day the policy pack was drafted, which is not a deadline for anything, and
   counting it as dated would understate the gap by one. The column exists as of
   2026-08-04, so the metric measures per row: engineering items opened by the
   August 2026 audit carry maintainer-set dates, and the governance rows count
   here until the Board dates them. */
export function openActionsWithoutTargetDate(root = ROOT) {
  const md = read(root, 'docs/governance/open-actions-register.md');
  /* .map((m) => m[0]): the dated-column branch below splits each row, and a
     RegExpMatchArray has no .split — the branch first ran the day the column
     appeared (2026-08-04), which is when this would have thrown. */
  const rows = [...md.matchAll(/^\|\s*\d+\s*\|.*$/gm)].map((m) => m[0]);
  const header = (md.match(/^\|\s*#\s*\|.*$/m) || [''])[0];
  const cols = header.split('|').map((c) => c.trim().toLowerCase());
  const idx = cols.findIndex((c) => /target\s*date|due/.test(c));
  if (idx === -1) return rows.length;   // no column: nothing is dated
  return rows.filter((r) => {
    const cell = (r.split('|')[idx] || '').trim();
    return !/\d{4}-\d{2}-\d{2}/.test(cell);
  }).length;
}

/* ── Residual risk against appetite ────────────────────────────────────────
   docs/policies/risk-assessment-methodology.md §3 and §5 state the rule twice:
   "residual risk is compared against the appetite; anything above appetite
   requires a treatment plan with an owner and a date." Until every appetite
   position carried a numeric `residual_ceiling`, that comparison could not be
   made at all — "above appetite" had no operand — so the register's own auditor
   checkpoint ("residual scores sit within appetite") was unfalsifiable.

   The register is markdown-only, so the residual score is parsed out of the
   table rather than read from a data file. Columns are located by HEADER NAME,
   not by position: a column inserted into the register must not silently make
   this read the wrong cell. The residual cell reads like `🟡 10 Medium`; the
   number is the score.

   Each risk is scored against the ceiling of the appetite position that claims
   it in data/risk-appetite.json. A risk claimed by nobody is NOT skipped — it
   is returned as unclaimed and fails the test suite, because an unscored risk
   looks identical to a compliant one in a count. */
export function residualVsAppetite(root = ROOT) {
  const md = read(root, 'docs/aims/ai-risk-register.md');
  const header = (md.match(/^\|\s*ID\s*\|.*$/m) || [''])[0];
  const cols = header.split('|').map((c) => c.trim().toLowerCase());
  const iResidual = cols.indexOf('residual');
  const iTreatment = cols.findIndex((c) => c.startsWith('treatment'));

  const rows = [];
  for (const m of md.matchAll(/^\|\s*(R-\d+)\s*\|.*$/gm)) {
    const cells = m[0].split('|');
    const residual = Number((String(cells[iResidual] || '').match(/\d+/) || [])[0]);
    rows.push({ id: m[1], residual, treatment: String(cells[iTreatment] || '').trim() });
  }

  const appetite = json(root, 'data/risk-appetite.json');
  const owner = new Map();
  for (const a of appetite.appetite) for (const r of a.risks || []) owner.set(r, a);

  const above = [], unclaimed = [];
  for (const r of rows) {
    const a = owner.get(r.id);
    if (!a) { unclaimed.push(r.id); continue; }
    if (Number.isFinite(r.residual) && r.residual > a.residual_ceiling) {
      /* A dated treatment is what the methodology asks for; a cadence ("· MLRO ·
         quarterly") is a review rhythm, not a date. Recorded per row so the
         board can see which of the two each above-appetite risk actually has. */
      above.push({
        risk: r.id, residual: r.residual, appetite: a.id, position: a.position,
        ceiling: a.residual_ceiling, owner: a.owner,
        dated_treatment: /\d{4}-\d{2}-\d{2}/.test(r.treatment)
      });
    }
  }
  return { scored: rows.length, above, unclaimed };
}

/* ── Assembly ─────────────────────────────────────────────────────────────── */
export async function computeMetrics(root = ROOT) {
  const ce = controlEffectiveness(root);
  const cc = complianceCompletion(root);
  const tp = thirdPartyCoverage(root);
  const fc = findingClosure(root);
  const drift = await governanceDrift(root);
  const hygiene = obligationHygiene(root);
  const rva = residualVsAppetite(root);

  const counters = {
    modelToolDeclarations: modelToolDeclarations(root),
    governanceDriftCount: drift.total,
    unjustifiedSuppressions: unjustifiedSuppressions(root),
    obligationsWithoutOwner: hygiene.withoutOwner,
    obligationsWithoutWatchSource: hygiene.withoutWatchSource,
    openActionsWithoutTargetDate: openActionsWithoutTargetDate(root),
    residualAboveAppetite: rva.above.length,
    risksWithoutAppetitePosition: rva.unclaimed.length
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
     never counted as passing.

     A trigger framework needs a warning band, not just a red line, so a KRI may
     carry `threshold_amber` — the earlier line whose crossing is a signal rather
     than a breach. It is a SIBLING key, never a reshaping of `threshold`, which
     the test suite hard-requires. Amber exists only where the red line has
     headroom: a threshold of 0 or 100% has none by construction, and inventing
     one there would be a warning that can never fire.

     Every projected KRI carries its owner and the escalation SLA of the appetite
     position it measures — a breach with no named recipient and no clock is a
     dashboard, not a trigger framework. Note that this whole object is a
     PROJECTION: a field added to data/risk-appetite.json and not listed here
     never reaches the snapshot, so the governance data would exist and never be
     measured. */
  const appetite = json(root, 'data/risk-appetite.json');
  const positions = new Map(appetite.appetite.map((a) => [a.id, a]));
  const violates = (t, v) => (t.operator === '>=' ? !(v >= t.value) : t.operator === '<=' ? !(v <= t.value) : null);
  const kris = appetite.kris.map((k) => {
    const pos = positions.get(k.appetite_ref) || {};
    const base = {
      id: k.id, label: k.label, metric: k.metric, appetite_ref: k.appetite_ref,
      owner: k.owner || null, escalation_sla: pos.escalation_sla || null
    };
    if (!k.instrumented) return { ...base, value: null, instrumented: false, breached: null, amber: null };
    const value = values[k.metric] === undefined ? null : values[k.metric];
    const breached = value === null ? null : violates(k.threshold, value);
    /* Amber is reported only when the KRI is NOT already in breach — a red line
       crossed is not also a warning. */
    const amber = value === null || breached || !k.threshold_amber ? null : violates(k.threshold_amber, value);
    return { ...base, value, threshold: k.threshold, threshold_amber: k.threshold_amber || null, instrumented: true, breached, amber };
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
      overdueIssueRate: { value: null, numerator: null, denominator: null, basis: 'Not instrumented: the register’s governance rows carry no target date pending the Board’s item-17 decision, so the KRI cannot be aged; the engineering rows opened 2026-08 carry maintainer-set dates and are counted per row by openActionsWithoutTargetDate. See KRI-09 in data/risk-appetite.json.' },
      thirdPartyAssessmentCoverage: { value: tp.rate, numerator: tp.assessed, denominator: tp.total, basis: 'Vendors whose safeguard/DPA position is settled ÷ vendors in the third-party register. A cell still asking for a confirmation counts as outstanding.', outstanding: tp.outstanding },
      auditFindingClosureRate: { value: fc.rate, numerator: fc.closed, denominator: fc.total, basis: 'CAPA rows (CA-nn corrective + HA-nn hardening) at status Closed ÷ all CAPA rows.', open: fc.open }
    },
    counters,
    kris,
    /* Named, not just counted: a board that reads "1 risk above appetite" has to
       go and find which one. The `dated_treatment` flag is the methodology's own
       requirement scored per row — a treatment cell carrying a review cadence
       but no date does not satisfy "a treatment plan with an owner and a date". */
    appetite_scoring: {
      basis: 'Every row of docs/aims/ai-risk-register.md scored against the residual_ceiling of the appetite position that claims it in data/risk-appetite.json. A ceiling is the highest residual the firm carries in that domain without a dated treatment plan; see residual_ceiling_basis for how the ceilings are derived from the methodology bands.',
      risks_scored: rva.scored,
      above_appetite: rva.above,
      unclaimed_risks: rva.unclaimed
    },
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
