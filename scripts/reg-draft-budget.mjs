/* Bounded, no-network controls for optional Regulatory Watch AI drafting.
 * No keys, prompts, URLs or provider response text are logged or persisted.
 * A budget stop ALWAYS leaves a manual-review entry rather than dropping
 * monitored sources from the analysis. */
export function boundedInt(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function draftBudget(env = {}) {
  return {
    maxCalls: boundedInt(env.REG_DRAFT_MAX_API_CALLS, 8, 1, 30),
    maxTokens: boundedInt(env.REG_DRAFT_MAX_OUTPUT_TOKENS, 1000, 256, 1000),
    timeoutMs: boundedInt(env.REG_DRAFT_API_TIMEOUT_MS, 20000, 2000, 60000),
    pageChars: boundedInt(env.REG_DRAFT_MAX_PAGE_CHARS, 4500, 500, 6000),
    listEntries: boundedInt(env.REG_DRAFT_MAX_DELTA_ENTRIES, 12, 1, 25),
    entryChars: boundedInt(env.REG_DRAFT_MAX_ENTRY_CHARS, 250, 80, 500),
  };
}

export function validatedReportDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value : null;
}

export function boundedLines(items, prefix, limit, maxChars) {
  const source = Array.isArray(items) ? items : [];
  const lines = source.slice(0, limit).map((item) =>
    prefix + String(item == null ? '' : item).replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, maxChars)
  );
  if (source.length > limit) {
    lines.push('OMITTED: ' + (source.length - limit) +
      ' additional evidence item(s) were excluded by token budget; human review is required.');
  }
  return lines;
}

export function boundedItems(items, prefix, limit, maxChars) {
  const source = Array.isArray(items) ? items : [];
  const lines = source.slice(0, limit).map((item) => {
    const title = String(item && item.t || '').replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, maxChars);
    const url = String(item && item.h || '').replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, maxChars);
    return prefix + '"' + title + '" <' + url + '>';
  });
  if (source.length > limit) {
    lines.push('OMITTED: ' + (source.length - limit) +
      ' additional publication item(s); inspect the complete source list manually.');
  }
  return lines;
}

/* The watcher input is a generated report, not authority to fetch arbitrary
 * endpoints. Fetch only the exact HTTPS URL already in the reviewed source
 * registry, preventing request redirection through a tampered report. */
function registryLabel(value, cap) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, cap);
}

/* Both the ID and EXACT HTTPS URL must match the reviewed source catalogue.
 * In addition to approval, return only metadata from that catalogue, NOT a
 * change report's potentially unbounded/forged name or jurisdiction. */
export function approvedWatchSourceDetails(change, registry) {
  if (!change || !Array.isArray(registry) || typeof change.id !== 'string' ||
      typeof change.url !== 'string' || !change.url.startsWith('https://')) return null;
  const source = registry.find((entry) =>
    entry && entry.id === change.id && entry.url === change.url &&
    typeof entry.name === 'string' && entry.name.trim());
  if (!source) return null;
  return {
    id: source.id,
    url: source.url,
    name: registryLabel(source.name, 120),
    jurisdiction: registryLabel(source.jurisdiction, 64),
  };
}

export function approvedWatchSource(change, registry) {
  return approvedWatchSourceDetails(change, registry) !== null;
}

/* A provider rejection and a locally exhausted request budget are different
 * causes. Retain the true stop reason for every subsequent manual-review item
 * instead of telling operators that a 429/credential error was a budget cap. */
export function deferredDraftCause(haltReason, attemptedCalls, maxCalls) {
  if (haltReason) return haltReason;
  return Number.isSafeInteger(attemptedCalls) && Number.isSafeInteger(maxCalls) &&
    attemptedCalls >= maxCalls ? 'API request budget exhausted' : null;
}

export function manualDraftSection(source, cause) {
  // Never render an unapproved URL/name as an actionable primary-source link
  // in the review proposal; locate the rejected entry in the change report.
  if (cause === 'source not approved') {
    return '### Unapproved watch source\n_AI analysis skipped (source not approved). ' +
      'MLRO must verify the original change-report entry against the reviewed source registry._';
  }
  const label = String(source && source.name || 'Unlabelled source')
    .replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 120);
  const url = String(source && source.url || '').replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 500);
  const allowed = new Set([
    'input source unavailable', 'empty source text', 'source not approved', 'API request budget exhausted',
    'provider error', 'provider rate limit', 'provider billing or authentication failure',
    'provider timeout or network failure', 'provider empty or truncated response',
  ]);
  const reason = allowed.has(cause) ? cause : 'provider error';
  return '### ' + label + '\n_AI analysis skipped (' + reason + '). MLRO must inspect the primary source manually: ' + url + '_';
}

export function providerStopReason(status, message = '') {
  const s = Number(status);
  const text = String(message || '');
  if ([401, 402, 403].includes(s) || /credit balance|usage limit|billing|spend cap|quota exceeded/i.test(text)) {
    return 'provider billing or authentication failure';
  }
  if (s === 429) return 'provider rate limit';
  return 'provider error';
}

export function usageCounts(usage) {
  const safe = (v) => Number.isSafeInteger(v) && v >= 0 ? v : 0;
  return {
    input: safe(usage && usage.input_tokens),
    output: safe(usage && usage.output_tokens),
    cacheRead: safe(usage && usage.cache_read_input_tokens),
    cacheWrite: safe(usage && usage.cache_creation_input_tokens),
  };
}
