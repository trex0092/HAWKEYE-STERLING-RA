/* Verified OIDC identity tests. Synthetic RS256 keys and JWTs only.
   No live IdP, secrets, external API, or patient/customer data.
   Usage: node test/identity.test.js
*/
'use strict';
const crypto = require('node:crypto');
const path = require('node:path');
const identity = require(path.join(__dirname, '..', 'netlify', 'functions', '_identity.js'));
const reviewGate = require(path.join(__dirname, '..', 'netlify', 'functions', '_human-review.js'));

const mirror = require(path.join(__dirname, '..', 'netlify', 'functions', 'asana-mirror.js'));
const riskBackup = require(path.join(__dirname, '..', 'netlify', 'functions', 'risk-backup.js'));
const asanaTask = require(path.join(__dirname, '..', 'netlify', 'functions', 'asana-task.js'));
const brainSoul = require(path.join(__dirname, '..', 'netlify', 'functions', 'brain-soul.js'));

const envNames = [
  'APP_OIDC_REQUIRED', 'APP_OIDC_ISSUER', 'APP_OIDC_AUDIENCE',
  'APP_OIDC_JWKS_URL', 'APP_OIDC_MAX_TTL_SECONDS', 'APP_SHARED_TOKEN',
  'ASANA_ACCESS_TOKEN', 'ASANA_PROJECT_GID'
];
const originals = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const originalFetch = global.fetch;
let passed = 0, failed = 0;
function check(message, yes) {
  if (yes) { passed++; console.log('  ok  ' + message); }
  else { failed++; console.log('FAIL  ' + message); }
}
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
const issuer = 'https://idp.example.test/tenant';
const audience = 'hawkeye-backend';
const jwksUrl = issuer + '/keys';
const now = Math.floor(Date.now() / 1000);
const defaultClaims = {
  iss: issuer, aud: audience, sub: 'synthetic-account', iat: now - 10,
  exp: now + 600, hawkeye_role: 'Reviewer-MLRO'
};
function b64(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function jwt(claims = {}, header = {}) {
  const signingInput = b64({ alg: 'RS256', kid: 'test-key', typ: 'at+jwt', ...header }) +
    '.' + b64({ ...defaultClaims, ...claims });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  return signingInput + '.' + sig;
}
function event(token, body) {
  return { httpMethod: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: JSON.stringify(body || {}) };
}


/* Signed case review readiness is NOT execution approval. Every test uses
   ephemeral human keys, synthetic data and an offline trusted key registry. */
(() => {
  const p = {
    schema: 'hawkeye.case-proposal/v1', case_id: 'SYNTHETIC-CASE-1',
    status: 'PROPOSED', recommendation: 'review',
    findings: [{ kind: 'sanctions',
      summary: 'Synthetic official-list candidate needs independent review',
      evidence_ids: ['synthetic:official:1'] }],
    limitations: ['No real screening decision has been made.'],
    approval_required: true
  };
  const ka = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const trust = {
    'reviewer-a-key': { subject: 'reviewer-a', role: 'Reviewer-MLRO',
      public_jwk: ka.publicKey.export({ format: 'jwk' }) },
    'reviewer-b-key': { subject: 'reviewer-b', role: 'Reviewer-MLRO',
      public_jwk: kb.publicKey.export({ format: 'jwk' }) }
  };
  const epoch = Math.floor(Date.now() / 1000);
  const base = {
    trustedEvidenceIds: ['synthetic:official:1'], riskTier: 'LOW',
    initiator: 'synthetic-analyst', now: epoch, trustedKeys: trust
  };
  const digest = reviewGate.digestProposal(p);
  function signed(subject, keyId, privateKey, override = {}) {
    const a = {
      aud: 'hawkeye-case-review', case_id: p.case_id,
      proposal_sha256: digest, subject, role: 'Reviewer-MLRO',
      issued_at: epoch - 10, expires_at: epoch + 600,
      nonce: 'unique-' + keyId, key_id: keyId,
      ...override
    };
    a.signature = crypto.sign('RSA-SHA256',
      Buffer.from(reviewGate.signedMessage(a)), privateKey).toString('base64url');
    return a;
  }
  const a = signed('reviewer-a', 'reviewer-a-key', ka.privateKey);
  const b = signed('reviewer-b', 'reviewer-b-key', kb.privateKey);
  const assess = (proposal, reviews, settings = {}) =>
    reviewGate.assessCaseReviewReadiness(proposal, reviews, { ...base, ...settings });

  let status = assess(p, [a]);
  check('signed independent MLRO review can make a low-risk draft review-ready',
    status.status === 'REVIEW_READY' && status.trusted_review_count === 1);
  check('review-ready never grants autonomous case execution permission',
    status.approved_for_execution === false && status.requires_durable_replay_store === true);
  check('high-risk draft requires two independent MLRO signatures',
    assess(p, [a], { riskTier: 'HIGH' }).status === 'HOLD' &&
    assess(p, [a, b], { riskTier: 'HIGH' }).status === 'REVIEW_READY');
  check('missing signature and empty review set always HOLD',
    assess(p, []).status === 'HOLD' &&
    assess(p, [{ ...a, signature: '' }]).status === 'HOLD');
  check('attempted role escalation is rejected even after signed-byte mutation',
    assess(p, [{ ...a, role: 'Admin' }]).status === 'HOLD');
  check('approval bound to one draft is rejected after proposal mutation',
    assess({ ...p, recommendation: 'escalate_to_mlro' }, [a]).status === 'HOLD');
  check('one human cannot provide two independent signatures',
    assess(p, [a, a], { riskTier: 'HIGH' }).status === 'HOLD');
  check('submitter cannot approve own proposed case',
    assess(p, [a], { initiator: 'reviewer-a' }).status === 'HOLD');
  check('untrusted case evidence ID fails before review',
    assess(p, [a], { trustedEvidenceIds: ['synthetic:unrelated'] }).status === 'HOLD');
  check('a proposed case cannot spoof a filed/closed state',
    assess({ ...p, status: 'FILED' }, [a]).status === 'HOLD');
  check('a forged autonomous filing field invalidates the proposal',
    assess({ ...p, auto_file_str: true }, [a]).status === 'HOLD');
  check('unknown risk tier cannot be silently downgraded to LOW',
    assess(p, [a], { riskTier: 'UNKNOWN' }).status === 'HOLD');
  check('review trust anchors must be available from server side',
    assess(p, [a], { trustedKeys: null }).status === 'HOLD');
  const expired = signed('reviewer-a', 'reviewer-a-key', ka.privateKey, {
    issued_at: epoch - 7200, expires_at: epoch - 600
  });
  check('expired signed reviews cannot unlock a case',
    assess(p, [expired]).status === 'HOLD');
})();

(async () => {
  try {
    process.env.APP_OIDC_REQUIRED = '0';
    check('legacy identity mode remains opt-in',
      (await identity.requireIdentityRole(event(), ['Admin'])).ok === true);

    process.env.APP_OIDC_REQUIRED = '1';
    process.env.APP_OIDC_ISSUER = issuer;
    process.env.APP_OIDC_AUDIENCE = audience;
    process.env.APP_OIDC_JWKS_URL = jwksUrl;
    process.env.APP_OIDC_MAX_TTL_SECONDS = '3600';
    delete process.env.APP_SHARED_TOKEN;
    process.env.ASANA_ACCESS_TOKEN = 'offline-test-only';
    process.env.ASANA_PROJECT_GID = '0';

    let keyFetches = 0;
    let asanaFetches = 0;
    global.fetch = async url => {
      if (url !== jwksUrl) { asanaFetches++; throw Error('downstream must not be called'); }
      keyFetches++;
      return {
        ok: true, headers: { get: () => null },
        text: async () => JSON.stringify({ keys: [publicJwk] })
      };
    };

    check('required identity denies missing bearer',
      (await identity.requireIdentityRole(event(), ['Reviewer-MLRO'])).statusCode === 401);
    const valid = jwt();
    const verified = await identity.requireIdentityRole(event(valid), ['Reviewer-MLRO', 'Admin']);
    check('signed allowed role is verified and subject is traceable',
      verified.ok === true && verified.enabled === true &&
      verified.role === 'Reviewer-MLRO' && verified.subject === 'synthetic-account');
    const noAdmin = await identity.requireIdentityRole(event(valid), ['Admin']);
    check('valid identity without required role returns 403',
      !noAdmin.ok && noAdmin.statusCode === 403);
    check('JWKS is cached for repeated token checks', keyFetches === 1);

    const checks = [
      ['wrong issuer', jwt({ iss: 'https://fake.example.test' })],
      ['wrong audience', jwt({ aud: 'another-api' })],
      ['expired access token', jwt({ iat: now - 7200, exp: now - 3600 })],
      ['token minted in the future', jwt({ iat: now + 3600, exp: now + 3900 })],
      ['excessive token lifetime', jwt({ iat: now - 10, exp: now + 86400 })],
      ['unsigned algorithm none', jwt({}, { alg: 'none' })],
      ['untrusted role claim', jwt({ hawkeye_role: 'Superuser' })],
      ['unrecognized signing key', jwt({}, { kid: 'another-key' })]
    ];
    for (const [label, token] of checks) {
      const denied = await identity.requireIdentityRole(event(token), ['Reviewer-MLRO', 'Admin']);
      check('rejects ' + label, denied.statusCode === 401);
    }
    const parts = valid.split('.');
    const tampered = parts[0] + '.' + b64({ ...defaultClaims, hawkeye_role: 'Admin' }) + '.' + parts[2];
    check('role escalation by editing unsigned payload is rejected',
      (await identity.requireIdentityRole(event(tampered), ['Admin'])).statusCode === 401);

    let result = await mirror.handler(event(null, { action: 'read' }));
    check('confidential mirror blocks request without verified bearer',
      result.statusCode === 401 && asanaFetches === 0);
    const analyst = jwt({ hawkeye_role: 'Analyst' });
    result = await mirror.handler(event(analyst, { action: 'read' }));
    check('Analyst cannot read the firm-wide confidential mirror',
      result.statusCode === 403 && asanaFetches === 0);
    result = await riskBackup.handler(event(valid, { sheet: { overrides: {} } }));
    check('only Admin can write risk overrides',
      result.statusCode === 403 && asanaFetches === 0);

    // Extend signed OIDC enforcement to the other sensitive live Netlify
    // handlers. We never call the actual Asana or Anthropic APIs in tests.
    result = await asanaTask.handler(event(null, { name: 'Synthetic assessment' }));
    check('regulated assessment task write requires a signed bearer when OIDC enabled',
      result.statusCode === 401 && asanaFetches === 0);
    result = await asanaTask.handler(event(analyst, { name: 'Synthetic assessment' }));
    check('Analyst is not permitted to complete/write regulated assessment tasks',
      result.statusCode === 403 && asanaFetches === 0);
    const spoofed = event(null, { name: 'Synthetic assessment' });
    spoofed.headers['x-app-role'] = 'Admin';
    spoofed.headers['x-user-role'] = 'Reviewer-MLRO';
    result = await asanaTask.handler(spoofed);
    check('forged browser-side role headers never bypass Asana task identity',
      result.statusCode === 401 && asanaFetches === 0);

    result = await brainSoul.handler(event(null, { question: 'Synthetic AML question' }));
    check('Advisor rejects anonymous model requests before any external call',
      result.statusCode === 401 && asanaFetches === 0);
    result = await brainSoul.handler(event(tampered, { question: 'Synthetic AML question' }));
    check('Advisor rejects tampered identity token rather than making an LLM call',
      result.statusCode === 401 && asanaFetches === 0);
    const asanaCors = await asanaTask.handler({
      httpMethod: 'OPTIONS', headers: { origin: 'https://hawkeye-sterling-ra.netlify.app' }
    });
    check('Asana task CORS advertises Authorization only to the configured origin',
      asanaCors.headers && /Authorization/.test(asanaCors.headers['Access-Control-Allow-Headers'] || ''));
    const advisorCors = await brainSoul.handler({
      httpMethod: 'OPTIONS', headers: { origin: 'https://hawkeye-sterling-ra.netlify.app' }
    });
    check('Advisor CORS advertises Authorization for approved sign-in clients',
      advisorCors.headers && /Authorization/.test(advisorCors.headers['Access-Control-Allow-Headers'] || ''));


    delete process.env.APP_OIDC_AUDIENCE;
    const configError = await identity.requireIdentityRole(event(valid), ['Admin']);
    check('enabled OIDC with incomplete config fails closed at 503',
      configError.statusCode === 503);
    process.env.APP_OIDC_AUDIENCE = audience;

    identity._resetCache();
    global.fetch = async () => { throw Error('simulated IdP outage'); };
    check('IdP verification outage fails closed at 503',
      (await identity.requireIdentityRole(event(valid), ['Reviewer-MLRO'])).statusCode === 503);
  } finally {
    for (const name of envNames) {
      if (originals[name] === undefined) delete process.env[name];
      else process.env[name] = originals[name];
    }
    global.fetch = originalFetch;
    identity._resetCache();
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exitCode = failed ? 1 : 0;
})().catch(err => {
  console.error('Identity test runner failed:', err.message);
  process.exitCode = 1;
});
