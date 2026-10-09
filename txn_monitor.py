#!/usr/bin/env python3
"""
HAWKEYE STERLING — TRANSACTION MONITORING ENGINE  (txn_monitor.py)
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
method "cash"|"wire"|"gold", counterparty, counterparty_country, plus optional
trade-control fields defined in data/transaction-feed.schema.json}.

THRESHOLDS (UAE DPMS context — tune in config):
  • AED 55,000  — DPMS cash-transaction reporting threshold (DPMSR / goAML).
  • AED 15,000  — CDD trigger for occasional transactions.
No third-party dependencies. Deterministic. Human (MLRO) reviews & files.
"""
import os, re, json, math, datetime
from collections import defaultdict

import txn_feed  # stdlib-only validation; never fetches or stores customer data
from payment_screen import canonical_direction

CASH_REPORT_THRESHOLD = float(os.environ.get("DPMS_CASH_THRESHOLD", "55000"))
CDD_TRIGGER_THRESHOLD = float(os.environ.get("CDD_TRIGGER_THRESHOLD", "15000"))
STRUCTURING_BAND      = 0.10   # within 10% under a threshold = "just under"
STRUCTURING_MIN_COUNT = 3      # N sub-threshold txns in the window
STRUCTURING_WINDOW_D  = 7      # days
VELOCITY_FACTOR       = 4.0    # a day > N× the customer's mean daily volume
PRICE_DEVIATION_PCT   = float(os.environ.get("TXN_PRICE_DEVIATION_PCT", "10"))
TXN_FEED_PATH         = os.environ.get("TXN_FEED_PATH", "")
# Profile deviation: a month's volume above N× the customer's DECLARED expected
# monthly volume (the KYC profile figure, feed field expected_monthly_volume).
PROFILE_DEVIATION_FACTOR = float(os.environ.get("TXN_PROFILE_DEVIATION_FACTOR", "1.5"))
CIRCULAR_WINDOW_D     = 30     # days: funds out to X and back from X (or reverse)
CIRCULAR_AMOUNT_BAND  = 0.10   # within 10% = the same money coming back
NEW_GEO_MIN_HISTORY   = 5      # prior transactions needed before a country is "new"
# STR red-flag typologies (data/str-red-flags.json). Defaults pending MLRO
# confirmation, like every threshold here; each is a constant, not a guess.
RESALE_WINDOW_D       = 7      # days: gold bought then sold back (or reverse)
RESALE_WEIGHT_BAND    = 0.10   # within 10% of the weight = the same gold
RESALE_LOSS_PCT       = 5.0    # a resale this % below cost is called a loss
FUNNEL_MIN_SOURCES    = 5      # distinct payers feeding one onward payment
FUNNEL_WINDOW_D       = 14     # days the inbound payments are collected over
FUNNEL_SHARE          = 0.5    # onward foreign payment ≥ this share of the inflow
MULTI_JURISDICTION_MIN = 4     # distinct countries in ONE payment chain
HOME_COUNTRIES        = {"ae", "are", "uae", "united arab emirates"}
# Payment-reference wording tied to a red flag. Word-bounded, case-insensitive.
# Deliberately no religious-giving terms: the indicator is an NPO/charity
# channel, not a faith practice.
REFERENCE_KEYWORDS = {
    "commission / consultancy wording (possible concealed bribe or kickback)": (
        "commission", "consultancy", "consulting fee", "facilitation fee",
        "success fee", "finder's fee", "finders fee", "introducer fee", "kickback"),
    "charity / NPO wording (possible TF funnelling through a non-profit)": (
        "donation", "charity", "charitable", "non-profit", "nonprofit", "npo",
        "relief fund"),
    "informal value transfer wording (hawala / underground banking)": (
        "hawala", "hundi", "informal transfer", "underground banking"),
}
_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
RED_FLAGS_PATH = os.path.join(_DATA_DIR, "str-red-flags.json")      # STR register
SAR_RED_FLAGS_PATH = os.path.join(_DATA_DIR, "sar-red-flags.json")  # SAR register
_RED_FLAGS = {}
# Categories where a recorded flag can mean a TFS event, not only an STR/SAR.
TFS_FLAG_CATEGORIES = {"STR": {"TF", "PF", "SE"}, "SAR": {"SA", "TF", "PF"}}


def feed_configured():
    return bool(TXN_FEED_PATH and os.path.exists(TXN_FEED_PATH))


def _manifest_path(path):
    """Trusted export completeness manifest, normally adjacent to the export."""
    return os.environ.get("TXN_FEED_MANIFEST_PATH") or path + ".manifest.json"


