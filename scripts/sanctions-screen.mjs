/* Sanctions Screen — daily ongoing screening of the live customer base against
   the consolidated designation + watchlists.

   Sibling to the Sanctions Watch (which fingerprints the LISTS for changes) and
   the FATF Watchdog (country black/grey list moves). Where the Watch answers
   "did a list change?", this answers the operative question: "is any of OUR
   customers/counterparties now ON a list?"

   Flow (runner): read the active counterparties from the Asana "Customer
   Database" project → screen them IN THIS PROCESS against the free consolidated
   lists (OFAC SDN/non-SDN, UN, EU, UK OFSI, the maintained UAE EOCN list, plus
   any extra source) via scripts/sanctions-match.mjs, with free adverse-media
   (Google News RSS) and a best-effort PEP signal (Wikidata) layered on → diff the
   results against the last run → on any NEW match raise one alert card in the
   "Sanctions updates" section of the "Ongoing Monitoring" Asana
   project for MLRO / four-eyes review. There is no external engine and no API key.
   Ongoing monitoring: a standing match is recorded once, not re-alerted every day;
   a new or CHANGED match always alerts.

   Detection is automatic; the freeze / decline / report action stays a reviewed
   decision (MLRO sign-off + dual attestation — UAE Federal Decree-Law No. 10 of
   2025 Art.16/18; FATF R.26). A "no match" is NEVER treated as clearance when no
   list could be loaded — that surfaces loudly (the run bails as unscreened, or is
   flagged degraded) instead of passing silently.

   Per-subject result shape (from sanctions-match.mjs, same as the old engine):
     { name, topScore (0-100), band, recommendation, hitCount, lists[] }
   A subject is a match when its band is high/critical, its score clears the
   threshold, or it has any list hit (sanctions, adverse media or PEP).

   Network (Asana read + list fetch + media/PEP lookups + Asana post) is isolated
   from the pure logic below so test/sanctions-screen.test.mjs runs fully offline. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { notifyAsana, esc, REG_PROJECT_GID, asanaEnabled, isRetryable, retryDelayMs } from './asana-notify.mjs';
import { loadSources } from './reg-watch.mjs';
import { normalizeName, parseList, buildIndex, screenName } from './sanctions-match.mjs';
import { checkAdverseMedia, ALL_TERMS, LOCALES, LANG_TERMS } from './adverse-media.mjs';
import { checkPep } from './pep-check.mjs';
import { checkInterpol } from './interpol-check.mjs';

/* normalizeName lives in sanctions-match.mjs (the single source of truth) and is
   re-exported here so existing importers (tests, runner) are unchanged. */
export { normalizeName };

export const STATE_FILE   = 'data/sanctions-screen-state.json';
export const REPORT_FILE  = 'sanctions-screen-report.md';
export const CHANGES_FILE = 'sanctions-screen-changes.json';
/* Per-run results artifact for the case-manager step, which posts the daily
   results digest to Asana AFTER the cases exist — so every match on the card
   can link to its lifecycle case. The screening RESULTS surface is Asana;
   GitHub issues remain only the fallback when Asana itself is unreachable. */
export const RESULTS_FILE = 'sanctions-screen-results.json';

/* "Customer Database" project (workspace: Compliance Tasks) — the screening
   subject of record. Override with ASANA_CUSTOMER_PROJECT_GID. */
export const CUSTOMER_PROJECT_GID =
  process.env.ASANA_CUSTOMER_PROJECT_GID || '1214107620220121';

/* Consolidated designation lists screened against (data/sanctions-sources.json).
   Override the file with SANCTIONS_SOURCES_FILE. */
export const SANCTIONS_SOURCES_FILE = process.env.SANCTIONS_SOURCES_FILE || 'data/sanctions-sources.json';

/* The lists/signals screening covers (for the report/alert provenance line). */
export const COVERAGE = 'OFAC SDN/non-SDN · UN · EU · UK OFSI · UAE EOCN Local Terrorist List · worldwide adverse media (Google News × ' + LOCALES.length + ' country/language editions, ' + Object.keys(LANG_TERMS).length + ' languages, + GDELT global index) · PEP (Wikidata)';

/* ── Ongoing Monitoring project — daily audit-trail task ─────────────────────
   Separate from the Regulations alert path: every run (match or clear) leaves an
   Adverse Media & PEP record here so there is always evidence monitoring actually
   executed. The section is resolved by name at runtime (created if missing), so no
   manual Asana setup is required; ASANA_OM_AM_PEP_SECTION_GID is an optional override. */
export const OM_PROJECT_GID = process.env.ASANA_OM_PROJECT_GID || '1213914392047129';
export const OM_SECTION_AM_PEP = 'Adverse Media & PEP Monitoring';
/* Audit tasks are assigned to the token bearer by default; override with a user GID. */
const OM_ASSIGNEE = process.env.ASANA_OM_ASSIGNEE_GID || 'me';
/* Number of adverse-media risk keywords queried per subject (provenance line) —
   the union across every language in the worldwide sweep, not just English. */
export const AM_KEYWORD_COUNT = ALL_TERMS.length;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* Render an ISO date (YYYY-MM-DD) as "24 Jun 2026" for human-facing task names. */
export function formatHumanDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return Number(m[3]) + ' ' + (MONTHS[Number(m[2]) - 1] || '???') + ' ' + m[1];
}

/* A score at/above this fraction (engine scores are 0-100) is treated as a match
   even absent an explicit recommendation. Override with SCREEN_MATCH_THRESHOLD. */
export const DEFAULT_THRESHOLD = Number(process.env.SCREEN_MATCH_THRESHOLD) || 0.85;

/* Recommendations / bands that mean "no action". Anything else the engine returns
   is treated as a positive signal (conservative — errs toward flagging). */
const CLEAR_RE = /^(clear|no[_\s-]?match|no[_\s-]?hit|pass|passed|negative|none|nil|ok|false[_\s-]?positive|not[_\s-]?listed|low)$/i;
const HIGH_BANDS = new Set(['critical', 'high', 'severe', 'elevated', 'red', 'amber']);
/* Enrichment signals (best-effort, network-bound) vs. the always-run local
   sanctions match. A standing match derived solely from these must NOT be cleared
   on a run where the lookup errored or was time-budget-skipped (see diffState). */
const ENRICHMENT_LISTS = new Set(['Adverse media (Google News)', 'PEP (Wikidata)', 'Interpol Red Notice']);

/* ── Pure helpers (no network; unit-tested) ───────────────────────────────── */

function matchField(notes, re) {
  const m = re.exec(String(notes || ''));
  return m ? m[1].trim().replace(/[\s.;,]+$/, '') : '';
}

/* Turn one Asana customer task into a screening subject. Name is the minimum;
   jurisdiction / id are parsed from the due-diligence notes when present so the
   engine can disambiguate. */
