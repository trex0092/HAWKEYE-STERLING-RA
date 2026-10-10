/* Offline Netlify preflight tests: no credentials, network or real site data.
 * Workflow may fail early ONLY when provider metadata proves a blocker.
 * Unknown/unavailable data remains a warning, never "deploy succeeded". */
import {
  assessNetlifySite, assessRecentDeploys, auditNetlifyProduction, runNetlifyPreflight,
} from '../scripts/netlify-deploy-preflight.mjs';

let passed=0,failed=0;
function check(name,okay){if(okay){passed++;console.log('  ok  '+name);}else{failed++;console.error('FAIL '+name);}}

const SHA='a'.repeat(40);
const REPO='trex0092/HAWKEYE-STERLING-RA';
const healthySite={
  build_settings:{stop_builds:false,repo_branch:'main',repo_path:REPO},
  published_deploy:{locked:false},
};
const recent=[{commit_ref:SHA,context:'production',branch:'main',state:'building'}];

function fakeApi({site=healthySite,deploys=recent,failCode=0}={}) {
  const seen=[];
  const fetchImpl=async(url,req)=>{
    seen.push({url,method:req.method,authorization:req.headers.Authorization});
    if(failCode)return {ok:false,status:failCode};
    return {ok:true,status:200,json:async()=>url.includes('/deploys?')?deploys:site};
  };
  return {seen,fetchImpl};
}

check('explicit stopped builds block GitHub deployment, not falsely green',
  assessNetlifySite({...healthySite,build_settings:{...healthySite.build_settings,stop_builds:true}},REPO)
    .code==='builds_stopped');
check('deploy lock remains a blocker even when builds are active',
  assessNetlifySite({...healthySite,published_deploy:{locked:true}},REPO)
    .code==='production_deploy_locked');
check('wrong linked project blocks the deployment',
  assessNetlifySite({...healthySite,build_settings:{...healthySite.build_settings,
    repo_path:'another-company/another-repo'}},REPO).code==='wrong_linked_repository');
check('wrong production branch blocks deployment',
  assessNetlifySite({...healthySite,build_settings:{...healthySite.build_settings,
    repo_branch:'development'}},REPO).code==='wrong_production_branch');
check('documented HTTPS Git URL normalizes without false repository errors',
  assessNetlifySite({...healthySite,build_settings:{...healthySite.build_settings,
    repo_path:'https://github.com/trex0092/HAWKEYE-STERLING-RA.git'}},REPO)
    .status==='no_confirmed_blocker');
check('unknown or missing site data is inconclusive, never ready',
  assessNetlifySite(null,REPO).status==='unknown' &&
  assessNetlifySite({},REPO).status==='unknown');
check('provider-reported ready is only a candidate, not proof of served bytes',
  assessRecentDeploys([{commit_ref:SHA,context:'production',branch:'main',
    state:'ready',published_at:'2026-10-10T00:00:00Z'}],SHA).status==='candidate');
check('failed matching production deploy blocks further wasteful polling',
  assessRecentDeploys([{commit_ref:SHA,context:'production',state:'error'}],SHA)
    .code==='matching_deploy_failed');
check('pending-review production deploy needs an operator',
  assessRecentDeploys([{commit_ref:SHA,context:'production',state:'pending_review'}],SHA)
    .code==='build_requires_manual_review');
check('matching preview deploy cannot pass for production',
  assessRecentDeploys([{commit_ref:SHA,context:'deploy-preview',branch:'feature',
    state:'ready',published_at:'2026-10-10T00:00:00Z'}],SHA).status==='unknown');
check('missing expected commit in last five is not proof of successful build',
  assessRecentDeploys([{commit_ref:'b'.repeat(40),context:'production',state:'ready'}],SHA)
    .status==='unknown');

const unset=fakeApi();
const noCred=await auditNetlifyProduction({fetchImpl:unset.fetchImpl});
check('no optional secrets means no Netlify API call or changed deploy decision',
  noCred.enabled===false && noCred.status==='unknown' && unset.seen.length===0);
