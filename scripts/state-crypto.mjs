/* State-branch encryption (P30 exposure, encrypt-forward mechanism).

   The workflow state branches carry CURRENT screening-subject data (delta
   fingerprints, standing-case state, adverse-media evidence) in a public
   repository. This helper lets the state-persisting workflows commit that
   data ENCRYPTED: AES-256-GCM with a key derived (scrypt) from the
   STATE_ENCRYPTION_KEY repository secret. Forward-only by design: it
   protects every commit made after the secret is set; already-pushed
   history is the standing P30 decision for the repository owner (purge or
   recreate the state branches).

   Behavior contract with the workflows:
     encrypt  - with STATE_ENCRYPTION_KEY set, writes <file>.enc beside each
                input and reports it; without the key it exits 0 quietly so
                un-keyed repositories keep today's plaintext behavior (the
                workflow prints its own loud warning).
     decrypt  - with the key set, restores each <file> from <file>.enc;
                without the key, decrypt of an existing .enc FAILS (exit 1):
                proceeding without state would silently re-alert everything
                and break case continuity.
   File format: "HSSE1" magic + base64(salt).base64(nonce).base64(ct+tag),
   one line, so gitleaks/semgrep never see plaintext subject data.

   Usage: node scripts/state-crypto.mjs encrypt|decrypt <file> [file...]
   Pure helpers (encryptText/decryptText) are exported for offline tests. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const MAGIC = 'HSSE1';

function deriveKey(secret, salt) {
  return scryptSync(String(secret), salt, 32);
}

export function encryptText(plaintext, secret) {
  if (!secret) throw new Error('STATE_ENCRYPTION_KEY is empty');
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret, salt), nonce);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final(), cipher.getAuthTag()]);
  return [MAGIC, salt.toString('base64'), nonce.toString('base64'), ct.toString('base64')].join('.');
}

export function decryptText(payload, secret) {
  if (!secret) throw new Error('STATE_ENCRYPTION_KEY is empty');
  const parts = String(payload).trim().split('.');
  if (parts.length !== 4 || parts[0] !== MAGIC) throw new Error('not a ' + MAGIC + ' payload');
  const salt = Buffer.from(parts[1], 'base64');
  const nonce = Buffer.from(parts[2], 'base64');
  const blob = Buffer.from(parts[3], 'base64');
  if (blob.length < 17) throw new Error('payload too short');
  const ct = blob.subarray(0, blob.length - 16);
  const tag = blob.subarray(blob.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret, salt), nonce);
  decipher.setAuthTag(tag);
  // GCM authenticates: a wrong key or any ciphertext tamper throws here.
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

function main() {
  const [mode, ...files] = process.argv.slice(2);
  const key = process.env.STATE_ENCRYPTION_KEY || '';
  if (!['encrypt', 'decrypt'].includes(mode) || files.length === 0) {
    console.error('usage: node scripts/state-crypto.mjs encrypt|decrypt <file> [file...]');
    process.exit(2);
  }
  if (mode === 'encrypt') {
    if (!key) {
      console.log('state-crypto: STATE_ENCRYPTION_KEY not set - leaving state in plaintext');
      return;
    }
    for (const f of files) {
      if (!existsSync(f)) { console.log('state-crypto: skip missing ' + f); continue; }
      writeFileSync(f + '.enc', encryptText(readFileSync(f, 'utf8'), key) + '\n');
      console.log('state-crypto: encrypted ' + f + ' -> ' + f + '.enc');
    }
    return;
  }
  let failed = false;
  for (const f of files) {
    const enc = f + '.enc';
    if (!existsSync(enc)) { console.log('state-crypto: no ' + enc + ' - keeping ' + f + ' as-is'); continue; }
    if (!key) {
      console.error('state-crypto: ' + enc + ' exists but STATE_ENCRYPTION_KEY is not set - '
        + 'cannot read the encrypted state; refusing to continue with amnesia');
      failed = true;
      continue;
    }
    try {
      writeFileSync(f, decryptText(readFileSync(enc, 'utf8'), key));
      console.log('state-crypto: decrypted ' + enc + ' -> ' + f);
    } catch (e) {
      console.error('state-crypto: FAILED to decrypt ' + enc + ' (' + e.message + ') - wrong key or tampered state');
      failed = true;
    }
  }
  if (failed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
