#!/usr/bin/env python3
"""
HAWKEYE STERLING - normalized document-evidence comparison (offline, opt-in).

This module does NOT perform OCR, verify document authenticity, establish identity,
or change a KYC record. It accepts a deliberately narrow normalized text contract,
NOT vendor-native JSON, image bytes, base64 images or file paths. A licensed OCR
processor can be mapped into the contract later, after supplier and DPIA approval.

All findings are decision-support for an MLRO. Outputs and errors contain no
supplied name, DOB, ID number or extracted field value.
"""
import datetime
import re
import unicodedata

import kyc

EVIDENCE_SCHEMA = "hawkeye.document-evidence/v1"
COMPARISON_SCHEMA = "hawkeye.document-comparison/v1"
DOCUMENT_TYPES = {"passport", "emirates_id", "other_id", "unknown"}
FIELD_NAMES = {
    "full_name", "date_of_birth", "document_number", "expiry_date",
    "nationality", "issuing_country",
}
_REQUIRED = {
    "schema_version", "evidence_id", "source", "document_type",
    "extraction_status", "fields",
}
_PLACEHOLDERS = {"", "NA", "N/A", "PENDING", "-", "—", "–", "UNKNOWN", "NOT AVAILABLE"}


def _text(value, label, *, required=False, cap=256):
    if not isinstance(value, str):
        raise ValueError(f"'{label}' must be a string")
    if len(value) > cap or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise ValueError(f"'{label}' is too long or contains control characters")
    value = value.strip()
    if required and not value:
        raise ValueError(f"'{label}' must not be empty")
    return value


def _present(value):
    return str(value or "").strip().upper() not in _PLACEHOLDERS


def _normal_text(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(c for c in value if not unicodedata.combining(c))
    return " ".join("".join(c if c.isalnum() else " " for c in value.casefold()).split())


def _normal_id(value):
    return "".join(
        c for c in unicodedata.normalize("NFKC", str(value or "")).casefold()
        if c.isalnum()
    )


def parse_as_of(as_of=None):
    """Accept only an ISO calendar date; omitted means current local date."""
    if as_of is None:
        return datetime.date.today()
    if not isinstance(as_of, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", as_of):
        raise ValueError("'as_of' must be YYYY-MM-DD")
    try:
        return datetime.date.fromisoformat(as_of)
    except ValueError:
        raise ValueError("'as_of' must be a valid calendar date") from None


def validate_evidence(evidence):
    """Validate, cap and allowlist fields before anything reaches comparison."""
    if not isinstance(evidence, dict):
        raise ValueError("'evidence' must be an object")
    if set(evidence) != _REQUIRED:
        raise ValueError("'evidence' must contain exactly the documented schema keys")
    if evidence["schema_version"] != EVIDENCE_SCHEMA:
        raise ValueError("unsupported document evidence schema")
    ref = _text(evidence["evidence_id"], "evidence_id", required=True, cap=128)
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9:._/-]{7,127}", ref):
        raise ValueError("'evidence_id' must be an opaque 8-128 character reference")
    source = _text(evidence["source"], "source", required=True, cap=64)
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]{0,63}", source):
        raise ValueError("'source' must be a short processor label")
    kind = _text(evidence["document_type"], "document_type", required=True)
    if kind not in DOCUMENT_TYPES:
        raise ValueError("unsupported document_type")
    status = _text(evidence["extraction_status"], "extraction_status", required=True)
    if status not in {"extracted", "failed"}:
        raise ValueError("extraction_status must be 'extracted' or 'failed'")
    raw_fields = evidence["fields"]
    if not isinstance(raw_fields, dict) or not set(raw_fields) <= FIELD_NAMES:
        raise ValueError("'fields' must be an object with supported document field names only")
    fields = {name: _text(value, f"fields.{name}") for name, value in raw_fields.items()}
    if status == "failed" and any(_present(v) for v in fields.values()):
        raise ValueError("failed extraction must not contain extracted fields")
    if status == "extracted" and not any(_present(v) for v in fields.values()):
        raise ValueError("successful extraction requires at least one nonempty field")
    return {
        "evidence_id": ref,
        "source": source,
        "document_type": kind,
        "extraction_status": status,
        "fields": fields,
    }


