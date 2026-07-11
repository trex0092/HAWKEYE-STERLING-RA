/* Generates a CycloneDX 1.5 SBOM for Hawkeye Sterling RA.

   The app ships ZERO runtime npm dependencies, so the meaningful supply chain is:
     1. the application component (versioned by APP_VERSION),
     2. the self-hosted web fonts bundled under assets/fonts/ (OFL-1.1), and
     3. the dev/CI toolchain: package.json devDependencies (the lockfile-pinned
        source of truth) plus any remaining exact `npx --yes pkg@ver` pins in
        the workflows (pa11y — deliberately kept out of package.json).

   Usage:
     node scripts/gen-sbom.mjs            # writes sbom.cdx.json
     node scripts/gen-sbom.mjs --stdout   # prints to stdout
   Importable: `import { buildSbom } from './gen-sbom.mjs'` for tests. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function appVersion() {
  const m = readFileSync(join(ROOT, 'app.js'), 'utf8').match(/APP_VERSION\s*=\s*'([0-9.]+)'/);
  return m ? m[1] : '0.0.0';
}

function fontFamilies() {
  const css = readFileSync(join(ROOT, 'fonts.css'), 'utf8');
  const set = new Set();
  for (const m of css.matchAll(/font-family:\s*'([^']+)'/g)) set.add(m[1]);
  return [...set].sort();
}

/* Pinned dev tools: package.json devDependencies first (the committed,
   lockfile-pinned toolchain), then any exact `npx --yes pkg@ver` /
   `npx pkg@ver` / `npm install pkg@ver` pins still living in the workflows
   (pa11y — see a11y.yml for why it stays out of package.json). */
function devTools() {
  const tools = new Map(); /* name -> version */
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  for (const [name, ver] of Object.entries(pkg.devDependencies || {})) {
    tools.set(name, String(ver).replace(/^[~^=v]+/, ''));
  }
  const dir = join(ROOT, '.github', 'workflows');
  const rx = /(?:npx(?:\s+--yes)?|npm\s+install)\s+((?:@[\w.-]+\/)?[\w.-]+)@([\w.\-]+)/g;
  for (const f of readdirSync(dir).filter(n => n.endsWith('.yml') || n.endsWith('.yaml'))) {
    const txt = readFileSync(join(dir, f), 'utf8');
    let m;
    while ((m = rx.exec(txt)) !== null) {
      const name = m[1], ver = m[2];
      if (name === 'install') continue; /* guard against odd matches */
      if (!tools.has(name)) tools.set(name, ver);
    }
  }
  return [...tools.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function purlNpm(name, version) {
  /* pkg:npm/@scope/name@ver — encode the @ in the scope per the purl spec. */
  const enc = name.startsWith('@') ? '%40' + name.slice(1) : name;
  return `pkg:npm/${enc}@${version}`;
}

export function buildSbom(opts = {}) {
  const version = appVersion();
  const timestamp = opts.timestamp || new Date().toISOString();

  const fontComponents = fontFamilies().map(name => ({
    'bom-ref': 'font:' + name.toLowerCase().replace(/\s+/g, '-'),
    type: 'library',
    name,
    description: 'Self-hosted web font (assets/fonts/, latin + latin-ext subsets)',
    scope: 'required',
    licenses: [{ license: { id: 'OFL-1.1' } }],
  }));

  const toolComponents = devTools().map(([name, ver]) => ({
    'bom-ref': purlNpm(name, ver),
    type: 'library',
    name,
    version: ver,
    scope: 'optional', /* dev/CI only — not shipped to the browser */
    purl: purlNpm(name, ver),
    description: 'Dev/CI toolchain (run via npx; not a runtime dependency)',
  }));

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp,
      tools: [{ vendor: 'Hawkeye Sterling RA', name: 'gen-sbom.mjs', version }],
      component: {
        'bom-ref': 'app:hawkeye-sterling-ra',
        type: 'application',
        name: 'hawkeye-sterling-ra',
        version,
        description: 'AML/CFT entity risk assessment (DPMS) — static app, no runtime npm dependencies.',
      },
    },
    components: [...fontComponents, ...toolComponents],
  };
}

/* CLI */
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const sbom = buildSbom();
  const json = JSON.stringify(sbom, null, 2) + '\n';
  if (process.argv.includes('--stdout')) {
    process.stdout.write(json);
  } else {
    writeFileSync(join(ROOT, 'sbom.cdx.json'), json);
    console.log(`sbom.cdx.json written: ${sbom.components.length} components (app ${sbom.metadata.component.version}).`);
  }
}
