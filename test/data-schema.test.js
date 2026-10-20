/* data/*.json SCHEMA test — Layer 2 (Data Quality), stricter than the
   parse-only data-json.test.js. A malformed but still-valid-JSON state or
   sources file (a renamed key, a dropped `sources` array, a hash that is no
   longer a hash) would parse fine yet silently break sanctions screening. This
   asserts the *shape* of the files screening depends on. Usage:
   node test/data-schema.test.js */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}
const dir = path.join(__dirname, '..', 'data');
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHex64 = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const isStr = v => typeof v === 'string' && v.length > 0;

console.log('\n— data/*.json schema test —\n');

// ── data/sanctions-sources.json ───────────────────────────────────────────
try {
  const s = read('sanctions-sources.json');
  check('sanctions-sources: sources is a non-empty array', Array.isArray(s.sources) && s.sources.length > 0);
  const types = new Set(['csv', 'xml']);
  let allOk = true, ids = new Set();
  for (const src of s.sources || []) {
    if (!isStr(src.id) || !isStr(src.name) || !isStr(src.url) || !isStr(src.parser) || !types.has(src.type)) allOk = false;
    if (ids.has(src.id)) allOk = false;
    ids.add(src.id);
  }
  check('sanctions-sources: every source has id/name/url/parser and a csv|xml type', allOk);
  check('sanctions-sources: source ids are unique', ids.size === (s.sources || []).length);
  // The lists ongoing screening must cover (regression guard against a dropped list).
  for (const id of ['ofac-sdn', 'un-consolidated', 'uk-ofsi', 'eu-fsf']) {
    check('sanctions-sources: includes mandatory source ' + id, ids.has(id));
  }
} catch (e) { check('sanctions-sources.json schema (' + e.message + ')', false); }

// ── data/sanctions-state.json ─────────────────────────────────────────────
try {
  const st = read('sanctions-state.json');
  check('sanctions-state: updated is a date', isDate(st.updated));
  check('sanctions-state: sources is an object', st.sources && typeof st.sources === 'object' && !Array.isArray(st.sources));
  let allOk = true;
  for (const [id, e] of Object.entries(st.sources || {})) {
    if (!isHex64(e.hash)) { allOk = false; console.log('     bad hash for ' + id); }
    if (typeof e.bytes !== 'number') allOk = false;
    if (!isDate(e.checkedAt)) allOk = false;
    if ('count' in e && typeof e.count !== 'number') allOk = false;
  }
  check('sanctions-state: every source entry has a sha256 hash, numeric bytes and a checkedAt date', allOk);
} catch (e) { check('sanctions-state.json schema (' + e.message + ')', false); }

// ── data/sanctions-screen-state.json ──────────────────────────────────────
try {
  const sc = read('sanctions-screen-state.json');
  // Main contains only an empty bootstrap; runtime state is overlaid from the
  // encrypted state branch. Never invent a screening date to satisfy a test.
  const subjectsValid = sc.subjects && typeof sc.subjects === 'object' && !Array.isArray(sc.subjects);
  const emptyBootstrap = sc.updated === null && subjectsValid && Object.keys(sc.subjects).length === 0;
  check('screen-state: updated is a date, or null only for an empty bootstrap', isDate(sc.updated) || emptyBootstrap);
  check('screen-state: subjects is an object', subjectsValid);
  const bands = new Set(['critical', 'high', 'medium', 'low', 'clear', 'none']);
  let allOk = true;
  for (const [, s] of Object.entries(sc.subjects || {})) {
    if (!isStr(s.name)) allOk = false;
    if (!bands.has(s.band)) allOk = false;
    if (typeof s.topScore !== 'number') allOk = false;
    if (!Array.isArray(s.lists)) allOk = false;
    if (!isDate(s.firstSeen) || !isDate(s.lastSeen)) allOk = false;
  }
  check('screen-state: every subject has name/band/topScore/lists/firstSeen/lastSeen', allOk);
} catch (e) { check('sanctions-screen-state.json schema (' + e.message + ')', false); }

