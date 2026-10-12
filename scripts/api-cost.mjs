/* Exact USD token-cost estimates, with NO hard-coded commercial prices.
 * An operator must supply a verified model price table, tied to a publisher
 * URL and date. Never silently price unknown usage or models as $0.
 *
 * A quoted usage amount is an estimate using configured unit prices, not an
 * invoice. Actual provider invoices may differ (minimums, taxes, discounts).
 */
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/;
const RATE = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/;
const PROPERTIES = Object.freeze({
  openai: ['input', 'cached_input', 'output'],
  anthropic: ['input', 'cached_read', 'cached_write', 'output'],
});
const ALLOWED_HOSTS = Object.freeze({
  openai: ['openai.com'],
  anthropic: ['anthropic.com', 'claude.com'],
});
const MICRO = 1000000n;
const MAX_PRICE_AGE_DAYS = 90; // publisher prices must be reverified at least quarterly

function recentEnough(day, now, days = MAX_PRICE_AGE_DAYS) {
  if (!Number.isSafeInteger(days) || days < 0 || days > 365) return false;
  return validDate(day, now) &&
    now - Date.parse(day + 'T00:00:00Z') <= (days + 1) * 86400000;
}

function permittedPublisher(provider, location) {
  if (typeof location !== 'string') return false;
  try {
    const url = new URL(location);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.searchParams.has('api_key') &&
      ALLOWED_HOSTS[provider].some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

function validDate(day, now) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(day + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === day &&
    d.getTime() <= now;
}

function microPerMillion(value) {
  if (typeof value !== 'string' || !RATE.test(value)) return null;
  const [whole, decimal = ''] = value.split('.');
  const micro = BigInt(whole) * MICRO + BigInt(decimal.padEnd(6, '0') || '0');
  return micro > 0n ? micro : null;
}

export function validateApiPriceTable(table, { nowMs = Date.now(), maxPriceAgeDays = MAX_PRICE_AGE_DAYS } = {}) {
  if (!table || typeof table !== 'object' || Array.isArray(table) ||
      table.schema !== 1 || !Array.isArray(table.models) ||
      table.models.length === 0 || table.models.length > 100 ||
      !Number.isFinite(nowMs)) return { ok: false, reason: 'missing_or_invalid_price_table' };
  const seen = new Set();
  for (const row of table.models) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        !Object.hasOwn(PROPERTIES, row.provider) || typeof row.model !== 'string' ||
        !MODEL.test(row.model) ||
        !permittedPublisher(row.provider, row.source_url) ||
        !recentEnough(row.verified_on, nowMs, maxPriceAgeDays) ||
        !row.usd_per_million || typeof row.usd_per_million !== 'object' ||
        Array.isArray(row.usd_per_million)) {
      return { ok: false, reason: 'invalid_model_price_evidence' };
    }
    const keys = Object.keys(row.usd_per_million).sort();
    if (keys.join('|') !== [...PROPERTIES[row.provider]].sort().join('|') ||
        keys.some(key => microPerMillion(row.usd_per_million[key]) === null)) {
      return { ok: false, reason: 'missing_or_invalid_price_category' };
    }
    const identity = row.provider + ':' + row.model;
    if (seen.has(identity)) return { ok: false, reason: 'duplicate_model_prices' };
    seen.add(identity);
  }
  return { ok: true, reason: '' };
}

export function parseApiPriceTable(json, opts = {}) {
  if (typeof json !== 'string' || json.length > 50000 || json.length === 0) {
    return { ok: false, reason: 'missing_or_invalid_price_table' };
  }
  try {
    const table = JSON.parse(json);
    const state = validateApiPriceTable(table, opts);
    return state.ok ? { ok: true, table } : state;
  } catch {
    return { ok: false, reason: 'missing_or_invalid_price_table' };
  }
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
}

function toUsd(micro) {
  const whole = micro / MICRO;
  const cents = (micro % MICRO).toString().padStart(6, '0');
  return whole.toString() + '.' + cents;
}

export function quoteApiTokenCost(table, { provider, model, usage } = {}, opts = {}) {
  const validated = validateApiPriceTable(table, opts);
  if (!validated.ok) return { status: 'unpriced', reason: validated.reason };
  const row = table.models.find(x => x.provider === provider && x.model === model);
  if (!row) return { status: 'unpriced', reason: 'model_has_no_verified_price' };
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return { status: 'unpriced', reason: 'usage_missing_or_invalid' };
  }
  const input = count(usage.input_tokens);
  const output = count(usage.output_tokens);
  if (input === null || output === null) return { status: 'unpriced', reason: 'usage_missing_or_invalid' };
  let components;
  if (provider === 'openai') {
    const cached = count(usage.cached_input_tokens ?? 0);
    if (cached === null || cached > input) return { status: 'unpriced', reason: 'usage_missing_or_invalid' };
    components = [['input', input - cached], ['cached_input', cached], ['output', output]];
  } else {
    const read = count(usage.cache_read_input_tokens ?? 0);
    const write = count(usage.cache_creation_input_tokens ?? 0);
    if (read === null || write === null) return { status: 'unpriced', reason: 'usage_missing_or_invalid' };
    components = [['input', input], ['cached_read', read], ['cached_write', write], ['output', output]];
  }
  let numerator = 0n;
  for (const [name, tokens] of components) {
    numerator += tokens * microPerMillion(row.usd_per_million[name]);
  }
  // Round the aggregate upward to one micro-USD so a nonzero cost can never
  // be represented as a rounded-down zero reservation.
  const micro = (numerator + MICRO - 1n) / MICRO;
  return {
    status: 'priced', currency: 'USD', micro_usd: micro.toString(),
    usd: toUsd(micro), provider, model,
    source_url: row.source_url, verified_on: row.verified_on,
    token_counts: Object.fromEntries(components.map(([name, tokens]) => [name, Number(tokens)])),
  };
}

/* Normalize RAW provider usage. Do not estimate a bill from safeUsage() or
 * usageCounts() defaults: absent raw counts are UNKNOWN, not zero. */
export function normalizeProviderUsage(provider, response) {
  if (!response || typeof response !== 'object' || Array.isArray(response) ||
      !response.usage || typeof response.usage !== 'object' || Array.isArray(response.usage)) return null;
  const u = response.usage;
  if (count(u.input_tokens) === null || count(u.output_tokens) === null) return null;
  if (provider === 'openai') {
    const cached = u.input_tokens_details?.cached_tokens ?? 0;
    if (count(cached) === null || cached > u.input_tokens) return null;
    return { input_tokens: u.input_tokens, output_tokens: u.output_tokens,
      cached_input_tokens: cached };
  }
  if (provider === 'anthropic') {
    const read = u.cache_read_input_tokens ?? 0;
    const write = u.cache_creation_input_tokens ?? 0;
    if (count(read) === null || count(write) === null) return null;
    return { input_tokens: u.input_tokens, output_tokens: u.output_tokens,
      cache_read_input_tokens: read, cache_creation_input_tokens: write };
  }
  return null;
}

export function quoteProviderResponseCost(table, { provider, model, response } = {}, opts = {}) {
  const usage = normalizeProviderUsage(provider, response);
  if (!usage) return { status: 'unpriced', reason: 'raw_provider_usage_missing_or_invalid' };
  return quoteApiTokenCost(table, { provider, model, usage }, opts);
}
