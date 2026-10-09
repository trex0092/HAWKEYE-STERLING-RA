/* Offline contract tests: optional OpenAI screening digest is bounded,
 * source-grounded, never leaks upstream diagnostic bodies, and cannot mutate
 * the screening results. No provider credentials or live customer data. */
import {
  DEFAULT_OPENAI_SCREENING_MODEL, OPENAI_RESPONSES_URL,
  boundedInt, safeOpenAIError, safeUsage,
  screeningEvidence, buildEnrichmentPrompt, evidenceJsonWithinBudget,
  extractResponseText, enrichScreeningResults
} from '../scripts/openai-screening-enrichment.mjs';

let passed = 0, failed = 0;
function check(label, condition) {
  if (condition) { passed++; console.log('  ok  ' + label); }
  else { failed++; console.error('FAIL ' + label); }
}

const fixture = {
  date: '2026-10-09', screened: 120, entities: 80, individuals: 40,
  matchCount: 80, newMatches: 12, degraded: true,
  failures: Array.from({length: 100}, (_,i)=>'Coverage missing ' + i + ' ' + 'X'.repeat(1000)),
  lists: Array.from({length: 100}, (_,i)=>({name:'List'+i+'-'+'L'.repeat(500),count:140})),
  enrichment: {amErrors: 4, pepErrors: 2, skipped: 1, pepLookupEnabled:true,
    secret_unapproved_metadata: 'HEALTH_SECRET_' + 'Q'.repeat(200000) },
  alerts: Array.from({length: 85}, (_,i)=>({
    name:'SYNTHETIC ENTITY '+i+' ' + 'N'.repeat(1000),
    jurisdiction:'Exampleland',band:'high', topScore:90,
    recommendation:'review', hits:Array.from({length:30},(_,j)=>({
      list:'Synthetic sanctions list',
      hitName:'SYNTHETIC HIT '+j+' ' + 'D'.repeat(2000),
      score:97,mechanism:'synthetic',confidence:'candidate'
    }))
  }))
};
const baseline = JSON.stringify(fixture);
const ev = screeningEvidence(fixture);
check('OpenAI input explicitly samples rather than sending every customer match',
  ev.alerts.length === 12 && ev.alerts.every(x=>x.hits.length===4) &&
  ev.coverage_failures.length === 10 && ev.lists.length === 28);
check('sampled evidence describes missing alerts, hits, sources and failure rows',
  ev.evidence_coverage.total_alerts === 85 &&
  ev.evidence_coverage.omitted_alerts === 73 &&
  ev.evidence_coverage.total_hits === 2550 &&
  ev.evidence_coverage.omitted_hits === 2502 &&
  ev.evidence_coverage.omitted_failures === 90 &&
  ev.evidence_coverage.omitted_lists === 72);
check('raw and unexpected health metadata cannot enter OpenAI prompts',
  !JSON.stringify(ev).includes('HEALTH_SECRET_') &&
  ev.enrichment_health.amErrors === 4 &&
  ev.enrichment_health.pepErrors === 2);
check('evidence is length-capped per-field, with no giant descriptions',
  ev.alerts.every(x=>x.name.length <= 160 &&
    x.hits.every(h=>h.matched_name_or_evidence.length <= 180)));
check('model-facing evidence is bounded without slicing JSON mid-string',(()=>{
  const input = buildEnrichmentPrompt(fixture,{maxInputChars:4500});
  const json = input.split('SCREENING EVIDENCE JSON:\n')[1];
  const e = JSON.parse(json);
  return input.length <= 4500 && e.evidence_coverage.omitted_alerts > 0 &&
    e.evidence_coverage.warning.includes('NOT an exhaustive clearance') &&
    !input.includes('HEALTH_SECRET_');
})());
check('min/max input and output bounds are enforced',
  boundedInt('10000000',16000,4000,40000)===40000 &&
  boundedInt('NaN',16000,4000,40000)===16000 &&
  boundedInt('0',1400,256,1800)===256);
check('direct evidence fit remains valid JSON after large reductions',(()=>{
  const data = screeningEvidence(fixture);
  const compact = evidenceJsonWithinBudget(data,1800);
  return compact.length <= 1800 && JSON.parse(compact).evidence_coverage.omitted_alerts > 0;
})());
check('the original screening data is never changed by model sampling',
  JSON.stringify(fixture) === baseline);
check('current default low-cost OpenAI model ID and API endpoint stay unchanged',
  DEFAULT_OPENAI_SCREENING_MODEL === 'gpt-6-luna' &&
  OPENAI_RESPONSES_URL === 'https://api.openai.com/v1/responses');
check('Response API text extraction handles output blocks only',
  extractResponseText({output:[{content:[{type:'output_text',text:'Review.'},{type:'refusal',text:'hidden'}]}]}) === 'Review.');