// ── data/eocn-local-terrorist-list.json (curated TFS list + its update SOP) ──
// The curated list's currency depends on a manual procedure, so the file's
// review metadata and the written SOP are controls in their own right: a
// missing lastReviewed, a count that disagrees with the entries, or a deleted
// SOP would silently unpick the maintenance regime.
try {
  const eocn = read('eocn-local-terrorist-list.json');
  check('eocn list: lastReviewed is a YYYY-MM-DD date', isDate(eocn.lastReviewed));
  check('eocn list: populated flag is a boolean', typeof eocn.populated === 'boolean');
  check('eocn list: entries is an array', Array.isArray(eocn.entries));
  if (eocn.populated) {
    check('eocn list: populated list has entries', (eocn.entries || []).length > 0);
    check('eocn list: count matches the number of entries (' + eocn.count + ' vs ' + (eocn.entries || []).length + ')',
      eocn.count === (eocn.entries || []).length);
  }
  let entriesOk = true;
  for (const e of eocn.entries || []) {
    if (typeof e === 'string') { if (!e.trim()) entriesOk = false; }
    else if (e && typeof e === 'object') { if (!isStr(e.name)) entriesOk = false; }
    else entriesOk = false;
  }
  check('eocn list: every entry is a name string or {name, aliases}', entriesOk);

  // Cabinet Resolution 63/2026 is carried by the 12-page EOCN publication
  // (sha256 83d46617a1f9cc8045fbec031a98aac568f5fd7e6f8d9670a5b53606dd87f858).
  // The 20 Oct 2026 upload is byte-identical to the already reconciled
  // September edition. A fresh filename alone is not evidence of a fresh list.
  // Protect all 16 listed natural persons and five entities from regression.
  const eocnNames = new Set((eocn.entries || []).flatMap(e =>
    typeof e === 'string' ? [e] : [e.name, ...(e.aliases || [])])
    .filter(x => typeof x === 'string').map(x => x.trim().toLowerCase()));
  const cabinet63Persons = [
    'Ali Mohammed Karneeb', 'Nasser Hassan Nasr',
    'Hassan Shehadeh Osman', 'Samer Hassan Fawaz',
    'Ahmed Mohammed Yazbek', 'Isa Hussein Qasir', 'Ibrahim Ali Daher',
    'Abbas Hassan Ghareeb', 'Emad Mohammed Bazzi', 'Ezzat Yousef Akr',
    'Wahid Mahmud Sbeiti', 'Mustafa Habib Harb',
    'Mohammed Suleiman Badir', 'Adel Mohammad Mansour',
    'Ali Ahmed Krisht', 'Nima Ahmad Jamil'
  ];
  const cabinet63Entities = [
    'Bayt Al-Mal ALMuslimeen', 'AL-Qard AL-Hassan Association',
    'AL Tasheelat Company', 'The Auditors for Accounting and Auditing',
    'AL-Khobara For Accounting, Auditing, and studies'
  ];
  check('eocn list: all 16 Cabinet Resolution 63/2026 persons retained',
    cabinet63Persons.every(name => eocnNames.has(name.toLowerCase())));
  check('eocn list: all five Cabinet Resolution 63/2026 entities retained',
    cabinet63Entities.every(name => eocnNames.has(name.toLowerCase())));
  // Delisted parties (last PDF section) are NOT active TFS designations.
  const delistedEntities = [
    'CANVAS : CENTER FOR APPLIED NONVIOLENT ACTION AND STRATEGIES',
    'QATAR VOLUNTEER CENTER', 'DOHA APPLE', 'QATAR CHARITY',
    'EID  CHARITY',
    'SHEIKH THANI BIN ABDULLAH FOUNDATION FOR HUMANITARIAN SERVICE',
    'AL-BALAGH CHARITABLE FOUNDATION', 'AL-IHSAN CHARITABLE SOCIETY'
  ];
  check('eocn list: eight published delisted entities remain excluded',
    delistedEntities.every(name => !eocnNames.has(name.trim().toLowerCase())));

  const delistedPersons = [
    'MOHAMMAD SAEED BIN HELWAN AL-SEQATRI',
    'KHALIFA BIN MOHAMMAD AL-RABBAN',
    'ABDULLAH BIN KHALID BIN HAMAD BIN ABDULLAH AL-THANI',
    'ABDUL RAHIM AHMAD AL-HARAM', 'MUBARAK MOHAMMAD AL-AJJI',
    'JABIR BIN NASSER AL-MARRI', 'MOHAMMED JASSIM AL-SULAITI',
    'ALI BIN ABDALLAH AL-SUWAIDI', 'HASHIM SALEH ABDULLAH AL-AWADHY',
    'HAMAD ABDULLAH AL-FUTTAIS AL-MARRI',
    'KHALID SAEED AL-BOUNEIN', 'SHAQER JUMMAH AL-SHAHWANI',
    'SALEH BIN AHMED AL-GHANIM AL-KUWARI',
    'MOHAMMED SULAIMAN HAIDAR MOHAMMED AL-HAYDAR',
    'HAYDER HABEEB ALI', 'BASIM YOUSUF HUSSEIN ALSHAGHANBI',
    'SHARIF AHMED SHARIF BA ALAWI',
    'MANOJ SABHARWAL OM PRAKASH', 'ABDO ABDULLAH DAEL AHMED'
  ];
  check('eocn list: all 19 published delisted persons remain excluded',
    delistedPersons.every(name => !eocnNames.has(name.toLowerCase())));



  const sopPath = path.join(__dirname, '..', 'docs', 'aims', 'eocn-list-update-sop.md');
  check('eocn list: the written update SOP exists (docs/aims/eocn-list-update-sop.md)', fs.existsSync(sopPath));
  if (fs.existsSync(sopPath)) {
    const sop = fs.readFileSync(sopPath, 'utf8');
    for (const section of ['Update triggers', 'Update procedure', 'Full reconciliation procedure', 'Evidence log']) {
      check('eocn SOP: has section "' + section + '"', sop.includes(section));
    }
    check('eocn SOP: references the data file it governs', sop.includes('eocn-local-terrorist-list.json'));
  }
} catch (e) { check('eocn-local-terrorist-list.json schema (' + e.message + ')', false); }

