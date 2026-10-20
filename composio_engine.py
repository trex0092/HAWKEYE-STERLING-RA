#!/usr/bin/env python3
"""Offline Composio-to-HAWKEYE evidence coverage gate.

A trusted operator may normalize metadata from approved Composio read-only
queries into this tiny contract. No network, Composio credentials, provider
payload, document text, customer PII or model tools reach this module.
An observed record's existence is NOT verification, CDD completion, PEP
status, sanctions clearance, or MLRO approval.

The production source's authenticity, access control and Composio connected
account/user association must be verified OUTSIDE this deterministic engine.
"""
import datetime
import re

SCHEMA = "hawkeye.composio-evidence/v1"
MAX_OBSERVATIONS = 60
MAX_CHECKS = 16

# Deliberately narrow: source-specific metadata facts with independent
# compliance relevance. No content, email bodies, files, message snippets,
# personal names, passports, IDs, provider JSON, or decision authority.
CHECK_CATALOG = {
    "asana.kyc_case": "KYC/CDD case record exists in the approved Asana system",
    "asana.remediation": "CDD evidence-request/remediation task can be located",
    "asana.mlro_case": "MLRO-review case can be located (not an approval)",
    "gmail.evidence_request": "Compliance evidence-request correspondence is referenced",
    "gmail.compliance_response": "Compliance response correspondence is referenced",
    "googledrive.policy": "Governed policy file has a reference (not its content)",
    "googledrive.provenance": "Gold/supply-chain provenance file is referenced",
    "googledrive.identity_file": "KYC identity-document file reference exists (NOT verified)",
    "slack.review_thread": "Review discussion reference exists (NOT an MLRO approval)",
    "slack.escalation_thread": "Escalation discussion reference exists (NOT a filing)",
    "github.control_change": "Governed control-change reference exists",
    "github.ci_result": "CI/control assurance run is referenced",
    "github.deploy_record": "Release/deployment record is referenced (NOT live-site proof)",
}
STATUSES = frozenset(("available", "not_found", "unavailable", "error"))
_STATES = {
    "available": "REFERENCED_NOT_VERIFIED",
    "not_found": "NO_REFERENCE_FOUND",
    "unavailable": "SOURCE_UNAVAILABLE",
    "error": "SOURCE_ERROR",
}
_REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9:_./-]{7,127}\Z")
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}\Z")


def _date(value, field):
    if not isinstance(value, str) or not _DATE.fullmatch(value):
        raise ValueError(f"'{field}' must be an ISO date YYYY-MM-DD")
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"'{field}' must be a valid calendar date") from None


def _check(code):
    if not isinstance(code, str) or code not in CHECK_CATALOG:
        raise ValueError("unsupported connected-evidence check")
    return code


def assess_manifest(manifest):
    """Report how well specifically requested evidence REFERENCES are covered.

    Fails closed on malformed/unrequested metadata, duplicate observations,
    stale checks, unavailable sources and missing material. An operator must
    validate original source content separately and record any legal signoff.
    The response never echoes provider references or customer data.
    """
    if not isinstance(manifest, dict) or set(manifest) != {
        "schema_version", "requirements", "observations", "as_of", "freshness_days"
    }:
        raise ValueError("manifest must contain exactly the documented metadata keys")
    if manifest["schema_version"] != SCHEMA:
        raise ValueError("unsupported connected-evidence schema")

    as_of = _date(manifest["as_of"], "as_of")
    freshness = manifest["freshness_days"]
    if type(freshness) is not int or not 1 <= freshness <= 365:
        raise ValueError("'freshness_days' must be an integer from 1 to 365")

    requested = manifest["requirements"]
    if not isinstance(requested, list) or not 1 <= len(requested) <= MAX_CHECKS:
        raise ValueError("'requirements' must have 1 to 16 known checks")
    checks = [_check(x) for x in requested]
    if len(set(checks)) != len(checks):
        raise ValueError("'requirements' contains a duplicate check")

    observations = manifest["observations"]
    if not isinstance(observations, list) or len(observations) > MAX_OBSERVATIONS:
        raise ValueError("'observations' must have at most 60 entries")

    seen = {}
    for index, observation in enumerate(observations):
        if not isinstance(observation, dict) or set(observation) != {
            "check", "status", "checked_at", "reference"
        }:
            raise ValueError("observation must contain only check/status/checked_at/reference")
        code = _check(observation["check"])
        if code not in checks:
            raise ValueError("observation was not requested in the manifest")
        status = observation["status"]
        if not isinstance(status, str) or status not in STATUSES:
            raise ValueError("unsupported observation status")
        date = _date(observation["checked_at"], "checked_at")
        if date > as_of:
            raise ValueError("observation cannot be from the future")
        reference = observation["reference"]
        if status == "available":
            if not isinstance(reference, str) or not _REF.fullmatch(reference):
                raise ValueError("available evidence must have an opaque 8-128 character reference")
        elif reference is not None:
            raise ValueError("unsuccessful observations must have a null reference")
        # Keep only status and date, never copy a confidential reference to
        # the output or an exception/log message.
        seen.setdefault(code, []).append((status, date))

    rows = []
    counts = {
        "REFERENCED_NOT_VERIFIED": 0,
        "STALE_OBSERVATION": 0,
        "NO_REFERENCE_FOUND": 0,
        "SOURCE_UNAVAILABLE": 0,
        "SOURCE_ERROR": 0,
        "NOT_CHECKED": 0,
        "MULTIPLE_OBSERVATIONS": 0,
    }
    for code in checks:
        items = seen.get(code, [])
        if not items:
            state = "NOT_CHECKED"
        elif len(items) != 1:
            # Multiple reads may disagree or reflect different provider
            # accounts. Never select a favorable one automatically.
            state = "MULTIPLE_OBSERVATIONS"
        else:
            status, checked_at = items[0]
            state = ("STALE_OBSERVATION" if (as_of - checked_at).days > freshness
                     else _STATES[status])
        counts[state] += 1
        rows.append({
            "check": code,
            "source": code.split(".", 1)[0],
            "state": state,
            "human_review_required": True,
        })

    return {
        "schema_version": SCHEMA,
        "as_of": as_of.isoformat(),
        "freshness_days": freshness,
        "required_count": len(checks),
        "observations_received": len(observations),
        "reference_count": counts["REFERENCED_NOT_VERIFIED"],
        "unresolved_count": len(checks) - counts["REFERENCED_NOT_VERIFIED"],
        "coverage": rows,
        "state_counts": counts,
        "all_references_located": counts["REFERENCED_NOT_VERIFIED"] == len(checks),
        "identity_verified": False,
        "source_content_verified": False,
        "sanctions_clearance": False,
        "mlro_approval_granted": False,
        "cdd_gaps_cleared": False,
        "human_review_required": True,
        "note": (
            "Only operator-supplied Composio evidence METADATA was checked. "
            "References and source status are untrusted until checked by an "
            "authorised human. No document authenticity, CDD completion, "
            "sanctions/PEP outcome, case disposition or filing follows."
        ),
    }