export function parseSubject(task) {
  const name = String((task && task.name) || '').trim();
  const notes = String((task && task.notes) || '');
  const jurisdiction = matchField(notes, /(?:Jurisdiction|Country of Incorporation|Country of Registration|Country)\s*[:\-]\s*([^\n]+)/i);
  const idNumber = matchField(notes, /(?:Trade Licence|Trade License|Licen[cs]e No\.?|Registration(?: No\.?| Number)?|Commercial Register(?:ation)?(?: No\.?)?)\s*[:\-]\s*([^\n]+)/i);
  return {
    key: normalizeName(name),
    name,
    entityType: 'organisation',
    jurisdiction: jurisdiction || undefined,
    idNumber: idNumber || undefined,
    gid: (task && task.gid) || undefined
  };
}

/* Pull the natural-person principals (UBOs / shareholders / directors / signatories)
   out of a customer record so each is screened in their OWN right — not only the
   company name. The CDD notes record them under "SECTION 4 — IDENTIFICATIONS" as
   repeated "Individual N — <role>" blocks, each with a "Name:" (and usually a
   "Nationality:"). Returns [{ name, role, nationality }]. Tolerant: if the block
   isn't structured that way it falls back to every "Name:" inside the section. */
export function parsePrincipals(task) {
  const notes = String((task && task.notes) || '');
  if (!notes) return [];
  // Isolate the identifications section (stop at the next "SECTION n" or EOF).
  const sec = /SECTION\s*4\b[^\n]*(?:IDENTIFICATION|IDENTITIES|UBO|BENEFICIAL|SHAREHOLDER|DIRECTOR)[\s\S]*?(?=\n\s*(?:SECTION|PART)\b|$)/i.exec(notes);
  const block = sec ? sec[0] : '';
  if (!block) return [];
  const people = [];
  const seen = new Set();
  const push = (name, role, nationality) => {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    const k = normalizeName(n);
    if (!n || !k || seen.has(k)) return;
    // Guard against label rows being read as a name.
    if (/^(n\/?a|none|nil|not applicable|pending|tbc)$/i.test(n)) return;
    seen.add(k);
    people.push({ name: n, role: String(role || 'Principal').replace(/\s+/g, ' ').trim(), nationality: String(nationality || '').trim() });
  };
  const partRe = /Individual\s*\d+\s*[—\-–:]\s*([^\n]*)([\s\S]*?)(?=Individual\s*\d+\s*[—\-–:]|$)/gi;
  let m, structured = false;
  while ((m = partRe.exec(block))) {
    const role = m[1].trim();
    const sub = m[2] || '';
    const nm = /\bName\s*:\s*([^\n]+)/i.exec(sub);
    if (nm) { structured = true; const nat = /\bNationality\s*:\s*([^\n]+)/i.exec(sub); push(nm[1], role || 'Principal', nat ? nat[1] : ''); }
  }
  if (!structured) {
    // No "Individual N —" structure: harvest names from explicit name-bearing
    // labels too (UBO / beneficial owner / signatory), not only "Name:".
    const nameRe = /\b(?:Name|UBO|Beneficial Owner|Authori[sz]ed Signatory|Signatory|Shareholder|Director|Partner)\s*:\s*([^\n]+)/gi;
    let n;
    while ((n = nameRe.exec(block))) push(n[1], 'Principal', '');
  }
  return people;
}

/* Active customers only (completed tasks are off-boarded / archived). Each active
   customer yields the legal entity PLUS every recorded principal (UBO / director /
   shareholder) as its own screening subject, so natural persons are screened, not
   just the company name. Individuals carry the parent customer's gid so an alert
   still points at the right record. */
export function parseSubjects(tasks) {
  const out = [];
  const seen = new Set();
  for (const t of (Array.isArray(tasks) ? tasks : [])) {
    if (t && t.completed) continue;
    const s = parseSubject(t);
    // Dedupe the legal ENTITY by normalized name, but do NOT skip the whole
    // record on a collision: two distinct active customers can share a legal
    // name (duplicate onboarding / same trade name), and the second one's
    // principals (UBOs/directors) must still be screened — they are keyed by
    // parent gid below, so they never collide. Only the duplicate entity row is
    // suppressed; principals are always processed.
    if (s.name && !seen.has(s.key)) {
      seen.add(s.key);
      out.push(s);
    }
    for (const p of parsePrincipals(t)) {
      const norm = normalizeName(p.name);
      if (!norm) continue;
      /* Key an individual by (name + parent customer), NOT by name alone, so a
         principal is never dropped by a normalized-name collision with a legal
         entity or with a same-named principal of a DIFFERENT customer — every
         recorded person is screened and linked to their own record. A repeat of
         the same person under the SAME customer is deduped. */
      const key = norm + '|ubo|' + ((t && t.gid) || s.key);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key, name: p.name, entityType: 'individual',
        jurisdiction: p.nationality || undefined,
        gid: (t && t.gid) || undefined,
        parent: s.name, role: p.role || 'Principal',
      });
    }
  }
  return out;
}

function num(v) { return typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && v.trim() && isFinite(Number(v)) ? Number(v) : null); }

/* Normalise one entry of a result's `lists` detail (string or object). */
export function normalizeHit(h) {
  if (h == null) return null;
  if (typeof h === 'string') return { list: h, hitName: '', score: null };
  if (typeof h !== 'object') return null;
  const list = h.list || h.listName || h.source || h.dataset || h.programme || h.program || h.regime || h.sanctionsList || h.name || '';
  const hitName = h.hitName || h.matchedName || h.caption || h.entity || (h.list ? h.name : '') || '';
  const score = num(h.matchScore != null ? h.matchScore : (h.score != null ? h.score : h.confidence));
  return { list: String(list), hitName: String(hitName || ''), score };
}

/* Normalise one engine result row (keyed back to the subject it screened so
   jurisdiction/gid survive). */
export function normalizeResult(r, src) {
  const raw = Array.isArray(r.lists) ? r.lists : (Array.isArray(r.hits) ? r.hits : (Array.isArray(r.matches) ? r.matches : []));
  const subjName = r.name || (r.subject && (r.subject.name || r.subject)) || r.query || '';
  return {
    key: src ? src.key : normalizeName(subjName),
    name: (src && src.name) || String(subjName),
    jurisdiction: src && src.jurisdiction,
    gid: src && src.gid,
    entityType: (src && src.entityType) || 'organisation',
    parent: src && src.parent,
    role: src && src.role,
    topScore: num(r.topScore != null ? r.topScore : (r.score != null ? r.score : r.matchScore)),
    band: String(r.band || r.riskBand || '').toLowerCase(),
    recommendation: String(r.recommendation || r.disposition || r.decision || '').toLowerCase(),
    hitCount: num(r.hitCount != null ? r.hitCount : r.elevatedCount) || 0,
    lists: raw.map(normalizeHit).filter(Boolean)
  };
}

/* Normalise the whole engine response to {results:[…], degraded}. Tolerates
   {results:[…]} | {data:[…]} | […] | a single result object. */
