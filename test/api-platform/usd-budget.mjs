import { evaluateApiSpend, conservativeInputTokenBound } from '../../scripts/api-spend-guard.mjs';

export async function run(check) {
  const priceTable = { schema: 1, models: [{ provider: 'openai', model: 'fixture-model',
    verified_on: '2026-10-12', source_url: 'https://openai.com/api/pricing/',
    usd_per_million: { input: '2', cached_input: '1', output: '8' } }] };
  const request = { priceTable, provider: 'openai', model: 'fixture-model',
    maxInputTokens: 1000, maxOutputTokens: 100, maxUsdPerCall: '0.002800', maxUsdPerRun: '0.005600' };
  const opts = { nowMs: Date.parse('2026-10-12T12:00:00Z') };
  const first = evaluateApiSpend(request, opts);
  const second = evaluateApiSpend({ ...request, reservedMicroUsd: first.next_run_reserved_micro_usd }, opts);
  const third = evaluateApiSpend({ ...request, reservedMicroUsd: second.next_run_reserved_micro_usd }, opts);
  check('USD gate: exact local reservation reaches but never exceeds its run cap',
    first.allowed && first.remaining_run_micro_usd === '2800' && second.allowed &&
    second.remaining_run_micro_usd === '0' && !third.allowed && third.reason === 'usd_budget_exceeded');
  check('USD gate: invalid request/options fail closed rather than throwing',
    [null, [], 'bad', false].every(x => !evaluateApiSpend(x, opts).allowed && !evaluateApiSpend(request, x).allowed));
  check('USD gate: malformed or oversized decimal reservations are rejected before BigInt conversion',
    ['-1', '1e9', '00', '9'.repeat(10000), null].every(reservedMicroUsd =>
      !evaluateApiSpend({ ...request, reservedMicroUsd }, opts).allowed));
  check('USD gate: oversized text is refused instead of being under-reserved by clipping',
    conservativeInputTokenBound('x'.repeat(1000000)) === null &&
    conservativeInputTokenBound('\u00e9'.repeat(600000)) === null &&
    conservativeInputTokenBound('x'.repeat(1000000 - 4096)) === 1000000);
  check('USD gate: UTF-8 text reserves bytes plus overhead, with no empty-input calls',
    conservativeInputTokenBound('A') === 4097 && conservativeInputTokenBound('\u00e9') === 4098 &&
    conservativeInputTokenBound('') === null && conservativeInputTokenBound(null) === null);
  check('USD gate: missing pricing, invalid clocks and expired rates cannot authorize a request',
    !evaluateApiSpend({ ...request, priceTable: null }, opts).allowed &&
    !evaluateApiSpend(request, { nowMs: NaN }).allowed &&
    !evaluateApiSpend(request, { nowMs: Date.parse('2026-12-12T12:00:00Z') }).allowed);
  check('USD gate: explicitly zero caps and one-micro-USD shortfalls stop paid calls',
    !evaluateApiSpend({ ...request, maxUsdPerCall: '0' }, opts).allowed &&
    !evaluateApiSpend({ ...request, maxUsdPerCall: '0.002799' }, opts).allowed);
}
