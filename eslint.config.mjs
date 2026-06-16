/* Minimal, self-contained flat ESLint config (no plugin downloads needed).
   Scopes: ES-module watchers/generators under scripts and ES-module tests;
   CommonJS test files and Netlify functions. Rules are deliberately lean:
   catch real breakage (undeclared names, unsafe negation, duplicate keys),
   not style. */
const browserGlobals = {
  window: 'readonly', document: 'readonly', console: 'readonly', fetch: 'readonly',
  localStorage: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', URL: 'readonly',
  AbortController: 'readonly', crypto: 'readonly', globalThis: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  performance: 'readonly', Blob: 'readonly', alert: 'readonly', confirm: 'readonly',
  TextEncoder: 'readonly', TextDecoder: 'readonly', btoa: 'readonly', atob: 'readonly',
};
const nodeGlobals = {
  process: 'readonly', Buffer: 'readonly', console: 'readonly', fetch: 'readonly',
  URL: 'readonly', AbortController: 'readonly', setTimeout: 'readonly',
  clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  globalThis: 'readonly', global: 'readonly', crypto: 'readonly', structuredClone: 'readonly',
};
const commonjsGlobals = { ...nodeGlobals, require: 'readonly', module: 'writable', exports: 'writable', __dirname: 'readonly', __filename: 'readonly' };

const baseRules = {
  'no-undef': 'error',
  'no-unused-vars': 'off',
  'no-empty': 'off',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-dupe-keys': 'error',
  'no-unsafe-negation': 'error',
  'no-unreachable': 'error',
};

export default [
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...nodeGlobals, ...browserGlobals } },
    rules: baseRules,
  },
  {
    files: ['test/**/*.js', 'netlify/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...commonjsGlobals, ...browserGlobals } },
    rules: baseRules,
  },
];
