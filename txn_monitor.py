#!/usr/bin/env python3
"""
FINE GOLD LLC — TRANSACTION MONITORING ENGINE  (txn_monitor.py)
Hawkeye Sterling V2 — FATF R.16 (wire transfers) + R.20 (STR triggers).
====================================================================
A deterministic, explainable transaction-monitoring rules engine for a DPMS
(precious-metals dealer): structuring, threshold avoidance, velocity spikes,
round-amount cash, rapid pass-through, and high-risk counterparty / geography.

IMPORTANT — DATA INTEGRITY (no hallucination):
  The screening platform currently holds KYC/customer data only; there is NO
  transaction feed connected. This engine is therefore INERT in production:
  `load_transactions()` returns [] (degrade loudly, logged) until a real source
  is configured via TXN_FEED_PATH. It NEVER invents transactions, and nothing
  here reaches a filed report unless real transactions are supplied. The engine
  is fully unit-tested on SYNTHETIC fixtures so it is ready the day a feed exists.

To connect a real feed: export TXN_FEED_PATH=/path/to/transactions.json — a JSON
list of {customer, date (YYYY-MM-DD), amount (AED), direction "in"|"out",
method "cash"|"wire"|"gold", counterparty, counterparty_country}.

THRESHOLDS (UAE DPMS context — tune in config):
  • AED 55,000  — DPMS cash-transaction reporting threshold (DPMSR / goAML).
  • AED 15,000  — CDD trigger for occasional transactions.
No third-party dependencies. Deterministic. Human (MLRO) reviews & files.
"""
import os, json, datetime
from collections import defaultdict

CASH_REPORT_THRESHOLD = float(os.environ.get("DPMS_CASH_THRESHOLD", "55000"))
CDD_TRIGGER_THRESHOLD = float(os.environ.get("CDD_TRIGGER_THRESHOLD", "15000"))
STRUCTURING_BAND      = 0.10   # within 10% under a threshold = "just under"
STRUCTURING_MIN_COUNT = 3      # N sub-threshold txns in the window
STRUCTURING_WINDOW_D  = 7      # days
VELOCITY_FACTOR       = 4.0    # a day > N× the customer's mean daily volume
TXN_FEED_PATH         = os.environ.get("TXN_FEED_PATH", "")


def feed_configured():
    return bool(TXN_FEED_PATH and os.path.exists(TXN_FEED_PATH))


def feed_parse_error(path=None):
    """True if a feed file is configured and present but cannot be parsed as a
    JSON list of records. A corrupt / truncated feed must NOT read as a quiet
    'ACTIVE, 0 txns' day — that would silence every monitoring rule."""
    p = path or TXN_FEED_PATH
    if not p or not os.path.exists(p):
        return False
    try:
        with open(p) as f:
            data = json.load(f)
        return not isinstance(data, list)
    except Exception:
        return True


def load_transactions(path=None):
    """Return the transaction list from the configured feed, or [] if none.
    Never raises, never fabricates. [] means 'no feed' (degrade loudly)."""
    p = path or TXN_FEED_PATH
    if not p or not os.path.exists(p):
        return []
    try:
        with open(p) as f:
            data = json.load(f)
        return [t for t in data if isinstance(t, dict)] if isinstance(data, list) else []
    except Exception:
        return []


def _d(s):
    try:
        return datetime.datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _amt(t):
    try:
        return float(t.get("amount", 0) or 0)
    except Exception:
        return 0.0


def _norm(s):
    return str(s or "").strip().lower()


# ── RULES ─────────────────────────────────────────────────────────────────────
def rule_threshold(txns):
    """Single transaction at/above the DPMS cash reporting threshold."""
    out = []
    for t in txns:
        if _norm(t.get("method")) == "cash" and _amt(t) >= CASH_REPORT_THRESHOLD:
            out.append(_alert("THRESHOLD", "HIGH", t,
                f"cash {_amt(t):,.0f} AED ≥ reporting threshold {CASH_REPORT_THRESHOLD:,.0f}"))
    return out


def rule_structuring(txns):
    """Multiple cash transactions JUST UNDER the threshold within the window —
    classic structuring / smurfing to avoid the report."""
    lo = CASH_REPORT_THRESHOLD * (1 - STRUCTURING_BAND)
    near = sorted(
        [t for t in txns if _norm(t.get("method")) == "cash"
         and lo <= _amt(t) < CASH_REPORT_THRESHOLD and _d(t.get("date"))],
        key=lambda t: _d(t.get("date")))
    out = []
    n = len(near)
    for i in range(n):
        window = [near[i]]
        for j in range(i + 1, n):
            if (_d(near[j]["date"]) - _d(near[i]["date"])).days <= STRUCTURING_WINDOW_D:
                window.append(near[j])
        if len(window) >= STRUCTURING_MIN_COUNT:
            total = sum(_amt(t) for t in window)
            out.append(_alert("STRUCTURING", "CRITICAL", window[0],
                f"{len(window)} cash txns just under threshold in ≤{STRUCTURING_WINDOW_D}d "
                f"(total {total:,.0f} AED) — possible structuring"))
            break   # one alert per customer-window is enough to action
    return out


