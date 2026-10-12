/* Fail-closed, per-process USD reservation gates for optional paid APIs.
 *
 * A reserve is made BEFORE each request using a deliberately conservative
 * upper estimate of input and max output tokens. On unknown provider usage,
 * the entire reservation is consumed. No unknown rate is priced as zero.
 * This CANNOT implement a cross-run/account-wide spend cap by itself: that
 * requires an atomic shared ledger and provider-side billing limits.
 */
import { parseApiPriceTable, quoteApiTokenCost } from './api-cost.mjs';

const USD = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/;
const MICRO = 1000000n;

export function parseUsdMicro(value) {
  if (typeof value !== 'string' || !USD.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * MICRO + BigInt(fraction.padEnd(6, '0') || '0');
}

function usd(micro) {
  return (micro / MICRO).toString() + '.' + (micro % MICRO).toString().padStart(6, '0');
}

export function makeApiUsdBudget({
  provider, model, priceTableJson, limitUsd, nowMs = Date.now()
} = {}) {
  const price = parseApiPriceTable(priceTableJson, { nowMs });
  const limit = parseUsdMicro(limitUsd);
  const ready = price.ok && limit !== null;
  let committed = 0n, pending = 0n, nextId = 1;
  const reservations = new Map();

  const fail = reason => ({ ok: false, reason });
  function preflight({ inputBytes, maxOutputTokens } = {}) {
    if (!ready) return fail('USD budget or verified model prices unavailable');
    if (!Number.isSafeInteger(inputBytes) || inputBytes < 0 || inputBytes > 2_000_000 ||
        !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 0 ||
        maxOutputTokens > 100000) return fail('API token bounds missing or invalid');

    // Tokenizer model overhead is not a contractual constant. Reserve an
    // additional 1,024 input tokens on top of UTF-8 byte size; no multimedia
    // inputs are supported here. Budget enforcement is per-run estimation.
    const upperInput = inputBytes + 1024;
    const inputs = provider === 'openai' ? [
      { input_tokens: upperInput, cached_input_tokens: 0, output_tokens: maxOutputTokens },
      { input_tokens: upperInput, cached_input_tokens: upperInput, output_tokens: maxOutputTokens },
    ] : [
      { input_tokens: upperInput, output_tokens: maxOutputTokens },
      { input_tokens: 0, cache_read_input_tokens: upperInput, output_tokens: maxOutputTokens },
      { input_tokens: 0, cache_creation_input_tokens: upperInput, output_tokens: maxOutputTokens },
    ];
    const quotes = inputs.map(usage =>
      quoteApiTokenCost(price.table, { provider, model, usage }, { nowMs }));
    if (quotes.some(quote => quote.status !== 'priced')) {
      return fail('model has no verified USD price');
    }
    const worst = quotes.reduce((best, quote) =>
      BigInt(quote.micro_usd) > best ? BigInt(quote.micro_usd) : best, 0n);
    if (committed + pending + worst > limit) {
      return fail('USD request or run budget exhausted');
    }
    const id = nextId++;
    reservations.set(id, worst);
    pending += worst;
    return { ok: true, id, reserved_usd: usd(worst),
      remaining_usd: usd(limit - committed - pending) };
  }

  function settle(id, usage) {
    if (!reservations.has(id)) return fail('unknown or already settled reservation');
    const hold = reservations.get(id);
    reservations.delete(id);
    pending -= hold;
    const quote = quoteApiTokenCost(price.table, { provider, model, usage }, { nowMs });
    // Missing/incomplete usage cannot be treated as free. Preserve hold.
    const actual = quote.status === 'priced' ? BigInt(quote.micro_usd) : hold;
    committed += actual;
    return {
      ok: true, usage_status: quote.status === 'priced' ? 'priced' : 'unknown_reserved',
      estimated_usd: usd(actual),
      over_reservation: actual > hold,
      budget_exceeded: committed + pending > limit,
    };
  }

  function snapshot() {
    return { ready, currency: 'USD',
      reason: ready ? '' : 'USD budget or verified model prices unavailable',
      limit_usd: ready ? usd(limit) : null,
      estimated_committed_usd: ready ? usd(committed) : null,
      reserved_pending_usd: ready ? usd(pending) : null,
      available_usd: ready ? usd(committed + pending >= limit ? 0n : limit - committed - pending) : null,
      outstanding: reservations.size };
  }

  return { ready, preflight, settle, snapshot };
}
