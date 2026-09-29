import {
  provenanceCompleteness,
  queryByExample,
  canonicalFingerprint,
  aliasCluster,
  evidenceWeightedConfidence,
  domainFusion,
  casePriority,
  analystChecklist,
  articleEvidenceQuality,
  sourceDiagnostics,
  typedEntity,
  relationshipGraph,
  localWatchlistAdapter,
  buildDecisionSupport,
} from '../scripts/screening-intelligence.mjs';

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL  ' + name); }
}

const subject = {
  name: 'Ahmad Example',
  aliases: ['Ahmed Example'],
  entityType: 'individual',
  nationality: 'Jordan',
  jurisdiction: 'Jordan',
  dob: '1980-04-09',
  passport: 'N12345',
};

const sanctionHit = {
  list: 'US OFAC SDN',
  hitName: 'AHMAD EXAMPLE',
  score: 96,
  identity: { points: 75, level: 'strong' },
  provenance: { sourceId: 'ofac-sdn', sourceUrl: 'https://example.test/ofac' },
  evidenceUrl: 'https://example.test/ofac/entity/1',
};

const mediaHit = {
  list: 'Adverse media (Google News)',
  hitName: 'Ahmad Example investigated for fraud',
  score: 82,
  identity: { points: 45, level: 'moderate' },
  sourceTier: 1,
  provenance: { sourceId: 'adverse-media', sourceUrl: 'https://news.example.test/a' },
  evidenceUrl: 'https://news.example.test/a',
};

const pepHit = {
  list: 'PEP (Wikidata)',
  hitName: 'Ahmad Example — Minister, Jordan',
  score: 88,
  identity: { points: 55, level: 'moderate' },
  provenance: { sourceId: 'wikidata-pep-worldwide', sourceUrl: 'https://www.wikidata.org/wiki/Q1' },
  evidenceUrl: 'https://www.wikidata.org/wiki/Q1',
};

check('OpenSanctions pattern: provenance completeness is explicit and measurable',
  provenanceCompleteness(sanctionHit).complete === true && provenanceCompleteness(sanctionHit).score === 100);

const qbe = queryByExample(subject);
check('yente pattern: query-by-example profile carries structured identity fields',
  qbe.schema === 'Person' && qbe.properties.name === 'Ahmad Example'
  && qbe.properties.birthDate === '1980-04-09' && qbe.properties.passportNumber === 'N12345');

const fp1 = canonicalFingerprint(subject);
const fp2 = canonicalFingerprint({ ...subject, aliases: ['Ahmed Example'] });
check('Nomenklatura pattern: canonical identity fingerprint is deterministic',
  fp1 === fp2 && /^[a-f0-9]{24}$/.test(fp1));
check('Nomenklatura pattern: aliases cluster without duplicates',
  aliasCluster(subject, [sanctionHit]).includes('ahmad example')
  && aliasCluster(subject, [sanctionHit]).includes('ahmed example'));

const confidence = evidenceWeightedConfidence(subject, [sanctionHit]);
check('Splink pattern: field evidence contributes to explainable confidence',
  confidence.score >= 60 && confidence.contributions.some(x => x.signal === 'identity corroboration'));

const fusion = domainFusion([sanctionHit, mediaHit, pepHit]);
check('FinCrimeRadar pattern: sanctions/PEP/adverse-media fuse into a cross-domain summary',
  fusion.crossDomain === true && fusion.domainCount === 3
  && fusion.domains.sanctions === 1 && fusion.domains.pep === 1 && fusion.domains.adverseMedia === 1);

const priority = casePriority(subject, [sanctionHit, mediaHit]);
check('Marble pattern: case priority and SLA are deterministic',
  priority.priority === 'critical' && priority.slaHours === 4);

const checklist = analystChecklist(subject, [sanctionHit]);
check('kyc-analyst pattern: analyst checklist exposes unavailable evidence instead of inventing it',
  checklist.checks.some(x => x.id === 'identity-dob' && x.available)
  && checklist.checks.some(x => x.id === 'disposition' && !x.available)
  && checklist.missingEvidence.includes('disposition'));

const article = articleEvidenceQuality(mediaHit);
check('adverse-media-screening pattern: article evidence receives a transparent quality band',
  article && article.score >= 50 && ['usable','strong'].includes(article.band));

const diagnostics = sourceDiagnostics([sanctionHit, { list:'L', hitName:'X', score:80 }]);
check('sieve-aml pattern: ingest/source diagnostics surface incomplete provenance',
  diagnostics.totalHits === 2 && diagnostics.incompleteProvenance === 1 && diagnostics.evidenceUrlCoverage === 50);

const entity = typedEntity(subject);
check('FollowTheMoney pattern: subject projects into a typed entity schema',
  entity.schema === 'Person' && entity.id === fp1 && entity.properties.passportNumber === 'N12345');

const graph = relationshipGraph(subject, [sanctionHit, pepHit]);
check('Aleph pattern: relationship graph links subject to hits and supporting sources',
  graph.nodes.length >= 5
  && graph.edges.some(x => x.type === 'SCREENING_MATCH')
  && graph.edges.some(x => x.type === 'SUPPORTED_BY'));

const local = localWatchlistAdapter([
  'Bad Actor LLC',
  { id:'x2', name:'Declined Counterparty', aliases:['DC Trading'], reason:'prior fraud' },
]);
check('Vannor pattern: local watchlists normalize to the same internal entity shape',
  local.length === 2 && local[1].aliases[0] === 'DC Trading' && local[1].source === 'local-watchlist');

const ds = buildDecisionSupport(subject, [sanctionHit, mediaHit, pepHit]);
check('integrated decision support includes all live modules without suppressing hits',
  ds.fingerprint === fp1
  && ds.casePriority.priority === 'critical'
  && ds.domainFusion.domainCount === 3
  && ds.entity.schema === 'Person'
  && ds.graph.edges.length > 0
  && ds.sourceDiagnostics.totalHits === 3);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
