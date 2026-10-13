/* Provisional ISO/IEC 42001:2023 Annex A evidence map.
 * Validates 38 references and nine groups. Repository evidence existence
 * NEVER means ISO certification, formal applicability sign-off, operational
 * effectiveness, execution of a DPA, or a completed independent audit.
 *
 * node scripts/iso-annex-a-evidence.mjs --check
 * node scripts/iso-annex-a-evidence.mjs --report
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = 'data/iso42001-annex-a-evidence.json';
const ENTERPRISE = 'data/ai-controls.json';
const ACTIONS = 'docs/governance/open-actions-register.md';
const SCHEMA = 'hawkeye.iso42001.annex-a-provisional-crosswalk/v1';
const APPROVAL = 'pending_authorized_soa_review';

export const ANNEX_A_IDS = Object.freeze({
  'A.2': ['A.2.2', 'A.2.3', 'A.2.4'],
  'A.3': ['A.3.2', 'A.3.3'],
  'A.4': ['A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6'],
  'A.5': ['A.5.2', 'A.5.3', 'A.5.4', 'A.5.5'],
  'A.6': [
    'A.6.1.2', 'A.6.1.3', 'A.6.2.2', 'A.6.2.3', 'A.6.2.4',
    'A.6.2.5', 'A.6.2.6', 'A.6.2.7', 'A.6.2.8'
  ],
  'A.7': ['A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6'],
  'A.8': ['A.8.2', 'A.8.3', 'A.8.4', 'A.8.5'],
  'A.9': ['A.9.2', 'A.9.3', 'A.9.4'],
  'A.10': ['A.10.2', 'A.10.3', 'A.10.4']
});
const ID_ORDER = Object.values(ANNEX_A_IDS).flat();
const EXPECTED = new Set(ID_ORDER);
const EVIDENCE_PATH = /^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)+$/;

function safePath(path) {
  return typeof path === 'string' && path.length <= 200 &&
    EVIDENCE_PATH.test(path) && !path.split('/').includes('..') &&
    !path.split('/').includes('.') && !path.startsWith('netlify/');
}
function validText(s) {
  return typeof s === 'string' && s.trim().length >= 10 &&
    s.length <= 600 && !/[\r\n|]/.test(s);
}
function parseActionIds(markdown) {
  return new Set([...String(markdown || '').matchAll(/^\|\s*(\d+)\s*\|/gm)]
    .map(m => Number(m[1])));
}

export function validateAnnexAEvidence(data, enterprise, actionMarkdown,
  { pathExists = rel => existsSync(join(ROOT, rel)) } = {}) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.schema !== SCHEMA || data.approval_status !== APPROVAL ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.as_of || '')) {
    errors.push('invalid schema, date or unapproved SoA posture');
  }
  const items = data?.controls;
  if (!Array.isArray(items) || items.length !== ID_ORDER.length) {
    errors.push('expected exactly 38 Annex A controls');
  }
  const known = new Map();
  for (const c of enterprise?.controls || []) {
    if (typeof c?.id === 'string' && !known.has(c.id)) known.set(c.id, c);
  }
  const actions = parseActionIds(actionMarkdown);
  if (!actions.size) errors.push('missing authoritative open-actions register');
  const seen = new Set();
  for (const c of Array.isArray(items) ? items : []) {
    if (!c || typeof c !== 'object' || Array.isArray(c) ||
        typeof c.id !== 'string' || !EXPECTED.has(c.id) || seen.has(c.id)) {
      errors.push('unknown or duplicate Annex A control: ' + String(c?.id));
      continue;
    }
    seen.add(c.id);
    if (!validText(c.title) || !validText(c.accountable_owner) ||
        c.applicability !== 'provisional_applicable' ||
        !validText(c.operational_proof_required)) {
      errors.push(c.id + ': missing owner, description, proof or provisional scope');
    }
    if (!Array.isArray(c.eai_controls) || c.eai_controls.length < 1 ||
        new Set(c.eai_controls).size !== c.eai_controls.length) {
      errors.push(c.id + ': must map distinct enterprise controls');
    }
    for (const id of c.eai_controls || []) {
      const mapped = known.get(id);
      if (!mapped) errors.push(c.id + ': unrecognized enterprise control ' + id);
      else if (['partial', 'open'].includes(mapped.status)) {
        if (!Array.isArray(mapped.closure_actions) || mapped.closure_actions.length < 1) {
          errors.push(c.id + ': incomplete enterprise control missing closure actions: ' + id);
        }
        for (const n of mapped.closure_actions || []) {
          if (!actions.has(n)) errors.push(c.id + ': missing open action #' + n);
        }
      }
    }
    if (!Array.isArray(c.evidence_paths) || !c.evidence_paths.length ||
        new Set(c.evidence_paths).size !== c.evidence_paths.length) {
      errors.push(c.id + ': missing or duplicated evidence paths');
    }
    for (const path of c.evidence_paths || []) {
      if (!safePath(path) || !pathExists(path)) {
        errors.push(c.id + ': evidence path is unsafe or absent: ' + String(path));
      }
    }
  }
  for (const id of ID_ORDER) if (!seen.has(id)) errors.push('missing Annex A control ' + id);
  return errors;
}

function cell(s) {
  return String(s).replace(/[|\r\n]/g, ' ').trim();
}
export function buildAnnexAEvidenceReport(data, enterprise) {
  const known = new Map((enterprise?.controls || []).map(c => [c.id, c]));
  const rows = (data.controls || []).map(c => {
    const mapped = c.eai_controls.map(id => known.get(id)).filter(Boolean);
    const statuses = mapped.map(x => x.status);
    const signal = statuses.includes('open') ? 'OPEN IN ENTERPRISE REGISTER' :
      statuses.includes('partial') ? 'PARTIAL IN ENTERPRISE REGISTER' :
        'REPOSITORY-DOCUMENTED ONLY';
    const pending = [...new Set(mapped.flatMap(x => x.closure_actions || []))].sort((a, b) => a - b);
    return { ...c, signal, pending };
  });
  const out = [
    '# ISO/IEC 42001:2023 Annex A, provisional evidence traceability',
    '',
    '**UNAPPROVED crosswalk. NOT certification, an approved SoA, or proof that controls operate.**',
    '',
    '38 Annex A controls in nine groups. A.5 contains FOUR controls, not five.',
    'File existence proves only that a referenced artefact is in the repository.',
    '',
    '| Control | Enterprise signal | Accountable role | Open actions | Operational proof required |',
    '|---|---|---|---|---|'
  ];
  for (const c of rows) {
    out.push('| ' + c.id + ' ' + cell(c.title) +
      ' | ' + c.signal + ' | ' + cell(c.accountable_owner) +
      ' | ' + (c.pending.length ? c.pending.map(n => '#' + n).join(', ') : 'None mapped') +
      ' | ' + cell(c.operational_proof_required) + ' |');
  }
  out.push('', '## Referenced repository evidence', '');
  for (const c of rows) out.push('- ' + c.id + ': ' + c.evidence_paths.join(', '));
  out.push('', 'CI passing this mapping does not count as Board approval, a completed audit, a vendor DPA, a live performance evaluation, or an externally signed evidence record.', '');
  return out.join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = JSON.parse(readFileSync(join(ROOT, INPUT), 'utf8'));
  const enterprise = JSON.parse(readFileSync(join(ROOT, ENTERPRISE), 'utf8'));
  const actions = readFileSync(join(ROOT, ACTIONS), 'utf8');
  const errors = validateAnnexAEvidence(data, enterprise, actions);
  for (const error of errors) console.error('iso-annex-a-evidence: ' + error);
  if (errors.length) process.exitCode = 1;
  else if (process.argv.includes('--report')) process.stdout.write(buildAnnexAEvidenceReport(data, enterprise));
  else if (process.argv.includes('--check')) console.log('Annex A crosswalk: all 38 references structurally mapped; approved SoA and operational assurance remain pending.');
  else {
    console.error('Usage: node scripts/iso-annex-a-evidence.mjs --check|--report');
    process.exitCode = 2;
  }
}