export function normalizeScreenResponse(json, subjects = []) {
  const byKey = new Map(subjects.map(s => [s.key, s]));
  let rows = [];
  if (Array.isArray(json)) rows = json;
  else if (json && Array.isArray(json.results)) rows = json.results;
  else if (json && Array.isArray(json.data)) rows = json.data;
  else if (json && (json.name || json.subject)) rows = [json];
  const degraded = !!(json && (json.degraded || (json._provenance && json._provenance.degraded)));
  const results = rows.map(r => {
    const key = normalizeName(r.name || (r.subject && (r.subject.name || r.subject)) || '');
    return normalizeResult(r, byKey.get(key));
  });
  return { results, degraded };
}

/* Is this subject a material match? Trust the engine's own recommendation first;
   otherwise fall back to band / score / list hits. Threshold is a fraction (0-1);
   engine scores are 0-100. A "clear" recommendation is only overridden by a hard
   signal (an actual list hit or a maxed score). */
export function isMatch(r, threshold) {
  if (!r) return false;
  const thr = (typeof threshold === 'number' ? threshold : DEFAULT_THRESHOLD) * 100;
  const hasList = !!(r.lists && r.lists.length);
  if (r.recommendation && CLEAR_RE.test(r.recommendation)) {
    return hasList || (typeof r.topScore === 'number' && r.topScore >= 100);
  }
  if (r.recommendation) return true;                       /* any non-clear recommendation */
  if (r.band && HIGH_BANDS.has(r.band)) return true;
  if (typeof r.topScore === 'number' && r.topScore >= thr) return true;
  if (r.hitCount > 0) return true;
  return hasList;
}

/* A stable signature of the match so a standing match is not re-alerted but a
   CHANGED one (new list, escalated band) is. */
export function matchSignature(r) {
  const lists = (r.lists || []).map(h => h.list).filter(Boolean).sort().join(',');
  return [r.band || '', r.recommendation || '', lists].join('|');
}

/* Diff this run's matches against the recorded state. Returns the NEW/CHANGED
   matches to alert on, the cleared matches (informational), and the next state.
   Subjects that errored this run carry their prior state forward untouched —
   never wiped, never silently cleared. */
export function diffState(prevState, results, today, threshold, screenedLists) {
  const prev = (prevState && prevState.subjects) || {};
  const nextSubjects = { ...prev };
  const alerts = [];
  const cleared = [];
  let matchCount = 0;
  // Names of the SANCTIONS lists actually loaded/screened this run. A prior
  // sanctions match whose originating list did NOT load this run must be carried
  // forward, never cleared — we did not re-verify it, so "no longer matches" is a
  // coverage artefact (a failed download / 0-name parse), not a de-listing.
  // Omitted on the external-engine path and in unit tests → guard inactive,
  // behaviour unchanged.
  const screened = screenedLists ? new Set(Array.from(screenedLists)) : null;

  for (const r of results) {
    if (r.errored) continue;
    if (isMatch(r, threshold)) {
      matchCount++;
      const sig = matchSignature(r);
      const prior = prev[r.key];
      const firstSeen = (prior && prior.firstSeen) || today;
      nextSubjects[r.key] = {
        name: r.name, jurisdiction: r.jurisdiction, band: r.band, topScore: r.topScore,
        recommendation: r.recommendation, lists: (r.lists || []).map(h => h.list).filter(Boolean),
        signature: sig, firstSeen, lastSeen: today
      };
      if (!prior || prior.signature !== sig) {
        alerts.push({ key: r.key, name: r.name, jurisdiction: r.jurisdiction, gid: r.gid,
          entityType: r.entityType, parent: r.parent, role: r.role,
          band: r.band, topScore: r.topScore, recommendation: r.recommendation, lists: r.lists || [], isNew: !prior });
      }
    } else if (prev[r.key]) {
      const prior = prev[r.key];
      // A prior match derived ONLY from enrichment signals (PEP / adverse media /
      // Interpol) must not be silently cleared on a run where that lookup errored
      // or was budget-skipped — we did not actually re-verify it. Carry it forward
      // untouched (no alert, no clear); a later run that completes enrichment will
      // clear it legitimately. (A prior SANCTIONS hit is always re-checked locally,
      // so a genuine de-listing still clears.)
      const priorEnrichmentOnly = Array.isArray(prior.lists) && prior.lists.length > 0
        && prior.lists.every(l => ENRICHMENT_LISTS.has(l));
      if (r.enrichmentIncomplete && priorEnrichmentOnly) {
        continue;   // leave nextSubjects[r.key] (the copied prior) in place
      }
      // Degrade-loudly: if a SANCTIONS list that produced this prior match failed
      // to load this run, we could not re-screen the subject against it — carry the
      // match forward (no clear, no case auto-completion) rather than declaring an
      // all-clear off the back of a fetch/parse failure.
      if (screened) {
        const priorSanctionsLists = (Array.isArray(prior.lists) ? prior.lists : [])
          .filter(l => !ENRICHMENT_LISTS.has(l));
        if (priorSanctionsLists.some(l => !screened.has(l))) {
          continue;   // originating list not screened this run → keep the standing match
        }
      }
      cleared.push({ key: r.key, name: r.name, prior });
      delete nextSubjects[r.key];
    }
  }

  return { alerts, cleared, matchCount, nextState: { updated: today, subjects: nextSubjects } };
}

/* The governance footer every screening output carries — detection is automatic,
   the consequence is a reviewed, dual-attested decision. */
export const GOVERNANCE_NOTE =
  'Detection is automatic. Do NOT freeze, decline or report on a match before MLRO review and a two-person (four-eyes) sign-off — UAE Federal Decree-Law No. 10 of 2025 Art.16/18; FATF R.26. A possible name match is not confirmation: disambiguate against the customer’s identifiers first.';

/* Label a subject for an alert row — natural-person principals carry their role
   and the customer they belong to, so the MLRO sees "a UBO of X is listed", not a
   bare name. Legal entities show their own name. */
export function subjectLabel(a) {
  if (a && a.entityType === 'individual') {
    const ctx = [a.role || 'Principal', a.parent ? 'of ' + a.parent : ''].filter(Boolean).join(' ');
    return a.name + (ctx ? ' — ' + ctx : '') + ' [individual]';
  }
  return a ? a.name : '';
}

/* One-line summary of a match for tables/cards. */
export function matchSummary(a) {
  const bits = [];
  if (a.band) bits.push(a.band.toUpperCase());
  if (typeof a.topScore === 'number') bits.push('score ' + a.topScore);
  if (a.recommendation) bits.push(a.recommendation);
  const lists = [...new Set((a.lists || []).map(h => (typeof h === 'string' ? h : h.list)).filter(Boolean))];
  if (lists.length) bits.push('lists: ' + lists.join(', '));
  return bits.join(' · ') || 'flagged';
}

