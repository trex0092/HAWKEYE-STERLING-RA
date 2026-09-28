/* Guards the sanctions source registry against the silent-failure classes that
   each reached production and surfaced ONLY as a generic "coverage degraded"
   note in a run summary (2026-09-27 audit of the daily sanctions-screen run):

     1. a curated source that points at its in-repo file with `url` instead of
        `file` (fetchListBody throws "Invalid URL" - ma-cnasnu, bh-gazette);
     2. a curated file whose entries the curated parser cannot read, so the
        source loads zero names (mu-nssec used surname/otherNames, but
        parseCuratedList reads only name/aliases);
     3. a source whose host is missing from sanctions-screen.yml's egress
        allowlist (policy is `block`, so the fetch fails with "fetch failed" -
        uk-ofsi after the 2026-09-22 FCDO repoint, nz-mfat-russia);
     4. a retired OpenSanctions `artifacts/<name>/latest/` URL (HTTP 404);
     5. two ENABLED sources sharing one id (the loader does not dedupe, so the
        list is fetched twice).

   Fully offline: reads only the registry, the in-repo curated files and the
   workflow YAML, so it can run on every PR without touching any network.
   Usage: node test/sanctions-registry-integrity.test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { parseList } from '../scripts/sanctions-match.mjs';

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n); } };
const root = (p) => new URL('../' + p, import.meta.url);
const read = (p) => readFileSync(root(p), 'utf8');

const core = JSON.parse(read('data/sanctions-sources.json')).sources || [];
const extra = JSON.parse(read('data/sanctions-extra.json')).sources || [];
/* Same enablement rule the loader applies: anything not explicitly disabled. */
const enabled = [...core, ...extra].filter((s) => s && s.enabled !== false && (s.url || s.file));
check('registry has enabled sources', enabled.length > 20);

/* Egress allowlist of the one workflow that loads this registry. */
const wf = read('.github/workflows/sanctions-screen.yml');
const block = wf.match(/allowed-endpoints:\s*>\s*\n((?:[ \t]+[\w.*-]+:\d+[ \t]*\n)+)/);
check('sanctions-screen.yml exposes a parseable allowed-endpoints block', !!block);
const allowed = new Set(block ? block[1].split(/\s+/).filter(Boolean) : []);

for (const s of enabled) {
  const isCurated = s.type === 'curated' || String(s.parser || '').toLowerCase() === 'curated';
  const remote = typeof s.url === 'string' && /^https?:\/\//i.test(s.url);

  if (isCurated) {
    check(s.id + ': curated source uses `file`, not a relative `url`', typeof s.file === 'string' && !s.url);
    if (typeof s.file === 'string') {
      check(s.id + ': curated file exists (' + s.file + ')', existsSync(root(s.file)));
      /* An OPTIONAL source (the firm-internal watchlist) may legitimately be
         empty - the loader reports it informationally and never degrades. */
      if (existsSync(root(s.file)) && !s.optional) {
        const names = parseList(s, read(s.file));
        const floor = Number.isFinite(s.minNames) ? s.minNames : 1;
        check(s.id + ': curated file yields >= minNames (' + names.length + ' >= ' + floor + ')', names.length >= floor);
      }
    }
    continue;
  }

  check(s.id + ': non-curated source has an absolute http(s) url (or a file)', remote || typeof s.file === 'string');
  if (remote) {
    const u = new URL(s.url);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    check(s.id + ': host ' + u.hostname + ':' + port + ' is on the sanctions-screen.yml egress allowlist', allowed.has(u.hostname + ':' + port));
    check(s.id + ': not a retired OpenSanctions artifacts/ URL', !/data\.opensanctions\.org\/artifacts\//.test(s.url));
  }
}

const seen = new Map();
for (const s of enabled) seen.set(s.id, (seen.get(s.id) || 0) + 1);
const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
check('no two ENABLED sources share an id' + (dupes.length ? ' (dupes: ' + dupes.join(', ') + ')' : ''), dupes.length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
