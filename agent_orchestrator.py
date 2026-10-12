#!/usr/bin/env python3
"""Human-directed, bounded read-only investigation workflow.

This is a LOCAL deterministic coordinator, NOT autonomous model tool calling.
No production endpoint, LLM, vendor connector, network, file write or
regulatory decision. Approval and tool dispatcher must come from a trusted
server-side caller, not from a model or browser parameter.
"""
import hashlib
import json
import re

MAX_STEPS = 8
MAX_REPLANS = 2
MAX_ARG_BYTES = 8192
MAX_RESULT_BYTES = 8192
MAX_TOTAL_RESULT_BYTES = 32768
ALLOWED_TOOLS = frozenset((
    "hawkeye_normalize_name",
    "hawkeye_screen_name",
    "hawkeye_jurisdiction_risk",
    "hawkeye_name_variants",
    "hawkeye_compute_risk_rating",
))
APPROVED_ROLES = frozenset(("Reviewer-MLRO", "Admin"))
IDENTIFIER = re.compile(r"^[a-zA-Z0-9_.:-]{1,100}$")


class WorkflowDenied(ValueError):
    """Intentionally do not echo confidential input or tool arguments."""


def _validated(plan):
    if not isinstance(plan, dict) or set(plan) != {"task_id", "objective", "steps"}:
        raise WorkflowDenied("plan must have task_id, objective and steps only")
    if not isinstance(plan["task_id"], str) or not IDENTIFIER.fullmatch(plan["task_id"]):
        raise WorkflowDenied("invalid task identifier")
    if not isinstance(plan["objective"], str) or not 4 <= len(plan["objective"]) <= 500:
        raise WorkflowDenied("bounded human objective required")
    steps = plan["steps"]
    if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_STEPS:
        raise WorkflowDenied("plan must have one to eight steps")
    validated_steps = []
    for item in steps:
        if not isinstance(item, dict) or set(item) != {"tool", "arguments"}:
            raise WorkflowDenied("each step needs only tool and arguments")
        # Type-check before the set lookup: an unhashable tool (list/dict) would
        # otherwise raise TypeError instead of a fail-closed denial.
        if (not isinstance(item["tool"], str) or item["tool"] not in ALLOWED_TOOLS
                or not isinstance(item["arguments"], dict)):
            raise WorkflowDenied("tool not in the approved read-only allowlist")
        try:
            arg_bytes = json.dumps(item["arguments"], ensure_ascii=False,
                                   sort_keys=True, allow_nan=False).encode("utf8")
        except (TypeError, ValueError, RecursionError):
            # RecursionError: pathologically nested arguments are a denial too.
            raise WorkflowDenied("arguments not valid JSON")
        if len(arg_bytes) > MAX_ARG_BYTES:
            raise WorkflowDenied("tool argument budget exceeded")
        # Return an immutable-in-practice JSON snapshot, not the original
        # plan's nested objects. A callback may otherwise mutate the next
        # step's tool/arguments after its authorization check.
        validated_steps.append({
            "tool": item["tool"],
            "arguments": json.loads(arg_bytes.decode("utf8")),
        })
    return validated_steps


def _bounded_result(result):
    """Snapshot trusted tool data and reject oversized or ambiguous results.

    No exception details or tool-output contents are propagated to the event
    log. The returned snapshot also cannot be altered by later tool callbacks.
    """
    if not isinstance(result, dict):
        raise WorkflowDenied("tool response is not a JSON object")
    try:
        raw = json.dumps(result, ensure_ascii=False, sort_keys=True,
                         allow_nan=False, separators=(",", ":")).encode("utf8")
        if len(raw) > MAX_RESULT_BYTES:
            raise WorkflowDenied("tool response exceeded budget")
        return json.loads(raw.decode("utf8")), len(raw)
    except (TypeError, ValueError, OverflowError, RecursionError):
        raise WorkflowDenied("tool response is not bounded JSON") from None


def preview(plan):
    """Plan metadata only, without personal data or tool argument values."""
    steps = _validated(plan)
    return {"task_id": plan["task_id"], "status": "AWAITING_HUMAN",
            "steps": len(steps), "permitted_tools": [item["tool"] for item in steps],
            "execution_enabled": False, "regulatory_decision": False}


def execute_human_approved(plan, dispatcher=None, *, verified_role=None,
                           signed_human_approval=False, replan_count=0):
    """Require a TRUSTED caller's identity + documented approval.

    The 'signed_human_approval' boolean here is intentionally NOT
    cryptographic evidence and must never be exposed as a client parameter.
    A future production adapter must verify a persisted, non-replayable
    MLRO approval bound to task ID and exact plan before calling this.
    The dispatcher is callable only after the fail-closed gate.
    """
    steps = _validated(plan)
    task_id = plan["task_id"]
    # A role from an improperly decoded identity payload may be an array or
    # object. Membership on such a value raises TypeError; deny safely instead.
    if type(verified_role) is not str or verified_role not in APPROVED_ROLES or signed_human_approval is not True:
        return {"task_id": task_id, "status": "AWAITING_HUMAN",
                "executed": 0, "results": [], "events": []}
    if type(replan_count) is not int or not 0 <= replan_count <= MAX_REPLANS:
        raise WorkflowDenied("maximum replans exceeded")
    if not callable(dispatcher):
        raise WorkflowDenied("trusted local tool dispatcher is required")

    results = []
    events = []
    total_result_bytes = 0
    for i, step in enumerate(steps, 1):
        # The dispatcher MUST be the trusted, local, deterministic MCP wrapper.
        # Keep personal data in memory; only tool name/status enter the log.
        try:
            result = dispatcher(step["tool"], step["arguments"])
            safe_result, size = _bounded_result(result)
            if total_result_bytes + size > MAX_TOTAL_RESULT_BYTES:
                raise WorkflowDenied("cumulative tool output budget exceeded")
        except Exception:
            # Tool-output errors must not become automated clearances.
            events.append({"step": i, "tool": step["tool"], "outcome": "FAILED"})
            return {"task_id": task_id, "status": "NEEDS_HUMAN",
                    "executed": i - 1, "results": results, "events": events,
                    "regulatory_decision": False}
        total_result_bytes += size
        results.append({"tool": step["tool"], "value": safe_result})
        events.append({"step": i, "tool": step["tool"], "outcome": "OK"})

    return {"task_id": task_id, "status": "DRAFT_COMPLETE",
            "executed": len(steps), "results": results, "events": events,
            "regulatory_decision": False, "filing": False}


def proposal_digest(plan):
    """Bind a future signed approval to canonical plan bytes.

    A digest alone is NOT an approval, an authenticated identity or a
    sufficient tamper-evident audit record.
    """
    steps = _validated(plan)
    normalized = {"task_id": plan["task_id"], "objective": plan["objective"],
                  "steps": steps}
    blob = json.dumps(normalized, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf8")
    return hashlib.sha256(blob).hexdigest()
