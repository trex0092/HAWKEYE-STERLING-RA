/* Offline unit tests for the screening case lifecycle's pure logic
   (scripts/screening-cases.mjs). No network, no filesystem.
   Usage: node test/screening-cases.test.mjs */
import { planCaseActions, canAutoClearCases, confirmedDispositionState, newCaseStateEntry, createVerifiedScreeningCase, unverifiedCaseCreationState, postVerifiedCaseAgingNotice, selectDispositionReadBatch, DEFAULT_CASE_DISPOSITION_READ_CAP, MAX_CASE_DISPOSITION_READ_CAP, applyVerifiedCaseDisposition, verifyScreeningCaseAuditStory, CASE_FALSE_POSITIVE_AUDIT, CASE_ESCALATE_AUDIT, caseTitle, caseHtml, addDays, ageInDays, CASE_SLA_DAYS, buildResultsDigestHtml, resultsDigestTitle, parseDisposition, whitelistablePairs } from '../scripts/screening-cases.mjs';
import { caseSection, SECTIONS } from '../scripts/asana-sections.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('  FAIL ' + name); }
}

const TODAY = '2026-07-08';
/* Fixture subjects use fictional names (John Doe / Jane Roe); the GIDs are
   inert numeric identifiers kept stable for the CASE-number assertions. */
const subj = (over = {}) => ({
  name: 'John Doe', jurisdiction: 'Dominica', band: 'high', topScore: 87,
  recommendation: 'sanctions-match', lists: ['UK OFSI'], firstSeen: '2026-06-27', lastSeen: TODAY, ...over
});

/* ── helpers ── */
check('addDays computes the SLA due date', addDays('2026-06-27', 5) === '2026-07-02' && addDays('junk', 5) === null);
check('ageInDays counts whole days, defensive on garbage', ageInDays('2026-06-27', TODAY) === 11 && ageInDays(null, TODAY) === 0);
check('caseTitle is stable and carries the customer GID tail',
  caseTitle('john doe|ubo|1214107985842154', subj()) === '🧾 CASE-842154 — John Doe — sanctions-match');
/* Entity keys have no gid segment — the state record's own gid must supply the
   case id (every company case used to be titled CASE-XXXXXX). */
check('caseTitle falls back to the subject gid for a legal-entity key',
  caseTitle('amber international fzco', subj({ name: 'Amber International FZCO', gid: '1214107911223344' }))
    === '🧾 CASE-223344 — Amber International FZCO — sanctions-match');
check('caseTitle without any gid still renders (pre-migration record)',
  caseTitle('amber international fzco', subj({ name: 'Amber International FZCO' }))
    === '🧾 CASE-XXXXXX — Amber International FZCO — sanctions-match');
check('case SLA remains five days', CASE_SLA_DAYS === 5);
check('sanctions cases route to Screening Sanctions Update',
  caseSection({ hits: [{ list: 'UK OFSI' }] }) === SECTIONS.sanctions.gid);
check('PEP cases route to Screening Adverse Media & PEP’s Update',
  caseSection({ hits: [{ list: 'PEP (Wikidata)' }] }) === SECTIONS.media.gid);
check('adverse-media cases route to Screening Adverse Media & PEP’s Update',
  caseSection({ hits: [{ list: 'Adverse media (GDELT)' }] }) === SECTIONS.media.gid);
check('mixed cases retain sanctions priority without creating another section',
  caseSection({ hits: [{ list: 'Adverse media (GDELT)' }, { list: 'UN Consolidated' }] }) === SECTIONS.sanctions.gid);

/* New cases require a remote GID, approved section and read-back receipt.
   Synthetic IDs and injected request functions, no live Asana writes. */
{
  const title = 'Synthetic Screening Case', project = '1216203370612914',
    section = '1218451960830318', taskId = '1219451000000001';
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET',
      nonReplayable: options.noRetryOnUnknownOutcome === true });
    if (path === '/tasks' && options.method === 'POST') return { data: { gid: taskId } };
    if (path === '/sections/' + section + '/addTask') return { data: {} };
    if (path.startsWith('/tasks/' + taskId + '?')) return { data: {
      gid: taskId, name: title, memberships: [{ project: { gid: project }, section: { gid: section } }]
    } };
    throw new Error('unexpected synthetic Asana request');
  };
  const task = await createVerifiedScreeningCase(request, {
    title, htmlNotes: '<body>Synthetic case evidence</body>', projectGid: project,
    sectionGid: section, assignee: '1213645083721304', dueOn: TODAY
  });
  check('case creation confirms the actual Asana task identity, section and project',
    task === taskId && calls.length === 3 &&
    calls[0].path === '/tasks' && calls[0].method === 'POST' && calls[0].nonReplayable &&
    calls[1].path.endsWith('/addTask') && calls[2].path.includes('?opt_fields='));
  let missing = false;
  try {
    await createVerifiedScreeningCase(async () => ({ data: {} }), {
      title, htmlNotes: '<body>Synthetic case evidence</body>',
      projectGid: project, sectionGid: section
    });
  } catch { missing = true; }
  check('missing Asana case GID is never persisted as a successful case', missing);
  let misplaced = false;
  try {
    await createVerifiedScreeningCase(async path => {
      if (path === '/tasks') return { data: { gid: taskId } };
      if (path.endsWith('/addTask')) return { data: {} };
      return { data: { gid: taskId, name: title, memberships: [{
        project: { gid: project }, section: { gid: '12345' }
      }] } };
    }, { title, htmlNotes: '<body>Synthetic</body>', projectGid: project, sectionGid: section });
  } catch { misplaced = true; }
  check('misfiled Asana screening case never reports verified delivery', misplaced);
  let writes = 0, ambiguous = false;
  try {
    await createVerifiedScreeningCase(async () => {
      writes++; throw new Error('synthetic lost receipt');
    }, { title, htmlNotes: '<body>Synthetic</body>', projectGid: project, sectionGid: section });
  } catch { ambiguous = true; }
  check('uncertain case creation is not retried within the case publisher',
    ambiguous && writes === 1);
  const pending = unverifiedCaseCreationState(null, TODAY);
  check('unconfirmed new case preserves a human recovery hold, not a phantom GID',
    pending.requiresHumanRecovery === true && pending.taskGid === null &&
    pending.cleared === false && pending.creationUnverifiedAt === TODAY);
  check('an uncertain case cannot queue another automatic duplicate or invalid aging action',
    planCaseActions({ k: subj() }, { k: pending }, TODAY).length === 0);
  const prior = { taskGid: '999999', cleared: true, clearedAt: '2026-07-01' };
  const uncertainReflag = unverifiedCaseCreationState(prior, TODAY);
  check('uncertain reflag preserves prior disposition and blocks duplicate creation',
    uncertainReflag.taskGid === prior.taskGid && uncertainReflag.cleared === true &&
    uncertainReflag.clearedAt === prior.clearedAt &&
    planCaseActions({ k: subj() }, { k: uncertainReflag }, TODAY).length === 0);
}

