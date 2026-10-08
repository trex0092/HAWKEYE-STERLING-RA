'use strict';

/* Human review evidence preflight, NOT an approval/execution endpoint.

   This module only returns REVIEW_READY or HOLD. It NEVER returns permission
   to file STR/SAR, freeze, clear a sanctions hit or onboard a customer.
   Evidence must be checked against a trusted registry before review, and
   detached approvals are signed with pinned human keys under server control.

   CRITICAL: this is not a replay-preventing authorization gateway. Deployment
   would additionally require a durable spent-nonce store, verified employee
   identity and lifecycle, key rotation, immutable evidence, and MLRO approval.
*/
const crypto = require('node:crypto');
const { validateCaseProposal } = require('./_answer-validator');

const REQUIRED_ATTEST = Object.freeze([
  'aud', 'case_id', 'proposal_sha256', 'subject', 'role',
  'issued_at', 'expires_at', 'nonce', 'key_id', 'signature'
]);
const HEX64 = /^[a-f0-9]{64}$/;
const BASE64URL = /^[A-Za-z0-9_-]{128,1024}$/;
const ID = /^[A-Za-z0-9._:-]{1,128}$/;

function digestProposal(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return null;
  try {
    const serialized = JSON.stringify(proposal);
    if (!serialized || serialized.length > 32768) return null;
    return crypto.createHash('sha256').update(serialized).digest('hex');
  } catch (_) { return null; }
}

function signedMessage(a) {
  const parts = [
    'hawkeye-human-review/v1', a.aud, a.case_id, a.proposal_sha256,
    a.subject, a.role, a.issued_at, a.expires_at, a.nonce, a.key_id
  ];
  return parts.join('\n');
}

function verifySignedReview(a, expectedCase, expectedDigest, trustedKeys, now) {
  if (!a || typeof a !== 'object' || Array.isArray(a) ||
      Object.keys(a).length !== REQUIRED_ATTEST.length ||
      REQUIRED_ATTEST.some(k => !Object.hasOwn(a, k))) return null;
  if (a.aud !== 'hawkeye-case-review' ||
      a.role !== 'Reviewer-MLRO' ||
      a.case_id !== expectedCase || a.proposal_sha256 !== expectedDigest ||
      typeof a.subject !== 'string' || !ID.test(a.subject) ||
      typeof a.key_id !== 'string' || !ID.test(a.key_id) ||
      typeof a.nonce !== 'string' || !ID.test(a.nonce) ||
      typeof a.signature !== 'string' || !BASE64URL.test(a.signature) ||
      !HEX64.test(a.proposal_sha256) ||
      !Number.isSafeInteger(a.issued_at) || !Number.isSafeInteger(a.expires_at) ||
      a.issued_at > now + 30 || a.expires_at <= now - 30 ||
      a.expires_at <= a.issued_at ||
      a.expires_at - a.issued_at > 900 ||
      now - a.issued_at > 900) return null;

  const key = trustedKeys && Object.hasOwn(trustedKeys, a.key_id) && trustedKeys[a.key_id];
  if (!key || key.subject !== a.subject || key.role !== a.role ||
      !key.public_jwk || key.public_jwk.kty !== 'RSA') return null;
  try {
    const rsa = crypto.createPublicKey({ key: key.public_jwk, format: 'jwk' });
    if (!crypto.verify('RSA-SHA256', Buffer.from(signedMessage(a)), rsa,
      Buffer.from(a.signature, 'base64url'))) return null;
    return { subject: a.subject, nonce: a.nonce, key_id: a.key_id };
  } catch (_) { return null; }
}

function assessCaseReviewReadiness(proposal, reviews, context = {}) {
  const reasons = [];
  const digest = digestProposal(proposal);
  if (!digest || !context || !Array.isArray(context.trustedEvidenceIds) ||
      !validateCaseProposal(proposal, context.trustedEvidenceIds).valid) {
    reasons.push('unverified_proposal_or_sources');
  }
  const tier = context && context.riskTier;
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(tier)) reasons.push('unknown_risk_tier');
  const initiator = context && context.initiator;
  if (typeof initiator !== 'string' || !ID.test(initiator)) reasons.push('unverified_initiator');
  const now = context && context.now;
  if (!Number.isSafeInteger(now) || now <= 0) reasons.push('unverified_time');
  if (!context || !context.trustedKeys || typeof context.trustedKeys !== 'object') {
    reasons.push('missing_trust_anchor');
  }
  if (!Array.isArray(reviews) || reviews.length > 8) reasons.push('invalid_review_bundle');

  const valid = [];
  if (reasons.length === 0) {
    for (const a of reviews) {
      const v = verifySignedReview(a, proposal.case_id, digest, context.trustedKeys, now);
      if (!v) { reasons.push('invalid_signed_review'); break; }
      if (v.subject === initiator) { reasons.push('initiator_cannot_approve'); break; }
      valid.push(v);
    }
    if (new Set(valid.map(v => v.subject)).size !== valid.length ||
        new Set(valid.map(v => v.nonce)).size !== valid.length) {
      reasons.push('duplicate_review_or_nonce');
    }
    const minimum = tier === 'HIGH' ? 2 : 1;
    if (valid.length < minimum) reasons.push('insufficient_independent_mlro_signoffs');
  }
  return {
    status: reasons.length ? 'HOLD' : 'REVIEW_READY',
    approved_for_execution: false,
    evidence_sha256: digest || null,
    trusted_review_count: reasons.length ? 0 : valid.length,
    reasons,
    requires_durable_replay_store: true
  };
}

module.exports = { digestProposal, signedMessage, verifySignedReview, assessCaseReviewReadiness };