def feed_parse_error(path=None):
    """True if a feed file is configured and present but cannot be parsed as a
    JSON list of records. A corrupt / truncated feed must NOT read as a quiet
    'ACTIVE, 0 txns' day — that would silence every monitoring rule."""
    p = path or TXN_FEED_PATH
    if not p or not os.path.exists(p):
        return False
    if path is None and TXN_FEED_PATH:
        # The configured production feed MUST be complete and independently
        # attested. An untrusted or missing manifest is never a zero-activity
        # day. Explicit paths remain a legacy offline fixture interface.
        try:
            txn_feed.read_validated_feed(p, _manifest_path(p))
            return False
        except txn_feed.FeedValidationError:
            return True
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
    if path is None and TXN_FEED_PATH:
        # Never silently skip malformed rows for an activated live feed.
        # Fail loudly on a missing export/manifest, incomplete coverage,
        # duplicate ID, invalid amount, date, currency or digest mismatch.
        return txn_feed.read_validated_feed(p, _manifest_path(p))
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
def _dpmsr_scope(t):
    """In DPMSR scope (POL-19 §3): cash, or an INTERNATIONAL wire — a wire whose
    counterparty country is recorded and is not the UAE."""
    m = _norm(t.get("method"))
    if m == "cash":
        return "cash"
    c = _norm(t.get("counterparty_country"))
    if m == "wire" and c and c not in HOME_COUNTRIES:
        return "international wire"
    return ""


def rule_threshold(txns):
    """Single transaction at/above the DPMS reporting threshold: cash or an
    international wire (POL-19 §3). The DPMSR is filed regardless of suspicion."""
    out = []
    for t in txns:
        kind = _dpmsr_scope(t)
        if kind and _amt(t) >= CASH_REPORT_THRESHOLD:
            out.append(_alert("THRESHOLD", "HIGH", t,
                f"{kind} {_amt(t):,.0f} AED ≥ DPMSR threshold {CASH_REPORT_THRESHOLD:,.0f} — "
                "DPMSR in goAML regardless of suspicion (POL-19 §3)"))
    return out


def rule_linked_threshold(txns):
    """Cumulative linked dealings (POL-19 §3: 'single or cumulative linked'):
    two or more in-scope transactions on the SAME calendar day, each below the
    threshold, that together reach it. Same-day linkage is the minimum the
    engine can establish from dates alone; wider linkage stays with the
    STRUCTURING rule and the MLRO."""
    by_day = defaultdict(list)
    for t in txns:
        if _dpmsr_scope(t) and 0 < _amt(t) < CASH_REPORT_THRESHOLD and _d(t.get("date")):
            by_day[_d(t["date"])].append(t)
    out = []
    for d, ts in sorted(by_day.items()):
        total = sum(_amt(t) for t in ts)
        if len(ts) >= 2 and total >= CASH_REPORT_THRESHOLD:
            out.append(_alert("LINKED_THRESHOLD", "HIGH", ts[0],
                f"{len(ts)} cash/international-wire transactions on {d} total {total:,.0f} AED "
                f"(each < {CASH_REPORT_THRESHOLD:,.0f}) — DPMSR on the linked series "
                "(POL-19 §3); assess for structuring"))
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


def rule_cdd_trigger(txns):
    """Occasional transaction at/above the CDD trigger (AED 15,000) — FATF R.10
    requires CDD on occasional transactions above the designated threshold.
    Below the DPMSR line, so LOW severity: a work item (perform/refresh CDD),
    not a suspicion. Cash-threshold amounts are already alerted by THRESHOLD."""
    out = []
    for t in txns:
        amt = _amt(t)
        if amt < CDD_TRIGGER_THRESHOLD:
            continue
        # THRESHOLD already alerts CASH at/above the DPMSR line — but only cash.
        # A wire/gold transaction of any size still needs CDD on file, so the
        # upper carve-out must not exempt non-cash methods.
        if _norm(t.get("method")) == "cash" and amt >= CASH_REPORT_THRESHOLD:
            continue
        out.append(_alert("CDD_TRIGGER", "LOW", t,
            f"{amt:,.0f} AED ≥ CDD trigger {CDD_TRIGGER_THRESHOLD:,.0f} — "
            "verify CDD is on file for this customer"))
    return out


def rule_round_amount_cash(txns):
    """Repeated exact-round cash amounts (multiples of AED 5,000, ≥ 10,000) —
    round-figure cash is a classic laundering indicator for a DPMS, where
    genuine trades price off a floating metal rate and rarely land on round
    numbers. One alert per customer once the pattern repeats."""
    round_cash = [t for t in txns
                  if _norm(t.get("method")) == "cash"
                  and _amt(t) >= 10000 and _amt(t) % 5000 == 0]
    if len(round_cash) < 3:
        return []
    total = sum(_amt(t) for t in round_cash)
    return [_alert("ROUND_AMOUNT", "MEDIUM", round_cash[0],
        f"{len(round_cash)} exact-round cash txns (total {total:,.0f} AED) — "
        "round-figure cash is atypical for metal-rate-priced trades")]


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



