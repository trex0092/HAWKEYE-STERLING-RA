#!/usr/bin/env python3
"""Fail-closed validation for a PRIVATE, operator-supplied transaction export.

This module does not fetch bank/ERP data, retain customer data or create an
account. The source owner must first approve and provide a private export and
an independently generated completeness manifest. No real transaction data
may be committed to this public repository.
"""
import datetime
import hashlib
import json
import math
import os
import re


MAX_FEED_BYTES = 50 * 1024 * 1024
MAX_TRANSACTIONS = 100000
REQUIRED = ("customer", "date", "amount", "direction", "method")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class FeedValidationError(ValueError):
    """No transaction values or customer identifiers appear in error messages."""


def _fail(detail):
    raise FeedValidationError(detail)


def _json_bytes(path, limit):
    if not path or not os.path.isfile(path):
        _fail("feed or manifest missing; no all-clear permitted")
    try:
        size = os.path.getsize(path)
        if size < 1 or size > limit:
            _fail("feed or manifest exceeds the permitted size")
        with open(path, "rb") as handle:
            raw = handle.read(limit + 1)
        if len(raw) != size or len(raw) > limit:
            _fail("feed or manifest changed during read")
        data = json.loads(raw.decode("utf-8"),
                          parse_constant=lambda _value: _fail("non-finite JSON number"))
    except (OSError, ValueError, UnicodeError) as exc:
        if isinstance(exc, FeedValidationError):
            raise
        _fail("invalid or inaccessible transaction JSON")
    return raw, data


def _date(value, label):
    if not isinstance(value, str) or not DATE_RE.fullmatch(value):
        _fail(label + ": date must be YYYY-MM-DD")
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        _fail(label + ": invalid calendar date")


def _string(value, label, cap=512):
    if not isinstance(value, str) or not value.strip() or len(value) > cap:
        _fail(label + ": required nonempty bounded string")
    return value.strip()


def validate_batch(records, manifest):
    """Validate a complete, bounded batch without skipping invalid rows.

    The manifest must come from the trusted export producer, not from the
    consuming script. SHA-256 proves the file matches that manifest; it does
    not by itself authenticate the producer. Validate the producer separately.
    """
    if not isinstance(records, list) or len(records) > MAX_TRANSACTIONS:
        _fail("transaction feed is not a bounded list")
    if not isinstance(manifest, dict) or manifest.get("schema") != "hawkeye.txn-manifest/v1":
        _fail("unrecognized completeness manifest")
    if manifest.get("complete") is not True:
        _fail("manifest does not attest a complete export")
    count = manifest.get("record_count")
    if type(count) is not int or count != len(records):
        _fail("manifest transaction count mismatch")
    start = _date(manifest.get("window_start"), "manifest.window_start")
    end = _date(manifest.get("window_end"), "manifest.window_end")
    if start > end:
        _fail("manifest window is reversed")
    _string(manifest.get("source_id"), "manifest.source_id", 120)
    digest = manifest.get("sha256")
    if not isinstance(digest, str) or not SHA256_RE.fullmatch(digest):
        _fail("manifest requires the raw feed SHA-256 digest")

    ids = set()
    for number, record in enumerate(records, 1):
        prefix = "transaction #" + str(number)
        if not isinstance(record, dict):
            _fail(prefix + ": object required")
        if any(k not in record for k in REQUIRED):
            _fail(prefix + ": missing mandatory field")
        _string(record["customer"], prefix + ".customer")
        when = _date(record["date"], prefix + ".date")
        if when < start or when > end:
            _fail(prefix + ": outside manifest date window")
        value = record["amount"]
        if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
            _fail(prefix + ": amount must be a finite nonnegative number")
        if record["direction"] not in ("in", "out"):
            _fail(prefix + ": invalid direction")
        _string(record["method"], prefix + ".method", 40)
        if record.get("currency", "AED") != "AED":
            _fail(prefix + ": convert to AED with an approved documented rate before ingestion")
        txid = _string(record.get("transaction_id"), prefix + ".transaction_id", 128)
        if txid in ids:
            _fail(prefix + ": duplicate transaction_id")
        ids.add(txid)
        for key in ("counterparty", "counterparty_country", "remittance_info"):
            if key in record and (not isinstance(record[key], str) or len(record[key]) > 4096):
                _fail(prefix + ": malformed " + key)
    return records


def read_validated_feed(feed_path, manifest_path=None):
    """Require independent completeness evidence for every configured live feed."""
    raw, records = _json_bytes(feed_path, MAX_FEED_BYTES)
    _, manifest = _json_bytes(manifest_path, 16384)
    validate_batch(records, manifest)
    if hashlib.sha256(raw).hexdigest() != manifest["sha256"]:
        _fail("manifest digest mismatch; batch must not be screened")
    return records


def validation_summary(feed_path, manifest_path):
    """Metadata only, safe for CI logs; no customer or transaction content."""
    rows = read_validated_feed(feed_path, manifest_path)
    _, manifest = _json_bytes(manifest_path, 16384)
    return {"validated": True, "records": len(rows),
            "source_id": manifest["source_id"],
            "window_start": manifest["window_start"],
            "window_end": manifest["window_end"],
            "sha256": manifest["sha256"]}
