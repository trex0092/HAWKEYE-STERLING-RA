/* Mathematical fixtures only. These are NOT published commercial rates. */
import { normalizeProviderUsage, quoteApiTokenCost, quoteProviderResponseCost }
  from '../../scripts/api-cost.mjs';

export async function run(check) {
  const prices = { schema: 1, models: [
    { provider: 'openai', model: 'fixture-alias', verified_on: '2026-10-12',
      source_url: 'https://openai.com/api/pricing/',
      usd_per_million: { input: '2', cached_input: '1', output: '8' } },
    { provider: 'openai', model: 'fixture-snapshot', verified_on: '2026-10-12',
      source_url: 'https://openai.com/api/pricing/',
      usd_per_million: { input: '4', cached_input: '2', output: '16' } },
    { provider: 'anthropic', model: 'fixture-anthropic', verified_on: '2026-10-12',
      source_url: 'https://claude.com/pricing',
      usd_per_million: { input: '1', cached_read: '0.1', cached_write: '2', output: '5' } },
  ] };
  const opts = { nowMs: Date.parse('2026-10-12T12:00:00Z') };
  const counts = { input_tokens: 1000, output_tokens: 100 };
  check('token costs: omitted optional counters retain the documented zero default',
    normalizeProviderUsage('openai', { usage: counts }).cached_input_tokens === 0 &&
    normalizeProviderUsage('anthropic', { usage: counts }).cache_read_input_tokens === 0);
  check('token costs: explicit invalid cached counters cannot be priced as zero',
    [null, undefined, -1, '12', false].every(bad =>
      quoteApiTokenCost(prices, { provider: 'openai', model: 'fixture-alias',
        usage: { ...counts, cached_input_tokens: bad } }, opts).status === 'unpriced' &&
      normalizeProviderUsage('anthropic', { usage: { ...counts, cache_creation_input_tokens: bad } }) === null));
  check('token costs: malformed OpenAI details cannot silently mean an empty cache',
    [null, 'bad', [], 3, false].every(details => normalizeProviderUsage('openai',
      { usage: { ...counts, input_tokens_details: details } }) === null));
  check('token costs: valid cache counts remain exact and do not double-charge',
    quoteProviderResponseCost(prices, { provider: 'openai', model: 'fixture-alias',
      response: { usage: { ...counts, input_tokens_details: { cached_tokens: 200 } } } }, opts).usd === '0.002600');
  check('token costs: a returned model snapshot uses its own verified rate',
    quoteProviderResponseCost(prices, { provider: 'openai', model: 'fixture-alias',
      response: { model: 'fixture-snapshot', usage: counts } }, opts).usd === '0.005600');
  check('token costs: unpriced or malformed returned models do not inherit the requested rate',
    ['unknown-snapshot', null, 'bad model'].every(model =>
      quoteProviderResponseCost(prices, { provider: 'openai', model: 'fixture-alias',
        response: { model, usage: counts } }, opts).status === 'unpriced'));
  check('token costs: a response without token counts remains unknown',
    quoteProviderResponseCost(prices, { provider: 'openai', model: 'fixture-alias',
      response: {} }, opts).status === 'unpriced');
}
