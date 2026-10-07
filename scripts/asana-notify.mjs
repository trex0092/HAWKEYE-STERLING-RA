/* Shared Asana notifier for the monitoring workflows (Regulatory Watch,
   Sanctions Watch, FATF Watchdog list moves). Every detected change becomes
   one card in the dedicated "Ongoing Monitoring" project so
   all automated alerts stay in one organised place — separate from the client
   HAWKEYE STERLING APP project.

   Notifications target ASANA_REG_PROJECT_GID, falling back to the hardcoded
   project below. The Asana token stays server-side (ASANA_ACCESS_TOKEN, a
   GitHub Actions secret). No-ops with a clear log when the token is absent, so
   local/dry runs never fail.

   Reuses the task-creation pattern from scripts/fatf-watchdog.mjs. */

import { MONITORING_PROJECT, approvedSectionByName, requireApprovedSection, verifySection } from './asana-sections.mjs';

// HAWKEYE STERLING APP monitoring project
export const REG_PROJECT_GID =
  process.env.ASANA_REG_PROJECT_GID || '1216203370612914';

export function asanaEnabled() {
  return !!process.env.ASANA_ACCESS_TOKEN;
}

/* ── Transient-failure policy (shared by every watcher that posts to Asana) ──
   Rate limits (429) and server errors (5xx) are retried with bounded backoff so
   a blip never drops a monitoring alert; other 4xx are real errors and fail
   fast. Retry-After is honoured when Asana sends one (capped at 30s). */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
export function isRetryable(status) { return RETRYABLE.has(Number(status)); }
export function retryDelayMs(attempt, retryAfter) {
  const ra = Number(retryAfter);
  if (Number.isFinite(ra) && ra > 0) return Math.min(ra * 1000, 30000);
  return Math.min(1000 * 2 ** attempt, 8000);
}
const sleep = ms => new Promise(res => setTimeout(res, ms));
const MAX_ATTEMPTS = 3;

export async function asana(path, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    let r;
    try {
      r = await fetch('https://app.asana.com/api/1.0' + path, {
        ...opts,
        headers: {
          Authorization: 'Bearer ' + process.env.ASANA_ACCESS_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(opts.headers || {})
        }
      });
    } catch (e) {
      /* Network-level failure (reset, DNS, TLS) — as transient as a 503; retry
         with the same bounded backoff instead of dying on the first blip. */
      if (attempt < MAX_ATTEMPTS - 1) {
        const delay = retryDelayMs(attempt);
        console.warn('asana-notify: network error (' + (e && e.message || e) + ') — retry ' + (attempt + 1) + '/' + (MAX_ATTEMPTS - 1) + ' in ' + delay + 'ms');
        await sleep(delay);
        continue;
      }
      throw e;
    }
    const d = await r.json().catch(() => ({}));
    if (r.ok) return d;
    if (r.status === 401) {
      throw new Error('Asana 401 Unauthorized — ASANA_ACCESS_TOKEN may have expired or been revoked. Rotate it in GitHub Settings → Secrets → ASANA_ACCESS_TOKEN.');
    }
    if (attempt < MAX_ATTEMPTS - 1 && isRetryable(r.status)) {
      const delay = retryDelayMs(attempt, r.headers && r.headers.get && r.headers.get('retry-after'));
      console.warn('asana-notify: Asana ' + r.status + ' — retry ' + (attempt + 1) + '/' + (MAX_ATTEMPTS - 1) + ' in ' + delay + 'ms');
      await sleep(delay);
      continue;
    }
    throw new Error('Asana ' + r.status + ': ' + JSON.stringify(d.errors || d).slice(0, 300));
  }
}

/* ── Re-run idempotency ──────────────────────────────────────────────────────
   A workflow re-run (or a retry after a failure DOWNSTREAM of a successful
   post) must not file the same alert card twice. A task in the target project
   with the identical name created inside the window is treated as this alert
   already delivered. The window is deliberately SHORT (6h): re-runs happen
   within minutes/hours, while the daily watchers run 24h apart and may
   legitimately produce an identical title two days running ("Sanctions Watch —
   1 list change") — a wider window would silently suppress day two's real
   alert. Pure; unit-tested. */
