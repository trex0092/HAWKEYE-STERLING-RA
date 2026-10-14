#!/usr/bin/env python3
"""Fail if the Python screening engine treats HR employees as corporate subjects."""
from pathlib import Path

source = (Path(__file__).resolve().parents[1] / "screen.py").read_text(encoding="utf-8")
assert 'if c.get("kind") != "employee":' in source, "HR employees still counted as companies"
assert 'control_linkage": not staff' in source, "HR staff still treated as linked corporate owners"
print("PASS: HR employees are natural-person screening subjects")
