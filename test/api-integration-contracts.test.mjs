/* Fast, offline contract gate for optional API integration modules.
 * Tests interface compatibility BEFORE long CI suites (no dependencies or
 * credentials; no HTTP requests). It does not import reg-draft.mjs because that
 * executable exits in its no-key path; instead it validates its static imports
 * against actual, loaded named exports from side-effect-free utility modules.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const CONSUMERS = [
  'openai-screening-enrichment.mjs',
  'reg-draft.mjs',
  'screening-cases.mjs',
];
const API_MODULES = new Set([
  'api-cost.mjs', 'api-cost-budget.mjs', 'api-cost-dashboard.mjs',
  'api-spend-guard.mjs', 'api-quota-alerts.mjs',
]);
const sourceFor = name => readFileSync(new URL('../scripts/' + name, import.meta.url), 'utf8');

let checks = 0;
for (const name of CONSUMERS) {
  const source = sourceFor(name);
  const declarations = [...source.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"]\.\/(api-[^'"]+\.mjs)['"]/g)];
  assert.ok(declarations.length > 0, name + ': no recognized named API imports');
  for (const [, bindings, moduleName] of declarations) {
    assert.ok(API_MODULES.has(moduleName),
      name + ': unreviewed API integration dependency ' + moduleName);
    const namespace = await import(new URL('../scripts/' + moduleName, import.meta.url));
    const imports = bindings.split(',').map(s => s.trim()).filter(Boolean);
    assert.ok(imports.length > 0, 'empty API import declaration');
    for (const binding of imports) {
      const exported = binding.split(/\s+as\s+/)[0].trim();
      assert.ok(Object.hasOwn(namespace, exported),
        name + ' imports removed or renamed export ' + exported + ' from ' + moduleName);
      checks++;
    }
  }
}
// This is intentionally an import smoke check, not a code execution. The
// screening case module must import cleanly without credentials or network.
const screening = await import('../scripts/screening-cases.mjs');
assert.equal(typeof screening.planCaseActions, 'function');
checks++;

const regWorkflow = readFileSync(new URL('../.github/workflows/regulatory-watch.yml',
  import.meta.url), 'utf8');
const regulatory = sourceFor('reg-draft.mjs');
assert.ok(regWorkflow.includes('API_USD_RATES_JSON:') &&
  regWorkflow.includes('REG_DRAFT_MAX_USD_PER_RUN:') &&
  regulatory.includes('process.env.API_USD_RATES_JSON') &&
  regulatory.includes('process.env.REG_DRAFT_MAX_USD_PER_RUN'),
'Regulatory Watch must preserve the configured verified pricing and budget contract');
checks++;

const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
assert.ok(ci.includes('node test/api-integration-contracts.test.mjs'),
  'mandatory provider integration contracts must run in pull request CI');
checks++;

console.log('api-integration-contracts: ' + checks +
  ' offline module compatibility checks passed before full CI');
