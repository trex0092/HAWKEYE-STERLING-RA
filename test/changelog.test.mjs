/* Guards CHANGELOG.md: Keep-a-Changelog format, a non-empty [Unreleased]
   section, and no stale reference to the old APP_VERSION location.
   Usage: node test/changelog.test.mjs */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n); } };

const cl = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

check('starts with "# Changelog"', /^#\s+Changelog/m.test(cl));
check('references Keep a Changelog', cl.includes('Keep a Changelog'));
check('points APP_VERSION at app.js (not the old index.html)', /APP_VERSION` constant in \[`app\.js`\]/.test(cl));
check('has an [Unreleased] section', /##\s*\[Unreleased\]/.test(cl));

/* The [Unreleased] section must carry at least one bullet so a release is never
   cut with an empty changelog. */
const unrel = cl.split(/##\s*\[Unreleased\]/)[1] || '';
const nextHeading = unrel.search(/\n##\s+/);
const body = nextHeading === -1 ? unrel : unrel.slice(0, nextHeading);
check('[Unreleased] has content (≥1 bullet)', /(^|\n)\s*[-*]\s+\S/.test(body));

/* Version sync — package.json, pyproject.toml and CITATION.cff must carry the
   APP_VERSION app.js declares (auto-release.yml cuts tags from app.js, so a
   drifting manifest would ship releases with mismatched metadata). */
const appVer = (readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  .match(/APP_VERSION\s*=\s*'([0-9.]+)'/) || [])[1];
check('app.js declares APP_VERSION', !!appVer);
check('package.json version matches APP_VERSION',
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version === appVer);
check('pyproject.toml version matches APP_VERSION',
  (readFileSync(new URL('../pyproject.toml', import.meta.url), 'utf8').match(/^version = "([0-9.]+)"/m) || [])[1] === appVer);
check('CITATION.cff version matches APP_VERSION',
  (readFileSync(new URL('../CITATION.cff', import.meta.url), 'utf8').match(/^version: "([0-9.]+)"/m) || [])[1] === appVer);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
