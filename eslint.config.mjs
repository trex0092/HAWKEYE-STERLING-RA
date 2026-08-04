/* Minimal, self-contained flat ESLint config (no plugin downloads needed).
   Scopes: the browser app files (app.js / console.js / advisor.js), ES-module
   watchers/generators under scripts and ES-module tests, and CommonJS test
   files + Netlify functions.

   Rules catch real breakage (undeclared names, unused symbols, empty blocks,
   duplicate keys, unsafe negation) plus the highest-value injection sinks
   (eval and friends). Deep security taint analysis is provided by CodeQL
   (.github/workflows/codeql.yml); we deliberately avoid eslint-plugin-security
   so the project keeps ZERO runtime dependencies — the dev/CI toolchain is
   lockfile-pinned in package.json (exact versions, installed with npm ci),
   which keeps the supply-chain attack surface minimal (consistent with the
   SHA-pinned, dependency-light posture of the rest of the repo). */

const browserGlobals = {
  window: 'readonly', document: 'readonly', console: 'readonly', fetch: 'readonly',
  localStorage: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', URL: 'readonly',
  AbortController: 'readonly', crypto: 'readonly', globalThis: 'readonly', indexedDB: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
  performance: 'readonly', Blob: 'readonly', alert: 'readonly', confirm: 'readonly',
  TextEncoder: 'readonly', TextDecoder: 'readonly', btoa: 'readonly', atob: 'readonly',
};

/* Wider Web-platform surface used by the full browser app (app.js etc.). */
const browserAppGlobals = {
  ...browserGlobals,
  sessionStorage: 'readonly', URLSearchParams: 'readonly', navigator: 'readonly',
  location: 'readonly', history: 'readonly', screen: 'readonly',
  getComputedStyle: 'readonly', matchMedia: 'readonly', structuredClone: 'readonly',
  FileReader: 'readonly', File: 'readonly', FormData: 'readonly', Image: 'readonly',
  DOMParser: 'readonly', XMLHttpRequest: 'readonly', CustomEvent: 'readonly',
  Event: 'readonly', MutationObserver: 'readonly', IntersectionObserver: 'readonly',
  CSS: 'readonly', SVGElement: 'readonly', HTMLElement: 'readonly', Node: 'readonly',
  prompt: 'readonly',
  /* Cross-file globals provided by sibling same-origin scripts. */
  getLang: 'readonly', hsToggleLang: 'readonly',       /* i18n.js */
  SUPER_TOOLS: 'readonly', REG_GROUPS: 'readonly',     /* assets/super-data.js (advisor) */
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
  /* Re-enabled (was 'off'): flags dead locals/imports. Unused function args and
     catch bindings are allowed (intentional in this codebase); prefix an
     intentionally-unused variable with _ to silence. */
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  /* Re-enabled (was 'off'): catches empty if/for/while/function blocks.
     Empty catch blocks are an intentional swallow pattern and are allowed. */
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-dupe-keys': 'error',
  'no-unsafe-negation': 'error',
  'no-unreachable': 'error',
  /* Security: forbid the dynamic code-execution sinks. */
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
};

export default [
  {
    /* The browser application logic (classic scripts, not modules). The test
       harness in test/app.test.js eval's these same files, and the screen
       harness eval's console.js/advisor.js. */
    files: ['app.js', 'console.js', 'advisor.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: browserAppGlobals },
    rules: baseRules,
  },
  {
    /* Sibling same-origin browser scripts that ship with the three screens but
       were NOT covered by any block until 2026-07-29 — they were absent from
       `npm run lint` AND from this config, so adding them to the script alone
       would have applied zero rules and read as "linted" while catching
       nothing (verified: an undefined-variable reference in sw.js raised no
       error). sw.js is the service worker, so it gets the worker globals
       rather than the window ones. */
    files: ['i18n.js', 'sw-register.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: browserAppGlobals },
    rules: baseRules,
  },
  {
    /* The advisor's data payload (window.SUPER_TOOLS / window.REG_GROUPS) —
       served same-origin under the CSP like every other script, yet excluded
       from lint AND semgrep targets until 2026-08-04. Data-only by intent,
       which is exactly why it must stay under the no-string-to-code rules:
       an expression smuggled into a "data" file would otherwise be the one
       unlinted, un-SAST'd execution path on the page. */
    files: ['assets/super-data.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: browserAppGlobals },
    rules: baseRules,
  },
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...browserGlobals,
        self: 'readonly', caches: 'readonly', clients: 'readonly',
        skipWaiting: 'readonly', registration: 'readonly', location: 'readonly',
        navigator: 'readonly', Request: 'readonly', Response: 'readonly',
        Headers: 'readonly', addEventListener: 'readonly',
      },
    },
    rules: baseRules,
  },
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
  {
    /* Test harnesses load the app/screen scripts by eval'ing the source files
       (the same scripts the browser loads) against a DOM stub — that is the
       harness design, so no-eval is intentionally relaxed for tests only. */
    files: ['test/**/*.{js,mjs}'],
    rules: { 'no-eval': 'off', 'no-implied-eval': 'off' },
  },
];
