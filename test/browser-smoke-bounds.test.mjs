import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const chromeCommands = ci.split(/\r?\n/).filter(line => line.includes('google-chrome --headless=new'));
assert.equal(chromeCommands.length, 4, 'all four browser smoke commands must remain asserted');
for (const command of chromeCommands) {
  assert.match(command, /^\s*timeout --signal=TERM --kill-after=5s 75s google-chrome --headless=new/,
    'browser smoke must have a bounded process lifetime');
}
for (const marker of ['/tmp/dom.html', '/tmp/dom-motion.html', '/tmp/dom-console.html', '/tmp/dom-advisor.html']) {
  assert.ok(ci.includes('test -s ' + marker), 'empty browser DOM must still fail: ' + marker);
}
console.log('PASS: all four browser smoke commands are bounded and fail on missing DOM');
