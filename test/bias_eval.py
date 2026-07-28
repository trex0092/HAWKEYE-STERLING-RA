#!/usr/bin/env python3
"""
FORMAL BIAS / FAIRNESS EVALUATION — name-matching recall across scripts (R-05).
====================================================================
The screening risk register (R-05) flags a fairness risk: a name matcher tuned on
Latin spellings could UNDER-MATCH transliterated Arabic / Turkish names, silently
producing more false negatives for those customers. This harness MEASURES that
instead of asserting it.

Method: a labelled set of (customer_spelling, designation_spelling, group) pairs
that a competent matcher SHOULD link (true equivalents) and a set of NON-pairs it
should NOT link (true non-equivalents). We run the real engine matcher and compute,
per script group:
  • RECALL    — true equivalents correctly matched (miss = false negative)
  • the recall GAP between the best and worst group (the fairness metric)
and overall false-positive control on the non-pairs.

Pass criteria (CI-enforced):
  • every group recall ≥ MIN_GROUP_RECALL
  • max-min recall gap ≤ MAX_RECALL_GAP   (parity across scripts)
  • no non-pair is matched (false-positive guard holds for all groups)

Run: `python test/bias_eval.py`   (exits non-zero on a fairness failure)
This is the evidence behind the model card's "bias_testing" claim.
"""
import sys, os, types, difflib, importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# Use real rapidfuzz if present (production matcher); else a difflib stand-in so
# the harness still runs in a bare CI image.
if importlib.util.find_spec("rapidfuzz") is not None:
    _ENGINE = "rapidfuzz"
else:
    def _tsr(a, b):
        a = " ".join(sorted(a.split())); b = " ".join(sorted(b.split()))
        return difflib.SequenceMatcher(None, a, b).ratio() * 100
    def _tset(a, b):
        sa, sb = set(a.split()), set(b.split()); inter = sa & sb
        if not inter: return _tsr(a, b)
        i = " ".join(sorted(inter))
        return max(_tsr(i, " ".join(sorted(sa))), _tsr(i, " ".join(sorted(sb))), _tsr(a, b))
    _rf = types.ModuleType("rapidfuzz"); _rf.fuzz = types.SimpleNamespace(token_sort_ratio=_tsr, token_set_ratio=_tset)
    sys.modules["rapidfuzz"] = _rf
    _ENGINE = "difflib-stub"
sys.modules.setdefault("pdfplumber", types.ModuleType("pdfplumber"))
_req = types.ModuleType("requests"); _req.utils = types.SimpleNamespace(quote=lambda s: s)
sys.modules.setdefault("requests", _req)
os.environ.setdefault("ASANA_TOKEN", "dummy")
os.environ.pop("ANTHROPIC_API_KEY", None)


def _load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, name + ".py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod

ai = _load("ai"); agents = _load("agents"); kyc = _load("kyc")
txn_monitor = _load("txn_monitor"); monitoring = _load("monitoring")
screen = _load("screen")

# Floors ratcheted 28 Jul 2026 with the accuracy-hardening programme (shared
# translit groups + phonetic fold): every group must now reach 90% recall with
# a 10% cross-script gap — up from the 70%/30% pre-hardening guards. Raising
# them further, or lowering them at all, goes through model-validation change
# control (docs/governance/screening-accuracy-benchmark.md ratchet rule).
MIN_GROUP_RECALL = float(os.environ.get("BIAS_MIN_GROUP_RECALL", "0.90"))
MAX_RECALL_GAP   = float(os.environ.get("BIAS_MAX_RECALL_GAP", "0.10"))