export function findRecentDuplicate(tasks, name, nowMs, windowHours = 6, dedupPrefix = null) {
  const cutoff = nowMs - windowHours * 3600000;
  /* Compare against the title AS FILED — the same byte-cap the writer applies.
     A character slice here would never match a byte-capped non-Latin title,
     and the guard would silently stop deduping exactly on the multilingual
     cards where a re-run double-posts. */
  const want = fitAsanaName(name);
  /* dedupPrefix: cards whose titles embed run-varying counts ("… — 2 new
     match(es) · 325 screened") never string-match their re-run twin, so a
     manual re-run double-posted the day's card. A caller that puts the STABLE
     part of its title here (e.g. "🛡️ Sanctions Screen — 2026-08-05") dedups on
     that prefix inside the window; exact-match behaviour is unchanged without it. */
  return (tasks || []).find(t => {
    const n = String(t && t.name || '');
    const same = dedupPrefix ? n.startsWith(dedupPrefix) : n === want;
    return same && (Date.parse((t && t.created_at) || '') || 0) >= cutoff;
  }) || null;
}

/* Resolve a section GID by name within a project, creating it if absent —
   idempotent (an existing name is reused), shared by the schedulers that file
   under a named column. */
export async function ensureSection(projectGid, name) {
  /* The monitoring project is intentionally restricted to the approved
     sections in asana-sections.mjs. Never recreate retired lifecycle or legacy sections there. */
  if (String(projectGid) === MONITORING_PROJECT) {
    const approved = approvedSectionByName(name);
    if (!approved) throw new Error('Asana routing: refusing unapproved monitoring section: ' + name);
    await verifySection(asana, projectGid, approved.gid);
    return approved.gid;
  }
  const want = String(name).trim().toLowerCase();
  for (const sec of await asanaPages('/projects/' + projectGid + '/sections?limit=100&opt_fields=name', 'sections in project ' + projectGid)) {
    if (String(sec.name || '').trim().toLowerCase() === want) return sec.gid;
  }
  const created = await asana('/projects/' + projectGid + '/sections', { method: 'POST', body: JSON.stringify({ data: { name } }) });
  return created.data && created.data.gid;
}

/* Walk every page of an Asana collection. The cap is a runaway guard — an API
   that keeps handing back a next_page would otherwise loop forever — and it is
   LOUD when hit: the callers here feed the duplicate guard, where a short read
   risks a duplicate card and stopping risks no card at all, so they continue on
   the partial. Nothing that decides coverage reads through this helper. */
export const ASANA_PAGE_CAP = Number(process.env.ASANA_PAGE_CAP) || 500;

async function asanaPages(base, what) {
  const out = [];
  let path = base, pages = 0;
  while (path) {
    const d = await asana(path);
    out.push(...(d.data || []));
    path = d.next_page ? base + '&offset=' + d.next_page.offset : null;
    if (path && ++pages >= ASANA_PAGE_CAP) {
      console.error('asana-notify: ' + what + ' — read ' + out.length + ' record(s) over ' + pages
        + ' pages and Asana still reports more; the page cap (' + ASANA_PAGE_CAP
        + ') was hit. Continuing on the PARTIAL read — raise ASANA_PAGE_CAP.');
      break;
    }
  }
  return out;
}

/* All tasks in a project (name, created_at, permalink) — for the dedup guard. */
export async function listProjectTasks(projectGid) {
  return asanaPages('/projects/' + projectGid + '/tasks?limit=100&opt_fields=name,created_at,permalink_url',
    'task scan of project ' + projectGid);
}

/* Create one alert card in the Ongoing Monitoring project.
   Pass opts.html for an Asana rich-text body (html_notes — bold headings,
   bulleted sources, clickable links); otherwise notes is sent as plain text.
   Pass opts.section (a section GID) to file the card under that section so the
   project stays organised (Regulatory changes / Sanctions updates / etc.).
   Returns the task permalink, or null when no token is configured. */
