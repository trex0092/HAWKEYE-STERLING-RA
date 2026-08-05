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
import { normalizeName, parseList, buildIndex, screenName, MANUAL_REVIEW_LIST } from './sanctions-match.mjs';
import { checkAdverseMedia, budgetedLocales, activeLocales, ALL_TERMS, LOCALES, LANG_TERMS } from './adverse-media.mjs';
import { checkPep } from './pep-check.mjs';
import { checkInterpol } from './interpol-check.mjs';
import { checkFbi } from './fbi-check.mjs';
import { pepListFromDataset, PEP_LIST_NAME } from './pep-worldwide.mjs';

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

/* "HR – Employees" project — the SECOND screening population (staff screening,
   MLRO-directed 2026-07-29). Same pipeline, same matcher, same case lifecycle
   as customers. Set ASANA_EMPLOYEE_PROJECT_GID to an empty string to disable
   employee screening EXPLICITLY; while configured, an unreachable or empty
   employee project bails the run unscreened — the same contract as the
   customer database, because a population that silently drops out of
   screening is a silent clear for everyone in it. */
export const EMPLOYEE_PROJECT_GID =
  process.env.ASANA_EMPLOYEE_PROJECT_GID !== undefined
    ? process.env.ASANA_EMPLOYEE_PROJECT_GID
    : '1216139945846994';

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
export const OM_PROJECT_GID = process.env.ASANA_OM_PROJECT_GID || '1216203370612914';
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
   even absent an explicit recommendation. Override with SCREEN_MATCH_THRESHOLD
   (validated through resolveThreshold below). */
export const DEFAULT_THRESHOLD = 0.85;

/* Parse SCREEN_MATCH_THRESHOLD — a FRACTION in (0, 1]. The Python engine's
   THRESHOLD uses the 0-100 scale, so an operator copying its `85` here would
   silently raise the effective cutoff to 8500 and clear every fuzzy match (a
   config-typo false-negative machine). Out-of-range / non-numeric values are
   rejected LOUDLY and the default kept — matching is never silently disabled. */
export function resolveThreshold(raw) {
  if (raw == null || String(raw).trim() === '') return DEFAULT_THRESHOLD;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1) {
    console.error('sanctions-screen: SCREEN_MATCH_THRESHOLD=' + JSON.stringify(String(raw))
      + ' is not a fraction in (0,1] (did you use screen.py\'s 0-100 scale?) — using the default '
      + DEFAULT_THRESHOLD + ' so fuzzy matching is never silently disabled.');
    return DEFAULT_THRESHOLD;
  }
  /* ONE-WAY rule (docs/governance/champion-challenger-thresholds.md): a value
     ABOVE the champion default weakens screening, so it needs the explicit
     override flag as a separate decision — mirrored in screen.py's
     _resolve_match_threshold. Lowering (more sensitive) stays a plain config. */
  if (n > DEFAULT_THRESHOLD && String(process.env.SCREEN_MATCH_THRESHOLD_ALLOW_RAISE || '') !== '1') {
    console.error('sanctions-screen: SCREEN_MATCH_THRESHOLD=' + JSON.stringify(String(raw))
      + ' would RAISE the cutoff above the champion default ' + DEFAULT_THRESHOLD
      + ' (less sensitive screening). One-way rule: raises require'
      + ' SCREEN_MATCH_THRESHOLD_ALLOW_RAISE=1 — using the default.');
    return DEFAULT_THRESHOLD;
  }
  return n;
}

/* Parse SCREEN_SHADOW_THRESHOLD — a log-only challenger band (fraction, must
   sit BELOW the live threshold). A clear subject whose best score lands in
   [shadow, threshold) is logged and written to the results file's shadow[]
   array — never an alert, never a case, never in the delta state. Off unless
   set; invalid values reject loudly to off (it never changes live matching). */
export function resolveShadowThreshold(raw, threshold) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  const thr = typeof threshold === 'number' ? threshold : DEFAULT_THRESHOLD;
  if (!Number.isFinite(n) || n <= 0 || n >= thr) {
    console.error('sanctions-screen: SCREEN_SHADOW_THRESHOLD=' + JSON.stringify(String(raw))
      + ' is not a fraction in (0, ' + thr + ') — shadow challenger disabled.');
    return null;
  }
  return n;
}

/* The shadow-band row for one raw engine result, or null. Pure — unit-tested;
   only CLEAR results are eligible (anything the engine flags is already an
   alert and needs no shadow evidence). */
export function shadowBandRow(raw, shadowThr, thr) {
  if (shadowThr == null || !raw || raw.recommendation !== 'clear') return null;
  const score = typeof raw.topScore === 'number' ? raw.topScore : 0;
  if (score >= shadowThr * 100 && score < (thr == null ? DEFAULT_THRESHOLD : thr) * 100) {
    return { name: raw.name, topScore: score };
  }
  return null;
}

/* Parse MATCH_PHONETIC — the phonetic-fold layer mode shared with screen.py:
   '1' (live, default) | 'shadow' (log would-be hits, emit none) | '0' (off).
   Unknown values are rejected LOUDLY and the default kept, so the layer is
   never silently disabled by a config typo. */
export function resolvePhoneticMode(raw) {
  const v = String(raw == null ? '' : raw).trim().toLowerCase();
  if (v === '') return '1';
  if (v === '1' || v === 'shadow' || v === '0') return v;
  console.error('sanctions-screen: MATCH_PHONETIC=' + JSON.stringify(String(raw))
    + ' is not one of 1|shadow|0 — using the default 1 (phonetic layer live).');
  return '1';
}

/* Recommendations / bands that mean "no action". Anything else the engine returns
   is treated as a positive signal (conservative — errs toward flagging). */
const CLEAR_RE = /^(clear|no[_\s-]?match|no[_\s-]?hit|pass|passed|negative|none|nil|ok|false[_\s-]?positive|not[_\s-]?listed|low)$/i;
const HIGH_BANDS = new Set(['critical', 'high', 'severe', 'elevated', 'red', 'amber']);
/* Enrichment signals (best-effort, network-bound) vs. the always-run local
   sanctions match. A standing match derived solely from these must NOT be cleared
   on a run where the lookup errored or was time-budget-skipped (see diffState). */
const ENRICHMENT_LISTS = new Set(['Adverse media (Google News)', 'PEP (Wikidata)', 'Interpol Red Notice', 'FBI Wanted', PEP_LIST_NAME]);
/* Locally-derived pseudo-lists (no external list behind them, re-evaluated on
   every run): they must be exempt from the "originating list did not load this
   run" carry-forward, or a MANUAL REVIEW flag could never clear even after the
   subject's record is fixed and screens clean. */
