#!/usr/bin/env python3
"""
Unit tests for the MCP layer — mcp_tools.py (engine wrappers) and mcp_server.py
(the stdlib JSON-RPC 2.0 stdio transport).

Self-contained: stubs the runtime-only engine deps (rapidfuzz/pdfplumber/requests)
so the pure logic runs offline in CI, exactly like test/engine_test.py. Run:
`python test/mcp_tools_test.py`. Exits non-zero on first failure (CI-friendly).
"""
import sys, os, types, difflib, io, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# ── stub runtime-only third-party deps (same shims as engine_test.py) ─────────
def _tsr(a, b):
    a = " ".join(sorted(a.split())); b = " ".join(sorted(b.split()))
    return difflib.SequenceMatcher(None, a, b).ratio() * 100
def _tset(a, b):
    sa, sb = set(a.split()), set(b.split()); inter = sa & sb
    if not inter: return _tsr(a, b)
    i = " ".join(sorted(inter))
    return max(_tsr(i, " ".join(sorted(sa))), _tsr(i, " ".join(sorted(sb))), _tsr(a, b))
_rf = types.ModuleType("rapidfuzz"); _rf.fuzz = types.SimpleNamespace(token_sort_ratio=_tsr, token_set_ratio=_tset)
sys.modules["rapidfuzz"] = _rf
sys.modules["pdfplumber"] = types.ModuleType("pdfplumber")
_req = types.ModuleType("requests"); _req.utils = types.SimpleNamespace(quote=lambda s: s)
_req.get = lambda *a, **k: None; _req.post = lambda *a, **k: None
sys.modules["requests"] = _req
os.environ.setdefault("ASANA_TOKEN", "dummy")
os.environ.pop("ANTHROPIC_API_KEY", None)

import mcp_tools     # imports screen/kyc/txn_monitor under the stubs
import mcp_server    # imports mcp_tools

_fail = []
def check(name, cond):
    print(("  ok   " if cond else "  FAIL ") + name)
    if not cond: _fail.append(name)

def expect_valueerror(name, fn):
    try:
        fn(); check(name, False)
    except ValueError:
        check(name, True)
    except Exception as e:
        print(f"  FAIL {name} (raised {type(e).__name__}, expected ValueError)"); _fail.append(name)

# ── mcp_tools.normalize_name ─────────────────────────────────────────────────────────────────
print("mcp_tools — normalize_name")
n = mcp_tools.normalize_name("Muḥammad Al-Zawari")
check("normalize returns an uppercased latinised form", n["normalized"] == n["normalized"].upper() and "MUHAMMAD" in n["normalized"])
check("normalize reports screenable for a real name", n["screenable"] is True)
check("normalize reports phonetic tokens as a list", isinstance(n["phonetic_tokens"], list))
check("normalize flags a too-short name as not screenable", mcp_tools.normalize_name("Li")["screenable"] is False)
expect_valueerror("normalize rejects a non-string name", lambda: mcp_tools.normalize_name(123))
expect_valueerror("normalize rejects an empty name", lambda: mcp_tools.normalize_name("   "))

# ── mcp_tools.screen_name (deterministic, caller-supplied list) ───────────────
print("mcp_tools — screen_name")
hit = mcp_tools.screen_name("Petropars International FZE", ["PETROPARS INTERNATIONAL FZE", "SOME OTHER CO"])
check("screen_name flags a true match", hit["hit_count"] == 1 and hit["cleared"] is False)
check("screen_name hit carries list/score/confidence", hit["hits"][0]["matched_entry"] == "PETROPARS INTERNATIONAL FZE"
      and isinstance(hit["hits"][0]["score"], (int, float)) and hit["hits"][0]["confidence"])
clear = mcp_tools.screen_name("Gulf Star Metals Trading LLC", ["HAMAS", "IRISL"])
check("screen_name clears an unrelated subject", clear["cleared"] is True and clear["hit_count"] == 0)
check("screen_name reports entries screened (empty-normalising ones dropped)",
      mcp_tools.screen_name("Test Person Ltd", ["Real Co", "!!!", ""])["entries_screened"] == 1)
