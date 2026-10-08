/* Offline, zero-dependency tamper-evident evidence RECEIPT primitives.

   This is NOT a database, a cryptographic signature by an MLRO, nonrepudiation
   or independently retained evidence. It never contacts a provider or writes
   to disk. A future authenticated backend must allocate sequence numbers,
   verify actor identity, enforce append-only storage and persist an external
   signed HEAD + expected count. Without that separate anchor a truncated
   valid chain may appear valid. DO NOT log personal/transaction content.
*/
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SCHEMA = 'hawkeye.evidence-receipt/v1';
const ZERO_HASH = '0'.repeat(64);
const MAX_ENTRIES = 10000;
const HASH_RE = /^[a-f0-9]{64}$/;
const CASE_RE = /^CASE-[A-Z0-9]{6,20}$/;
const ACTOR_RE = /^actor:[A-Za-z0-9._:-]{6,96}$/;
const ACTIONS = new Set([
  'CASE_OPENED', 'SOURCE_VERIFIED', 'REVIEW_REQUESTED',
  'MLRO_REVIEWED', 'REPORT_DELIVERED', 'SYSTEM_DEGRADED'
]);
const OUTCOMES = new Set([
  'PROPOSED', 'REVIEW_REQUIRED', 'HOLD', 'REVIEWED', 'DELIVERED', 'FAILED'
]);
const ROLES = new Set(['Analyst', 'Reviewer-MLRO', 'Admin', 'System']);
const FIELDS = [
  'schema', 'sequence', 'case_ref', 'event_time', 'actor_ref',
  'actor_role', 'action', 'outcome', 'evidence_hashes',
  'review_receipt_hash', 'prev_hash'
];

function eventTimeValid(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function secretValid(secret) {
  return typeof secret === 'string' && secret.length >= 24 && secret.length <= 4096;
}

function bodyValid(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).sort().join() !== [...FIELDS].sort().join()) return false;
  return body.schema === SCHEMA &&
    Number.isSafeInteger(body.sequence) && body.sequence >= 1 &&
    CASE_RE.test(body.case_ref) && ACTOR_RE.test(body.actor_ref) &&
    eventTimeValid(body.event_time) &&
    ROLES.has(body.actor_role) &&
    ACTIONS.has(body.action) &&
    OUTCOMES.has(body.outcome) &&
    Array.isArray(body.evidence_hashes) &&
    body.evidence_hashes.length >= 1 && body.evidence_hashes.length <= 32 &&
    body.evidence_hashes.every(x => typeof x === 'string' && HASH_RE.test(x)) &&
    new Set(body.evidence_hashes).size === body.evidence_hashes.length &&
    (body.review_receipt_hash === null ||
      (typeof body.review_receipt_hash === 'string' && HASH_RE.test(body.review_receipt_hash))) &&
    typeof body.prev_hash === 'string' && HASH_RE.test(body.prev_hash);
}

function canonicalPayload(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  /* No spread of caller-supplied objects: unsupported fields can carry
     confidential case notes or later change the hash calculation. */
  const data = Object.fromEntries(FIELDS.map(key => [key, details[key]]));
  return bodyValid(data) ? data : null;
}

function computeHash(data) {
  return createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');
}
function computeMac(hash, secret) {
  return createHmac('sha256', secret).update(hash, 'ascii').digest('hex');
}

function sealEvidenceReceipt(details, secret) {
  if (!secretValid(secret)) throw Error('evidence receipt secret missing or invalid');
  const payload = canonicalPayload(details);
  if (!payload || Object.keys(details).length !== FIELDS.length) {
    throw Error('evidence receipt metadata invalid; no confidential values permitted');
  }
  const hash = computeHash(payload);
  return { ...payload, hash, hmac: computeMac(hash, secret) };
}

function equalHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' ||
      !HASH_RE.test(a) || !HASH_RE.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function verifyEvidenceReceipts(entries, secret, opts = {}) {
  if (!secretValid(secret)) return { valid: false, reason: 'missing_verifier_secret' };
  if (!Array.isArray(entries) || !entries.length || entries.length > MAX_ENTRIES) {
    return { valid: false, reason: 'invalid_chain_length' };
  }
  let prior = ZERO_HASH;
  let priorTime = 0;
  for (let i = 0; i < entries.length; i++) {
    const item = entries[i];
    const data = canonicalPayload(item);
    if (!data || Object.keys(item).sort().join() !==
        [...FIELDS, 'hash', 'hmac'].sort().join()) {
      return { valid: false, reason: 'invalid_receipt_schema', index: i + 1 };
    }
    if (data.sequence !== i + 1 ||
        !equalHash(data.prev_hash, prior) ||
        Date.parse(data.event_time) < priorTime) {
      return { valid: false, reason: 'broken_sequence_or_link', index: i + 1 };
    }
    const expected = computeHash(data);
    if (!equalHash(item.hash, expected) ||
        !equalHash(item.hmac, computeMac(expected, secret))) {
      return { valid: false, reason: 'failed_integrity_check', index: i + 1 };
    }
    prior = expected;
    priorTime = Date.parse(data.event_time);
  }
  if (opts.expectedHeadHash && !equalHash(prior, opts.expectedHeadHash)) {
    return { valid: false, reason: 'external_anchor_mismatch' };
  }
  if (opts.expectedCount !== undefined && opts.expectedCount !== entries.length) {
    return { valid: false, reason: 'external_count_mismatch' };
  }
  return { valid: true, count: entries.length, head_hash: prior };
}

export { SCHEMA, ZERO_HASH, sealEvidenceReceipt, verifyEvidenceReceipts };