/* SLA aging alerts are audit evidence, not fire-and-forget comments. */
{
  const taskGid = '1219451000000001';
  const storyGid = '1219451000000011';
  const notice = '⏰ AGING — this screening case has been open 11 days (SLA: 5). Review and disposition required.';
  const fake = ({ lostPost = false, unconfirmedRead = false, invalidHistory = false } = {}) => {
    const state = { story: null, calls: [], writes: 0 };
    const request = async (path, opts = {}) => {
      const method = opts.method || 'GET';
      state.calls.push({ path, method, retrySafe: opts.noRetryOnUnknownOutcome === true });
      if (path.startsWith('/tasks/' + taskGid + '/stories?')) {
        if (invalidHistory) return { data: null };
        return { data: state.story ? [state.story] : [], next_page: null };
      }
      if (path === '/tasks/' + taskGid + '/stories' && method === 'POST') {
        state.writes++;
        state.story = { gid: storyGid, text: JSON.parse(opts.body).data.text };
        if (lostPost) throw new Error('synthetic lost Asana story acknowledgement');
        return { data: { gid: storyGid } };
      }
      if (path.startsWith('/stories/' + storyGid + '?')) {
        return { data: unconfirmedRead ? {} : state.story };
      }
      throw new Error('unexpected synthetic Asana request');
    };
    return { request, state };
  };
  const normal = fake();
  const result = await postVerifiedCaseAgingNotice(normal.request, taskGid, 11);
  check('SLA aging requires confirmed exact audit comment read-back',
    result.confirmed && !result.alreadyRecorded && normal.state.story.text === notice &&
    normal.state.calls.some(x => x.path.includes('/stories/' + storyGid + '?')));
  check('SLA aging story POST is non-replayable after an unknown remote outcome',
    normal.state.calls.find(x => x.method === 'POST')?.retrySafe === true);
  const prior = await postVerifiedCaseAgingNotice(normal.request, taskGid, 11);
  check('rerun discovers existing SLA comment and cannot duplicate it',
    prior.confirmed && prior.alreadyRecorded && normal.state.writes === 1);
  const lost = fake({ lostPost: true });
  let unknownRejected = false;
  try { await postVerifiedCaseAgingNotice(lost.request, taskGid, 11); }
  catch { unknownRejected = true; }
  const recovery = await postVerifiedCaseAgingNotice(lost.request, taskGid, 11);
  check('ambiguous story response fails first attempt but reconciles without double posting',
    unknownRejected && recovery.alreadyRecorded && lost.state.writes === 1);
  const unconfirmed = fake({ unconfirmedRead: true });
  let readBlocked = false;
  try { await postVerifiedCaseAgingNotice(unconfirmed.request, taskGid, 11); }
  catch { readBlocked = true; }
  check('a successful Asana POST without read-back never marks SLA evidence as confirmed',
    readBlocked && unconfirmed.state.writes === 1);
  const badHistory = fake({ invalidHistory: true });
  let historyBlocked = false;
  try { await postVerifiedCaseAgingNotice(badHistory.request, taskGid, 11); }
  catch { historyBlocked = true; }
  check('incomplete story history fails closed before creating an unverified SLA alert',
    historyBlocked && badHistory.state.writes === 0);
  let invalidBlocked = false;
  try { await postVerifiedCaseAgingNotice(async () => { throw Error('should not call'); }, taskGid, 3); }
  catch { invalidBlocked = true; }
  check('SLA notice may only be sent once the genuine five-day limit is exceeded',
    invalidBlocked);
}

/* ── planner ── */
const KEY = 'john doe|ubo|1214107985842154';

check('new flag with no case → create, due = firstSeen + SLA', (() => {
  const a = planCaseActions({ [KEY]: subj() }, {}, TODAY);
  return a.length === 1 && a[0].type === 'create' && a[0].dueOn === '2026-07-02';
})());

check('standing flag with an open case inside the SLA → no action', (() => {
  const fresh = subj({ firstSeen: '2026-07-05' });
  const a = planCaseActions({ [KEY]: fresh }, { [KEY]: { taskGid: 't1', createdAt: '2026-07-05', agingAlerted: false, cleared: false } }, TODAY);
  return a.length === 0;
})());

check('case open past the SLA → exactly one aging action, never repeated', (() => {
  const cs = { [KEY]: { taskGid: 't1', createdAt: '2026-06-27', agingAlerted: false, cleared: false } };
  const first = planCaseActions({ [KEY]: subj() }, cs, TODAY);
  const again = planCaseActions({ [KEY]: subj() }, { [KEY]: { ...cs[KEY], agingAlerted: true } }, TODAY);
  return first.length === 1 && first[0].type === 'age' && first[0].ageDays === 11 && again.length === 0;
})());