# ── Labelled equivalence set: pairs a fair matcher SHOULD link ────────────────
# (customer spelling on file, designation spelling on the list) — true equivalents.
EQUIV = {
    "Latin": [
        ("Petropars International FZE", "Petropars International FZE"),
        ("Marmara Gold Trading", "Marmara Gold Trading"),
        ("Stanford Marsh Limited", "Stanford Marsh Ltd"),
        ("Robert James Anderson", "Robert James Anderson"),
        ("Marcus Devereaux", "Marcus Devereux"),
        ("Frederick Aldous Grant", "Frederik Aldous Grant"),
    ],
    "Arabic": [
        ("Mohammed Al Hussein", "Muhammad Al Husain"),
        ("Abdul Rahman Bin Saleh", "Abdel Rahman Ibn Saleh"),
        ("Yousef El Sayed", "Yusuf Al Sayed"),
        ("Ahmed Abdullah", "Ahmad Abdullah"),
        ("Sheikh Mahmoud Ismail", "Shaikh Mahmoud Ismael"),
        # Post-hardening classes: shared-data translit groups beyond the
        # original ten (khaled/khalid, omar/umar+suleiman/sulayman,
        # mahmoud/mahmud+nasser/naser+qassem/kassem, soliman/sulayman).
        ("Khaled Mansour Al Otaibi", "Khalid Mansour Al Otaibi"),
        ("Omar Suleiman Haddad", "Umar Sulayman Haddad"),
        ("Mahmoud Nasser Qassem", "Mahmud Naser Kassem"),
        ("Soliman Kassem", "Sulayman Qassim"),
    ],
    "Turkish": [
        ("Huseyin Yamac", "Huseyin Yamac"),
        ("Mehmet Akif Turker", "Mehmet Akif Turker"),
        ("Ozgur Anik", "Ozgur Anik"),
        ("Mustafa Kardaslar", "Mustafa Kardaslar"),
        ("Mustapha Ozdemir", "Mustafa Ozdemir"),
        ("Cemal Aydin Demir", "Jamal Aydin Demir"),
    ],
    # Cyrillic-origin (Slavic) names reach the lists in Latin transliteration;
    # customer files carry the common spelling variant (Sergei/Sergey, Yuri/Yuriy,
    # Aleksandr/Alexander) — plus Ukrainian/Russian cross-forms
    # (Volodymyr/Vladimir, Mykola/Nikolai) and -off/-ov ending drift.
    "Cyrillic": [
        ("Sergei Ivanov", "Sergey Ivanov"),
        ("Aleksandr Volkov", "Alexander Volkov"),
        ("Dmitri Sokolov", "Dmitry Sokolov"),
        ("Yuriy Popov", "Yuri Popov"),
        ("Mikhail Kuznetsov", "Mikhail Kuznetsov"),
        ("Volodymyr Melnyk", "Vladimir Melnik"),
        ("Mykola Shevchenko", "Nikolai Shevchenko"),
        ("Piotr Fedorov", "Pyotr Fyodorov"),
        ("Andrey Smirnoff", "Andrei Smirnov"),
    ],
    # CJK / SE-Asian romanisation: the same name appears with different spacing
    # or hyphenation of the syllables (Wei Ming / Wei-ming). True equivalents.
    "CJK": [
        ("Chen Wei Ming", "Chen Wei-ming"),
        ("Kang Min Ho", "Kang Min-ho"),
        ("Lee Jong Su", "Lee Jong-su"),
        ("Zhang Wei Jun", "Zhang Wei-jun"),
        ("Nguyen Van An", "Nguyen Van An"),
    ],
    # Multi-edit romanization drift — every significant token ≥2 edits off.
    # These cleared BY DESIGN before the phonetic fold layer (the model card
    # pinned "Muhamet Huseinn" as its accepted residual); a fair matcher now
    # links them as WEAK phonetic-only possible matches.
    "Phonetic": [
        ("Muhamet Huseinn", "Muhammad Hussein"),
        ("Vladimyr Putyn", "Vladimir Putin"),
        ("Moamer Gadafi", "Muammar Qadhafi"),
        ("Abdool Kayoom", "Abdul Qayyum"),
        ("Zulfiqhar Bhoutto", "Zulfikar Bhutto"),
    ],
}

# ── Labelled NON-equivalence set: pairs a matcher should NOT link ─────────────
NON_EQUIV = [
    ("Tumad Madencilik Sanayi Ve Ticaret Anonim Sirketi",
     "Dal Enerji Madencilik Turizm Sanayi Ve Ticaret Anonim Sirketi"),   # only boilerplate shared
    ("Ahmed Hassan", "Mohammed Khalil"),
    ("Zoe Precious Metals FZE", "Acme General Trading LLC"),
    ("Sergei Ivanov", "Aleksandr Volkov"),       # two distinct Slavic names
    ("Chen Wei Ming", "Zhang Wei Jun"),           # two distinct CJK-romanised names
    # Phonetic-adjacent distinct persons: the fold layer must never link these
    # (first-vowel and trailing-vowel guards; consonant-skeleton discipline).
    ("Ali Hassan", "Ali Hussein"),
    ("Hana Qassem", "Hani Qasemi"),
    ("Imad Khatib", "Ahmad Khatri"),
    ("Rami Sabbagh", "Ramzi Dabbagh"),
]


def matches(customer_spelling, designation):
    lst = {"OFAC SDN": [(screen.normalize(designation), designation)]}
    return len(screen.screen_name(customer_spelling, lst)) >= 1


def main():
    print(f"BIAS / FAIRNESS EVALUATION   (matcher: {_ENGINE})")
    print("=" * 64)
    recalls = {}
    failures = []
    for group, pairs in EQUIV.items():
        hit = [(c, d) for c, d in pairs if matches(c, d)]
        miss = [(c, d) for c, d in pairs if not matches(c, d)]
        recall = len(hit) / len(pairs)
        recalls[group] = recall
        print(f"\n{group}: recall {recall*100:.0f}%  ({len(hit)}/{len(pairs)})")
        for c, d in miss:
            print(f"   MISS (false negative): '{c}'  ↮  '{d}'")
    gap = max(recalls.values()) - min(recalls.values())
    print("\n" + "-" * 64)
    print(f"Per-group recall: " + ", ".join(f"{g} {r*100:.0f}%" for g, r in recalls.items()))
    print(f"Fairness gap (max-min recall): {gap*100:.0f}%   (limit {MAX_RECALL_GAP*100:.0f}%)")

    # False-positive control (must hold across groups).
    fp = [(c, d) for c, d in NON_EQUIV if matches(c, d)]
    print(f"False positives on non-equivalent pairs: {len(fp)}  (limit 0)")
    for c, d in fp:
        print(f"   FALSE POSITIVE: '{c}'  —  '{d}'")

    for g, r in recalls.items():
        if r < MIN_GROUP_RECALL:
            failures.append(f"{g} recall {r*100:.0f}% < {MIN_GROUP_RECALL*100:.0f}% floor")
    if gap > MAX_RECALL_GAP:
        failures.append(f"recall gap {gap*100:.0f}% > {MAX_RECALL_GAP*100:.0f}% limit (script bias)")
    if fp:
        failures.append(f"{len(fp)} false positive(s) on non-equivalent pairs")

    print("\n" + "=" * 64)
    if failures:
        print("BIAS EVALUATION FAILED:")
        for f in failures:
            print("   ✗ " + f)
        sys.exit(1)
    print("BIAS EVALUATION PASSED — recall parity across scripts within tolerance.")


if __name__ == "__main__":
    main()