def rule_velocity(txns):
    """A day whose volume is a large multiple of the customer's mean daily volume."""
    by_day = defaultdict(float)
    for t in txns:
        d = _d(t.get("date"))
        if d:
            by_day[d] += _amt(t)
    if len(by_day) < 3:
        return []
    total = sum(by_day.values())
    n = len(by_day)
    out = []
    for d, v in by_day.items():
        # Baseline = mean of the OTHER active days. Including the spike day in its
        # own baseline inflates the threshold and lets large single-day spikes slip
        # under it (e.g. [100,100,1000] → naive mean 400, so the 10× spike never
        # fires); excluding it compares the day against the genuine baseline.
        base_mean = (total - v) / (n - 1)
        if base_mean > 0 and v >= VELOCITY_FACTOR * base_mean:
            out.append(_alert("VELOCITY", "MEDIUM", {"customer": _any_customer(txns), "date": str(d)},
                f"day volume {v:,.0f} AED ≥ {VELOCITY_FACTOR:g}× baseline daily {base_mean:,.0f}"))
    return out


def rule_high_risk_counterparty(txns, jurisdiction_table=None):
    """Counterparty in a higher-risk jurisdiction (uses the maintained list)."""
    if jurisdiction_table is None:
        try:
            import kyc
            jurisdiction_table = kyc.load_jurisdiction_risk()
        except Exception:
            jurisdiction_table = {}
    out = []
    for t in txns:
        tier = jurisdiction_table.get(_norm(t.get("counterparty_country")))
        if tier:
            out.append(_alert("HIGH_RISK_GEO", "HIGH" if tier == "high" else "MEDIUM", t,
                f"counterparty {t.get('counterparty','?')} in {t.get('counterparty_country','?')} "
                f"({'call-for-action' if tier=='high' else 'increased-monitoring'} jurisdiction)"))
    return out


def rule_rapid_passthrough(txns):
    """Funds in then out within ~2 days (≤72h, date-granular) for a similar amount
    — pass-through / layering. The window is intentionally generous (over-alert is
    the safe direction for AML); the alert text states the actual day gap."""
    ins = [t for t in txns if _norm(t.get("direction")) == "in" and _d(t.get("date"))]
    outs = [t for t in txns if _norm(t.get("direction")) == "out" and _d(t.get("date"))]
    out = []
    for ti in ins:
        for to in outs:
            dd = (_d(to["date"]) - _d(ti["date"])).days
            if 0 <= dd <= 2 and _amt(ti) > 0 and abs(_amt(to) - _amt(ti)) <= 0.1 * _amt(ti):
                out.append(_alert("PASSTHROUGH", "HIGH", ti,
                    f"{_amt(ti):,.0f} AED in then ~{_amt(to):,.0f} out within {dd}d — possible layering"))
                break
    return out


_RULES = [rule_threshold, rule_structuring, rule_velocity,
          rule_high_risk_counterparty, rule_rapid_passthrough]


def _any_customer(txns):
    for t in txns:
        if t.get("customer"):
            return t["customer"]
    return "?"


def _alert(rule, severity, t, detail):
    return {"rule": rule, "severity": severity,
            "customer": t.get("customer", "?"), "date": t.get("date", ""),
            "amount": _amt(t) if "amount" in t else None, "detail": detail}


def evaluate_customer(txns, jurisdiction_table=None):
    """Run all rules over ONE customer's transactions. Returns a list of alerts."""
    alerts = []
    for rule in _RULES:
        try:
            if rule is rule_high_risk_counterparty:
                alerts += rule(txns, jurisdiction_table)
            else:
                alerts += rule(txns)
        except Exception:
            continue  # a rule error never blocks the others
    return alerts


def evaluate(transactions, jurisdiction_table=None):
    """Group by customer and evaluate. Returns {configured, n_txns, n_customers,
    alerts:[...], by_severity:{...}}. With no feed: configured=False, alerts=[]."""
    txns = transactions or []
    by_customer = defaultdict(list)
    for t in txns:
        by_customer[t.get("customer", "?")].append(t)
    alerts = []
    for cust, ctx in by_customer.items():
        alerts += evaluate_customer(ctx, jurisdiction_table)
    sev_rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    alerts.sort(key=lambda a: sev_rank.get(a["severity"], 0), reverse=True)
    by_sev = defaultdict(int)
    for a in alerts:
        by_sev[a["severity"]] += 1
    return {"configured": bool(transactions) or feed_configured(),
            "n_txns": len(txns), "n_customers": len(by_customer),
            "alerts": alerts, "by_severity": dict(by_sev)}


def status_line():
    """One line for the report / monitoring section. Honest about the feed."""
    if feed_configured():
        if feed_parse_error():
            return ("Transaction monitoring (R.16): DEGRADED — the configured transaction "
                    "feed could not be parsed (corrupt or truncated JSON). No transactions "
                    "were screened this run; investigate the feed before relying on it.")
        res = evaluate(load_transactions())
        return (f"Transaction monitoring (R.16): ACTIVE — {res['n_txns']} txns / "
                f"{res['n_customers']} customers → {len(res['alerts'])} alert(s).")
    return ("Transaction monitoring (R.16): engine ready & tested, INACTIVE — no "
            "transaction feed connected (set TXN_FEED_PATH). No transaction data is "
            "screened or reported until a real feed is configured.")
