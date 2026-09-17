/* data/*.json integrity test — Layer 2 (Data Quality).
   Every JSON file under data/ must parse. Catches a malformed registry or
   watcher-state commit before it ships. Usage: node test/data-json.test.js */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— data/*.json integrity test —\n');

const dir = path.join(__dirname, '..', 'data');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
check('data/ contains JSON files', files.length > 0);

for (const f of files) {
  let ok = true, err = '';
  try {
    // Some registries are intentionally shipped gzip-compressed to keep repo
    // size sane (e.g. data/pep-worldwide.json, ~92MB plain / ~20MB gzipped).
    // scripts/pep-worldwide.mjs's own reader already accepts both formats
    // transparently (gzip magic 1f 8b, else plain JSON) -- this integrity
    // check follows the same contract instead of assuming every data/*.json
    // file is plain text.
    const buf = fs.readFileSync(path.join(dir, f));
    const text = (buf[0] === 0x1f && buf[1] === 0x8b) ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    JSON.parse(text);
  }
  catch (e) { ok = false; err = e.message; }
  check('data/' + f + ' parses' + (ok ? '' : ' (' + err + ')'), ok);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