/* Plain-text report — the no-token preview, the issue-fallback body, the run log. */
export function buildScreenReport(alerts, cleared, today, meta = {}) {
  const lines = [];
  lines.push('# Sanctions Screen — ' + today, '');
  const breakdown = (meta.entities != null && meta.individuals != null)
    ? ' (' + meta.entities + ' legal entities + ' + meta.individuals + ' principals/UBOs)' : '';
  lines.push('Screened **' + (meta.screened != null ? meta.screened : '?') + '** subjects from the FULL Customer Database' + breakdown + ' against: ' + COVERAGE + '.', '');
  if (meta.degraded) lines.push('> ⚠ The screening engine reported **degraded** coverage on this run — treat any "no match" as provisional and re-run.', '');
  if (meta.errored) lines.push('> ⚠ **' + meta.errored + '** subject(s) could not be screened this run (engine error/timeout) — their prior status was kept, not cleared.', '');

  if (!alerts.length) {
    lines.push('No **new** sanctions/watchlist matches.', '');
  } else {
    lines.push('**' + alerts.length + ' customer(s) with a new/changed match — review immediately.**', '');
    lines.push('| Subject | Jurisdiction | Match |', '| --- | --- | --- |');
    for (const a of alerts) {
      lines.push('| ' + subjectLabel(a) + ' | ' + (a.jurisdiction || '') + ' | ' + matchSummary(a) + ' |');
    }
    lines.push('');
  }
  if (cleared && cleared.length) {
    lines.push('<details><summary>' + cleared.length + ' previously-recorded match(es) no longer returned (no action — informational)</summary>', '');
    for (const c of cleared) lines.push('- ' + c.name + ' — was ' + matchSummary(c.prior || {}));
    lines.push('', '</details>', '');
  }
  lines.push('_' + GOVERNANCE_NOTE + '_');
  return lines.join('\n');
}

/* Asana rich-text body (html_notes) for the alert card. */
export function buildScreenHtml(alerts, { runLink, today, degraded } = {}) {
  const items = alerts.map(a => {
    const juris = a.jurisdiction ? ' (' + esc(a.jurisdiction) + ')' : '';
    const who = a.entityType === 'individual'
      ? '<strong>' + esc(a.name) + '</strong> <em>(' + esc([a.role || 'Principal', a.parent ? 'of ' + a.parent : ''].filter(Boolean).join(' ')) + ')</em>'
      : '<strong>' + esc(a.name) + '</strong>';
    return '<li>' + who + juris + ' — ' + esc(matchSummary(a)) + '</li>';
  }).join('');
  const n = alerts.length;
  const parts = ['<body>'];
  parts.push('<h2>⚠ Sanctions screen — ' + n + ' customer' + (n === 1 ? '' : 's') + ' with a new match' + (today ? ' (' + esc(today) + ')' : '') + '</h2>');
  parts.push('<strong>' + n + ' active counterpart' + (n === 1 ? 'y' : 'ies') + ' in the Customer Database now match a sanctions/watchlist. Review immediately.</strong>');
  if (degraded) parts.push('<em>⚠ Engine coverage was degraded this run — treat any non-match as provisional.</em>');
  if (items) parts.push('<ul>' + items + '</ul>');
  parts.push('<em>' + esc(GOVERNANCE_NOTE) + '</em>');
  parts.push('<strong>Screened against:</strong> ' + esc(COVERAGE));
  if (runLink) parts.push('<a href="' + esc(runLink) + '">View the workflow run</a>');
  parts.push('</body>');
  return parts.join('');
}

/* Map alerts to the {date, mode, changes:[…]} artifact shape (parity with the
   other watchers) so the change is never lost even if Asana posting fails. */
export function buildChangesArtifact(alerts, today) {
  return {
    date: today,
    mode: 'screen',
    changes: alerts.map(a => ({
      name: a.name + ' — sanctions match (' + matchSummary(a) + ')',
      jurisdiction: a.jurisdiction || '',
      status: 'new',
      band: a.band,
      topScore: a.topScore,
      recommendation: a.recommendation,
      lists: (a.lists || []).map(h => (typeof h === 'string' ? h : h.list)).filter(Boolean)
    }))
  };
}

/* ── Ongoing Monitoring — pure note builders (offline-testable) ────────────── */

const RULE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

/* One result row from screen.results → a short adverse-media hit line. The risk
   category travels in the "[terms]" suffix the screener appends to hitName. */
function amHitLine(r) {
  const h = (r.lists || []).find(x => x.list && x.list.includes('Adverse media')) || {};
  const headline = String(h.hitName || '').slice(0, 120);
  return '  ' + r.name + ' | Google News | ' + headline + (h.score != null ? ' | score ' + h.score : '');
}
/* One result row from screen.results → a short PEP hit line. */
function pepHitLine(r) {
  const h = (r.lists || []).find(x => x.list && x.list.includes('PEP')) || {};
  return '  ' + r.name + ' | Wikidata | ' + String(h.hitName || '').slice(0, 120) + (h.score != null ? ' | score ' + h.score : '');
}

/* PART B — Adverse Media & PEP monitoring task body (CLEAR or HIT variant). */
export function buildAmPepNotes({ today, tomorrow, run, subjects, amHits = [], pepHits = [], regUrl = '', amKeywordCount = AM_KEYWORD_COUNT } = {}) {
  const hasHits = amHits.length > 0 || pepHits.length > 0;
  const L = [];
  L.push('ADVERSE MEDIA & PEP MONITORING REPORT');
  L.push('Date: ' + today + ' | Run: ' + (run || 'local'));
  L.push('Script: scripts/sanctions-screen.mjs');
  L.push('Legal basis: Article 19(1)(b) FDL No. 10/2025 | Article 13 CR No. 134/2025');
  L.push('Sources: Google News RSS (adverse media) | Wikidata (PEP)');
  L.push('');
  L.push(RULE);
  L.push('A. SCOPE');
  L.push(RULE);
  L.push('Subjects checked:             ' + (subjects != null ? subjects : '?'));
  L.push('Adverse media module:         ACTIVE (worldwide — Google News RSS × ' + LOCALES.length + ' locales + GDELT, ' + amKeywordCount + ' keywords across ' + Object.keys(LANG_TERMS).length + ' languages)');
  L.push('PEP module:                   ACTIVE (Wikidata — Tier 1/2/3 + family/associates)');
  L.push('');
  L.push('Risk categories (adverse media):');
  L.push('  ☑ Money laundering / financial crime');
  L.push('  ☑ Fraud / corruption / bribery');
  L.push('  ☑ Sanctions evasion');
  L.push('  ☑ Arms / proliferation financing');
  L.push('  ☑ Human rights / conflict minerals');
  L.push('  ☑ Environmental crime / illegal mining');
  L.push('  ☑ Regulatory enforcement / fines / debarment');
  L.push('');
  L.push('PEP tiers monitored:');
  L.push('  ☑ Tier 1 — Heads of state / senior government / judiciary / military');
  L.push('  ☑ Tier 2 — Senior political party officials / legislative bodies');
  L.push('  ☑ Tier 3 — SOE executives / international organisation officials');
  L.push('  ☑ Family members and close associates (all tiers)');
  L.push('');
  L.push(RULE);
  L.push('B. RESULTS');
  L.push(RULE);
  if (!hasHits) {
    L.push('New adverse media hits:       NONE');
    L.push('New PEP identifications:      NONE');
    L.push('PEP status changes:           NONE');
    L.push('False positives cleared:      NONE');
  } else {
    L.push('New adverse media hits:       ' + amHits.length);
    for (const r of amHits) L.push(amHitLine(r));
    L.push('New PEP identifications:      ' + pepHits.length);
    for (const r of pepHits) L.push(pepHitLine(r));
    L.push('False positives cleared:      [to be reviewed by MLRO]');
  }
  L.push('');
  L.push('Sanctions screening result:   → see Daily Screening Report (same day)');
  L.push('');
  L.push(RULE);
  L.push('C. ACTIONS TAKEN');
  L.push(RULE);
  L.push('EDD triggered:                N/A');
  L.push('Risk rating upgraded:         N/A');
  L.push('Senior management notified:   N/A');
  L.push('STR consideration opened:     N/A');
  L.push('Relationship paused/exited:   N/A');
  L.push('');
  L.push(RULE);
  if (!hasHits) {
    L.push('STATUS: ✅ CLEAR');
    L.push(RULE);
    L.push('Detection automatic. Action requires MLRO review.');
    L.push('Next run: ' + (tomorrow || ''));
  } else {
    L.push('STATUS: ⚠ REVIEW REQUIRED — see alert card in Regulations project');
    L.push(RULE);
    if (regUrl) L.push('Link to the Regulations alert: ' + regUrl);
    L.push('Detection automatic. Action requires MLRO review.');
    L.push('Next run: ' + (tomorrow || ''));
  }
  return L.join('\n');
}

