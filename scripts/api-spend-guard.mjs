/* Fail-closed USD preflight for approved optional provider calls.
 * Ensures a bounded, conservative LOCAL per-call/per-run reservation using
 * dated, publisher-verified pricing; not an invoice, provider-side cap or
 * distributed atomic ledger. True organization-wide hard caps also require
 * provider account spend limits and centrally serialized reservations.
 */
import { quoteApiTokenCost } from './api-cost.mjs';
const USD = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/;
const MICRO = 1000000n;
function micros(value) {
  if (typeof value !== 'string' || !USD.test(value)) return null;
  const [whole, frac = ''] = value.split('.');
  return BigInt(whole) * MICRO + BigInt(frac.padEnd(6, '0') || '0');
}
export function evaluateApiSpend({
  priceTable, provider, model, maxInputTokens, maxOutputTokens,
  maxUsdPerCall, maxUsdPerRun, reservedMicroUsd = '0'
} = {}, { nowMs = Date.now() } = {}) {
  const perCall = micros(maxUsdPerCall), perRun = micros(maxUsdPerRun);
  if (perCall === null || perRun === null || perCall <= 0n || perRun <= 0n ||
      perCall > perRun || typeof reservedMicroUsd !== 'string' ||
      !/^(?:0|[1-9]\d*)$/.test(reservedMicroUsd)) {
    return { allowed: false, reason: 'missing_or_invalid_usd_budget' };
  }
  if (!Number.isSafeInteger(maxInputTokens) || maxInputTokens < 1 ||
      maxInputTokens > 1000000 || !Number.isSafeInteger(maxOutputTokens) ||
      maxOutputTokens < 1 || maxOutputTokens > 1000000) {
    return { allowed: false, reason: 'invalid_token_reservation' };
  }
  if (!priceTable || !Array.isArray(priceTable.models)) {
    return { allowed: false, reason: 'verified_price_evidence_required' };
  }
  const price = priceTable.models.find(x => x && x.provider === provider && x.model === model);
  // A stale commercial price must never be used to certify a live spend cap.
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
  if (quote.status !== 'priced') {
    return { allowed: false, reason: 'cost_quote_unavailable' };
  }
  const reserved = BigInt(reservedMicroUsd), needed = BigInt(quote.micro_usd);
  if (needed > perCall || reserved + needed > perRun) {
    return { allowed: false, reason: 'usd_budget_exceeded' };
  }
  return {
    allowed: true, reason: 'within_local_budget',
    reserved_micro_usd: needed.toString(),
    next_run_reserved_micro_usd: (reserved + needed).toString(),
    estimated_max_usd: quote.usd,
    scope: 'local_preflight_only'
  };
}
export function conservativeInputTokenBound(message) {
  // A deliberately oversized reservation heuristic for text-only prompts.
  // Provider tokenization/overhead varies; this is NOT a billing guarantee.
  return typeof message === 'string'
    ? Math.min(1000000, Buffer.byteLength(message, 'utf8') + 4096)
    : null;
}