export async function notifyAsana(name, notes, opts = {}) {
  const project = opts.project || REG_PROJECT_GID;
  if (!asanaEnabled()) {
    console.log('asana-notify: ASANA_ACCESS_TOKEN not set — skipping Asana card ("' + name + '")');
    return null;
  }
  if (String(project) === MONITORING_PROJECT) {
    requireApprovedSection(project, opts.section);
    await verifySection(asana, project, opts.section);
  }
  const due = opts.due || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const data = {
    /* Byte-capped, not character-capped — see fitAsanaHtml's note. Alert titles
       carry designated names verbatim, and those are routinely non-Latin. */
    name: fitAsanaName(name),
    projects: [project],
    due_on: due
  };
  /* MIRROR — one task, multiple project memberships (the same multi-homing the
     daily screening uses for its dual MLRO queue). #305 routed every pipeline
     card to the HAWKEYE STERLING APP project; the reader who actually works the
     law-change queue watches a different project, so from 22 Jul the card was
     being filed correctly and still read as "nothing arrived". Mirroring is
     ADDITIVE — the #305 destination is untouched, the card simply also appears
     where it is worked. One task, so no duplicate to reconcile. */
  const mirror = (opts.mirror || []).filter(m => m && m.project && m.project !== project);
  if (mirror.length) {
    data.projects = [project, ...mirror.map(m => m.project)];
    data.memberships = [
      ...(opts.section ? [{ project, section: opts.section }] : []),
      ...mirror.map(m => (m.section ? { project: m.project, section: m.section } : { project: m.project })),
    ];
  }
  /* Idempotency guard — never double-post the same card on a workflow re-run.
     Best-effort: if the check itself fails we still post (losing an alert is
     worse than a rare duplicate). */
  try {
    const dup = findRecentDuplicate(await listProjectTasks(project), data.name, Date.now(), 6, opts.dedupPrefix || null);
    if (dup) {
      if (String(project) === MONITORING_PROJECT && opts.section) {
        await asana('/sections/' + opts.section + '/addTask', { method: 'POST', body: JSON.stringify({ data: { task: dup.gid } }) });
      }
      console.log('asana-notify: ' + (opts.dedupPrefix ? 'same-prefix card ("' + opts.dedupPrefix + '")' : 'identical card')
        + ' already filed within 6h — verified/routed ("' + data.name + '")');
      return dup.permalink_url || null;
    }
  } catch (e) {
    console.warn('asana-notify: duplicate check failed (' + (e && e.message || e) + ') — posting anyway');
  }
  /* Size-capped (worst-case rich text, see asanaHtmlSize), tag-aware — a
     character slice let a multilingual digest weigh 65,424 bytes against
     Asana's 65,400 limit and lose the whole card. */
  if (opts.html) data.html_notes = fitAsanaHtml(opts.html);
  else data.notes = fitAsanaText(notes);   // byte cut, and SAYS it was cut
  if (opts.assignee !== null) data.assignee = opts.assignee || 'me';
  let d;
  try {
    d = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data }) });
  } catch (e) {
    /* Backstop (screen.py post_unified_task parity): should Asana's accounting
       ever outgrow asanaHtmlSize, refit once on a smaller budget rather than
       lose the whole card. The refit always carries the TRUNCATED notice. */
    if (!opts.html || !/too large/i.test(String(e && e.message || e))) throw e;
    const smaller = Math.floor(ASANA_HTML_MAX_BYTES * 0.6);
    console.warn('asana-notify: Asana refused html_notes as too large — retrying once at a '
      + smaller + '-byte rich-text budget (truncation disclosed in the card)');
    data.html_notes = fitAsanaHtml(opts.html, smaller);
    if (data.html_notes === opts.html) throw e;   // nothing left to cut
    d = await asana('/tasks', { method: 'POST', body: JSON.stringify({ data }) });
  }
  const gid = d.data && d.data.gid;
  /* Placement is part of delivery. A card in the wrong section is not a
     successful delivery, so fail loudly instead of leaving it in the default
     section. */
  if (gid && opts.section) {
    await asana('/sections/' + opts.section + '/addTask', { method: 'POST', body: JSON.stringify({ data: { task: gid } }) });
    if (String(project) === MONITORING_PROJECT) {
      const check = await asana('/tasks/' + gid + '?opt_fields=memberships.project.gid,memberships.section.gid');
      const placed = ((check.data && check.data.memberships) || []).some(m =>
        m.project && String(m.project.gid) === String(project) &&
        m.section && String(m.section.gid) === String(opts.section));
      if (!placed) throw new Error('Asana routing: task ' + gid + ' was created but is not in approved section ' + opts.section);
    }
  }
  return d.data && d.data.permalink_url;
}