/* ── Network (runner only; not imported by tests) ─────────────────────────── */

async function withTimeout(promiseFactory, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await promiseFactory(ctrl.signal); }
  finally { clearTimeout(t); }
}

/* 429/5xx are retried with bounded backoff (shared policy from asana-notify);
   each attempt gets its own timeout so a hang still fails loudly. */
const asanaSleep = ms => new Promise(res => setTimeout(res, ms));

async function asanaGet(url, token, timeoutMs = 30000) {
  for (let attempt = 0; ; attempt++) {
    const { ok, status, retryAfter, data } = await withTimeout(async (signal) => {
      const r = await fetch(url, { signal, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, retryAfter: r.headers.get('retry-after'), data: d };
    }, timeoutMs);
    if (ok) return data;
    if (attempt < 2 && isRetryable(status)) {
      const delay = retryDelayMs(attempt, retryAfter);
      console.warn('sanctions-screen: Asana ' + status + ' — retry in ' + delay + 'ms');
      await asanaSleep(delay);
      continue;
    }
    throw new Error('Asana ' + status + ': ' + JSON.stringify(data.errors || data).slice(0, 200));
  }
}

async function fetchAsanaSubjects(projectGid, token) {
  const tasks = [];
  let offset = null, pages = 0;
  do {
    const u = new URL('https://app.asana.com/api/1.0/projects/' + projectGid + '/tasks');
    u.searchParams.set('opt_fields', 'name,completed,notes');
    u.searchParams.set('limit', '100');
    if (offset) u.searchParams.set('offset', offset);
    const json = await asanaGet(u, token);
    for (const t of (json.data || [])) tasks.push(t);
    offset = json.next_page && json.next_page.offset;
  } while (offset && ++pages < 500);
  return parseSubjects(tasks);
}

/* ── Ongoing Monitoring — Asana writers (runner only) ─────────────────────── */

async function asanaPost(path, body, token, timeoutMs = 30000) {
  for (let attempt = 0; ; attempt++) {
    const { ok, status, retryAfter, data } = await withTimeout(async (signal) => {
      const r = await fetch('https://app.asana.com/api/1.0' + path, {
        signal, method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ data: body })
      });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, retryAfter: r.headers.get('retry-after'), data: d };
    }, timeoutMs);
    if (ok) return data;
    if (attempt < 2 && isRetryable(status)) {
      const delay = retryDelayMs(attempt, retryAfter);
      console.warn('sanctions-screen: Asana ' + status + ' — retry in ' + delay + 'ms');
      await asanaSleep(delay);
      continue;
    }
    throw new Error('Asana ' + status + ': ' + JSON.stringify(data.errors || data).slice(0, 200));
  }
}

/* Resolve a section GID by name within a project, creating it if absent. Lets
   the daily run self-provision the Ongoing Monitoring sections — no manual setup,
   idempotent (a name that already exists is reused). */
async function ensureSection(projectGid, name, token) {
  const u = new URL('https://app.asana.com/api/1.0/projects/' + projectGid + '/sections');
  u.searchParams.set('opt_fields', 'name');
  u.searchParams.set('limit', '100');
  const json = await asanaGet(u, token);
  const want = String(name).trim().toLowerCase();
  const found = (json.data || []).find(s => String(s.name || '').trim().toLowerCase() === want);
  if (found) return found.gid;
  const created = await asanaPost('/projects/' + projectGid + '/sections', { name }, token);
  return created.data && created.data.gid;
}

/* All task names in a project (paginated) — used for same-day dedup. */
async function fetchTaskNames(projectGid, token) {
  const names = [];
  let offset = null, pages = 0;
  do {
    const u = new URL('https://app.asana.com/api/1.0/projects/' + projectGid + '/tasks');
    u.searchParams.set('opt_fields', 'name');
    u.searchParams.set('limit', '100');
    if (offset) u.searchParams.set('offset', offset);
    const json = await asanaGet(u, token);
    for (const t of (json.data || [])) names.push(String(t.name || ''));
    offset = json.next_page && json.next_page.offset;
  } while (offset && ++pages < 500);
  return names;
}

/* Create a task in the Ongoing Monitoring project and file it under its section.
   Returns the task permalink (or null). Filing under the section is non-fatal. */
async function createOmTask({ name, notes, projectGid, sectionGid, due }, token) {
  const data = { name: String(name).slice(0, 250), notes: String(notes).slice(0, 60000), projects: [projectGid] };
  if (due) data.due_on = due;
  if (OM_ASSIGNEE) data.assignee = OM_ASSIGNEE;
  const d = await asanaPost('/tasks', data, token);
  const gid = d.data && d.data.gid;
  if (gid && sectionGid) {
    try { await asanaPost('/sections/' + sectionGid + '/addTask', { task: gid }, token); }
    catch (e) { console.warn('sanctions-screen: could not file task under section ' + sectionGid + ' (' + (e && e.message || e) + ')'); }
  }
  return d.data && d.data.permalink_url;
}

/* PART B — post the daily Adverse Media & PEP task (CLEAR or HIT). Never throws;
   returns { posted, skipped, url, name } for the run log. */
