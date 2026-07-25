# Property-based fuzzing of the screening engine's text-normalisation layer
# (hypothesis). These functions sit in front of every sanctions/adverse-media
# match, and they ingest fully untrusted text (news headlines, list entries,
# customer names in any script) — so the invariants below must hold for
# ARBITRARY unicode, not just the fixtures the unit suites use:
#
#   normalize            — idempotent, closed over [A-Z0-9 ], trim/collapse,
#                          casing-insensitive, never raises
#   _latin_fold          — no combining marks survive, output is its own
#                          lowercase, never raises
#   _normalize_ar        — idempotent, a no-op on plain ASCII, never raises
#   match_adverse_keywords — total (never raises), deterministic, duplicate-free,
#                          and always finds a planted English keyword
#   sha256_of            — 64-char lowercase hex, deterministic
#
# derandomize=True keeps CI stable (no flaky example generation); bump
# max_examples locally for deeper fuzzing.
# Usage: python test/fuzz_properties.py
import os
import sys
import unicodedata

os.environ.setdefault("ASANA_TOKEN", "dummy")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Runs in ci.yml's dedicated `fuzz` job, which installs the hash-locked
# ci/requirements.txt (hypothesis included) — unlike the blocked-egress `test`
# job, whose Python suites deliberately run against stubs. Importing the real
# engine here means the properties exercise the real rapidfuzz-backed paths.
import screen

from hypothesis import given, settings, strategies as st

passed = 0
failed = 0


def check(name, fn):
    global passed, failed
    try:
        fn()
        passed += 1
        print("  ok  " + name)
    except BaseException as e:  # hypothesis raises falsifying examples as errors
        failed += 1
        print("FAIL  " + name + " — " + str(e).splitlines()[0][:200])


TEXT = st.text(max_size=200)
PROP = settings(derandomize=True, max_examples=150, deadline=None)


@PROP
@given(TEXT)
def prop_normalize_idempotent(s):
    once = screen.normalize(s)
    assert screen.normalize(once) == once


@PROP
@given(TEXT)
def prop_normalize_alphabet(s):
    out = screen.normalize(s)
    assert isinstance(out, str)
    assert all(c.isascii() and (c.isupper() or c.isdigit() or c == " ") for c in out)
    assert out == out.strip()
    assert "  " not in out


@PROP
@given(TEXT)
def prop_normalize_case_insensitive(s):
    assert screen.normalize(s) == screen.normalize(s.lower())


@PROP
@given(TEXT)
def prop_latin_fold_structure(s):
    out = screen._latin_fold(s)
    assert out == out.lower()
    assert not any(unicodedata.category(c) == "Mn" for c in out)


@PROP
@given(TEXT)
def prop_normalize_ar_idempotent(s):
    once = screen._normalize_ar(s)
    assert screen._normalize_ar(once) == once


@PROP
@given(st.text(alphabet=st.characters(max_codepoint=127), max_size=200))
def prop_normalize_ar_ascii_noop(s):
    assert screen._normalize_ar(s) == unicodedata.normalize("NFC", s)


@PROP
@given(TEXT)
def prop_match_keywords_total_and_stable(s):
    first = screen.match_adverse_keywords(s)
    assert isinstance(first, list)
    assert len(first) == len(set(first))          # no duplicates
    assert first == screen.match_adverse_keywords(s)  # deterministic


@PROP
@given(st.sampled_from(sorted(screen.ADVERSE_KEYWORDS)), TEXT)
def prop_match_keywords_finds_planted_term(kw, noise):
    title = noise + " " + kw + " " + noise
    assert kw in screen.match_adverse_keywords(title)


@PROP
@given(st.binary(max_size=512))
def prop_sha256_shape(data):
    out = screen.sha256_of(data)
    assert len(out) == 64 and all(c in "0123456789abcdef" for c in out)
    assert out == screen.sha256_of(data)



# ── match-blocking equivalence (real rapidfuzz C prefilter) ──────────────────
# screen_name's C-side prefilter (rapidfuzz.process.extract with the THRESHOLD
# and TOKENSET_THRESHOLD cutoffs) may only ever SKIP pairs that could never
# hit; results must be bit-identical with blocking on or off. The engine unit
# suite runs under the offline rapidfuzz stub where the prefilter is inert, so
# THIS suite — importing the real dependency stack — is where the equivalence
# is proven. The token pool is built for collisions: shared given names and
# transliteration variants (subset/patronymic chains), legal-form boilerplate
# (core-vs-full divergence), and short designated names (near-exact gate).
_NAME_TOKEN = st.sampled_from([
    "mohammed", "muhammad", "mohamed", "abdul", "abdel", "bin", "ibn", "al",
    "rashid", "hussain", "usama", "ladin", "awad", "karim", "trading",
    "general", "llc", "dmcc", "fze", "holdings", "international", "quds",
    "force", "hamas", "ano", "irisl", "x", "petro", "pars",
])
_NAME = st.lists(_NAME_TOKEN, min_size=1, max_size=6).map(" ".join)


@PROP
@given(st.lists(_NAME, min_size=1, max_size=12), st.lists(_NAME, min_size=1, max_size=6))
def prop_blocking_equivalence(entry_names, subject_names):
    lists = {"P": [(screen.normalize(e), e) for e in entry_names]}
    orig = screen.MATCH_BLOCKING
    try:
        screen.MATCH_BLOCKING = False
        base = [screen.screen_name(s, lists) for s in subject_names]
        screen.MATCH_BLOCKING = True
        fast = [screen.screen_name(s, lists) for s in subject_names]
    finally:
        screen.MATCH_BLOCKING = orig
    assert base == fast





check("normalize is idempotent on arbitrary unicode", prop_normalize_idempotent)
check("normalize output is closed over [A-Z0-9 ], trimmed, single-spaced", prop_normalize_alphabet)
check("normalize is casing-insensitive", prop_normalize_case_insensitive)
check("_latin_fold output is lowercase with no combining marks", prop_latin_fold_structure)
check("_normalize_ar is idempotent", prop_normalize_ar_idempotent)
check("_normalize_ar is an NFC no-op on ASCII", prop_normalize_ar_ascii_noop)
check("match_adverse_keywords is total, deterministic and duplicate-free", prop_match_keywords_total_and_stable)
check("match_adverse_keywords always finds a planted English keyword", prop_match_keywords_finds_planted_term)
check("sha256_of yields stable 64-char lowercase hex", prop_sha256_shape)
check("match blocking on/off is result-identical under real rapidfuzz", prop_blocking_equivalence)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