expect_valueerror("screen_name rejects a non-list watchlist", lambda: mcp_tools.screen_name("X Co", "notalist"))
expect_valueerror("screen_name rejects a non-string watchlist entry", lambda: mcp_tools.screen_name("X Co", ["ok", 5]))
expect_valueerror("screen_name rejects an oversized watchlist",
                  lambda: mcp_tools.screen_name("X Co", ["n"] * (mcp_tools.MAX_WATCHLIST + 1)))

# ── mcp_tools.monitor_transactions (FATF R.16 boundaries) ───────────────────────
print("mcp_tools — monitor_transactions")
def _tx(*amts, method="cash"):
    return [{"customer": "C", "date": f"2026-01-{i+1:02d}", "amount": a, "direction": "in", "method": method}
            for i, a in enumerate(amts)]
thr = mcp_tools.monitor_transactions(_tx(55000))
check("monitor flags a cash txn at the reporting threshold", any(a["rule"] == "THRESHOLD" for a in thr["alerts"]))
check("monitor still flags 54999 cash (above the AED 15k CDD trigger, below DPMSR)",
      any(a["rule"] == "CDD_TRIGGER" for a in mcp_tools.monitor_transactions(_tx(54999))["alerts"]))
check("monitor is clean for a single small cash txn below every trigger", mcp_tools.monitor_transactions(_tx(9999))["clean"] is True)
stru = mcp_tools.monitor_transactions(_tx(50000, 50000, 50000))
check("monitor flags 3 just-under cash txns as structuring", any(a["rule"] == "STRUCTURING" for a in stru["alerts"]))
check("monitor sorts alerts by severity (CRITICAL first)",
      not stru["alerts"] or stru["alerts"][0]["severity"] in ("CRITICAL", "HIGH", "MEDIUM", "LOW"))
check("monitor reports no rule errors on clean input", mcp_tools.monitor_transactions(_tx(1000))["rules_errored"] == {})
expect_valueerror("monitor rejects a non-list", lambda: mcp_tools.monitor_transactions("nope"))
expect_valueerror("monitor rejects a non-object transaction", lambda: mcp_tools.monitor_transactions([1, 2]))

# ── mcp_tools.analyze_kyc_note (CDD gaps, privacy masking) ───────────────────────
print("mcp_tools — analyze_kyc_note")
note = ("SECTION 4 — IDENTIFICATIONS\n"
        "Individual 1 — Shareholder & Director\n"
        "Name: JOHN SMITH\nNationality: British\nPassport/ID: X1234567\n")
kres = mcp_tools.analyze_kyc_note(note)
check("kyc parses one individual", kres["individual_count"] == 1 and kres["individuals"][0]["name"] == "JOHN SMITH")
check("kyc masks the ID number (last 3 only)", kres["individuals"][0]["id_masked"].endswith("567")
      and "1234" not in kres["individuals"][0]["id_masked"])
check("kyc flags missing DOB / proof-of-address as CDD gaps", kres["total_cdd_gaps"] >= 2 and kres["cdd_complete"] is False)
expect_valueerror("kyc rejects a non-string note", lambda: mcp_tools.analyze_kyc_note(None))

# ── mcp_tools.jurisdiction_risk ─────────────────────────────────────────────────────
print("mcp_tools — jurisdiction_risk")
jr = mcp_tools.jurisdiction_risk(country="Iran")
check("jurisdiction_risk returns a shape with tier + list_available", "tier" in jr and "list_available" in jr)
expect_valueerror("jurisdiction_risk needs at least one input", lambda: mcp_tools.jurisdiction_risk("", []))
expect_valueerror("jurisdiction_risk rejects non-string nationality", lambda: mcp_tools.jurisdiction_risk("UAE", [1]))

# ── mcp_tools.name_variants ────────────────────────────────────────────────────────────
print("mcp_tools — name_variants")
nv = mcp_tools.name_variants("Mohammed Al Rashid")
check("name_variants includes the name itself and reports a count", nv["count"] == len(nv["variants"]) and nv["count"] >= 1)
check("name_variants returns a list of strings", all(isinstance(v, str) for v in nv["variants"]))
expect_valueerror("name_variants rejects a non-string", lambda: mcp_tools.name_variants(None))

