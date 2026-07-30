/* Obligation register test — step 3 of the GRC framework, kept honest.

   An obligation register rots in three ways: it cites an instrument that has
   been repealed, it points at a control that no longer exists, or it quietly
   claims "met" for work only a human can finish. This suite closes all three:

     1. schema — every row carries an instrument, an owner, controls, evidence
        and a status from the fixed set;
     2. reachability — every control/evidence path exists on disk, every
        watch_source is a real Regulatory Watch source, every calendar_duty is
        a real compliance-calendar duty;
     3. honesty — a "partial" row must name the open-actions register item that
        closes it, and that item must exist in the register;
     4. citation currency — no obligation may cite a repealed instrument as its
        operative basis (the guard that test/legal-citations.test.mjs applies to
        code surfaces, applied here to the obligations themselves).

   Usage: node test/obligations.test.mjs */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

console.log('\n— Obligation register test —\n');

let reg;
try { reg = JSON.parse(read('data/obligations.json')); }
catch (e) { console.log('FAIL  data/obligations.json parses (' + e.message + ')'); process.exit(1); }

/* ── 1. Schema ──────────────────────────────────────────────────────────── */
const STATUSES = ['met', 'partial', 'pending', 'monitored'];
const CATEGORIES = ['regulatory', 'voluntary'];
const REQUIRED = ['id', 'obligation', 'instrument', 'category', 'owner', 'controls', 'evidence', 'status', 'note'];

check('register has an obligations array', Array.isArray(reg.obligations) && reg.obligations.length > 0);
check('register declares an owner role', !!reg.owner_role);
check('register declares a review cadence', !!reg.review_cadence);
check('register states its citation policy', !!reg.citation_policy);
check('register documents what each status means', !!reg.status_meanings && STATUSES.every((s) => !!reg.status_meanings[s]));
check('register last_reviewed is a parseable date', Number.isFinite(Date.parse(reg.last_reviewed || '')));

const seen = new Set();
for (const [i, o] of reg.obligations.entries()) {
  const tag = o.id || ('#' + i);
  for (const f of REQUIRED) {
    check('obligation "' + tag + '" has "' + f + '"', o[f] !== undefined && o[f] !== null && String(o[f]).length > 0);
  }
  check('obligation "' + tag + '" id is unique', !seen.has(o.id));
  seen.add(o.id);
  check('obligation "' + tag + '" has a known status (' + o.status + ')', STATUSES.includes(o.status));
  check('obligation "' + tag + '" has a known category (' + o.category + ')', CATEGORIES.includes(o.category));
  check('obligation "' + tag + '" names at least one control', Array.isArray(o.controls) && o.controls.length > 0);
  check('obligation "' + tag + '" names at least one evidence artefact', Array.isArray(o.evidence) && o.evidence.length > 0);
}

/* ── 2. Reachability ────────────────────────────────────────────────────── */
for (const o of reg.obligations) {
  for (const p of [...(o.controls || []), ...(o.evidence || [])]) {
    check('obligation "' + o.id + '" path exists (' + p + ')', existsSync(join(ROOT, p)));
  }
}

const sources = JSON.parse(read('data/reg-sources.json'));
const sourceIds = new Set((Object.values(sources).find(Array.isArray) || []).map((s) => s.id));
check('parsed Regulatory Watch sources (' + sourceIds.size + ')', sourceIds.size > 0);
for (const o of reg.obligations) {
  if (o.watch_source === null || o.watch_source === undefined) {
    check('obligation "' + o.id + '" explains why no watch source applies', /outside this repository|voluntary standard|no watch/i.test(o.note || ''));
    continue;
  }
  check('obligation "' + o.id + '" watch_source is a real source (' + o.watch_source + ')', sourceIds.has(o.watch_source));
}

const calendar = JSON.parse(read('data/compliance-calendar.json'));
const dutyIds = new Set((Object.values(calendar).find(Array.isArray) || []).map((d) => d.id));
check('parsed compliance-calendar duties (' + dutyIds.size + ')', dutyIds.size > 0);
for (const o of reg.obligations.filter((x) => x.calendar_duty)) {
  check('obligation "' + o.id + '" calendar_duty exists (' + o.calendar_duty + ')', dutyIds.has(o.calendar_duty));
}

/* ── 3. Honesty: a partial row must name the human act that closes it ───── */
const register = read('docs/governance/open-actions-register.md');
const registerItems = new Set([...register.matchAll(/^\|\s*(\d+)\s*\|/gm)].map((m) => Number(m[1])));
check('parsed the open-actions register (' + registerItems.size + ' items)', registerItems.size > 0);
for (const o of reg.obligations) {
  if (o.status !== 'partial') continue;
  check('partial obligation "' + o.id + '" names an open-actions item', Number.isInteger(o.open_action));
  if (Number.isInteger(o.open_action)) {
    check('partial obligation "' + o.id + '" references a live register item (' + o.open_action + ')', registerItems.has(o.open_action));
  }
}
// A "met" row must not be waiting on anything.
for (const o of reg.obligations.filter((x) => x.status === 'met')) {
  check('met obligation "' + o.id + '" carries no open action', o.open_action === undefined);
}

/* ── 4. Citation currency ───────────────────────────────────────────────── */
const REPEALED = /No\.?\s*\(?20\)?\s+of\s+2018|20\/2018|No\.?\s*\(?10\)?\s+of\s+2019|10\/2019/;
for (const o of reg.obligations) {
  check('obligation "' + o.id + '" does not cite a repealed instrument as its basis', !REPEALED.test(o.instrument));
}

/* Coverage: the register must speak to every jurisdictional watch source that
   exists for a reason — a watched UAE supervisor with no obligation attached
   means the register has a hole. Non-UAE and sector sources are informational. */
const MUST_BE_COVERED = ['uae-moe', 'uae-fiu', 'uae-eocn'];
const covered = new Set(reg.obligations.map((o) => o.watch_source).filter(Boolean));
for (const s of MUST_BE_COVERED) check('watched supervisor "' + s + '" has at least one obligation attached', covered.has(s));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