/* Asana rejects an html_notes body over 65,400 BYTES. The old cap sliced at
   60,000 CHARACTERS, which is the same thing only for ASCII — and the daily
   screening digest stopped being ASCII the day the worldwide PEP list started
   contributing Arabic, Cyrillic and Han names to it. Those cost 2-3 bytes each,
   so 60,000 characters weighed 65,424 bytes and Asana 400'd the whole card:

     html_notes: Value is too large, 65424 > 65400 bytes

   The MLRO got no digest at all on a run that found 88 new matches — the day
   the card mattered most.

   Bytes were still not the measure. On 2026-09-26 a digest that PASSED the
   byte cap was refused with a different error:

     .html_notes : Rich text value is too large

   That is the same limit `notes` hits (see asanaTextSize below): Asana also
   limits the CONVERTED rich text, which can numeric-entity-encode every
   non-ASCII code point (İ → &#304;, — → &#8212;, م → &#1605;). A byte cap
   under-counts exactly the Turkish, Arabic and punctuation-heavy rows the
   digest carries. So measure with asanaHtmlSize, which is never below the
   UTF-8 length either, so both limits hold. Leave room for the notice, and
   notifyAsana retries once on a smaller budget if Asana still refuses.

   Truncating is not just a substring: html_notes is parsed as STRICT XML, so a
   cut through the middle of a tag, or one that orphans an open <ul>, 400s
   exactly as hard as being too long. So cut back to a tag boundary, then close
   whatever is still open, in reverse order. */
export const ASANA_HTML_MAX_BYTES = Number(process.env.ASANA_HTML_MAX_BYTES) || 65000;
const VOID_TAGS = new Set(['br', 'hr', 'img']);

/* Worst-case stored size of an html_notes body. The markup is already
   escaped as sent, so &, < and > cost one apiece. Quotes may be re-escaped
   in text nodes (&quot; / &#39;), so they are budgeted at 6. Attribute quotes
   are over-counted, which is harmless. Every non-ASCII code point costs its
   numeric-entity form, which is never smaller than its UTF-8 bytes. */
export function asanaHtmlSize(s) {
  let total = 0;
  for (const ch of String(s == null ? '' : s)) {
    if (ch === '"' || ch === "'") { total += 6; continue; }
    const cp = ch.codePointAt(0);
    total += cp < 0x80 ? 1 : 3 + String(cp).length;   // "&#" + digits + ";"
  }
  return total;
}

export function fitAsanaHtml(html, max = ASANA_HTML_MAX_BYTES) {
  const s = String(html == null ? '' : html);
  if (asanaHtmlSize(s) <= max) return s;
  const notice = '<strong>⚠ TRUNCATED to fit Asana\'s size limit — findings below the cut are NOT in this card. '
    + 'Treat it as incomplete and read the full report on the screening run.</strong>';
  const budget = max - asanaHtmlSize(notice) - 32;   // 32: room for closers

  /* Walk whole characters so a multi-byte sequence is never split. */
  let cut = 0, size = 0;
  for (const ch of s) {
    const b = asanaHtmlSize(ch);
    if (size + b > budget) break;
    size += b; cut += ch.length;
  }
  /* Where does the cut land? If it is inside TEXT (the last '<' is already
     closed) we can keep the text right up to the cut — backing up to the tag
     boundary there would throw away the whole node, and a body that is one
     giant <code> block would come back all but empty. Only a cut that lands
     INSIDE a tag has to retreat, because a half-written element fails XML.
     Either way, never split a character entity: "&amp" without its ';' is as
     fatal to the parser as a broken tag. */
  const lastClose = s.lastIndexOf('>', cut);
  const lastOpen = s.lastIndexOf('<', cut);
  let kept;
  if (lastOpen <= lastClose) {
    let end = cut;
    const amp = s.lastIndexOf('&', end);
    const semi = amp >= 0 ? s.indexOf(';', amp) : -1;
    if (amp > lastClose && (semi < 0 || semi >= end)) end = amp;
    kept = s.slice(0, end);
  } else {
    kept = lastClose >= 0 ? s.slice(0, lastClose + 1) : '';
  }

  /* Close what is still open, innermost first. */
  const open = [];
  for (const m of kept.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*?(\/?)>/g)) {
    const [, slash, name, selfClose] = m;
    const tag = name.toLowerCase();
    if (VOID_TAGS.has(tag) || selfClose) continue;
    if (slash) { const i = open.lastIndexOf(tag); if (i >= 0) open.splice(i, 1); }
    else open.push(tag);
  }
  const body = open.indexOf('body');
  if (body >= 0) kept += notice;                 // notice belongs INSIDE <body>
  for (let i = open.length - 1; i >= 0; i--) kept += '</' + open[i] + '>';
  return body >= 0 ? kept : kept + notice;
}

