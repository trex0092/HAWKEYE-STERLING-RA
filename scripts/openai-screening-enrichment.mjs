/* Optional OpenAI enrichment for the Asana daily screening digest.

   IMPORTANT: this module is additive only. It never changes sanctions/PEP/
   adverse-media matches, scores, recommendations, case state, or Asana routing.
   If OpenAI is unavailable or the key is missing, the existing screening output
   is delivered unchanged.

   The API receives only the already-produced screening evidence needed to
   explain the run. It is instructed not to infer facts that are absent from the
   supplied evidence and not to make a compliance disposition. */

export const DEFAULT_OPENAI_SCREENING_MODEL = 'gpt-5.6-luna';
export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function clip(value, max = 120) {
  const s = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function finiteCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function boundedInt(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isSafeInteger(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function safeOpenAIError(status) {
  const code = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
  if (code === 401 || code === 403) return 'OpenAI access denied (HTTP ' + code + '); check API credentials and model entitlement';
  if (code === 429) return 'OpenAI rate limit or account quota reached (HTTP 429); check usage limits';
  if (code >= 500) return 'OpenAI service unavailable (HTTP ' + code + '); retry on a later run';
  return 'OpenAI request rejected (HTTP ' + (code || 'unknown') + '); review model and request configuration';
}

export function safeUsage(usage) {
  return {
    input_tokens: finiteCount(usage && usage.input_tokens) || 0,
    output_tokens: finiteCount(usage && usage.output_tokens) || 0,
    total_tokens: finiteCount(usage && usage.total_tokens) || 0
  };
}

/* This is an optional and purely additive analyst note. The REAL screening
 * record and Asana digest retain every alert. Here the model receives a small
 * explicitly sampled summary instead of up to 40 * 20 long hit descriptions,
 * and raw nested upstream diagnostics NEVER enter the model prompt. */
export function screeningEvidence(results) {
  const r = results && typeof results === 'object' && !Array.isArray(results) ? results : {};
  const rawAlerts = Array.isArray(r.alerts) ? r.alerts : [];
  const rawFailures = Array.isArray(r.failures) ? r.failures : [];
  const rawLists = Array.isArray(r.lists) ? r.lists : [];
  const alerts = rawAlerts.slice(0, 12).map(row => {
    const a = row && typeof row === 'object' ? row : {};
    return {
      name: clip(a.name, 160),
      jurisdiction: clip(a.jurisdiction, 64),
      band: clip(a.band, 24),
      score: finiteCount(a.topScore),
      recommendation: clip(a.recommendation, 80),
      hits: (Array.isArray(a.hits) ? a.hits : []).slice(0, 4).map(item => {
        const h = item && typeof item === 'object' ? item : {};
        return {
          list: clip(h.list, 80),
          matched_name_or_evidence: clip(h.hitName, 180),
          score: finiteCount(h.score),
          mechanism: clip(h.mechanism, 60),
          confidence: clip(h.confidence, 40)
        };
      })
    };
  });
  const health = r.enrichment && typeof r.enrichment === 'object' && !Array.isArray(r.enrichment)
    ? r.enrichment : {};
  const allHits = rawAlerts.reduce((sum, a) =>
    sum + (a && Array.isArray(a.hits) ? a.hits.length : 0), 0);
  const e = {
    date: clip(r.date, 32),
    screened: finiteCount(r.screened),
    entities: finiteCount(r.entities),
    individuals: finiteCount(r.individuals),
    standing_matches: finiteCount(r.matchCount),
    new_or_changed_matches: finiteCount(r.newMatches),
    degraded: r.degraded === true,
    coverage_failures: rawFailures.slice(0, 10).map(v => clip(v, 220)),
    lists: rawLists.slice(0, 28).map(v => ({
      name: clip(v && v.name, 110), count: finiteCount(v && v.count)
    })),
    enrichment_health: {
      amErrors: finiteCount(health.amErrors),
      amPartial: finiteCount(health.amPartial),
      pepErrors: finiteCount(health.pepErrors),
      skipped: finiteCount(health.skipped),
      pepLookupEnabled: health.pepLookupEnabled === true,
      amLocalesPerSubject: finiteCount(health.amLocalesPerSubject)
    },
    alerts,
    evidence_coverage: {
      total_alerts: rawAlerts.length,
      total_hits: allHits,
      total_failures: rawFailures.length,
      total_lists: rawLists.length,
      included_alerts: 0,
      included_hits: 0,
      included_failures: 0,
      included_lists: 0,
      omitted_alerts: 0,
      omitted_hits: 0,
      omitted_failures: 0,
      omitted_lists: 0,
      warning: 'The AI context is a bounded sample, NOT an exhaustive clearance. MLRO must examine the full original screening results.'
    }
  };
  updateCoverage(e);
  return e;
}

function updateCoverage(e) {
  const t = e.evidence_coverage;
  t.included_alerts = e.alerts.length;
  t.included_hits = e.alerts.reduce((sum, a) => sum + a.hits.length, 0);
  t.included_failures = e.coverage_failures.length;
  t.included_lists = e.lists.length;
  t.omitted_alerts = Math.max(0, t.total_alerts - t.included_alerts);
  t.omitted_hits = Math.max(0, t.total_hits - t.included_hits);
  t.omitted_failures = Math.max(0, t.total_failures - t.included_failures);
  t.omitted_lists = Math.max(0, t.total_lists - t.included_lists);
}

export function evidenceJsonWithinBudget(e, maxChars = 14000) {
  const limit = boundedInt(maxChars, 14000, 1000, 38000);
  let json = JSON.stringify(e);
  // Avoid slicing JSON mid-string, which would silently invalidate or distort
  // the evidence. Instead shed low-priority sampled fields with counts retained.
  for (let n = 0; n < 1000 && json.length > limit; n++) {
    let shrunk = false;
    for (let j = e.alerts.length - 1; j >= 0; j--) {
      if (e.alerts[j].hits.length) { e.alerts[j].hits.pop(); shrunk = true; break; }
    }
    if (!shrunk && e.alerts.length) { e.alerts.pop(); shrunk = true; }
    if (!shrunk && e.coverage_failures.length) { e.coverage_failures.pop(); shrunk = true; }
    if (!shrunk && e.lists.length) { e.lists.pop(); shrunk = true; }
    if (!shrunk) break;
    updateCoverage(e);
    json = JSON.stringify(e);
  }
  return json;
}

export function buildEnrichmentPrompt(results, { maxInputChars = process.env.OPENAI_SCREENING_MAX_INPUT_CHARS } = {}) {
  const evidence = screeningEvidence(results);
  const header = [
    'Review the AML/CFT screening evidence below and write a concise analyst-assistance note for an Asana compliance task.',
    '',
    'Hard rules:',
    '1. Preserve the original screening outcome. Do not re-score, clear, confirm, downgrade, or upgrade any match.',
    '2. Use only the supplied evidence. Do not add biographical facts, allegations, dates, list status, or source claims that are not present.',
    '3. Treat adverse media as allegations/signals unless the supplied evidence explicitly states an adjudicated fact.',
    '4. Distinguish sanctions, PEP, and adverse-media evidence when they appear.',
    '5. Highlight identity-disambiguation points visible in the evidence, such as jurisdiction, score, match mechanism, or matched name.',
    '6. If evidence is incomplete, degraded, partial, or errored, state that clearly. Never turn missing coverage into a clearance.',
    '7. Do not recommend freezing, rejecting, filing an STR/SAR, or taking other final compliance action. State that MLRO review remains required for flagged cases.',
    '8. Keep the output under 450 words.',
    '',
    'Use exactly these headings:',
    'AI ENHANCEMENT — ANALYST ASSISTANCE ONLY',
    'Run summary',
    'Sanctions context',
    'PEP context',
    'Adverse media context',
    'Identity / false-positive indicators',
    'Coverage and evidence limitations',
    'MLRO review focus',
    '',
    'If a category has no supplied evidence, write "No additional evidence supplied in this run."',
    '',
    'SCREENING EVIDENCE JSON:'
  ].join('\n');
  const chars = boundedInt(maxInputChars, 16000, 4000, 40000);
  return header + '\n' + evidenceJsonWithinBudget(evidence, Math.max(1000, chars - header.length - 1));
}

export function extractResponseText(payload) {
  const chunks = [];
  for (const item of (payload && Array.isArray(payload.output) ? payload.output : [])) {
    if (!item || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && part.type === 'output_text' && typeof part.text === 'string') chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

export async function enrichScreeningResults(results, {
  apiKey = process.env.OPENAI_API_KEY || '',
  model = process.env.OPENAI_SCREENING_MODEL || DEFAULT_OPENAI_SCREENING_MODEL,
  fetchImpl = globalThis.fetch,
  timeoutMs = Number(process.env.OPENAI_SCREENING_TIMEOUT_MS) || 30000
} = {}) {
  if (!apiKey) return { enabled: false, text: '', reason: 'OPENAI_API_KEY not configured' };
  if (typeof fetchImpl !== 'function') return { enabled: true, text: '', error: 'fetch unavailable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      // codeql[js/file-access-to-http]: reviewed 2026-09-21, intended design, not a leak.
      // screeningEvidence() (above) already curates/clips this data before it gets here
      // (name/jurisdiction/hits length-capped, no secrets or credentials), the destination
      // is the fixed OPENAI_RESPONSES_URL literal (not attacker-controllable), the feature
      // is opt-in (returns enabled:false above if OPENAI_API_KEY is unset), and store:false
      // is set explicitly. See this file's header comment for the documented data flow.
      body: JSON.stringify({
        model,
        store: false,
        input: buildEnrichmentPrompt(results),
        max_output_tokens: 1400
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = payload && payload.error && payload.error.message
        ? payload.error.message : 'HTTP ' + response.status;
      return { enabled: true, text: '', error: clip(msg, 300), model };
    }
    const text = extractResponseText(payload);
    if (!text) return { enabled: true, text: '', error: 'OpenAI response contained no text output', model };
    return { enabled: true, text, model };
  } catch (e) {
    return { enabled: true, text: '', error: clip(e && e.message || e, 300), model };
  } finally {
    clearTimeout(timer);
  }
}