// ── data/internal-watchlist.json (optional firm-internal list, checklist A4) ──
// Screened by BOTH engines in addition to the official lists. Optional by
// design: empty entries is a valid state and must never degrade coverage —
// which only holds if the sanctions-extra source entry keeps `optional: true`.
// These checks pin the file shape AND that wiring.
try {
  const iw = read('internal-watchlist.json');
  check('internal watchlist: lastReviewed is a YYYY-MM-DD date', isDate(iw.lastReviewed));
  check('internal watchlist: populated flag is a boolean', typeof iw.populated === 'boolean');
  check('internal watchlist: entries is an array', Array.isArray(iw.entries));
  check('internal watchlist: count matches the number of entries (' + iw.count + ' vs ' + (iw.entries || []).length + ')',
    iw.count === (iw.entries || []).length);
  check('internal watchlist: populated flag agrees with entries', iw.populated === ((iw.entries || []).length > 0));
  let iwOk = true;
  for (const e of iw.entries || []) {
    if (typeof e === 'string') { if (!e.trim()) iwOk = false; }
    else if (e && typeof e === 'object') { if (!isStr(e.name)) iwOk = false; }
    else iwOk = false;
  }
  check('internal watchlist: every entry is a name string or {name, aliases}', iwOk);

  const extra = read('sanctions-extra.json');
  const src = ((extra || {}).sources || []).find(s => s && s.id === 'internal-watchlist');
  check('internal watchlist: wired as a sanctions-extra source', !!src);
  if (src) {
    check('internal watchlist source: enabled and points at the file',
      src.enabled === true && src.file === 'data/internal-watchlist.json' && src.parser === 'curated');
    check('internal watchlist source: optional flag set (empty must never degrade coverage)',
      src.optional === true);
  }

  const sop2 = fs.readFileSync(path.join(__dirname, '..', 'docs', 'aims', 'eocn-list-update-sop.md'), 'utf8');
  check('internal watchlist: covered by the update SOP', sop2.includes('internal-watchlist.json'));
} catch (e) { check('internal-watchlist.json schema (' + e.message + ')', false); }

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
