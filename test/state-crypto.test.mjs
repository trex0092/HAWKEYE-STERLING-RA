/* State-branch encryption guard (P30 exposure, encrypt-forward).

   The screen-state and screen-delta-state branches carry CURRENT
   screening-subject data in a public repository. These checks pin the
   encrypt-forward mechanism: the crypto primitives round-trip and
   authenticate (wrong key or any tamper fails closed), and both
   subject-data workflows decrypt state on overlay and encrypt it on
   persist whenever the STATE_ENCRYPTION_KEY secret is set.
   Usage: node test/state-crypto.test.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { encryptText, decryptText } from '../scripts/state-crypto.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

console.log('\n— state-branch encryption guard —\n');

const KEY = 'test-secret-key-not-a-real-one';
const doc = JSON.stringify({ subjects: [{ name: 'EXAMPLE PARTY', firstSeen: '2026-07-01' }], n: 3 });

const payload = encryptText(doc, KEY);
check('payload carries the HSSE1 magic and no plaintext',
  payload.startsWith('HSSE1.') && !payload.includes('EXAMPLE PARTY'));
check('round-trip restores the exact document', decryptText(payload, KEY) === doc);
check('two encryptions of the same document differ (fresh salt + nonce)',
  encryptText(doc, KEY) !== payload);
check('unicode survives the round-trip',
  decryptText(encryptText('šubjéct — بيانات', KEY), KEY) === 'šubjéct — بيانات');

check('a wrong key fails closed', throws(() => decryptText(payload, KEY + 'x')));
const parts = payload.split('.');
const blob = Buffer.from(parts[3], 'base64');
blob[0] ^= 0xff;
const tampered = [parts[0], parts[1], parts[2], blob.toString('base64')].join('.');
check('a tampered ciphertext fails closed', throws(() => decryptText(tampered, KEY)));
check('a non-HSSE1 payload is rejected', throws(() => decryptText('nonsense', KEY)));
check('an empty secret is rejected on encrypt and decrypt',
  throws(() => encryptText(doc, '')) && throws(() => decryptText(payload, '')));

/* workflow wiring: both subject-data branches must decrypt on overlay and
   encrypt on persist, with the secret plumbed into the steps */
for (const [wf, files] of [
  ['sanctions-screen.yml', ['data/sanctions-screen-state.json']],
  ['weekly-adverse-media.yml', ['data/screen-delta-state.json']],
  ['onboarding-screen.yml', ['data/screen-delta-state.json']],
]) {
  const body = readFileSync(join(ROOT, '.github/workflows', wf), 'utf8');
  check(`${wf} decrypts state on overlay (fetches the .enc variants too)`,
    body.includes('state-crypto.mjs decrypt')
    && body.includes('git checkout FETCH_HEAD -- "$f.enc"')
    && files.every(f => body.includes(f)));
  check(`${wf} encrypts state on persist when the key is set`,
    body.includes('state-crypto.mjs encrypt'));
  check(`${wf} plumbs the STATE_ENCRYPTION_KEY secret`,
    body.includes('STATE_ENCRYPTION_KEY: ${{ secrets.STATE_ENCRYPTION_KEY }}'));
  /* The repository is PUBLIC and the state carries customer/employee names:
     without the key the persist step must fail red, never publish plaintext
     (it used to ::warning:: and commit the plaintext file). */
  check(`${wf} refuses to persist plaintext without the key (fails red)`,
    /::error::STATE_ENCRYPTION_KEY is not set - refusing to publish[^\n]*\n\s*exit 1/.test(body)
    && !/::warning::.*PLAINTEXT/.test(body));
  check(`${wf} never stages the plaintext state file for the state branch`,
    !body.includes('git add -- "${state_files[@]}"')
    && !body.includes('files+=(data/sanctions-screen-state.json data/screening-cases-state.json)'));
  // the plaintext restore must target HEAD: the overlay step stages the
  // fetched branch copy into the index, so an index-relative restore
  // (`git checkout -- $f`) would re-commit the pre-encryption plaintext
  // blob alongside every .enc, forever
  check(`${wf} restores plaintext from HEAD, not the overlay-polluted index`,
    body.includes('git checkout HEAD -- "$f"') && !body.includes('git checkout -- "$f"'));
}


const sanctionsWf = readFileSync(join(ROOT, '.github/workflows/sanctions-screen.yml'), 'utf8');
check('sanctions-screen builds screen-state from the existing state branch tree, not the main checkout tree',
  /git read-tree "\$tip"/.test(sanctionsWf)
  && /git commit-tree "\$tree"/.test(sanctionsWf)
  && /refs\/heads\/screen-state/.test(sanctionsWf));
check('sanctions-screen does not force-push HEAD as the screen-state branch payload',
  !/HEAD:refs\/heads\/screen-state/.test(sanctionsWf));
check('sanctions-screen data-only state commit updates assurance badges and encrypted subject state',
  /data\/screening-assurance\.json/.test(sanctionsWf)
  && /data\/badges\/sanctions-operational\.svg/.test(sanctionsWf)
  && /data\/sanctions-screen-state\.json\.enc/.test(sanctionsWf)
  && /data\/screening-cases-state\.json\.enc/.test(sanctionsWf));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
