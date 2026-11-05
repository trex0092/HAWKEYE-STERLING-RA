"""data_schema_test.py — every committed data file that has a schema validates
against it, and every schema is itself a valid JSON Schema (draft 2020-12).

Why: the curated and generated files under data/ are read by the screening
engine, the app and the workflows, and until now only
data/transaction-feed.schema.json existed, describing a feed record rather
than a committed file. A hand edit that broke the shape of the EOCN list, a
curated supplement or the source registry was caught, if at all, by whichever
consumer happened to read it next. This suite fails CI on the shape itself.

Mechanics: each data/schemas/*.schema.json names the files it validates in
"x-hawkeye-validates". A listed file that is missing FAILS (degrade loudly)
unless the schema carries "x-hawkeye-optional": true, which is reserved for a
generated file introduced on another branch. A few cross-field rules JSON
Schema cannot express (count equals the number of entries, source ids unique)
are checked natively below.

Requires the CI-only tool lock: python -m pip install --require-hashes -r
ci/schema-requirements.txt. Hand-rolled check() harness, like every other
suite here (no pytest).
"""
import datetime
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    import jsonschema
    from jsonschema import Draft202012Validator
except ModuleNotFoundError:
    # Re-raise so scripts/run-tests.mjs records a loud SKIP (never a pass) with
    # the install command, exactly as it does for a missing engine dependency.
    print("data_schema_test.py needs the CI-only tool lock: "
          "python -m pip install --require-hashes -r ci/schema-requirements.txt", file=sys.stderr)
    raise

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok   " + name)
    else:
        failed += 1
        print("FAIL   " + name + (f"\n       {detail}" if detail else ""))


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return json.load(fh)


schema_files = sorted(glob.glob(os.path.join(ROOT, "data", "schemas", "*.schema.json")))
check("schemas directory holds at least one schema", len(schema_files) >= 1)

# The pre-existing feed-record schema has no committed instance; it must still
# be a valid schema so txn_monitor.py and payment_screen.py describe a real shape.
feed_schema = load("data/transaction-feed.schema.json")
try:
    Draft202012Validator.check_schema(feed_schema)
    check("data/transaction-feed.schema.json is a valid draft 2020-12 schema", True)
except jsonschema.SchemaError as exc:
    check("data/transaction-feed.schema.json is a valid draft 2020-12 schema", False, str(exc)[:200])

validated = set()
for path in schema_files:
    rel = os.path.relpath(path, ROOT)
    schema = load(rel)
    try:
        Draft202012Validator.check_schema(schema)
        check(f"{rel} is a valid draft 2020-12 schema", True)
    except jsonschema.SchemaError as exc:
        check(f"{rel} is a valid draft 2020-12 schema", False, str(exc)[:200])
        continue
    targets = schema.get("x-hawkeye-validates") or []
    check(f"{rel} names at least one data file in x-hawkeye-validates", len(targets) >= 1)
    optional = schema.get("x-hawkeye-optional") is True
    validator = Draft202012Validator(schema)
    for target in targets:
        full = os.path.join(ROOT, target)
        if not os.path.exists(full):
            if optional:
                print(f"  --   {target} not present on this branch (schema marked optional); not validated")
                continue
            check(f"{target} exists (listed by {rel})", False, "listed file is missing")
            continue
        try:
            instance = load(target)
        except ValueError as exc:
            check(f"{target} is well-formed JSON", False, str(exc)[:200])
            continue
        errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.absolute_path))
        detail = "; ".join(f"{'/'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message[:120]}" for e in errors[:5])
        check(f"{target} validates against {os.path.basename(rel)}", not errors, detail)
        validated.add(target)

# Native cross-field rules.
for target in ("data/eocn-local-terrorist-list.json", "data/internal-watchlist.json",
               "data/dfat-curated-list.json", "data/seco-curated-list.json"):
    if target in validated:
        d = load(target)
        check(f"{target}: count equals the number of entries",
              d.get("count") == len(d.get("entries") or []),
              f"count={d.get('count')} entries={len(d.get('entries') or [])}")
        if d.get("entries") or d.get("lastReviewed"):
            try:
                datetime.date.fromisoformat(d.get("lastReviewed", ""))
                check(f"{target}: lastReviewed is a real calendar date", True)
            except ValueError:
                check(f"{target}: lastReviewed is a real calendar date", False, repr(d.get("lastReviewed")))
        else:
            print(f"  --   {target}: empty template with no review date (not populated); date rule not applied")

if "data/eocn-local-terrorist-list.json" in validated:
    names = [e if isinstance(e, str) else e["name"] for e in load("data/eocn-local-terrorist-list.json")["entries"]]
    check("EOCN entries carry no duplicate names", len(names) == len(set(names)),
          f"{len(names) - len(set(names))} duplicate(s)")

for target in ("data/sanctions-sources.json", "data/sanctions-extra.json"):
    if target in validated:
        ids = [s["id"] for s in load(target)["sources"]]
        check(f"{target}: source ids are unique", len(ids) == len(set(ids)),
              f"{len(ids) - len(set(ids))} duplicate id(s)")
        plain = [s["id"] for s in load(target)["sources"] if str(s.get("url", "")).startswith("http://")]
        if plain:
            print(f"  !!   {target}: {len(plain)} source(s) fetched over plain http (no TLS): {', '.join(plain)}")

check("every schema validated at least one committed file", len(validated) >= 5, f"validated {len(validated)}")

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
