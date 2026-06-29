/* Validates the CycloneDX SBOM generator (scripts/gen-sbom.mjs): correct shape,
   version pinned to APP_VERSION, the self-hosted fonts (OFL-1.1) are listed, and
   the dev toolchain is captured from the workflow pins.
   Usage: node test/sbom.test.mjs */
import { buildSbom } from '../scripts/gen-sbom.mjs';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n); } };

const appVer = (readFileSync(new URL('../app.js', import.meta.url), 'utf8').match(/APP_VERSION\s*=\s*'([0-9.]+)'/) || [])[1];
const sbom = buildSbom({ timestamp: '2026-01-01T00:00:00.000Z' });

check('bomFormat is CycloneDX', sbom.bomFormat === 'CycloneDX');
check('specVersion is 1.5', sbom.specVersion === '1.5');
check('metadata.component is the application', sbom.metadata.component.type === 'application');
check('component version matches APP_VERSION', sbom.metadata.component.version === appVer);
check('timestamp is honoured (deterministic for tests)', sbom.metadata.timestamp === '2026-01-01T00:00:00.000Z');
check('has a components array', Array.isArray(sbom.components) && sbom.components.length > 0);

const names = sbom.components.map(c => c.name);
for (const font of ['Space Grotesk', 'JetBrains Mono', 'Manrope']) {
  const c = sbom.components.find(x => x.name === font);
  check(`font listed: ${font}`, !!c);
  check(`${font} declares OFL-1.1`, c && c.licenses && c.licenses[0].license.id === 'OFL-1.1');
}

check('dev toolchain captured (eslint)', names.includes('eslint'));
check('dev toolchain captured (@playwright/test) with version', sbom.components.some(c => c.name === '@playwright/test' && /^\d+\.\d+\.\d+/.test(c.version || '')));
check('dev tools are scope=optional (not shipped)', sbom.components.filter(c => c.purl).every(c => c.scope === 'optional'));
check('every component has a bom-ref', sbom.components.every(c => c['bom-ref']));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
