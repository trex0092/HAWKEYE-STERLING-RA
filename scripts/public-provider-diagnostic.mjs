#!/usr/bin/env node
// Read-only public-provider connectivity diagnostics. NEVER screening assurance.
import { writeFileSync, mkdirSync } from 'node:fs';
const targets = [
  {id:'google-news-en-us', url:'https://news.google.com/rss/search?q=international%20sanctions&hl=en-US&gl=US&ceid=US:en', kind:'rss'},
  {id:'gdelt-doc-original', url:'https://api.gdeltproject.org/api/v2/doc/doc?query=international%20sanctions&mode=artlist&format=json&maxrecords=10', kind:'json'},
  {id:'wikidata-entity', url:'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q48352&props=labels&languages=en&format=json', kind:'json'}
];
const result = {schemaVersion:1, diagnosticOnly:true, assurance:false, startedAt:new Date().toISOString(), gitSha:process.env.GITHUB_SHA||null, checks:[]};
for (const item of targets) {
  const start = Date.now();
  const entry = {id:item.id, url:item.url, checkedAt:new Date().toISOString(), httpStatus:null, responseKindVerified:false, ok:false, elapsedMs:null, errorCode:null};
  try {
    const response = await fetch(item.url,{headers:{'User-Agent':'HawkeyeSterling-PublicSourceDiagnostic/1.0 (https://github.com/trex0092/HAWKEYE-STERLING-RA)','Accept':item.kind==='rss'?'application/rss+xml,application/xml':'application/json'},redirect:'error',signal:globalThis.AbortSignal.timeout(20000)});
    entry.httpStatus=response.status;
    const body=await response.text();
    if(body.length>250000) throw new Error('response_too_large');
    if(item.kind==='rss') entry.responseKindVerified=/<rss>/i.test(body)&&/<channel>/i.test(body);
    else { const data=JSON.parse(body); entry.responseKindVerified=!!data&&typeof data==='object'&&!data.error&&!data.errors; }
    entry.ok=response.ok&&entry.responseKindVerified;
  } catch(error) {
    const name=String(error?.name||'error');
    entry.errorCode=/^(AbortError|TimeoutError|SyntaxError|TypeError)$/.test(name)?name:'provider_response_unusable';
  }
  entry.elapsedMs=Date.now()-start;
  result.checks.push(entry);
}
result.finishedAt=new Date().toISOString();
mkdirSync('evidence/public-provider-diagnostics',{recursive:true});
writeFileSync('evidence/public-provider-diagnostics/latest.json',JSON.stringify(result,null,2)+'\n');
// Explicitly fail incomplete diagnostics, never claim population screening coverage.
console.log(JSON.stringify({diagnosticOnly:true,assurance:false,checks:result.checks.map(({id,httpStatus,ok,errorCode})=>({id,httpStatus,ok,errorCode}))}));
if(result.checks.some(x=>!x.ok)) process.exitCode=1;
