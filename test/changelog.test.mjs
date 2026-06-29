/* Guards CHANGELOG.md: Keep-a-Changelog format, a non-empty [Unreleased]
   section, and no stale reference to the old APP_VERSION location.
   Usage: node test/changelog.test.mjs */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n); } };

const cl = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

check('starts with "# Changelog"', /^#\s+Changelog/m.test(cl));
check('references Keep a Changelog', /keepachangelog\.com/.test(cl));
check('points APP_VERSION at app.js (not the old index.html)', /APP_VERSION` constant in \[`app\.js`\]/.test(cl));
check('has an [Unreleased] section', /##\s*\[Unreleased\]/.test(cl));

/* The [Unreleased] section must carry at least one bullet so a release is never
   cut with an empty changelog. */
const unrel = cl.split(/##\s*\[Unreleased\]/)[1] || '';
const nextHeading = unrel.search(/\n##\s+/);
const body = nextHeading === -1 ? unrel : unrel.slice(0, nextHeading);
check('[Unreleased] has content (≥1 bullet)', /(^|\n)\s*[-*]\s+\S/.test(body));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
