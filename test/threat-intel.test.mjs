/* Unit tests for threat-intel pure logic (offline; no network/filesystem).
   Usage: node test/threat-intel.test.mjs */
import { parseStixBundle, stixNames, screenStix } from '../scripts/threat-intel.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name); }
}

console.log('\n— threat-intel unit tests —\n');

const bundle = {
  type: 'bundle', id: 'bundle--1',
  objects: [
    { type: 'threat-actor', id: 'threat-actor--1', name: 'Lazarus Group', aliases: ['HIDDEN COBRA', 'APT38'] },
    { type: 'intrusion-set', id: 'intrusion-set--2', name: 'Sandworm Team', x_mitre_aliases: ['Voodoo Bear', 'IRIDIUM'] },
    { type: 'identity', id: 'identity--3', name: 'Acme Front Company LLC' },
    { type: 'malware', id: 'malware--4', name: 'WannaCry', aliases: ['WanaCrypt0r'] },
    { type: 'relationship', id: 'relationship--5', name: 'should be ignored' }, // non-named SDO type
    { type: 'marking-definition', id: 'md--6' },                                 // no name
  ],
};

/* ── parsing ── */
const parsed = parseStixBundle(bundle);
check('extracts only named SDO types (5 named, relationship/marking dropped)', parsed.length === 4);
check('captures STIX aliases', parsed.find(e => e.id === 'threat-actor--1').aliases.join(',') === 'HIDDEN COBRA,APT38');
check('captures ATT&CK x_mitre_aliases', parsed.find(e => e.id === 'intrusion-set--2').aliases.includes('Voodoo Bear'));
check('drops an alias equal to the primary name', !parsed.some(e => e.aliases.includes(e.name)));
check('stixNames flattens names + aliases', stixNames(bundle).includes('HIDDEN COBRA') && stixNames(bundle).includes('WannaCry'));
check('tolerates a bare objects array', parseStixBundle(bundle.objects).length === 4);

/* ── screening ── */
let r = screenStix('Lazarus Group', bundle);
check('exact primary-name match is a high-band hit', r.hit === true && r.score === 100 && r.band === 'high');
check('hit reports the matched SDO id + type', r.match.id === 'threat-actor--1' && r.match.type === 'threat-actor');

r = screenStix('Hidden Cobra', bundle);
check('matches on an alias', r.hit === true && r.match.name === 'Lazarus Group' && r.match.matchedOn === 'HIDDEN COBRA');

r = screenStix('Acme Front Company', bundle);
check('matches a partial identity name via token-set similarity', r.hit === true && r.match.type === 'identity');

r = screenStix('Helga Andersen Bakery', bundle);
check('clears an unrelated subject', r.hit === false && r.count === 0 && r.band === 'low');

r = screenStix('', bundle);
check('empty subject never hits', r.hit === false);

check('tolerates an empty/odd bundle', screenStix('x', {}).hit === false && screenStix('x', null).hit === false);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
