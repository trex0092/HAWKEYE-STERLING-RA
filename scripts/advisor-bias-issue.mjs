/* GitHub issue routing for live Advisor bias evaluations.
 *
 * A PROVIDER-WIDE outage is one open operational incident, with a per-run
 * evidence comment. Real unexplained bias divergences are independent findings
 * and must never be collapsed into the outage incident.
 *
 * This module uses a supplied GitHub API client: offline tests can exercise
 * actual pagination, failure, retry and receipt handling without credentials.
 */
export const OUTAGE_TITLE = 'Advisor bias eval incomplete — API errors (not bias evidence)';
export const FINDING_TITLE = 'Advisor bias eval — unexplained divergence';

export function biasIssueTitle(report) {
  // An absent, truncated or unrecognised report is NOT evidence of bias.
  // Only the evaluator's explicit positive result can authorize that title.
  return /^\*\*Result:\s*[1-9]\d* unexplained divergence\(s\)/m.test(String(report || ''))
    ? FINDING_TITLE : OUTAGE_TITLE;
}

export function biasRunEvidence(report, runUrl) {
  const url = String(runUrl || '').trim();
  if (!/^https:\/\/[^\s/]+\/[^\s/]+\/[^\s/]+\/actions\/runs\/\d+(?:\/attempts\/\d+)?$/.test(url)) {
    throw new Error('Advisor bias run evidence URL is missing or invalid');
  }
  const resultLine = String(report || '').split(/\r?\n/)
    .find(line => /^\*\*Result:/.test(line));
  const outcome = resultLine ? resultLine.slice(0, 900)
    : '**Result: INCOMPLETE — evaluator report unavailable; no bias finding inferred.**';
  return outcome + '\n\nWorkflow run: ' + url;
}

export async function fileAdvisorBiasIssue({ github, owner, repo, report, runUrl } = {}) {
  if (!github?.paginate || !github?.rest?.issues?.listForRepo ||
      !github?.rest?.issues?.listComments || !github?.rest?.issues?.create ||
      !github?.rest?.issues?.createComment || !owner || !repo) {
    throw new Error('Advisor bias issue delivery client is unavailable');
  }
  const title = biasIssueTitle(report);
  const evidence = biasRunEvidence(report, runUrl);
  const issueBody = String(report || '').trim() ||
    '# Advisor bias eval\n\n**Result: INCOMPLETE — evaluator report unavailable; no bias evidence.**';

  if (title === OUTAGE_TITLE) {
    const open = await github.paginate(github.rest.issues.listForRepo, {
      owner, repo, state: 'open', labels: 'advisor-bias', per_page: 100,
    });
    if (!Array.isArray(open)) throw new Error('Open Advisor bias issue inventory unavailable');
    const existing = open.filter(x => !x?.pull_request &&
      x?.title === OUTAGE_TITLE && Number.isSafeInteger(x.number) && x.number > 0)
      .sort((a, b) => a.number - b.number)[0];
    if (existing) {
      const comments = await github.paginate(github.rest.issues.listComments, {
        owner, repo, issue_number: existing.number, per_page: 100,
      });
      if (!Array.isArray(comments)) throw new Error('Advisor bias issue comment history unavailable');
      const recorded = comments.some(x => String(x?.body || '').split(/\r?\n/)
        .some(line => line === 'Workflow run: ' + runUrl));
      if (recorded) return { action: 'already-recorded', number: existing.number };
      const receipt = await github.rest.issues.createComment({
        owner, repo, issue_number: existing.number,
        body: '**Provider outage persists; this is not bias evidence.**\n\n' + evidence,
      });
      if (!Number.isSafeInteger(receipt?.data?.id) || receipt.data.id <= 0) {
        throw new Error('Advisor bias issue comment was not confirmed by GitHub');
      }
      return { action: 'commented', number: existing.number };
    }
  }

  // A true finding always gets its own issue. If an outage was previously
  // closed by a human, a subsequent outage creates a new incident too.
  const created = await github.rest.issues.create({
    owner, repo, title,
    body: issueBody + '\n\n---\n' + evidence +
      '\n\nTriage per docs/governance/advisor-bias-review-2026.md.',
    labels: ['advisor-bias'],
  });
  if (!Number.isSafeInteger(created?.data?.number) || created.data.number <= 0) {
    throw new Error('New Advisor bias issue was not confirmed by GitHub');
  }
  return { action: 'created', number: created.data.number };
}