def _compare(field, extracted, recorded, *, mode="text"):
    """Report only a status code, never the supplied field values."""
    if recorded is None:
        status = "NOT_COMPARABLE"
    elif not _present(extracted) and not _present(recorded):
        status = "MISSING_BOTH"
    elif not _present(extracted):
        status = "MISSING_DOCUMENT_FIELD"
    elif not _present(recorded):
        status = "MISSING_KYC_FIELD"
    elif mode == "date":
        doc_date = kyc.parse_date(extracted)
        kyc_date = kyc.parse_date(recorded)
        if doc_date is None:
            status = "UNREADABLE_DOCUMENT_DATE"
        elif kyc_date is None:
            status = "UNREADABLE_KYC_DATE"
        else:
            status = "MATCH" if doc_date == kyc_date else "MISMATCH"
    else:
        norm = _normal_id if mode == "id" else _normal_text
        status = "MATCH" if norm(extracted) == norm(recorded) else "MISMATCH"
    return {"field": field, "result": status}


def compare_evidence(evidence, person, *, person_index=0, as_of=None):
    """Compare one source's extracted fields to ONE explicitly selected KYC party.

    No match is proof of identity or authenticity. Missing/invalid values are
    inconclusive and never treated as matching. Original CDD gaps remain open.
    """
    data = validate_evidence(evidence)
    if not isinstance(person, dict):
        raise ValueError("'person' must be a KYC identity record")
    if type(person_index) is not int or person_index < 0:
        raise ValueError("'person_index' must be a nonnegative integer")
    reference_date = parse_as_of(as_of)
    fields = data["fields"]
    comparisons = []
    expiry_state = "UNKNOWN"

    if data["extraction_status"] == "extracted":
        kind = data["document_type"]
        if kind == "passport":
            kyc_number, kyc_expiry = person.get("id_number", ""), person.get("passport_expiry", "")
        elif kind == "emirates_id":
            kyc_number, kyc_expiry = person.get("emirates_id", ""), person.get("eid_expiry", "")
        else:
            # No evidence that an unrelated ID type maps to a passport or EID.
            kyc_number, kyc_expiry = None, None

        comparisons = [
            _compare("full_name", fields.get("full_name"), person.get("name", "")),
            _compare("date_of_birth", fields.get("date_of_birth"), person.get("dob", ""), mode="date"),
            _compare("nationality", fields.get("nationality"), person.get("nationality", "")),
            _compare("document_number", fields.get("document_number"), kyc_number, mode="id"),
            _compare("expiry_date", fields.get("expiry_date"), kyc_expiry, mode="date"),
        ]
        raw_expiry = fields.get("expiry_date")
        if _present(raw_expiry):
            expiry = kyc.parse_date(raw_expiry)
            if expiry is None:
                expiry_state = "UNREADABLE"
            elif expiry <= reference_date:
                expiry_state = "EXPIRED"
            else:
                expiry_state = "NOT_EXPIRED"

    matches = sum(row["result"] == "MATCH" for row in comparisons)
    mismatches = sum(row["result"] == "MISMATCH" for row in comparisons)
    unresolved = len(comparisons) - matches - mismatches
    if data["extraction_status"] == "failed":
        outcome = "EXTRACTION_FAILED"
    elif mismatches or expiry_state == "EXPIRED":
        outcome = "DISCREPANCY_FOUND"
    elif unresolved or expiry_state == "UNREADABLE":
        outcome = "INCONCLUSIVE"
    else:
        outcome = "NO_DISCREPANCY_DETECTED"

    return {
        "schema_version": COMPARISON_SCHEMA,
        "evidence_id": data["evidence_id"],
        "source": data["source"],
        "document_type": data["document_type"],
        "extraction_status": data["extraction_status"],
        "person_index": person_index,
        "as_of": reference_date.isoformat(),
        "outcome": outcome,
        "comparisons": comparisons,
        "match_count": matches,
        "mismatch_count": mismatches,
        "unresolved_count": unresolved,
        "expiry_state": expiry_state,
        "open_cdd_gap_count": len(person.get("cdd_gaps", [])),
        "identity_verified": False,
        "document_authenticity_verified": False,
        "cdd_gaps_cleared": False,
        "human_review_required": True,
        "note": (
            "Untrusted extracted text, not proof of identity or authenticity. "
            "Existing CDD gaps remain open; an authorised human reviewer must decide."
        ),
    }