const LOCAL_MARKER_LISTS = new Set([MANUAL_REVIEW_LIST]);

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
  /* A name that folds to nothing (symbols-only / unscreenable record) must
     still get a DISTINCT stable key: on the shared empty key '', the second
     such customer was deduped away before screening and never even reached
     MANUAL REVIEW. The raw-string fallback cannot collide with a normalized
     key (normalizeName output never contains ':'). */
  const key = normalizeName(name) || (name ? 'raw:' + name : '');
  return {
    key,
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
  const out = { list: String(list), hitName: String(hitName || ''), score };
  /* Evidence labels from the matcher (mechanism: exact/fuzzy/short-entry/
     near-exact-core/subset/phonetic; confidence: STRONG/MODERATE/WEAK[...]) —
     carried through so the state, digest and case builders can render WHY a
     hit fired. `confidence` is only taken as a label when it is non-numeric
     (some external shapes use `confidence` as a score — handled above). */
  if (h.mechanism) out.mechanism = String(h.mechanism);
  if (typeof h.confidence === 'string' && num(h.confidence) === null) out.confidence = h.confidence;
  /* Cleared-FP annotation must survive this rebuild or the demotion (and its
     audit trail) silently vanishes between the matcher and the state. */
  if (h.whitelisted) {
    out.whitelisted = true;
    if (h.clearedAt) out.clearedAt = String(h.clearedAt);
    if (h.clearedBy) out.clearedBy = String(h.clearedBy);
    if (h.clearedVia) out.clearedVia = String(h.clearedVia);
  }
  /* A phonetic-only hit must stay visibly WEAK all the way to the case board —
     the flag travels in the hitName suffix (state/alert/case builders all
     render hitName) AND as a structured field. */
  if (h.phonetic) {
    out.phonetic = true;
    if (out.hitName && !out.hitName.includes('[phonetic-only')) {
      out.hitName += ' [phonetic-only — WEAK]';
    }
  }
  return out;
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
/* Per-hit evidence detail persisted with the state and shipped in the results
   artifact: the matched designated name, score and the matcher's mechanism/
   confidence labels — what an MLRO needs on the case card to adjudicate
   without opening the run log. Capped at 12 (the engine's own lists cap). */
export function hitDetail(lists) {
  return (lists || []).slice(0, 12).filter(h => h && h.list).map(h => {
    const d = { list: h.list, hitName: h.hitName || '', score: h.score ?? null };
    if (h.mechanism) d.mechanism = h.mechanism;
    if (h.confidence) d.confidence = h.confidence;
    if (h.carriedForward) d.carriedForward = true;
    if (h.whitelisted) {
      d.whitelisted = true;
      if (h.clearedAt) d.clearedAt = h.clearedAt;
      if (h.clearedBy) d.clearedBy = h.clearedBy;
      if (h.clearedVia) d.clearedVia = h.clearedVia;
    }
    return d;
  });
}

/* ── CLEARED-FALSE-POSITIVE REGISTRY (whitelist — demote, NEVER suppress) ────
   An analyst-cleared match pair must stop opening a fresh case every day, but
   nothing may vanish from the record: whitelisted hits stay on the report and
   the state, ANNOTATED with the clearance, and only the case-opening severity
   is demoted. Identity is PAIR-level — subject key + the exact designated
   name + list that was reviewed — so a NEW or CHANGED designated name against
   the same subject reactivates normally (built-in re-confirm on list change).
   Entries come from two evidence-backed sources: the curated registry file
   (four-eyes PR procedure) and '[x] false positive' dispositions ticked on
   case cards (recorded by screening-cases.mjs with the case gid as evidence).
   Kill switch: SCREEN_WHITELIST=0 disables the registry entirely. */
export function whitelistKey(subjectKey, hitName, list) {
  /* normalizeName folds case/diacritics but turns dots into spaces ("L.L.C."
     → "L L C" vs "LLC") — collapsing whitespace afterwards makes the pair key
     survive list-side punctuation churn without loosening the name itself. */
  const hn = normalizeName(String(hitName || '')).replace(/\s+/g, '');
  return String(subjectKey) + '::' + hn + '|' + String(list || '');
}

export function buildWhitelistMap(curatedEntries, casesState) {
  const map = new Map();
  for (const e of (Array.isArray(curatedEntries) ? curatedEntries : [])) {
    if (!e || !e.subject_key || !e.hit_name || !e.list) continue;
    map.set(whitelistKey(e.subject_key, e.hit_name, e.list),
      { clearedAt: e.cleared_at || '', clearedBy: e.cleared_by || '', clearedVia: 'registry file' });
  }
  for (const [key, cs] of Object.entries(casesState || {})) {
    const d = cs && cs.disposition;
    if (!d || d.kind !== 'false-positive' || !Array.isArray(d.hits)) continue;
    for (const p of d.hits) {
      if (!p || !p.hitName || !p.list) continue;
      map.set(whitelistKey(key, p.hitName, p.list),
        { clearedAt: d.at || '', clearedBy: 'MLRO disposition', clearedVia: 'case ' + (d.caseGid || '?') });
    }
  }
  return map;
}

export function applyWhitelist(subjectKey, hits, wlMap) {
  let annotated = 0;
  for (const h of (hits || [])) {
    if (!h || !h.list || !h.hitName) continue;
    const wl = wlMap && wlMap.get(whitelistKey(subjectKey, h.hitName, h.list));
    if (!wl) continue;
    h.whitelisted = true;
    if (wl.clearedAt) h.clearedAt = wl.clearedAt;
    if (wl.clearedBy) h.clearedBy = wl.clearedBy;
    if (wl.clearedVia) h.clearedVia = wl.clearedVia;
    annotated++;
  }
  return annotated;
}

/* ── SECOND OPINION (OFAC-API.com) — independent corroboration, additive-only.
   Shape-tolerant parser: the exact response schema cannot be verified from
   the dev sandbox (egress-blocked), so anything unrecognisable is returned as
   'unavailable' with the reason — a lost second opinion, never a clear. */
export function parseOfacApiResponse(d) {
  if (!d || typeof d !== 'object') return { status: 'unavailable', error: 'empty/non-object response' };
  const err = d.errorMessage || (typeof d.error === 'string' ? d.error : null)
    || (String(d.status || '').toLowerCase() === 'error' ? (d.message || 'error status') : null);
  if (err) return { status: 'unavailable', error: String(err).slice(0, 120) };
  const results = Array.isArray(d.results) ? d.results
    : (Array.isArray(d.matches) ? d.matches : (Array.isArray(d.cases) ? d.cases : null));
  if (!results) return { status: 'unavailable', error: 'unrecognised response shape: ' + Object.keys(d).slice(0, 5).join(',') };
  const entry = results[0] || {};
  const matches = Array.isArray(entry.matches) ? entry.matches : (Array.isArray(entry.results) ? entry.results : []);
  const matchCount = Number(entry.matchCount != null ? entry.matchCount : matches.length) || 0;
  let topScore = null;
  for (const m of matches) {
    const sc = num(m && (m.score != null ? m.score : m.matchScore));
    if (sc != null) topScore = Math.max(topScore ?? 0, sc);
  }
  return matchCount > 0
    ? { status: 'corroborated', matchCount, ...(topScore != null ? { topScore } : {}) }
    : { status: 'no-match', matchCount: 0 };
}

export function diffState(prevState, results, today, threshold, screenedLists, evaluatedSignals) {
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
  // Enrichment signals (PEP / adverse media / Interpol) whose module actually
  // RAN this run — the enrichment counterpart of `screened`. A signal that was
  // switched off produced no lookup and therefore no per-subject error flag, so
  // without this set a disabled module is indistinguishable from a verified
  // clear. Omitted → guard inactive, behaviour unchanged (tests, external path).
  const evaluated = evaluatedSignals ? new Set(Array.from(evaluatedSignals)) : null;

  /* Carry a standing match forward as STILL ACTIVE (lastSeen = today). The case
     planner (screening-cases.mjs) treats a stale lastSeen as "no longer flagged"
     and auto-clears + completes the Asana case with a false "not flagged" audit
     comment — and a cleared case never re-opens. A carry-forward is precisely
     the situation where we could NOT re-verify, so it must not read as cleared. */
  const carryForward = (key) => {
    if (prev[key]) nextSubjects[key] = { ...prev[key], lastSeen: today };
  };

  const BAND_RANK = { critical: 3, high: 2, medium: 1, low: 0 };
  for (const r of results) {
    if (r.errored) { carryForward(r.key); continue; }
    if (isMatch(r, threshold)) {
      matchCount++;
      const prior = prev[r.key];
      /* Coverage-stable signature: a prior hit on a sanctions list that did NOT
         load this run was not re-verified. Rebuilding the signature from this
         run's reduced coverage would (a) fire a spurious "changed match" alert
         and (b) silently drop the unverified hit (and any band downgrade it
         caused) from the recorded state. Carry those hits — and the stronger
         prior band they supported — forward until the list loads again. */
      let lists = r.lists || [];
      let band = r.band, recommendation = r.recommendation;
      if (screened && prior && Array.isArray(prior.lists)) {
        const unscreened = prior.lists.filter(l => !ENRICHMENT_LISTS.has(l) && !LOCAL_MARKER_LISTS.has(l) && !screened.has(l));
        if (unscreened.length) {
          const have = new Set(lists.map(h => h.list).filter(Boolean));
          for (const l of unscreened) if (!have.has(l)) { lists = lists.concat([{ list: l, carriedForward: true }]); have.add(l); }
          if ((BAND_RANK[prior.band] || 0) > (BAND_RANK[band] || 0)) {
            band = prior.band;
            recommendation = prior.recommendation || recommendation;
          }
        }
      }
      /* Enrichment evidence (PEP / adverse media / Interpol) on a prior match is
         NOT re-verified on a run whose lookup errored or was budget-skipped.
         Rebuilding the signature without it would (a) fire a spurious "changed
         match" alert and (b) silently rewrite the standing record, dropping the
         PEP/media evidence over a mere lookup failure. Carry it forward; a later
         run with working enrichment updates it legitimately. */
      if (prior && Array.isArray(prior.lists)) {
        /* A prior enrichment signal is NOT re-verified this run when its lookup
           errored / was budget-skipped (enrichmentIncomplete), its MODULE was
           off this run (evaluated omits it — the same epistemic state the
           clear-branch guards at ~632, previously missing on THIS still-match
           branch, so flipping SCREEN_PEP=0 silently erased every standing PEP
           from the book), OR its coverage was narrowed (unverified, e.g. a
           budgeted adverse-media rotation that did not sweep the originating
           edition). Carry it forward and keep the stronger prior band it drove;
           recall-safe — only ADDS carry-forwards and only RAISES the band. */
        const unv = Array.isArray(r.unverified) ? new Set(r.unverified) : null;
        const have = new Set(lists.map(h => h.list).filter(Boolean));
        let carried = false;
        for (const l of prior.lists) {
          const notReverified = r.enrichmentIncomplete
            || (evaluated && !evaluated.has(l))
            || (unv && unv.has(l));
          if (ENRICHMENT_LISTS.has(l) && !have.has(l) && notReverified) {
            lists = lists.concat([{ list: l, carriedForward: true }]); have.add(l); carried = true;
          }
        }
        if (carried && (BAND_RANK[prior.band] || 0) > (BAND_RANK[band] || 0)) {
          band = prior.band;
          recommendation = prior.recommendation || recommendation;
        }
      }
      const sig = matchSignature({ band, recommendation, lists });
      const firstSeen = (prior && prior.firstSeen) || today;
      nextSubjects[r.key] = {
        name: r.name, jurisdiction: r.jurisdiction, band, topScore: r.topScore,
        recommendation, lists: lists.map(h => h.list).filter(Boolean),
        /* Identity + evidence detail for the case board. `lists` (names only)
           stays as-is — the signature, planner and every pre-migration record
           depend on its shape; `hits` ADDS the matched designated name,
           per-hit score and the matcher's mechanism/confidence labels, and
           gid/entityType/parent/role let a legal-entity case link its customer
           record (entity keys carry no gid segment, so caseTitle/caseHtml
           rendered CASE-XXXXXX with no link for every company). Old state
           records simply lack these fields — renderers fall back. */
        gid: r.gid, entityType: r.entityType, parent: r.parent, role: r.role,
        hits: hitDetail(lists),
        /* Report-only row: every hit is a cleared-FP pair — the case engine
           opens no case; the report keeps the row, annotated. */
        ...(r.whitelistedOnly ? { whitelistedOnly: true } : {}),
        signature: sig, firstSeen, lastSeen: today
      };
      if (!prior || prior.signature !== sig) {
        alerts.push({ key: r.key, name: r.name, jurisdiction: r.jurisdiction, gid: r.gid,
          entityType: r.entityType, parent: r.parent, role: r.role,
          band, topScore: r.topScore, recommendation, lists, isNew: !prior });
      }
    } else if (prev[r.key]) {
      const prior = prev[r.key];
      // A prior match derived ONLY from enrichment signals (PEP / adverse media /
      // Interpol) must not be silently cleared on a run where that lookup errored
      // or was budget-skipped — we did not actually re-verify it. Carry it forward
      // untouched (no alert, no clear); a later run that completes enrichment will
      // clear it legitimately. (A prior SANCTIONS hit is always re-checked locally,
      // so a genuine de-listing still clears.)
      // ANY enrichment evidence, not only an enrichment-ONLY prior. The guard
      // used to require prior.lists.every(ENRICHMENT), so a MIXED prior
      // (e.g. ['US OFAC — SDN list (CSV)', 'PEP (Wikidata)']) fell straight
      // through it: on a run where OFAC genuinely de-listed the subject and the
      // PEP lookup errored or was budget-skipped, the whole record — including
      // the never-re-verified PEP evidence — was deleted and its MLRO case
      // auto-completed with the false comment "not flagged by the … run".
      // Clearing evidence we did not re-check is the same false-negative class
      // as clearing against a list that failed to load.
      const priorHasEnrichment = Array.isArray(prior.lists)
        && prior.lists.some(l => ENRICHMENT_LISTS.has(l));
      if (r.enrichmentIncomplete && priorHasEnrichment) {
        carryForward(r.key);   // keep the prior standing, marked still-active
        continue;
      }
      // A prior enrichment signal whose MODULE DID NOT RUN this run is the same
      // epistemic state as one that errored — we did not re-verify it — but it
      // carries no per-subject flag, because no lookup happened at all. Without
      // this, flipping SCREEN_PEP=0 (the documented knob, most likely to be
      // reached for DURING a Wikidata outage, exactly when standing matches most
      // need preserving) silently cleared every PEP-derived match in the book in
      // one run and auto-completed their cases.
      if (evaluated && Array.isArray(prior.lists)
          && prior.lists.some(l => ENRICHMENT_LISTS.has(l) && !evaluated.has(l))) {
        carryForward(r.key);
        continue;
      }
      // A prior enrichment signal whose coverage was NARROWED this run (a
      // budgeted adverse-media rotation that did not sweep the originating
      // edition, or a disclosed-partial sweep) was not actually re-checked —
      // same epistemic state as errored, but the signal's module DID run so
      // neither the enrichmentIncomplete nor the module-off guard fires. Carry
      // the standing match forward; it clears only on a full-coverage re-sweep
      // or an MLRO disposition, never off a rotation that never looked.
      if (Array.isArray(r.unverified) && r.unverified.length && Array.isArray(prior.lists)
          && prior.lists.some(l => ENRICHMENT_LISTS.has(l) && r.unverified.includes(l))) {
        carryForward(r.key);
        continue;
      }
      // Degrade-loudly: if a SANCTIONS list that produced this prior match failed
      // to load this run, we could not re-screen the subject against it — carry the
      // match forward (no clear, no case auto-completion) rather than declaring an
      // all-clear off the back of a fetch/parse failure.
      if (screened) {
        /* Local markers (MANUAL REVIEW) have no originating list — they are
           re-derived every run, so a prior marker never blocks a genuine clear
           once the subject screens cleanly. */
        const priorSanctionsLists = (Array.isArray(prior.lists) ? prior.lists : [])
          .filter(l => !ENRICHMENT_LISTS.has(l) && !LOCAL_MARKER_LISTS.has(l));
        if (priorSanctionsLists.some(l => !screened.has(l))) {
          carryForward(r.key);   // originating list not screened this run → keep the standing match
          continue;
        }
      }
      cleared.push({ key: r.key, name: r.name, prior });
      delete nextSubjects[r.key];
    }
  }

  /* A standing match whose SUBJECT never appeared in this run's results was not
     screened at all — the task was completed/off-boarded, renamed (which changes
     its key), deleted, or an ASANA_*_PROJECT_GID was narrowed. The loop above
     only ever iterates `results`, so such a subject kept its previous `lastSeen`
     untouched; the case planner reads that stale date as "no longer flagged" and
     auto-completes the open MLRO case with the comment "not flagged by the …
     screening run" — a statement that is false, in a record kept for ten years,
     and a completed case never re-opens.
     These are held, not cleared and not silently frozen: `lastSeen` is bumped so
     the case stays open, `notScreenedOn` records WHY it is being held, and they
     are returned so the caller can surface the population change. A subject that
     genuinely left the book still needs a human to dispose of its open case. */
  const seenKeys = new Set(results.map(r => r && r.key));
  const notScreened = [];
  for (const key of Object.keys(prev)) {
    if (seenKeys.has(key)) continue;
    const prior = prev[key];
    notScreened.push({ key, name: prior.name, prior, lastScreened: prior.lastSeen });
    nextSubjects[key] = { ...prior, lastSeen: today, notScreenedOn: today };
  }

  return { alerts, cleared, notScreened, matchCount,
           nextState: { updated: today, subjects: nextSubjects } };
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
  /* Coverage honesty: when the runner supplies what actually loaded, say THAT.
     The fixed COVERAGE string is the configured scope, not evidence — claiming
     it unconditionally read as "all lists screened" on runs where one failed. */
  const loaded = Array.isArray(meta.loadedLists) && meta.loadedLists.length ? meta.loadedLists : null;
  lines.push('Screened **' + (meta.screened != null ? meta.screened : '?') + '** subjects from the FULL Customer Database' + breakdown
    + ' against ' + (loaded ? loaded.length + ' loaded list(s): ' + loaded.join(' · ') : 'the configured scope: ' + COVERAGE) + '.', '');
  if (loaded) lines.push('Configured scope: ' + COVERAGE + '.', '');
  const notLoaded = Array.isArray(meta.failures) ? meta.failures.filter(Boolean) : [];
  if (notLoaded.length) lines.push('> ⚠ Not loaded this run (their designations were NOT screened): ' + notLoaded.join(' · '), '');
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
export function buildScreenHtml(alerts, { runLink, today, degraded, loadedLists, failures } = {}) {
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
  /* Same coverage honesty as the plain report: actual loaded lists when known,
     the configured scope clearly labelled as scope either way. */
  const loadedNow = Array.isArray(loadedLists) && loadedLists.length ? loadedLists : null;
  const notLoadedNow = Array.isArray(failures) ? failures.filter(Boolean) : [];
  if (loadedNow) parts.push('<strong>Screened against (loaded this run):</strong> ' + esc(loadedNow.join(' · ')));
  if (notLoadedNow.length) parts.push('<em>⚠ Not loaded this run (designations NOT screened): ' + esc(notLoadedNow.join(' · ')) + '</em>');
  parts.push('<strong>' + (loadedNow ? 'Configured scope:' : 'Screened against:') + '</strong> ' + esc(COVERAGE));
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
/* Subject-level NEW/CHANGED/STANDING tag for a hit line, from the diff's alert
   keys. `newKeys` = subjects first flagged this run (isNew); `changedKeys` =
   subjects whose standing match escalated/changed this run (in `alerts` but not
   new) — without them a changed match was mislabelled "previously reported".
   Blank when the caller could not supply diff info. */
function hitStatusTag(r, newKeys, changedKeys) {
  if (!newKeys) return '';
  if (newKeys.has(r.key)) return ' | NEW';
  if (changedKeys && changedKeys.has(r.key)) return ' | CHANGED (escalated/updated this run)';
  return ' | STANDING (previously reported)';
}
/* " (N new[, C changed], M standing)" breakdown; '' without diff info. */
function hitStatusCounts(hits, newKeys, changedKeys) {
  if (!newKeys || !hits.length) return '';
  const fresh = hits.filter(r => newKeys.has(r.key)).length;
  const changed = changedKeys ? hits.filter(r => !newKeys.has(r.key) && changedKeys.has(r.key)).length : 0;
  const standing = hits.length - fresh - changed;
  return ' (' + fresh + ' new, ' + (changedKeys ? changed + ' changed, ' : '') + standing + ' standing)';
}

/* PART B — Adverse Media & PEP monitoring task body (CLEAR or HIT variant).
   `amActive`/`pepActive` are the run's ACTUAL module switches (cfg.adverseMedia /
   cfg.pep): a disabled module must render OFF / NOT EVALUATED, never "ACTIVE"
   with "NONE" results — that read as a clearance no lookup ever produced. */
export function buildAmPepNotes({ today, tomorrow, run, subjects, amHits = [], pepHits = [], newMatchKeys = null,
  changedMatchKeys = null, amActive = true, pepActive = true, regUrl = '', amKeywordCount = AM_KEYWORD_COUNT } = {}) {
  const hasHits = amHits.length > 0 || pepHits.length > 0;
  const newKeys = newMatchKeys ? new Set(newMatchKeys) : null;
  const changedKeys = changedMatchKeys ? new Set(changedMatchKeys) : null;
  const offNote = [amActive ? null : 'adverse media', pepActive ? null : 'PEP'].filter(Boolean).join(' + ');
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
  L.push('Adverse media module:         ' + (amActive
    ? 'ACTIVE (worldwide — Google News RSS × ' + LOCALES.length + ' locales + GDELT, ' + amKeywordCount + ' keywords across ' + Object.keys(LANG_TERMS).length + ' languages)'
    : 'OFF (SCREEN_ADVERSE_MEDIA=0 — not evaluated this run; no clearance implied)'));
  L.push('PEP module:                   ' + (pepActive
    ? 'ACTIVE (Wikidata — Tier 1/2/3 + family/associates)'
    : 'OFF (SCREEN_PEP=0 — not evaluated this run; no clearance implied)'));
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
    L.push('New adverse media hits:       ' + (amActive ? 'NONE' : 'NOT EVALUATED (module off)'));
    L.push('New PEP identifications:      ' + (pepActive ? 'NONE' : 'NOT EVALUATED (module off)'));
    L.push('PEP status changes:           ' + (pepActive ? 'NONE' : 'NOT EVALUATED (module off)'));
    L.push('False positives cleared:      NONE');
  } else {
    L.push('Adverse media hits:           ' + (amActive || amHits.length ? amHits.length + hitStatusCounts(amHits, newKeys, changedKeys) : 'NOT EVALUATED (module off)'));
    for (const r of amHits) L.push(amHitLine(r) + hitStatusTag(r, newKeys, changedKeys));
    L.push('PEP identifications:          ' + (pepActive || pepHits.length ? pepHits.length + hitStatusCounts(pepHits, newKeys, changedKeys) : 'NOT EVALUATED (module off)'));
    for (const r of pepHits) L.push(pepHitLine(r) + hitStatusTag(r, newKeys, changedKeys));
    L.push('False-positive review:        pending MLRO disposition (tracked on the case board)');
  }
  L.push('');
  L.push('Sanctions screening result:   → see Daily Screening Report (same day)');
  L.push('');
  L.push(RULE);
  L.push('C. ACTIONS (MLRO — human decisions, not automated)');
  L.push(RULE);
  /* These are HUMAN acts this script cannot take or verify. On a hit day they
     are open work; "N/A" here read as "no action was needed" — a false clear. */
  const actionState = hasHits ? 'pending MLRO review' : 'not required (no new findings this run)';
  L.push('EDD triggered:                ' + actionState);
  L.push('Risk rating upgraded:         ' + actionState);
  L.push('Senior management notified:   ' + actionState);
  L.push('STR consideration opened:     ' + actionState);
  L.push('Relationship paused/exited:   ' + actionState);
  L.push('');
  L.push(RULE);
  if (!hasHits) {
    L.push('STATUS: ✅ CLEAR' + (offNote ? ' (evaluated modules only — ' + offNote + ' OFF, not cleared)' : ''));
    L.push(RULE);
    L.push('Detection automatic. Action requires MLRO review.');
    L.push('Next run: ' + (tomorrow || ''));
  } else {
    L.push('STATUS: ⚠ REVIEW REQUIRED' + (regUrl ? ' — see alert card in Regulations project' : ''));
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

/* Same-day dedup for the Adverse Media / PEP card — DIRECTION-AWARE.

   Both card names carry the words "Adverse Media", so the old flat
   date + keyword match treated a CLEAR card and a HIT card as interchangeable:
   whichever landed first suppressed the other. A run earlier in the day that
   found nothing (or found nothing because its feed was degraded) therefore
   SUPPRESSED a later run's HIT card, and Ongoing Monitoring was left showing
   CLEAR for a day on which hits were found. The realistic path is exactly the
   one that matters — a manual dispatch or a re-run after noticing the scheduled
   run was degraded, which is precisely when the HIT card has to post.

   A HIT card supersedes today's CLEAR card. Nothing supersedes a HIT.
   Returns the name of the card that makes this post redundant, or null to post. */
export function omCardToSkip(names, dateStr, hasHits) {
  /* Boundary-guarded date match: "9 Jul 2026" is a substring of "19 Jul 2026",
     so a bare includes() could dedupe against a different day's card. */
  const dateRe = new RegExp('(^|[^0-9])' + String(dateStr).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^0-9])');
  const sameDay = (names || []).filter(
    (n) => dateRe.test(n) && (n.includes('Adverse Media') || n.includes('PEP')));
  if (!sameDay.length) return null;
  const existingHit = sameDay.find((n) => n.includes('HIT'));
  if (existingHit) return existingHit;   // already reported at the higher severity
  if (!hasHits) return sameDay[0];       // CLEAR over CLEAR — nothing new to say
  return null;                           // HIT supersedes today's CLEAR — POST it
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
    const already = omCardToSkip(names, dateStr, hasHits);
    if (already) { console.log('sanctions-screen: already posted: ' + already); return { posted: false, skipped: true, name: already }; }
    if (hasHits && names.some(n => n.includes(dateStr) && n.includes('CLEAR'))) {
      console.log('sanctions-screen: superseding today\'s CLEAR card — this run found hits');
    }

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const notes = buildAmPepNotes({ today, tomorrow, run: runUrl(), subjects: subjects.length, amHits, pepHits,
      newMatchKeys: alerts.filter(a => a.isNew).map(a => a.key),
      changedMatchKeys: alerts.filter(a => !a.isNew).map(a => a.key),
      amActive: cfg.adverseMedia, pepActive: cfg.pep, regUrl });
    const url = await createOmTask({ name, notes, projectGid, sectionGid }, token);
    console.log('sanctions-screen: AM/PEP task created — ' + name + (url ? ' — ' + url : ''));
    return { posted: true, url, name };
  } catch (e) {
    console.error('sanctions-screen: AM/PEP task failed (' + (e && e.message || e) + ') — screening output unaffected');
    return { posted: false, error: String(e && e.message || e) };
  }
}

/* Dotted-path lookup ("meta.totalItems", "data") for the paginated JSON reader. */
export function getByPath(obj, path) {
  return String(path || '').split('.').filter(Boolean)
    .reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/* Fetch every page of a JSON list API that paginates by size/offset, merging the
   rows under one key so the source's normal parser walks them unchanged. Opt-in
   per source via `source.paginate`; sources without it are untouched. The offset
   advances by the ACTUAL rows returned (not the requested size), so it collects
   the full list whether the server honours the size hint or caps the page — and
   a run that hits the page cap before the reported total logs LOUDLY and returns
   what it has (the coverage floor then flags the partial). */
export async function fetchPaginatedJson(url, headers, pg, signal, sourceId = '') {
  const sizeParam = pg.sizeParam || 'size';
  const offsetParam = pg.offsetParam || 'offset';
  const size = Math.max(1, Number(pg.size) || 200);
  const dataPath = pg.dataPath || 'data';
  const maxPages = Math.max(1, Number(pg.maxPages) || 30);
  const all = [];
  let offset = 0, total = null, page = 0;
  for (; page < maxPages; page++) {
    const u = new URL(url);
    u.searchParams.set(sizeParam, String(size));
    u.searchParams.set(offsetParam, String(offset));
    const r = await fetch(u.href, { signal, redirect: 'follow', headers });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' (page ' + page + ')');
    const json = JSON.parse(await r.text());
    if (total == null && pg.totalPath) { const t = Number(getByPath(json, pg.totalPath)); if (Number.isFinite(t)) total = t; }
    const rows = getByPath(json, dataPath);
    const arr = Array.isArray(rows) ? rows : [];
    if (!arr.length) break;                       // list exhausted
    all.push(...arr);
    offset += arr.length;                         // step by ACTUAL page length — robust to any server page size
    if (Number.isFinite(total) && offset >= total) break;
  }
  if (page >= maxPages && (!Number.isFinite(total) || offset < total)) {
    console.warn(`  ${sourceId || 'paginated source'}: pagination capped at ${maxPages} pages (${all.length}${Number.isFinite(total) ? ' of ' + total : ''} rows) — coverage PARTIAL, coverage floor will flag it`);
  }
  return JSON.stringify({ [dataPath]: all });
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
  const binary = /^(xlsx|dfat|ods)$/.test(String(source.parser || '').toLowerCase())
    || /^(xlsx|ods)$/.test(String(source.type || '').toLowerCase())
    || /\.(xlsx|ods)(\?|$)/i.test(parsed.href);
  /* Per-source browser headers: several national endpoints answer the plain
     screening UA with a challenge page or an empty body while serving the
     real list to a browser-shaped request (2026-08-05 probe: BCB, NBCTF,
     Qatar NCTC verified end-to-end WITH these headers). Opt-in per source —
     the honest default identifies the fetcher. */
  const headers = source.browserHeaders
    ? {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    }
    : { 'user-agent': 'HawkeyeSterling-SanctionsScreen/1.0' };
  /* Paginated JSON APIs (e.g. ADB's debarment register serves 10 rows/page and
     its own `next` link points at an unreachable internal host, so we page by
     size/offset on the public URL). Only sources that opt in via `paginate`
     take this path; every other source keeps the single-GET behaviour below. */
  if (source.paginate && !binary) {
    /* A small-page API (ADB caps size at 10) needs many sequential requests, so
       the paginated fetch gets a budget scaled to the page cap — ~1s/page,
       floored at the normal timeout and capped at 3 min — instead of the
       single-GET timeout that would abort a long crawl mid-list. */
    const pages = Number(source.paginate.maxPages) || 30;
    const pagTimeout = Math.min(180000, Math.max(timeoutMs, pages * 1000));
    return withTimeout((signal) => fetchPaginatedJson(parsed.href, headers, source.paginate, signal, source.id), pagTimeout);
  }
  return withTimeout(async (signal) => {
    const r = await fetch(parsed.href, { signal, redirect: 'follow', headers });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (binary) return Buffer.from(await r.arrayBuffer());
    /* Legacy registries still serve legacy encodings — Mexico SAT's 69-B CSV
       is latin-1, and decoding it as UTF-8 corrupts every accented name
       BEFORE matching (looks green, misses matches). Per-source opt-in. */
    if (typeof source.charset === 'string' && source.charset) {
      return new TextDecoder(source.charset).decode(await r.arrayBuffer());
    }
    return await r.text();
  }, timeoutMs);
}

/* Fold alias-only sources (source.mergeInto = <primary source id> — e.g. the
   OFAC SDN a.k.a. file alt.csv) into their primary list, so an alias hit
   carries the PRIMARY list's name: a party operating under an SDN alias IS an
   SDN match. Mutates `lists` in place; returns { folded, notes }:
     both loaded    → primary gains the alias names (deduped); alias row removed
     alias missing  → primary kept + marked `partial` — alias coverage is
                      MISSING, so the diff must not treat the primary list as
                      fully re-verified (standing matches carried, not cleared)
     primary missing→ alias row dropped: aliases are never screened ALONE as the
                      primary's coverage (mirrors screen.py's aliases-only guard)
   Pure (no I/O) so test/sanctions-screen.test.mjs pins it offline. */
export function foldAliasSources(lists, sources) {
  const folded = [], notes = [];
  const byId = new Map((lists || []).map(L => [L.id, L]));
  for (const s of (sources || [])) {
    if (!s || !s.mergeInto) continue;
    const alias = byId.get(s.id);
    const target = byId.get(s.mergeInto);
    if (alias && target) {
      const before = target.names.length;
      target.names = [...new Set([...target.names, ...alias.names])];
      /* Reduced ALIAS coverage must survive the fold. The alias row is spliced
         out here, so a `partial` flag on it would simply vanish — and because
         alias hits are recorded under the PRIMARY list's name, an
         alias-derived standing match is indistinguishable from a primary one
         and would clear as if it had been re-verified. Propagate it: the
         primary screened, but NOT with its full designation set. */
      if (alias.partial) {
        target.partial = true;
        notes.push(target.name + ' screened with INCOMPLETE a.k.a. coverage (' + s.name
          + ' loaded below its floor) — standing matches on this list are carried forward, not cleared');
      }
      lists.splice(lists.indexOf(alias), 1);
      byId.delete(s.id);
      folded.push('folded ' + (target.names.length - before) + ' a.k.a. name(s) from ' + s.name + ' into ' + target.name);
    } else if (alias && !target) {
      lists.splice(lists.indexOf(alias), 1);
      byId.delete(s.id);
      notes.push(s.name + ' loaded but its primary list did not — a.k.a. names NOT screened alone; coverage degraded');
    } else if (!alias && target) {
      target.partial = true;   // alias file failed: primary screens, but was not FULLY re-verified
      notes.push(target.name + ' screened WITHOUT its a.k.a. names (' + s.name + ' failed) — alias coverage degraded; standing matches on this list are carried forward, not cleared');
    }
  }
  return { folded, notes };
}

/* Per-source coverage floor (source.minNames): a list that parses far below its
   known size is the same false-negative class as 0 names — a truncated download
   or parser drift, not a mass de-listing. Mirrors screen.py's CORE_LIST_FLOORS
   (~50% of verified baselines; provisional where no baseline is logged yet).
   Pure so the test suite pins it offline. */
export function belowFloor(source, names) {
  return (names ? names.length : 0) < (Number(source && source.minNames) || 0);
}

/* Fetch + parse every enabled source into [{ id, name, names[] }]. A source that
   fails to fetch or yields zero names degrades coverage (reported, never a silent
   all-clear); a curated list with no entries degrades too. */
/* Exported for scripts/batch-screen.mjs (ad-hoc name screening) — same
   loader, same coverage-honesty contract. */
export async function loadSanctionsLists(cfg) {
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
      if (!names.length) {
        /* An OPTIONAL source (source.optional — the firm-internal watchlist)
           may legitimately be empty: "no internal designations" is a valid
           state, reported informationally and counted as fetched so it never
           degrades coverage. Official lists keep the fail-safe: empty means
           DEGRADED, never a silent all-clear. */
        if (s.optional) { fetched++; notes.push(s.name + ' has no entries — optional internal list, coverage unaffected'); console.log('sanctions-screen: ' + s.id + ' empty (optional) — screened set unchanged'); return; }
        notes.push(s.name + ' parsed 0 names — coverage degraded'); console.error('sanctions-screen: ' + s.id + ' parsed 0 names'); return;
      }
      if (belowFloor(s, names)) {
        /* The names that DID parse still screen — a hit on a truncated list is
           a real hit — but the list is marked partial so standing matches are
           carried forward instead of cleared (the same contract as a failed
           alias file), and the run reports DEGRADED: a "no match" against a
           truncated list is provisional, never an all-clear. */
        lists.push({ id: s.id, name: s.name, names, partial: true });
        notes.push(s.name + ' parsed ' + names.length + ' name(s), below its ' + s.minNames + ' coverage floor — truncated source; coverage degraded');
        console.error('sanctions-screen: ' + s.id + ' below coverage floor (' + names.length + ' < ' + s.minNames + ')');
        return;
      }
      lists.push({ id: s.id, name: s.name, names });
      fetched++;
      console.log('sanctions-screen: loaded ' + s.name + ' (' + names.length + ' designated names)');
    } catch (e) {
      notes.push(s.name + ' could not be loaded (' + (e && e.message || e) + ') — coverage degraded');
      console.error('sanctions-screen: ' + s.id + ' failed — ' + (e && e.message || e));
    }
  }));
  /* Alias-only sources (OFAC alt.csv) fold into their primary list so alias
     hits carry the primary designation; a missing alias file soft-degrades
     that list (partial) — reported, never a hard fail of the primary load. */
  const fold = foldAliasSources(lists, sources);
  for (const f of fold.folded) console.log('sanctions-screen: ' + f);
  for (const n of fold.notes) { notes.push(n); console.error('sanctions-screen: ' + n); }
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
  const phonMode = resolvePhoneticMode(process.env.MATCH_PHONETIC);
  const shadowThr = resolveShadowThreshold(process.env.SCREEN_SHADOW_THRESHOLD, cfg.threshold);
  const shadow = [];
  console.log('sanctions-screen: indexed ' + index.size + ' designated names from ' + loaded.lists.length + ' list(s); matching ' + subjects.length + ' subjects (threshold ' + thr + ', phonetic ' + phonMode
    + (shadowThr != null ? ', shadow ' + shadowThr * 100 : '') + ')');

  /* `degraded` reflects SANCTIONS coverage only (a list failed to load / parsed
     0 names). Adverse-media and PEP are best-effort enrichment signals — when
     they're unavailable (e.g. Wikidata rate-limits the PEP lookups) we record it
     and report it, but it does NOT degrade the sanctions screen or weaken its
     "no match" result. Keeping the degraded flag sanctions-only keeps it meaningful. */
  const degraded = loaded.degraded;
  let amErrors = 0, amPartial = 0, pepErrors = 0, interpolErrors = 0, fbiErrors = 0, enrichSkipped = 0;
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
    const raw = screenName(s.name, index, thr, phonMode);   // { name, topScore, band, recommendation, hitCount, lists[] }
    const sbRow = shadowBandRow(raw, shadowThr, cfg.threshold);
    if (sbRow) {
      shadow.push(sbRow);
      console.log('sanctions-screen: SHADOW-CHALLENGER "' + sbRow.name + '" best score '
        + sbRow.topScore + ' in [' + shadowThr * 100 + ', ' + thr + ') — log-only, no alert');
    }
    if (raw.phoneticShadow && raw.phoneticShadow.length) {
      for (const ps of raw.phoneticShadow) {
        console.log('sanctions-screen: PHONETIC-SHADOW "' + s.name + '" ~ "' + ps.hitName
          + '" [' + ps.list + '] ' + ps.shape + ' key match, score ' + ps.score + ' — no hit emitted');
      }
    }
    const lists = [...raw.lists];
    /* Cleared-FP registry: annotate matcher hits whose exact subject+designated-
       name+list pair an analyst already cleared. Runs BEFORE enrichment merges,
       so enrichment findings (adverse media / PEP / Interpol) can never be
       whitelisted away. Annotation only — severity is recomputed below. */
    if (cfg.whitelistMap && cfg.whitelistMap.size && lists.length) {
      applyWhitelist(s.key, lists, cfg.whitelistMap);
    }
    let band = raw.lists.length ? raw.band : '';
    let topScore = raw.lists.length ? raw.topScore : 0;
    const enrich = Date.now() < enrichDeadline;
    // Track whether any requested enrichment signal could NOT be evaluated this
    // run (errored or budget-skipped) so diffState won't silently clear a standing
    // enrichment-only match it couldn't re-verify.
    let enrichmentIncomplete = false;
    /* Per-SIGNAL "not re-verified this run" set — finer than the coarse
       enrichmentIncomplete flag. Adverse media sweeps a budgeted locale
       rotation by default, so on a day its originating regional edition was
       not swept a standing adverse-media hit was not actually re-checked;
       flagging ONLY that signal carries its standing match forward without
       freezing PEP/Interpol/FBI clears (which either ran or errored). */
    const unverified = new Set();
    if (!enrich && (cfg.adverseMedia || cfg.pep || cfg.interpol || cfg.fbi)) { enrichSkipped++; enrichmentIncomplete = true; }

    if (cfg.adverseMedia && enrich) {
      const am = await checkAdverseMedia(s.name, { timeoutMs: cfg.checkTimeoutMs });
      if (am.partial) amPartial++;   // narrowed coverage — disclosed, never silent
      if (am.errored) { amErrors++; enrichmentIncomplete = true; }
      else {
        /* A disclosed-partial sweep (a queried edition failed) OR a budgeted
           sweep that did not cover the full matrix did NOT re-verify a standing
           adverse-media match — the originating edition may not have been
           queried. Mark the signal unverified so diffState carries a standing
           adverse-media hit forward instead of clearing it off coverage that
           never looked. Recall-safe: carry-forward only, never suppresses. */
        if (am.partial || am.fullMatrix === false) unverified.add('Adverse media (Google News)');
      }
      if (!am.errored && am.hit) {
        lists.push({ list: 'Adverse media (Google News)', hitName: (am.top && am.top.title || '').slice(0, 180) + (am.terms.length ? ' [' + am.terms.join(', ') + ']' : '') + (am.tier === 'weak' ? ' [weak-tier — generic terms only, corroboration needed]' : ''), score: am.score });
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
    if (cfg.fbi && enrich) {
      const fb = await checkFbi(s.name, { timeoutMs: cfg.checkTimeoutMs });
      if (fb.errored) { fbiErrors++; enrichmentIncomplete = true; }
      else if (fb.hit) {
        lists.push({ list: 'FBI Wanted', hitName: ((fb.match && fb.match.title || '') + ' [' + (fb.match && fb.match.classification || 'wanted') + ']').slice(0, 180), score: fb.score });
        band = strongerBand(band, fb.band); topScore = Math.max(topScore, fb.score);
      }
    }
    /* Worldwide PEP list (Wikidata harvest, local index — instant, never
       budget-gated). A PEP-list hit is a REVIEW-tier finding, never a
       sanctions designation: band caps at medium and the recommendation
       stays 'review' because hasSanctions reads only the sanctions match. */
    if (cfg.pepIndex) {
      const pw = screenName(s.name, cfg.pepIndex, thr, phonMode);
      for (const h of pw.lists) {
        const ctx = cfg.pepMeta && cfg.pepMeta.get(h.hitName);
        const detail = ctx ? (h.hitName + ' — ' + [ctx.position, ctx.country].filter(Boolean).join(', ')
          + (ctx.current ? '' : ' (former, within the PEP recency window)')) : h.hitName;
        lists.push({ list: h.list, hitName: detail.slice(0, 180), score: h.score });
      }
      if (pw.lists.length) { band = strongerBand(band, 'medium'); topScore = Math.max(topScore, Math.min(pw.topScore, 89)); }
    }

    /* screenName's recommendation distinguishes real designation hits
       ('sanctions-match') from a not-auto-screenable subject ('review', with
       the MANUAL REVIEW pseudo-list) — the latter must surface as a reviewable
       finding, never be promoted to a sanctions match nor demoted to clear. */
    /* Every remaining hit cleared by the registry ⇒ demote the ROW (medium /
       review — the weakOnly precedent), keep every hit visible + annotated,
       and flag the record so the case engine opens no fresh case. A single
       non-whitelisted hit (incl. any enrichment finding) restores full
       severity — demote-never-suppress, pair-level only. */
    const whitelistedOnly = lists.length > 0 && lists.every(h => h.whitelisted);
    const hasSanctions = raw.recommendation === 'sanctions-match' && !whitelistedOnly;
    const recommendation = hasSanctions ? 'sanctions-match' : (lists.length ? 'review' : 'clear');
    const merged = {
      name: s.name,
      topScore: lists.length ? topScore : raw.topScore,
      band: lists.length ? (whitelistedOnly ? 'medium' : band) : 'low',
      recommendation,
      hitCount: lists.length,
      lists
    };
    const nr = normalizeResult(merged, s);
    nr.enrichmentIncomplete = enrichmentIncomplete;
    if (unverified.size) nr.unverified = [...unverified];
    if (whitelistedOnly) nr.whitelistedOnly = true;
    heartbeat();
    return nr;
  });

  if (amErrors) console.error('sanctions-screen: adverse-media lookup failed for ' + amErrors + ' subject(s)');
  if (amPartial) console.log('sanctions-screen: adverse-media coverage was PARTIAL for ' + amPartial + ' subject(s) — some locales/GDELT did not answer (disclosed in the digest)');
  if (pepErrors) console.error('sanctions-screen: PEP lookup failed for ' + pepErrors + ' subject(s)');
  if (interpolErrors) console.error('sanctions-screen: Interpol lookup failed for ' + interpolErrors + ' subject(s)');
  if (fbiErrors) console.error('sanctions-screen: FBI Wanted lookup failed for ' + fbiErrors + ' subject(s)');
  if (enrichSkipped) console.log('sanctions-screen: enrichment time-budget reached — ' + enrichSkipped + ' subject(s) fully sanctions-screened but skipped adverse-media/PEP (best-effort, not degraded)');
  return { results, anyOk: true, degraded, errored: 0, amErrors, amPartial, pepErrors, interpolErrors, fbiErrors, enrichSkipped, notes: loaded.notes, coverage: loaded, shadow };
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
  /* An unscreened day must be a RED run, not a green one with an issue: the
     control-retry dispatcher only re-fires a control with no SUCCESSFUL run
     today, and the freshness check reads a green conclusion as evidence the
     daily screen happened. Exit code (never process.exit) so the sync writes
     above land and the workflow's always()-guarded steps still see the
     outputs; the issue step fires either way. */
  process.exitCode = 1;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const cfg = {
    sourcesFile: SANCTIONS_SOURCES_FILE,
    extraFile: process.env.SANCTIONS_EXTRA_FILE || 'data/sanctions-extra.json',
    threshold: resolveThreshold(process.env.SCREEN_MATCH_THRESHOLD),
    adverseMedia: process.env.SCREEN_ADVERSE_MEDIA !== '0',   // default on
    pep: process.env.SCREEN_PEP !== '0',                      // default on
    interpol: process.env.SCREEN_INTERPOL === '1',            // default OFF (opt-in; verify the public API on the runner before enabling)
    fbi: process.env.SCREEN_FBI === '1',                      // default OFF (opt-in; same contract as Interpol — verify on the runner before enabling)
    listTimeoutMs: Number(process.env.SCREEN_LIST_TIMEOUT_MS) || 60000,
    checkTimeoutMs: Number(process.env.SCREEN_CHECK_TIMEOUT_MS) || 12000,
    concurrency: Number(process.env.SCREEN_CONCURRENCY) || 8,
    /* Wall-clock budget for the best-effort enrichment phase (adverse-media/PEP).
       Sanctions matching is always run for every subject; once this elapses the
       remaining subjects skip enrichment so the job never approaches its timeout.
       Default 12 min leaves headroom under the 20-min job timeout. */
    enrichBudgetMs: Number(process.env.SCREEN_ENRICH_BUDGET_MS) || 720000,
    /* Cleared-FP registry (whitelist): default ON — an empty registry is a
       no-op, and the kill switch exists for incident response. */
    whitelist: process.env.SCREEN_WHITELIST !== '0',
    whitelistFile: process.env.SCREEN_WHITELIST_FILE || 'data/screening-whitelist.json',
    casesStateFile: process.env.CASES_STATE_FILE || 'data/screening-cases-state.json',
    /* OFAC-API second opinion: default OFF (opt-in — third-party transfer;
       record the processor in the third-party register before enabling). */
    secondOpinion: process.env.OFACAPI === '1' && !!process.env.OFAC_API_KEY,
    secondOpinionCap: Number(process.env.OFACAPI_CAP) || 25,
    secondOpinionTimeoutMs: Number(process.env.OFACAPI_TIMEOUT_MS) || 15000
  };
  if (process.env.OFACAPI === '1' && !process.env.OFAC_API_KEY) {
    console.warn('sanctions-screen: OFACAPI=1 but OFAC_API_KEY is missing — second opinion OFF');
  }
  /* Build the cleared-FP map from BOTH evidence-backed sources: the curated
     registry file and the '[x] false positive' dispositions the case manager
     recorded (screening-cases state, overlaid from the screen-state branch
     before this step). Fail-soft: an unreadable file means an empty registry
     (severity can only go UP from a registry failure, never down). */
  if (cfg.whitelist) {
    let curated = [];
    try {
      const wlf = JSON.parse(readFileSync(cfg.whitelistFile, 'utf8'));
      curated = Array.isArray(wlf.entries) ? wlf.entries : [];
    } catch { /* absent/unreadable registry file = empty registry */ }
    let casesState = {};
    try { casesState = JSON.parse(readFileSync(cfg.casesStateFile, 'utf8')) || {}; }
    catch { /* no cases state yet */ }
    cfg.whitelistMap = buildWhitelistMap(curated, casesState);
    if (cfg.whitelistMap.size) {
      console.log('sanctions-screen: cleared-FP registry active — ' + cfg.whitelistMap.size
        + ' pair(s) (' + curated.length + ' curated + case dispositions); matching hits are DEMOTED with the clearance cited, never removed');
    }
  }
  /* Worldwide PEP list (Wikidata harvest artifact, overlaid from the
     pep-worldwide-state branch). Optional layer: absent file = layer off,
     logged, never degraded sanctions coverage — but once loaded its name
     enters evaluatedSignals so standing PEP-list matches are protected on
     runs where the artifact is missing (never silently cleared). */
  if (process.env.SCREEN_PEP_LIST !== '0') {
    const pepFile = process.env.PEP_WORLDWIDE_FILE || 'data/pep-worldwide.json';
    try {
      const pep = pepListFromDataset(JSON.parse(readFileSync(pepFile, 'utf8')));
      if (pep.count > 0 && pep.list.names.length) {
        cfg.pepIndex = buildIndex([pep.list]);
        cfg.pepMeta = pep.meta;
        console.log('sanctions-screen: worldwide PEP list active — ' + pep.count + ' persons ('
          + pep.list.names.length + ' names incl. multilingual aliases; harvested ' + (pep.harvested || 'unknown') + ')');
      } else {
        console.log('sanctions-screen: worldwide PEP list file present but empty — layer off this run');
      }
    } catch {
      console.log('sanctions-screen: no worldwide PEP list artifact (' + pepFile + ') — harvest pending; the per-name Wikidata PEP signal still runs');
    }
  }
  const asanaToken = process.env.ASANA_ACCESS_TOKEN || '';

  if (!asanaToken) return bailUnscreened('ASANA_ACCESS_TOKEN not set — cannot read the Customer Database', today);

  let subjects;
  try { subjects = await fetchAsanaSubjects(CUSTOMER_PROJECT_GID, asanaToken); }
  catch (e) { return bailUnscreened('could not read the Customer Database (' + (e && e.message || e) + ')', today); }
  if (!subjects.length) return bailUnscreened('the Customer Database returned 0 active customers', today);

  if (EMPLOYEE_PROJECT_GID) {
    let employees;
    try { employees = await fetchAsanaSubjects(EMPLOYEE_PROJECT_GID, asanaToken); }
    catch (e) { return bailUnscreened('could not read the HR – Employees project (' + (e && e.message || e) + ') — employee screening is configured, so the run must not proceed without it', today); }
    if (!employees.length) return bailUnscreened('the HR – Employees project returned 0 subjects while employee screening is configured — set ASANA_EMPLOYEE_PROJECT_GID empty to disable it explicitly', today);
    console.log('sanctions-screen: + ' + employees.length + ' employees from the HR – Employees project (staff screening)');
    subjects = subjects.concat(employees);
  }

  const individuals = subjects.filter(s => s.entityType === 'individual').length;
  const entities = subjects.length - individuals;
  console.log('sanctions-screen: screening ' + subjects.length + ' subjects (' + entities + ' entities + ' + individuals + ' principals/UBOs) from the FULL Customer Database against the free consolidated lists'
    + (cfg.adverseMedia ? ' + adverse media' : '') + (cfg.pep ? ' + PEP' : ''));
  const screen = await screenLocally(subjects, cfg);
  if (!screen.anyOk) return bailUnscreened('no sanctions list could be loaded — ' + ((screen.notes || []).join('; ') || 'all sources failed'), today);

  const prevState = loadState();
  /* Lists fully re-verified this run. A `partial` list (its a.k.a. file failed
     to load — e.g. OFAC SDN without alt.csv) screened only part of its
     designations, so it is EXCLUDED here: diffState then carries its standing
     matches forward instead of clearing them off reduced coverage. */
  const screenedLists = ((screen.coverage && screen.coverage.lists) || [])
    .filter(L => !L.partial).map(L => L.name).filter(Boolean);
  /* Enrichment signals whose module actually RAN this run — the enrichment
     counterpart of screenedLists. A module switched off performs no lookup and
     so sets no per-subject error flag; without this, disabling one would make
     every standing match it produced indistinguishable from a verified clear. */
  const evaluatedSignals = [
    cfg.adverseMedia ? 'Adverse media (Google News)' : null,
    cfg.pep ? 'PEP (Wikidata)' : null,
    cfg.interpol ? 'Interpol Red Notice' : null,
    cfg.fbi ? 'FBI Wanted' : null,
    cfg.pepIndex ? PEP_LIST_NAME : null,
  ].filter(Boolean);
  const { alerts, cleared, notScreened, matchCount, nextState } =
    diffState(prevState, screen.results, today, cfg.threshold, screenedLists, evaluatedSignals);
  if (notScreened && notScreened.length) {
    console.log(`sanctions-screen: ${notScreened.length} standing match(es) left the screened population — `
      + 'cases HELD for manual disposition, not auto-cleared: '
      + notScreened.map(n => n.name || n.key).join(', '));
  }

  /* SECOND OPINION (OFAC-API) — independent corroboration on the NEW/CHANGED
     matches only (bounded by OFACAPI_CAP, so a list-update day cannot burn the
     plan). ADDITIVE-ONLY by design: the verdict is attached to the state
     record (→ rendered on the case card), never merged into lists/band/
     recommendation/signature — an external engine can corroborate or visibly
     DISAGREE, but can never downgrade, clear, or re-alert a hit. A failed
     lookup is disclosed on the card as a lost signal, never read as a clear. */
  if (cfg.secondOpinion && alerts.length) {
    let soOk = 0, soFail = 0;
    for (const a of alerts.slice(0, cfg.secondOpinionCap)) {
      const rec = nextState.subjects[a.key];
      if (!rec) continue;
      let parsed;
      try {
        const resp = await withTimeout((signal) => fetch('https://api.ofac-api.com/v4/screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: process.env.OFAC_API_KEY,
            minScore: 80,
            sources: ['SDN', 'NONSDN', 'UN', 'UK', 'EU'],
            cases: [{ name: a.name }]
          }),
          signal
        }), cfg.secondOpinionTimeoutMs);
        parsed = (resp && resp.ok) ? parseOfacApiResponse(await resp.json())
          : { status: 'unavailable', error: 'http ' + (resp ? resp.status : 'no-response') };
      } catch (e) {
        parsed = { status: 'unavailable', error: String(e && e.message || e).slice(0, 120) };
      }
      rec.secondOpinion = { provider: 'OFAC-API', checkedAt: today, ...parsed };
      if (parsed.status === 'unavailable') soFail++; else soOk++;
    }
    if (alerts.length > cfg.secondOpinionCap) {
      console.log('sanctions-screen: second opinion capped at ' + cfg.secondOpinionCap + ' of '
        + alerts.length + ' new/changed matches this run (OFACAPI_CAP)');
    }
    console.log('sanctions-screen: second opinion (OFAC-API) attached to ' + (soOk + soFail)
      + ' case record(s) — ' + soOk + ' answered, ' + soFail + ' unavailable (disclosed on the card)');
  }
  /* What ACTUALLY loaded (with partial-alias flags) + what failed — feeds the
     coverage-honesty lines in the report/alert instead of the fixed scope claim. */
  const loadedListNames = ((screen.coverage && screen.coverage.lists) || [])
    .map(L => (L.name || '') + (L.partial ? ' (partial — alias file missing)' : '')).filter(Boolean);
  const meta = { screened: subjects.length, entities, individuals, degraded: screen.degraded, errored: screen.errored,
    loadedLists: loadedListNames, failures: screen.notes || [] };
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
    enrichment: { amErrors: screen.amErrors || 0, amPartial: screen.amPartial || 0, pepErrors: screen.pepErrors || 0,
      skipped: screen.enrichSkipped || 0,
      /* per-subject adverse-media sweep breadth this run — the SAME resolution
         checkAdverseMedia uses (explicit edition ids win over the budgeted
         core+rotation sweep), so the digest's provenance matches the lookups */
      amLocalesPerSubject: cfg.adverseMedia
        ? (String(process.env.ADVERSE_MEDIA_LOCALES || '').trim() ? activeLocales() : budgetedLocales()).length
        : 0 },
    /* Log-only challenger evidence (SCREEN_SHADOW_THRESHOLD) — kept OUT of
       alerts/matchCount/state; feeds the champion-challenger decision log. */
    shadow: screen.shadow || [],
    alerts: alerts.map(a => ({
      key: a.key, name: a.name, jurisdiction: a.jurisdiction || '', band: a.band,
      topScore: a.topScore, recommendation: a.recommendation,
      lists: (a.lists || []).map(h => (typeof h === 'string' ? h : h.list)).filter(Boolean),
      /* Evidence detail (matched designated name · score · mechanism ·
         confidence) so the digest names WHAT matched, not just which list. */
      hits: hitDetail((a.lists || []).filter(h => typeof h === 'object'))
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
      const html = buildScreenHtml(alerts, { runLink: runUrl(), today, degraded: screen.degraded,
        loadedLists: loadedListNames, failures: screen.notes || [] });
      const section = process.env.ASANA_SECTION_GID || undefined;
      /* match alerts are higher-severity than list-change notes — pull the review date in */
      const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      /* MIRROR into the MLRO queue (see the workflow env comment). The env was
         set on this step since #305's fix but never consumed here — the alert
         reached only the #305 destination. Additive: one task, two memberships. */
      const mirror = process.env.ASANA_MIRROR_PROJECT_GID
        ? [{ project: process.env.ASANA_MIRROR_PROJECT_GID,
             section: process.env.ASANA_MIRROR_SECTION_GID || undefined }]
        : [];
      const url = await notifyAsana(title, report, { project: REG_PROJECT_GID, html, section, due, mirror });
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