# ── mcp_tools.adverse_media_scan ───────────────────────────────────────────────────
print("mcp_tools — adverse_media_scan")
am = mcp_tools.adverse_media_scan("Trader charged in money laundering and fraud scheme")
check("adverse_media_scan flags a clearly adverse headline", am["flagged"] is True and am["keyword_count"] >= 1)
clean_am = mcp_tools.adverse_media_scan("Company opens a new office in Dubai")
check("adverse_media_scan does not flag a benign headline", clean_am["flagged"] is False)
expect_valueerror("adverse_media_scan rejects a non-string", lambda: mcp_tools.adverse_media_scan(42))

# ── mcp_tools.assemble_str_dossier ────────────────────────────────────────────────
print("mcp_tools — assemble_str_dossier")
_valid_case = {
    "customer": {"name": "EXAMPLE TRADING FZE"},
    "risk": {"rating": "HIGH", "factors": ["sanctions name match on UBO"]},
    "hits": [{"list": "UN Consolidated", "matched_entry": "EXAMPLE PERSON", "score": 97}],
}
dz = mcp_tools.assemble_str_dossier(_valid_case)
check("assemble_str_dossier returns a DRAFT-marked markdown dossier", dz["draft"] is True
      and isinstance(dz["dossier_markdown"], str) and "DRAFT" in dz["dossier_markdown"].upper())
check("assemble_str_dossier carries the customer + rating", dz["customer"] == "EXAMPLE TRADING FZE" and dz["risk_rating"] == "HIGH")
expect_valueerror("assemble_str_dossier rejects a non-object case", lambda: mcp_tools.assemble_str_dossier("nope"))
try:
    mcp_tools.assemble_str_dossier({"customer": {"name": ""}, "risk": {"rating": "BOGUS", "factors": []}})
    check("assemble_str_dossier rejects an incomplete case with the missing fields", False)
except ValueError as e:
    check("assemble_str_dossier rejects an incomplete case with the missing fields", "incomplete" in str(e) and "hits" in str(e))

# ── mcp_tools.assemble_tfs_dossier ────────────────────────────────────────────────
print("mcp_tools — assemble_tfs_dossier")
_valid_tfs_case = {
    "customer": {"name": "EXAMPLE TRADING FZE"},
    "match_status": "confirmed",
    "hits": [{"list": "UN Security Council — Consolidated list (XML)",
              "matched_entry": "EXAMPLE PERSON", "score": 97}],
    "funds": {"held": True, "items": [{"type": "trade receivable", "value": "60000", "currency": "AED"}]},
}
tz = mcp_tools.assemble_tfs_dossier(_valid_tfs_case)
check("assemble_tfs_dossier returns a DRAFT-marked markdown dossier", tz["draft"] is True
      and isinstance(tz["dossier_markdown"], str) and "DRAFT" in tz["dossier_markdown"].upper())
check("assemble_tfs_dossier carries the customer + recommends FFR for a confirmed match with funds held",
      tz["customer"] == "EXAMPLE TRADING FZE" and tz["recommended_report_kind"] == "FFR")
check("assemble_tfs_dossier recommends PNMR for a partial match",
      mcp_tools.assemble_tfs_dossier({**_valid_tfs_case, "match_status": "partial"})["recommended_report_kind"] == "PNMR")
expect_valueerror("assemble_tfs_dossier rejects a non-object case", lambda: mcp_tools.assemble_tfs_dossier("nope"))
try:
    mcp_tools.assemble_tfs_dossier({"customer": {"name": "X"}, "match_status": "confirmed",
                                    "hits": [{"list": "Some Local List", "matched_entry": "y"}]})
    check("assemble_tfs_dossier rejects a case with no hit on a TFS list", False)
except ValueError as e:
    check("assemble_tfs_dossier rejects a case with no hit on a TFS list", "incomplete" in str(e) and "TFS list" in str(e))

# ── mcp_tools.compute_risk_rating ─────────────────────────────────────────────────
print("mcp_tools — compute_risk_rating")
low = mcp_tools.compute_risk_rating()
check("compute_risk_rating with no findings still rates LOW/MEDIUM/HIGH and lists sector-risk factor",
      low["rating"] in ("LOW", "MEDIUM", "HIGH") and any("sector" in f.lower() for f in low["factors"]))
