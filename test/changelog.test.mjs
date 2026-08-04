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

/* Version sync — package.json, pyproject.toml and CITATION.cff must carry the
   APP_VERSION app.js declares (auto-release.yml cuts tags from app.js, so a
   drifting manifest would ship releases with mismatched metadata). */
const appVer = (readFileSync(new URL('../app.js', import.meta.url), 'utf8')
  .match(/APP_VERSION\s*=\s*'([0-9.]+)'/) || [])[1];
check('app.js declares APP_VERSION', !!appVer);

/* The released version must own a section. v3.7.1 and v3.7.2 shipped as tags
   with no `## [x.y.z]` heading and 4,000+ lines pooled under [Unreleased] for
   three weeks — nothing enforced the "move [Unreleased] into a dated version
   section on a bump" rule CONTRIBUTING states. Now the estate's declared
   version must have its own non-empty section, so a bump PR that forgets the
   changelog fails here instead of shipping sectionless again. */
const verHeadRe = new RegExp('^##\\s*\\[' + appVer.replace(/\./g, '\\.') + '\\]\\s*—\\s*\\d{4}-\\d{2}-\\d{2}', 'm');
check('the current APP_VERSION has its own dated section (## [' + appVer + '] — YYYY-MM-DD)', verHeadRe.test(cl));
const verBody = ((cl.split(verHeadRe)[1] || '').split(/\n##\s+/)[0] || '');
check('the [' + appVer + '] section is not empty', /(^|\n)\s*[-*#]\s*\S|\n\S/.test(verBody) && verBody.trim().length > 40);

/* [Unreleased] must carry at least one bullet — EXCEPT in the freshly-cut
   state, where everything just moved into the current version's section (which
   the checks above prove exists and is non-empty). A release can therefore
   still never be cut with an empty changelog; an empty [Unreleased] is only
   legal while the estate's declared version owns the newest content. */
const unrel = cl.split(/##\s*\[Unreleased\]/)[1] || '';
const nextHeading = unrel.search(/\n##\s+/);
const body = nextHeading === -1 ? unrel : unrel.slice(0, nextHeading);
check('[Unreleased] has content, or is freshly cut into the current version section',
  /(^|\n)\s*[-*]\s+\S/.test(body) || verHeadRe.test(cl));
check('package.json version matches APP_VERSION',
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version === appVer);
check('pyproject.toml version matches APP_VERSION',
  (readFileSync(new URL('../pyproject.toml', import.meta.url), 'utf8').match(/^version = "([0-9.]+)"/m) || [])[1] === appVer);
check('CITATION.cff version matches APP_VERSION',
  (readFileSync(new URL('../CITATION.cff', import.meta.url), 'utf8').match(/^version: "([0-9.]+)"/m) || [])[1] === appVer);
/* The MCP server announces its own version to clients; it was the fifth,
   unguarded copy (stuck at 3.7.2 while everything else moved). */
check('mcp_server.py SERVER_VERSION matches APP_VERSION',
  (readFileSync(new URL('../mcp_server.py', import.meta.url), 'utf8').match(/^SERVER_VERSION = "([0-9.]+)"/m) || [])[1] === appVer);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
