/* Tool & connector register test — the capability half of AI inventory.

   data/tool-surfaces.json claims what may be invoked, by whom, with which
   secret. agents.py is where that is actually enforced at runtime. A register
   that drifts from the enforcement point is worse than no register, so this
   suite ties them together in BOTH directions:

     1. agent roster and authorization sets match agents.py exactly;
     2. every action's credential matches ACTION_CREDENTIAL in agents.py;
     3. the runtime invariants (only DeliveryAgent may write to Asana; nobody
        may file) are still present in agents.py, not just asserted here;
     4. no model call declares tools while model_tool_calling.enabled is false —
        the claim that no model can reach a connector is enforced, not stated;
     5. every declared credential is a real repository secret or environment
        variable, and every declared egress host really appears in a caller.

   Usage: node test/tool-register.test.mjs */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('FAIL  ' + name); } };
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

console.log('\n— Tool & connector register test —\n');

let reg;
try { reg = JSON.parse(read('data/tool-surfaces.json')); }
catch (e) { console.log('FAIL  data/tool-surfaces.json parses (' + e.message + ')'); process.exit(1); }

/* ── Schema ─────────────────────────────────────────────────────────────── */
check('register has an actions table', Array.isArray(reg.actions) && reg.actions.length > 0);
check('register has an agent roster', Array.isArray(reg.agents) && reg.agents.length > 0);
check('register has connectors', Array.isArray(reg.connectors) && reg.connectors.length > 0);
check('register declares an owner role', !!reg.owner_role);
check('register declares a review cadence', !!reg.review_cadence);
check('register states its MCP posture', !!reg.mcp_posture && typeof reg.mcp_posture.statement === 'string');
check('register states an onboarding rule for new tools/connectors', !!(reg.mcp_posture || {}).onboarding_rule);
check('register has a shadow-connector note', !!reg.shadow_connector_note);
check('register last_reviewed is a parseable date', Number.isFinite(Date.parse(reg.last_reviewed || '')));
check('register lists runtime invariants', Array.isArray(reg.invariants) && reg.invariants.length > 0);

/* ── 1-2. Cross-check against agents.py, the enforcement point ──────────── */
const agentsSrc = read('agents.py');

const rosterBlock = (agentsSrc.match(/AGENTS = \[([\s\S]*?)\n\]/) || [])[1] || '';
const codeAgents = [...rosterBlock.matchAll(/"name":\s*"([^"]+)",\s*"role":\s*"([^"]*)",\s*"authz":\s*\[([^\]]*)\]/g)]
  .map((m) => ({ name: m[1], role: m[2], authz: m[3].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean) }));
check('parsed the agent roster from agents.py (found ' + codeAgents.length + ')', codeAgents.length > 0);

