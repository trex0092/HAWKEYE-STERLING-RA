/* Relative-link guard for the documentation estate.

   The existing link checker (scripts/link-check.mjs, test/link-check.test.mjs)
   probes EXTERNAL urls only — its extractor is /https?:\/\/[^\s"'<>)\]}]+/g. A
   relative cross-reference like [`../aims/foo.md`](../aims/foo.md) is invisible
   to it, so a governance document could point at a file that does not exist and
   nothing would say so. That is the likeliest error in a pack this
   cross-referenced: 1,138 relative links across 178 markdown files, and the
   registers are deliberately built out of links to their evidence.

   This suite resolves every one of them against disk. It found ZERO breakage
   when it was written — that is the point. It is preventive, not remedial: it
   pins a property the estate already has, so the next doc PR cannot quietly
   lose it.

   Deliberately NOT checked: `#anchor` fragments. GitHub's heading-slug rules
   (punctuation stripping, emoji, duplicate-heading suffixes) are fiddly enough
   that an anchor checker would produce false failures, and a test that cries
   wolf gets deleted. Fragments are stripped before resolution; the FILE half of
   a `file.md#section` link is still verified.

   Usage: node test/doc-links.test.mjs */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };

console.log('\n— Documentation relative-link guard —\n');

/* Every .md under docs/, plus the root-level documents (README, CHANGELOG,
   CONTRIBUTING, SECURITY, SUPPORT, CODE_OF_CONDUCT) — those carry 153 relative
   links of their own, including the whole README project-structure section. */
const mdFiles = [];
(function walk(rel) {
  for (const entry of readdirSync(join(ROOT, rel)).sort()) {
    const child = join(rel, entry);
    if (statSync(join(ROOT, child)).isDirectory()) walk(child);
    else if (entry.endsWith('.md')) mdFiles.push(child);
  }
})('docs');
for (const entry of readdirSync(ROOT).sort()) {
  if (entry.endsWith('.md') && statSync(join(ROOT, entry)).isFile()) mdFiles.push(entry);
}

check('found markdown documents to check (' + mdFiles.length + ')', mdFiles.length > 100);

/* [label](target) and [label](target "title"). Bare <https://…> autolinks and
   reference-style definitions are external-only in this repo and are left to
   the existing external checker. */
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
/* Schemes that are not a path on disk. */
const NOT_A_PATH = /^(https?:|mailto:|tel:|data:|#)/i;

let total = 0;
const broken = [];
for (const file of mdFiles) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  for (const m of src.matchAll(LINK)) {
    const raw = m[1];
    if (NOT_A_PATH.test(raw)) continue;
    /* Strip the fragment and any query before resolving — `foo.md#section`
       must resolve to foo.md, and the fragment is out of scope (see header). */
    const target = raw.split('#')[0].split('?')[0];
    if (!target) continue;   // a bare "#frag" that survived the scheme test
    total++;
    /* decodeURIComponent so a link written with %20 for a space resolves. */
    let onDisk;
    try { onDisk = resolve(ROOT, dirname(file), decodeURIComponent(target)); }
    catch { onDisk = resolve(ROOT, dirname(file), target); }   // malformed %-escape
    if (!existsSync(onDisk)) broken.push(`${file} → ${raw}`);
  }
}

check('extracted a meaningful number of relative links (' + total + ')', total > 500);
check(
  `every relative link resolves on disk (${total} links across ${mdFiles.length} documents)`,
  broken.length === 0
);
if (broken.length) {
  console.log('      ' + broken.length + ' broken:');
  for (const b of broken.slice(0, 40)) console.log('        ' + b);
  if (broken.length > 40) console.log('        …and ' + (broken.length - 40) + ' more');
}

/* Completeness of the documentation map (docs/README.md). The map called
   itself "the way in" while it missed two packs (runbooks/, generated/) and a
   standalone document, and its hand-written counts ("12 packs plus 9
   standalone", "~195 documents") were all wrong against 14 folders, 12
   standalone documents and 205 files. A link that resolves says nothing about
   a file nobody linked, so this pins the other direction: every immediate
   subfolder of docs/ and every top-level docs/*.md must be a link target on
   the map, and a pack that has its own README is linked through that README. */
console.log('\n— Documentation map completeness (docs/README.md) —\n');
{
  const map = readFileSync(join(ROOT, 'docs', 'README.md'), 'utf8');
  const targets = new Set();
  for (const m of map.matchAll(LINK)) {
    if (NOT_A_PATH.test(m[1])) continue;
    targets.add(m[1].split('#')[0].split('?')[0]);
  }
  const entries = readdirSync(join(ROOT, 'docs')).sort();
  const folders = entries.filter(e => statSync(join(ROOT, 'docs', e)).isDirectory());
  const standalone = entries.filter(e => e.endsWith('.md') && e !== 'README.md');
  check('docs/ has packs and standalone documents to map (' + folders.length + ' + ' + standalone.length + ')',
    folders.length > 5 && standalone.length > 5);

  const unlistedFolders = folders.filter(f => ![...targets].some(t => t.startsWith(f + '/')));
  check('every docs/ subfolder is linked from the map (' + folders.length + ' folders)', unlistedFolders.length === 0);
  for (const f of unlistedFolders) console.log('        not on the map: docs/' + f + '/');

  const unlistedDocs = standalone.filter(f => !targets.has(f));
  check('every top-level docs/*.md is linked from the map (' + standalone.length + ' documents)', unlistedDocs.length === 0);
  for (const f of unlistedDocs) console.log('        not on the map: docs/' + f);

  const withIndex = folders.filter(f => existsSync(join(ROOT, 'docs', f, 'README.md')));
  const bypassed = withIndex.filter(f => !targets.has(f + '/README.md'));
  check('a pack with its own README is linked through it (' + withIndex.length + ' packs)', bypassed.length === 0);
  for (const f of bypassed) console.log('        map does not link docs/' + f + '/README.md');
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