/* Plain-text sibling of fitAsanaHtml, for the `notes` and `name` fields.

   MEASURED IN WORST-CASE RICH-TEXT SIZE, NOT UTF-8 BYTES. `notes` is not stored
   as sent: Asana converts it to rich text and applies its limit to the CONVERTED
   form, which escapes HTML specials (& → &amp;) and can numeric-entity-encode
   every non-ASCII code point (م → &#1605;). A UTF-8 byte cap UNDER-COUNTS badly
   on exactly the multilingual content this repo files — 32,500 Arabic characters
   are 65,000 UTF-8 bytes but roughly 244,000 once converted, so a body that
   passes a byte cap is still refused.

   The Python engine learned this the hard way on 2026-07-16: capping by
   characters, then by raw UTF-8 bytes, then by html.escape'd bytes, each still
   returning "Rich text value is too large". It settled on numeric-entity
   accounting (screen.py `_asana_notes_size`). This is that measure ported, so
   both engines cap the same field by the same rule — the JS side shipped the
   byte version earlier today and would have hit the identical wall.

   fitAsanaHtml above uses the same entity accounting (asanaHtmlSize), minus
   the &/</> escapes, because html_notes arrives already escaped. It moved
   off its UTF-8 byte cap after the 2026-09-26 "Rich text value is too large"
   refusal showed html_notes is limited after conversion too.

   Truncation is always marked so a cut record never reads as a complete one. */
const ENTITY_COST = { '&': 5, '<': 4, '>': 4, '"': 6, "'": 6 };

export function asanaTextSize(s) {
  let total = 0;
  for (const ch of String(s == null ? '' : s)) {
    const named = ENTITY_COST[ch];
    if (named !== undefined) { total += named; continue; }
    const cp = ch.codePointAt(0);
    total += cp < 0x80 ? 1 : 3 + String(cp).length;   // "&#" + digits + ";"
  }
  return total;
}

export const ASANA_NAME_MAX_BYTES = 250;
const TEXT_NOTICE = ' … [TRUNCATED to fit Asana — see the workflow run for the full record]';

export function fitAsanaText(text, max = ASANA_HTML_MAX_BYTES, notice = TEXT_NOTICE) {
  const s = String(text == null ? '' : text);
  if (asanaTextSize(s) <= max) return s;
  /* A notice longer than the cap would make the result BIGGER than the input
     it replaced — degrade to a bare cut rather than blow the limit. */
  const mark = asanaTextSize(notice) < max ? notice : '';
  const budget = max - asanaTextSize(mark);
  let cut = 0, size = 0;
  for (const ch of s) {
    const c = asanaTextSize(ch);
    if (size + c > budget) break;
    size += c; cut += ch.length;
  }
  return s.slice(0, cut) + mark;
}

/* Task titles have their own, much smaller budget, so they get a short mark. */
export function fitAsanaName(name, max = ASANA_NAME_MAX_BYTES) {
  return fitAsanaText(name, max, ' …[cut]');
}

/* Escape text for safe inclusion in Asana html_notes (XML-strict). */
export function esc(s) {
  return String(s == null ? '' : s)
    /* Asana's html_notes endpoint parses the payload as XML, and XML 1.0
       forbids most control characters and unpaired surrogates OUTRIGHT —
       entity-escaping cannot save them. Designated names arriving from
       30+ national registers occasionally carry stray control bytes
       (observed live 2026-08-05: four case creates 400'd with
       xml_parsing_error), so strip the un-representable characters first,
       then entity-escape the representable ones. */
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g, '$1')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Build an Asana-safe rich-text body from a watcher's structured changes
   ({id,name,jurisdiction,url,status}). Asana rich text has no tables, so each
   changed source becomes a list item. Returns a single <body>…</body> root. */
