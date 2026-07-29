#!/usr/bin/env python3
"""
Cross-engine parity probe — the screen.py half of test/matcher-parity.test.mjs.

The sanctions matcher exists twice: screen.py (Python, rapidfuzz) and
scripts/sanctions-match.mjs (a zero-dependency JS reimplementation that runs the
live screen in .github/workflows/sanctions-screen.yml). Parity between them has
historically been maintained by hand, via "mirrors screen.py" comments — and has
twice failed silently, each time as a FALSE NEGATIVE on the JS side:

  * Turkish dotless "ı" was not folded, so "Kılıç" and "Kilic" normalized apart
    (fixed in sanctions-match.mjs normalizeName).
  * Two-letter name tokens were dropped from the candidate index, so a
    mixed-length transliterated name ("Yu Li Pang" vs listed "YU LI PING")
    had no candidate path and cleared, while screen.py scored it 90
    (fixed in sanctions-match.mjs sigTokens).

Both were invisible to the accuracy benchmarks, because each engine is measured
against its OWN per-backend floor — test/benchmark_eval.py says so outright:
"every floor is enforced per backend — the two are NOT comparable." Nothing
compared the engines to EACH OTHER. This probe closes that.

It emits, as JSON on stdout, the screen.py value of each parity primitive for
every name handed to it, so the JS side can diff them.

Usage: echo '["name one","name two"]' | python3 scripts/matcher-parity-probe.py

Offline and side-effect free: pdfplumber and requests are stubbed (never
imported for real, never a network call), and rapidfuzz is stubbed with the same
difflib stand-in test/engine_test.py uses when it is not installed — the
primitives emitted here are pure string transforms that never call the fuzzy
scorer, so the stub cannot change a single value in the output.
"""
import difflib
import json
import os
import sys
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# ── stub runtime-only deps so the probe never touches the network or a PDF ────
sys.modules.setdefault("pdfplumber", types.ModuleType("pdfplumber"))
_requests = types.ModuleType("requests")
_requests.utils = types.SimpleNamespace(quote=lambda s: s)
_requests.get = lambda *a, **k: None
_requests.post = lambda *a, **k: None
sys.modules.setdefault("requests", _requests)

try:  # production path — the real scorer, when it is installed
    import rapidfuzz  # noqa: F401
except ImportError:  # offline path — identical primitives, stubbed scorer
    def _tsr(a, b):
        a = " ".join(sorted(a.split()))
        b = " ".join(sorted(b.split()))
        return difflib.SequenceMatcher(None, a, b).ratio() * 100

    _rf = types.ModuleType("rapidfuzz")
    _rf.fuzz = types.SimpleNamespace(token_sort_ratio=_tsr, token_set_ratio=_tsr)
    sys.modules["rapidfuzz"] = _rf

# screen.py reads this at module import time (see PR3 / open-actions on the
# ASANA_TOKEN vs ASANA_ACCESS_TOKEN split); the probe makes no Asana call.
os.environ.setdefault("ASANA_TOKEN", "matcher-parity-probe")
os.environ.pop("ANTHROPIC_API_KEY", None)

import screen  # noqa: E402  (must follow the stubs above)


def probe(name):
    """The four primitives the JS engine mirrors, for one raw subject name."""
    norm = screen.normalize(name)
    return {
        "norm": norm,
        "lost": screen._lost_script_letters(name),
        "core": screen.core_tokens(norm),
        "phon": [screen.phonetic_key(t) for t in screen.phonetic_tokens(norm)],
    }


def screen_pair(subject, listed):
    """Screen one subject against a one-entry list. Returns whether screen.py
    reaches a hit, and its top score. The score is backend-dependent (rapidfuzz
    vs the difflib stub) and is reported for diagnostics only — the parity test
    asserts on `hit`, never on the number."""
    all_lists = {"PARITY": [(screen.normalize(listed), listed)]}
    hits = screen.screen_name(subject, all_lists)
    return {
        "hit": bool(hits),
        "score": round(max((h["score"] for h in hits), default=0)),
    }


def main():
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"matcher-parity-probe: stdin is not valid JSON ({exc})", file=sys.stderr)
        return 2
    # Accept a bare array (names only) or {"names": [...], "pairs": [...]}.
    if isinstance(payload, list):
        payload = {"names": payload, "pairs": []}
    if not isinstance(payload, dict):
        print("matcher-parity-probe: expected a JSON array or object", file=sys.stderr)
        return 2

    names = payload.get("names") or []
    pairs = payload.get("pairs") or []
    out = {
        "backend": "py_rapidfuzz" if "rapidfuzz" in sys.modules
        and getattr(sys.modules["rapidfuzz"], "__file__", None) else "py_difflib",
        "names": {n: probe(n) for n in names},
        "pairs": [screen_pair(p["subject"], p["listed"]) for p in pairs],
    }
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
