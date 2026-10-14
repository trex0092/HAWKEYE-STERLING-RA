#!/usr/bin/env python3
"""Static guard that complements behavioral tests in test/engine_test.py."""
from pathlib import Path

source = (Path(__file__).resolve().parents[1] / "screen.py").read_text(encoding="utf-8")
assert 'def build_screening_subjects(customers):' in source
assert 'if record.get("kind") != "employee":' in source, "HR staff counted as companies"
assert 'subjects_all = build_screening_subjects(customers)' in source, "shared population builder unused"
assert 'control_linkage": not is_employee' in source, "employee match misclassified as owner"
assert 'for ind in screening_individuals(c):' in source, "employee name may be omitted"
print("PASS: HR employee classification guards present")
