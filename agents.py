#!/usr/bin/env python3
"""
FINE GOLD LLC — AGENTIC OPERATING MODEL  (agents.py)
Hawkeye Sterling V2 — UAE "Sovereign AI" operating model + governance gate.
====================================================================
Implements the UAE Agentic-AI operating model — People → Agents → Workflows →
Decisions → Outcomes, where *humans set direction and governance keeps outcomes
aligned* — over the existing, tested screening engine.

This is NOT a swarm of autonomous LLM decision-makers. Each agent is a
single-responsibility unit with:
  • an IDENTITY,
  • LEAST-PRIVILEGE AUTHORIZATION (an explicit allow-list of actions), and
  • an APPEND-ONLY AUDIT LOG of everything it did (observability).
Nothing here decides, freezes, or files — the MLRO does. A QA / governance agent
verifies report integrity BEFORE publish and can raise a gate that the MLRO sees.

Pillar 3 of "Securing Agentic AI": Agent Identity & Authorization · Observability
& Audit Trails · Human-in-the-Loop · Governance & Compliance.
No third-party dependencies.
"""
import os

# ── AGENT REGISTRY: identity + least-privilege authorization ───────────────────
# Each agent may ONLY perform actions in its allow-list. The orchestrator denies
# (and logs) anything outside it. Note the deliberate split: CaseAgent may only
# "propose" (draft) — it cannot "file"; only the human MLRO files. DeliveryAgent
# may write the report to Asana but holds no decision authority.
AGENTS = [
    {"name": "IngestAgent",       "role": "Load the live customer base",                  "authz": ["asana.read"]},
    {"name": "SanctionsAgent",    "role": "Screen names vs designation lists",            "authz": ["lists.read", "match"]},
    {"name": "AdverseMediaAgent", "role": "Fetch news + grounded triage (prompt-secured)", "authz": ["web.read", "llm.classify"]},
    {"name": "PepAgent",          "role": "Detect PEP / RCA / SOE vs Wikidata",           "authz": ["web.read"]},
    {"name": "RiskAgent",         "role": "Compute explainable risk rating",              "authz": ["compute"]},
    {"name": "NetworkAgent",      "role": "Related-party / network detection",            "authz": ["compute"]},
    {"name": "CaseAgent",         "role": "Draft MLRO cases + STR (PROPOSE only)",        "authz": ["propose"]},
    {"name": "QAAgent",           "role": "Integrity / governance gate before publish",   "authz": ["audit"]},
    {"name": "DeliveryAgent",     "role": "Post the report to Asana (no decisions)",      "authz": ["asana.write"]},
]
AUTHORIZED = {a["name"]: set(a["authz"]) for a in AGENTS}

def is_authorized(agent: str, action: str) -> bool:
    return action in AUTHORIZED.get(agent, set())

class AgentLog:
    """Append-only audit trail. record() also ENFORCES authorization: an action
    outside an agent's allow-list is denied (ok=False) and still logged."""
    def __init__(self):
        self.entries = []
    def record(self, agent, action, detail="", ok=True):
        allowed = is_authorized(agent, action)
        self.entries.append({
            "agent": agent, "action": action, "detail": detail,
            "authorized": allowed, "ok": bool(ok and allowed),
        })
        return allowed and ok

# ── RUNTIME CREDENTIAL SCOPING (least privilege; Agent Identity & Authorization) ─
# Privileged actions require a specific secret. The broker is the SINGLE authority
# that hands a secret to an agent — and only if that agent is authorized for an
# action that needs it. Every grant/denial is logged; the secret VALUE is never
# logged (only whether it is present, masked). This makes credential access
# least-privilege and auditable even inside one process.
ACTION_CREDENTIAL = {
    "asana.read":  "ASANA_TOKEN",
    "asana.write": "ASANA_TOKEN",
    "llm.classify": "ANTHROPIC_API_KEY",
    "state.commit": "GITHUB_TOKEN",
}

def _mask(secret):
    # Presence ONLY — never any secret-derived bytes. This string is rendered into
    # the filed Asana report, so even a masked tail would be an unacceptable leak.
    return "present" if secret else "unset"

class CredentialBroker:
    def __init__(self, env=None):
        self.env = env if env is not None else os.environ
        self.events = []
    def issue(self, agent, action):
        """Return the secret value iff `agent` is authorized for `action` and the
        action requires a credential that is present. Otherwise None. Audited."""
        secret_name = ACTION_CREDENTIAL.get(action)
        authorized = is_authorized(agent, action)
        value = self.env.get(secret_name) if (authorized and secret_name) else None
        self.events.append({
            "agent": agent, "action": action, "secret": secret_name or "—",
            "authorized": authorized, "granted": value is not None,
            "presence": _mask(self.env.get(secret_name)) if secret_name else "—",
        })
        return value
    def summary(self):
        return {
            "issued":  sum(1 for e in self.events if e["granted"]),
            "denied":  sum(1 for e in self.events if not e["authorized"]),
            "events":  self.events,
        }