def rule_third_party_payment(txns):
    """Explicit unrelated third-party payer/payee involvement.

    This rule never infers relationship from names. It fires only when the feed
    states third_party_payment=true AND the recorded relationship is unrelated.
    """
    out = []
    for t in txns:
        if t.get("third_party_payment") is True and _norm(t.get("third_party_relationship")) == "unrelated":
            out.append(_alert("THIRD_PARTY_PAYMENT", "HIGH", t,
                "payment involves an explicitly unrelated third party — review contractual/commercial nexus"))
    return out


def rule_refund_diversion(txns):
    """Refund directed away from the original funding account.

    A different account alone is not enough where the feed records a documented
    legitimate reason; that evidence suppresses the automated alert.
    """
    out = []
    for t in txns:
        if _norm(t.get("transaction_type")) != "refund":
            continue
        funding = _norm(t.get("funding_account"))
        refund = _norm(t.get("refund_account"))
        if funding and refund and funding != refund and t.get("refund_reason_documented") is not True:
            out.append(_alert("REFUND_DIVERSION", "HIGH", t,
                "refund account differs from original funding account with no documented legitimate reason"))
    return out


def rule_pricing_deviation(txns):
    """Transaction unit price materially differs from supplied market reference.

    The engine does NOT obtain or invent a market price. Both unit_price and
    market_unit_price must be supplied by the transaction feed or an upstream
    controlled pricing source.
    """
    out = []
    for t in txns:
        try:
            price = float(t.get("unit_price"))
            market = float(t.get("market_unit_price"))
        except (TypeError, ValueError):
            continue
        if market <= 0:
            continue
        deviation = abs(price - market) / market * 100
        if deviation > PRICE_DEVIATION_PCT:
            out.append(_alert("PRICING_DEVIATION", "HIGH", t,
                f"unit price deviates {deviation:.1f}% from supplied market reference "
                f"(tolerance {PRICE_DEVIATION_PCT:g}%)"))
    return out


def rule_phantom_delivery(txns):
    """Paid/completed goods transaction explicitly lacking delivery evidence."""
    out = []
    for t in txns:
        if (t.get("goods_transaction") is True
                and t.get("payment_completed") is True
                and t.get("delivery_confirmed") is False):
            out.append(_alert("PHANTOM_DELIVERY", "HIGH", t,
                "goods transaction is paid/completed but the feed records no confirmed physical delivery"))
    return out


def rule_invoice_mismatch(txns):
    """Material trade-document reconciliation mismatch supplied by upstream controls."""
    return [_alert("INVOICE_MISMATCH", "HIGH", t,
            "structured invoice/shipment reconciliation records a material mismatch")
            for t in txns if t.get("invoice_mismatch") is True]


def rule_route_mismatch(txns):
    """Payment or shipment route explicitly inconsistent with the documented trade."""
    return [_alert("ROUTE_MISMATCH", "HIGH", t,
            "payment or shipment route is recorded as inconsistent with the underlying trade")
            for t in txns if t.get("route_mismatch") is True]


def rule_profile_deviation(txns):
    """Activity inconsistent with the customer's declared profile: a calendar
    month's total above PROFILE_DEVIATION_FACTOR × the declared expected monthly
    volume. Fires only when the feed carries expected_monthly_volume — never
    guesses a profile from the activity it is meant to check."""
    declared = [float(t["expected_monthly_volume"]) for t in txns
                if isinstance(t.get("expected_monthly_volume"), (int, float))
                and t["expected_monthly_volume"] > 0]
    if not declared:
        return []
    expected = declared[-1]
    months = defaultdict(list)
    for t in txns:
        d = _d(t.get("date"))
        if d:
            months[(d.year, d.month)].append(t)
    out = []
    for (y, m), ts in sorted(months.items()):
        total = sum(_amt(t) for t in ts)
        if total > PROFILE_DEVIATION_FACTOR * expected:
            out.append(_alert("PROFILE_DEVIATION", "HIGH", ts[-1],
                f"{y}-{m:02d} volume {total:,.0f} AED is {total / expected:.1f}× the declared "
                f"expected monthly volume {expected:,.0f} AED — refresh the profile / source of funds"))
    return out


