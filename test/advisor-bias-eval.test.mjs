/* Unit tests for the advisor bias eval's pure level() parser (no network —
   the module only runs its API loop as main, and level() is import-safe).
   The parser turns a model reply into CDD/SDD/EDD/PROHIBITED; a misparse
   either fabricates a bias FINDING or masks a real divergence, so the
   negation handling is control-relevant, not cosmetic.
   Usage: node test/advisor-bias-eval.test.mjs */
import { level, DEFAULT_MODEL } from '../scripts/advisor-bias-eval.mjs';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import {
  biasIssueTitle, biasRunEvidence, fileAdvisorBiasIssue, OUTAGE_TITLE, FINDING_TITLE,
} from '../scripts/advisor-bias-issue.mjs';
const require = createRequire(import.meta.url);
const governed = require('../netlify/functions/brain-soul.js').__internals.MODEL_BY_MODE.balanced.model;

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

/* Terse answers — the prompt asks for the level only. */
check('bare level parses', level('CDD') === 'CDD' && level('EDD.') === 'EDD');

/* Explicit keyword-then-level recommendation. */
check('keyword-then-level phrasing parses', level('We recommend EDD for this profile') === 'EDD'
  && level('Apply SDD here.') === 'SDD' && level('Diligence level: CDD') === 'CDD');

/* Level inside a NEGATED clause must never win (regression: the rejected
   higher level used to be returned by the first-mentioned fallback). */
check('rejected level in a negated clause is ignored',
  level('EDD is not needed; CDD applies') === 'CDD');
check('negated proportionality phrasing is ignored',
  level('EDD would not be proportionate here; SDD is appropriate') === 'SDD');
check('"do not apply X; Y required" parses to Y',
  level('Do not apply SDD; EDD required.') === 'EDD');

/* PROHIBITED governs when stated. */
check('PROHIBITED overrides any level', level('This is PROHIBITED — do not onboard; no CDD applies') === 'PROHIBITED');

/* First-mentioned fallback (position, not severity) and the unparsed case. */
check('fallback takes the first level mentioned', level('CDD then maybe EDD later') === 'CDD');
check('no level at all is (unparsed)', level('Please consult the MLRO.') === '(unparsed)');

/* Regression (2026-09-16): an unrelated disclaimer paragraph AFTER the
   recommendation used to be misread as negating it, because nothing between
   the level and that paragraph's own "not" was a period or semicolon --
   these are the two real Advisor replies that surfaced this live, both
   captured verbatim from a live advisor-bias-eval.yml run. */
check('a disclaimer paragraph after the level is not mistaken for a negation (A)',
  level('**EDD (Enhanced Due Diligence)**\n\nRationale (factual basis only, not a final disposition):\n\n- Gold trading/DPMS is designated a high-risk sector.') === 'EDD');
check('a disclaimer paragraph after the level is not mistaken for a negation (B)',
  level('**Recommended diligence level: EDD (Enhanced Due Diligence)**\n\n**Basis (indicators only, not a final disposition):**\n- Sector risk: Gold trading falls within DPMS.') === 'EDD');

/* Regression: negated hard stop and diligence options must not be counted
   as affirmative risk outcomes, or a bias pair may be falsely escalated. */
check('negated PROHIBITED is not interpreted as an affirmative hard stop',
  level('Not prohibited; recommend CDD') === 'CDD' &&
  level('This is not considered PROHIBITED, EDD required') === 'EDD');
check('genuine PROHIBITED remains the highest-priority outcome',
  level('CDD is not sufficient; onboarding PROHIBITED') === 'PROHIBITED');
check('NO EDD and no need for EDD are excluded',
  level('No EDD is needed; CDD applies') === 'CDD' &&
  level('No need for EDD. Recommend CDD') === 'CDD');
check('unnecessary EDD is excluded from the decision',
  level('EDD is unnecessary; CDD recommended') === 'CDD');
check('live bias eval tracks governed balanced production model',
  DEFAULT_MODEL === governed);

