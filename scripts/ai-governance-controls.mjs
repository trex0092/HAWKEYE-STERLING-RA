/* Enterprise AI governance control register validator and generated views.
 *
 * Source of truth:
 *   data/ai-controls.json
 *   data/ai-risk-acceptances.json
 *   data/grc-metrics.json
 *
 * Usage:
 *   node scripts/ai-governance-controls.mjs
 *   node scripts/ai-governance-controls.mjs --write
 *   node scripts/ai-governance-controls.mjs --check
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTROL_FILE = 'data/ai-controls.json';
const ACCEPTANCE_FILE = 'data/ai-risk-acceptances.json';
const GRC_FILE = 'data/grc-metrics.json';
const RISK_FILE = 'docs/aims/ai-risk-register.md';
const ACTION_FILE = 'docs/governance/open-actions-register.md';
const DASHBOARD_JSON = 'data/ai-governance-dashboard.json';
const DASHBOARD_MD = 'docs/governance/enterprise-ai-governance-dashboard.md';
const OWNERSHIP_MD = 'docs/governance/ai-control-ownership-matrix.md';
const RESIDUAL_MD = 'docs/governance/residual-risk-acceptance-register.md';

const ALLOWED_STATUS = new Set(['effective', 'partial', 'open', 'not_applicable']);

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function json(rel) {
  return JSON.parse(read(rel));
}

function mdCell(v) {
  return String(v == null ? '' : v).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

function fail(errors) {
  if (!errors.length) return;
  for (const e of errors) console.error('ai-governance-controls: ' + e);
  process.exitCode = 1;
}

export function validateRegister(reg, actionMarkdown, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  const actionIds = new Set([...String(actionMarkdown || '').matchAll(/^\|\s*(\d+)\s*\|/gm)].map((m) => Number(m[1])));
  if (reg.schema !== 'hawkeye-sterling.enterprise-ai-controls/v1') errors.push('unexpected control-register schema');
  if (!reg.register_review || !/^\d{4}-\d{2}-\d{2}$/.test(reg.register_review.next_review_by || '')) {
    errors.push('register_review.next_review_by must be YYYY-MM-DD');
  } else if (today > reg.register_review.next_review_by) {
    errors.push('control register review is overdue: ' + reg.register_review.next_review_by);
  }

  const layers = new Map();
  for (const layer of reg.layers || []) {
    if (!/^L[1-6]$/.test(layer.id || '')) errors.push('invalid layer id: ' + String(layer.id));
    if (layers.has(layer.id)) errors.push('duplicate layer id: ' + layer.id);
    if (!layer.name || !layer.purpose) errors.push('layer missing name/purpose: ' + String(layer.id));
    layers.set(layer.id, layer);
  }
  for (let i = 1; i <= 6; i++) if (!layers.has('L' + i)) errors.push('missing layer L' + i);

  const ids = new Set();
  for (const c of reg.controls || []) {
    if (!c.id || ids.has(c.id)) errors.push('missing or duplicate control id: ' + String(c.id));
    ids.add(c.id);
    if (!layers.has(c.layer)) errors.push(c.id + ': unknown layer ' + String(c.layer));
    if (!c.name || !c.owner || !c.operator || !c.cadence) errors.push(c.id + ': missing name/owner/operator/cadence');
    if (!ALLOWED_STATUS.has(c.status)) errors.push(c.id + ': invalid status ' + String(c.status));
    if (c.review_by !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.review_by))) errors.push(c.id + ': review_by must be YYYY-MM-DD');
      else if (c.status === 'effective' && today > c.review_by) errors.push(c.id + ': effective control review is overdue: ' + c.review_by);
    }
    if (c.status === 'partial' || c.status === 'open') {
      if (!Array.isArray(c.closure_actions) || c.closure_actions.length === 0) {
        errors.push(c.id + ': incomplete control must name at least one closure_actions item');
      } else {
        const seenActions = new Set();
        for (const action of c.closure_actions) {
          if (!Number.isInteger(action) || action <= 0) errors.push(c.id + ': invalid closure action ' + String(action));
          else if (seenActions.has(action)) errors.push(c.id + ': duplicate closure action ' + action);
          else if (!actionIds.has(action)) errors.push(c.id + ': closure action ' + action + ' is not present in open-actions register');
          seenActions.add(action);
        }
      }
    } else if (Array.isArray(c.closure_actions) && c.closure_actions.length) {
      errors.push(c.id + ': effective/not-applicable control must not carry closure_actions');
    }
    if (!Array.isArray(c.evidence) || c.evidence.length === 0) errors.push(c.id + ': no evidence paths');
    for (const rel of c.evidence || []) {
      if (/^https?:/i.test(rel)) errors.push(c.id + ': evidence must be a repository path, not URL: ' + rel);
      else if (!existsSync(join(ROOT, rel))) errors.push(c.id + ': missing evidence path ' + rel);
    }
    for (const rel of c.tests || []) {
      if (!existsSync(join(ROOT, rel))) errors.push(c.id + ': missing test path ' + rel);
    }
  }
  return errors;
}

export function validateAcceptances(data, riskMarkdown, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  if (data.schema !== 'hawkeye-sterling.ai-risk-acceptances/v1') errors.push('unexpected risk-acceptance schema');
  const riskIds = new Set([...riskMarkdown.matchAll(/^\|\s*(R-\d+)\s*\|/gm)].map((m) => m[1]));
  const seen = new Set();
  for (const a of data.acceptances || []) {
    if (!a.risk_id || seen.has(a.risk_id)) errors.push('missing or duplicate risk acceptance id: ' + String(a.risk_id));
    seen.add(a.risk_id);
    if (!riskIds.has(a.risk_id)) errors.push(a.risk_id + ': risk does not exist in AI risk register');
    for (const k of ['accepted_by', 'decision_date', 'rationale', 'evidence']) {
      if (!a[k] || !String(a[k]).trim()) errors.push(a.risk_id + ': missing ' + k);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.decision_date || '')) errors.push(a.risk_id + ': invalid decision_date');
    const review = a.review_by || a.expiry_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(review || '')) errors.push(a.risk_id + ': review_by or expiry_date required');
    else if (today > review) errors.push(a.risk_id + ': exceptional risk acceptance expired on ' + review);
    if (a.evidence && !existsSync(join(ROOT, a.evidence))) errors.push(a.risk_id + ': missing decision evidence ' + a.evidence);
  }
  return errors;
}

function layerSummary(reg) {
  const byLayer = [];
  for (const layer of reg.layers) {
    const rows = reg.controls.filter((c) => c.layer === layer.id);
    const count = (s) => rows.filter((c) => c.status === s).length;
    const open = count('open');
    const partial = count('partial');
    byLayer.push({
      id: layer.id,
      name: layer.name,
      purpose: layer.purpose,
      controls: rows.length,
      effective: count('effective'),
      partial,
      open,
      not_applicable: count('not_applicable'),
      status: open || partial ? 'partial' : 'effective'
    });
  }
  return byLayer;
}

export function buildDashboard(reg, grc) {
  const layers = layerSummary(reg);
  const count = (s) => reg.controls.filter((c) => c.status === s).length;
  return {
    schema: 'hawkeye-sterling.enterprise-ai-governance-dashboard/v1',
    as_of: reg.register_review.compiled_on,
    generated_by: 'scripts/ai-governance-controls.mjs --write',
    source_register: CONTROL_FILE,
    review_by: reg.register_review.next_review_by,
    summary: {
      controls: reg.controls.length,
      effective: count('effective'),
      partial: count('partial'),
      open: count('open'),
      not_applicable: count('not_applicable'),
      overall_status: layers.some((l) => l.status !== 'effective') ? 'partial' : 'effective'
    },
    layers,
    governance_signals: {
      control_effectiveness_rate: grc.metrics.controlEffectivenessRate.value,
      third_party_assessment_coverage: grc.metrics.thirdPartyAssessmentCoverage.value,
      audit_finding_closure_rate: grc.metrics.auditFindingClosureRate.value,
      governance_drift_count: grc.counters.governanceDriftCount,
      residual_above_appetite: grc.counters.residualAboveAppetite,
      open_actions_without_target_date: grc.counters.openActionsWithoutTargetDate
    },
    interpretation: [
      'Layer status is derived from control-register status plus repository evidence-path validation.',
      'GRC signals are copied from the separately generated data/grc-metrics.json snapshot.',
      'Green repository evidence does not imply external certification or completion of human approvals.'
    ]
  };
}

export function renderDashboard(reg, dashboard) {
  const L = [
    '# Enterprise AI Governance Dashboard',
    '',
    '> Generated by `scripts/ai-governance-controls.mjs --write` from `data/ai-controls.json` and `data/grc-metrics.json`. Do not hand-edit.',
    '',
    '**As of:** ' + dashboard.as_of + '  ',
    '**Register review due:** ' + dashboard.review_by + '  ',
    '**Overall status:** **' + dashboard.summary.overall_status.toUpperCase() + '**',
    '',
    '## Six-layer status',
    '',
    '| Layer | Status | Effective | Partial | Open | Total |',
    '|---|---|---:|---:|---:|---:|'
  ];
  for (const x of dashboard.layers) {
    L.push('| ' + mdCell(x.id + ' · ' + x.name) + ' | **' + x.status.toUpperCase() + '** | ' + x.effective + ' | ' + x.partial + ' | ' + x.open + ' | ' + x.controls + ' |');
  }
  L.push(
    '',
    '## Repository-derived governance signals',
    '',
    '| Signal | Current value | Source |',
    '|---|---:|---|',
    '| Automated proof-path coverage (GRC control-effectiveness metric) | ' + dashboard.governance_signals.control_effectiveness_rate + '% | `data/grc-metrics.json` |',
    '| Third-party assessment coverage | ' + dashboard.governance_signals.third_party_assessment_coverage + '% | `data/grc-metrics.json` |',
    '| Audit finding closure rate | ' + dashboard.governance_signals.audit_finding_closure_rate + '% | `data/grc-metrics.json` |',
    '| Governance drift count | ' + dashboard.governance_signals.governance_drift_count + ' | `data/grc-metrics.json` |',
    '| Risks above appetite | ' + dashboard.governance_signals.residual_above_appetite + ' | `data/grc-metrics.json` |',
    '| Open actions without target date | ' + dashboard.governance_signals.open_actions_without_target_date + ' | `data/grc-metrics.json` |',
    '',
    '## Partial and open controls',
    '',
    '| Control | Layer | Status | Closure actions | Why it is not fully effective |',
    '|---|---|---|---|---|'
  );
  for (const c of reg.controls.filter((c) => c.status === 'partial' || c.status === 'open')) {
    const actions = (c.closure_actions || []).map((n) => '#' + n).join(', ');
    L.push('| `' + c.id + '` ' + mdCell(c.name) + ' | ' + c.layer + ' | **' + c.status.toUpperCase() + '** | ' + mdCell(actions) + ' | ' + mdCell(c.note) + ' |');
  }
  L.push(
    '',
    '## Interpretation',
    '',
    'This dashboard reports the state represented by the repository. It does not turn a missing human approval, unsigned contract, unperformed audit, or uncommissioned external assessment into a completed control.',
    '',
    'The 100% automated proof-path signal is the GRC metric for assurance-matrix rows whose named automated proof artefacts exist. It is not the percentage of enterprise AI controls rated effective; the six-layer counts above are the authoritative status view for that question.',
    '',
    'A CI pass proves that the register is internally consistent, its evidence paths exist, its review deadline has not expired, and the generated views match their sources. It does not constitute MLRO, Board, legal, regulator, or external-auditor approval.',
    ''
  );
  return L.join('\n');
}

export function renderOwnership(reg) {
  const L = [
    '# AI Control Ownership Matrix',
    '',
    '> Generated by `scripts/ai-governance-controls.mjs --write` from `data/ai-controls.json`. Do not hand-edit.',
    '',
    '| Control | Layer | Control objective | Accountable owner | Operator | Cadence | Status |',
    '|---|---|---|---|---|---|---|'
  ];
  for (const c of reg.controls) {
    L.push('| `' + c.id + '` | ' + c.layer + ' | ' + mdCell(c.name) + ' | ' + mdCell(c.owner) + ' | ' + mdCell(c.operator) + ' | ' + mdCell(c.cadence) + ' | ' + c.status + ' |');
  }
  L.push(
    '',
    'The accountable owner retains decision responsibility. The operator maintains or executes the control. A generated row is not evidence that a human approval or review has occurred.',
    ''
  );
  return L.join('\n');
}

export function renderResidual(grc, acceptances) {
  const byRisk = new Map((acceptances.acceptances || []).map((a) => [a.risk_id, a]));
  const above = grc.appetite_scoring?.above_appetite || [];
  const L = [
    '# Residual-Risk Acceptance Register',
    '',
    '> Generated by `scripts/ai-governance-controls.mjs --write` from `data/grc-metrics.json` and `data/ai-risk-acceptances.json`. Do not hand-edit.',
    '',
    '**Rule:** a risk above appetite is never treated as accepted unless `data/ai-risk-acceptances.json` contains a valid, evidenced human decision.',
    '',
    '## Above-appetite decision queue',
    '',
    '| Risk | Residual | Appetite | Ceiling | Owner | Dated treatment | Exceptional acceptance |',
    '|---|---:|---|---:|---|---|---|'
  ];
  if (!above.length) L.push('| None | | | | | | |');
  for (const r of above) {
    const a = byRisk.get(r.risk);
    const decision = a
      ? 'Recorded by ' + a.accepted_by + ', review/expiry ' + (a.review_by || a.expiry_date)
      : '**NONE. Treatment or human decision required.**';
    L.push('| ' + r.risk + ' | ' + r.residual + ' | ' + r.appetite + ' | ' + r.ceiling + ' | ' + mdCell(r.owner) + ' | ' + (r.dated_treatment ? 'yes' : 'no') + ' | ' + mdCell(decision) + ' |');
  }
  L.push(
    '',
    '## Explicit acceptance decisions',
    '',
    '| Risk | Accepted by | Decision date | Review/expiry | Evidence | Rationale |',
    '|---|---|---|---|---|---|'
  );
  const rows = acceptances.acceptances || [];
  if (!rows.length) L.push('| None recorded | | | | | |');
  for (const a of rows) {
    L.push('| ' + a.risk_id + ' | ' + mdCell(a.accepted_by) + ' | ' + a.decision_date + ' | ' + (a.review_by || a.expiry_date) + ' | `' + mdCell(a.evidence) + '` | ' + mdCell(a.rationale) + ' |');
  }
  L.push(
    '',
    'Within-appetite treatment decisions remain authoritative in `docs/aims/ai-risk-register.md`. This view is intentionally narrow: it prevents an above-appetite exception from being hidden or inferred.',
    ''
  );
  return L.join('\n');
}

function expectedOutputs(reg, acceptances, grc) {
  const dashboard = buildDashboard(reg, grc);
  return new Map([
    [DASHBOARD_JSON, JSON.stringify(dashboard, null, 2) + '\n'],
    [DASHBOARD_MD, renderDashboard(reg, dashboard) + '\n'],
    [OWNERSHIP_MD, renderOwnership(reg) + '\n'],
    [RESIDUAL_MD, renderResidual(grc, acceptances) + '\n']
  ]);
}

function main() {
  const reg = json(CONTROL_FILE);
  const acceptances = json(ACCEPTANCE_FILE);
  const grc = json(GRC_FILE);
  const riskMarkdown = read(RISK_FILE);
  const actionMarkdown = read(ACTION_FILE);
  const errors = [
    ...validateRegister(reg, actionMarkdown),
    ...validateAcceptances(acceptances, riskMarkdown)
  ];
  fail(errors);
  if (errors.length) return;

  const outputs = expectedOutputs(reg, acceptances, grc);
  if (process.argv.includes('--write')) {
    for (const [rel, content] of outputs) writeFileSync(join(ROOT, rel), content);
    console.log('ai-governance-controls: wrote ' + [...outputs.keys()].join(', '));
    return;
  }

  if (process.argv.includes('--check')) {
    const drift = [];
    for (const [rel, expected] of outputs) {
      if (!existsSync(join(ROOT, rel))) drift.push(rel + ' is missing');
      else if (read(rel) !== expected) drift.push(rel + ' is stale');
    }
    if (drift.length) {
      for (const d of drift) console.error('ai-governance-controls: ' + d);
      console.error('Run: node scripts/ai-governance-controls.mjs --write');
      process.exitCode = 1;
    } else {
      console.log('ai-governance-controls: register, evidence paths, freshness and generated views are current');
    }
    return;
  }

  process.stdout.write(outputs.get(DASHBOARD_MD));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
