#!/usr/bin/env python3
"""GKG sweep at full volume — dispatch-only diagnostic (source-probe.yml,
source_id=gkg-sweep).

Runs screen.gkg_sweep, the code the daily screen uses, over the full window
against PUBLIC FIGURES and well-known institutions only, never the customer
base. It prints files read, articles, source languages, runtime and the
adverse items found, so the 24-hour stream is measured before the daily run
relies on it. Nothing is screened, stored or posted."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import screen  # noqa: E402

PUBLIC_SUBJECTS = [
    ("Donald Trump", "person"), ("Vladimir Putin", "person"), ("Recep Tayyip Erdogan", "person"),
    ("Narendra Modi", "person"), ("Xi Jinping", "person"), ("Keir Starmer", "person"),
    ("Benjamin Netanyahu", "person"), ("Volodymyr Zelensky", "person"), ("Emmanuel Macron", "person"),
    ("Mohammed bin Salman", "person"), ("Goldman Sachs Group", "org"), ("Deutsche Bank AG", "org"),
]


def main():
    subjects = [(screen.normalize(n), n, k) for n, k in PUBLIC_SUBJECTS]
    t0 = time.time()
    hits = screen.gkg_sweep(subjects)
    took = time.time() - t0
    st = screen.gkg_stats_snapshot()
    langs = sorted(st["langs"].items(), key=lambda kv: -kv[1])
    print("## GKG sweep at full volume")
    print()
    print(f"- window: {st['hours']} h ending {screen.GKG_LAG_SLOTS} slot(s) back · files expected {st['expected']} · "
          f"read {st['read']} · not published {st['missing']} · failed {st['failed']} · deadline hit {st['deadline_hit']}")
    print(f"- runtime {took:.0f} s · articles {st['rows']:,} · malformed rows {st['bad_rows']} · "
          f"rows naming a test subject {st['matched_rows']} · complete={screen.gkg_complete(st)}")
    print(f"- source languages ({len(langs)}): " + " ".join(f"{k}:{v}" for k, v in langs[:40]))
    print()
    for norm, name, _ in subjects:
        arts = hits.get(norm, [])
        tiers = {}
        for a in arts:
            tiers[a.get("tier") or "?"] = tiers.get(a.get("tier") or "?", 0) + 1
        print(f"- **{name}**: {len(arts)} adverse item(s) {tiers}")
        for a in arts[:3]:
            print(f"  - [{a.get('lang')}] {a['title'][:140]} — {a['source'][:50]} · {', '.join(a['keywords'][:4])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
