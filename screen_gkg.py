"""Pure GDELT GKG parsing and subject-index helpers.

This module is deliberately dependency-light. It owns only deterministic
windowing, parsing and token-set matching helpers. Network I/O, adverse-risk
classification, run statistics and orchestration remain in screen.py.

The public screen.py wrappers preserve the existing engine API while allowing
the monolith to be decomposed incrementally under ADR-005.
"""

import datetime
import html
import re

_GKG_TITLE_RE = re.compile(r"<PAGE_TITLE>(.*?)</PAGE_TITLE>", re.S | re.I)
_GKG_SRCLC_RE = re.compile(r"srclc:([a-z]{2,3})", re.I)


def gkg_file_stamps(end_utc, hours, lag_slots):
    """Return newest-first 15-minute GKG stamps for a complete time window."""
    end = end_utc.replace(second=0, microsecond=0)
    end = end - datetime.timedelta(minutes=end.minute % 15 + 15 * lag_slots)
    n = hours * 4
    return [(end - datetime.timedelta(minutes=15 * i)).strftime("%Y%m%d%H%M00")
            for i in range(n)]


def _gkg_names(field):
    """Parse GKG Name,offset fields into unique names in source order."""
    out, seen = [], set()
    for part in (field or "").split(";"):
        name = part.rsplit(",", 1)[0].strip() if "," in part else part.strip()
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def parse_gkg_rows(text):
    """Parse GKG 2.1 rows and count malformed rows instead of hiding drift."""
    rows, bad = [], 0
    for line in (text or "").split("\n"):
        if not line:
            continue
        fields = line.split("\t")
        if len(fields) < 27:
            bad += 1
            continue
        title_match = _GKG_TITLE_RE.search(fields[26] or "")
        lang_match = _GKG_SRCLC_RE.search(fields[25] or "")
        rows.append({
            "date": fields[1][:8],
            "stamp": fields[1],
            "source": fields[3],
            "url": fields[4],
            "persons": _gkg_names(fields[12]),
            "orgs": _gkg_names(fields[14]),
            "themes": [t for t in (fields[7] or "").split(";") if t],
            "title": html.unescape(title_match.group(1)).strip() if title_match else "",
            "lang": lang_match.group(1).lower() if lang_match else "en",
        })
    return rows, bad


def gkg_subject_index(subjects, normalize_fn, core_tokens_fn):
    """Build the subject token index using caller-supplied name semantics."""
    full, first_last, org = {}, {}, {}
    for key, name, kind in subjects:
        toks = [t for t in normalize_fn(name).split() if t]
        if kind == "person":
            if len(toks) < 2:
                continue
            full.setdefault(frozenset(toks), set()).add(key)
            first_last.setdefault((toks[0], toks[-1]), []).append(
                (key, frozenset(toks))
            )
        else:
            core = core_tokens_fn(normalize_fn(name))
            if len(core) >= 2:
                org.setdefault(frozenset(core), set()).add(key)
    return {"full": full, "fl": first_last, "org": org}


def gkg_match(row, idx, normalize_fn, core_tokens_fn):
    """Return subject keys named by a parsed GKG row."""
    keys = set()
    for person in row["persons"]:
        toks = [t for t in normalize_fn(person).split() if t]
        if len(toks) < 2:
            continue
        token_set = frozenset(toks)
        keys |= idx["full"].get(token_set, set())
        for key, subject_tokens in idx["fl"].get((toks[0], toks[-1]), ()):
            if token_set <= subject_tokens:
                keys.add(key)
    for org_name in row["orgs"]:
        core = core_tokens_fn(normalize_fn(org_name))
        if len(core) >= 2:
            keys |= idx["org"].get(frozenset(core), set())
    return keys