high = mcp_tools.compute_risk_rating(sanctions_hits=[{"score": 97}], is_control=True, pep=True)
check("compute_risk_rating rates HIGH on a confirmed hit + control linkage", high["rating"] == "HIGH")
check("compute_risk_rating returns an EDD requirement string", isinstance(high["edd_requirement"], str) and high["edd_requirement"])
expect_valueerror("compute_risk_rating rejects a non-list sanctions_hits", lambda: mcp_tools.compute_risk_rating(sanctions_hits="nope"))
expect_valueerror("compute_risk_rating rejects a non-object hit", lambda: mcp_tools.compute_risk_rating(sanctions_hits=[1]))
expect_valueerror("compute_risk_rating rejects a non-boolean pep", lambda: mcp_tools.compute_risk_rating(pep="yes"))
expect_valueerror("compute_risk_rating rejects a negative cdd_gaps", lambda: mcp_tools.compute_risk_rating(cdd_gaps=-1))

# ── mcp_tools.related_parties ──────────────────────────────────────────────────────
print("mcp_tools — related_parties")
shared = mcp_tools.related_parties([
    {"name": "ACME FZE", "individuals": ["John Smith"]},
    {"name": "BETA TRADING LLC", "individuals": ["John Smith"]},
])
check("related_parties flags a UBO shared across two customers", shared["cluster_count"] >= 1 and shared["clean"] is False)
none_ = mcp_tools.related_parties([{"name": "SOLO FZE", "individuals": ["Jane Doe"]}])
check("related_parties is clean for a single unrelated customer", none_["clean"] is True and none_["cluster_count"] == 0)
expect_valueerror("related_parties rejects a non-list", lambda: mcp_tools.related_parties("nope"))
expect_valueerror("related_parties rejects a non-object customer", lambda: mcp_tools.related_parties([1]))
expect_valueerror("related_parties rejects a non-list individuals field",
                  lambda: mcp_tools.related_parties([{"name": "X", "individuals": "not-a-list"}]))

# ── mcp_tools.call_tool dispatch ───────────────────────────────────────────────────
print("mcp_tools — dispatch")
check("call_tool dispatches a known tool", mcp_tools.call_tool("hawkeye_normalize_name", {"name": "Test"})["normalized"] == "TEST")
try:
    mcp_tools.call_tool("nope", {}); check("call_tool raises KeyError for unknown tool", False)
except KeyError:
    check("call_tool raises KeyError for unknown tool", True)
check("every registered tool has a callable, description and inputSchema",
      all(callable(v[0]) and isinstance(v[1], str) and isinstance(v[2], dict) for v in mcp_tools.TOOLS.values()))

# Serialisation guard: EVERY tool's output must be JSON-serialisable, because the
# server hands it back as JSON text — a tool returning a set/tuple/etc. crashes
# the call at runtime (regression: name_variants returned a set). Call each tool
# with representative valid args and assert json.dumps succeeds.
print("mcp_tools — output serialisability (all tools)")
_valid_args = {
    "hawkeye_normalize_name": {"name": "Test Person"},
    "hawkeye_screen_name": {"name": "Test Person Ltd", "watchlist": ["ACME LLC"]},
    "hawkeye_screen_internal_watchlist": {"name": "Test Person Ltd"},
    "hawkeye_monitor_transactions": {"transactions": [{"customer": "C", "date": "2026-01-01", "amount": 55000, "method": "cash"}]},
    "hawkeye_analyze_kyc_note": {"notes": "SECTION 4\nIndividual 1 — Director\nName: JANE DOE\n"},
    "hawkeye_jurisdiction_risk": {"country": "Iran"},
    "hawkeye_name_variants": {"name": "Mohammed Abdul Rahman"},
    "hawkeye_adverse_media_scan": {"headline": "Firm fined for fraud"},
    "hawkeye_assemble_str_dossier": {"case": {"customer": {"name": "X FZE"}, "risk": {"rating": "HIGH", "factors": ["f"]}, "hits": [{"list": "UN", "matched_entry": "y", "score": 90}]}},
    "hawkeye_assemble_tfs_dossier": {"case": {"customer": {"name": "X FZE"}, "match_status": "partial",
                                              "hits": [{"list": "UN Security Council — Consolidated list (XML)", "matched_entry": "y", "score": 90}]}},
    "hawkeye_compute_risk_rating": {"sanctions_hits": [{"score": 90}], "pep": True},
    "hawkeye_related_parties": {"customers": [{"name": "X FZE", "individuals": ["Jane Doe"]}]},
}
check("_valid_args covers every registered tool", set(_valid_args) == set(mcp_tools.TOOLS))
for _tname, _targs in _valid_args.items():
    try:
        json.dumps(mcp_tools.call_tool(_tname, _targs))
        check(f"{_tname} output is JSON-serialisable", True)
    except Exception as _e:
        check(f"{_tname} output is JSON-serialisable ({type(_e).__name__}: {_e})", False)