check('upstream error categories are generic and bounded',
  safeOpenAIError(429).includes('rate limit') &&
  safeOpenAIError(401).includes('access denied') &&
  safeOpenAIError(503).includes('unavailable') &&
  safeOpenAIError(400).includes('request rejected'));
const usage = safeUsage({input_tokens:120,output_tokens:60,total_tokens:180});
check('usage telemetry retains only bounded numeric token counts',
  usage.input_tokens===120 && usage.output_tokens===60 && usage.total_tokens===180 &&
  Object.values(safeUsage({input_tokens:'secret',output_tokens:-2,total_tokens:Infinity})).every(n=>n===0));

let called = 0;
const disabled = await enrichScreeningResults(fixture,{
  enabled:false, apiKey:'SYNTHETIC_PROVIDER_KEY',fetchImpl:async()=>{called++;}
});
check('API key alone never authorizes customer-screening evidence egress',
  disabled.enabled === false && disabled.reason.includes('explicit processor/transfer approval') &&
  called === 0);
const noKey = await enrichScreeningResults(fixture,{enabled:true,apiKey:'',fetchImpl:async()=>{called++;}});
check('missing key means no API call or customer-data egress',
  noKey.enabled === false && called === 0);
let captured;
const ok = await enrichScreeningResults(fixture,{
  enabled:true,apiKey:'SYNTHETIC_PROVIDER_KEY',model:'gpt-6-luna',maxInputChars:5000,
  maxOutputTokens:999999,timeoutMs:99999999,
  fetchImpl:async(url,request)=>{
    captured={url,request};
    return {ok:true,status:200,json:async()=>({
      status:'completed',
      output:[{type:'message',content:[{type:'output_text',text:'MLRO review required.'}]}],
      usage:{input_tokens:220,output_tokens:40,total_tokens:260}
    })};
  }
});
const sent=JSON.parse(captured.request.body);
check('actual request is bounded and never stores the provider response',
  captured.url===OPENAI_RESPONSES_URL && sent.store===false &&
  sent.max_output_tokens===1800 && sent.input.length<=5000 &&
  sent.model==='gpt-6-luna');
check('success returns only model output and numeric usage metadata',
  ok.text==='MLRO review required.' && ok.usage.input_tokens===220 &&
  !JSON.stringify(ok).includes('SYNTHETIC_PROVIDER_KEY'));

let readErrorBody=0;
const bad=await enrichScreeningResults(fixture,{
  enabled:true,apiKey:'SYNTHETIC_PROVIDER_KEY',
  fetchImpl:async()=>({ok:false,status:429,json:async()=>{
    readErrorBody++;
    return {error:{message:'REFLECTED_SECRET_OR_PRIVATE_ACCOUNT_ID'}};
  }})
});
check('429 provider error bodies are never parsed, returned or leaked into logs',
  bad.text==='' && bad.error.includes('429') && readErrorBody===0 &&
  !JSON.stringify(bad).includes('REFLECTED_SECRET_OR_PRIVATE_ACCOUNT_ID'));
const thrown=await enrichScreeningResults(fixture,{
  enabled:true,apiKey:'SYNTHETIC_PROVIDER_KEY',
  fetchImpl:async()=>{throw new Error('REFLECTED_CUSTOMER_ID_AND_KEY');}
});
check('network exception messages are redacted, never echoed',
  thrown.error.includes('transport failed') &&
  !JSON.stringify(thrown).includes('REFLECTED_CUSTOMER_ID_AND_KEY'));
const incomplete=await enrichScreeningResults(fixture,{
  enabled:true,apiKey:'SYNTHETIC_PROVIDER_KEY',
  fetchImpl:async()=>({ok:true,status:200,json:async()=>({
    status:'incomplete',output:[{content:[{type:'output_text',text:'TRUNCATED'}]}]
  })})
});
check('partially generated answers cannot masquerade as complete analysis',
  incomplete.text==='' && incomplete.error.includes('incomplete'));
const statusMissing = await enrichScreeningResults(fixture,{
  enabled:true,apiKey:'SYNTHETIC_PROVIDER_KEY',
  fetchImpl:async()=>({ok:true,status:200,json:async()=>({
    output:[{type:'message',content:[{type:'output_text',text:'Unconfirmed completion'}]}]
  })})
});
check('missing Responses API completion status cannot masquerade as a usable MLRO note',
  statusMissing.text === '' && statusMissing.error.includes('incomplete'));
const invalidModel=await enrichScreeningResults(fixture,{
  enabled:true,apiKey:'SYNTHETIC_PROVIDER_KEY',model:'invalid model with spaces',
  fetchImpl:async()=>{called++;}
});
check('invalid model settings fail closed before an API request',
  invalidModel.text==='' && invalidModel.error.includes('model configuration invalid') &&
  called===0);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