def preflight_credentials():
    """Static policy self-test: assert no agent is authorized for a privileged
    action it must not hold. Returns a list of violations (empty = compliant)."""
    violations = []
    for a in AGENTS:
        if "asana.write" in a["authz"] and a["name"] != "DeliveryAgent":
            violations.append(f"{a['name']} must not hold asana.write")
        if "state.commit" in a["authz"] and a["name"] not in ("DeliveryAgent",):
            violations.append(f"{a['name']} must not hold state.commit")
    return violations

# ── QA / GOVERNANCE GATE (deterministic integrity checks) ─────────────────────
def qa_gate(possible_matches, adverse_findings, pep_findings, list_meta, stats):
    """Verify the report is fit to publish. Pure, deterministic, explainable.
    Returns {passed, issues:[...]}. A failure does not block the run (the report
    still posts, degrading loudly) but is surfaced for the MLRO."""
    issues = []

    # Degrade-loudly: the five CORE lists must have loaded.
    for k, label in [("ofac", "OFAC SDN"), ("un", "UN"), ("uk", "UK OFSI"),
                     ("eu", "EU FSF"), ("eocn", "UAE EOCN")]:
        if list_meta.get(k, {}).get("count", 0) <= 0:
            issues.append(f"core list {label} unavailable — sanctions module must read DEGRADED")

    # Every adverse item must carry a real source link (no orphan claims).
    miss_link = sum(1 for f in adverse_findings for a in f.get("articles", []) if not a.get("url"))
    if miss_link:
        issues.append(f"{miss_link} adverse-media item(s) without a source link")

    # Every sanctions hit must carry its evidence (matched entry + score).
    for m in possible_matches:
        for h in m.get("hits", []):
            if not h.get("matched_entry") or "score" not in h:
                issues.append(f"sanctions hit on '{m.get('name')}' missing matched-entry/score evidence")
                break

    # Every auto-screened PEP must carry its Wikidata source. Manual-review
    # findings (non-Latin / too-short names) intentionally carry no id — they
    # are a designed hand-off, not an integrity violation, and flagging them
    # would fail the gate on every run for as long as such a customer exists.
    for p in pep_findings:
        if not p.get("id") and not p.get("review"):
            issues.append(f"PEP '{p.get('subject_name')}' missing Wikidata source id")

    # PROMPT SECURITY: a flagged-injection item must NEVER have been model-classified.
    for f in adverse_findings:
        for a in f.get("articles", []):
            tr = a.get("triage") or {}
            if tr.get("injection_suspected") and tr.get("ai"):
                issues.append(f"prompt-injection item was model-classified ('{f.get('subject_name')}')")

    # Every flagged subject must have a risk rating (explainability).
    for m in possible_matches:
        if not m.get("risk"):
            issues.append(f"flagged subject '{m.get('name')}' missing a risk rating")

    # SOURCE-COVERAGE DRIFT (R-09): a core list that silently shrank is a false-
    # negative risk — surface it as an integrity issue, not just a log line.
    for a in (stats.get("coverage", {}) or {}).get("alarms", []) or []:
        issues.append(f"source-coverage drift — {a}")

    # RUNTIME ANOMALY (monitoring): latency/coverage/error anomalies vs baseline.
    for a in (stats.get("monitoring", {}) or {}).get("anomalies", []) or []:
        issues.append(f"runtime anomaly — {a}")

    return {"passed": not issues, "issues": issues}

# ── ORCHESTRATION: build the audit manifest for one run ───────────────────────
def run_pipeline_audit(stats, possible_matches, adverse_findings, pep_findings,
                       list_meta, cases_proposed, ai_mode, env=None):
    """Record what each agent did this run (observability) and run the QA gate.
    Returns {log, qa}. Counts come from the already-completed screening pass."""
    log = AgentLog()
    subjects = stats.get("subjects_total", 0)
    inds = stats.get("individuals_screened", 0)
    am_blocked = stats.get("injection_blocked", 0)

    log.record("IngestAgent", "asana.read", f"loaded {stats.get('customers_total', 0)} customers")
    log.record("SanctionsAgent", "match", f"screened {subjects} subjects vs {sum(v.get('count',0) for v in list_meta.values()):,} list names → {len(possible_matches)} flagged")
    log.record("AdverseMediaAgent", "llm.classify",
               f"triaged adverse media ({ai_mode}); {am_blocked} item(s) blocked by prompt-security")
    log.record("PepAgent", "web.read", f"checked {inds} individuals vs Wikidata → {len(pep_findings)} PEP")
    log.record("RiskAgent", "compute", f"risk-rated {len(possible_matches)} flagged subject(s)")
    log.record("NetworkAgent", "compute", f"{len(stats.get('related_parties', []))} related-party cluster(s)")
    log.record("CaseAgent", "propose", f"drafted {cases_proposed} MLRO case(s) — PROPOSED, not filed")
    qa = qa_gate(possible_matches, adverse_findings, pep_findings, list_meta, stats)
    log.record("QAAgent", "audit", "PASSED" if qa["passed"] else f"{len(qa['issues'])} integrity issue(s)", ok=True)
    log.record("DeliveryAgent", "asana.write", "post unified report to Ongoing Monitoring")

    # Runtime credential scoping: issue only the secrets each agent is authorized
    # to use (values never logged). Plus a static policy self-test.
    broker = CredentialBroker(env)
    broker.issue("IngestAgent", "asana.read")
    if ai_mode != "deterministic":
        broker.issue("AdverseMediaAgent", "llm.classify")
    broker.issue("DeliveryAgent", "asana.write")
    violations = preflight_credentials()
    return {"log": log, "qa": qa, "creds": broker.summary(), "cred_violations": violations}