export function buildHtmlBody({ heading, summary, changes = [], runLink, reviewNote }) {
  const SEV_BADGE = { HIGH: '🔴 HIGH', MEDIUM: '🟠 MEDIUM', LOW: '🟢 LOW' };
  const items = changes.map(c => {
    /* Severity triage first, so the reviewer knows what to read first. */
    const badge = SEV_BADGE[String(c.severity || '').toUpperCase()] || '';
    const sev = badge ? badge + (c.severityReason ? ' (' + esc(c.severityReason) + ')' : '') + ' — ' : '';
    const what = c.status === 'new' ? 'first snapshot recorded'
      : c.status === 'unreachable' ? ('UNREACHABLE — ' + esc(c.detail || 'fetch failing repeatedly') + ' — monitoring gap, investigate')
      : sev + 'content changed'
        + (c.items ? ' — ' + c.items.addedCount + ' new / ' + c.items.removedCount + ' removed item(s)' : '')
        + (c.diff ? ' — ' + c.diff.addedCount + ' added / ' + c.diff.removedCount + ' removed text segment(s)' : '');
    const link = c.url ? ' — <a href="' + esc(c.url) + '">open source</a>' : '';
    const juris = c.jurisdiction ? ' (' + esc(c.jurisdiction) + ')' : '';
    /* Detailed delivery: itemise the actual additions/deletions on the card
       (nested list), so the reviewer sees WHAT moved without opening the page. */
    let detail = '';
    const rows = [];
    /* Which versions were compared (date + direct / archive capture). */
    if (c.status === 'changed' && (c.prevAsOf || c.asOf)) {
      const how = v => v ? ' (' + esc(v) + ')' : ' (direct fetch)';
      rows.push('<li><em>Compared:</em> version of ' + esc(c.prevAsOf || 'an earlier run') + how(c.prevVia)
        + ' → version of ' + esc(c.asOf || 'today') + how(c.via) + '</li>');
    }
    /* Itemised publications: the title as printed, linked to the instrument. */
    if (c.items) {
      for (const l of c.items.added) rows.push('<li>🆕 <strong>New item:</strong> <a href="' + esc(l.h) + '">' + esc(l.t) + '</a></li>');
      for (const l of c.items.removed) rows.push('<li>🗑 <strong>No longer listed:</strong> <a href="' + esc(l.h) + '">' + esc(l.t) + '</a></li>');
      const moreItems = (c.items.addedCount - c.items.added.length) + (c.items.removedCount - c.items.removed.length);
      if (moreItems > 0) rows.push('<li>… ' + moreItems + ' more item(s) — listed in the workflow run log</li>');
    } else if (c.itemsNote) {
      rows.push('<li>' + esc(c.itemsNote) + '</li>');
    }
    /* AI analysis (when the draft step ran): labelled fields, never a verdict. */
    if (c.analysis && typeof c.analysis === 'object') {
      const A = [['changed', 'What changed'], ['impact', 'Impact on a UAE DPMS'], ['action', 'Action to consider'],
        ['instrument', 'Instrument'], ['effective', 'Effective date']];
      const li = A.filter(([k]) => c.analysis[k]).map(([k, label]) => '<li><strong>' + label + ':</strong> ' + esc(c.analysis[k]) + '</li>');
      if (li.length) rows.push('<li><em>AI analysis — verify against the source before acting:</em><ul>' + li.join('') + '</ul></li>');
    }
    if (c.diff) {
      for (const s of c.diff.added) rows.push('<li>➕ added: “' + esc(s) + '”</li>');
      for (const s of c.diff.removed) rows.push('<li>➖ removed: “' + esc(s) + '”</li>');
      const more = (c.diff.addedCount - c.diff.added.length) + (c.diff.removedCount - c.diff.removed.length);
      if (more > 0) rows.push('<li>… ' + more + ' more segment(s) — full excerpts in the workflow run log</li>');
    } else if (c.diffNote) {
      rows.push('<li>' + esc(c.diffNote) + '</li>');
    }
    if (rows.length) detail = '<ul>' + rows.join('') + '</ul>';
    return '<li><strong>' + esc(c.name) + '</strong>' + juris + ' — ' + what + link + detail + '</li>';
  }).join('');
  const parts = ['<body>'];
  if (heading) parts.push('<h2>' + esc(heading) + '</h2>');
  if (summary) parts.push('<strong>' + esc(summary) + '</strong>');
  if (items) parts.push('<ul>' + items + '</ul>');
  parts.push('<em>Detection is automatic; applying any wording change stays a reviewed decision.</em>');
  /* Optional reviewer checklist (Regulatory Watch): what the reviewed
     decision has to record, so the card is the evidence of it. */
  if (reviewNote) parts.push('<strong>Reviewer record</strong><ul>'
    + [].concat(reviewNote).map(line => '<li>' + esc(line) + '</li>').join('') + '</ul>');
  if (runLink) parts.push('<a href="' + esc(runLink) + '">View the workflow run</a>');
  parts.push('</body>');
  return parts.join('');
}

/* Helper: a GitHub Actions run URL for "open the run" links in card notes. */
export function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID)
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : '';
}