# ── mcp_server — JSON-RPC 2.0 protocol ──────────────────────────────────────────────
print("mcp_server — protocol")
def rpc(method, params=None, req_id=1, notification=False):
    msg = {"jsonrpc": "2.0", "method": method}
    if not notification: msg["id"] = req_id
    if params is not None: msg["params"] = params
    return mcp_server.dispatch(msg)

init = rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}})
check("initialize echoes a supported protocolVersion", init["result"]["protocolVersion"] == "2025-06-18")
check("initialize advertises tools/resources/prompts capabilities",
      all(k in init["result"]["capabilities"] for k in ("tools", "resources", "prompts")))
check("initialize returns serverInfo name", init["result"]["serverInfo"]["name"] == "hawkeye-sterling-aml")
check("initialize falls back to preferred version for an unknown one",
      rpc("initialize", {"protocolVersion": "1999-01-01"})["result"]["protocolVersion"] == mcp_server.PREFERRED_PROTOCOL)

check("ping returns an empty result", rpc("ping")["result"] == {})

tl = rpc("tools/list")["result"]["tools"]
check("tools/list returns every registered tool", len(tl) == len(mcp_tools.TOOLS))
check("tools/list entries carry name/description/inputSchema/annotations",
      all(set(("name", "description", "inputSchema", "annotations")) <= set(t) for t in tl))
check("tools are annotated read-only + non-destructive", all(t["annotations"]["readOnlyHint"] and not t["annotations"]["destructiveHint"] for t in tl))

call_ok = rpc("tools/call", {"name": "hawkeye_screen_name",
                             "arguments": {"name": "Petropars International FZE", "watchlist": ["PETROPARS INTERNATIONAL FZE"]}})
check("tools/call returns content text + structuredContent", call_ok["result"]["isError"] is False
      and call_ok["result"]["content"][0]["type"] == "text"
      and call_ok["result"]["structuredContent"]["hit_count"] == 1)

bad_args = rpc("tools/call", {"name": "hawkeye_screen_name", "arguments": {"name": "X", "watchlist": "notalist"}})
check("tools/call reports a bad-argument error IN-BAND (isError=true)",
      bad_args["result"]["isError"] is True and "invalid arguments" in bad_args["result"]["content"][0]["text"])
unknown = rpc("tools/call", {"name": "does_not_exist", "arguments": {}})
check("tools/call reports an unknown tool in-band", unknown["result"]["isError"] is True and "unknown tool" in unknown["result"]["content"][0]["text"])

rl = rpc("resources/list")["result"]["resources"]
check("resources/list returns the reference resources", len(rl) == len(mcp_tools.RESOURCES) and all("uri" in r for r in rl))
rr = rpc("resources/read", {"uri": "hawkeye://reference/jurisdiction-risk"})
check("resources/read returns JSON contents for a known uri", rr["result"]["contents"][0]["mimeType"] == "application/json"
      and json.loads(rr["result"]["contents"][0]["text"]) is not None)
check("resources/read errors on an unknown uri", "error" in rpc("resources/read", {"uri": "hawkeye://nope"}))

pl = rpc("prompts/list")["result"]["prompts"]
check("prompts/list returns the prompt templates", len(pl) == len(mcp_server.PROMPTS))
pg = rpc("prompts/get", {"name": "adverse_media_triage", "arguments": {"subject": "ACME FZE", "headline": "ACME fined for fraud"}})
check("prompts/get builds a user message embedding the untrusted marker",
      pg["result"]["messages"][0]["role"] == "user" and "<<UNTRUSTED>>" in pg["result"]["messages"][0]["content"]["text"])
check("prompts/get errors when a required argument is missing",
      "error" in rpc("prompts/get", {"name": "adverse_media_triage", "arguments": {"subject": "X"}}))

check("unknown method → JSON-RPC -32601", rpc("no/such/method")["error"]["code"] == mcp_server.METHOD_NOT_FOUND)
check("a notification (no id) yields no response", rpc("notifications/initialized", notification=True) is None)
check("non-2.0 message is rejected", mcp_server.dispatch({"id": 1, "method": "ping"})["error"]["code"] == mcp_server.INVALID_REQUEST)

