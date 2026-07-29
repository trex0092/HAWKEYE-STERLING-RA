/* Policy register test — core component 4 (policy management).

   Policies existed and were indexed; what was missing was the record of which
   ones are actually approved, by whom, and when they fall due. This suite keeps
   that record true:

     1. schema — every instrument carries a type, an owner, an approver, a
        status from the fixed set, and a review cadence;
     2. reachability + ownership — the document exists AND declares its own
        owner, so ownership survives someone reading the doc rather than the
        register;
     3. approval honesty — an approval date must appear in the document itself;
        a draft instrument may not assert a next-review date, and must name the
        open-actions item that will approve it;
     4. anti-shadow-policy — every policy/procedure/charter/runbook/SOP under
        docs/ is either registered or explicitly excluded with a reason.

   Usage: node test/policies.test.mjs */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

console.log('\n— Policy register test —\n');

let reg;
try { reg = JSON.parse(read('data/policies.json')); }
catch (e) { console.log('FAIL  data/policies.json parses (' + e.message + ')'); process.exit(1); }

/* ── 1. Schema ──────────────────────────────────────────────────────────── */
const TYPES = ['policy', 'standard', 'procedure', 'runbook', 'charter', 'statement'];
const STATUSES = ['in-force', 'draft', 'pending-adoption'];
const REQUIRED = ['id', 'title', 'path', 'type', 'owner', 'approver', 'status', 'version', 'review_cadence_months', 'note'];

check('register has instruments', Array.isArray(reg.instruments) && reg.instruments.length > 0);
check('register declares an owner role', !!reg.owner_role);
check('register documents what each status means', !!reg.status_meanings && STATUSES.every((s) => !!reg.status_meanings[s]));
check('register has a shadow-policy note', !!reg.shadow_policy_note);
check('register last_reviewed is a parseable date', Number.isFinite(Date.parse(reg.last_reviewed || '')));

const seen = new Set();
for (const [i, p] of reg.instruments.entries()) {
  const tag = p.id || ('#' + i);
  for (const f of REQUIRED) {
    check('instrument "' + tag + '" has "' + f + '"', p[f] !== undefined && p[f] !== null && String(p[f]).length > 0);
  }
  check('instrument "' + tag + '" id is unique', !seen.has(p.id));
  seen.add(p.id);
  check('instrument "' + tag + '" has a known type (' + p.type + ')', TYPES.includes(p.type));
  check('instrument "' + tag + '" has a known status (' + p.status + ')', STATUSES.includes(p.status));
  check('instrument "' + tag + '" states a review cadence in months', Number.isInteger(p.review_cadence_months) && p.review_cadence_months > 0);
}

/* ── 2. Reachability + ownership declared in the document itself ─────────── */
for (const p of reg.instruments) {
  const there = existsSync(join(ROOT, p.path));
  check('instrument "' + p.id + '" document exists (' + p.path + ')', there);
  if (!there) continue;
  const doc = read(p.path);
  check('instrument "' + p.id + '" declares an owner in its own header', /\*\*Owner[:*]/i.test(doc.slice(0, 1200)));
}

/* ── 3. Approval honesty ─────────────────────────────────────────────────── */
for (const p of reg.instruments) {
  if (p.approved_on) {
    check('approved instrument "' + p.id + '" approval date is parseable', Number.isFinite(Date.parse(p.approved_on)));
    /* The claim must be evidenced by the document, in ISO or long form. */
    const doc = existsSync(join(ROOT, p.path)) ? read(p.path) : '';
    const iso = p.approved_on;
    const d = new Date(iso + 'T00:00:00Z');
    const long = d.getUTCDate() + ' ' + d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }) + ' ' + d.getUTCFullYear();
    check('approved instrument "' + p.id + '" approval date appears in the document (' + iso + ')',
      doc.includes(iso) || doc.includes(long));
    check('approved instrument "' + p.id + '" has a next review date', !!p.next_review);
  } else {
    check('unapproved instrument "' + p.id + '" explains why there is no approval date',
      typeof p.approval_note === 'string' && p.approval_note.length > 20);
  }
  if (p.status === 'draft') {
    check('draft instrument "' + p.id + '" asserts no next-review date', p.next_review === null);
    check('draft instrument "' + p.id + '" names the open action that approves it', Number.isInteger(p.open_action));
  }
  if (p.next_review) {
    check('instrument "' + p.id + '" next_review is a parseable date', Number.isFinite(Date.parse(p.next_review)));
  }
}

/* Referenced open actions and calendar duties must be real. */
const register = read('docs/governance/open-actions-register.md');
const items = new Set([...register.matchAll(/^\|\s*(\d+)\s*\|/gm)].map((m) => Number(m[1])));
for (const p of reg.instruments.filter((x) => Number.isInteger(x.open_action))) {
  check('instrument "' + p.id + '" references a live open-actions item (' + p.open_action + ')', items.has(p.open_action));
}
const calendar = JSON.parse(read('data/compliance-calendar.json'));
const duties = new Set((Object.values(calendar).find(Array.isArray) || []).map((d) => d.id));
for (const p of reg.instruments.filter((x) => x.calendar_duty)) {
  check('instrument "' + p.id + '" calendar_duty exists (' + p.calendar_duty + ')', duties.has(p.calendar_duty));
}

/* ── 4. Anti-shadow-policy sweep ───────────────────────────────────────────
   TWO signals, because the naming rule alone let real instruments through:
   bcp.md and decommissioning.md were owned, operative and unregistered until
   2026-07-28 purely because their filenames carried none of the keywords.

   (a) NAME — the keyword rule, widened with plan/standard/methodology/bcp.
   (b) APPROVER — any document declaring an "**Approver:**" in its header is
       claiming to be an instrument someone signs off, whatever it is called.
       Registers, assessments and mappings do not carry one, so this catches
       the class the filename rule cannot see. */
const INSTRUMENT_NAME = /(^|-)(policy|procedure|charter|runbook|sop|plan|standard|methodology|bcp)(-|\.|$)/i;
const DECLARES_APPROVER = /^\*\*Approver[:*]/im;
const found = [];
(function walk(rel) {
  for (const entry of readdirSync(join(ROOT, rel))) {
    const child = rel + '/' + entry;
    if (statSync(join(ROOT, child)).isDirectory()) { walk(child); continue; }
    if (!entry.endsWith('.md')) continue;
    if (INSTRUMENT_NAME.test(entry) || DECLARES_APPROVER.test(read(child).slice(0, 1200))) found.push(child);
  }
})('docs');

const registered = new Set(reg.instruments.map((p) => p.path));
const excluded = new Map((reg.excluded || []).map((e) => [e.path, e.reason]));
check('sweep found instrument-shaped documents (' + found.length + ')', found.length > 0);
for (const f of found) {
  check('instrument-shaped document "' + f + '" is registered or excluded with a reason',
    registered.has(f) || (excluded.has(f) && excluded.get(f).length > 20));
}
for (const p of registered) check('registered path "' + p + '" was seen by the sweep or lies outside its naming rule', existsSync(join(ROOT, p)));
for (const [path] of excluded) check('excluded path "' + path + '" exists', existsSync(join(ROOT, path)));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
