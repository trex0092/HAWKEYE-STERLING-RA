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

    # Every PEP must carry its Wikidata source.
    for p in pep_findings:
        if not p.get("id"):
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

    return {"passed": not issues, "issues": issues}

# ── ORCHESTRATION: build the audit manifest for one run ───────────────────────
def run_pipeline_audit(stats, possible_matches, adverse_findings, pep_findings,
                       list_meta, cases_proposed, ai_mode):
    """Record what each agent did this run (observability) and run the QA gate.
    Returns {log, qa}. Counts come from the already-completed screening pass."""
    log = AgentLog()
    subjects = stats.get("subjects_total", 0)
    companies = stats.get("companies_screened", 0)
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
    return {"log": log, "qa": qa}

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
    return "\n".join(L)
