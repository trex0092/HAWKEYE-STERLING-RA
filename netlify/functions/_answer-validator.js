'use strict';

/* Defense-in-depth, configurable validation for LLM decision-support output.

   "audit" is the default and preserves established Advisor UX. "withhold"
   prevents a flagged answer from becoming a renderable advisory response.
   Neither mode can establish whether arbitrary generated claims are TRUE.
   Deterministic screening remains authoritative, and the MLRO decides.

   Separately, validateCaseProposal accepts only a PROPOSED structured artifact
   whose evidence IDs are bound to a server-trusted registry. It has no side
   effects and cannot file, freeze, clear or approve a subject.
*/

const MODES = new Set(['audit', 'withhold']);
const RECOMMENDATIONS = new Set([
  'review', 'seek_more_evidence', 'escalate_to_mlro'
]);
const KINDS = new Set([
  'sanctions', 'pep', 'adverse_media', 'customer_due_diligence',
  'transaction_pattern', 'regulatory_context'
]);
const TOP_KEYS = new Set([
  'schema', 'case_id', 'status', 'recommendation',
  'findings', 'limitations', 'approval_required'
]);
const FINDING_KEYS = new Set(['kind', 'summary', 'evidence_ids']);

function inspectAdvisoryOutput(signals, policyValue) {
  const mode = String(policyValue === undefined
    ? (process.env.ADVISOR_OUTPUT_POLICY || 'audit')
    : policyValue).trim().toLowerCase();
  if (!MODES.has(mode)) return { valid: false, withheld: true, reasons: ['invalid_policy'] };

  const s = signals && typeof signals === 'object' ? signals : {};
  const reasons = [];
  if (s.structureFlagged === true) reasons.push('structure');
  if (s.hallFlagged === true) reasons.push('unsupported_claim');
  if (Array.isArray(s.citeFlagged) && s.citeFlagged.length) reasons.push('legal_citation');
  if (s.anomFlagged === true) reasons.push('output_anomaly');
  return { valid: true, policy: mode, withheld: mode === 'withhold' && reasons.length > 0, reasons };
}

function _keysOnly(obj, keys) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).every(key => keys.has(key));
}

function _shortString(value, min = 1, max = 2000) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function validateCaseProposal(input, approvedEvidenceIds) {
  let document = input;
  if (typeof input === 'string') {
    if (input.length > 32768) return { valid: false, reasons: ['payload_size'] };
    try { document = JSON.parse(input); }
    catch (_) { return { valid: false, reasons: ['invalid_json'] }; }
  }
  const fails = [];
  if (!_keysOnly(document, TOP_KEYS) ||
      document.schema !== 'hawkeye.case-proposal/v1' ||
      document.status !== 'PROPOSED' ||
      document.approval_required !== true ||
      !_shortString(document.case_id, 1, 120) ||
      !/^[A-Za-z0-9._:-]+$/.test(document.case_id || '') ||
      !RECOMMENDATIONS.has(document.recommendation)) fails.push('proposal_schema');

  const evidence = new Set(Array.isArray(approvedEvidenceIds) ?
    approvedEvidenceIds.filter(v => _shortString(v, 1, 180)) : []);
  if (!Array.isArray(document && document.limitations) ||
      document.limitations.length < 1 || document.limitations.length > 20 ||
      !document.limitations.every(x => _shortString(x, 4, 500))) fails.push('limitations');

  if (!Array.isArray(document && document.findings) ||
      document.findings.length > 20) {
    fails.push('findings_shape');
  } else {
    for (const f of document.findings) {
      if (!_keysOnly(f, FINDING_KEYS) || !KINDS.has(f.kind) ||
          !_shortString(f.summary, 10, 2000) ||
          !Array.isArray(f.evidence_ids) ||
          f.evidence_ids.length < 1 || f.evidence_ids.length > 8 ||
          !f.evidence_ids.every(id => _shortString(id, 1, 180) && evidence.has(id)) ||
          new Set(f.evidence_ids).size !== f.evidence_ids.length) {
        fails.push('finding_not_grounded');
        break;
      }
    }
  }
  return { valid: fails.length === 0, reasons: fails };
}

module.exports = { inspectAdvisoryOutput, validateCaseProposal };