const malformed=fakeApi();
const invalid=await auditNetlifyProduction({token:'SECRET',siteId:'../../admin',
  expectedRepo:REPO,expectedSha:SHA,fetchImpl:malformed.fetchImpl});
check('reject invalid site IDs before building API URLs',
  invalid.code==='invalid_site_id' && malformed.seen.length===0);

const stop=fakeApi({site:{...healthySite,build_settings:{...healthySite.build_settings,
  stop_builds:true}}});
const stopped=await auditNetlifyProduction({token:'SECRET',siteId:'abc-123',
  expectedRepo:REPO,expectedSha:SHA,fetchImpl:stop.fetchImpl});
check('known stopped builds fail early after one read-only site request',
  stopped.status==='blocked' && stopped.code==='builds_stopped' &&
  stop.seen.length===1 && stop.seen[0].method==='GET');

const fine=fakeApi();
const report=await auditNetlifyProduction({token:'SECRET',siteId:'abc-123',
  expectedRepo:REPO,expectedSha:SHA,fetchImpl:fine.fetchImpl});
check('healthy configuration requires bounded read-only site+deploys reads',
  fine.seen.length===2 && fine.seen.every(x=>x.method==='GET') &&
  fine.seen.every(x=>x.url.startsWith('https://api.netlify.com/api/v1/sites/abc-123')) &&
  report.code==='deployment_in_progress_or_not_published' && report.status==='unknown');

let warned=[];
const failedProvider=fakeApi({failCode:401});
const code=await runNetlifyPreflight({env:{NETLIFY_AUTH_TOKEN:'SYNTHETIC-SUPER-SECRET',
  NETLIFY_SITE_ID:'abc-123',GITHUB_REPOSITORY:REPO,GITHUB_SHA:SHA},
fetchImpl:failedProvider.fetchImpl,log:x=>warned.push(x),warn:x=>warned.push(x)});
check('unavailable Netlify API never gives false confidence or leaks credentials',
  code===0 && warned.join(' ').includes('preflight') &&
  !warned.join(' ').includes('SYNTHETIC-SUPER-SECRET') &&
  !warned.join(' ').includes('Bearer ') &&
  failedProvider.seen.length===2);
const blockedMessages=[];
const blockedExit=await runNetlifyPreflight({env:{NETLIFY_AUTH_TOKEN:'SYNTHETIC-SECRET',
  NETLIFY_SITE_ID:'abc-123',GITHUB_REPOSITORY:REPO,GITHUB_SHA:SHA},
fetchImpl:stop.fetchImpl,log:x=>blockedMessages.push(x),warn:x=>blockedMessages.push(x)});
check('known blocker stops redundant 18-minute publish poll and stays red',
  blockedExit===2 && blockedMessages.join('').includes('::error::') &&
  blockedMessages.join('').includes('stopped') &&
  !blockedMessages.join('').includes('SYNTHETIC-SECRET'));

const failed=fakeApi({deploys:[{commit_ref:SHA,context:'production',
  state:'error',error_message:'CUSTOMER_PRIVATE_TOKEN=never-echo'}]});
const failedMessages=[];
const failedExit=await runNetlifyPreflight({env:{NETLIFY_AUTH_TOKEN:'SYNTHETIC-SECRET',
  NETLIFY_SITE_ID:'abc-123',GITHUB_REPOSITORY:REPO,GITHUB_SHA:SHA},
fetchImpl:failed.fetchImpl,log:x=>failedMessages.push(x),warn:x=>failedMessages.push(x)});
check('Netlify provider deploy errors remain diagnostic codes without raw body',
  failedExit===2 && failedMessages.join('').includes('matching production deploy') &&
  !failedMessages.join('').includes('CUSTOMER_PRIVATE_TOKEN'));

console.log('\n'+passed+' passed, '+failed+' failed');
process.exit(failed?1:0);
