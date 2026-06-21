/* data/*.json integrity test — Layer 2 (Data Quality).
   Every JSON file under data/ must parse. Catches a malformed registry or
   watcher-state commit before it ships. Usage: node test/data-json.test.js */
const fs = require('fs');
const path = require('path');

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
  try { JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
  catch (e) { ok = false; err = e.message; }
  check('data/' + f + ' parses' + (ok ? '' : ' (' + err + ')'), ok);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
