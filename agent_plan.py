#!/usr/bin/env python3
"""Offline, deterministic and bounded read-only investigation plan runner.

Not a live AI agent, model tool-calling interface or enforcement endpoint.
An authenticated human must supply the task, and trusted code must supply
the verified role and each explicitly allowlisted read-only tool.

No network calls, secrets, persistence, autonomous replanning or write
actions exist in this module. Callbacks require independent review: time
limits cannot interrupt a blocking synchronous callback. Never connect an
LLM directly to this library.
"""
import hashlib
import json
import math
import time
from copy import deepcopy
from types import MappingProxyType

MAX_STEPS = 6
MAX_TOTAL_CALLS = 8
MAX_SECONDS = 5.0
MAX_RESULT_CHARS = 8192  # Kept for callers; limit enforced on UTF-8 bytes.
MAX_TOTAL_RESULT_BYTES = 32768
READ_ONLY_TOOLS = frozenset(("normalize_name", "jurisdiction_risk", "name_variants"))
HUMAN_ROLES = frozenset(("Analyst", "Reviewer-MLRO", "Admin"))
ARGS_ALLOWED = {
    "normalize_name": {"name": 512},
    "jurisdiction_risk": {"country": 128},
    "name_variants": {"name": 512},
}


class PlanDenied(ValueError):
    pass


def _required_text(value, cap):
    return type(value) is str and bool(value.strip()) and len(value) <= cap


def _validated_steps(plan, allowed_tools):
    if not isinstance(plan, dict) or set(plan) != {"schema", "objective", "steps"}:
        raise PlanDenied("unsupported read-only plan structure")
    if plan["schema"] != "hawkeye.readonly-plan/v1":
        raise PlanDenied("plan schema unsupported")
    if not _required_text(plan["objective"], 600):
        raise PlanDenied("objective missing or too long")
    steps = plan["steps"]
    if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_STEPS:
        raise PlanDenied("plan exceeds bounded step count")
    seen = set()
    total_calls = 0
    for step in steps:
        if not isinstance(step, dict) or set(step) != {"id", "tool", "args", "retries"}:
            raise PlanDenied("unsupported step structure")
        sid = step["id"]
        if not _required_text(sid, 64) or not all(c.isascii() and
                (c.isalnum() or c in "_-") for c in sid) or sid in seen:
            raise PlanDenied("step ID absent, repeated or malformed")
        seen.add(sid)
        tool = step["tool"]
        if type(tool) is not str or tool not in READ_ONLY_TOOLS or tool not in allowed_tools:
            raise PlanDenied("tool not authorized for this read-only plan")
        expected = ARGS_ALLOWED[tool]
        args = step["args"]
        if not isinstance(args, dict) or set(args) != set(expected) or any(
                not _required_text(args[key], limit) for key, limit in expected.items()):
            raise PlanDenied("tool input does not match bounded schema")
        retries = step["retries"]
        if type(retries) is not int or retries < 0 or retries > 1:
            raise PlanDenied("invalid retry budget")
        total_calls += retries + 1
    if total_calls > MAX_TOTAL_CALLS:
        raise PlanDenied("total planned calls exceed fixed budget")
    # Copy the validated plan before dispatch: a callback that still holds a
    # reference to the caller's plan must not alter later authorized steps.
    # All argument values are already validated strings, so shallow arg copies
    # are sufficient and do not change their meaning.
    return [{"id": s["id"], "tool": s["tool"], "args": dict(s["args"]),
             "retries": s["retries"]} for s in steps]


def run_review_plan(plan, *, verified_role=None, authorized_tools=None,
                    tool_handlers=None, clock=time.monotonic,
                    max_seconds=MAX_SECONDS):
    """Execute trusted local read-only callbacks, then require human review.

    Even successful execution returns REVIEW_REQUIRED, never a risk clearance.
    Event metadata contains no input names or raw tool data. Raw results
    remain only in the returned in-memory map.
    """
    safe_base = {"authorized_for_action": False, "events": [], "results": {}}
    if type(verified_role) is not str or verified_role not in HUMAN_ROLES \
            or not isinstance(authorized_tools, (set, frozenset)) \
            or not isinstance(tool_handlers, dict) or type(max_seconds) not in (int, float) \
            or not 0 < max_seconds <= MAX_SECONDS or not callable(clock):
        return {"status": "HOLD", "reason": "missing trusted execution context", **safe_base}
    try:
        steps = _validated_steps(plan, authorized_tools)
        if any(tool not in tool_handlers or not callable(tool_handlers[tool])
               for tool in {s["tool"] for s in steps}):
            raise PlanDenied("approved read-only tool is unavailable")
    except PlanDenied as exc:
        return {"status": "HOLD", "reason": str(exc), **safe_base}

    events = []
    results = {}
    calls = 0
    total_result_bytes = 0

    def safe_clock():
        # Although supplied by trusted code, the timing source must not be
        # able to silently return NaN, infinity, decreasing time, or throw.
        try:
            value = clock()
            return value if type(value) in (int, float) and math.isfinite(value) else None
        except Exception:
            return None

    start = safe_clock()
    if start is None:
        return {"status": "HOLD", "reason": "invalid trusted timing source", **safe_base}

    def time_unreliable_or_expired():
        now = safe_clock()
        return now is None or now < start or now - start >= max_seconds

    for step in steps:
        for attempt in range(step["retries"] + 1):
            if calls >= MAX_TOTAL_CALLS or time_unreliable_or_expired():
                return {"status": "DEGRADED", "reason": "execution budget exhausted or timing source degraded",
                        "authorized_for_action": False, "events": events, "results": results}
            calls += 1
            try:
                # Handlers come only from trusted server configuration, never
                # from a model-selected executable name or arbitrary import.
                result = tool_handlers[step["tool"]](
                    dict(step["args"]), MappingProxyType(deepcopy(results)))
                # Store exactly the JSON bytes that were size-checked and
                # hashed. Otherwise later callbacks may mutate prior results
                # and leave the signed-off audit hash inconsistent with output.
                raw = json.dumps(result, sort_keys=True, ensure_ascii=False,
                                 allow_nan=False, separators=(",", ":")).encode("utf8")
                if len(raw) > MAX_RESULT_CHARS:
                    raise ValueError("tool result exceeded bounded size")
                if total_result_bytes + len(raw) > MAX_TOTAL_RESULT_BYTES:
                    raise ValueError("cumulative tool evidence budget exceeded")
                snapshot = json.loads(raw.decode("utf8"))
                if time_unreliable_or_expired():
                    raise TimeoutError("step exceeded budget or timing source degraded")
                total_result_bytes += len(raw)
                results[step["id"]] = snapshot
                events.append({"step": step["id"], "tool": step["tool"],
                               "attempt": attempt + 1, "outcome": "OK",
                               "result_sha256": hashlib.sha256(raw).hexdigest()})
                break
            except Exception:
                events.append({"step": step["id"], "tool": step["tool"],
                               "attempt": attempt + 1, "outcome": "DEGRADED"})
                if attempt >= step["retries"] or time_unreliable_or_expired():
                    return {"status": "DEGRADED",
                            "reason": "read-only step failed, MLRO follow-up required",
                            "authorized_for_action": False, "events": events,
                            "results": results}
    return {"status": "REVIEW_REQUIRED", "reason": "no automated regulatory decision",
            "authorized_for_action": False, "events": events, "results": results}
