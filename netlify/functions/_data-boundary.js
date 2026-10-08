'use strict';

/* Pre-egress identifier policy for the optional MLRO Advisor.

   This is NOT general-purpose DLP, legal authorization for cross-border data
   transfers, or a substitute for the Anthropic DPA/DPIA. Names, context and
   other forms of personal data may evade these narrow high-confidence patterns.

   Default: audit (existing behavior retained; no new rejection).
   Opt-in:  block (reject before provider call), redact (replace identifiers).
   Unknown configuration FAILS CLOSED. Do not allow clients to choose the mode.
   The function never logs or returns original identifier values.
*/

const MODES = new Set(['audit', 'block', 'redact']);
const PATTERNS = Object.freeze([
  { id: 'emirates_id', re: /\b784-?\d{4}-?\d{7}-?\d\b/gi },
  { id: 'iban', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi },
  { id: 'passport', re: /\b[A-Z]{1,2}\d{6,9}\b/gi },
  { id: 'long_number', re: /\b\d{12,}\b/g }
]);

function inspectEgress(fields, configuredMode) {
  const mode = String(configuredMode === undefined
    ? (process.env.ADVISOR_PII_EGRESS_POLICY || 'audit')
    : configuredMode).trim().toLowerCase();
  if (!MODES.has(mode)) {
    return { valid: false, allow: false, piiTypes: [],
      error: 'ADVISOR_PII_EGRESS_POLICY must be audit, block or redact' };
  }
  const input = fields && typeof fields === 'object' ? fields : {};
  const values = {};
  const kinds = new Set();

  for (const key of ['question', 'context', 'accumulated']) {
    const original = String(input[key] || '');
    let sanitized = original;
    for (const { id, re } of PATTERNS) {
      re.lastIndex = 0;
      if (re.test(original)) kinds.add(id);
      re.lastIndex = 0;
      if (mode === 'redact') sanitized = sanitized.replace(re, '[REDACTED_' + id.toUpperCase() + ']');
    }
    values[key] = sanitized;
  }
  const piiTypes = [...kinds];
  return {
    valid: true,
    allow: !(mode === 'block' && piiTypes.length),
    mode,
    piiTypes,
    redacted: mode === 'redact' && piiTypes.length > 0,
    ...values
  };
}

module.exports = { inspectEgress };