const credBlock = (agentsSrc.match(/ACTION_CREDENTIAL = \{([\s\S]*?)\n\}/) || [])[1] || '';
const codeCreds = Object.fromEntries([...credBlock.matchAll(/"([\w.]+)":\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));
check('parsed ACTION_CREDENTIAL from agents.py (found ' + Object.keys(codeCreds).length + ')', Object.keys(codeCreds).length > 0);

const regAgents = new Map(reg.agents.map((a) => [a.name, a]));
check('register lists exactly the agents agents.py defines (' + codeAgents.length + ')', regAgents.size === codeAgents.length);
for (const a of codeAgents) {
  const r = regAgents.get(a.name);
  check('agent "' + a.name + '" is registered', !!r);
  if (!r) continue;
  check('agent "' + a.name + '" role matches agents.py', r.role === a.role);
  check('agent "' + a.name + '" authorization set matches agents.py [' + a.authz.join(', ') + ']',
    eq([...(r.authz || [])].sort(), [...a.authz].sort()));
}
for (const name of regAgents.keys()) {
  check('registered agent "' + name + '" exists in agents.py', codeAgents.some((a) => a.name === name));
}

const actions = new Map(reg.actions.map((a) => [a.id, a]));
check('action ids are unique', actions.size === reg.actions.length);

// Every action an agent is authorized for must be a registered action…
const codeActionIds = new Set(codeAgents.flatMap((a) => a.authz));
for (const id of codeActionIds) check('action "' + id + '" used in agents.py is registered', actions.has(id));
// …and every registered action must be reachable, or explicitly held by nobody.
for (const a of reg.actions) {
  const holders = codeAgents.filter((x) => x.authz.includes(a.id)).map((x) => x.name).sort();
  check('action "' + a.id + '" held_by matches agents.py [' + holders.join(', ') + ']',
    eq([...(a.held_by || [])].sort(), holders));
  if ((a.held_by || []).length === 0) {
    check('unheld action "' + a.id + '" explains why it is declared but ungranted',
      typeof a.purpose === 'string' && /no agent|NO agent|ungranted|held by/i.test(a.purpose));
  }
}
// Credentials must agree with the broker's map, in both directions.
for (const [id, secret] of Object.entries(codeCreds)) {
  check('action "' + id + '" credential matches ACTION_CREDENTIAL (' + secret + ')',
    !!actions.get(id) && actions.get(id).credential === secret);
}
for (const a of reg.actions) {
  if (!a.credential) continue;
  check('registered credential for "' + a.id + '" is in ACTION_CREDENTIAL', codeCreds[a.id] === a.credential);
}

/* ── 3. Runtime invariants still enforced in code ───────────────────────── */
check('agents.py still restricts asana.write to DeliveryAgent',
  /"asana\.write" in a\["authz"\][\s\S]{0,120}must not hold asana\.write/.test(agentsSrc));
check('agents.py still restricts state.commit',
  /"state\.commit" in a\["authz"\][\s\S]{0,160}must not hold state\.commit/.test(agentsSrc));
check('agents.py still logs denials rather than dropping them (audited authorization)',
  /"authorized": allowed/.test(agentsSrc) && /class CredentialBroker/.test(agentsSrc));
check('register invariants name the asana.write holder', reg.invariants.some((s) => /asana\.write/.test(s) && /DeliveryAgent/.test(s)));
check('register invariants record that no agent may file', reg.invariants.some((s) => /file/i.test(s)));

/* ── 4. No tool-calling while the register says there is none ───────────── */
const SCAN_DIRS = ['', 'scripts', 'netlify/functions'];
const callers = [];
for (const d of SCAN_DIRS) {
  for (const f of readdirSync(d ? join(ROOT, d) : ROOT)) {
    if (!/\.(js|mjs|py)$/.test(f)) continue;
    const rel = d ? d + '/' + f : f;
    if (!existsSync(join(ROOT, rel))) continue;
    const src = read(rel);
    if (src.includes('api.anthropic.com')) callers.push({ rel, src });
  }
}
check('found the model-API callers to scan', callers.length >= 3);
if (reg.model_tool_calling && reg.model_tool_calling.enabled === false) {
  for (const c of callers) {
    check('model-API caller "' + c.rel + '" declares no tools/tool_choice (register says tool-calling is off)',
      !/["']tools["']\s*:/.test(c.src) && !/tool_choice/.test(c.src));
  }
}

/* ── 5. Credentials and hosts are real ──────────────────────────────────── */
const envExample = read('.env.example');
const workflows = readdirSync(join(ROOT, '.github/workflows'))
  .filter((f) => f.endsWith('.yml')).map((f) => read('.github/workflows/' + f)).join('\n');
const declaredCreds = new Set([
  ...reg.actions.map((a) => a.credential).filter(Boolean),
  ...reg.connectors.flatMap((c) => c.credentials || [])
]);
for (const c of declaredCreds) {
  check('credential "' + c + '" is a real secret or environment variable',
    envExample.includes(c) || workflows.includes(c));
}
for (const c of reg.connectors) {
  check('connector "' + c.id + '" declares hosts', Array.isArray(c.hosts) && c.hosts.length > 0);
  check('connector "' + c.id + '" declares at least one kill switch',
    Array.isArray(c.kill_switches) && c.kill_switches.length > 0);
  check('connector "' + c.id + '" states what data leaves', typeof c.data_out === 'string' && c.data_out.length > 0);
  for (const f of c.callers || []) check('connector "' + c.id + '" caller exists (' + f + ')', existsSync(join(ROOT, f)));
  for (const h of c.hosts || []) {
    check('connector "' + c.id + '" host "' + h + '" appears in a declared caller',
      (c.callers || []).some((f) => existsSync(join(ROOT, f)) && read(f).includes(h)));
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exitCode = 1;