async function postOngoingMonitoringTask(subjects, screen, alerts, today, cfg, token, regUrl) {
  if (!token) { console.log('sanctions-screen: no Asana token — skipping AM/PEP task'); return { posted: false }; }
  const dateStr = formatHumanDate(today);
  try {
    const projectGid = OM_PROJECT_GID;
    const sectionGid = process.env.ASANA_OM_AM_PEP_SECTION_GID || await ensureSection(projectGid, OM_SECTION_AM_PEP, token);

    const results = screen.results || [];
    const amHits = results.filter(r => (r.lists || []).some(h => h.list && h.list.includes('Adverse media')));
    const pepHits = results.filter(r => (r.lists || []).some(h => h.list && h.list.includes('PEP')));
    const hitCount = new Set([...amHits, ...pepHits].map(r => r.key || r.name)).size;
    const hasHits = amHits.length > 0 || pepHits.length > 0;

    const name = hasHits
      ? '⚠ Adverse Media / PEP HIT — ' + dateStr + ' — ' + hitCount + ' subject(s)'
      : 'Adverse Media & PEP — CLEAR — ' + dateStr;

    const names = await fetchTaskNames(projectGid, token);
    const already = names.find(n => n.includes(dateStr) && (n.includes('Adverse Media') || n.includes('PEP')));
    if (already) { console.log('sanctions-screen: already posted: ' + already); return { posted: false, skipped: true, name: already }; }

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const notes = buildAmPepNotes({ today, tomorrow, run: runUrl(), subjects: subjects.length, amHits, pepHits, regUrl });
    const url = await createOmTask({ name, notes, projectGid, sectionGid }, token);
    console.log('sanctions-screen: AM/PEP task created — ' + name + (url ? ' — ' + url : ''));
    return { posted: true, url, name };
  } catch (e) {
    console.error('sanctions-screen: AM/PEP task failed (' + (e && e.message || e) + ') — screening output unaffected');
    return { posted: false, error: String(e && e.message || e) };
  }
}

/* Fetch one consolidated list — a remote URL, or an in-repo curated file
   (source.file, e.g. the UAE EOCN list). Returns the raw body or throws. */