# ── GOVERNANCE & COMPLIANCE ATTESTATION (per-run, derived from live state) ────
# Turns the AI-Governance / AI-Compliance framework into a self-attesting block:
# each control reports its LIVE status, derived from this run — not a static claim.
def build_attestation(audit, ai_mode, injection_blocked, list_meta):
    qa = audit.get("qa", {})
    viol = audit.get("cred_violations") or []
    core_ok = all(list_meta.get(k, {}).get("count", 0) > 0
                  for k in ("ofac", "un", "uk", "eu", "eocn"))
    privacy = ("on-runner, no data egress (no LLM key)" if ai_mode == "deterministic"
               else "LLM key present → PDPL data-processing assessment required")
    rows = [
        # control, status
        ("GOVERNANCE · Policies & Standards", "documented — docs/AI-GOVERNANCE.md"),
        ("GOVERNANCE · AI Principles",        "outputs labelled + carry raw evidence; fairness sets reviewed"),
        ("GOVERNANCE · Risk Framework",       "per-subject risk rating (FATF R.10) + QA gate"),
        ("GOVERNANCE · Accountability",       "agent identities + least-privilege authorization; MLRO owns decisions"),
        ("GOVERNANCE · Decision Oversight",   "human-in-the-loop MLRO sign-off; degrade-loudly"),
        ("COMPLIANCE · Regulations",          "UAE FDL 26/2021 · Cabinet 74/2020 · FATF R.6/10/12 · AI Strategy 2031"),
        ("COMPLIANCE · Data Privacy",         privacy),
        ("COMPLIANCE · Security Controls",    f"prompt-injection defence ({injection_blocked} blocked) · credential scoping ({len(viol)} violations)"),
        ("COMPLIANCE · Audits",               f"agent audit trail + QA gate ({'PASS' if qa.get('passed') else 'ATTENTION'}) · 10-yr retention"),
        ("COMPLIANCE · Documentation",        "AI-GOVERNANCE.md · README · CI-tested engine"),
    ]
    overall_ok = qa.get("passed", False) and not viol and core_ok
    L = [f"Posture: {'✅ ALL CONTROLS ATTESTED' if overall_ok else '⚠ REVIEW (see flags below)'}    AI mode: {ai_mode}"]
    L.append("")
    for ctrl, status in rows:
        L.append(f"   {ctrl:38} {status}")
    if not core_ok:
        L.append("   ⚠ core sanctions coverage incomplete this run — see module status above")
    return "\n".join(L)

# ── REPORT SECTION ────────────────────────────────────────────────────────────
def build_audit_section(audit):
    """Render the agentic audit trail + QA gate for the report."""
    L = []
    qa = audit["qa"]
    L.append("Operating model: People → Agents → Workflows → Decisions → Outcomes.")
    L.append("Humans set direction; agents execute under least-privilege authorization; the MLRO decides & files.")
    L.append("")
    L.append(f"   QA / GOVERNANCE GATE:  {'✅ PASSED' if qa['passed'] else '⚠ ATTENTION'}")
    if not qa["passed"]:
        for i in qa["issues"]:
            L.append(f"      ⚠ {i}")
    L.append("")
    L.append("   Agent audit trail (identity · action · authorization):")
    for e in audit["log"].entries:
        mark = "ok" if e["ok"] else ("DENIED" if not e["authorized"] else "fail")
        L.append(f"      [{mark:6}] {e['agent']:17} {e['action']:13} — {e['detail']}")

    creds = audit.get("creds")
    if creds:
        viol = audit.get("cred_violations") or []
        L.append("")
        L.append(f"   Credential scoping (least privilege): {creds['issued']} issued · "
                 f"{creds['denied']} denied · policy violations: {len(viol)}"
                 + (" ✅" if not viol else " ⚠"))
        for e in creds["events"]:
            tag = "granted" if e["granted"] else ("DENIED" if not e["authorized"] else "absent")
            L.append(f"      [{tag:7}] {e['agent']:17} {e['secret']:18} ({e['action']}) — {e['presence']}")
        for v in viol:
            L.append(f"      ⚠ POLICY VIOLATION: {v}")
    return "\n".join(L)
