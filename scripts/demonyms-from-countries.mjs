/* Demonym table — generated from mledoze/countries, never hand-maintained.

   kyc.nationality_country() turns a recorded nationality written as a
   demonym ("Pakistani", "Emirati") into the country name the designation
   lists carry ("Pakistan", "United Arab Emirates") so the R.10 identity step
   compares like with like. The hand-written map in kyc.py (_DEMONYMS) covers
   the nationalities seen in the customer base so far and stays authoritative;
   data/demonyms.json extends it to every country in the mledoze/countries
   dataset (ODbL-1.0), so a nationality the hand map never met is still
   compared as a country instead of silently differing on the adjective.

   Fail-safe either way: an unmapped nationality is kept as written, which
   KEEPS the candidate (identity exclusion needs both axes to disagree), so a
   missing or ambiguous demonym can never hide a match.

   The source is pinned to one upstream commit and its SHA-256; the script
   refuses to write when the download does not match the pin, so a changed
   upstream file is a deliberate re-pin in a reviewed pull request, never a
   silent drift.

   Usage:
     node scripts/demonyms-from-countries.mjs --write            # fetch the pinned source and refresh data/demonyms.json
     node scripts/demonyms-from-countries.mjs --write --source P # same, from a local copy of countries.json (hash still checked)
     node scripts/demonyms-from-countries.mjs --check --source P # exit 1 if data/demonyms.json differs from a regeneration */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_FILE = 'data/demonyms.json';

/* Upstream pin. Re-pin only in a reviewed pull request: update all three. */
export const SOURCE = {
  repository: 'mledoze/countries',
  commit: 'fa4f62182d19ff4f8b325cde6387c9cd9d80955a',
  file: 'countries.json',
  sha256: '0d92fb23b43ae080bd439f5dc5d61a8845395fdd0af1479b433c59fe079bd6fd',
  licence: 'ODbL-1.0',
};
export const SOURCE_URL = `https://raw.githubusercontent.com/${SOURCE.repository}/${SOURCE.commit}/${SOURCE.file}`;
export const LICENCE_URL = `https://github.com/${SOURCE.repository}/blob/${SOURCE.commit}/LICENSE`;

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/* Build the table from the parsed countries.json array.
   Rule: every English demonym (masculine and feminine forms) maps to the
   country's common name. A demonym shared by several countries is mapped only
   when exactly one of them is an independent UN member (so "French" is France,
   not the French Southern and Antarctic Lands); otherwise it is recorded under
   `ambiguous` and left unmapped. */
export function buildTable(countries) {
  const byDemonym = new Map();
  for (const c of countries) {
    const eng = (c.demonyms && c.demonyms.eng) || {};
    const common = c.name && c.name.common;
    if (!common) continue;
    for (const form of ['m', 'f']) {
      const v = String(eng[form] || '').trim().toLowerCase();
      if (!v) continue;
      if (!byDemonym.has(v)) byDemonym.set(v, new Map());
      byDemonym.get(v).set(common, c);
    }
  }
  const demonyms = {};
  const ambiguous = {};
  for (const [dem, candidates] of byDemonym) {
    if (candidates.size === 1) {
      demonyms[dem] = [...candidates.keys()][0];
      continue;
    }
    const sovereign = [...candidates.values()].filter(c => c.independent === true && c.unMember === true);
    if (sovereign.length === 1) demonyms[dem] = sovereign[0].name.common;
    else ambiguous[dem] = [...candidates.keys()].sort();
  }
  const sortObj = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  return { demonyms: sortObj(demonyms), ambiguous: sortObj(ambiguous) };
}

export function render(countries, generated) {
  const { demonyms, ambiguous } = buildTable(countries);
  return JSON.stringify({
    _meta: {
      description: 'English demonym -> common country name, for kyc.nationality_country(). Generated; do not edit by hand.',
      source: SOURCE.repository,
      sourceUrl: `https://github.com/${SOURCE.repository}`,
      commit: SOURCE.commit,
      sourceFile: SOURCE.file,
      sourceSha256: SOURCE.sha256,
      licence: SOURCE.licence,
      licenceUrl: LICENCE_URL,
      attribution: 'Contains data from the mledoze/countries dataset (https://github.com/mledoze/countries), made available under the Open Database License (ODbL) 1.0. This file is an extract of that database and is distributed under the same licence, with this attribution.',
      rule: 'Every English demonym (masculine and feminine) maps to the common country name. A demonym shared by several countries is mapped only when exactly one of them is an independent UN member; otherwise it is listed under ambiguous and left unmapped. kyc.py consults its hand-written map first, then this table; an unmapped value is kept as written, which keeps the candidate.',
      generatedBy: 'scripts/demonyms-from-countries.mjs',
      generated,
      counts: { countries: countries.length, demonyms: Object.keys(demonyms).length, ambiguous: Object.keys(ambiguous).length },
    },
    demonyms,
    ambiguous,
  }, null, 2) + '\n';
}

async function loadSource(localPath) {
  let buf;
  if (localPath) {
    buf = readFileSync(localPath);
  } else {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${SOURCE_URL}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  const got = sha256(buf);
  if (got !== SOURCE.sha256) {
    throw new Error(`source SHA-256 ${got} does not match the pin ${SOURCE.sha256}; re-pin deliberately (commit, sha256) in a reviewed pull request`);
  }
  return JSON.parse(buf.toString('utf8'));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--source');
  const localPath = idx >= 0 ? args[idx + 1] : null;
  const outPath = join(ROOT, OUT_FILE);
  const countries = await loadSource(localPath);
  if (args.includes('--check')) {
    let current = null;
    try { current = JSON.parse(readFileSync(outPath, 'utf8')); } catch { /* missing file is drift */ }
    const regenerated = JSON.parse(render(countries, current && current._meta ? current._meta.generated : ''));
    const same = current && JSON.stringify(current.demonyms) === JSON.stringify(regenerated.demonyms)
      && JSON.stringify(current.ambiguous) === JSON.stringify(regenerated.ambiguous)
      && current._meta && current._meta.commit === SOURCE.commit && current._meta.sourceSha256 === SOURCE.sha256;
    if (!same) {
      console.error(`${OUT_FILE} drifted from the pinned source; run: node scripts/demonyms-from-countries.mjs --write`);
      process.exit(1);
    }
    console.log(`${OUT_FILE} matches the pinned source (${Object.keys(regenerated.demonyms).length} demonyms, ${Object.keys(regenerated.ambiguous).length} ambiguous).`);
  } else if (args.includes('--write')) {
    const generated = new Date().toISOString().slice(0, 10);
    writeFileSync(outPath, render(countries, generated));
    const t = buildTable(countries);
    console.log(`wrote ${OUT_FILE}: ${Object.keys(t.demonyms).length} demonyms, ${Object.keys(t.ambiguous).length} ambiguous, source ${SOURCE.repository}@${SOURCE.commit.slice(0, 7)}`);
  } else {
    const t = buildTable(countries);
    console.log(JSON.stringify({ demonyms: Object.keys(t.demonyms).length, ambiguous: t.ambiguous }, null, 2));
  }
}