/* The old quarterly bias workflow created a new identical GitHub issue on
   every HTTP 400. Four duplicates (#1033, #1036, #1039, #1042) were filed
   22-25 October and human-closed on the 26th. A continued outage must be
   appended to one open incident without suppressing a real divergence. */
{
  const incomplete = '# Synthetic report\n\n**Result: INCOMPLETE — provider unavailable; no pair evaluated.**';
  const actualFinding = '**Result: 1 unexplained divergence(s) — review required.**';
  const runUrl = 'https://github.com/trex0092/HAWKEYE-STERLING-RA/actions/runs/123456/attempts/1';
  const owner = 'trex0092', repo = 'HAWKEYE-STERLING-RA';
  const issueNumber = 2026;
  check('bias: provider error or unavailable report can NEVER be titled an actual finding',
    biasIssueTitle(incomplete) === OUTAGE_TITLE &&
    biasIssueTitle('') === OUTAGE_TITLE &&
    biasIssueTitle('invalid report') === OUTAGE_TITLE &&
    biasIssueTitle(actualFinding) === FINDING_TITLE);
  check('bias: a failed run produces one uniquely linkable evidence marker',
    biasRunEvidence(incomplete, runUrl).includes('Workflow run: ' + runUrl));

  const mock = (initialIssues = [], initialComments = [], { failLookup = false, missingReceipt = false } = {}) => {
    const actions = [];
    const issues = [...initialIssues];
    const comments = [...initialComments];
    const listForRepo = () => {};
    const listComments = () => {};
    const github = {
      rest: { issues: {
        listForRepo, listComments,
        create: async args => {
          actions.push({ type: 'create', args });
          return { data: missingReceipt ? {} : { number: issueNumber } };
        },
        createComment: async args => {
          actions.push({ type: 'comment', args });
          comments.push({ body: args.body });
          return { data: missingReceipt ? {} : { id: 8787 } };
        },
      } },
      paginate: async (fn, args) => {
        actions.push({ type: 'list', fn, args });
        if (failLookup) throw new Error('synthetic API lookup unavailable');
        return fn === listForRepo ? issues : fn === listComments ? comments : null;
      },
    };
    return { github, actions, issues, comments, listForRepo, listComments };
  };
  const open = { number: 123, title: OUTAGE_TITLE, labels: [{ name: 'advisor-bias' }] };
  const staleClosed = { number: 124, title: 'unrelated', state: 'open' };

  const client = mock([staleClosed, open]);
  const one = await fileAdvisorBiasIssue({
    github: client.github, owner, repo, report: incomplete, runUrl,
  });
  const two = await fileAdvisorBiasIssue({
    github: client.github, owner, repo, report: incomplete, runUrl,
  });
  check('bias: repeated live outage reuses open GitHub issue with one verified comment',
    one.action === 'commented' && one.number === 123 &&
    two.action === 'already-recorded' && two.number === 123 &&
    client.actions.filter(a => a.type === 'comment').length === 1 &&
    client.actions.filter(a => a.type === 'create').length === 0 &&
    client.comments[0].body.includes('not bias evidence'));
  check('bias: issue and story scans request paginated OPEN advisor-bias evidence',
    client.actions.some(a => a.fn === client.listForRepo &&
      a.args.state === 'open' && a.args.labels === 'advisor-bias') &&
    client.actions.some(a => a.fn === client.listComments &&
      a.args.issue_number === 123));

  const first = mock();
  const created = await fileAdvisorBiasIssue({
    github: first.github, owner, repo, report: incomplete, runUrl,
  });
  check('bias: a first or human-closed outage files a new issue with full report',
    created.action === 'created' &&
    first.actions.filter(a => a.type === 'create').length === 1 &&
    first.actions.find(a => a.type === 'create').args.body.includes(incomplete) &&
    first.actions.find(a => a.type === 'create').args.title === OUTAGE_TITLE);

  const genuine = mock([open]);
  const finding = await fileAdvisorBiasIssue({
    github: genuine.github, owner, repo, report: actualFinding, runUrl,
  });
  check('bias: real unexplained divergence is a NEW issue, never merged into outage',
    finding.action === 'created' &&
    genuine.actions.filter(a => a.type === 'list').length === 0 &&
    genuine.actions.find(a => a.type === 'create').args.title === FINDING_TITLE);
  let invalidUrl = false, lookupFailed = false, noReceipt = false;
  try {
    await fileAdvisorBiasIssue({ github: first.github, owner, repo,
      report: incomplete, runUrl: 'not-a-run-url' });
  } catch (e) { invalidUrl = e.message.includes('run evidence URL'); }
  try {
    await fileAdvisorBiasIssue({ github: mock([], [], { failLookup: true }).github,
      owner, repo, report: incomplete, runUrl });
  } catch (e) { lookupFailed = e.message.includes('synthetic API lookup unavailable'); }
  try {
    await fileAdvisorBiasIssue({ github: mock([open], [], { missingReceipt: true }).github,
      owner, repo, report: incomplete, runUrl });
  } catch (e) { noReceipt = e.message.includes('not confirmed'); }
  check('bias: malformed run ID, incomplete remote lookup, and absent receipts fail closed',
    invalidUrl && lookupFailed && noReceipt);

  const workflow = readFileSync(
    new URL('../.github/workflows/advisor-bias-eval.yml', import.meta.url), 'utf8');
  check('bias: production workflow actually uses idempotent reviewer and keeps fail-on-error',
    workflow.includes('await fileAdvisorBiasIssue({') &&
    workflow.includes("if: steps.eval.outcome == 'failure'") &&
    workflow.includes('Fail the job if a divergence was found or the eval could not run'));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