async function fetchListBody(source, timeoutMs = 60000) {
  if (source.file) {
    if (!existsSync(source.file)) throw new Error('curated file missing: ' + source.file);
    return readFileSync(source.file, 'utf8');
  }
  /* The URL comes from the in-repo sources config; still validate the scheme so a
     tampered/extra source can only ever trigger an ordinary http(s) GET (never
     file:, ftp:, etc.) before it reaches fetch. */
  let parsed;
  try { parsed = new URL(source.url); } catch { throw new Error('invalid url'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('unsupported url scheme: ' + parsed.protocol);
  /* XLSX sources (e.g. Australia DFAT) are binary ZIP containers — read the raw
     bytes as a Buffer; reading them as text would corrupt the archive. Text lists
     (CSV/XML) stay on the string path the parsers expect. */
  const binary = /^(xlsx|dfat)$/.test(String(source.parser || '').toLowerCase())
    || String(source.type || '').toLowerCase() === 'xlsx'
    || /\.xlsx(\?|$)/i.test(parsed.href);
  return withTimeout(async (signal) => {
    const r = await fetch(parsed.href, { signal, redirect: 'follow', headers: { 'user-agent': 'HawkeyeSterling-SanctionsScreen/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
  }, timeoutMs);
}

/* Fetch + parse every enabled source into [{ id, name, names[] }]. A source that
   fails to fetch or yields zero names degrades coverage (reported, never a silent
   all-clear); a curated list with no entries degrades too. */
async function loadSanctionsLists(cfg) {
  let sources;
  try { sources = loadSources(readFileSync(cfg.sourcesFile, 'utf8')).filter(s => s.enabled !== false); }
  catch (e) { return { lists: [], degraded: true, fetched: 0, total: 0, notes: ['sources file unreadable: ' + (e && e.message || e)] }; }

  /* Extra / curated lists (e.g. the UAE EOCN file, or extra national XML lists)
     are loaded leniently — a curated entry has `file` instead of `url`, which the
     strict loadSources validator rejects. */
  if (existsSync(cfg.extraFile)) {
    try {
      const extra = JSON.parse(readFileSync(cfg.extraFile, 'utf8'));
      for (const s of ((extra && extra.sources) || [])) if (s && s.enabled !== false && (s.url || s.file)) sources.push(s);
    } catch (e) { console.error('sanctions-screen: extra sources unreadable (' + (e && e.message || e) + ')'); }
  }

  const lists = [], notes = [];
  let fetched = 0;
  await Promise.all(sources.map(async (s) => {
    try {
      /* Per-source override for slow generators (SECO's SESAM service builds the
         full-list XML on request and blows the flat 60s budget). */
      const body = await fetchListBody(s, Number(s.timeoutMs) || cfg.listTimeoutMs);
      const names = parseList(s, body);
      if (!names.length) { notes.push(s.name + ' parsed 0 names — coverage degraded'); console.error('sanctions-screen: ' + s.id + ' parsed 0 names'); return; }
      lists.push({ id: s.id, name: s.name, names });
      fetched++;
      console.log('sanctions-screen: loaded ' + s.name + ' (' + names.length + ' designated names)');
    } catch (e) {
      notes.push(s.name + ' could not be loaded (' + (e && e.message || e) + ') — coverage degraded');
      console.error('sanctions-screen: ' + s.id + ' failed — ' + (e && e.message || e));
    }
  }));
  return { lists, degraded: fetched < sources.length, fetched, total: sources.length, notes };
}

/* Run an async fn over items with bounded concurrency (keeps the per-subject
   adverse-media / PEP lookups polite). */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return out;
}

const BAND_RANK = { critical: 4, high: 3, medium: 2, low: 1, '': 0 };
const strongerBand = (a, b) => ((BAND_RANK[a] || 0) >= (BAND_RANK[b] || 0) ? a : b);

/* Screen every subject locally: sanctions name-match against the loaded lists,
   plus (optional) adverse-media and PEP signals. Produces the SAME normalised
   per-subject rows the engine path produced, so diff/alert/report are unchanged.
   Each signal contributes a `lists[]` entry; a subject with any hit is material. */
async function screenLocally(subjects, cfg) {
  const loaded = await loadSanctionsLists(cfg);
  /* No list at all = we cannot screen sanctions — never infer a clean result. */
  if (!loaded.lists.length) return { results: [], anyOk: false, degraded: true, errored: 0, notes: loaded.notes, coverage: loaded };

  const index = buildIndex(loaded.lists);
  const thr = cfg.threshold * 100;
  console.log('sanctions-screen: indexed ' + index.size + ' designated names from ' + loaded.lists.length + ' list(s); matching ' + subjects.length + ' subjects (threshold ' + thr + ')');

  /* `degraded` reflects SANCTIONS coverage only (a list failed to load / parsed
     0 names). Adverse-media and PEP are best-effort enrichment signals — when
     they're unavailable (e.g. Wikidata rate-limits the PEP lookups) we record it
     and report it, but it does NOT degrade the sanctions screen or weaken its
     "no match" result. Keeping the degraded flag sanctions-only keeps it meaningful. */
  const degraded = loaded.degraded;
  let amErrors = 0, pepErrors = 0, interpolErrors = 0, enrichSkipped = 0;
  /* The SANCTIONS match (local, instant) is ALWAYS run for every subject. The
     adverse-media / PEP / Interpol enrichment is best-effort and network-bound, so
     bound the whole enrichment phase by a wall-clock budget: once it elapses the
     remaining subjects are still fully sanctions-screened but skip enrichment, so a
     large (and growing) customer base can never push the job past its timeout.
     Skipped enrichment is recorded, NOT treated as degraded sanctions coverage. */
  const enrichDeadline = Date.now() + cfg.enrichBudgetMs;
  /* Heartbeat with memory readings: on 2026-07-08 two consecutive runs were
     killed at VM level ("runner received a shutdown signal") ~9.5 min into this
     phase with zero output in between, leaving no way to tell a CPU stall from
     enrichment pace from memory growth. The trajectory below makes the next
     such death diagnosable from the log alone. */
  const phaseStart = Date.now();
  let phaseDone = 0;
  const heartbeat = () => {
    phaseDone++;
    if (phaseDone % 50 === 0 || phaseDone === subjects.length) {
      const mu = process.memoryUsage();
      console.log('sanctions-screen: progress ' + phaseDone + '/' + subjects.length
        + ' subjects — ' + Math.round((Date.now() - phaseStart) / 1000) + 's — rss '
        + Math.round(mu.rss / 1048576) + 'MB heap ' + Math.round(mu.heapUsed / 1048576) + 'MB');
    }
  };
  const results = await mapLimit(subjects, cfg.concurrency, async (s) => {
    const raw = screenName(s.name, index, thr);   // { name, topScore, band, recommendation, hitCount, lists[] }
    const lists = [...raw.lists];
    let band = raw.lists.length ? raw.band : '';
    let topScore = raw.lists.length ? raw.topScore : 0;
    const enrich = Date.now() < enrichDeadline;
    // Track whether any requested enrichment signal could NOT be evaluated this
    // run (errored or budget-skipped) so diffState won't silently clear a standing
    // enrichment-only match it couldn't re-verify.
    let enrichmentIncomplete = false;
    if (!enrich && (cfg.adverseMedia || cfg.pep || cfg.interpol)) { enrichSkipped++; enrichmentIncomplete = true; }

    if (cfg.adverseMedia && enrich) {
      const am = await checkAdverseMedia(s.name, { timeoutMs: cfg.checkTimeoutMs });
      if (am.errored) { amErrors++; enrichmentIncomplete = true; }
      else if (am.hit) {
        lists.push({ list: 'Adverse media (Google News)', hitName: (am.top && am.top.title || '').slice(0, 180) + (am.terms.length ? ' [' + am.terms.join(', ') + ']' : ''), score: am.score });
        band = strongerBand(band, am.band); topScore = Math.max(topScore, am.score);
      }
    }
    if (cfg.pep && enrich) {
      const pp = await checkPep(s.name, { timeoutMs: cfg.checkTimeoutMs });
      if (pp.errored) { pepErrors++; enrichmentIncomplete = true; }
      else if (pp.hit) {
        lists.push({ list: 'PEP (Wikidata)', hitName: (pp.match && (pp.match.label + ' — ' + pp.match.description) || '').slice(0, 180), score: pp.score });
        band = strongerBand(band, pp.band); topScore = Math.max(topScore, pp.score);
      }
    }
    if (cfg.interpol && enrich) {
      const ip = await checkInterpol(s.name, { timeoutMs: cfg.checkTimeoutMs });
      if (ip.errored) { interpolErrors++; enrichmentIncomplete = true; }
      else if (ip.hit) {
        const nats = (ip.match && ip.match.nationalities.length) ? ' [' + ip.match.nationalities.join(', ') + ']' : '';
        lists.push({ list: 'Interpol Red Notice', hitName: ((ip.match && ip.match.name || '') + nats).slice(0, 180), score: ip.score });
        band = strongerBand(band, ip.band); topScore = Math.max(topScore, ip.score);
      }
    }

    const hasSanctions = raw.lists.length > 0;
    const recommendation = hasSanctions ? 'sanctions-match' : (lists.length ? 'review' : 'clear');
    const merged = {
      name: s.name,
      topScore: lists.length ? topScore : raw.topScore,
      band: lists.length ? band : 'low',
      recommendation,
      hitCount: lists.length,
      lists
    };
    const nr = normalizeResult(merged, s);
    nr.enrichmentIncomplete = enrichmentIncomplete;
    heartbeat();
    return nr;
  });

  if (amErrors) console.error('sanctions-screen: adverse-media lookup failed for ' + amErrors + ' subject(s)');
  if (pepErrors) console.error('sanctions-screen: PEP lookup failed for ' + pepErrors + ' subject(s)');
  if (interpolErrors) console.error('sanctions-screen: Interpol lookup failed for ' + interpolErrors + ' subject(s)');
  if (enrichSkipped) console.log('sanctions-screen: enrichment time-budget reached — ' + enrichSkipped + ' subject(s) fully sanctions-screened but skipped adverse-media/PEP (best-effort, not degraded)');
  return { results, anyOk: true, degraded, errored: 0, amErrors, pepErrors, interpolErrors, enrichSkipped, notes: loaded.notes, coverage: loaded };
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { updated: null, subjects: {} };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { console.warn('sanctions-screen: state unreadable, starting fresh (' + e.message + ')'); return { updated: null, subjects: {} }; }
}

function setOutput(key, val) {
  /* Sanitize before writing to GITHUB_OUTPUT: a CR/LF in the value (e.g. an upstream
     error message folded into a title) could inject additional output lines; cap the
     length so a pathological message can't bloat the step context. */
  const clean = String(val == null ? '' : val).replace(/[\r\n]+/g, ' ').slice(0, 300);
  if (process.env.GITHUB_OUTPUT) { try { writeFileSync(process.env.GITHUB_OUTPUT, key + '=' + clean + '\n', { flag: 'a' }); } catch {} }
}

function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID)
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : '';
}

/* Write outputs + artifacts and exit in the "could not screen" state — loudly,
   never as a false all-clear. */
function bailUnscreened(reason, today) {
  const report = '# Sanctions Screen — ' + today + '\n\n> ⚠ **Screening did NOT run: ' + reason + '**\n>\n> No clearance can be inferred from this run. Fix the configuration and re-run.\n\n_' + GOVERNANCE_NOTE + '_\n';
  mkdirSync('data', { recursive: true });
  writeFileSync(REPORT_FILE, report);
  writeFileSync(CHANGES_FILE, JSON.stringify({ date: today, mode: 'screen', changes: [] }, null, 2) + '\n');
  console.error('sanctions-screen: ' + reason);
  console.log(report);
  setOutput('has_changes', 'false');
  setOutput('match_count', '0');
  setOutput('screen_error', 'true');
  setOutput('asana_posted', 'false');
  setOutput('title', 'Sanctions Screen — could not run (' + reason + ')');
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const cfg = {
    sourcesFile: SANCTIONS_SOURCES_FILE,
    extraFile: process.env.SANCTIONS_EXTRA_FILE || 'data/sanctions-extra.json',
    threshold: Number(process.env.SCREEN_MATCH_THRESHOLD) || DEFAULT_THRESHOLD,
    adverseMedia: process.env.SCREEN_ADVERSE_MEDIA !== '0',   // default on
    pep: process.env.SCREEN_PEP !== '0',                      // default on
    interpol: process.env.SCREEN_INTERPOL === '1',            // default OFF (opt-in; verify the public API on the runner before enabling)
    listTimeoutMs: Number(process.env.SCREEN_LIST_TIMEOUT_MS) || 60000,
    checkTimeoutMs: Number(process.env.SCREEN_CHECK_TIMEOUT_MS) || 12000,
    concurrency: Number(process.env.SCREEN_CONCURRENCY) || 8,
    /* Wall-clock budget for the best-effort enrichment phase (adverse-media/PEP).
       Sanctions matching is always run for every subject; once this elapses the
       remaining subjects skip enrichment so the job never approaches its timeout.
       Default 12 min leaves headroom under the 20-min job timeout. */
    enrichBudgetMs: Number(process.env.SCREEN_ENRICH_BUDGET_MS) || 720000
  };
  const asanaToken = process.env.ASANA_ACCESS_TOKEN || '';

  if (!asanaToken) return bailUnscreened('ASANA_ACCESS_TOKEN not set — cannot read the Customer Database', today);

  let subjects;
  try { subjects = await fetchAsanaSubjects(CUSTOMER_PROJECT_GID, asanaToken); }
  catch (e) { return bailUnscreened('could not read the Customer Database (' + (e && e.message || e) + ')', today); }
  if (!subjects.length) return bailUnscreened('the Customer Database returned 0 active customers', today);

  const individuals = subjects.filter(s => s.entityType === 'individual').length;
  const entities = subjects.length - individuals;
  console.log('sanctions-screen: screening ' + subjects.length + ' subjects (' + entities + ' entities + ' + individuals + ' principals/UBOs) from the FULL Customer Database against the free consolidated lists'
    + (cfg.adverseMedia ? ' + adverse media' : '') + (cfg.pep ? ' + PEP' : ''));
  const screen = await screenLocally(subjects, cfg);
  if (!screen.anyOk) return bailUnscreened('no sanctions list could be loaded — ' + ((screen.notes || []).join('; ') || 'all sources failed'), today);

  const prevState = loadState();
  const screenedLists = ((screen.coverage && screen.coverage.lists) || []).map(L => L.name).filter(Boolean);
  const { alerts, cleared, matchCount, nextState } = diffState(prevState, screen.results, today, cfg.threshold, screenedLists);
  const meta = { screened: subjects.length, entities, individuals, degraded: screen.degraded, errored: screen.errored };
  const report = buildScreenReport(alerts, cleared, today, meta);
  const changes = buildChangesArtifact(alerts, today);

  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2) + '\n');
  writeFileSync(REPORT_FILE, report + '\n');
  writeFileSync(CHANGES_FILE, JSON.stringify(changes, null, 2) + '\n');
  writeFileSync(RESULTS_FILE, JSON.stringify({
    date: today,
    screened: subjects.length, entities, individuals,
    newMatches: alerts.length, matchCount, clearedCount: cleared.length,
    degraded: screen.degraded,
    lists: ((screen.coverage && screen.coverage.lists) || []).map(L => ({ name: L.name, count: (L.names || []).length })),
    failures: screen.notes || [],
    enrichment: { amErrors: screen.amErrors || 0, pepErrors: screen.pepErrors || 0, skipped: screen.enrichSkipped || 0 },
    alerts: alerts.map(a => ({
      key: a.key, name: a.name, jurisdiction: a.jurisdiction || '', band: a.band,
      topScore: a.topScore, recommendation: a.recommendation,
      lists: (a.lists || []).map(h => (typeof h === 'string' ? h : h.list)).filter(Boolean)
    })),
    cleared: cleared.map(c => c.name)
  }, null, 2) + '\n');

  console.log(report);
  console.log('\nscreened=' + subjects.length + '  new-matches=' + alerts.length + '  total-matches=' + matchCount + '  degraded=' + screen.degraded + '  errored=' + screen.errored);

  const title = alerts.length
    ? '⚠ Sanctions Screen — ' + alerts.length + ' customer match' + (alerts.length === 1 ? '' : 'es')
    : 'Sanctions Screen — no new matches (' + subjects.length + ' screened)';

  let asanaPosted = false;
  let regUrl = '';
  /* Case-engine mode (SCREEN_SUPPRESS_ALERTS=1): the screening-cases step that
     follows turns every flag into a managed lifecycle CASE, so the flat alert
     card would be a duplicate. Suppression is logged, never silent. */
  const suppressAlerts = process.env.SCREEN_SUPPRESS_ALERTS === '1';
  if (alerts.length && suppressAlerts) console.log('sanctions-screen: ' + alerts.length + ' new match(es) — alert card suppressed (case engine mode); the case manager files them as lifecycle cases.');
  if (alerts.length && asanaEnabled() && !suppressAlerts) {
    try {
      const html = buildScreenHtml(alerts, { runLink: runUrl(), today, degraded: screen.degraded });
      const section = process.env.ASANA_SECTION_GID || undefined;
      /* match alerts are higher-severity than list-change notes — pull the review date in */
      const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const url = await notifyAsana(title, report, { project: REG_PROJECT_GID, html, section, due });
      asanaPosted = true;
      regUrl = url || '';
      console.log('sanctions-screen: Asana alert created' + (url ? ' — ' + url : ''));
    } catch (e) {
      console.error('sanctions-screen: Asana alert failed (' + (e && e.message || e) + ') — workflow will open a GitHub issue.');
    }
  }

  setOutput('has_changes', alerts.length ? 'true' : 'false');
  setOutput('match_count', String(alerts.length));
  setOutput('screen_error', 'false');
  setOutput('asana_posted', asanaPosted ? 'true' : 'false');
  setOutput('title', title);

  /* Ongoing Monitoring audit trail — daily AM/PEP task, every run regardless of
     result. Self-contained (it swallows its own errors), so a failure here never
     blocks the screening output above. */
  if (process.env.SCREEN_SKIP_AUDIT_TASK === '1') {
    console.log('sanctions-screen: daily audit task skipped (SCREEN_SKIP_AUDIT_TASK=1 — the unified Daily Screening posts the digest).');
  } else {
    await postOngoingMonitoringTask(subjects, screen, alerts, today, cfg, asanaToken, regUrl);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
