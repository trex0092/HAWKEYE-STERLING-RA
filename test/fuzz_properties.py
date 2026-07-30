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
    # phonetic-fold drift pool: multi-edit romanization variants that only the
    # phonetic branch can link — with these in the pool, the blocking
    # equivalence property below also proves the phonetic candidate index is
    # recall-complete (a phonetic-only pair missed in blocked mode would
    # diverge from the unblocked loop and fail the property).
    "muhamet", "huseinn", "hussein", "putin", "putyn", "vladimyr", "vladimir",
    "khalifa", "subaey", "subaiy", "turki", "gadafi", "qadhafi", "abou", "bakr",
    # NEAR-MISSES of the short designations above. Without these the sensitive
    # short-entry property below is VACUOUS: at a lowered threshold the gap only
    # opens for a pair that ALMOST matches a short name (scoring 80-84, under
    # both prefilter cutoffs), and a pool of exact tokens only ever generates
    # exact matches, which the prefilter surfaces anyway. Measured: the property
    # passed with the guard removed until these were added.
    "hamaz", "hamasxy", "irisi", "maham", "anno",
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


@PROP
@given(st.lists(_NAME, min_size=1, max_size=12), st.lists(_NAME, min_size=1, max_size=6))
def prop_blocking_equivalence_sensitive_short_entry(entry_names, subject_names):
    # The same equivalence, but with the documented MORE-SENSITIVE short-name
    # challenger active. The prefilter's cutoffs (THRESHOLD, TOKENSET_THRESHOLD)
    # are necessary conditions of the hit gates only while SHORT_ENTRY_THRESHOLD
    # sits at or above them — an ordering that was asserted in a comment and
    # enforced nowhere, while LOWERING that knob needs no override at all. At
    # MATCH_SHORT_ENTRY_THRESHOLD=80 blocked mode returned NO hit for customer
    # "HAMAZ" against designated "HAMAS" where unblocked returned one: making the
    # matcher more sensitive silently created a false negative. The engine now
    # declines the prefilter when it cannot bound the gate, and this property is
    # what proves it — the pool carries the short designations (hamas, ano,
    # irisl) that exercise exactly this path.
    lists = {"P": [(screen.normalize(e), e) for e in entry_names]}
    orig_thr, orig_blocking = screen.SHORT_ENTRY_THRESHOLD, screen.MATCH_BLOCKING
    try:
        screen.SHORT_ENTRY_THRESHOLD = 80
        screen.MATCH_BLOCKING = False
        base = [screen.screen_name(s, lists) for s in subject_names]
        screen.MATCH_BLOCKING = True
        fast = [screen.screen_name(s, lists) for s in subject_names]
    finally:
        screen.SHORT_ENTRY_THRESHOLD, screen.MATCH_BLOCKING = orig_thr, orig_blocking
    assert base == fast


def prop_blocking_equivalence_known_sensitive_pairs():
    """The measured regression, pinned deterministically. The randomized property
    above only catches this if the generator happens to draw a near-miss of a
    short designation, so these exact pairs — the ones observed diverging with
    real rapidfuzz at MATCH_SHORT_ENTRY_THRESHOLD=80 — are asserted outright."""
    lists = {"P": [(screen.normalize(e), e) for e in ("HAMAS", "IRISL", "MAHAN", "ANO")]}
    orig_thr, orig_blocking = screen.SHORT_ENTRY_THRESHOLD, screen.MATCH_BLOCKING
    try:
        screen.SHORT_ENTRY_THRESHOLD = 80
        for subj in ("HAMAZ", "HAMASXY", "IRISI", "MAHAM", "MAHAM GENERAL TRADING LLC"):
            screen.MATCH_BLOCKING = False
            base = screen.screen_name(subj, lists)
            screen.MATCH_BLOCKING = True
            fast = screen.screen_name(subj, lists)
            assert base == fast, (
                f"{subj!r}: blocking OFF found {len(base)} hit(s), blocking ON found "
                f"{len(fast)} — the production prefilter is dropping a pair the gate accepts")
    finally:
        screen.SHORT_ENTRY_THRESHOLD, screen.MATCH_BLOCKING = orig_thr, orig_blocking


@PROP
@given(st.lists(_NAME, min_size=1, max_size=10), st.lists(_NAME, min_size=1, max_size=5))
def prop_phonetic_additivity(entry_names, subject_names):
    # The phonetic branch is an elif behind the fuzzy gates: turning the layer
    # ON may only ADD hits — every layer-off hit must survive with an identical
    # score. A violation would mean the layer replaced or re-scored a fuzzy
    # hit, i.e. a recall-monotonicity break.
    lists = {"P": [(screen.normalize(e), e) for e in entry_names]}
    orig = os.environ.get("MATCH_PHONETIC")
    try:
        os.environ["MATCH_PHONETIC"] = "0"
        off = [screen.screen_name(s, lists) for s in subject_names]
        os.environ["MATCH_PHONETIC"] = "1"
        on = [screen.screen_name(s, lists) for s in subject_names]
    finally:
        if orig is None:
            os.environ.pop("MATCH_PHONETIC", None)
        else:
            os.environ["MATCH_PHONETIC"] = orig
    for base, wide in zip(off, on):
        got = {(h["list"], h["matched_entry"]): h["score"] for h in wide}
        for h in base:
            key = (h["list"], h["matched_entry"])
            assert key in got and got[key] == h["score"], (
                f"phonetic layer changed a fuzzy hit: {key} {h['score']} -> {got.get(key)}")


