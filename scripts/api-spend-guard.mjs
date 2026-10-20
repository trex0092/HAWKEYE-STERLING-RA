/* Fail-closed USD preflight for approved optional provider calls.
 * Local per-call/per-run reservations are estimates, not provider invoices
 * or a distributed account cap. A global limit requires an atomic shared
 * reservation service and verified provider billing controls.
 */
import { quoteApiTokenCost } from './api-cost.mjs';
const USD = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/;
const MICRO = 1000000n;
const MAX_TOKENS = 1000000;
const INPUT_OVERHEAD = 4096;
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
function micros(value) {
  if (typeof value !== 'string' || !USD.test(value)) return null;
  const [whole, frac = ''] = value.split('.');
  return BigInt(whole) * MICRO + BigInt(frac.padEnd(6, '0') || '0');
}
export function evaluateApiSpend(request = {}, options = {}) {
  if (!object(request) || !object(options)) {
    return { allowed: false, reason: 'missing_or_invalid_usd_budget' };
  }
  const { priceTable, provider, model, maxInputTokens, maxOutputTokens,
    maxUsdPerCall, maxUsdPerRun, reservedMicroUsd = '0' } = request;
  const nowMs = Object.hasOwn(options, 'nowMs') ? options.nowMs : Date.now();
  const perCall = micros(maxUsdPerCall), perRun = micros(maxUsdPerRun);
  if (perCall === null || perRun === null || perCall <= 0n || perRun <= 0n ||
      perCall > perRun || typeof reservedMicroUsd !== 'string' ||
      !/^(?:0|[1-9]\d{0,15})$/.test(reservedMicroUsd)) {
    return { allowed: false, reason: 'missing_or_invalid_usd_budget' };
  }
  if (!Number.isSafeInteger(maxInputTokens) || maxInputTokens < 1 ||
      maxInputTokens > MAX_TOKENS || !Number.isSafeInteger(maxOutputTokens) ||
      maxOutputTokens < 1 || maxOutputTokens > MAX_TOKENS) {
    return { allowed: false, reason: 'invalid_token_reservation' };
  }
  if (!object(priceTable) || !Array.isArray(priceTable.models) ||
      priceTable.models.length > 100) {
    return { allowed: false, reason: 'verified_price_evidence_required' };
  }
  const price = priceTable.models.find(x => x && x.provider === provider && x.model === model);
  if (!Number.isFinite(nowMs) || !price || !Number.isFinite(Date.parse(price.verified_on)) ||
      nowMs - Date.parse(price.verified_on + 'T00:00:00Z') > 31 * 86400000) {
    return { allowed: false, reason: 'verified_price_evidence_expired' };
  }
  const quote = quoteApiTokenCost(priceTable, { provider, model,
    usage: provider === 'openai'
      ? { input_tokens: maxInputTokens, cached_input_tokens: 0, output_tokens: maxOutputTokens }
      : { input_tokens: maxInputTokens, cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0, output_tokens: maxOutputTokens }
  }, { nowMs });
  if (quote.status !== 'priced') return { allowed: false, reason: 'cost_quote_unavailable' };
  const reserved = BigInt(reservedMicroUsd), needed = BigInt(quote.micro_usd);
  if (needed > perCall || reserved + needed > perRun) {
    return { allowed: false, reason: 'usd_budget_exceeded' };
  }
  return {
    allowed: true, reason: 'within_local_budget',
    reserved_micro_usd: needed.toString(),
    next_run_reserved_micro_usd: (reserved + needed).toString(),
    remaining_run_micro_usd: (perRun - reserved - needed).toString(),
    estimated_max_usd: quote.usd, scope: 'local_preflight_only'
  };
}
export function conservativeInputTokenBound(message) {
  // Never cap an oversized input DOWN to the maximum. That would authorize
  // a request whose real input exceeded the quoted reservation. Reject it.
  // UTF-8 bytes plus overhead is conservative, not a contractual tokenizer.
  if (typeof message !== 'string' || !message.length || message.length > MAX_TOKENS - INPUT_OVERHEAD) return null;
  const bound = Buffer.byteLength(message, 'utf8') + INPUT_OVERHEAD;
  return bound <= MAX_TOKENS ? bound : null;
}