# ── mcp_server.serve — end-to-end stdio framing ───────────────────────────────────
print("mcp_server — stdio framing")
stdin = io.StringIO(
    json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}}) + "\n"
    + json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n"
    + "\n"  # blank line must be skipped
    + "{ not json\n"  # parse error must produce a -32700 frame, not a crash
    + json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                  "arguments": None, "params": {"name": "hawkeye_normalize_name", "arguments": {"name": "Acme"}}}) + "\n"
)
stdout = io.StringIO()
mcp_server.serve(stdin, stdout)
frames = [json.loads(x) for x in stdout.getvalue().splitlines() if x.strip()]
check("serve emits one newline-delimited frame per non-notification message", len(frames) == 3)  # init, parse-error, tools/call
check("serve replied to initialize (id 1)", any(f.get("id") == 1 and "result" in f for f in frames))
check("serve emitted a -32700 parse-error frame for bad JSON", any(f.get("error", {}).get("code") == mcp_server.PARSE_ERROR for f in frames))
check("serve did NOT reply to the notification", not any(f.get("id") is None and "result" in f for f in frames))
check("serve ran the tools/call (id 2) and normalised", any(f.get("id") == 2 and f["result"]["structuredContent"]["normalized"] == "ACME" for f in frames))

# ── audit trail — MCP tool calls join the shared AgentLog ───────────────────────
# Every other engine entry point records to agents.AgentLog; until 2026-08-04
# a tool call arriving over MCP left no trace in the trail the rest of the
# system treats as mandatory. These pin the wiring: every outcome path writes
# an entry, and argument VALUES (screening subjects are PII) never do.
print("mcp_server — audit trail")
_base = len(mcp_server.AUDIT_LOG.entries)
rpc("tools/call", {"name": "hawkeye_normalize_name", "arguments": {"name": "Zeta Quantum Trading FZE"}})
_e = mcp_server.AUDIT_LOG.entries[-1]
check("a successful tool call appends exactly one audit entry",
      len(mcp_server.AUDIT_LOG.entries) == _base + 1)
check("the entry is McpAgent acting within its mcp.tool authorization",
      _e["agent"] == "McpAgent" and _e["action"] == "mcp.tool" and _e["authorized"] is True and _e["ok"] is True)
check("the entry names the tool and the ok outcome", _e["detail"] == "hawkeye_normalize_name: ok")

rpc("tools/call", {"name": "no_such_tool", "arguments": {}})
check("an unknown tool is audited ok=False with the unknown-tool outcome",
      mcp_server.AUDIT_LOG.entries[-1]["detail"] == "no_such_tool: unknown-tool"
      and mcp_server.AUDIT_LOG.entries[-1]["ok"] is False)

rpc("tools/call", {"name": "hawkeye_normalize_name", "arguments": {"name": 123}})
check("bad argument shape is audited ok=False as invalid-arguments",
      mcp_server.AUDIT_LOG.entries[-1]["detail"] == "hawkeye_normalize_name: invalid-arguments"
      and mcp_server.AUDIT_LOG.entries[-1]["ok"] is False)

rpc("tools/call", {"arguments": {}})
check("a missing tool name is audited ok=False",
      mcp_server.AUDIT_LOG.entries[-1]["detail"] == "(none): missing-tool-name"
      and mcp_server.AUDIT_LOG.entries[-1]["ok"] is False)

check("argument values (screening subjects) never reach the audit trail",
      all("Zeta Quantum" not in e["detail"] for e in mcp_server.AUDIT_LOG.entries))
check("McpAgent is registered with exactly the mcp.tool authorization",
      any(a["name"] == "McpAgent" and a["authz"] == ["mcp.tool"] for a in __import__("agents").AGENTS))
check("the credential broker can never issue McpAgent a secret",
      __import__("agents").CredentialBroker(env={"ASANA_TOKEN": "x"}).issue("McpAgent", "asana.write") is None)

total_fail = len(_fail)
print("\n" + ("ALL MCP TESTS PASSED" if not total_fail else f"{total_fail} MCP TEST(S) FAILED"))
sys.exit(1 if total_fail else 0)