check('subject no longer flagged today remains open for human disposition', (() => {
  const gone = subj({ lastSeen: '2026-07-05' });
  const a = planCaseActions({ [KEY]: gone }, { [KEY]: { taskGid: 't1', createdAt: '2026-06-27', agingAlerted: true, cleared: false } }, TODAY, { allowAutoClear: true });
  return a.length === 0;
})());

check('subject missing from the registry does not close its case', (() => {
  const a = planCaseActions({}, { [KEY]: { taskGid: 't1', createdAt: '2026-06-27', cleared: false } }, TODAY, { allowAutoClear: true });
  return a.length === 0;
})());

check('a cleared case never re-acts', (() => {
  const a = planCaseActions({}, { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-07-01' } }, TODAY);
  return a.length === 0;
})());

check('a re-flagged subject after clearance gets a FRESH case referencing the prior one', (() => {
  /* DESIGN CHANGE (owner-authorized): this used to pin "stays with the closed
     case (manual reopen by design)". In the shipped case-engine config alerts
     are suppressed, so the case board is the ONLY delivery surface — the old
     behavior left a re-listed customer with just a digest line pointing at a
     COMPLETED case (no open case, no SLA, no assignee). Now the planner
     creates a fresh case, due today+SLA, carrying priorCase {taskGid,
     clearedAt} so the new card references the history. */
  const a = planCaseActions({ [KEY]: subj() }, { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-07-01' } }, TODAY);
  return a.length === 1 && a[0].type === 'create' && a[0].dueOn === addDays(TODAY, CASE_SLA_DAYS)
    && a[0].priorCase && a[0].priorCase.taskGid === 't1' && a[0].priorCase.clearedAt === '2026-07-01';
})());

check('re-flag create REPLACES the cleared state entry — SLA/aging restart, digest resolves the NEW case', (() => {
  /* Simulate the executor: the plan's create lands as a fresh open entry via
     newCaseStateEntry, so caseGidFor (casesState[key].taskGid) now yields the
     NEW case gid — the audit found the digest linking the old completed one. */
  const cases = { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-07-01', agingAlerted: true } };
  const a = planCaseActions({ [KEY]: subj() }, cases, TODAY)[0];
  cases[a.key] = newCaseStateEntry('t2', TODAY, a.priorCase);
  const caseGidFor = k => (cases[k] || {}).taskGid || null;
  return caseGidFor(KEY) === 't2' && cases[KEY].cleared === false && cases[KEY].agingAlerted === false
    && cases[KEY].createdAt === TODAY && cases[KEY].reopenedFrom === 't1' && cases[KEY].reopenedAt === TODAY;
})());

check('second clearance then THIRD re-flag runs the same reopen path against the second case', (() => {
  const cases = { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-06-30' } };
  /* re-flag #1 → fresh case t2 replaces t1's cleared entry */
  const a1 = planCaseActions({ [KEY]: subj() }, cases, TODAY)[0];
  cases[a1.key] = newCaseStateEntry('t2', TODAY, a1.priorCase);
  /* subject drops off again → preserve t2 open until an MLRO disposition */
  const a2 = planCaseActions({ [KEY]: subj({ lastSeen: TODAY }) }, cases, '2026-07-10', { allowAutoClear: true });
  if (a2.length !== 0) return false;
  cases[KEY] = { ...cases[KEY], cleared: true, clearedAt: '2026-07-10' };
  /* re-flag #2 → a third fresh case referencing t2, not t1 */
  const a3 = planCaseActions({ [KEY]: subj({ lastSeen: '2026-07-15' }) }, cases, '2026-07-15');
  return a3.length === 1 && a3[0].type === 'create'
    && a3[0].priorCase.taskGid === 't2' && a3[0].priorCase.clearedAt === '2026-07-10';
})());

check('a still-OPEN case is never duplicated by the reopen path', (() => {
  const fresh = subj({ firstSeen: '2026-07-05' });
  const a = planCaseActions({ [KEY]: fresh }, { [KEY]: { taskGid: 't1', createdAt: '2026-07-05', agingAlerted: false, cleared: false } }, TODAY);
  return a.length === 0;
})());

check('a subject clear on both runs (inactive + cleared case) stays no-action', (() => {
  const gone = subj({ lastSeen: '2026-07-05' });
  const a = planCaseActions({ [KEY]: gone }, { [KEY]: { taskGid: 't1', cleared: true, clearedAt: '2026-07-06' } }, TODAY);
  return a.length === 0;
})());

check('newCaseStateEntry without a prior case is a plain open entry (no reopen fields)', (() => {
  const e = newCaseStateEntry('t9', TODAY, undefined);
  return e.taskGid === 't9' && e.cleared === false && e.agingAlerted === false
    && !('reopenedFrom' in e) && !('reopenedAt' in e);
})());

check('mixed registry plans each subject independently', (() => {
  const k2 = 'jane roe|ubo|1214107921925846';
  const a = planCaseActions(
    { [KEY]: subj(), [k2]: subj({ name: 'Jane Roe', recommendation: 'review', lastSeen: '2026-07-01' }) },
    { [k2]: { taskGid: 't2', createdAt: '2026-06-27', cleared: false } },
    TODAY, { allowAutoClear: true });
  const types = a.map(x => x.type).sort().join();
  return types === 'create';
})());

/* ── Complete coverage informs review but never grants clearance authority ── */
const GOOD_COVERAGE = {
  date: TODAY, screened: 2, degraded: false, failures: [],
  lists: [{ id: 'sdn', count: 123, partial: false }],
  enrichment: { amErrors: 0, amPartial: 0, skipped: 0, pepErrors: 0,
    pepWorldwide: { active: true, partial: false, count: 200,
      harvested: '2026-07-08T05:00:00Z' } }
};
check('full screening coverage still does not authorize automated case closure',
  canAutoClearCases(GOOD_COVERAGE, TODAY) === true &&
  canAutoClearCases({ ...GOOD_COVERAGE, degraded: true }, TODAY) === false &&
  canAutoClearCases({ ...GOOD_COVERAGE, failures: ['source unreachable'] }, TODAY) === false);
check('failed or partial sources and skipped adverse-media/PEP signals hold cases open',
  [
    { ...GOOD_COVERAGE, lists: [{ id: 'sdn', count: 123, partial: true }] },
    { ...GOOD_COVERAGE, lists: [] },
    { ...GOOD_COVERAGE, enrichment: { ...GOOD_COVERAGE.enrichment, amErrors: 1 } },
    { ...GOOD_COVERAGE, enrichment: { ...GOOD_COVERAGE.enrichment, amPartial: 1 } },
    { ...GOOD_COVERAGE, enrichment: { ...GOOD_COVERAGE.enrichment, skipped: 1 } },
    { ...GOOD_COVERAGE, enrichment: { ...GOOD_COVERAGE.enrichment, pepErrors: 1 } },
    { ...GOOD_COVERAGE, enrichment: { ...GOOD_COVERAGE.enrichment,
      pepWorldwide: { ...GOOD_COVERAGE.enrichment.pepWorldwide, partial: true } } },
    { ...GOOD_COVERAGE, enrichment: { ...GOOD_COVERAGE.enrichment,
      pepWorldwide: { ...GOOD_COVERAGE.enrichment.pepWorldwide, active: false } } },
    { ...GOOD_COVERAGE, date: '2026-07-07' }
  ].every(r => !canAutoClearCases(r, TODAY)));
const OPEN_CASE = { [KEY]: { taskGid: 'existing-case', createdAt: '2026-07-01', cleared: false } };
check('no implicit permission to close missing or inactive cases',
  planCaseActions({}, OPEN_CASE, TODAY).length === 0 &&
  planCaseActions({ [KEY]: subj({ lastSeen: '2026-07-07' }) }, OPEN_CASE, TODAY).length === 0);
check('whitelisted findings cannot auto-close without complete evidence but SLA aging remains possible',
  (() => { const actions = planCaseActions({ [KEY]: subj({ whitelistedOnly: true }) }, OPEN_CASE, TODAY);
    return actions.every(a => a.type !== 'clear') && actions.some(a => a.type === 'age');
  })());
check('incomplete coverage still creates genuinely new cases while withholding clearance',
  (() => { const actions = planCaseActions({
    [KEY]: subj(), inactive: subj({ lastSeen: '2026-07-06' })
  }, { inactive: { taskGid: 'case2', cleared: false } }, TODAY);
  return actions.length === 1 && actions[0].type === 'create' && actions[0].key === KEY;
})());
check('complete coverage cannot close an absent subject case without a human disposition',
  canAutoClearCases(GOOD_COVERAGE, TODAY) &&
  planCaseActions({}, OPEN_CASE, TODAY, {
    allowAutoClear: canAutoClearCases(GOOD_COVERAGE, TODAY)
  }).length === 0);

/* ── Remote-first case disposition safety (no Asana or secrets needed) ── */
const pendingCase = { taskGid: 't1', createdAt: TODAY, cleared: false, agingAlerted: false };
check('an uncommitted disposition intent cannot mutate the active case',
  (() => {
    const original = { ...pendingCase };
    const proposed = { type: 'disposition-clear', caseGid: pendingCase.taskGid };
    return proposed.type === 'disposition-clear' && pendingCase.cleared === false &&
      JSON.stringify(pendingCase) === JSON.stringify(original);
  })());
check('confirmed false-positive disposition creates whitelist evidence only after success',
  (() => {
    const result = confirmedDispositionState(pendingCase, 'disposition-clear', TODAY,
      subj({ hits: [
        { list: 'UK OFSI', hitName: 'Synthetic Match' },
        { list: 'PEP (Wikidata)', hitName: 'Synthetic Person' }
      ] }));
    return result.cleared === true && result.clearedAt === TODAY &&
      result.disposition.kind === 'false-positive' &&
      result.disposition.hits.length === 1 && result.disposition.hits[0].hitName === 'Synthetic Match' &&
      pendingCase.cleared === false;
  })());
check('confirmed escalation pins the case open without adding any clearance',
  (() => {
    const result = confirmedDispositionState(pendingCase, 'disposition-escalate-ack', TODAY);
    return result.escalated === true && result.cleared === false && !result.disposition;
  })());
check('invalid remote confirmations cannot change case state',
  (() => {
    try { confirmedDispositionState(pendingCase, 'unknown-disposition', TODAY); return false; }
    catch { return pendingCase.cleared === false; }
  })());

/* A remote 2xx write is not enough for a consequential MLRO disposition.
   Simulate real Asana GET/POST/PUT semantics without touching live tasks. */
{
  const gid = '1219451000000001';
  const fpNotes = '[x] false positive\n[ ] escalate\n[ ] under investigation';
  const escNotes = '[ ] false positive\n[x] escalate\n[ ] under investigation';
  const mockCase = (initialNotes = fpNotes, options = {}) => {
    const state = { notes: initialNotes, completed: false, stories: [], calls: [],
      nextStoryGid: 1219000000, ...options };
    const request = async (path, opts = {}) => {
      const method = opts.method || 'GET';
      state.calls.push({ path, method, nonReplayable: !!opts.noRetryOnUnknownOutcome });
      if (path.startsWith('/tasks/' + gid + '?')) {
        const answer = { data: { gid, notes: state.notes, completed: state.completed } };
        if (options.incompleteTask === true) delete answer.data.completed;
        return answer;
      }
      if (path.startsWith('/tasks/' + gid + '/stories?')) {
        if (options.invalidStoryHistory) return { data: null };
        return { data: state.stories.map(s => ({ gid: s.gid, text: s.text })), next_page: null };
      }
      if (path === '/tasks/' + gid + '/stories' && method === 'POST') {
        if (options.failWrite) throw new Error('synthetic uncertain response');
        const entry = { gid: String(++state.nextStoryGid), text: JSON.parse(opts.body).data.text };
        if (!options.missingStoryAfterPost) state.stories.push(entry);
        return { data: { gid: entry.gid } };
      }
      if (path === '/tasks/' + gid && method === 'PUT') {
        if (!options.ignoreCompletion) state.completed = JSON.parse(opts.body).data.completed;
        if (options.changedApprovalOnCompletion) state.notes = escNotes;
        return { data: { gid, completed: state.completed } };
      }
      throw new Error('Unexpected synthetic Asana call: ' + method + ' ' + path);
    };
    return { request, state };
  };
  const good = mockCase();
  const receipt = await applyVerifiedCaseDisposition(good.request, gid, 'disposition-clear');
  check('human false-positive clearance requires the audit story, completion and final read-back',
    receipt.confirmed && receipt.completed === true && good.state.completed &&
    good.state.stories.length === 1 && good.state.stories[0].text === CASE_FALSE_POSITIVE_AUDIT);
  check('audit story creation and task completion are non-replayable after unknown response',
    good.state.calls.filter(c => c.method === 'POST' || c.method === 'PUT')
      .every(c => c.nonReplayable));
  const repeated = await applyVerifiedCaseDisposition(good.request, gid, 'disposition-clear');
  check('rerun reconciles a previously completed clearance without duplicate audit comments',
    repeated.confirmed && good.state.stories.length === 1 &&
    good.state.calls.filter(c => c.method === 'POST').length === 1);

  const failStory = mockCase(fpNotes, { missingStoryAfterPost: true });
  let unconfirmedStory = false;
  try { await applyVerifiedCaseDisposition(failStory.request, gid, 'disposition-clear'); }
  catch { unconfirmedStory = true; }
  check('unconfirmed story read-back cannot trigger Asana completion',
    unconfirmedStory && failStory.state.completed === false &&
    !failStory.state.calls.some(c => c.method === 'PUT'));

  const failPut = mockCase(fpNotes, { ignoreCompletion: true });
  let unconfirmedCompletion = false;
  try { await applyVerifiedCaseDisposition(failPut.request, gid, 'disposition-clear'); }
  catch { unconfirmedCompletion = true; }
  check('accepted task completion PUT cannot establish local clearance without a matching GET',
    unconfirmedCompletion && failPut.state.completed === false);

  const conflicting = mockCase('[x] false positive\n[x] escalate');
  let conflictBlocked = false;
  try { await applyVerifiedCaseDisposition(conflicting.request, gid, 'disposition-clear'); }
  catch { conflictBlocked = true; }
  check('conflicting MLRO marks fail closed and cannot post a false-positive clearance',
    conflictBlocked && conflicting.state.calls.every(c => c.method === 'GET'));

  const reversed = mockCase(fpNotes, { changedApprovalOnCompletion: true });
  let revokedBlocked = false;
  try { await applyVerifiedCaseDisposition(reversed.request, gid, 'disposition-clear'); }
  catch { revokedBlocked = true; }
  check('changing or escalating human decision before final read-back prevents local clearance',
    revokedBlocked);

  const escalate = mockCase(escNotes);
  const escReceipt = await applyVerifiedCaseDisposition(escalate.request, gid, 'disposition-escalate-ack');
  check('confirmed MLRO escalation preserves open task and its audit story',
    escReceipt.confirmed && escReceipt.completed === false &&
    escalate.state.stories[0].text === CASE_ESCALATE_AUDIT &&
    !escalate.state.calls.some(c => c.method === 'PUT'));
  const malformed = mockCase(fpNotes, { invalidStoryHistory: true });
  let missingHistory = false;
  try { await applyVerifiedCaseDisposition(malformed.request, gid, 'disposition-clear'); }
  catch { missingHistory = true; }
  check('failed audit-history scan cannot produce an unverified task completion',
    missingHistory && !malformed.state.calls.some(c => c.method === 'PUT'));

  const ambiguous = mockCase(fpNotes, { failWrite: true });
  let uncertain = false;
  try { await applyVerifiedCaseDisposition(ambiguous.request, gid, 'disposition-clear'); }
  catch { uncertain = true; }
  check('lost disposition-comment response cannot be replayed or clear case automatically',
    uncertain && !ambiguous.state.calls.some(c => c.method === 'PUT') &&
    ambiguous.state.calls.filter(c => c.method === 'POST').length === 1);
  check('audit read-back helper confirms exact matching evidence only',
    await verifyScreeningCaseAuditStory(good.request, gid, CASE_FALSE_POSITIVE_AUDIT) &&
    !(await verifyScreeningCaseAuditStory(good.request, gid, CASE_ESCALATE_AUDIT)));
}

/* ── card body ── */
const html = caseHtml(KEY, subj(), 'https://example/run');
check('case body: single <body> root, escalation banner for sanctions-match, SLA and lifecycle present',
  /^<body>[\s\S]*<\/body>$/.test(html) && html.includes('POTENTIAL SANCTIONS MATCH')
  && html.includes('review within ' + CASE_SLA_DAYS + ' days') && html.includes('auto-moved to Cleared'));
check('case body links the customer record by GID', html.includes('data-asana-gid="1214107985842154"'));
check('case body: a plain review flag gets the softer banner',
  caseHtml(KEY, subj({ recommendation: 'review' })).includes('Screening flag — review required'));
const reflagHtml = caseHtml(KEY, subj(), 'https://example/run', { taskGid: 't1', clearedAt: '2026-07-01' });
check('re-flag case body references the prior case gid and its cleared date',
  reflagHtml.includes('RE-FLAGGED AFTER CLEARANCE') && reflagHtml.includes('data-asana-gid="t1"')
  && reflagHtml.includes('cleared 2026-07-01') && /^<body>[\s\S]*<\/body>$/.test(reflagHtml));
check('a first-time case body carries no re-flag banner',
  !caseHtml(KEY, subj(), 'https://example/run').includes('RE-FLAGGED'));
/* Evidence rows: the card names WHO matched (designated name · score ·
   confidence · mechanism) when the state carries hit detail; a legal-entity
   record links its customer record through its own gid. */
const entHtml = caseHtml('amber international fzco',
  subj({ name: 'Amber International FZCO', gid: '77112233',
    hits: [{ list: 'UK OFSI', hitName: 'AMBER INTL FZCO', score: 91, mechanism: 'fuzzy', confidence: 'MODERATE' },
           { list: 'EU FSF', carriedForward: true }] }), 'https://example/run');
check('entity case body links the customer record via the persisted subject gid',
  entHtml.includes('data-asana-gid="77112233"'));
check('case body renders per-hit evidence: designated name, score, confidence, mechanism',
  entHtml.includes('UK OFSI') && entHtml.includes('AMBER INTL FZCO') && entHtml.includes('score 91')
  && entHtml.includes('MODERATE') && entHtml.includes('via fuzzy'));
check('a carried-forward hit is labelled not-re-verified, never presented as fresh evidence',
  entHtml.includes('carried forward (list not re-verified this run)'));
check('a pre-migration record (no hits array) still renders the list names',
  caseHtml(KEY, subj(), 'https://example/run').includes('UK OFSI'));

/* ── daily results digest (the Asana results surface) ── */
const RESULTS = {
  date: TODAY, screened: 778, entities: 334, individuals: 444,
  newMatches: 1, matchCount: 9, clearedCount: 2, degraded: true,
  lists: [{ name: 'UK OFSI', count: 19761 }, { name: 'France DGT', count: 18644 }],
  failures: ['UN consolidated could not be loaded (fetch failed) — coverage degraded'],
  enrichment: { amErrors: 100, pepErrors: 0, skipped: 644 },
  alerts: [{ key: KEY, name: 'John Doe', jurisdiction: 'Dominica', band: 'high', topScore: 87, recommendation: 'sanctions-match', lists: ['UK OFSI'] }],
  cleared: ['Old Match Ltd', 'Another One']
};
const digest = buildResultsDigestHtml(RESULTS, a => (a.key === KEY ? 'case-gid-1' : null));
check('digest: single <body> root with headline counts',
  /^<body>[\s\S]*<\/body>$/.test(digest) && digest.includes('778 subjects screened') && digest.includes('9 standing match(es)'));
check('digest: match row links its lifecycle case and carries score/band/lists',
  digest.includes('data-asana-gid="case-gid-1"') && digest.includes('score 87') && digest.includes('UK OFSI'));
check('digest: match row prefers hit evidence (designated name + score + confidence) when the artifact carries it', (() => {
  const withHits = buildResultsDigestHtml({ ...RESULTS,
    alerts: [{ ...RESULTS.alerts[0],
      hits: [{ list: 'UK OFSI', hitName: 'DOE, John', score: 87, mechanism: 'fuzzy', confidence: 'MODERATE' }] }] },
    a => (a.key === KEY ? 'case-gid-1' : null));
  return withHits.includes('DOE, John') && withHits.includes('87 · MODERATE') && withHits.includes('UK OFSI');
})());
check('digest: coverage totals + failed list + degraded warning are loud',
  digest.includes('38405 designated names') && digest.includes('⚠️ UN consolidated could not be loaded')
  && digest.includes('DEGRADED'));
check('digest: enrichment shortfall and cleared count are reported, MLRO/four-eyes note present',
  digest.includes('644 subject(s) skipped enrichment') && digest.includes('2 previously recorded match(es)')
  && digest.includes('four-eyes'));
check('digest: narrowed adverse-media coverage is disclosed, never silent', (() => {
  const partial = buildResultsDigestHtml({ ...RESULTS,
    enrichment: { amErrors: 0, amPartial: 12, pepErrors: 0, skipped: 0, amLocalesPerSubject: 8 } });
  return partial.includes('12 subject(s) had NARROWED adverse-media coverage')
    && partial.includes('Adverse-media sweep: 8 news edition(s) per subject');
})());
check('digest: worldwide posture states the matrix size, rotation cycle and global backbones', (() => {
  const world = buildResultsDigestHtml({ ...RESULTS,
    enrichment: { amLocalesPerSubject: 8, amRotationCycleDays: 22, amMatrixTotal: 70,
      amBackbones: ['GDELT global index', 'Bing News'] } });
  return world.includes('70-edition worldwide matrix')
    && world.includes('every edition swept within 22 run(s)')
    && world.includes('GDELT global index + Bing News on every subject, every run');
})());
check('digest: zero NEW matches never clears nine STANDING AML/PEP findings', (() => {
  const standing = buildResultsDigestHtml({ ...RESULTS, alerts: [], newMatches: 0,
    matchCount: 9, clearedCount: 0, degraded: false, failures: [], enrichment: {} });
  return standing.includes('9 standing match(es) remain') &&
    standing.includes('ongoing MLRO review') &&
    !standing.includes('every subject screened clean') &&
    !standing.includes('all-clear');
})());
check('digest: genuinely zero new/standing matches remains explicit but never promises clearance', (() => {
  const zero = buildResultsDigestHtml({ ...RESULTS, alerts: [], newMatches: 0,
    matchCount: 0, clearedCount: 0, degraded: false, failures: [], enrichment: {} });
  return zero.includes('No new or changed matches reported') &&
    zero.includes('not an all-clear') && !zero.includes('every subject screened clean') &&
    !zero.includes('DEGRADED');
})());
check('digest: absent match counts never masquerade as all-clear', (() => {
  const noCount = { ...RESULTS, alerts: [], newMatches: 0 };
  delete noCount.matchCount;
  return buildResultsDigestHtml(noCount).includes('not an all-clear');
})());
check('digest title states the outcome and volume',
  resultsDigestTitle(RESULTS) === '🛡️ Sanctions Screen — ' + TODAY + ' — 1 new match(es) · 778 screened'
  && resultsDigestTitle({ ...RESULTS, newMatches: 0 }).includes('no new matches'));

/* The 14 Oct live case ledger had 210 open cases; a fixed first-60 scan
   could indefinitely miss human MLRO dispositions on 150 cases. */
{
  const ledger = Array.from({ length: 210 }, (_, i) => [
    'case-' + String(i).padStart(4, '0'),
    { taskGid: String(1210000000000000 + i), cleared: false }
  ]);
  const allToday = selectDispositionReadBatch(ledger, '2026-10-14');
  check('default MLRO disposition read covers all 210 currently open cases in one run',
    DEFAULT_CASE_DISPOSITION_READ_CAP >= 210 &&
    allToday.total === 210 && allToday.selected.length === 210 &&
    allToday.deferred === 0 &&
    new Set(allToday.selected.map(entry => entry[0])).size === 210);
  const bounded = selectDispositionReadBatch(ledger, '2026-10-14', 60);
  check('explicit lower Asana read budget never silently claims all cases were scanned',
    bounded.selected.length === 60 && bounded.deferred === 150);
  const repeated = selectDispositionReadBatch(ledger, '2026-10-14', 60);
  check('same-day MLRO read batch is deterministic and retry-safe',
    JSON.stringify(bounded.selected) === JSON.stringify(repeated.selected));
  const observed = new Set();
  for (let day = 0; day < 4; day++) {
    const selected = selectDispositionReadBatch(ledger,
      addDays('2026-10-14', day), 60).selected;
    for (const [key] of selected) observed.add(key);
  }
  check('over the next four UTC days the bounded 60-case scan reaches all 210 cases',
    observed.size === 210);
  const closed = [
    ['closed', { taskGid: '111', cleared: true }],
    ['escalated', { taskGid: '222', escalated: true }],
    ['dispositioned', { taskGid: '333', disposition: { kind: 'false-positive' } }],
    ['missing', { cleared: false }],
    ['open', { taskGid: '444', cleared: false }]
  ];
  const active = selectDispositionReadBatch(closed, '2026-10-14');
  check('disposition scanner never re-enters completed, escalated or phantom cases',
    active.total === 1 && active.selected[0][0] === 'open');
  let refusedCap = false, refusedDate = false;
  try { selectDispositionReadBatch(ledger, '2026-10-14', MAX_CASE_DISPOSITION_READ_CAP + 1); }
  catch { refusedCap = true; }
  try { selectDispositionReadBatch(ledger, '2026-02-30', 60); }
  catch { refusedDate = true; }
  check('invalid read budgets and impossible calendar dates fail closed', refusedCap && refusedDate);
}

/* ── Disposition read-back (analyst feedback loop) ── */
check('parseDisposition: untouched template parses as null (no false trigger)',
  parseDisposition('[ ] false positive — …\n[ ] escalate / freeze (TFS) — …\n[ ] under investigation — …') === null);
check('parseDisposition: ticked false positive',
  parseDisposition('bla\n[x] false positive — clear this case…') === 'false-positive');
check('parseDisposition: ticked escalate (case-insensitive, spaced tick)',
  parseDisposition('[ X ] Escalate / freeze (TFS)') === 'escalate');
check('parseDisposition: conflicted card resolves fail-safe — escalate beats false positive',
  parseDisposition('[x] false positive\n[x] escalate') === 'escalate');
check('parseDisposition: ticked under investigation',
  parseDisposition('[x] under investigation') === 'investigating');
check('whitelistablePairs excludes enrichment/local/internal lists',
  (() => { const p = whitelistablePairs([
    { hitName: 'A', list: 'US OFAC — SDN list (CSV)' },
    { hitName: 'B', list: 'Adverse media (Google News)' },
    { hitName: 'C', list: 'PEP (Wikidata)' },
    { hitName: 'D', list: 'MANUAL REVIEW' },
    { hitName: 'E', list: 'Internal — Firm Watchlist' },
    { hitName: '', list: 'UN Security Council — Consolidated list (XML)' }]);
    return p.length === 1 && p[0].hitName === 'A'; })());

/* ── Planner: whitelist + escalation guards ── */
const _s = (extra) => ({ name: 'S', lastSeen: TODAY, firstSeen: TODAY, recommendation: 'review', band: 'medium', ...extra });
check('planner: whitelistedOnly subject opens NO case',
  planCaseActions({ k1: _s({ whitelistedOnly: true }) }, {}, TODAY).length === 0);
check('planner: whitelistedOnly does not re-open a cleared case',
  planCaseActions({ k1: _s({ whitelistedOnly: true }) }, { k1: { taskGid: 't', cleared: true, clearedAt: '2026-07-01' } }, TODAY).length === 0);
check('planner: whitelistedOnly keeps an OPEN case until human disposition',
  (() => { const a = planCaseActions({ k1: _s({ whitelistedOnly: true }) }, { k1: { taskGid: 't', cleared: false } }, TODAY, { allowAutoClear: true });
    return a.length === 0; })());
check('planner: an escalated case is never auto-cleared — not by absence…',
  planCaseActions({}, { k1: { taskGid: 't', cleared: false, escalated: true } }, TODAY).length === 0);
check('planner: …and not by the whitelist either',
  planCaseActions({ k1: _s({ whitelistedOnly: true }) }, { k1: { taskGid: 't', cleared: false, escalated: true } }, TODAY).length === 0);
check('planner: a same-day disposition never re-opens the case it just closed',
  planCaseActions({ k1: _s({}) }, { k1: { taskGid: 't', cleared: true, clearedAt: TODAY,
    disposition: { kind: 'false-positive', at: TODAY } } }, TODAY).length === 0);
check('planner: a PAST disposition does not block a genuine re-flag (fresh case)',
  (() => { const a = planCaseActions({ k1: _s({}) }, { k1: { taskGid: 't', cleared: true, clearedAt: '2026-07-01',
    disposition: { kind: 'false-positive', at: '2026-07-01' } } }, TODAY);
    return a.length === 1 && a[0].type === 'create' && a[0].priorCase && a[0].priorCase.taskGid === 't'; })());

/* ── Card renders the loop's surfaces ── */
check('case card carries the machine-read disposition block',
  (() => { const html = caseHtml('k1', _s({}), null, null);
    return html.includes('[ ] false positive') && html.includes('[ ] escalate / freeze (TFS)')
      && html.includes('[ ] under investigation') && parseDisposition(html) === null; })());
check('case card renders a corroborated second opinion',
  caseHtml('k1', _s({ secondOpinion: { provider: 'OFAC-API', status: 'corroborated', matchCount: 2, topScore: 92, checkedAt: TODAY } }), null, null)
    .includes('Second opinion (OFAC-API):'));
check('case card renders an unavailable second opinion as a LOST signal, not a clear',
  caseHtml('k1', _s({ secondOpinion: { provider: 'OFAC-API', status: 'unavailable', error: 'http 500', checkedAt: TODAY } }), null, null)
    .includes('a lost signal, not a clear'));
check('case card annotates a whitelisted hit with its clearance',
  caseHtml('k1', _s({ hits: [{ list: 'US OFAC — SDN list (CSV)', hitName: 'X', score: 90, whitelisted: true, clearedVia: 'case t1' }] }), null, null)
    .includes('CLEARED FP'));

/* ── Asana html_notes XML contract ──────────────────────────────────────────
   Asana parses html_notes as STRICT XML against a supported-tag subset; the
   original disposition block's <p>…<br>…</p> 400'd EVERY live case create
   (xml_parsing_error, observed twice 2026-08-05). This guard freezes the
   contract: every tag balanced or self-closed, and every tag on Asana's
   supported list — an unsupported tag fails here, not on the runner. */
const ASANA_TAGS = new Set(['body', 'h1', 'h2', 'ol', 'ul', 'li', 'strong', 'em',
  'u', 's', 'code', 'pre', 'blockquote', 'a', 'hr', 'table', 'tr', 'td']);
function asanaXmlOk(html) {
  const stack = [];
  const re = /<(\/?)([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m, last = 0;
  while ((m = re.exec(html))) {
    if (html.slice(last, m.index).includes('<')) return 'stray < outside a tag';
    last = re.lastIndex;
    const [, close, tag, , self] = m;
    if (!ASANA_TAGS.has(tag.toLowerCase())) return 'unsupported tag <' + tag + '>';
    if (self) continue;
    if (close) {
      if (stack.pop() !== tag.toLowerCase()) return 'mismatched </' + tag + '>';
    } else if (tag.toLowerCase() === 'hr') { /* void allowed unclosed nowhere — require self-close */
      return '<hr> must self-close';
    } else stack.push(tag.toLowerCase());
  }
  if (html.slice(last).includes('<')) return 'stray < after last tag';
  return stack.length ? 'unclosed <' + stack[stack.length - 1] + '>' : '';
}
const _fullCard = caseHtml('acme llc|ubo|123', _s({
  hits: [
    { list: 'US OFAC — SDN list (CSV)', hitName: 'A & B “Ltd”', score: 90, mechanism: 'fuzzy', confidence: 'strong', carriedForward: true },
    { list: 'PEP (Worldwide — Wikidata)', hitName: 'X — Minister, Testland', score: 88, whitelisted: true, clearedAt: '2026-08-01', clearedVia: 'case t9' }],
  secondOpinion: { provider: 'OFAC-API', status: 'corroborated', matchCount: 2, topScore: 97, checkedAt: '2026-08-05' },
}), 'https://example/run?a=1&b=2', { taskGid: 't1', clearedAt: '2026-07-01' });
check('case card is strict-XML clean for Asana (balanced, supported tags only): ' + (asanaXmlOk(_fullCard) || 'ok'),
  asanaXmlOk(_fullCard) === '');
check('case card carries no <br> and no <p> (the tags Asana 400s on)',
  !/<br\b/i.test(_fullCard) && !/<p\b/i.test(_fullCard));
check('disposition block survives as three verbatim machine-readable lines',
  _fullCard.includes('[ ] false positive — clear this case')
  && _fullCard.includes('[ ] escalate / freeze (TFS) — keep the case open')
  && _fullCard.includes('[ ] under investigation — keep working'));
const _digestXml = asanaXmlOk(buildResultsDigestHtml(
  { date: '2026-08-05', screened: 2, newMatches: [{ name: 'A & B', band: 'high', topScore: 90, recommendation: 'sanctions-match', lists: ['US OFAC — SDN list (CSV)'] }], stillMatched: [], cleared: [], degraded: true, notes: ['EU list could not be loaded — coverage degraded'] },
  () => 'case-gid-1'));
check('digest html is strict-XML clean too: ' + (_digestXml || 'ok'), _digestXml === '');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