def rule_circular_flow(txns):
    """Round-tripping: money leaves to a counterparty and comes back from the SAME
    counterparty (or the reverse) within CIRCULAR_WINDOW_D days for a similar
    amount. Matching is on the recorded counterparty field, never on a guess."""
    dated = [t for t in txns if _d(t.get("date")) and _norm(t.get("counterparty"))]
    out = []
    seen = set()
    for a in dated:
        for b in dated:
            if a is b or _norm(a.get("counterparty")) != _norm(b.get("counterparty")):
                continue
            if {_norm(a.get("direction")), _norm(b.get("direction"))} != {"in", "out"}:
                continue
            dd = (_d(b["date"]) - _d(a["date"])).days
            if not (0 <= dd <= CIRCULAR_WINDOW_D) or _amt(a) <= 0:
                continue
            if abs(_amt(b) - _amt(a)) <= CIRCULAR_AMOUNT_BAND * _amt(a):
                key = (id(a), id(b))
                if key in seen:
                    continue
                seen.add(key)
                out.append(_alert("CIRCULAR_FLOW", "HIGH", a,
                    f"{_amt(a):,.0f} AED {_norm(a.get('direction'))} and ~{_amt(b):,.0f} "
                    f"{_norm(b.get('direction'))} with the same counterparty "
                    f"{a.get('counterparty')} within {dd}d — possible round-tripping"))
    return out


def rule_new_geography(txns):
    """Unexpected cross-border activity: a counterparty country never seen in the
    customer's earlier history (needs NEW_GEO_MIN_HISTORY prior transactions, so
    a new customer's first payments are not all flagged)."""
    dated = sorted((t for t in txns if _d(t.get("date"))), key=lambda t: _d(t["date"]))
    out = []
    seen = set()
    for i, t in enumerate(dated):
        c = _norm(t.get("counterparty_country"))
        if not c:
            continue
        if i >= NEW_GEO_MIN_HISTORY and c not in seen:
            out.append(_alert("NEW_GEOGRAPHY", "MEDIUM", t,
                f"first payment involving {t.get('counterparty_country')} after "
                f"{i} earlier transaction(s) in other countries — confirm the business reason"))
        seen.add(c)
    return out


def rule_rapid_resale(txns):
    """Gold bought and sold back (or sold and bought back) within RESALE_WINDOW_D
    days for about the same weight — layering through the metal, or the same
    gold churned with no economic exposure. Needs transaction_type buy|sell and
    weight_g on the records; states the loss when the resale is below cost."""
    def wt(t):
        try:
            return float(t.get("weight_g"))
        except (TypeError, ValueError):
            return 0.0
    legs = [t for t in txns if _norm(t.get("transaction_type")) in ("buy", "sell")
            and _d(t.get("date")) and wt(t) > 0]
    out = []
    for a in legs:
        for b in legs:
            if a is b or _norm(a.get("transaction_type")) == _norm(b.get("transaction_type")):
                continue
            dd = (_d(b["date"]) - _d(a["date"])).days
            if not (0 <= dd <= RESALE_WINDOW_D) or (dd == 0 and id(b) < id(a)):
                continue
            if abs(wt(b) - wt(a)) > RESALE_WEIGHT_BAND * wt(a):
                continue
            buy, sell = (a, b) if _norm(a.get("transaction_type")) == "buy" else (b, a)
            loss = ""
            if _amt(buy) > 0 and _amt(sell) > 0:
                pct = (_amt(buy) - _amt(sell)) / _amt(buy) * 100
                if pct >= RESALE_LOSS_PCT:
                    loss = f" at a {pct:.1f}% loss"
            out.append(_alert("RAPID_RESALE", "HIGH", a,
                f"{_norm(a.get('transaction_type'))} {wt(a):,.0f} g then "
                f"{_norm(b.get('transaction_type'))} {wt(b):,.0f} g within {dd}d{loss} — "
                "possible layering / churning of the same gold"))
            break
    return out


def rule_funnel(txns):
    """Many payers, one foreign payee: FUNNEL_MIN_SOURCES or more distinct
    counterparties pay in within FUNNEL_WINDOW_D days, then a payment of at
    least FUNNEL_SHARE of that inflow goes to a counterparty abroad (TF
    collection-and-funnel pattern). Counterparties are taken as recorded."""
    ins = [t for t in txns if _norm(t.get("direction")) == "in"
           and _d(t.get("date")) and _norm(t.get("counterparty"))]
    outs = [t for t in txns if _norm(t.get("direction")) == "out" and _d(t.get("date"))
            and _norm(t.get("counterparty_country"))
            and _norm(t.get("counterparty_country")) not in HOME_COUNTRIES]
    out = []
    for o in outs:
        window = [t for t in ins if 0 <= (_d(o["date"]) - _d(t["date"])).days <= FUNNEL_WINDOW_D]
        sources = {_norm(t.get("counterparty")) for t in window}
        inflow = sum(_amt(t) for t in window)
        if len(sources) >= FUNNEL_MIN_SOURCES and inflow > 0 and _amt(o) >= FUNNEL_SHARE * inflow:
            out.append(_alert("FUNNEL", "HIGH", o,
                f"{len(sources)} payers sent {inflow:,.0f} AED within {FUNNEL_WINDOW_D}d, then "
                f"{_amt(o):,.0f} AED went to {o.get('counterparty', '?')} in "
                f"{o.get('counterparty_country')} — possible collect-and-funnel (TF)"))
    return out


