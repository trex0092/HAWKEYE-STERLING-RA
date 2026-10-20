#!/usr/bin/env python3
"""Static guard for mandatory employee screening.

Behavioral coverage is exercised independently by test/engine_test.py.
This guard catches missing source wiring and removed staff-specific branches
without requiring production credentials.
"""
from pathlib import Path

source = (Path(__file__).resolve().parents[1] / "screen.py").read_text(encoding="utf-8")
builder = source.split("def build_screening_subjects(customers):", 1)[1].split(
    "\ndef screen_customers(", 1)[0]
matcher = source.split("def screen_customers(customers, all_lists):", 1)[1].split(
    "\n# ── DELTA ENGINE", 1)[0]
assert 'employee = c.get("kind") == "employee"' in builder, "staff classification missing"
assert 'if not employee:' in builder, "HR staff counted as companies"
assert 'subjects.append(("COMPANY", c["name"], None, c))' in builder
assert 'for person in screening_individuals(c):' in builder, "employee name may be omitted"
assert 'None if employee else c["name"]' in builder, "HR staff given fictitious parent company"
assert 'subjects.append(("ENTITY (owner)", owner, c["name"], c))' in builder
assert 'subjects_all = build_screening_subjects(customers)' in source, "shared population builder unused"
assert 'build_screening_subjects([c])' in matcher, "sanctions matcher uses different classification"
assert 'linkage = bool(parent) and subject_type != "COMPANY"' in matcher, (
    "employee match misclassified as owner")
print("PASS: HR employee classification guards present")
