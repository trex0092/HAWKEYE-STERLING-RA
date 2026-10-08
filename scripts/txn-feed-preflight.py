#!/usr/bin/env python3
"""Manual, offline preflight for a privately delivered transaction export.

Usage:
  python3 scripts/txn-feed-preflight.py /private/export.json /private/manifest.json

Does not connect to ERP/POS, send data to a service, or enable monitoring.
The export producer must independently supply the signed-off manifest and
the operator must verify source authenticity before trusting its SHA-256.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from txn_feed import FeedValidationError, validation_summary


def main(args):
    if len(args) != 2:
        print("usage: txn-feed-preflight.py PRIVATE_EXPORT PRIVATE_MANIFEST", file=sys.stderr)
        return 2
    try:
        summary = validation_summary(args[0], args[1])
    except FeedValidationError as exc:
        print("DEGRADED: transaction export verification failed: " + str(exc), file=sys.stderr)
        return 1
    print(json.dumps(summary, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