def _party_country(p):
    c = str(p.get("country") or "").strip().lower()
    if len(c) == 2:
        return c
    bic = str(p.get("bic") or "").strip().upper()
    if len(bic) in (8, 11) and bic[4:6].isalpha():
        return bic[4:6].lower()
    return _norm(p.get("country_name"))


def rule_multi_jurisdiction(txns):
    """One payment whose chain (originator, banks, beneficiary) touches
    MULTI_JURISDICTION_MIN or more countries — layering or third-country
    routing to distance a payment from its real origin or destination."""
    out = []
    for t in txns:
        countries = {_party_country(p) for p in (t.get("parties") or [])} - {""}
        if len(countries) >= MULTI_JURISDICTION_MIN:
            out.append(_alert("MULTI_JURISDICTION", "MEDIUM", t,
                f"payment chain spans {len(countries)} countries "
                f"({', '.join(sorted(c.upper() for c in countries))}) — confirm the commercial "
                "reason for the routing"))
    return out


def rule_reference_keyword(txns):
    """Payment reference / purpose wording tied to a red flag (concealed
    commission, NPO funnelling, informal value transfer). A prompt to check
    the justification — not a finding of wrongdoing."""
    out = []
    for t in txns:
        text = " ".join(str(t.get(k) or "") for k in ("remittance_info", "purpose")).lower()
        if not text.strip():
            continue
        for label, words in REFERENCE_KEYWORDS.items():
            hit = next((w for w in words if re.search(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])", text)), None)
            if hit:
                out.append(_alert("REFERENCE_KEYWORD", "MEDIUM", t,
                    f"payment reference/purpose says \"{hit}\" — {label}; confirm the "
                    "justification and the recipient"))
    return out


def rule_personal_account(txns):
    """Corporate transaction paid from a personal account, as recorded."""
    return [_alert("PERSONAL_ACCOUNT", "HIGH", t,
            "corporate transaction funded from a personal account — obtain a legitimate explanation")
            for t in txns if t.get("personal_account_for_corporate") is True]


def rule_cash_no_source_of_funds(txns):
    """Cash at/above the CDD trigger with the source of funds recorded as NOT
    verified — cash converted into gold without a credible source."""
    return [_alert("CASH_NO_SOURCE_OF_FUNDS", "HIGH", t,
            f"cash {_amt(t):,.0f} AED with source of funds not verified — verify before "
            "completing; assess STR/SAR if it cannot be")
            for t in txns if _norm(t.get("method")) == "cash"
            and _amt(t) >= CDD_TRIGGER_THRESHOLD and t.get("source_of_funds_verified") is False]


def _amount_readable(t):
    v = t.get("amount")
    if v is None or isinstance(v, bool):
        return False
    try:
        f = float(v)
    except (TypeError, ValueError):
        return False
    return math.isfinite(f) and f >= 0


def rule_amount_not_comparable(txns):
    """A payment whose amount the AED-denominated rules cannot use. The file
    feed refuses these at ingestion (txn_feed.validate_batch); the Payments
    Register path did not, so "Amount: AED 60,000" was dropped and
    "Currency: USD" with "Amount: 20000" (≈ AED 73,450) was compared to the
    AED 55,000 DPMSR threshold as 20,000 — both silently missing THRESHOLD.
    Activity records carry no amount by design, and raw payment messages are
    judged after payment_screen.monitoring_records expands them."""
    out = []
    for t in txns:
        if t.get("activity_only") or t.get("payment_message"):
            continue
        cur = _norm(t.get("currency"))
        if not _amount_readable(t):
            out.append(_alert("AMOUNT_UNREADABLE", "HIGH", t,
                "amount missing or not a number — threshold, structuring and CDD rules "
                "could not evaluate this payment; record the AED amount as digits"))
        elif cur and cur != "aed":
            out.append(_alert("NON_AED_AMOUNT", "HIGH", t,
                f"amount {_amt(t):,.2f} recorded in {cur.upper()} — the DPMSR / CDD thresholds "
                "are in AED, so they were not reliably applied; convert with an approved "
                "documented rate and assess against AED 55,000 (POL-19 §3)"))
    return out


def rule_date_unreadable(txns):
    """A payment whose date the time-window rules cannot read. STRUCTURING,
    LINKED_THRESHOLD, VELOCITY, rapid pass-through, circular flow, funnel and
    rapid resale silently skip a record without an ISO date, so three AED
    52,000 cash payments in three days dated "01/10/2026" raised no
    STRUCTURING at all. The date is never guessed (day/month order is
    ambiguous); the payment is flagged so the MLRO sees what was not
    evaluated. Activity records and raw payment messages are not judged."""
    return [_alert("DATE_UNREADABLE", "HIGH", t,
            f"date {str(t.get('date') or '').strip() or 'not recorded'!r} is not YYYY-MM-DD — "
            "structuring, linked-threshold, velocity and other time-window rules could not "
            "evaluate this payment; record the date as YYYY-MM-DD")
            for t in txns
            if not (t.get("activity_only") or t.get("payment_message")) and not _d(t.get("date"))]


def rule_direction_unrecognised(txns):
    """A payment whose direction is missing or is not a known label for in or
    out. Pass-through, round-trip and funnel rules key on the direction, and the
    register picks the counterparty (whose country the geography rules read)
    by it. Activity records and raw payment messages are not judged."""
    return [_alert("DIRECTION_UNRECOGNISED", "HIGH", t,
            f"direction {str(t.get('direction') or '').strip() or 'not recorded'!r} is not in or "
            "out — pass-through, round-trip and funnel rules could not evaluate this payment and "
            "the counterparty may be the wrong party; record Direction: in | out")
            for t in txns
            if not (t.get("activity_only") or t.get("payment_message"))
            and _norm(t.get("direction")) not in ("in", "out")]


def rule_method_unrecognised(txns):
    """A payment whose method is missing or is not a known label for cash,
    wire or gold. The DPMSR threshold, structuring and cash rules key on the
    method, so such a payment is never assessed for them. Activity records and
    raw payment messages are not judged."""
    return [_alert("METHOD_UNRECOGNISED", "HIGH", t,
            f"method {str(t.get('method') or '').strip() or 'not recorded'!r} is not cash, wire "
            "or gold — the DPMSR threshold, structuring and cash rules could not evaluate this "
            "payment; record Method: cash | wire | gold")
            for t in txns
            if not (t.get("activity_only") or t.get("payment_message"))
            and _norm(t.get("method")) not in KNOWN_METHODS]


def rule_customer_not_in_db(txns):
    """A payment or activity task whose customer matches no Customer Database
    record (set by the daily run's resolver). No CDD file means no profile to
    monitor against — the dealing itself is the R.10 gap. Records the resolver
    never saw (no customer_in_db key, e.g. a file feed) are not judged."""
    return [_alert("CUSTOMER_NOT_IN_DB", "HIGH", t,
            "customer is not in the Customer Database — no CDD record on file; identify, verify "
            "and onboard before completing, or link the task to the correct customer (R.10)")
            for t in txns if t.get("customer_in_db") is False]


def load_red_flags():
    """code -> flag, from the STR and SAR registers (data/str-red-flags.json,
    data/sar-red-flags.json). Raises if either is missing or malformed (the
    rule error is counted, never a silent pass)."""
    if not _RED_FLAGS:
        loaded = {}
        for path in (RED_FLAGS_PATH, SAR_RED_FLAGS_PATH):
            with open(path, encoding="utf-8") as fh:
                doc = json.load(fh)
            cats, reg = doc["categories"], doc["register"]
            for f in doc["flags"]:
                loaded[f["code"]] = {**f, "register": reg, "category_label": cats[f["category"]]}
        _RED_FLAGS.update(loaded)
    return _RED_FLAGS


def normalise_flag_code(code):
    """'ml-11' / 'STR-ML-11' -> 'STR-ML-11'; 'sar-cb-3' -> 'SAR-CB-03'."""
    parts = str(code or "").strip().upper().split("-")
    if len(parts) == 2:
        parts = ["STR"] + parts            # bare codes are the STR register's
    if len(parts) != 3 or not parts[2].isdigit():
        return str(code or "").strip().upper()
    return f"{parts[0]}-{parts[1]}-{int(parts[2]):02d}"


def red_flag_refs(rule):
    """Codes of the catalogued red flags this rule detects (for the report)."""
    return [c for c, f in load_red_flags().items() if rule in f.get("detected_by", [])]


def rule_red_flag_recorded(txns):
    """Red flags a person recorded on a payment or activity task ('Red flags:
    STR-ML-11, SAR-CB-03'; a bare 'ML-11' is the STR register's). STR TF / PF /
    sanctions-evasion and SAR sanctions / TF / PF flags are CRITICAL: they can
    be a TFS event, not only an STR/SAR."""
    catalogue = load_red_flags()
    out = []
    for t in txns:
        for code in t.get("red_flags") or []:
            f = catalogue.get(normalise_flag_code(code))
            if f is None:
                out.append(_alert("RED_FLAG", "HIGH", t,
                    f"unknown red-flag code '{code}' — correct it (STR-.. / SAR-.. codes in the "
                    "red-flag registers)"))
                continue
            tfs = f["category"] in TFS_FLAG_CATEGORIES.get(f["register"], set())
            out.append(_alert("RED_FLAG", "CRITICAL" if tfs else "HIGH", t,
                f"{f['code']} ({f['category_label']}): {f['text']} — "
                + ("apply POL-07 if a designated party may be involved; assess STR/SAR"
                   if tfs else "assess STR/SAR")))
    return out


_RULES = [rule_threshold, rule_structuring, rule_velocity,
          rule_high_risk_counterparty, rule_rapid_passthrough,
          rule_cdd_trigger, rule_round_amount_cash,
          rule_third_party_payment, rule_refund_diversion,
          rule_pricing_deviation, rule_phantom_delivery,
          rule_invoice_mismatch, rule_route_mismatch,
          rule_profile_deviation, rule_circular_flow, rule_new_geography,
          rule_rapid_resale, rule_funnel, rule_multi_jurisdiction,
          rule_reference_keyword, rule_personal_account, rule_linked_threshold,
          rule_cash_no_source_of_funds, rule_red_flag_recorded, rule_customer_not_in_db,
          rule_amount_not_comparable, rule_date_unreadable,
          rule_method_unrecognised, rule_direction_unrecognised]


def _any_customer(txns):
    for t in txns:
        if t.get("customer"):
            return t["customer"]
    return "?"


def _alert(rule, severity, t, detail):
    return {"rule": rule, "severity": severity,
            "customer": t.get("customer", "?"), "date": t.get("date", ""),
            "amount": _amt(t) if "amount" in t else None, "detail": detail,
            # links the alert back to its payment / activity task, when known
            "transaction_id": t.get("transaction_id", ""), "permalink": t.get("permalink", "")}


_AGENT_ROLES = {"ordering_institution", "senders_correspondent", "receivers_correspondent",
                "intermediary", "account_with_institution"}


# Payment-method labels people actually type on a Payments Register task or a
# feed export, mapped to the three values the rules key on. Only unambiguous
# synonyms: anything else stays as recorded and raises METHOD_UNRECOGNISED,
# because "cash deposit" or "bank transfer" falling outside the exact words
# "cash" / "wire" silently dropped the DPMSR THRESHOLD, STRUCTURING and the
# cash rules for an AED 60,000 payment.
_METHOD_SYNONYMS = {
    "cash": "cash", "cash deposit": "cash", "cash payment": "cash",
    "cash deposited": "cash", "banknotes": "cash", "bank notes": "cash",
    "currency notes": "cash",
    "wire": "wire", "wire transfer": "wire", "bank transfer": "wire",
    "bank wire": "wire", "swift": "wire", "swift transfer": "wire",
    "tt": "wire", "telegraphic transfer": "wire", "international transfer": "wire",
    "remittance": "wire", "transfer": "wire",
    "gold": "gold",
}
KNOWN_METHODS = frozenset(_METHOD_SYNONYMS.values())


def _canonical_method(raw):
    """'Cash (AED notes)' -> 'cash'; 'Bank transfer' -> 'wire'; else ''."""
    s = re.sub(r"\([^)]*\)", " ", str(raw or "")).lower()
    s = " ".join(re.sub(r"[^a-z ]", " ", s).split())
    return _METHOD_SYNONYMS.get(s, "")


def _with_canonical_method(t):
    """Copy of t whose method is cash/wire/gold when the recorded label is a
    known synonym. The recorded label is kept in method_recorded."""
    if not isinstance(t, dict):
        return t
    m = _canonical_method(t.get("method"))
    if not m or m == t.get("method"):
        return t
    return dict(t, method=m, method_recorded=t.get("method"))


def _with_canonical_direction(t):
    """Copy of t whose direction is in/out when the recorded label is a known
    synonym. The recorded label is kept in direction_recorded."""
    if not isinstance(t, dict):
        return t
    d = canonical_direction(t.get("direction"))
    if not d or d == t.get("direction"):
        return t
    return dict(t, direction=d, direction_recorded=t.get("direction"))


def _with_counterparty_country(t):
    """The rules read counterparty_country as a jurisdiction NAME. The feed
    schema also allows parties[] with ISO alpha-2 countries, which no rule
    read: an AED 200,000 wire to an Iranian beneficiary in parties[] raised no
    DPMSR THRESHOLD and no HIGH_RISK_GEO, and counterparty_country "IR" missed
    the jurisdiction table. Fill the field from parties[] when absent and map
    an ISO code to the table's name. Returns a copy; the input is untouched."""
    if not isinstance(t, dict):
        return t
    c = str(t.get("counterparty_country") or "").strip()
    cp = t.get("counterparty")
    if not c:
        parties = [p for p in (t.get("parties") or []) if isinstance(p, dict)]
        foreign = sorted((p for p in parties
                          if _norm(p.get("country_name") or p.get("country"))
                          and _norm(p.get("country_name") or p.get("country")) not in HOME_COUNTRIES),
                         key=lambda p: p.get("role") in _AGENT_ROLES)
        if not foreign:
            return t
        c = str(foreign[0].get("country_name") or foreign[0].get("country")).strip()
        cp = cp or foreign[0].get("name") or foreign[0].get("bic")
    if len(c) == 2 and c.isalpha():
        import payment_screen
        c = payment_screen.ISO2_TO_JURISDICTION.get(c.upper(), c.upper())
    if c == t.get("counterparty_country") and cp == t.get("counterparty"):
        return t
    out = dict(t, counterparty_country=c)
    if cp:
        out["counterparty"] = cp
    return out


def evaluate_customer(txns, jurisdiction_table=None, rule_errors=None):
    """Run all rules over ONE customer's transactions. Returns a list of alerts.
    A crashing rule never blocks the others, but its failure is COUNTED (via the
    optional rule_errors dict) so a rule that silently produces no alerts because
    it crashes on every customer is visible, not a silent all-clear."""
    alerts = []
    txns = [_with_canonical_direction(_with_canonical_method(_with_counterparty_country(t)))
            for t in txns]
    for rule in _RULES:
        try:
            if rule is rule_high_risk_counterparty:
                alerts += rule(txns, jurisdiction_table)
            else:
                alerts += rule(txns)
        except Exception:
            if rule_errors is not None:
                rule_errors[getattr(rule, "__name__", "rule")] = rule_errors.get(getattr(rule, "__name__", "rule"), 0) + 1
            continue  # a rule error never blocks the others
    return alerts


def evaluate(transactions, jurisdiction_table=None):
    """Group by customer and evaluate. Returns {configured, n_txns, n_customers,
    alerts:[...], by_severity:{...}, rule_errors:{...}}. With no feed:
    configured=False, alerts=[]."""
    txns = transactions or []
    by_customer = defaultdict(list)
    for t in txns:
        by_customer[t.get("customer", "?")].append(t)
    alerts = []
    rule_errors = {}
    for cust, ctx in by_customer.items():
        alerts += evaluate_customer(ctx, jurisdiction_table, rule_errors)
    sev_rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    alerts.sort(key=lambda a: sev_rank.get(a["severity"], 0), reverse=True)
    by_sev = defaultdict(int)
    for a in alerts:
        by_sev[a["severity"]] += 1
    return {"configured": bool(transactions) or feed_configured(),
            "n_txns": len(txns), "n_customers": len(by_customer),
            "alerts": alerts, "by_severity": dict(by_sev), "rule_errors": rule_errors}


def status_line():
    """One line for the report / monitoring section. Honest about the feed."""
    if TXN_FEED_PATH and not os.path.exists(TXN_FEED_PATH):
        return ("Transaction monitoring (R.16): DEGRADED — configured transaction "
                "feed file is missing; investigate the source/landing zone outage.")
    if feed_configured():
        if feed_parse_error():
            return ("Transaction monitoring (R.16): DEGRADED — configured feed or "
                    "authenticated completeness manifest failed validation. "
                    "No transactions were screened from this file this run; "
                    "investigate the source and manifest before relying on it.")
        res = evaluate(load_transactions())
        errs = res.get("rule_errors") or {}
        warn = (f"  ⚠ {sum(errs.values())} rule error(s) [{', '.join(sorted(errs))}] — "
                "some typologies did not run this run" if errs else "")
        return (f"Transaction monitoring (R.16): ACTIVE — {res['n_txns']} txns / "
                f"{res['n_customers']} customers → {len(res['alerts'])} alert(s).{warn}")
    return ("Transaction monitoring (R.16): engine ready & tested, INACTIVE — no "
            "transaction feed connected (set TXN_FEED_PATH). No transaction data is "
            "screened or reported until a real feed is configured.")