@PROP
@given(st.lists(_NAME, min_size=1, max_size=8), _NAME)
def prop_blocking_survives_inplace_list_growth(entry_names, late_entry):
    # An entries list that GROWS in place after already being screened must
    # still screen bit-identically with blocking on or off. Pre-guard, the
    # norms cache (keyed by list identity) served the stale norms, so the
    # prefilter never surveyed the appended designation — the blocked path
    # silently cleared a name the plain loop flags.
    lists = {"P": [(screen.normalize(e), e) for e in entry_names]}
    orig = screen.MATCH_BLOCKING
    try:
        screen.MATCH_BLOCKING = True
        screen.screen_name("warm cache subject", lists)   # populate _NORMS_CACHE
        lists["P"].append((screen.normalize(late_entry), late_entry))
        fast = screen.screen_name(late_entry, lists)
        screen.MATCH_BLOCKING = False
        base = screen.screen_name(late_entry, lists)
    finally:
        screen.MATCH_BLOCKING = orig
    assert base == fast





check("normalize is idempotent on arbitrary unicode", prop_normalize_idempotent)
check("normalize output is closed over [A-Z0-9 ], trimmed, single-spaced", prop_normalize_alphabet)
def _corpus_names():
    """Every string in the benchmark + parity fixtures, plus generated shapes."""
    import glob as _glob, json as _json
    seen = set()
    def walk(o):
        if isinstance(o, str):
            seen.add(o)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    for f in (_glob.glob("test/fixtures/screening-benchmark/*.json")
              + _glob.glob("test/fixtures/matcher-parity/*.json")):
        try:
            walk(_json.load(open(f, encoding="utf-8")))
        except Exception:
            pass
    seen |= {"", "  ", "Weiß", "Kılıç", "O'Brien & Sons", "123", "AL-QAEDA (AQ)",
             "ХАМАС", "محمد", "中国", "Ünal Öztürk", "N/A"}
    return seen


def prop_romanization_never_moves_an_existing_key():
    """Romanization must be ADDITIVE-ONLY.

    normalize() falls back to romanize() only when the Latin pipeline yields "".
    That is the whole safety argument for putting it there: every name that
    already had a non-empty key must keep exactly that key, so no existing
    match, score, delta fingerprint or dedup key can move. Only entries that
    previously matched NOTHING may become live.

    This property re-derives the ORIGINAL Latin-only pipeline independently and
    asserts byte equality wherever it produced anything."""
    import unicodedata as _ud, re as _re

    def original(name):
        if not name:
            return ""
        n = name.upper()
        n = _ud.normalize("NFD", n)
        n = "".join(c for c in n if _ud.category(c) != "Mn")
        n = _re.sub(r"[^A-Z0-9 ]", " ", n)
        return _re.sub(r"\s+", " ", n).strip()

    moved, rescued = [], 0
    for name in _corpus_names():
        old = original(name)
        new = screen.normalize(name)
        if old and new != old:
            moved.append((name, old, new))
        elif not old and new:
            rescued += 1
    assert not moved, f"romanization MOVED {len(moved)} existing key(s): {moved[:3]}"
    return f"{rescued} previously-dead key(s) rescued, 0 existing keys moved"

check("normalize is casing-insensitive", prop_normalize_case_insensitive)
check("_latin_fold output is lowercase with no combining marks", prop_latin_fold_structure)
check("_normalize_ar is idempotent", prop_normalize_ar_idempotent)
check("_normalize_ar is an NFC no-op on ASCII", prop_normalize_ar_ascii_noop)
check("match_adverse_keywords is total, deterministic and duplicate-free", prop_match_keywords_total_and_stable)
check("match_adverse_keywords always finds a planted English keyword", prop_match_keywords_finds_planted_term)
check("sha256_of yields stable 64-char lowercase hex", prop_sha256_shape)
check("match blocking on/off is result-identical under real rapidfuzz", prop_blocking_equivalence)
check("match blocking stays result-identical with a LOWERED short-entry threshold",
      prop_blocking_equivalence_sensitive_short_entry)
check("the measured lowered-threshold divergences stay fixed (deterministic pairs)",
      prop_blocking_equivalence_known_sensitive_pairs)
check("match blocking stays result-identical after in-place list growth", prop_blocking_survives_inplace_list_growth)
check("romanization is additive-only — it never moves an existing normalize() key",
      prop_romanization_never_moves_an_existing_key)

print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)