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

function clip(value, max = 6000) {
  const s = String(value == null ? '' : value);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function screeningEvidence(results) {
  const r = results || {};
  const alerts = (Array.isArray(r.alerts) ? r.alerts : []).slice(0, 40).map(a => ({
    name: clip(a.name, 240),
    jurisdiction: clip(a.jurisdiction, 120),
    band: clip(a.band, 40),
    score: a.topScore,
    recommendation: clip(a.recommendation, 120),
    hits: (Array.isArray(a.hits) ? a.hits : []).slice(0, 20).map(h => ({
      list: clip(h && h.list, 180),
      matched_name_or_evidence: clip(h && h.hitName, 600),
      score: h && h.score,
      mechanism: clip(h && h.mechanism, 120),
      confidence: clip(h && h.confidence, 120)
    }))
  }));
  return {
    date: r.date || '',
    screened: r.screened,
    entities: r.entities,
    individuals: r.individuals,
    standing_matches: r.matchCount,
    new_or_changed_matches: r.newMatches,
    degraded: Boolean(r.degraded),
    coverage_failures: (Array.isArray(r.failures) ? r.failures : []).slice(0, 30).map(x => clip(x, 500)),
    lists: (Array.isArray(r.lists) ? r.lists : []).slice(0, 80).map(L => ({ name: clip(L && L.name, 180), count: L && L.count })),
    enrichment_health: r.enrichment || {},
    alerts
  };
}

export function buildEnrichmentPrompt(results) {
  const evidence = screeningEvidence(results);
  return [
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
    'SCREENING EVIDENCE JSON:',
    JSON.stringify(evidence)
  ].join('\n');
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
