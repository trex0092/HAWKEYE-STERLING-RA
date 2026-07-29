#!/usr/bin/env python3
"""
HAWKEYE STERLING — DAILY SANCTIONS SCREENING + ADVERSE MEDIA
Hawkeye Sterling V2 — screen.py v3.0
==========================================
Modes:
  full_batch     : daily 06:00 + 18:00 UAE — sanctions + adverse media on flagged
  weekly_adverse : every Monday — adverse media on ALL 324 customers
"""

import os, sys, re, csv, json, hashlib, unicodedata, io, datetime, requests, time, html
import threading
import functools
import xml.etree.ElementTree as ET
import concurrent.futures

# How many subjects to enrich (adverse media + PEP) in parallel. The sweep is
# network-bound, so a bounded thread pool cuts wall-clock from hours to minutes
# without raising the per-host request RATE much (each worker still paces itself).
SCREEN_CONCURRENCY = int(os.environ.get("SCREEN_CONCURRENCY", "8"))
import ai      # AI layer — risk rating, adverse triage, summaries, transliteration, governance
import agents  # Agentic operating model — identity/authorization, audit trail, QA gate
import kyc      # KYC/identity layer — FATF R.10 (CDD) + R.25 (legal arrangements)
import txn_monitor  # FATF R.16 transaction-monitoring engine (inert until a feed is configured)
import monitoring   # Runtime metrics + source-coverage drift detection

try:
    from rapidfuzz import fuzz
    import pdfplumber
except ImportError:
    # Fallback for environments where deps were not pre-installed. Install the
    # PINNED versions from requirements.txt (single source of truth) via the
    # current interpreter — never an unpinned, shell-invoked `pip install`.
    import subprocess
    import sys
    _req = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ci", "requirements.txt")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", _req], check=False)
    from rapidfuzz import fuzz
    import pdfplumber

# ── CONFIG ────────────────────────────────────────────────────────────────────
# Asana credential — accept EITHER name. The .mjs scripts, every workflow and
# .env.example all use ASANA_ACCESS_TOKEN; screen.py alone required ASANA_TOKEN
# and read it with an unguarded os.environ[...] AT IMPORT, so copying
# .env.example to .env and running `python screen.py` raised KeyError before a
# line of the engine ran. Four call sites that only want the matcher worked
# around it by injecting a placeholder credential.
#
# The import no longer fails. The safety the hard failure provided — never call
# Asana unauthenticated — moves to asana_request(), the single call path, where
# it belongs: a missing credential now fails at the moment Asana is actually
# used, with a message that says why it matters, instead of blocking consumers
# that never touch Asana at all.
#
# Resolution is normalised back into the environment so agents.py's credential
# broker (which audits presence BY NAME) and any subprocess see one name.
ASANA_TOKEN           = os.environ.get("ASANA_TOKEN") or os.environ.get("ASANA_ACCESS_TOKEN") or ""
if ASANA_TOKEN:
    os.environ["ASANA_TOKEN"] = ASANA_TOKEN
TRIGGER_TYPE          = os.environ.get("TRIGGER_TYPE", "workflow_dispatch")
RUN_MODE              = os.environ.get("RUN_MODE", "full_batch")  # full_batch | weekly_adverse

ASANA_CUSTOMER_DB_GID = "1214107620220121"
ASANA_ONGOING_MON_GID = "1213914392047129"
ASANA_SECTION_GID     = "1213914392047131"   # Daily Sanctions Screening section
# ── Second screening population + second delivery queue (MLRO, 2026-07-29) ──
# Screening reads BOTH populations: the Customer Database (customers + their
# UBOs/owners) and the HR – Employees project (staff screening — FATF R.18 /
# CR 134/2025 employee due diligence). Set ASANA_EMPLOYEE_DB_GID empty to
# disable employee screening explicitly; an unreachable or empty project while
# configured is FATAL, exactly like the customer database — a screening
# population that silently drops out is a silent clear.
ASANA_EMPLOYEE_DB_GID = os.environ.get("ASANA_EMPLOYEE_DB_GID", "1216139945846994")
# Every daily deliverable is multi-homed into BOTH MLRO queues: Ongoing
# Monitoring (the review record) and Follow Ups (the action queue). One task,
# two projects — Asana multi-homing, so there is a single audit trail.
ASANA_FOLLOWUPS_GID = os.environ.get("ASANA_FOLLOWUPS_GID", "1215884707932023")
ASANA_FOLLOWUPS_SECTION_GID = os.environ.get("ASANA_FOLLOWUPS_SECTION_GID", "1215884707932047")

def _mlro_queue_targets():
    """projects + memberships for a daily deliverable, multi-homed into every
    configured MLRO queue. Failure to reach ANY queue is a delivery failure."""
    projects = [ASANA_ONGOING_MON_GID]
    memberships = [{"project": ASANA_ONGOING_MON_GID, "section": ASANA_SECTION_GID}]
    if ASANA_FOLLOWUPS_GID:
        projects.append(ASANA_FOLLOWUPS_GID)
        m = {"project": ASANA_FOLLOWUPS_GID}
        if ASANA_FOLLOWUPS_SECTION_GID:
            m["section"] = ASANA_FOLLOWUPS_SECTION_GID
        memberships.append(m)
    return projects, memberships
ASANA_ASSIGNEE_GID    = "1213645083721304"   # default case/OM assignee (MLRO)

# ── Match thresholds — env-tunable, ONE-WAY (challenger runs more sensitive
# only, per docs/governance/champion-challenger-thresholds.md). A value ABOVE
# the champion default would weaken screening, so it is rejected loudly unless
# MATCH_THRESHOLD_ALLOW_RAISE=1 is set as an explicit, separate decision.
# Invalid values never silently change matching — loud reject, default kept
# (mirrors scripts/sanctions-screen.mjs resolveThreshold).
def _resolve_match_threshold(env_name, default, lo=70, hi=100):
    raw = os.environ.get(env_name, "")
    if not str(raw).strip():
        return default
    try:
        v = float(raw)
    except ValueError:
        v = None
    if v is None or not (lo <= v <= hi):
        print(f"{env_name}={raw!r} is not a number in [{lo},{hi}] — using the champion "
              f"default {default} so matching is never silently weakened", flush=True)
        return default
    if v > default and os.environ.get("MATCH_THRESHOLD_ALLOW_RAISE", "0") != "1":
        print(f"{env_name}={raw!r} would RAISE the cutoff above the champion default "
              f"{default} (less sensitive screening). One-way rule: raises require "
              f"MATCH_THRESHOLD_ALLOW_RAISE=1 — using the default", flush=True)
        return default
    return v

THRESHOLD             = _resolve_match_threshold("MATCH_THRESHOLD", 85)              # combined (full + core) similarity to flag a match
CORE_THRESHOLD        = _resolve_match_threshold("MATCH_CORE_THRESHOLD", 82)         # distinctive-token similarity required (false-positive guard)
SHORT_ENTRY_THRESHOLD = _resolve_match_threshold("MATCH_SHORT_ENTRY_THRESHOLD", 97)  # near-exact gate for short (<6 char) designated names (HAMAS, IRISL …)
TOKENSET_THRESHOLD    = _resolve_match_threshold("MATCH_TOKENSET_THRESHOLD", 93)     # strict additive gate: token-set (subset/patronymic) recall without FP blow-up

# ── Shadow challenger (docs/governance/champion-challenger-thresholds.md §3) ──
# SHADOW_THRESHOLD (0-100, must sit below MATCH_THRESHOLD) turns on a LOG-ONLY
# challenger band: a (subject, entry) pair whose min(full, core) lands in
# [shadow, THRESHOLD) and fails every champion gate is counted and logged —
# never a hit, never a case, never in the delta state. This is the evidence
# feed the champion/challenger decision log needs before any live threshold
# change. Off unless explicitly set; invalid values reject loudly to off.
def _resolve_shadow_threshold():
    raw = os.environ.get("SHADOW_THRESHOLD", "")
    if not str(raw).strip():
        return None
    try:
        v = float(raw)
    except ValueError:
        v = None
    if v is None or not (70 <= v < THRESHOLD):
        print(f"SHADOW_THRESHOLD={raw!r} is not a number in [70, {THRESHOLD}) — shadow "
              f"challenger disabled (it never changes live matching either way)", flush=True)
        return None
    return v

SHADOW_THRESHOLD_VALUE = _resolve_shadow_threshold()
_SHADOW_CHALLENGER = {"count": 0, "examples": []}   # run-level tally (log-only evidence)
_SHADOW_LOG_CAP = 25                                 # bounded example log lines per run
EOCN_PDF_PATH         = "eocn_list.pdf"
EOCN_JSON_PATH        = "data/eocn-local-terrorist-list.json"
INTERNAL_WATCHLIST_PATH = "data/internal-watchlist.json"
DELTA_STATE_PATH      = "data/screen-delta-state.json"  # what we've already reported (delta engine)
UAE_TZ_OFFSET         = 4
ONBOARDING_WINDOW_HOURS = int(os.environ.get("ONBOARDING_WINDOW_HOURS", "26"))  # "new customer" window
CASE_SUBTASK_CAP        = int(os.environ.get("CASE_SUBTASK_CAP", "40"))         # max MLRO case subtasks/run

# Common corporate / legal-form / sector boilerplate that inflates name-match
# scores between two completely different companies (e.g. two Turkish firms that
# merely share "SANAYI VE TICARET ANONIM SIRKETI"). Stripped to a distinctive
# "core" before a second, decisive similarity check. NOT applied to the stored
# list (only to the comparison), so designations are never weakened.
STOPWORD_TOKENS = {
    # legal forms
    "LLC","L","C","LTD","LIMITED","INC","CORP","CORPORATION","CO","COMPANY",
    "PLC","GMBH","SA","SARL","SRL","SPA","BV","NV","AG","PTE","PVT","PJSC","PSC",
    "FZE","FZCO","FZC","DMCC","DWC","FZ","JLT","WLL","EST","TRADING","GENERAL",
    # UAE / GCC free-zone & generic
    "INTERNATIONAL","GROUP","HOLDING","HOLDINGS","ENTERPRISE","ENTERPRISES",
    "INDUSTRIES","INDUSTRY","COMMODITIES","GLOBAL","OVERSEAS","COMMERCIAL",
    "BUSINESS","SERVICES","SOLUTIONS","INVESTMENT","INVESTMENTS","CAPITAL",
    # Turkish corporate boilerplate (very common in this book of business)
    "ANONIM","SIRKETI","SIRKET","SANAYI","SANAYII","TICARET","VE","URETIM",
    "MADENCILIK","ENERJI","TURIZM","INSAAT","ITHALAT","IHRACAT","LIMITED",
    "GAYRIMENKUL","YATIRIM","KIYMETLI","MADENLER","METAL","ALTIN",
    # generic connectors
    "AND","OF","THE","FOR","AL","BIN","BINT",
}

# Map an adverse-media keyword to a typology bucket for MLRO triage.
KEYWORD_TYPOLOGY = [
    ("Terrorism / CFT", ["terror","terrorist financing","financing of terrorism","terror funding",
        "extremist","radicalis","radicaliz","militant","designated terrorist"]),
    ("Sanctions / Proliferation", ["sanction","embargo","proliferation","weapons of mass destruction",
        "wmd","dual-use","nuclear","chemical weapons","biological weapons","arms trafficking",
        "weapons smuggling","debarred","blacklisted"]),
    ("Money Laundering", ["launder","money laundering"]),
    ("Fraud / Financial Crime", ["fraud","ponzi","pyramid scheme","insider trading","market manipulation",
        "accounting fraud","asset misappropriation","misuse of funds","embezzle","forgery","counterfeit",
        "identity theft","cyber fraud","wire fraud","financial crime","economic crime"]),
    ("Tax", ["tax evasion","tax fraud","vat fraud"]),
    ("Bribery / Corruption", ["bribe","bribery","corrupt","corruption","kickback","kleptocracy",
        "state capture","abuse of power","conflict of interest"]),
    ("Organised Crime / Trafficking", ["organised crime","organized crime","mafia","cartel",
        "drug trafficking","narcotics","human trafficking","people smuggling","wildlife trafficking",
        "smuggl","contraband","illicit"]),
    ("Cyber", ["cybercrime","ransomware","darknet"]),
    ("ESG / Human Rights / Minerals", ["human rights","forced labour","forced labor","modern slavery",
        "child labour","child labor","labour exploitation","exploitation","conflict minerals",
        "conflict gold","blood diamond","illegal mining","smuggled gold","gold smuggling",
        "environmental violation","pollution","toxic waste","deforestation","land grabbing",
        "indigenous rights","greenwashing"]),
    ("Enforcement / Legal", ["arrest","convict","guilty","verdict","prosecute","indict","court case",
        "litigate","lawsuit","felon","imprisonment","jail","prison","theft","murder","fined",
        "extort","blackmail","regulatory breach"]),
]

def typology_for(keywords):
    """Buckets a list of matched adverse keywords into typology categories."""
    cats = []
    for cat, terms in KEYWORD_TYPOLOGY:
        if any(any(t in kw for t in terms) for kw in keywords):
            cats.append(cat)
    return cats

ASANA_HEADERS = {
    "Authorization": f"Bearer {ASANA_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# Google News RSS — worldwide locale matrix (36 country/language editions), so
# adverse coverage can be swept from every part of the world, not just English.
# Each entry is (hl, gl, ceid, lang). ADVERSE_LOCALES sweeps the FIRST N (default
# 5). The first five deliberately preserve the historic order — US / GB / AE(en)
# / TR / AE(ar) — so the default run is behaviour-identical, and index 4 stays
# the AE:ar edition (the targeted Arabic pass slices GNEWS_URLS[4:5]). Raise
# ADVERSE_LOCALES (env) up to 36 for a full global sweep; matched multilingually.
GNEWS_LOCALES = [
    # historic default sweep (order preserved — do not reorder these five)
    ("en-US", "US", "US:en", "en"),
    ("en-GB", "GB", "GB:en", "en"),
    ("en-AE", "AE", "AE:en", "en"),
    ("tr",    "TR", "TR:tr", "tr"),
    ("ar",    "AE", "AE:ar", "ar"),
    # English — additional regional editions (local press differs by market)
    ("en-IN", "IN", "IN:en", "en"),
    ("en-SG", "SG", "SG:en", "en"),
    ("en-AU", "AU", "AU:en", "en"),
    ("en-NG", "NG", "NG:en", "en"),
    ("en-ZA", "ZA", "ZA:en", "en"),
    ("en-PK", "PK", "PK:en", "en"),
    ("en-PH", "PH", "PH:en", "en"),
    # Arabic
    ("ar",    "SA", "SA:ar", "ar"),
    ("ar",    "EG", "EG:ar", "ar"),
    # Spanish
    ("es",     "ES", "ES:es",     "es"),
    ("es-419", "MX", "MX:es-419", "es"),
    ("es-419", "AR", "AR:es-419", "es"),
    # French
    ("fr",    "FR", "FR:fr", "fr"),
    ("fr",    "CA", "CA:fr", "fr"),
    # German
    ("de",    "DE", "DE:de", "de"),
    ("de",    "CH", "CH:de", "de"),
    # Portuguese
    ("pt-BR", "BR", "BR:pt-419", "pt"),
    ("pt-PT", "PT", "PT:pt-150", "pt"),
    # Russian / Ukrainian
    ("ru",    "RU", "RU:ru", "ru"),
    ("uk",    "UA", "UA:uk", "uk"),
    # Chinese (Simplified / Traditional)
    ("zh-CN", "CN", "CN:zh-Hans", "zh"),
    ("zh-TW", "TW", "TW:zh-Hant", "zh"),
    ("zh-HK", "HK", "HK:zh-Hant", "zh"),
    # Other major languages
    ("it",    "IT", "IT:it", "it"),
    ("ja",    "JP", "JP:ja", "ja"),
    ("ko",    "KR", "KR:ko", "ko"),
    ("hi",    "IN", "IN:hi", "hi"),
    ("id",    "ID", "ID:id", "id"),
    ("fa",    "IR", "IR:fa", "fa"),
    ("ur",    "PK", "PK:ur", "ur"),
    ("nl",    "NL", "NL:nl", "nl"),
    # ── Extended worldwide coverage (weaponised global sweep) ──
    # More MENA / Gulf markets (local Arabic press differs by state)
    ("ar",    "QA", "QA:ar", "ar"),
    ("ar",    "KW", "KW:ar", "ar"),
    ("ar",    "BH", "BH:ar", "ar"),
    ("ar",    "OM", "OM:ar", "ar"),
    ("ar",    "JO", "JO:ar", "ar"),
    ("ar",    "LB", "LB:ar", "ar"),
    ("ar",    "IQ", "IQ:ar", "ar"),
    ("ar",    "MA", "MA:ar", "ar"),
    ("ar",    "DZ", "DZ:ar", "ar"),
    ("he",    "IL", "IL:he", "he"),
    # More Asia
    ("th",    "TH", "TH:th", "th"),
    ("vi",    "VN", "VN:vi", "vi"),
    ("ms",    "MY", "MY:ms", "ms"),
    ("bn",    "BD", "BD:bn", "bn"),
    ("en-IN", "LK", "LK:en", "en"),
    # More Europe
    ("pl",    "PL", "PL:pl", "pl"),
    ("sv",    "SE", "SE:sv", "sv"),
    ("el",    "GR", "GR:el", "el"),
    ("ro",    "RO", "RO:ro", "ro"),
    ("cs",    "CZ", "CZ:cs", "cs"),
    # More Africa
    ("en-KE", "KE", "KE:en", "en"),
    ("en-GH", "GH", "GH:en", "en"),
    ("en-TZ", "TZ", "TZ:en", "en"),
    # More Latin America
    ("es-419", "CO", "CO:es-419", "es"),
    ("es-419", "CL", "CL:es-419", "es"),
    ("es-419", "PE", "PE:es-419", "es"),
    # Nordics / Central & Eastern Europe / Balkans
    ("no",    "NO", "NO:no", "no"),
    ("da",    "DK", "DK:da", "da"),
    ("fi",    "FI", "FI:fi", "fi"),
    ("hu",    "HU", "HU:hu", "hu"),
    ("sk",    "SK", "SK:sk", "sk"),
    ("bg",    "BG", "BG:bg", "bg"),
    ("sr",    "RS", "RS:sr", "sr"),
    # South & Southeast Asia + Sub-Saharan Africa
    ("tl",    "PH", "PH:tl", "tl"),
    ("sw",    "KE", "KE:sw", "sw"),
    ("sw",    "TZ", "TZ:sw", "sw"),
    ("ta",    "IN", "IN:ta", "ta"),
    ("en-NG", "UG", "UG:en", "en"),
]
# Derived URL templates ({query} is filled per-request via .format). The literal
# {query} is preserved; hl/gl/ceid are baked in per locale.
GNEWS_URLS = [
    "https://news.google.com/rss/search?q={query}&hl=%s&gl=%s&ceid=%s" % (hl, gl, ceid)
    for (hl, gl, ceid, _lang) in GNEWS_LOCALES
]

# Adverse media keywords — if headline contains any, flag it
ADVERSE_KEYWORDS = [
    # Sanctions / terrorism / proliferation
    "sanction", "sanctions evasion", "embargo", "designated terrorist",
    "terrorism", "terrorist financing", "financing of terrorism", "terror funding",
    "extremist", "radicalis", "radicaliz", "militant",
    "proliferation financing", "weapons of mass destruction", "wmd", "dual-use",
    "arms trafficking", "weapons smuggling", "nuclear", "chemical weapons",
    "biological weapons", "debarred", "blacklisted",
    # Money laundering / financial crime
    "launder", "money laundering", "financial crime", "economic crime",
    "tax evasion", "tax fraud", "vat fraud", "ponzi", "pyramid scheme",
    "insider trading", "market manipulation", "accounting fraud",
    "asset misappropriation", "misuse of funds", "embezzle", "kickback",
    "bribe", "bribery", "corrupt", "corruption", "kleptocracy", "state capture",
    "abuse of power", "conflict of interest", "fraud", "forgery", "counterfeit",
    "identity theft", "cyber fraud", "wire fraud", "extort", "blackmail",
    # Crime / enforcement / legal status
    "arrest", "convict", "guilty", "verdict", "prosecute", "indict",
    "court case", "litigate", "lawsuit", "felon", "imprisonment", "jail",
    "prison", "theft", "murder", "illegal", "unlawful", "breach",
    "regulatory breach", "fined", "politic",
    # Organised crime / trafficking / smuggling
    "organised crime", "organized crime", "mafia", "cartel", "drug trafficking",
    "narcotics", "human trafficking", "people smuggling", "wildlife trafficking",
    "smuggl", "contraband", "illicit",
    # Cyber
    "cybercrime", "ransomware", "darknet",
    # ESG / minerals / human rights
    "human rights", "forced labour", "forced labor", "modern slavery",
    "child labour", "child labor", "labour exploitation", "exploitation",
    "conflict minerals", "conflict gold", "blood diamond", "illegal mining",
    "smuggled gold", "gold smuggling", "environmental violation", "pollution",
    "toxic waste", "deforestation", "land grabbing", "indigenous rights",
    "esg", "greenwashing", "due diligence failure",
]

# Arabic-language risk terms — for a UAE deployment, adverse media often breaks in
# Arabic press first. Each maps to its English equivalent so typology bucketing and
# reporting stay uniform. Matched by substring against the raw headline — Arabic
# has no letter case, and \b word boundaries are unreliable in Arabic script.
ADVERSE_KEYWORDS_AR = {
    "احتيال": "fraud",
    "غسل الأموال": "money laundering",
    "غسيل الأموال": "money laundering",
    "غسل أموال": "money laundering",          # indefinite form (no ال) — common in press
    "عقوبات": "sanction",
    "إرهاب": "terrorism",
    "تمويل الإرهاب": "terrorist financing",
    "تمويل إرهاب": "terrorist financing",     # indefinite form
    "رشوة": "bribery",
    "فساد": "corruption",
    "اختلاس": "embezzle",
    "اعتقال": "arrest",
    "إدانة": "convict",
    "تهريب": "smuggl",
    "مخدرات": "narcotics",
    "تزوير": "forgery",
}

# Multilingual risk-term dictionaries — one map per language, each native term
# pointing at its English canonical so typology bucketing and reporting stay
# uniform no matter the source language. This is what "weaponises" the sweep
# globally: a wrongdoing headline in Spanish, Chinese, Russian, Turkish, etc. is
# recognised even when the English risk words never appear. Coverage per language:
# money laundering · fraud · sanctions · terrorism · terrorist financing · bribery
# · corruption · embezzlement · arrested · convicted (+ trafficking/smuggling).
# Matched diacritic-tolerantly: Latin-script terms use \b word boundaries on the
# lower-cased headline; non-Latin scripts (Cyrillic, CJK, Devanagari, Hangul,
# Arabic/Persian/Urdu) match by substring, where case and \b do not apply.
LANG_KEYWORDS = {
    "es": {  # Spanish
        "fraude": "fraud", "lavado de dinero": "money laundering",
        "blanqueo de capitales": "money laundering", "sanciones": "sanction",
        "terrorismo": "terrorism", "financiación del terrorismo": "terrorist financing",
        "soborno": "bribery", "corrupción": "corruption", "malversación": "embezzle",
        "detenido": "arrest", "condenado": "convict", "narcotráfico": "narcotics",
        "contrabando": "smuggl",
    },
    "fr": {  # French
        "fraude": "fraud", "blanchiment d'argent": "money laundering",
        "sanctions": "sanction", "terrorisme": "terrorism",
        "financement du terrorisme": "terrorist financing", "corruption": "corruption",
        "pot-de-vin": "bribery", "détournement de fonds": "embezzle",
        "arrêté": "arrest", "condamné": "convict", "trafic": "human trafficking",
        "contrebande": "smuggl",
    },
    "de": {  # German
        "betrug": "fraud", "geldwäsche": "money laundering", "sanktionen": "sanction",
        "terrorismus": "terrorism", "terrorismusfinanzierung": "terrorist financing",
        "bestechung": "bribery", "korruption": "corruption", "veruntreuung": "embezzle",
        "verhaftet": "arrest", "verurteilt": "convict", "schmuggel": "smuggl",
        "menschenhandel": "human trafficking",
    },
    "pt": {  # Portuguese
        "fraude": "fraud", "lavagem de dinheiro": "money laundering",
        "sanções": "sanction", "terrorismo": "terrorism",
        "financiamento do terrorismo": "terrorist financing", "suborno": "bribery",
        "corrupção": "corruption", "desvio de dinheiro": "embezzle", "preso": "arrest",
        "condenado": "convict", "tráfico": "human trafficking", "contrabando": "smuggl",
    },
    "ru": {  # Russian
        "мошенничество": "fraud", "отмывание денег": "money laundering",
        "санкции": "sanction", "терроризм": "terrorism",
        "финансирование терроризма": "terrorist financing", "взяточничество": "bribery",
        "коррупция": "corruption", "растрата": "embezzle", "арестован": "arrest",
        "осуждён": "convict", "контрабанда": "smuggl",
    },
    "zh": {  # Chinese (Simplified / Traditional)
        "欺诈": "fraud", "诈骗": "fraud", "洗钱": "money laundering", "制裁": "sanction",
        "恐怖主义": "terrorism", "恐怖融资": "terrorist financing", "贿赂": "bribery",
        "腐败": "corruption", "挪用公款": "embezzle", "被捕": "arrest", "定罪": "convict",
        "走私": "smuggl", "贩运": "human trafficking",
    },
    "it": {  # Italian
        "frode": "fraud", "riciclaggio di denaro": "money laundering",
        "sanzioni": "sanction", "terrorismo": "terrorism",
        "finanziamento del terrorismo": "terrorist financing", "corruzione": "corruption",
        "tangente": "bribery", "appropriazione indebita": "embezzle",
        "arrestato": "arrest", "condannato": "convict", "traffico": "human trafficking",
        "contrabbando": "smuggl",
    },
    "tr": {  # Turkish
        "dolandırıcılık": "fraud", "kara para aklama": "money laundering",
        "yaptırımlar": "sanction", "terörizm": "terrorism",
        "terörün finansmanı": "terrorist financing", "rüşvet": "bribery",
        "yolsuzluk": "corruption", "zimmet": "embezzle", "tutuklandı": "arrest",
        "mahkûm": "convict", "kaçakçılık": "smuggl",
    },
    "ja": {  # Japanese
        "詐欺": "fraud", "マネーロンダリング": "money laundering", "資金洗浄": "money laundering",
        "制裁": "sanction", "テロ": "terrorism", "テロ資金供与": "terrorist financing",
        "贈収賄": "bribery", "汚職": "corruption", "横領": "embezzle", "逮捕": "arrest",
        "有罪": "convict", "密輸": "smuggl",
    },
    "ko": {  # Korean
        "사기": "fraud", "자금세탁": "money laundering", "제재": "sanction",
        "테러": "terrorism", "테러자금": "terrorist financing", "뇌물": "bribery",
        "부패": "corruption", "횡령": "embezzle", "체포": "arrest", "유죄": "convict",
        "밀수": "smuggl",
    },
    "hi": {  # Hindi
        "धोखाधड़ी": "fraud", "मनी लॉन्ड्रिंग": "money laundering", "प्रतिबंध": "sanction",
        "आतंकवाद": "terrorism", "आतंकी वित्तपोषण": "terrorist financing", "रिश्वत": "bribery",
        "भ्रष्टाचार": "corruption", "गबन": "embezzle", "गिरफ्तार": "arrest", "दोषी": "convict",
        "तस्करी": "smuggl",
    },
    "id": {  # Indonesian
        "penipuan": "fraud", "pencucian uang": "money laundering", "sanksi": "sanction",
        "terorisme": "terrorism", "pendanaan terorisme": "terrorist financing",
        "suap": "bribery", "korupsi": "corruption", "penggelapan": "embezzle",
        "ditangkap": "arrest", "terpidana": "convict", "penyelundupan": "smuggl",
    },
    "fa": {  # Persian
        "کلاهبرداری": "fraud", "پولشویی": "money laundering", "تحریم": "sanction",
        "تروریسم": "terrorism", "تأمین مالی تروریسم": "terrorist financing", "رشوه": "bribery",
        "فساد": "corruption", "اختلاس": "embezzle", "دستگیر": "arrest", "محکوم": "convict",
        "قاچاق": "smuggl",
    },
    "ur": {  # Urdu
        "دھوکہ دہی": "fraud", "منی لانڈرنگ": "money laundering", "پابندیاں": "sanction",
        "دہشت گردی": "terrorism", "دہشت گردی کی مالی معاونت": "terrorist financing",
        "رشوت": "bribery", "بدعنوانی": "corruption", "غبن": "embezzle", "گرفتار": "arrest",
        "اسمگلنگ": "smuggl",
    },
    "uk": {  # Ukrainian
        "шахрайство": "fraud", "відмивання грошей": "money laundering",
        "санкції": "sanction", "тероризм": "terrorism",
        "фінансування тероризму": "terrorist financing", "хабарництво": "bribery",
        "корупція": "corruption", "розтрата": "embezzle", "заарештований": "arrest",
        "засуджений": "convict", "контрабанда": "smuggl",
    },
    "nl": {  # Dutch
        "fraude": "fraud", "witwassen": "money laundering", "sancties": "sanction",
        "terrorisme": "terrorism", "terrorismefinanciering": "terrorist financing",
        "omkoping": "bribery", "corruptie": "corruption", "verduistering": "embezzle",
        "gearresteerd": "arrest", "veroordeeld": "convict", "smokkel": "smuggl",
    },
    "pl": {  # Polish
        "oszustwo": "fraud", "pranie pieniędzy": "money laundering", "sankcje": "sanction",
        "terroryzm": "terrorism", "finansowanie terroryzmu": "terrorist financing",
        "łapówka": "bribery", "korupcja": "corruption", "sprzeniewierzenie": "embezzle",
        "aresztowany": "arrest", "skazany": "convict", "przemyt": "smuggl",
    },
    "sv": {  # Swedish
        "bedrägeri": "fraud", "penningtvätt": "money laundering", "sanktioner": "sanction",
        "terrorism": "terrorism", "terrorismfinansiering": "terrorist financing",
        "muta": "bribery", "korruption": "corruption", "förskingring": "embezzle",
        "gripen": "arrest", "dömd": "convict", "smuggling": "smuggl",
    },
    "ro": {  # Romanian
        "fraudă": "fraud", "spălare de bani": "money laundering", "sancțiuni": "sanction",
        "terorism": "terrorism", "finanțarea terorismului": "terrorist financing",
        "mită": "bribery", "corupție": "corruption", "delapidare": "embezzle",
        "arestat": "arrest", "condamnat": "convict", "contrabandă": "smuggl",
    },
    "cs": {  # Czech
        "podvod": "fraud", "praní špinavých peněz": "money laundering", "sankce": "sanction",
        "terorismus": "terrorism", "financování terorismu": "terrorist financing",
        "úplatek": "bribery", "korupce": "corruption", "zpronevěra": "embezzle",
        "zatčen": "arrest", "odsouzen": "convict", "pašování": "smuggl",
    },
    "el": {  # Greek
        "απάτη": "fraud", "ξέπλυμα χρήματος": "money laundering", "κυρώσεις": "sanction",
        "τρομοκρατία": "terrorism", "χρηματοδότηση τρομοκρατίας": "terrorist financing",
        "δωροδοκία": "bribery", "διαφθορά": "corruption", "υπεξαίρεση": "embezzle",
        "συνελήφθη": "arrest", "καταδικάστηκε": "convict", "λαθρεμπόριο": "smuggl",
    },
    "he": {  # Hebrew
        "הונאה": "fraud", "הלבנת הון": "money laundering", "סנקציות": "sanction",
        "טרור": "terrorism", "מימון טרור": "terrorist financing", "שוחד": "bribery",
        "שחיתות": "corruption", "מעילה": "embezzle", "נעצר": "arrest", "הורשע": "convict",
        "הברחה": "smuggl",
    },
    "th": {  # Thai
        "ฉ้อโกง": "fraud", "ฟอกเงิน": "money laundering", "คว่ำบาตร": "sanction",
        "ก่อการร้าย": "terrorism", "สนับสนุนการก่อการร้าย": "terrorist financing",
        "สินบน": "bribery", "ทุจริต": "corruption", "ยักยอก": "embezzle",
        "ถูกจับ": "arrest", "ลักลอบ": "smuggl",
    },
    "vi": {  # Vietnamese
        "gian lận": "fraud", "rửa tiền": "money laundering", "trừng phạt": "sanction",
        "khủng bố": "terrorism", "tài trợ khủng bố": "terrorist financing", "hối lộ": "bribery",
        "tham nhũng": "corruption", "biển thủ": "embezzle", "bị bắt": "arrest",
        "kết án": "convict", "buôn lậu": "smuggl",
    },
    "ms": {  # Malay
        "penipuan": "fraud", "pengubahan wang haram": "money laundering", "sekatan": "sanction",
        "keganasan": "terrorism", "pembiayaan keganasan": "terrorist financing",
        "rasuah": "bribery", "salah guna dana": "embezzle", "ditangkap": "arrest",
        "penyeludupan": "smuggl",
    },
    "bn": {  # Bengali
        "জালিয়াতি": "fraud", "অর্থ পাচার": "money laundering", "নিষেধাজ্ঞা": "sanction",
        "সন্ত্রাস": "terrorism", "সন্ত্রাসে অর্থায়ন": "terrorist financing", "ঘুষ": "bribery",
        "দুর্নীতি": "corruption", "আত্মসাৎ": "embezzle", "গ্রেপ্তার": "arrest", "পাচার": "smuggl",
    },
    "no": {  # Norwegian
        "svindel": "fraud", "hvitvasking": "money laundering", "sanksjoner": "sanction",
        "terrorisme": "terrorism", "terrorfinansiering": "terrorist financing",
        "bestikkelse": "bribery", "korrupsjon": "corruption", "underslag": "embezzle",
        "arrestert": "arrest", "dømt": "convict", "smugling": "smuggl",
    },
    "da": {  # Danish
        "svindel": "fraud", "hvidvask": "money laundering", "sanktioner": "sanction",
        "terrorisme": "terrorism", "terrorfinansiering": "terrorist financing",
        "bestikkelse": "bribery", "korruption": "corruption", "underslæb": "embezzle",
        "anholdt": "arrest", "dømt": "convict", "smugling": "smuggl",
    },
    "fi": {  # Finnish
        "petos": "fraud", "rahanpesu": "money laundering", "pakotteet": "sanction",
        "terrorismi": "terrorism", "terrorismin rahoitus": "terrorist financing",
        "lahjonta": "bribery", "korruptio": "corruption", "kavallus": "embezzle",
        "pidätetty": "arrest", "tuomittu": "convict", "salakuljetus": "smuggl",
    },
    "hu": {  # Hungarian
        "csalás": "fraud", "pénzmosás": "money laundering", "szankciók": "sanction",
        "terrorizmus": "terrorism", "terrorizmus finanszírozása": "terrorist financing",
        "megvesztegetés": "bribery", "korrupció": "corruption", "sikkasztás": "embezzle",
        "letartóztatták": "arrest", "elítélték": "convict", "csempészet": "smuggl",
    },
    "sk": {  # Slovak
        "podvod": "fraud", "pranie špinavých peňazí": "money laundering", "sankcie": "sanction",
        "terorizmus": "terrorism", "financovanie terorizmu": "terrorist financing",
        "úplatok": "bribery", "korupcia": "corruption", "sprenevera": "embezzle",
        "zatknutý": "arrest", "odsúdený": "convict", "pašovanie": "smuggl",
    },
    "bg": {  # Bulgarian
        "измама": "fraud", "изпиране на пари": "money laundering", "санкции": "sanction",
        "тероризъм": "terrorism", "финансиране на тероризъм": "terrorist financing",
        "подкуп": "bribery", "корупция": "corruption", "присвояване": "embezzle",
        "арестуван": "arrest", "осъден": "convict", "контрабанда": "smuggl",
    },
    "sr": {  # Serbian (Cyrillic + Latin)
        "превара": "fraud", "prevara": "fraud", "прање новца": "money laundering",
        "pranje novca": "money laundering", "санкције": "sanction", "sankcije": "sanction",
        "тероризам": "terrorism", "terorizam": "terrorism", "корупција": "corruption",
        "korupcija": "corruption", "мито": "bribery", "mito": "bribery",
        "ухапшен": "arrest", "uhapšen": "arrest", "кријумчарење": "smuggl", "krijumčarenje": "smuggl",
    },
    "tl": {  # Filipino / Tagalog
        "pandaraya": "fraud", "money laundering": "money laundering", "parusa": "sanction",
        "terorismo": "terrorism", "pagpopondo sa terorismo": "terrorist financing",
        "suhol": "bribery", "korupsiyon": "corruption", "malversasyon": "embezzle",
        "inaresto": "arrest", "nahatulan": "convict", "smuggling": "smuggl",
    },
    "sw": {  # Swahili
        "ulaghai": "fraud", "utakatishaji fedha": "money laundering", "vikwazo": "sanction",
        "ugaidi": "terrorism", "ufadhili wa ugaidi": "terrorist financing", "rushwa": "bribery",
        "ufisadi": "corruption", "ubadhirifu": "embezzle", "amekamatwa": "arrest",
        "magendo": "smuggl",
    },
    "ta": {  # Tamil
        "மோசடி": "fraud", "பணமோசடி": "money laundering", "தடைகள்": "sanction",
        "பயங்கரவாதம்": "terrorism", "லஞ்சம்": "bribery", "ஊழல்": "corruption",
        "கையாடல்": "embezzle", "கைது": "arrest", "கடத்தல்": "smuggl",
    },
}

# One merged native-term → English-canonical map across all 18 languages (Arabic
# first, then the rest; first insertion wins on the odd shared spelling).
FOREIGN_KEYWORDS = dict(ADVERSE_KEYWORDS_AR)
for _lang_map in LANG_KEYWORDS.values():
    for _term, _canon in _lang_map.items():
        FOREIGN_KEYWORDS.setdefault(_term, _canon)

# Total distinct red-flag terms recognised (English + every native language),
# reported in the provenance/attestation blocks.
ADVERSE_TERM_COUNT = len(ADVERSE_KEYWORDS) + len(FOREIGN_KEYWORDS)
# Distinct languages with a native red-flag dictionary: English + Arabic + the
# LANG_KEYWORDS set. GDELT adds 65+ more via machine translation.
ADVERSE_LANG_COUNT = 2 + len(LANG_KEYWORDS)

# Non-Latin scripts where letter-case / \b word boundaries do not apply and terms
# must be matched by substring: Cyrillic, Arabic (+ supplement, covers fa/ur),
# Devanagari, Hiragana/Katakana, CJK ideographs, Hangul.
_NONLATIN_RE = re.compile(
    "[Ͱ-Ͽ"   # Greek
    "Ѐ-ӿ"    # Cyrillic
    "֐-׿"    # Hebrew
    "؀-ۿݐ-ݿ"  # Arabic (+ supplement — fa/ur)
    "ऀ-ॿ"    # Devanagari (hi)
    "ঀ-৿"    # Bengali
    "஀-௿"    # Tamil
    "฀-๿"    # Thai
    "぀-ヿ"    # Hiragana/Katakana
    "㐀-鿿"    # CJK ideographs
    "가-힣]")  # Hangul

# Arabic script (incl. Persian/Urdu supplement). Arabic press varies orthography
# freely — diacritics (harakat), tatweel, and the alef/hamza/teh-marbuta forms —
# so an exact substring match misses real adverse headlines. Normalise both the
# term and the headline before matching.
_ARABIC_RE = re.compile("[؀-ۿݐ-ݿ]")
_AR_STRIP_RE = re.compile("[ً-ْٰـ]")   # harakat + superscript alef + tatweel

def _normalize_ar(s: str) -> str:
    """Fold Arabic orthographic variants so spelling differences don't cause a
    silent false negative: drop diacritics/tatweel and unify alef, hamza-carrier,
    alef-maqsura and teh-marbuta forms. A no-op on non-Arabic text."""
    s = unicodedata.normalize("NFC", str(s or ""))
    s = _AR_STRIP_RE.sub("", s)
    s = re.sub("[آأإٱ]", "ا", s)   # آ أ إ ٱ → ا
    s = s.replace("ى", "ي")                        # ى → ي
    s = s.replace("ة", "ه")                        # ة → ه
    return s

def _latin_fold(s: str) -> str:
    """Case-fold Latin text robustly across the Turkish dotted/dotless i and
    diacritics: uppercase first (ı→I and i→I collapse together), strip combining
    marks, then lowercase — so 'DOLANDIRICILIK' (all-caps headline) and
    'dolandırıcılık' (dictionary term) both fold to 'dolandiricilik'."""
    s = unicodedata.normalize("NFD", (s or "").upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower()

def match_adverse_keywords(title: str) -> list:
    """All adverse keywords found in one headline: the English set (word-boundary,
    case-insensitive) plus the 18-language multilingual set. Each non-English term
    maps to its English canonical so typology bucketing and reporting stay uniform.
    Latin-script foreign terms match on \b word boundaries (lower-cased, with a
    diacritic-folded fallback for all-caps Turkish-style headlines); Arabic terms
    match on the Arabic-normalised headline; other non-Latin scripts match by
    substring on the LOWER-CASED headline — Cyrillic and Greek are cased scripts,
    and the dictionary terms are lowercase, so matching against the raw headline
    would miss every capitalized or all-caps headline. Order preserved, no
    duplicates."""
    raw = title or ""
    tl = raw.lower()
    raw_ar = _normalize_ar(raw)
    matched = [kw for kw in ADVERSE_KEYWORDS if re.search(r"\b" + re.escape(kw), tl)]
    for term, canon in FOREIGN_KEYWORDS.items():
        if canon in matched:
            continue
        if _ARABIC_RE.search(term):
            hit = _normalize_ar(term) in raw_ar
        elif _NONLATIN_RE.search(term):
            hit = term in tl
        else:
            # Both edges anchored: unlike the English entries (deliberate stems —
            # 'launder', 'smuggl' — that need open-ended prefix matching), the
            # foreign terms are whole words, and a bare prefix collides with
            # unrelated English ('mito'chondria → Serbian 'mito' bribery,
            # 'preso'rted → Portuguese 'preso' arrest).
            hit = re.search(r"\b" + re.escape(term.lower()) + r"\b", tl) is not None
            if not hit:
                hit = re.search(r"\b" + re.escape(_latin_fold(term)) + r"\b", _latin_fold(raw)) is not None
        if hit:
            matched.append(canon)
    return matched

_RSS_TAG_RE = re.compile(r"<[^>]+>")
def _strip_rss_description(text):
    """RSS <description> → plain text: HTML tags stripped, common entities
    decoded, whitespace collapsed, bounded (feeds embed whole link farms)."""
    s = _RSS_TAG_RE.sub(" ", str(text or ""))
    s = (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
          .replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " "))
    return re.sub(r"\s+", " ", s).strip()[:1000]

# ── Keyword tiers + description scanning + counter eligibility ───────────────
# WEAK keywords are the high-noise generics: they legitimately flag a headline
# for the record (an analyst may still care), but a "political rally" or a
# commercial "lawsuit" headline must not carry the same escalation weight as
# "money laundering". Tiering NEVER unflags an article — it only gates the
# ≥3-stories/90-days repeat counter (see adverse_actionable), where weak-only
# stories need a second independent outlet to count.
KEYWORD_TIER_WEAK = {
    "politic", "illegal", "unlawful", "breach", "regulatory breach", "lawsuit",
    "court case", "litigate", "verdict", "fined", "esg", "pollution",
    "toxic waste", "environmental violation", "greenwashing", "deforestation",
    "land grabbing", "indigenous rights", "nuclear", "dual-use", "exploitation",
    "conflict of interest", "human rights", "due diligence failure",
}

def keyword_tier(keywords):
    """'strong' when ANY matched keyword is outside the weak set; 'weak' when
    every matched keyword is a generic; None for an unflagged article."""
    if not keywords:
        return None
    return "weak" if all(kw in KEYWORD_TIER_WEAK for kw in keywords) else "strong"

def adverse_keywords_for(title, description=""):
    """Adverse keywords across the headline AND the feed's description/snippet.
    Headline-only scanning missed every story whose risk terms sit below the
    fold ("X steps back from board duties" / "…follows his arrest last week…")
    — the single largest measured adverse-media recall loss. Union preserves
    title-keyword order first (report display is title-led), then adds
    description-only finds. Strictly additive: a title-flagged article can
    never lose a keyword by also scanning its description."""
    matched = list(match_adverse_keywords(title))
    if description:
        for kw in match_adverse_keywords(description):
            if kw not in matched:
                matched.append(kw)
    return matched

def _counter_relevance(subject, title):
    """Name-relevance for repeat-counter gating: HIGH/MEDIUM/LOW from
    ai._name_relevance, plus UNSCORABLE when the headline's script shares no
    Latin letters with the folded subject (Arabic/Cyrillic/CJK press) — a
    Latin-token overlap test is meaningless there, and gating on it would
    silently exclude exactly the non-English coverage this deployment exists
    to catch. UNSCORABLE therefore passes the relevance gate (recall-monotone:
    cross-script evidence is never dropped by a scorer that cannot read it)."""
    folded = ai._ascii_fold(title)
    if not re.search(r"[a-z]", folded):
        return "UNSCORABLE"
    return ai._name_relevance(subject, title)

def adverse_actionable(subject, article):
    """True when one flagged article is eligible for the ≥3-stories/90-days
    repeat-escalation counter. Flag status, evidence retention and report
    display are NEVER touched by this predicate — it only decides escalation
    weight: (a) the story must plausibly be about the subject (relevance HIGH/
    MEDIUM, or UNSCORABLE cross-script); (b) a weak-tier (generic-keyword)
    story must be corroborated by a second independent outlet before it
    counts."""
    kws = article.get("keywords") or []
    if not (article.get("flagged") or kws):
        return False
    if _counter_relevance(subject, article.get("title", "")) == "LOW":
        return False
    tier = article.get("tier") or keyword_tier(kws)
    if tier == "weak":
        domains = article.get("domains")
        if domains is None:
            domains = [article.get("source", "")] + list(article.get("also_reported_by") or [])
        return len({d for d in domains if d}) >= 2
    return True

# ── Source-credibility tiers (annotation + ordering ONLY, never a gate) ──────
# data/source-credibility.json maps known outlets to tier 1 (wire services /
# regulators / established Gulf dailies) or tier 2 (mainstream regional);
# everything else is tier 3. Used to rank what survives the per-subject cap —
# a missing/invalid file degrades to everything-tier-3, loudly, because
# ranking is quality-of-life, not a screening control.
def _load_source_tiers():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "data", "source-credibility.json")
    tiers = {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        for tier, key in ((1, "tier1"), (2, "tier2")):
            for dom in data.get(key, []):
                tiers[str(dom).lower()] = tier
    except Exception as e:
        print(f"source-credibility tiers unavailable ({type(e).__name__}) — "
              f"all sources rank tier 3 (ordering only; screening unaffected)", flush=True)
    return tiers

_SOURCE_TIERS = _load_source_tiers()

def source_tier_for(article):
    """Credibility tier (1 best … 3 default) for one article, from its URL host
    or, failing that, its outlet display name folded against domain labels."""
    m = re.match(r"https?://([^/?#]+)", str(article.get("url") or ""), re.I)
    if m:
        host = m.group(1).lower()
        host = host[4:] if host.startswith("www.") else host
        while host:
            if host in _SOURCE_TIERS:
                return _SOURCE_TIERS[host]
            dot = host.find(".")
            if dot < 0:
                break
            host = host[dot + 1:]
    name = re.sub(r"[^a-z0-9]", "", str(article.get("source") or "").lower())
    if name:
        for dom, tier in _SOURCE_TIERS.items():
            if dom.split(".")[0] == name:
                return tier
    return 3

# Aggregator hosts whose links are opaque redirectors with per-fetch tracking
# params — a URL there never identifies the underlying article, so the
# fingerprint falls back to the title signature (same rationale as the
# delta-state key: titles are stable, aggregator URLs are not).
_AGGREGATOR_HOSTS = {"news.google.com", "www.bing.com", "bing.com"}

def _canonical_fingerprint(url, title):
    """Stable identity of one story for repeat counting: lowercase host minus
    www. + path, query/fragment stripped — so the same article re-served under
    rotating utm/tracking params counts ONCE across days. Aggregator or
    missing URLs fall back to the normalized-title signature."""
    m = re.match(r"https?://([^/?#]+)([^?#]*)", str(url or "").strip(), re.I)
    if m:
        host = m.group(1).lower().lstrip(".")
        host = host[4:] if host.startswith("www.") else host
        if host and host not in _AGGREGATOR_HOSTS:
            return f"u:{host}{m.group(2).rstrip('/')}"
    return "t:" + _name_sig(title)

# ── HELPERS ───────────────────────────────────────────────────────────────────
def normalize(name):
    if not name: return ""
    name = name.upper()
    name = unicodedata.normalize("NFD", name)
    name = "".join(c for c in name if unicodedata.category(c) != "Mn")
    name = re.sub(r"[^A-Z0-9 ]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name

def _pct(score) -> str:
    # Floor, never round: a 99.6 similarity must read "99%", not "100%" — only a
    # genuine >=100 (exact) match may display 100% (which is the confirmed-hit gate).
    try:
        return f"{int(float(score))}%"
    except (TypeError, ValueError):
        return "0%"

def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

# ── Hardened XML parsing ──────────────────────────────────────────────────────
# The remote feeds parsed below (Google News RSS, UN Consolidated, Canada SEMA)
# go through the stdlib ElementTree, which — per Python's own docs — is exposed
# to entity-expansion ("billion laughs") and external-entity (XXE) attacks in a
# malicious or MITM'd payload. None of these feeds legitimately declares a DTD,
# so any document carrying a DOCTYPE/ENTITY declaration is refused, and the input
# is size-capped, before parsing. A refusal raises ValueError, which the callers'
# existing try/except turns into a loud coverage degrade — never a silent clear.
# (defusedxml would do the same but is not in the hash-locked ci/requirements.txt;
# this guard needs no new dependency.)
XML_MAX_BYTES = int(os.environ.get("XML_MAX_BYTES", str(64 * 1024 * 1024)))

def safe_xml_fromstring(data):
    """Parse untrusted XML with stdlib ElementTree after refusing DTDs/entities
    and oversize input. Returns the root Element; raises ValueError on rejection.
    The ORIGINAL value is handed to ElementTree so str/bytes encoding semantics
    are unchanged; only a bytes view is scanned for the DTD guard."""
    if data is None or data == b"" or data == "":
        raise ValueError("empty XML")
    raw = data.encode("utf-8", "replace") if isinstance(data, str) else bytes(data)
    if len(raw) > XML_MAX_BYTES:
        raise ValueError(f"XML too large: {len(raw)} bytes > {XML_MAX_BYTES} cap")
    # A DOCTYPE/ENTITY only ever appears in the (tiny) XML prolog of a well-formed
    # feed; scan just the head so a large body is neither re-scanned nor able to
    # false-positive on an incidental byte sequence deep in the document.
    head = raw[:131072].upper()
    if b"<!DOCTYPE" in head or b"<!ENTITY" in head:
        raise ValueError("refused XML DTD/entity declaration (billion-laughs/XXE guard)")
    return ET.fromstring(data)

def _atomic_write_text(path, text):
    """Write text to `path` atomically (temp file in the same dir + os.replace) so
    a crash mid-write cannot leave a half-written state file that the next run
    would read as corrupt. Returns True on success, False on failure (callers
    keep their own degrade handling)."""
    tmp = f"{path}.{os.getpid()}.tmp"
    try:
        d = os.path.dirname(path)
        if d:
            os.makedirs(d, exist_ok=True)
        with open(tmp, "w") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
        return True
    except Exception as e:
        log(f"  WARN atomic write failed for {path}: {e}")
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            # Best-effort temp cleanup only: the original file was never touched
            # (os.replace is atomic and did not run), so a stray .tmp is harmless
            # and there is nothing to recover or re-raise.
            pass
        return False

def now_uae():
    utc = datetime.datetime.utcnow()
    return utc + datetime.timedelta(hours=UAE_TZ_OFFSET)

def log(msg):
    print(f"[{datetime.datetime.utcnow().strftime('%H:%M:%S')}] {msg}", flush=True)

# ── ASANA TRANSPORT (honours 429 rate-limit; retries transient errors) ────────
ASANA_NOTES_MAX = 65000    # opening budget in worst-case rich-text bytes — see _asana_notes_size
ASANA_NOTES_FLOOR = 12000  # shrink-chain floor: keeps the summary + sign-off intact

# Asana's server-side size accounting is a black box (2026-07-16: it rejected
# notes capped to a 65,000-byte NUMERIC-ENTITY WORST CASE, i.e. stricter than
# every estimate derivable from the text), so the only reliable budget is the
# one that actually delivered. It is remembered in the delta-state under a
# reserved key and reused as the next run's opening bid: steady state is one
# API call with no rejection. A weekly probe bids 5% above the remembered
# value so headroom lost to a transient never becomes permanent; the shrink
# chain below the remembered value remains the universal safety net.
NOTES_BUDGET_KEY = "__meta_asana_notes_budget__"  # reserved — never a fingerprint
NOTES_BUDGET = {"stored": None, "learned": None}  # loaded from / saved to delta-state

# ── MLRO case backlog (reserved delta-state key) ─────────────────────────────
# Items past CASE_SUBTASK_CAP (or whose subtask create failed) used to get a
# log line and nothing else: the delta engine marked them standing, so they
# never re-entered the case queue on any later run — reported once, cased
# never. They are now carried in a reserved backlog inside the delta state and
# drained on later runs whenever the day's NEW items leave capacity free
# (sanctions first, oldest first). Bounded LOUDLY, never silently.
CASE_BACKLOG_KEY = "__meta_case_backlog__"        # reserved — never a fingerprint
CASE_BACKLOG_MAX = 400                            # hard bound on carried items (log names the overflow)

def load_case_backlog(state):
    """Backlog entries from the delta state: [{p, name, notes, queued}] —
    malformed/legacy content degrades to an empty backlog, never a crash."""
    out = []
    for e in (state.get(CASE_BACKLOG_KEY) or []) if isinstance(state, dict) else []:
        if (isinstance(e, dict) and isinstance(e.get("name"), str) and e["name"]
                and isinstance(e.get("notes"), str)):
            out.append({"p": int(e.get("p", 0) or 0), "name": e["name"],
                        "notes": e["notes"], "queued": str(e.get("queued", ""))[:10]})
    return out

def _clamp_notes_budget(v):
    """A budget read from state is advisory — clamp garbage into the sane range."""
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    return min(ASANA_NOTES_MAX, max(ASANA_NOTES_FLOOR, v))

def notes_budget_plan(stored, probe=False):
    """Ordered notes-size budgets for the delivery attempts. Without a stored
    known-good budget: open at ASANA_NOTES_MAX and shrink 0.6× per rejection.
    With one: open exactly there (no rejection in steady state); on a probe
    run, bid ~5% above it first and fall straight back to the known-good value
    before the shrink chain, so a failed probe costs one call, not detail."""
    plan = []
    if stored is None:
        plan.append(ASANA_NOTES_MAX)
    else:
        if probe and stored < ASANA_NOTES_MAX:
            plan.append(min(ASANA_NOTES_MAX, int(stored * 1.05) + 1))
        if not plan or plan[-1] != stored:
            plan.append(stored)
    b = plan[-1]
    while b > ASANA_NOTES_FLOOR and len(plan) < 6:
        b = max(ASANA_NOTES_FLOOR, int(b * 0.6))
        plan.append(b)
    return plan

def asana_request(method, url, **kw):
    """Single Asana call path. Retries on 429 (respecting Retry-After) and 5xx so a
    burst of reads/posts never crashes the run. Returns the final response (caller
    inspects status); returns None only if the network failed every attempt."""
    # The credential check the import used to do, moved to the point of use. An
    # unauthenticated Asana read does not fail cleanly — it returns an error
    # body that parses as JSON with zero tasks, which downstream reads as "no
    # customers" and files as an all-clear. That is the silent false negative
    # this engine exists to prevent, so refuse the call outright.
    if not ASANA_TOKEN:
        raise SystemExit(
            "FATAL: no Asana credential — set ASANA_ACCESS_TOKEN (or ASANA_TOKEN). "
            "Refusing to call Asana unauthenticated: the error body parses as zero "
            "tasks, and a screen over zero customers would file as an all-clear."
        )
    kw.setdefault("headers", ASANA_HEADERS)
    kw.setdefault("timeout", 30)
    last = None
    for attempt in range(5):
        try:
            last = requests.request(method, url, **kw)
        except Exception as e:
            log(f"  Asana network error (attempt {attempt+1}): {e}")
            time.sleep(2 ** attempt); continue
        if last.status_code == 429 or last.status_code >= 500:
            wait = last.headers.get("Retry-After")
            time.sleep(int(wait) if (wait and wait.isdigit()) else 2 ** attempt)
            continue
        return last
    return last

# Named-entity costs for the HTML specials; every other non-ASCII code point is
# budgeted at its numeric-entity form ("&#8594;" for →), the largest encoding the
# rich-text conversion can produce for it.
_ASANA_ENTITY_COST = {"&": 5, "<": 4, ">": 4, '"': 6, "'": 6}

def _asana_notes_size(s):
    """WORST-CASE size of what Asana's rich-text conversion can make of `notes`.
    The API stores notes as rich text and limits the CONVERTED representation to
    ~65,535 bytes; the conversion escapes HTML specials (& → &amp;, …) AND can
    entity-encode non-ASCII code points (→ → &#8594;, 🛡 → &#128737;), so a
    report heavy in arrows/bullets/emoji/Arabic inflates far beyond its UTF-8
    byte count. Both under-counting bugs were hit live on 2026-07-16: capping by
    characters, by raw UTF-8 bytes, and finally by html.escape'd bytes (65,000)
    each still returned "Rich text value is too large". Numeric-entity
    accounting is ≥ the UTF-8 length and ≥ every escape Asana applies, so this
    measure never under-counts (post_unified_task retries with a smaller budget
    as a final backstop should Asana's accounting ever grow again)."""
    total = 0
    for ch in s:
        cost = _ASANA_ENTITY_COST.get(ch)
        if cost is None:
            cp = ord(ch)
            cost = 1 if cp < 0x80 else 3 + len(str(cp))  # "&#" + digits + ";"
        total += cost
    return total

def cap_notes(narrative, limit=None):
    """Cap a report to Asana's notes limit WITHOUT amputating the sign-off / retention
    footer at the end — truncate the body, keep the tail. Sizes are measured with
    _asana_notes_size (worst-case rich-text bytes — see above); the head cut lands
    on a character boundary by construction. `limit` overrides ASANA_NOTES_MAX so
    post_unified_task can retry with a smaller budget if Asana still refuses."""
    limit = ASANA_NOTES_MAX if limit is None else limit
    if _asana_notes_size(narrative) <= limit:
        return narrative
    tail = narrative[-1200:]
    marker = "\n…[body truncated — see workflow run log]…\n"
    budget = limit - _asana_notes_size(tail) - _asana_notes_size(marker)
    lo, hi = 0, len(narrative)
    while lo < hi:  # longest head whose worst-case size fits the budget
        mid = (lo + hi + 1) // 2
        if _asana_notes_size(narrative[:mid]) <= budget:
            lo = mid
        else:
            hi = mid - 1
    log(f"  notes truncated (worst-case rich-text {_asana_notes_size(narrative)} → ≤{limit} bytes); "
        f"sign-off/retention preserved")
    return narrative[:lo] + marker + tail

# ── ADVERSE MEDIA ─────────────────────────────────────────────────────────────
# How many Google News locales (from the worldwide GNEWS_LOCALES matrix) to sweep
# per subject. Default 5 = the historic US/GB/AE(en)/TR/AE(ar) set (a safe floor
# for ad-hoc/offline callers). The production daily run sets ADVERSE_LOCALES to
# the FULL matrix (env, in weekly-adverse-media.yml) for an all-markets sweep.
# `all`/`full`/`max` (or any value ≥ the matrix size) selects every locale.
# Multilingual flagging + GDELT's global index are always on regardless.
def _resolve_locale_count(raw, total):
    s = str(raw or "").strip().lower()
    if s in ("all", "full", "max", "*"):
        return total
    try:
        return max(1, min(total, int(s)))
    except (TypeError, ValueError):
        return min(5, total)
ADVERSE_LOCALES = _resolve_locale_count(os.environ.get("ADVERSE_LOCALES", "8"), len(GNEWS_LOCALES))

# Articles kept per subject after dedup/ranking. The old hard-coded 5 truncated
# real coverage for any subject whose flagged bucket alone exceeded it; 8 is
# the new default with the ceiling env-tunable (validated 1-20, loud reject).
def _resolve_adverse_max(raw):
    s = str(raw or "").strip()
    if not s:
        return 8
    try:
        v = int(s)
        if 1 <= v <= 20:
            return v
    except ValueError:
        pass
    print(f"ADVERSE_MAX_RESULTS={raw!r} is not an integer in [1,20] — using default 8", flush=True)
    return 8
ADVERSE_MAX_RESULTS = _resolve_adverse_max(os.environ.get("ADVERSE_MAX_RESULTS", "8"))
# A targeted second pass: the name AND a cluster of material risk terms, so adverse
# coverage surfaces even when it isn't in the subject's top general-news headlines.
RISK_QUERY = ("fraud OR sanctions OR \"money laundering\" OR arrest OR investigation OR "
              "court OR bribery OR corruption OR smuggling OR terrorism OR embezzlement OR "
              "convicted OR indicted OR seized OR raid OR probe OR lawsuit OR charged")
# Arabic counterpart of RISK_QUERY for the AE:ar locale — Arabic-language wrongdoing
# coverage that never uses the English terms (see ADVERSE_KEYWORDS_AR for mapping).
AR_RISK_QUERY = " OR ".join('"' + t + '"' for t in (
    "احتيال", "غسل الأموال", "عقوبات", "فساد", "رشوة", "اعتقال", "تهريب", "إرهاب"))

# GDELT DOC 2.0 — a free, no-key GLOBAL news index (65+ languages, machine-
# translated to English, worldwide print/broadcast/web). This is the "all news
# around the world" feed; it runs once per subject and is the broadest single
# source, so it carries a rich predicate-offence cluster. The independent SECOND
# feed, so adverse coverage never depends on Google News alone.
GDELT_URL = ("https://api.gdeltproject.org/api/v2/doc/doc?query={query}"
             "&mode=artlist&format=json&maxrecords=75&sort=datedesc&timespan=12m")
# Comprehensive predicate-offence cluster (GDELT ANDs the subject name with this
# OR-set). Broad by design — the multilingual keyword flagger downstream decides
# what is actually adverse; this only widens what GDELT returns to be scanned.
GDELT_RISK_TERMS = [
    "sanctions", '"sanctions evasion"', '"money laundering"', "launder", "fraud",
    "corruption", "bribery", "embezzlement", "terrorism", '"terrorist financing"',
    '"proliferation financing"', '"organized crime"', "cartel", "trafficking",
    "smuggling", "narcotics", '"tax evasion"', "ponzi", "indicted", "convicted",
    "arrested", "investigation", "raid", "seized", '"asset freeze"', "blacklisted",
]

# GDELT circuit breaker. GDELT throttles busy shared IPs (GitHub runners) at the
# CONNECTION level — no HTTP response, just a hang until the 20s timeout — and
# once it does it stays down for the whole run (12 Jul: all 838 subjects burned a
# 20-second timeout each, ~4.6 h of worker time). After this many CONSECUTIVE
# hard failures the feed is declared down for the REST OF THE RUN with one loud
# log line; each subject's coverage then stands on the Google News passes (and
# still degrades loudly if those fail too). A success resets the count; the
# breaker re-arms fresh on the next run.
GDELT_BREAKER_AFTER = int(os.environ.get("GDELT_BREAKER_AFTER", "5"))
_GDELT_STATE = {"consecutive_failures": 0, "open": False}


# ── Cross-worker feed pacing ──────────────────────────────────────────────────
# The per-worker 0.4s sleep paced each THREAD, but SCREEN_CONCURRENCY workers
# still hit the same feed concurrently — bursts of ~16 req/s against per-IP
# limiters that meter in seconds. Once Google News tripped (9 Jul), that burst
# rate never let it cool (13 Jul, post-pacing-fix: still 743/838 subjects at
# zero coverage), and 8 workers slamming GDELT simultaneously 429'd it inside
# the first minute. A gate serialises requests to one feed ACROSS ALL WORKERS
# and adapts: failures back the shared interval off multiplicatively (a tripped
# limiter gets quiet time to cool), successes decay it back toward base (a
# healthy feed keeps full throughput).
class _RateGate:
    """Thread-safe request pacing for one external feed.

    wait()     — blocks until this caller's reserved send slot; slots are handed
                 out at least `interval` seconds apart across all threads.
    penalize() — multiply the shared interval by `factor` (capped at `cap`);
                 fires `on_cap` once per run when the cap is first reached.
    reward()   — decay the interval by `decay` back toward `base`.
    """
    def __init__(self, base, cap, factor=1.6, decay=0.85, on_cap=None):
        self.base, self.cap = float(base), float(cap)
        self.factor, self.decay = float(factor), float(decay)
        self.interval = self.base
        self.on_cap = on_cap
        self._lock = threading.Lock()
        self._next = 0.0          # monotonic time of the next free send slot
        self._cap_announced = False

    def wait(self):
        with self._lock:
            now = time.monotonic()
            delay = max(0.0, self._next - now)
            self._next = max(now, self._next) + self.interval
        if delay > 0:
            time.sleep(delay)

    def penalize(self):
        announce = False
        with self._lock:
            self.interval = min(self.cap, self.interval * self.factor)
            if self.interval >= self.cap and not self._cap_announced:
                self._cap_announced = announce = True
        if announce and self.on_cap:
            self.on_cap()

    def reward(self):
        with self._lock:
            self.interval = max(self.base, self.interval * self.decay)

    @property
    def at_cap(self):
        return self.interval >= self.cap

    def reset(self):
        with self._lock:
            self.interval = self.base
            self._next = 0.0
            self._cap_announced = False


# Google News pacing: base = the proven polite delay (now global instead of
# per-worker, so aggregate rate drops ~SCREEN_CONCURRENCY-fold); cap = the
# quiet interval a tripped limiter needs to cool. Both env-tunable.
GNEWS_MIN_INTERVAL = float(os.environ.get("GNEWS_MIN_INTERVAL", "0.4"))
GNEWS_BACKOFF_CAP = float(os.environ.get("GNEWS_BACKOFF_CAP", "10.0"))
# Run-level Google News breaker (mirror of GDELT's): after this many CONSECUTIVE
# subjects with zero Google-News coverage WHILE the gate is already at max
# backoff, the feed is refusing everything at maximum politeness — stop paying
# its cost for the rest of the run. Any single success resets the streak, so a
# merely-flaky feed never trips it. Subjects still degrade loudly (am_error)
# unless GDELT covers them.
GNEWS_BREAKER_AFTER = int(os.environ.get("GNEWS_BREAKER_AFTER", "30"))
_GNEWS_STATE = {"consecutive_zero": 0, "open": False}
# Diagnosability: count fetch/parse failures by exception kind so a systematic
# bug (every ElementTree parse raising, the DTD guard firing) is visible in the
# log instead of being swallowed as an indistinguishable "no result" (see the
# Google-News fetch loop). Bounded log lines per kind keep noise down.
_GNEWS_FAIL_KINDS = {}
_GNEWS_GATE = _RateGate(
    GNEWS_MIN_INTERVAL, GNEWS_BACKOFF_CAP,
    on_cap=lambda: log(f"  Google News rate-limited — pacing backed off to cap "
                       f"({GNEWS_BACKOFF_CAP:g}s between fetches; recovers on success)"))
# GDELT asks for ≤ 1 request per 5 seconds per IP; a fixed-interval gate
# (base == cap) enforces exactly that across all workers.
GDELT_MIN_INTERVAL = float(os.environ.get("GDELT_MIN_INTERVAL", "5.0"))
_GDELT_GATE = _RateGate(GDELT_MIN_INTERVAL, GDELT_MIN_INTERVAL)

def parse_gdelt(payload, max_results: int = 8) -> list:
    """GDELT artlist JSON → the same article shape the Google News pass emits.
    Pure (no network) so it is unit-testable offline."""
    arts = []
    for a in (payload or {}).get("articles", [])[: max_results * 3]:
        title = (a.get("title") or "").strip()
        if not title:
            continue
        m = re.match(r"(\d{4})(\d{2})(\d{2})", a.get("seendate") or "")
        ts = None
        if m:
            try:
                ts = int(datetime.datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).timestamp())
            except Exception:
                ts = None
        matched = match_adverse_keywords(title)
        arts.append({
            "title": title,
            "source": (a.get("domain") or "GDELT"),
            "date": (f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""),
            "ts": ts,
            "url": a.get("url") or "",
            "flagged": bool(matched),
            "keywords": matched,
            "categories": typology_for(matched),
        })
    return arts

def search_gdelt(name: str, max_results: int = 8) -> list:
    """Query GDELT for a subject + risk-term cluster. Raises on HTTP failure so
    the caller can log it (the Google News passes still stand on their own).
    Paced by the run-global GDELT gate: 8 workers used to fire their first
    GDELT requests simultaneously, which 429'd the feed inside the first minute
    of the 13 Jul run and opened the circuit for all 838 subjects."""
    _GDELT_GATE.wait()
    q = requests.utils.quote(f'"{name}" ({" OR ".join(GDELT_RISK_TERMS)})')
    r = requests.get(GDELT_URL.format(query=q), timeout=20,
                     headers={"User-Agent": "Mozilla/5.0 (compliance screening)"})
    if r.status_code != 200:
        raise RuntimeError(f"GDELT HTTP {r.status_code}")
    return parse_gdelt(r.json() if r.content else {}, max_results)

# ── Bing News RSS — independent THIRD news feed ──────────────────────────────
# Google News and GDELT meter shared runner IPs independently, and 10-14 Jul
# showed both can refuse the same run (the crime watchlist kept deterministic
# coverage, but fresh-story recall went to zero). Bing News serves a free,
# no-key RSS endpoint on a THIRD rate-limit pool, so headline recall now needs
# three simultaneous refusals to go dark. Same integration contract as GDELT:
# one paced, breaker-guarded query per subject; its failure alone never fails
# the subject; articles land in the same shape and flow through the same
# multilingual keyword flagger and dedupe. Kill-switch: BING_NEWS=0.
BING_NEWS = os.environ.get("BING_NEWS", "1") == "1"
BING_NEWS_URL = "https://www.bing.com/news/search?q={query}&format=rss"
BING_BREAKER_AFTER = int(os.environ.get("BING_BREAKER_AFTER", "5"))
_BING_STATE = {"consecutive_failures": 0, "open": False}
# Bing tolerates polite RSS polling; pace like Google News (shared slot across
# all workers, multiplicative backoff on failure, decay on success).
BING_MIN_INTERVAL = float(os.environ.get("BING_MIN_INTERVAL", "0.5"))
BING_BACKOFF_CAP = float(os.environ.get("BING_BACKOFF_CAP", "10.0"))
_BING_GATE = _RateGate(
    BING_MIN_INTERVAL, BING_BACKOFF_CAP,
    on_cap=lambda: log(f"  Bing News rate-limited — pacing backed off to cap "
                       f"({BING_BACKOFF_CAP:g}s between fetches; recovers on success)"))

def parse_bing_news(data, max_results: int = 8) -> list:
    """Bing News RSS bytes → the same article shape the other feeds emit.
    Pure apart from the shared XML-hardening guard, so it is unit-testable
    offline. Defensive per-item parsing: one malformed item never zeroes the
    feed's whole result."""
    arts = []
    if not data:
        return arts
    root = safe_xml_fromstring(data)
    for item in root.iter("item"):
        try:
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            source = ""
            for el in item.iter():
                if el.tag.split("}")[-1] == "Source" and (el.text or "").strip():
                    source = el.text.strip()
                    break
            desc = _strip_rss_description(item.findtext("description") or "")
            matched = adverse_keywords_for(title, desc)
            pub = item.findtext("pubDate") or ""
            ts = _parse_rss_date(pub)
            dm = re.search(r"(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})", pub)
            date = ""
            if dm and dm.group(2).lower() in _MONTHS:
                date = f"{dm.group(3)}-{_MONTHS[dm.group(2).lower()]:02d}-{int(dm.group(1)):02d}"
            arts.append({
                "title": title,
                "source": source or "Bing News",
                "date": date,
                "ts": ts,
                "url": (item.findtext("link") or "").strip(),
                "snippet": desc[:300],
                "flagged": bool(matched),
                "keywords": matched,
                "tier": keyword_tier(matched),
                "categories": typology_for(matched),
            })
            if len(arts) >= max_results * 3:
                break
        except Exception:
            continue
    return arts

def search_bing_news(name: str, max_results: int = 8) -> list:
    """Query Bing News RSS for a subject + the English risk-term cluster.
    Raises on HTTP/parse failure so the caller can log it and count the
    breaker; paced by the run-global Bing gate."""
    _BING_GATE.wait()
    q = requests.utils.quote(f'"{name}" ({RISK_QUERY})')
    r = requests.get(BING_NEWS_URL.format(query=q), timeout=20,
                     headers={"User-Agent": "Mozilla/5.0 (compliance screening)"})
    if r.status_code != 200:
        raise RuntimeError(f"Bing News HTTP {r.status_code}")
    return parse_bing_news(r.content, max_results)

def search_adverse_media(name: str, max_results: int = None) -> list:
    """
    Deep adverse-media search via Google News RSS.
      Pass 1 — exact name across the first ADVERSE_LOCALES worldwide locales
               (default US/GB/AE(en)/TR/AE(ar); up to 36 editions when raised).
      Pass 2 — exact name AND a material-risk-term cluster (en) to surface
               wrongdoing coverage that isn't in the general headlines.
      Pass 3 — targeted Arabic risk-term pass on the AE:ar edition.
    Headlines are flagged against an 18-language multilingual red-flag set,
    bucketed by typology, deduplicated across outlets, and ranked recent-first.
    Self-throttling: every request waits for the run-global Google News gate
    (one shared send slot across ALL workers; failures back the shared interval
    off toward GNEWS_BACKOFF_CAP so a tripped per-IP limiter gets quiet time to
    cool, successes decay it back to base), a subject whose first 4 fetches all
    fail transport-level stops hammering the feed, and a feed refusing
    GNEWS_BREAKER_AFTER consecutive subjects at max backoff — like a hard-down
    GDELT — trips a run-level circuit breaker. A rate-limited feed degrades
    LOUDLY (am_error) instead of spiralling into a retry storm.
    Returns list of dicts: {title, source, date, ts, url, flagged, keywords, categories}.
    """
    if max_results is None:
        max_results = ADVERSE_MAX_RESULTS
    seen_titles = set()
    articles = []
    passes = [
        (f'"{name}"', GNEWS_URLS[:ADVERSE_LOCALES]),   # broad: exact name, every locale
        (f'"{name}" ({RISK_QUERY})', GNEWS_URLS[:1]),  # targeted: name + risk terms, en-US
    ]
    if ADVERSE_LOCALES >= 5:
        # Targeted Arabic pass — wrongdoing coverage in Arabic press that would
        # never match the English risk terms (AE:ar locale only).
        passes.append((f'"{name}" ({AR_RISK_QUERY})', GNEWS_URLS[4:5]))
    attempts = failures = 0
    throttled = False
    if _GNEWS_STATE["open"]:
        passes = []   # run-level breaker open — Google News refused everything
                      # at max backoff; the GDELT pass below still stands, and a
                      # subject neither feed covers degrades loudly regardless.
    for q, locales in passes:
        if throttled:
            break
        query = requests.utils.quote(q)
        for url_template in locales:
            url = url_template.format(query=query)
            attempts += 1
            ok = False
            _GNEWS_GATE.wait()
            try:
                r = requests.get(url, timeout=15,
                                 headers={"User-Agent": "Mozilla/5.0 (compliance screening)"})
                if r.status_code == 200:
                    root = safe_xml_fromstring(r.content)
                    for item in root.findall(".//item")[:max_results]:
                        title_el = item.find("title")
                        source_el = item.find("source")
                        pubdate_el = item.find("pubDate")
                        link_el = item.find("link")
                        if title_el is None: continue
                        title = (title_el.text or "").strip()
                        if title in seen_titles: continue
                        seen_titles.add(title)
                        source = ((source_el.text or "").strip() if source_el is not None else "") or "Unknown"
                        pub_date = (pubdate_el.text or "")[:16] if pubdate_el is not None else ""
                        link = (link_el.text or "") if link_el is not None else ""
                        # The RSS description carries the article's first lines
                        # (HTML-wrapped) — scan it too: risk terms often sit
                        # below a neutral headline. Tags stripped, bounded.
                        desc = _strip_rss_description(item.findtext("description") or "")
                        matched = adverse_keywords_for(title, desc)
                        articles.append({
                            "title": title,
                            "source": source,
                            "date": pub_date,
                            "ts": _parse_rss_date(pubdate_el.text if pubdate_el is not None else ""),
                            "url": link,
                            "snippet": desc[:300],
                            "flagged": bool(matched),
                            "keywords": matched,
                            "tier": keyword_tier(matched),
                            "categories": typology_for(matched),
                        })
                    ok = True
            except Exception as e:
                ok = False
                # Diagnosable degrade: record WHY this fetch/parse failed so a
                # systematic bug (every ET parse raising, or the DTD guard firing)
                # is distinguishable from ordinary rate-limiting/network refusal
                # rather than silently swallowed. The loud aggregate zero-coverage
                # degrade downstream is unchanged.
                _k = type(e).__name__
                _GNEWS_FAIL_KINDS[_k] = _GNEWS_FAIL_KINDS.get(_k, 0) + 1
                if _GNEWS_FAIL_KINDS[_k] <= 3:
                    log(f"  google-news fetch/parse failed ({_k}): {str(e)[:160]}")
            # Feed the adaptive gate: a failure widens the SHARED interval
            # (multiplicative, toward the cap) so the whole worker pool goes
            # quiet enough for a tripped limiter to cool; a success decays it
            # back toward base. Per-worker sleeps couldn't do this — 8 workers
            # each sleeping 0.4s still burst ~16 req/s at the feed (13 Jul:
            # 743/838 subjects at zero coverage even WITH failure pacing).
            if ok:
                _GNEWS_GATE.reward()
            else:
                failures += 1
                _GNEWS_GATE.penalize()
            # Transport-level early exit: the FIRST 4 fetches for this subject
            # all failed ⇒ the feed is refusing this runner right now (per-IP
            # rate limit / egress refusal). Every remaining locale hits the
            # same host and fails the same way; skipping them sheds the load
            # that keeps the limiter tripped. Never triggers once any fetch
            # succeeded, and the subject still degrades loudly below unless
            # GDELT covered it.
            if failures == attempts and attempts >= 4:
                throttled = True
                break

    # Run-level Google News breaker: count CONSECUTIVE subjects with zero
    # Google-News coverage while the gate is already at max backoff — i.e. the
    # feed keeps refusing everything at maximum politeness. One success (any
    # subject, any locale) resets the streak, so partial throttling — where
    # patience still buys coverage — never trips it.
    if attempts and not _GNEWS_STATE["open"]:
        if failures >= attempts and _GNEWS_GATE.at_cap:
            _GNEWS_STATE["consecutive_zero"] += 1
            if _GNEWS_STATE["consecutive_zero"] >= GNEWS_BREAKER_AFTER:
                _GNEWS_STATE["open"] = True
                log(f"  Google News refusing all fetches ({GNEWS_BREAKER_AFTER} subjects in a row "
                    "at max backoff) — circuit OPEN, skipping Google News for the rest of the run; "
                    "GDELT coverage stands (uncovered subjects still degrade loudly)")
        elif failures < attempts:
            _GNEWS_STATE["consecutive_zero"] = 0

    # Independent second source — GDELT. Its failure alone never fails the
    # subject (the Google News passes above already ran); it is logged so a quiet
    # feed outage is visible in the run log instead of silently narrowing recall.
    # The run-level breaker (see GDELT_BREAKER_AFTER) stops a hard-down feed from
    # costing every remaining subject a 20-second connect timeout.
    gdelt_ok = False
    if not _GDELT_STATE["open"]:
        try:
            for a in search_gdelt(name, max_results):
                if a["title"] not in seen_titles:
                    seen_titles.add(a["title"])
                    articles.append(a)
            gdelt_ok = True
            _GDELT_STATE["consecutive_failures"] = 0
        except Exception as e:
            _GDELT_STATE["consecutive_failures"] += 1
            if _GDELT_STATE["consecutive_failures"] >= GDELT_BREAKER_AFTER:
                if not _GDELT_STATE["open"]:
                    _GDELT_STATE["open"] = True
                    log(f"  GDELT down ({GDELT_BREAKER_AFTER} subjects in a row) — circuit OPEN, "
                        "skipping GDELT for the rest of the run; Google News coverage stands")
            else:
                log(f"  GDELT unavailable for this subject ({str(e)[:80]}) — Google News coverage stands")

    # Independent THIRD source — Bing News RSS (separate rate-limit pool from
    # both Google News and GDELT). Same contract as the GDELT block above: its
    # failure alone never fails the subject, outages are logged not swallowed,
    # and a hard-down feed trips a run-level breaker instead of costing every
    # remaining subject a timeout.
    bing_ok = False
    if BING_NEWS and not _BING_STATE["open"]:
        try:
            for a in search_bing_news(name, max_results):
                if a["title"] not in seen_titles:
                    seen_titles.add(a["title"])
                    articles.append(a)
            bing_ok = True
            _BING_STATE["consecutive_failures"] = 0
            _BING_GATE.reward()
        except Exception as e:
            _BING_STATE["consecutive_failures"] += 1
            _BING_GATE.penalize()
            if _BING_STATE["consecutive_failures"] >= BING_BREAKER_AFTER:
                if not _BING_STATE["open"]:
                    _BING_STATE["open"] = True
                    log(f"  Bing News down ({BING_BREAKER_AFTER} subjects in a row) — circuit OPEN, "
                        "skipping Bing News for the rest of the run; Google News/GDELT coverage stands")
            else:
                log(f"  Bing News unavailable for this subject ({str(e)[:80]}) — other feeds stand")

    # Degrade loudly: if EVERY Google-News fetch failed (or its breaker skipped
    # the feed entirely) AND GDELT failed AND Bing News failed, we have ZERO
    # fresh-story coverage for this subject — raise so the caller records an
    # am_error and the report degrades, rather than returning [] that reads as
    # "no adverse media".
    if attempts > 0 and failures >= attempts and not gdelt_ok and not bing_ok:
        raise RuntimeError(f"adverse-media: all {attempts} Google-News fetches + GDELT + Bing News failed for '{name}'")
    if _GNEWS_STATE["open"] and attempts == 0 and not gdelt_ok and not bing_ok:
        raise RuntimeError(f"adverse-media: Google News circuit open + GDELT + Bing News failed for '{name}'")

    articles = dedup_stories(articles)
    # Sort: flagged first, then most-recent first (recency ranking).
    # Ranking: flagged first, then source credibility (tier 1 wire services /
    # regulators before unknown outlets), then recency — so when the cap
    # truncates, what survives is the flagged, best-sourced, freshest coverage.
    for a in articles:
        a["source_tier"] = source_tier_for(a)
    articles.sort(key=lambda x: (not x["flagged"], x.get("source_tier", 3), -(x.get("ts") or 0)))
    return articles[:max_results]

# RFC-822 dates from Google News RSS -> epoch seconds for recency ranking.
_MONTHS = {m: i for i, m in enumerate(
    ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"], 1)}
def _parse_rss_date(s):
    if not s: return None
    m = re.search(r"(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})", s)
    if not m: return None
    try:
        day, mon, yr = int(m.group(1)), _MONTHS.get(m.group(2).lower()), int(m.group(3))
        if not mon: return None
        return int(datetime.datetime(yr, mon, day).timestamp())
    except Exception:
        return None

def _story_tokens(title):
    toks = [t for t in re.sub(r"[^a-z0-9 ]", " ", title.lower()).split()
            if len(t) > 3 and t not in ("with","from","that","this","says","said","over","into")]
    return set(toks)

def dedup_stories(articles, overlap=0.6):
    """Collapse the same story carried by multiple outlets (e.g. four near-identical
    'Rs 38 crore bank fraud' headlines) into one, by significant-token overlap."""
    kept = []
    for a in articles:
        toks = _story_tokens(a["title"])
        dup = False
        for k in kept:
            kt = k["_toks"]
            if toks and kt:
                inter = len(toks & kt); union = len(toks | kt)
                if union and inter / union >= overlap:
                    k.setdefault("also_reported_by", [])
                    if a["source"] not in k["also_reported_by"] and a["source"] != k["source"]:
                        k["also_reported_by"].append(a["source"])
                    # Merge risk signal into the survivor: a duplicate that was
                    # flagged (or carries keywords/categories the kept copy lacks)
                    # must not be silently dropped just because an unflagged copy of
                    # the same story arrived first — OR the flag, union the evidence.
                    if a.get("flagged") and not k.get("flagged"):
                        k["flagged"] = True
                    if a.get("keywords"):
                        k["keywords"] = sorted(set(k.get("keywords") or []) | set(a.get("keywords") or []))
                    if a.get("categories"):
                        k["categories"] = sorted(set(k.get("categories") or []) | set(a.get("categories") or []))
                    dup = True
                    break
        if not dup:
            a = {**a, "_toks": toks}
            kept.append(a)
    for k in kept:
        k.pop("_toks", None)
    return kept

def format_adverse_block(name: str, articles: list, subject_type: str) -> str:
    if not articles:
        return f"   [{subject_type}] {name}\n   No news results found.\n"
    lines = [f"   [{subject_type}] {name}"]
    flagged_count = sum(1 for a in articles if a["flagged"])
    if flagged_count > 0:
        lines.append(f"   ⚠️  {flagged_count} potentially adverse headline(s) found:")
    else:
        lines.append("   ✅ No adverse headlines identified in top results.")
    for a in articles:
        flag = "🚩" if a["flagged"] else "  "
        lines.append(f"   {flag} {a['title']}")
        lines.append(f"      {a['source']} — {a['date']}")
    lines.append("")
    return "\n".join(lines)


# ── ADVERSE-MEDIA EVIDENCE LOG (examiner trail + repeat-pattern signal) ───────
EVIDENCE_FILE = os.environ.get("ADVERSE_EVIDENCE_FILE", "data/adverse-media-evidence.json")
EVIDENCE_RETENTION_DAYS = 400   # > 1 year of committed history, bounded file size
REPEAT_WINDOW_DAYS = 90         # look-back for the repeat-pattern signal
REPEAT_THRESHOLD = 3            # ≥ N distinct stories in the window ⇒ pattern

def update_adverse_evidence(adverse_findings, today_iso, path=None):
    """Append today's flagged articles to the committed evidence log, prune past
    retention, and return {subject: distinct-story-count} for subjects at/over
    REPEAT_THRESHOLD inside REPEAT_WINDOW_DAYS. The log is the examiner-ready
    adverse-media history — every flagged headline, source, URL and typology,
    by date; the count is the "3rd hit in 90 days" escalation signal."""
    path = path or EVIDENCE_FILE
    try:
        with open(path, encoding="utf-8") as f:
            entries = json.load(f)
        if not isinstance(entries, list):
            entries = []
    except Exception:
        entries = []
    seen = {(e.get("subject"), e.get("title")) for e in entries}
    for f_ in adverse_findings or []:
        subj = f_.get("subject_name") or ""
        for a in f_.get("articles", []):
            # Watchlist findings are STANDING list presence, not distinct news
            # stories — logging them daily would trip the ≥3-stories/90d repeat
            # pattern for every listed subject. They carry their own evidence
            # trail (the OpenSanctions entity URL in the report).
            if a.get("watchlist"):
                continue
            key = (subj, a.get("title"))
            if not subj or not a.get("title") or key in seen:
                continue
            seen.add(key)
            domains = sorted({d for d in
                              [a.get("source", "")] + list(a.get("also_reported_by") or []) if d})
            entries.append({
                "date": str(today_iso)[:10], "subject": subj,
                "subject_type": f_.get("subject_type", ""), "parent": f_.get("parent") or "",
                "title": a.get("title", ""), "source": a.get("source", ""),
                "url": a.get("url", ""), "keywords": a.get("keywords", []),
                "categories": a.get("categories", []),
                # Counter-gating evidence (28 Jul 2026 hardening): keyword tier,
                # name-relevance at log time, corroborating outlets, and the
                # canonical story fingerprint. Display/retention unchanged.
                "tier": a.get("tier") or keyword_tier(a.get("keywords", [])),
                "relevance": _counter_relevance(subj, a.get("title", "")),
                "domains": domains,
                "fingerprint": _canonical_fingerprint(a.get("url", ""), a.get("title", "")),
            })

    def _age_days(e):
        try:
            d = datetime.datetime.strptime(str(e.get("date", ""))[:10], "%Y-%m-%d")
            t = datetime.datetime.strptime(str(today_iso)[:10], "%Y-%m-%d")
            return (t - d).days
        except Exception:
            return 10 ** 6
    entries = [e for e in entries if _age_days(e) <= EVIDENCE_RETENTION_DAYS]
    # Atomic write (temp + os.replace): a crash mid-write must never leave a
    # half-written evidence file that the next run reads as corrupt.
    if not _atomic_write_text(path, json.dumps(entries, ensure_ascii=False, indent=1)):
        log("  evidence log write failed — screening output unaffected")
    # Repeat-pattern signal, hardened: count DISTINCT story fingerprints (the
    # same article re-served across days under rotating tracking params counts
    # once) among COUNTER-ELIGIBLE entries — relevance HIGH/MEDIUM/UNSCORABLE
    # (never LOW: a same-surname story about someone else must not manufacture
    # an escalation) and strong keyword tier, or weak tier corroborated by a
    # second independent outlet. Every entry stays in the log and the report
    # regardless — only its ESCALATION weight is gated. Entries written before
    # this hardening carry none of the gating fields and stay counter-eligible
    # (no retroactive suppression of standing evidence), on their title
    # fingerprint.
    counts, excluded = {}, 0
    for e in entries:
        if _age_days(e) > REPEAT_WINDOW_DAYS:
            continue
        legacy = "fingerprint" not in e
        eligible = legacy or (
            e.get("relevance") != "LOW"
            and (e.get("tier") != "weak" or len(e.get("domains") or []) >= 2))
        if not eligible:
            excluded += 1
            continue
        fp = e.get("fingerprint") or ("t:" + _name_sig(e.get("title", "")))
        counts.setdefault(e["subject"], set()).add(fp)
    if excluded:
        log(f"  adverse evidence: {excluded} in-window item(s) logged but excluded from the "
            f"repeat counter (low relevance / uncorroborated weak tier) — display unaffected")
    return {subj: len(fps) for subj, fps in counts.items() if len(fps) >= REPEAT_THRESHOLD}

# ── PEP — POLITICALLY EXPOSED PERSONS (free, Wikidata, individuals only) ──────
# No genuinely free commercial-use PEP *list* exists (OpenSanctions etc. are
# licensed). As a $0 signal we use Wikidata's public entity-search API (CC0, no
# key): a same-name entity whose description names a political role is a possible
# PEP for MLRO review. WEAK / high-recall — a hit means "verify"; absence is NOT
# assurance. PEP applies to natural persons, so this runs on INDIVIDUALS only.
PEP_KEYWORDS = [
    "politician","president","prime minister","minister","senator","governor",
    "mayor","member of parliament","parliament","congressman","congresswoman",
    "diplomat","ambassador","head of state","head of government","party leader",
    "monarch","king","queen","crown prince","prince","princess","sheikh",
    "emir","sultan","ruler","secretary of state","chancellor","legislator",
    "deputy prime","foreign minister","defence minister","defense minister",
    "central bank governor","supreme court","attorney general","state official",
    # judiciary / military / law enforcement
    "judge","justice","magistrate","general","admiral","colonel","field marshal",
    "chief of staff","commander","police chief","military officer",
    # state-owned enterprise (SOE) / public sector
    "state-owned","state owned","sovereign wealth","public enterprise",
    "government official","civil servant","state company","chairman of",
    "director general","permanent secretary","governor of",
]
# State-owned-enterprise signal (sub-class of PEP under FATF R.12 guidance).
PEP_SOE_HINTS = ["state-owned","state owned","sovereign wealth","public enterprise",
                 "state company","national oil","national bank"]
# Relatives & Close Associates (RCA) — same EDD treatment as the PEP themselves.
PEP_RCA_HINTS = ["son of","daughter of","wife of","husband of","brother of","sister of",
                 "father of","mother of","spouse of","nephew of","niece of","cousin of",
                 "family of","relative of","widow of","heir of","close associate","ally of",
                 "business partner of","advisor to","aide to"]
_PEP_CACHE = {}

# Wikidata pacing + circuit breaker (mirror of the Google News / GDELT guards).
# SCREEN_CONCURRENCY workers with NO pacing burst ~8 req/s at the API; Wikimedia
# meters anonymous clients per IP, and a shared GitHub-runner IP gets refused
# for the whole run (14 Jul: 436 PEP lookups errored, PEP count fell 4 → 0 with
# no gate to cool the limiter and no breaker to stop paying per-lookup latency).
# One run-global gate serialises lookups across all workers; failures back the
# shared interval off multiplicatively, successes decay it back toward base.
PEP_MIN_INTERVAL = float(os.environ.get("PEP_MIN_INTERVAL", "0.5"))
PEP_BACKOFF_CAP = float(os.environ.get("PEP_BACKOFF_CAP", "8.0"))
# After this many CONSECUTIVE failed lookups the API is refusing this runner —
# declare the feed down for the REST OF THE RUN with one loud log line. The
# affected individuals are then re-covered in bulk by the OpenSanctions PEP
# mirror (see load_pep_mirror) instead of finishing the run as "PEP unknown".
PEP_BREAKER_AFTER = int(os.environ.get("PEP_BREAKER_AFTER", "10"))
_PEP_STATE = {"consecutive_failures": 0, "open": False}
_PEP_GATE = _RateGate(
    PEP_MIN_INTERVAL, PEP_BACKOFF_CAP,
    on_cap=lambda: log(f"  Wikidata rate-limited — PEP pacing backed off to cap "
                       f"({PEP_BACKOFF_CAP:g}s between lookups; recovers on success)"))

def _pep_failure():
    """Shared bookkeeping for one failed Wikidata lookup: back off the gate and
    advance the run-level breaker. A later success resets both (see check_pep)."""
    _PEP_GATE.penalize()
    _PEP_STATE["consecutive_failures"] += 1
    if _PEP_STATE["consecutive_failures"] >= PEP_BREAKER_AFTER and not _PEP_STATE["open"]:
        _PEP_STATE["open"] = True
        log(f"  Wikidata refusing lookups ({PEP_BREAKER_AFTER} in a row) — PEP circuit OPEN, "
            "skipping live lookups for the rest of the run; affected individuals fall back "
            "to the OpenSanctions PEP mirror (provisional, loud)")

def _norm_lower(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s.lower())).strip()

def check_pep(name):
    """Returns {hit, id, label, description} | {hit:False} | {errored:True} |
    {hit, review:True} for a name that cannot be auto-screened."""
    key = _norm_lower(name)
    if not key or len(key) < 5 or _lost_script_letters(name):
        # A name with content that the Latin normaliser collapses to <5 chars
        # (recorded only in non-Latin script) cannot be auto-screened against the
        # English Wikidata index. Returning {hit:False} would file it as "no PEP"
        # — a silent false negative. Surface it for manual PEP review instead
        # (mirrors the sanctions `_unscreenable` path), unless it is genuinely empty.
        # MIXED-script names are the same gap: their non-Latin letters are lost
        # by the fold, so the lookup would search only the Latin residue
        # ("TRADING LLC") and file a confident-looking "no PEP".
        if name and str(name).strip():
            return {"hit": True, "review": True, "id": "",
                    "category": "MANUAL REVIEW — name not auto-screenable for PEP (non-Latin script / too short)",
                    "label": str(name).strip(),
                    "description": "screen this subject for PEP/RCA status manually against a domestic register"}
        return {"hit": False}
    if key in _PEP_CACHE:
        return _PEP_CACHE[key]
    # Run-level breaker: once Wikidata refuses this runner, stop paying the
    # per-lookup latency — the caller's bulk mirror pass covers these instead.
    # Errored results are deliberately NOT cached: the next run retries live.
    if _PEP_STATE["open"]:
        return {"errored": True, "error": "wikidata circuit open"}
    url = ("https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json"
           "&language=en&uselang=en&type=item&limit=7&search="
           + requests.utils.quote(str(name).strip()))
    try:
        _PEP_GATE.wait()   # one shared send slot across all workers
        r = requests.get(url, timeout=20, headers={
            # Wikimedia UA policy: identify the tool AND a contact point.
            "User-Agent": "HawkeyeSterlingCompliance/3.0 "
                          "(https://github.com/trex0092/HAWKEYE-STERLING-RA) PEP-screen",
            "Accept": "application/json"})
        if r.status_code != 200:
            _pep_failure()
            return {"errored": True, "error": f"HTTP {r.status_code}"}
        results = (r.json() or {}).get("search", []) or []
        _PEP_GATE.reward()
        _PEP_STATE["consecutive_failures"] = 0
    except Exception as e:
        _pep_failure()
        return {"errored": True, "error": str(e)[:200]}
    want = [t for t in key.split(" ") if len(t) >= 3]
    out = {"hit": False}
    for res in results:
        raw_desc = res.get("description", "")
        desc = _norm_lower(raw_desc)
        is_role = any(_norm_lower(k) in desc for k in PEP_KEYWORDS)
        is_rca  = any(h in desc for h in PEP_RCA_HINTS)
        if not desc or not (is_role or is_rca):
            continue
        label = _norm_lower(res.get("label", "") or (res.get("match", {}) or {}).get("text", ""))
        if want and all(t in label for t in want):
            # A "wife of / son of …" subject is the RELATIVE, not the official —
            # classify as RCA even if the description also names the office.
            if is_rca:
                category = "RCA (relative / close associate)"
            elif any(h in desc for h in PEP_SOE_HINTS):
                category = "SOE (state-owned enterprise)"
            else:
                category = "PEP (political / public office)"
            out = {"hit": True, "id": res.get("id", ""), "category": category,
                   "label": res.get("label", ""), "description": raw_desc}
            break
    _PEP_CACHE[key] = out
    return out

# ── OPENSANCTIONS BULK LAYER (PEP mirror fallback + adverse-exposure watchlist)
# data.opensanctions.org already serves EU FSF and the OFAC/UN mirrors, so it is
# reachable wherever screening runs and — being one bulk file per run — immune to
# the per-IP request limiters that take out the live feeds from shared runner IPs.
# LICENSING: OpenSanctions bulk data is CC-BY-NC 4.0 (commercial deployments need
# their licence) — registered, with kill-switches and provenance rules, in
# docs/aims/third-party-register.md. Wikidata (CC0) stays the PRIMARY PEP source;
# the bulk PEP file is a FALLBACK for individuals the live lookup could not screen.
PEP_MIRROR_FALLBACK = os.environ.get("PEP_MIRROR_FALLBACK", "1") == "1"
PEP_MIRROR_URL = "https://data.opensanctions.org/datasets/latest/peps/targets.simple.csv"

def parse_pep_index(data):
    """targets.simple.csv → {normalized name/alias: {"id","label"}}, plus a
    token-sorted secondary key per name so word-order variants still hit.
    Exact-normalized index (NOT the fuzzy sanctions matcher): this is a
    resilience net whose hits mean "listed — verify", so precision beats recall.
    Tolerant per-row — one malformed row never zeroes the index."""
    index = {}
    if not data:
        return index
    try:
        reader = csv.DictReader(io.StringIO(data.decode("utf-8")))
        for row in reader:
            try:
                pid = (row.get("id") or "").strip()
                primary = (row.get("name") or "").strip()
                names = [primary] + [a.strip() for a in (row.get("aliases") or "").split(";")]
                for n in names:
                    if not n:
                        continue
                    k = _norm_lower(n)
                    if len(k) < 5:   # same auto-screenability floor as check_pep
                        continue
                    entry = {"id": pid, "label": primary or n}
                    index.setdefault(k, entry)
                    index.setdefault(" ".join(sorted(k.split())), entry)
            except Exception:
                continue  # one malformed row never zeroes the whole index
    except Exception as e:
        log(f"  PEP mirror parse error: {e}")
    return index

def load_pep_mirror():
    """One bulk download per run — called only when live lookups errored. Returns
    the name index, or None when disabled/unavailable; callers leave the affected
    individuals errored (loud, provisional) in that case."""
    if not PEP_MIRROR_FALLBACK:
        log("  PEP mirror fallback disabled (PEP_MIRROR_FALLBACK=0) — errored lookups stay errored")
        return None
    data = download(PEP_MIRROR_URL, "OpenSanctions PEPs (mirror fallback)")
    index = parse_pep_index(data)
    if not index:
        return None
    log(f"  PEP mirror: {len(index):,} name keys loaded — re-covering individuals "
        "the live lookup could not screen")
    return index

def pep_mirror_lookup(index, name):
    """Exact-normalized (+ token-sorted) lookup against the bulk PEP index.
    Hit ⇒ 'listed in the consolidated PEP dataset — verify' (provenance-marked
    mirror). Miss ⇒ screened-by-mirror, no listing found (still provisional —
    the mirror is a net, not the primary)."""
    key = _norm_lower(name)
    if not key:
        return {"hit": False, "via_mirror": True}
    entry = index.get(key) or index.get(" ".join(sorted(key.split())))
    if not entry:
        return {"hit": False, "via_mirror": True}
    return {"hit": True, "id": entry["id"], "label": entry["label"],
            "category": "PEP (OpenSanctions peps watchlist — mirror)",
            "description": "listed in the OpenSanctions consolidated PEP dataset "
                           "(mirror fallback — Wikidata unavailable this run)",
            "source_url": (f"https://www.opensanctions.org/entities/{entry['id']}/"
                           if entry["id"] else ""),
            "via_mirror": True}

# ── ADVERSE-EXPOSURE WATCHLIST (OpenSanctions crime dataset, bulk) ────────────
# Deterministic THIRD adverse net: consolidated criminal watchlists (national
# wanted lists, enforcement actions, court records). One bulk download + one
# local matching pass per run, so a news blackout (Google News AND GDELT
# refusing the runner — 10-14 Jul) can no longer mean ZERO adverse coverage.
# The news feeds stay on for recall (fresh stories); this list is standing
# exposure, not headlines — its findings are excluded from the repeat-pattern
# evidence counter. LICENSING: CC-BY-NC 4.0 — see docs/aims/third-party-register.md.
ADVERSE_WATCHLIST = os.environ.get("ADVERSE_WATCHLIST", "1") == "1"
WATCHLIST_URL = "https://data.opensanctions.org/datasets/latest/crime/targets.simple.csv"
WATCHLIST_LABEL = "OpenSanctions crime watchlist"

def parse_watchlist(data):
    """targets.simple.csv → (entries, ids): entries = [(normalized, original)]
    in the exact shape the sanctions matcher consumes; ids = {original: entity id}
    so a hit can cite its OpenSanctions entity page as evidence.

    The bulk file is the largest download of the run (~68 MB, ~290k names) and
    this stage executes with every core list already resident, on the shared
    7 GB runner where the 24-25 Jul night runs died mid-stage to VM shutdowns.
    Decoding to one giant str and copying it again into StringIO tripled the
    transient footprint, so the reader streams through a TextIOWrapper instead
    — same rows, same output, two ~68 MB copies fewer."""
    entries, ids = [], {}
    if not data:
        return entries, ids
    try:
        reader = csv.DictReader(io.TextIOWrapper(
            io.BytesIO(data), encoding="utf-8", errors="replace"))
        for row in reader:
            try:
                pid = (row.get("id") or "").strip()
                names = [(row.get("name") or "").strip()]
                names += [a.strip() for a in (row.get("aliases") or "").split(";")]
                for n in names:
                    if not n:
                        continue
                    entries.append((normalize(n), n))
                    if pid and n not in ids:
                        ids[n] = pid
            except Exception:
                continue  # one malformed row never zeroes the whole list
    except Exception as e:
        log(f"  {WATCHLIST_LABEL} parse error: {e}")
    return entries, ids

def load_adverse_watchlist():
    """Returns (entries, ids, meta). meta feeds source-coverage drift tracking as
    a SUPPLEMENTARY list (a fetch miss is a soft note, never a degraded core
    control). Failure is loud: (None, {}, count 0) — the tally then records
    news-dead subjects as am_blackout instead of watchlist-covered."""
    if not ADVERSE_WATCHLIST:
        log("  adverse-exposure watchlist disabled (ADVERSE_WATCHLIST=0)")
        return None, {}, {"count": 0, "date": "disabled", "hash": "", "tier": "supplementary"}
    data = download(WATCHLIST_URL, WATCHLIST_LABEL)
    entries, ids = parse_watchlist(data)
    if not entries:
        log(f"  {WATCHLIST_LABEL}: UNAVAILABLE this run — the news feeds are the only adverse nets today")
        return None, {}, {"count": 0, "date": "unavailable", "hash": "", "tier": "supplementary"}
    return entries, ids, {"count": len(entries), "date": "live (OpenSanctions mirror)",
                          "hash": sha256_of(data), "tier": "supplementary"}

def screen_watchlist(subjects_all, entries, ids, today_iso):
    """One local pass of every DISTINCT subject name against the crime watchlist,
    using the same matcher + thresholds as sanctions screening. Returns
    {subject_name: [article, ...]} in the article shape the news path emits.
    Titles are deterministic so delta fingerprints stay stable: a listing reads
    NEW once, then STANDING on every later run."""
    if not entries:
        return {}
    wl = {WATCHLIST_LABEL: entries}
    out = {}
    names = sorted({s[1] for s in subjects_all})
    # Heartbeat: this pass fuzzy-matches every distinct subject against ~290k
    # watchlist names and ran 33 minutes on 24 Jul with zero output — exactly
    # the window in which the 24-25 Jul night runners died, unattributably.
    # A progress line every 100 subjects makes the stage's liveness (and any
    # future death point) visible in the Actions log; stdout only, so the
    # Asana report body is untouched.
    _wl_t0 = time.time()
    for _wl_done, name in enumerate(names):
        if _wl_done and _wl_done % 100 == 0:
            log(f"  watchlist pass: {_wl_done}/{len(names)} subjects "
                f"({time.time() - _wl_t0:.0f}s elapsed)")
        arts = []
        for h in screen_name(name, wl):
            ent = h["matched_entry"]
            url = (f"https://www.opensanctions.org/entities/{ids[ent]}/" if ids.get(ent)
                   else "https://www.opensanctions.org/datasets/crime/")
            arts.append({
                "title": f"Adverse-exposure watchlist: {ent} — OpenSanctions crime dataset",
                "source": "OpenSanctions crime dataset (watchlist)", "url": url,
                "date": str(today_iso)[:10], "ts": None, "flagged": True,
                "keywords": ["watchlist"], "categories": ["Adverse exposure (watchlist)"],
                "watchlist": True, "score": h["score"]})
        if arts:
            out[name] = arts
    return out

# ── LIST DOWNLOADS ────────────────────────────────────────────────────────────
def download(url, label):
    log(f"Downloading {label}...")
    try:
        r = requests.get(url, timeout=90,
                         headers={"User-Agent": "HawkeyeSterlingCompliance/3.0"})
        r.raise_for_status()
        log(f"  {label}: {len(r.content):,} bytes")
        return r.content
    except Exception as e:
        log(f"  ERROR {label}: {e}")
        return None

# ── List-entry attributes (DOB / nationality) for match adjudication ─────────
# Name-only matching forces the MLRO to open the source list just to see
# whether a candidate is even plausibly the same person. Where a list carries
# machine-readable attributes (UN XML: structured DOB + nationality; OFAC SDN:
# DOB/nationality inside the remarks column), they are captured here keyed by
# normalized name (primary names AND designated aliases) and attached to every
# hit as decision-support CONTEXT. Annotation only: attributes never change a
# score and never suppress a hit, so screening recall is untouched.
LIST_ENTRY_ATTRS = {}
_OFAC_ENT_ATTRS = {}   # ent_num -> (dobs, nationalities), links alt.csv aliases

def _note_entry_attrs(name, dobs=None, nationalities=None):
    key = normalize(name or "")
    if not key or not (dobs or nationalities):
        return
    slot = LIST_ENTRY_ATTRS.setdefault(key, {"dob": set(), "nationality": set()})
    for d in dobs or ():
        d = str(d).strip()
        if d: slot["dob"].add(d)
    for n in nationalities or ():
        n = str(n).strip()
        if n: slot["nationality"].add(n)

def match_context_for(matched_entry):
    """Human-readable list-side attributes for a matched entry ('' if none)."""
    a = LIST_ENTRY_ATTRS.get(normalize(matched_entry or ""))
    if not a:
        return ""
    bits = []
    if a["dob"]:
        bits.append("list DOB: " + " / ".join(sorted(a["dob"])[:3]))
    if a["nationality"]:
        bits.append("list nationality: " + ", ".join(sorted(a["nationality"])[:3]))
    return "; ".join(bits)

def parse_ofac(data):
    names = set()
    _OFAC_ENT_ATTRS.clear()
    if not data: return names, "unavailable", ""
    try:
        reader = csv.reader(io.StringIO(data.decode("latin-1")))
        for row in reader:
            if len(row) > 1:
                n = row[1].strip().strip('"')
                if n and n != "-0-":
                    names.add(n)
                    # The remarks column (index 11) carries adjudication
                    # attributes as prose ("DOB 08 Aug 1962; POB ...;
                    # nationality Iraq; alt. DOB 1955"). Best-effort capture;
                    # a "-0-" placeholder simply matches nothing.
                    if len(row) > 11:
                        dobs = re.findall(r"DOB\s+([^;]+)", row[11])
                        nats = re.findall(r"nationality\s+([^;]+)", row[11])
                        if dobs or nats:
                            _note_entry_attrs(n, dobs, nats)
                            ent = row[0].strip()
                            if ent.isdigit():
                                _OFAC_ENT_ATTRS[ent] = (dobs, nats)
    except Exception as e:
        log(f"  OFAC parse error: {e}")
    return names, "live", sha256_of(data)

def parse_ofac_alt(data):
    """OFAC a.k.a. list (alt.csv) → the set of alias names. The SDN publishes its
    weak/strong a.k.a. names in a SEPARATE file; screening only the primary name
    (parse_ofac) is a false-negative gap — a party operating under an SDN alias
    would screen clear. Format: ent_num, alt_num, alt_type, alt_name, remarks →
    the alias name is column index 3. Best-effort: a missing/garbled file yields
    an empty set (the primary SDN list still screens), never an error."""
    aliases = set()
    if not data: return aliases
    try:
        reader = csv.reader(io.StringIO(data.decode("latin-1")))
        for row in reader:
            if len(row) > 3:
                n = row[3].strip().strip('"')
                if n and n != "-0-":
                    aliases.add(n)
                    # An alias designates the same party: inherit the primary
                    # entry's DOB/nationality via the shared ent_num so an
                    # alias match shows the same adjudication context.
                    attrs = _OFAC_ENT_ATTRS.get(row[0].strip())
                    if attrs:
                        _note_entry_attrs(n, attrs[0], attrs[1])
    except Exception as e:
        log(f"  OFAC alt parse error: {e}")
    return aliases

def _fold_ofac_aliases(primary_names, alt_data):
    """Fold alt.csv aliases into a LOADED primary SDN set only. When the
    primary (and, in the unified path, its mirror) failed, folding aliases
    anyway left ofac_names at ~17k alias-only entries — above the 9,000
    coverage floor, so the floor check read the list as OK and the run
    proceeded with every primary SDN name unscreened, reported as full OFAC
    coverage. An unloaded primary must stay EMPTY so the floor machinery
    classifies it honestly (outage: degrade + red; obtained-but-tiny: refuse)."""
    if primary_names:
        primary_names |= parse_ofac_alt(alt_data)
    return primary_names

def parse_un(data):
    names = set()
    date_str = "unknown"
    if not data: return names, date_str, ""
    try:
        root = safe_xml_fromstring(data)
        date_str = root.get("dateGenerated", "unknown")[:10]
        for section in ["INDIVIDUALS", "ENTITIES"]:
            sec = root.find(section)
            if sec is None: continue
            tag = "INDIVIDUAL" if section == "INDIVIDUALS" else "ENTITY"
            alias_tag = "INDIVIDUAL_ALIAS" if section == "INDIVIDUALS" else "ENTITY_ALIAS"
            for entry in sec.findall(tag):
                entry_names = []
                parts = []
                for field in ["FIRST_NAME","SECOND_NAME","THIRD_NAME","FOURTH_NAME","NAME"]:
                    el = entry.find(field)
                    if el is not None and el.text: parts.append(el.text.strip())
                if parts: entry_names.append(" ".join(parts))
                # Designated a.k.a. names are real designations the party operates
                # under — capture them too (EU/UK parsers already do). Missing these
                # was a false-negative gap: a UN alias-only match would screen clear.
                for alias in entry.findall(alias_tag):
                    an = alias.find("ALIAS_NAME")
                    if an is not None and an.text and an.text.strip():
                        entry_names.append(an.text.strip())
                names.update(entry_names)
                # Structured adjudication attributes (individuals carry them;
                # entity entries simply have none): every name of the party,
                # aliases included, gets the same DOB/nationality context.
                dobs = []
                for dob in entry.findall("INDIVIDUAL_DATE_OF_BIRTH"):
                    for t in ("DATE", "YEAR", "FROM_YEAR", "TO_YEAR"):
                        el = dob.find(t)
                        if el is not None and el.text and el.text.strip():
                            dobs.append(el.text.strip())
                nats = []
                for nat in entry.findall("NATIONALITY"):
                    for el in nat.findall("VALUE"):
                        if el.text and el.text.strip():
                            nats.append(el.text.strip())
                if dobs or nats:
                    for n in entry_names:
                        _note_entry_attrs(n, dobs, nats)
    except Exception as e:
        log(f"  UN parse error: {e}")
    return names, date_str, sha256_of(data)

def parse_uk(data):
    names = set()
    date_str = "unknown"
    if not data: return names, date_str, ""
    try:
        lines = data.decode("utf-8-sig").splitlines()
        # OFSI's ConList carries a title line on row 0, then the CSV header on row 1.
        # If that title line is ever absent (format change) or an HTML error page is
        # served with HTTP 200, blindly skipping row 0 would discard the real header
        # and parse EVERY row to blanks → a silently zeroed list. Detect the header.
        reader = csv.DictReader(io.StringIO("\n".join(lines[1:])))
        has_title_row = bool(reader.fieldnames and "Name 6" in reader.fieldnames)
        if not has_title_row:
            reader = csv.DictReader(io.StringIO("\n".join(lines)))  # no title row
        if not (reader.fieldnames and "Name 6" in reader.fieldnames):
            log("  UK parse error: expected 'Name 6' column not found — list NOT parsed")
            return names, "PARSE ERROR — unexpected format", sha256_of(data)
        for row in reader:
            # OFSI splits a name across "Name 1".."Name 5" (given names) with
            # the surname / entity name in "Name 6", and pads empty parts with
            # a literal "0". Screening must see the ASSEMBLED full name — the
            # surname alone or the given names alone score too low against a
            # customer's full name and produce false negatives. Entities carry
            # only "Name 6", so the join degrades to that naturally (this
            # mirrors parseOfsiCsv in scripts/sanctions-match.mjs).
            parts = []
            for i in (1, 2, 3, 4, 5, 6):
                part = (row.get(f"Name {i}") or "").strip()
                if part and part != "0":
                    parts.append(part)
            if parts:
                names.add(" ".join(parts))
        # The list date lives on the TITLE row. With no title row, line 0 is the
        # CSV header and its last cell is a column name (e.g. "Name 3") — showing
        # that as the list date in the audit block would be nonsense. Also require
        # a digit so a reshuffled title row can't smuggle prose in as a date.
        if has_title_row and lines:
            cand = lines[0].split(",")[-1].strip()
            date_str = cand if any(ch.isdigit() for ch in cand) else "unknown"
    except Exception as e:
        log(f"  UK parse error: {e}")
    return names, date_str, sha256_of(data)

def parse_simple_csv(data, label="list"):
    """OpenSanctions targets.simple.csv → set of names (primary + ;-separated
    aliases). One format serves several lists: EU FSF is fetched this way as the
    primary source, and OFAC SDN / UN Consolidated fall back to their
    OpenSanctions mirrors in this format when the official endpoint is
    unreachable (both serve files via 302 to presigned storage URLs, which an
    egress-blocked runner refuses unless the storage host is allowlisted)."""
    names = set()
    if not data: return names
    try:
        reader = csv.DictReader(io.StringIO(data.decode("utf-8")))
        for row in reader:
            try:
                n = (row.get("name") or "").strip()
                if n: names.add(n)
                for a in (row.get("aliases") or "").split(";"):
                    a = a.strip()
                    if a: names.add(a)
            except Exception:
                continue  # one malformed row never zeroes the whole list
    except Exception as e:
        log(f"  {label} parse error: {e}")
    return names

def parse_eu(data):
    names = parse_simple_csv(data, "EU")
    if not data: return names, "unknown", ""
    return names, "live", sha256_of(data)

def parse_canada(data):
    """Canada Consolidated Autonomous Sanctions (SEMA), Global Affairs Canada — free XML.
    Tolerant parse: pulls entity names and combined given/last person names."""
    names = set()
    if not data: return names, "unavailable", ""
    try:
        root = safe_xml_fromstring(data)
        for rec in root.iter():
            # Each record groups name parts as child elements; collect name-ish fields.
            entity = given = last = ""
            aliases = []
            for ch in list(rec):
                tag = ch.tag.split("}")[-1].lower()
                if "alias" in tag or tag == "aka":
                    # Aliases were previously never captured — a party operating
                    # under a SEMA-listed a.k.a. screened clear against this
                    # (supplementary) list. Tolerant of both shapes: nested
                    # <Aliases><Alias>A</Alias>…> (one alias per child element)
                    # and flat <Aliases>A; B</Aliases> (semicolon-separated).
                    kids = list(ch)
                    chunks = ([" ".join(" ".join(k.itertext()).split()) for k in kids]
                              if kids else re.split(r"[;\n]", ch.text or ""))
                    for a in chunks:
                        a = a.strip().strip('"').strip()
                        if len(a) >= 2 and not _OWNER_JUNK_RE.match(a):
                            aliases.append(a)
                    continue
                val = (ch.text or "").strip()
                if not val: continue
                if "entity" in tag or tag == "name": entity = entity or val
                elif "given" in tag or tag == "firstname": given = given or val
                elif "last" in tag or tag == "surname" or tag == "lastname": last = last or val
            if entity: names.add(entity)
            person = " ".join(p for p in [given, last] if p)
            if person and len(person) > 3: names.add(person)
            # An alias designates the SAME party — screened like a primary name.
            # Gated on the record carrying a primary, so a stray alias-shaped
            # element outside a real record cannot inject names.
            if entity or (person and len(person) > 3):
                names.update(aliases)
    except Exception as e:
        log(f"  Canada SEMA parse error: {e}")
    if not names: return names, "unavailable", ""
    return names, "live", sha256_of(data)

def parse_eocn(pdf_path):
    """UAE EOCN Local Terrorist List.

    Primary source is the maintained in-repo JSON (data/eocn-local-terrorist-list.json),
    populated from the official EOCN publication — the EOCN site offers no free
    machine-readable feed and bot-gates its PDF/XLSX, so the list is kept here.
    A raw PDF at repo root (eocn_list.pdf), if present, is still parsed as a fallback.

    Side effects, valid for THIS call whichever branch supplies the names:
    EOCN_REVIEW_ALERT is re-armed from the JSON's lastReviewed (a parse error,
    an empty entries array or an absent file counts as an unverifiable review,
    so the alert arms), and EOCN_SOURCE_STATE records whether any source
    material actually yielded names, which the coverage-floor classifier uses
    to tell an outage (degrade, deliver, then fail) from corruption (refuse)."""
    names = set()
    # Default: no verifiable review record. A parseable JSON below refines
    # this; every other branch keeps the alarm armed. Previously only the
    # successful JSON-with-names branch touched the alert, so a corrupt JSON,
    # an empty entries array, or a run served by the PDF fallback left the
    # review-age gate silently disarmed and the run exited green.
    overdue, msg = eocn_review_check(None)
    EOCN_SOURCE_STATE["obtained"] = False
    json_hash = ""
    # 1) Preferred: the maintained JSON list (zero-dependency, no PDF parsing).
    if os.path.exists(EOCN_JSON_PATH):
        try:
            with open(EOCN_JSON_PATH, "rb") as _f:
                raw = _f.read()
            data = json.loads(raw)
            # Hash here, where raw is provably bound; the names-return below
            # sits outside this try and must not reference raw directly.
            json_hash = sha256_of(raw)
            # Review currency is a property of the file's metadata, not of the
            # entry extraction: evaluate it as soon as the JSON parses so the
            # gate also arms on the empty-entries path.
            overdue, msg = eocn_review_check(data.get("lastReviewed"))
            for e in data.get("entries", []):
                if isinstance(e, str):
                    n = e.strip()
                    if n: names.add(n)
                elif isinstance(e, dict):
                    n = (e.get("name") or "").strip()
                    if n: names.add(n)
                    for a in e.get("aliases", []) or []:
                        a = (a or "").strip()
                        if a: names.add(a)
        except Exception as e:
            log(f"  EOCN JSON parse error: {e}")
    EOCN_REVIEW_ALERT["overdue"], EOCN_REVIEW_ALERT["message"] = overdue, msg
    if overdue:
        log(f"  ALARM: {msg}")
    if names:
        EOCN_SOURCE_STATE["obtained"] = True
        log(f"  EOCN: {len(names)} names from {EOCN_JSON_PATH}")
        date_label = "from maintained list (data/eocn-local-terrorist-list.json)"
        if overdue:
            date_label += " · REVIEW OVERDUE"
        return names, date_label, json_hash
    if os.path.exists(EOCN_JSON_PATH):
        log("  EOCN JSON present but yielded no names - manual update required")
    # 2) Fallback: a raw PDF uploaded to repo root.
    if not os.path.exists(pdf_path):
        log("  EOCN list not found — manual check required")
        return names, "NOT AVAILABLE — populate data/eocn-local-terrorist-list.json", ""
    try:
        with open(pdf_path, "rb") as _f:
            raw = _f.read()
        pdf_hash = sha256_of(raw)
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        for line in text.splitlines():
            line = line.strip()
            if 5 < len(line) < 80:
                if re.match(r"^[A-Z\s\-\'\.]+$", line) and len(line.split()) >= 2:
                    names.add(line)
        log(f"  EOCN: {len(names)} names extracted")
        EOCN_SOURCE_STATE["obtained"] = bool(names)
        return names, "from uploaded PDF", pdf_hash
    except Exception as e:
        log(f"  EOCN parse error: {e}")
        return names, "PARSE ERROR", ""

def parse_internal_watchlist(path=None):
    """Optional firm-internal watchlist (data/internal-watchlist.json): names
    the firm designates internally — declined customers, known fraud
    counterparties, court/police notices — screened IN ADDITION to the
    official lists. Supplementary tier: never floored, never core coverage,
    and EMPTY `entries` is a VALID state ("no internal designations"),
    reported informationally — unlike the official curated lists, where empty
    means DEGRADED coverage. Same entry shapes as the EOCN curated file
    (plain string, or {name, aliases})."""
    path = path or INTERNAL_WATCHLIST_PATH
    names = set()
    if not os.path.exists(path):
        return names, "not configured", ""
    try:
        with open(path, "rb") as _f:
            raw = _f.read()
        data = json.loads(raw)
        for e in data.get("entries", []):
            if isinstance(e, str):
                n = e.strip()
                if n: names.add(n)
            elif isinstance(e, dict):
                n = (e.get("name") or "").strip()
                if n: names.add(n)
                for a in e.get("aliases", []) or []:
                    a = (a or "").strip()
                    if a: names.add(a)
        if names:
            log(f"  INTERNAL: {len(names)} firm-designated name(s) from {path}")
            return names, f"from maintained list ({path})", sha256_of(raw)
        return names, "none designated (empty list is a valid state)", sha256_of(raw)
    except Exception as e:
        log(f"  INTERNAL watchlist parse error: {e} — fix {path}")
        return names, "PARSE ERROR — fix data/internal-watchlist.json", ""

# ── CUSTOMER LOADING ──────────────────────────────────────────────────────────
SKIP_TOKENS = [
    "S.R.L","S.P.A","L.L.C","LLC","FZE","FZCO","DMCC","LTD","N/A",
    "PENDING","ROSYSON","HONOR INVESTMENTS","SIVAL GROUP","VECCHIA",
    "EURO-AGRI","FERRANO","HLC","BAYINDIR ELEKTRIK","HOMEROS",
    "ANONIM SIRKETI","ANONİM ŞİRKETİ","KIYMETLI MADENLER",
]

def _skip_token_hit(n):
    """A SKIP_TOKENS entry only counts on token boundaries: 'LLC' must skip
    'ACME LLC' but not the surname 'WILLCOX' — the old bare-substring test
    silently dropped real people whose names embed a legal-form fragment."""
    up = n.upper()
    return any(re.search(r"(?<![A-Z0-9])" + re.escape(s) + r"(?![A-Z0-9])", up)
               for s in SKIP_TOKENS)

def extract_individuals(notes):
    if not notes or len(notes.strip()) < 100: return []
    # Script-agnostic capture (was a Latin-only char class): a "Name: محمد صالح"
    # line must still be EXTRACTED so the subject reaches the _unscreenable
    # manual-review net — the old pattern matched nothing for non-Latin names,
    # so they bypassed extraction AND the net, screening silently clear. The
    # broader capture also keeps names the old class truncated at the first
    # foreign char or lost entirely at an inline comma ("Name: John Smith,
    # Director" previously extracted NOTHING — the class could not span ","
    # and no alternation matched there).
    pattern = r"Name:[ \t]*([^\n]+?)(?:\n|Shares|Nationality|Passport|Date of|Gender|Emirates|Proof|PEP|$)"
    found = re.findall(pattern, notes)
    cleaned = []
    for n in found:
        n = re.sub(r"\([^)]*\)", " ", n)          # share %, role notes
        n = re.sub(r"\s+", " ", n).strip().strip(".,;:-–—").strip()
        if len(n) < 5: continue
        if _skip_token_hit(n): continue
        if re.search(r"\d", n): continue
        cleaned.append(n)
    return list(dict.fromkeys(cleaned))

# Corporate owner / parent / shareholder lines in a KYC note. A customer owned
# by a DESIGNATED ENTITY (not a natural person) must be screened too — the 50 % /
# control rule applies to corporate owners, and extract_individuals only yields
# natural persons, so this closes a false-negative gap.
_ENTITY_OWNER_RE = re.compile(
    r"(?:Parent(?:\s+Company)?|Shareholder|Ultimate\s+Beneficial\s+Owner|UBO|Holding(?:\s+Company)?|"
    # Separator class carries the EN-dash (U+2013) as well as hyphen/em-dash:
    # word processors auto-convert " - " to " – ", and an owner recorded as
    # "UBO – Al Qaeda Holdings LLC" previously extracted nothing (the same
    # typing-drift class kyc.py fixed for its own header regex).
    r"Owner|Owned\s+by|Beneficial\s+Owner)\s*(?:\([^)]*\))?\s*[:\-–—]\s*([^\n]+)", re.IGNORECASE)
# A name carrying a legal-form token is a corporate entity, not a natural person.
_CORP_FORM_RE = re.compile(
    r"\b(llc|l\.l\.c|fze|fzco|fzc|dmcc|dwc|pjsc|psc|plc|ltd|limited|inc|incorporated|corp|"
    r"corporation|company|group|holdings?|gmbh|sarl|bv|nv|s\.a|ag|pte|sdn|bhd|establishment|"
    r"industries|international|enterprises|trust|foundation|stiftung|waqf|anstalt)\b", re.IGNORECASE)
# Owner-line values that are placeholders, not names.
_OWNER_JUNK_RE = re.compile(r"^(?:n/?a|none|nil|not\s+applicable|pending|tbc|tbd|unknown|[-–—_]+)$",
                            re.IGNORECASE)
def _looks_corporate(name):
    return bool(_CORP_FORM_RE.search(name or "")) or kyc.is_arrangement_entity(name or "")
def _owner_candidates(notes):
    """Cleaned party names from Parent/Shareholder/UBO/Owner lines."""
    for m in _ENTITY_OWNER_RE.finditer(notes or ""):
        cand = re.sub(r"\([^)]*\)", " ", m.group(1))   # share %, role notes
        cand = re.sub(r"\s+", " ", cand).strip().strip(".,;").strip()
        if cand and len(cand) >= 5 and not _OWNER_JUNK_RE.match(cand):
            yield cand
def extract_entity_owners(notes):
    if not notes: return []
    # Corporate owners (carry a legal-form / arrangement token) — screened as
    # ENTITY subjects under the 50%/control rule.
    return list(dict.fromkeys(c for c in _owner_candidates(notes) if _looks_corporate(c)))
def extract_owner_individuals(notes):
    """Owner/UBO/shareholder lines naming a party WITHOUT a corporate token — a
    natural person, or an unincorporated designated organisation ("UBO: Islamic
    Revolutionary Guard Corps Quds Force"). extract_individuals only reads
    "Name:" lines, so a party recorded ONLY on an owner line was previously
    dropped by BOTH extractors and never screened at all — the comment that
    "natural persons are already captured by extract_individuals" assumed a
    Name: line that need not exist."""
    if not notes: return []
    return list(dict.fromkeys(c for c in _owner_candidates(notes) if not _looks_corporate(c)))

def _individuals_union(struct_names, notes):
    """UNION of the structured KYC parse, the regex Name: extractor and the
    owner-line individuals — deduped case/diacritic-insensitively. The old
    `structured or regex` either/or meant one recognised SECTION-4 block hid
    every other Name: line in the note (SECTION 5, drifted headers like
    "Individual 2, Shareholder") — those people were silently never screened.
    _norm_lower is empty for a fully non-Latin name — fall back to the
    NFC-folded string so such names are deduped, never dropped (they must
    reach the _unscreenable manual-review net)."""
    out, seen = [], set()
    for nm in (list(struct_names) + extract_individuals(notes)
               + extract_owner_individuals(notes)):
        k = _norm_lower(nm) or unicodedata.normalize("NFC", str(nm)).strip().lower()
        if k and k not in seen:
            seen.add(k)
            out.append(nm)
    return out

def get_all_customers():
    customers = []
    params = {
        "project": ASANA_CUSTOMER_DB_GID,
        "opt_fields": "gid,name,notes,permalink_url,created_at",
        "limit": 100,
    }
    while True:
        r = asana_request("GET", "https://app.asana.com/api/1.0/tasks", params=params)
        if r is None or r.status_code not in (200, 201):
            raise RuntimeError(f"Asana customer fetch failed: "
                               f"{getattr(r,'status_code','network')} {getattr(r,'text','')[:200]}")
        data = r.json() if isinstance(r.json(), dict) else {}
        for t in (data.get("data") or []):
            if not t.get("gid") or not t.get("name"):
                continue  # skip malformed row, never crash the whole run
            notes = t.get("notes") or ""
            # Structured KYC (FATF R.10/R.25): DOB, nationality, ID, share %, role,
            # CDD gaps, legal-arrangement detection. Falls back to the regex name
            # extractor if the note isn't in the structured format.
            kyc_data = kyc.parse_customer(notes)
            struct_inds = kyc_data.get("individuals", [])
            # UNION of every extractor (see _individuals_union) — a recognised
            # SECTION-4 block must not hide Name: lines elsewhere in the note,
            # and parties recorded ONLY on a UBO/Owner line must be screened.
            individuals = _individuals_union([i["name"] for i in struct_inds], notes)
            # Corporate owners/parents named in the note that are NOT natural persons
            # (already in `individuals`) — screened as ENTITY subjects (50%/control).
            entity_owners = [e for e in extract_entity_owners(notes)
                             if _norm_lower(e) not in {_norm_lower(i) for i in individuals}]
            customers.append({
                "gid": t["gid"],
                "name": t["name"],
                "permalink": t.get("permalink_url",""),
                "created_at": t.get("created_at",""),
                "individuals": individuals,
                "entity_owners": entity_owners,
                "kyc": kyc_data,
                "country": kyc_data.get("country", ""),
                "has_assessment": len(notes.strip()) > 100,
            })
        next_page = data.get("next_page") or None
        if not next_page or not next_page.get("offset"):
            break
        params["offset"] = next_page["offset"]
    log(f"Loaded {len(customers)} customers")
    # Fail-safe: 0 customers is never a legitimate state (the Customer Database is
    # never empty). A 200-with-empty-data — wrong ASANA_CUSTOMER_DB_GID, project
    # emptied, or a token scoped away — must NOT be screened as an all-clear. Abort
    # loudly (non-zero exit) rather than post a green ✅ for an unscreened base.
    if not customers:
        raise RuntimeError(
            "FATAL: 0 customers read from the Asana Customer Database — refusing to "
            "screen or post an all-clear. Check ASANA_CUSTOMER_DB_GID and the token's access.")

    # ── Employee screening (HR – Employees project) ──────────────────────────
    # Staff are a screening population in their own right (employee due
    # diligence): each task NAME is the person, screened as an individual, with
    # any structured note parsed exactly like a customer note. Same pipeline,
    # same matcher, same guards, same delta state — an employee hit raises the
    # same case a customer hit would. Configured-but-unreachable (or empty) is
    # FATAL for the same reason the customer fail-safe exists: a population
    # that silently drops out of screening is a silent clear for everyone in it.
    if ASANA_EMPLOYEE_DB_GID:
        employees = []
        eparams = {
            "project": ASANA_EMPLOYEE_DB_GID,
            "opt_fields": "gid,name,notes,permalink_url,created_at",
            "limit": 100,
        }
        while True:
            r = asana_request("GET", "https://app.asana.com/api/1.0/tasks", params=eparams)
            if r is None or r.status_code not in (200, 201):
                raise RuntimeError(
                    f"FATAL: Asana employee fetch failed "
                    f"({getattr(r,'status_code','network')}) — refusing to screen a "
                    f"population that silently dropped out. Check ASANA_EMPLOYEE_DB_GID "
                    f"or set it empty to disable employee screening explicitly.")
            data = r.json() if isinstance(r.json(), dict) else {}
            for t in (data.get("data") or []):
                if not t.get("gid") or not t.get("name"):
                    continue
                notes = t.get("notes") or ""
                kyc_data = kyc.parse_customer(notes)
                individuals = _individuals_union(
                    [t["name"]] + [i["name"] for i in kyc_data.get("individuals", [])], notes)
                employees.append({
                    "gid": t["gid"],
                    "name": t["name"],
                    "permalink": t.get("permalink_url", ""),
                    "created_at": t.get("created_at", ""),
                    "individuals": individuals,
                    "entity_owners": [],
                    "kyc": kyc_data,
                    "country": kyc_data.get("country", ""),
                    "has_assessment": len(notes.strip()) > 100,
                    "kind": "employee",
                })
            next_page = data.get("next_page") or None
            if not next_page or not next_page.get("offset"):
                break
            eparams["offset"] = next_page["offset"]
        if not employees:
            raise RuntimeError(
                "FATAL: 0 employees read from the HR – Employees project while employee "
                "screening is configured — refusing to screen a population that silently "
                "dropped out. Check ASANA_EMPLOYEE_DB_GID or set it empty to disable.")
        log(f"Loaded {len(employees)} employees (screened with the same pipeline as customers)")
        customers.extend(employees)
    return customers

# ── SCREENING ─────────────────────────────────────────────────────────────────
def core_tokens(norm):
    """Distinctive tokens of a normalized name (boilerplate removed)."""
    return [t for t in norm.split() if t not in STOPWORD_TOKENS and len(t) > 1]

def _token_set_ratio(a, b):
    """rapidfuzz token_set_ratio when available (production), else 0 so the extra
    recall gate is simply inert under a minimal offline stub — never an error."""
    fn = getattr(fuzz, "token_set_ratio", None)
    return fn(a, b) if fn else 0

def _is_token_subset(a_norm, b_norm):
    """True when EVERY distinctive token of the SHORTER of the two names closely
    matches a token in the longer one, and the longer has strictly more tokens.
    This is the patronymic / extra-middle-name case ("USAMA BIN LADIN" vs the
    full listed chain) — a strong, low-false-positive subset signal. Requires ≥2
    distinctive tokens so a single common token can't trigger it. SYMMETRIC by
    ordering on token count: the KYC name may sit on either side — a customer
    recorded as "Islamic Revolutionary Guard Corps Quds Force" must flag the
    designated entry "QUDS FORCE" exactly as the short spelling flags the long
    chain; fixing the argument order to customer-first silently screened the
    superset direction clear (a sanctions false negative)."""
    ta, tb = core_tokens(a_norm), core_tokens(b_norm)
    if len(tb) < len(ta):
        ta, tb = tb, ta
    if len(ta) < 2 or len(tb) <= len(ta):
        return False
    return all(any(fuzz.token_sort_ratio(t, u) >= 88 for u in tb) for t in ta)

def match_score(n_norm, e_norm):
    """Returns (decisive_score, full_score, core_score, tset_score).

    decisive_score = min(full, core): a pair only scores high if BOTH the whole
    string AND its distinctive core agree. Two firms sharing only legal-form /
    sector boilerplate ("SANAYI VE TICARET ANONIM SIRKETI") score high on `full`
    but low on `core`, so the min collapses the false positive. When neither side
    has a distinctive core (e.g. a pure person-name), we fall back to `full`.

    tset_score = token_set_ratio: asymmetry-tolerant, it scores high when one
    name's tokens are a SUBSET of the other's — a short KYC spelling vs a long
    patronymic chain ("USAMA BIN LADEN" vs "USAMA BIN MUHAMMAD BIN AWAD BIN
    LADIN"). Used ONLY as an additional positive signal under a strict gate in
    screen_name; it never loosens the min()."""
    full = fuzz.token_sort_ratio(n_norm, e_norm)
    tset = _token_set_ratio(n_norm, e_norm)
    cn, ce = core_tokens(n_norm), core_tokens(e_norm)
    if not cn or not ce:
        return full, full, full, tset
    core = fuzz.token_sort_ratio(" ".join(cn), " ".join(ce))
    return min(full, core), full, core, tset

def confidence_tier(core):
    if core >= 92: return "STRONG"
    if core >= 85: return "MODERATE"
    return "WEAK"

# ── PHONETIC FOLD (romanization-drift recall) ────────────────────────────────
# A name whose EVERY significant token sits ≥2 edits off the listed spelling
# ("Muhamet Huseinn" vs "MUHAMMAD HUSSEIN" ≈ 69) scores below every fuzzy gate
# and used to clear BY DESIGN — the model card pinned it as a residual. This
# layer closes it: each token folds to a romanization-robust consonantal key,
# and a pair whose token key-lists agree exactly (or form the strict
# patronymic-subset shape) flags as a WEAK phonetic-only possible match at its
# real (conservative) fuzzy score — never confirmed, never suppressing or
# lowering any existing hit. The fold is tuned for Arabic AND Cyrillic
# romanization drift: digraphs collapse BEFORE run-collapse (else "kayoom"
# loses its oo→u), the first vowel is kept but only up to the Arabic-real
# distinctions ({e,i} and {o,u} merge; a stays apart — hassan/hussein must NOT
# collide), and a trailing vowel is preserved so gender/nisba suffixes
# (hana/hani, qassem/qasemi) stay distinct. Keys are computed on
# transliteration-CANONICAL tokens (data/translit-groups.json), so khalid/
# khaled or omar/umar share a key by group membership rather than luck, and
# the particles abu/abd merge into their following token ("Abou Bakr" ≡
# "Aboubakr"). Pure string ops — identical under the offline difflib stub.
_PHON_DIGRAPHS = (("shch", "s"), ("sch", "s"), ("sh", "s"), ("ch", "c"),
                  ("zh", "j"), ("kh", "k"), ("gh", "k"), ("ph", "f"),
                  ("th", "t"), ("dh", "d"), ("dj", "j"), ("ck", "k"),
                  ("ts", "c"), ("tz", "c"), ("x", "ks"), ("oo", "u"),
                  ("ou", "u"), ("ee", "i"), ("ei", "i"), ("ey", "i"))
_PHON_VOWEL_CLASS = {"a": "a", "e": "i", "i": "i", "o": "u", "u": "u"}
_PHON_CHAR_MAP = str.maketrans({"q": "k", "c": "k", "g": "k", "w": "v",
                                "p": "b", "d": "t", "z": "s"})
_PHON_PARTICLES = {"abu", "abou", "abo", "abd"}

@functools.lru_cache(maxsize=1 << 18)
def phonetic_key(token):
    """Romanization-robust key of one lowercase token (identity below 3 chars)."""
    t = token
    if len(t) < 3:
        return t
    for pat, rep in _PHON_DIGRAPHS:          # digraphs FIRST (before run-collapse)
        t = t.replace(pat, rep)
    t = re.sub(r"(.)\1+", r"\1", t)          # collapse doubled letters
    t = t.replace("y", "i")
    t = t.translate(_PHON_CHAR_MAP)
    if len(t) > 3 and t.endswith("e"):       # French/Latin silent trailing e
        t = t[:-1]
    first = t[0]
    fv = next((c for c in t[1:] if c in "aeiou"), "")
    fv = _PHON_VOWEL_CLASS.get(fv, fv)
    rest = "".join(c for c in t[1:] if c not in "aeiou" and c != "h")
    tail = _PHON_VOWEL_CLASS[t[-1]] if len(t) > 1 and t[-1] in "aeiou" else ""
    return re.sub(r"(.)\1+", r"\1", first + fv + rest + tail)

def phonetic_tokens(norm):
    """Distinctive tokens of a normalized name, particle-merged and folded to
    their transliteration-canonical spellings — the token stream the phonetic
    keys are computed over."""
    toks = [t.lower() for t in core_tokens(norm)]
    merged, i = [], 0
    while i < len(toks):
        if toks[i] in _PHON_PARTICLES and i + 1 < len(toks):
            merged.append(toks[i] + toks[i + 1]); i += 2
        else:
            merged.append(toks[i]); i += 1
    return [ai.translit_canon_token(t) for t in merged]

@functools.lru_cache(maxsize=1 << 18)
def _phonetic_profile(norm):
    """Sorted (key, token-length) pairs, or None when the name has fewer than
    two significant tokens — a single common token must never carry a
    phonetic-only hit. Cached by normalized string, so list entries are folded
    once per process however many subjects screen against them."""
    toks = phonetic_tokens(norm)
    if len(toks) < 2:
        return None
    return tuple(sorted((phonetic_key(t), len(t)) for t in toks))

def _phonetic_pair_match(a_profile, b_profile):
    """'equal' when both names' sorted key-lists agree exactly and every paired
    token's raw lengths differ by ≤3 (a same-key token pair 4+ letters apart is
    a different name wearing the same consonant skeleton); 'subset' when the
    SHORTER side (≥2 tokens, each ≥4 chars) is wholly contained in the strictly
    longer side's key multiset — the patronymic / extra-middle-name shape the
    fuzzy subset gate misses when spellings drift beyond its 88 per-token bar.
    None otherwise. Strictly additive: callers only ever ADD a hit on a match."""
    if a_profile is None or b_profile is None:
        return None
    if len(a_profile) == len(b_profile):
        if [p[0] for p in a_profile] == [p[0] for p in b_profile] and \
           all(abs(p[1] - q[1]) <= 3 for p, q in zip(a_profile, b_profile)):
            return "equal"
        return None
    short, long_ = (a_profile, b_profile) if len(a_profile) < len(b_profile) else (b_profile, a_profile)
    if len(short) < 2 or sum(1 for p in short if p[1] >= 4) < 2:
        return None
    pool = [p[0] for p in long_]
    for k, _len in short:
        if k in pool:
            pool.remove(k)
        else:
            return None
    return "subset"

def _phonetic_mode():
    """MATCH_PHONETIC ∈ 1 (live, default) | shadow (count + log, no hits) | 0
    (off). Read at call time so tests and operators can toggle per run; an
    unknown value is rejected LOUDLY and the default kept."""
    v = os.environ.get("MATCH_PHONETIC", "1").strip().lower()
    if v in ("1", "shadow", "0"):
        return v
    log(f"MATCH_PHONETIC={v!r} is not one of 1|shadow|0 — using default 1")
    return "1"

_PHONETIC_SHADOW = {"count": 0}   # shadow-mode tally (read by tests/operators)

# ── Exact match blocking (C-side prefilter, bit-identical results) ───────────
# The full sweep scores every (subject, entry) pair in a Python loop — ~870
# subjects × ~290k crime-watchlist names alone is ~250M pair evaluations whose
# cost is dominated by Python call overhead, a silent ~33-minute CPU grind
# that is exactly the window the 24-25 Jul runner-VM deaths landed in.
# rapidfuzz.process.extract runs that loop in multithreaded C with a
# score_cutoff, and the hit gates make two cutoffs a NECESSARY condition:
#   - the primary gate needs min(full, core) ≥ THRESHOLD, so full
#     (token_sort_ratio) ≥ THRESHOLD — and the short-entry gate needs
#     score ≥ SHORT_ENTRY_THRESHOLD ≥ THRESHOLD, so the same cutoff covers it;
#   - the additive subset gate is ANDed with best_tset ≥ TOKENSET_THRESHOLD
#     (token_set_ratio).
# An entry surviving NEITHER cutoff for ANY variant can never append a hit
# (non-hits leave no other trace), so only survivors are scored in Python and
# the output is bit-identical with blocking on or off —
# test/engine_test.py asserts that equivalence on adversarial fixtures.
# Survivors are re-iterated in ascending entry order, preserving the exact
# insertion order (and therefore identical tie-breaks) of the unblocked loop.
# Falls back to the plain loop when rapidfuzz.process is unavailable (the
# offline test stub). Kill-switch: MATCH_BLOCKING=0.
MATCH_BLOCKING = os.environ.get("MATCH_BLOCKING", "1") == "1"
try:
    from rapidfuzz import process as _rf_process
except Exception:
    _rf_process = None
_NORMS_CACHE = {}   # id(entries) -> (entries, [norm, ...]) — strong ref pins the id

def _entry_norms(entries):
    # Rebuild on length change as well as identity change: an entries list
    # mutated in place after first being screened would otherwise serve stale
    # norms, and the prefilter would silently never survey the added names — a
    # sanctions false negative. No production path mutates a list today (every
    # loader builds its list once), but this invariant is what the whole
    # "bit-identical with blocking on/off" claim rests on, so it is guarded
    # here rather than assumed of every future caller.
    key = id(entries)
    cached = _NORMS_CACHE.get(key)
    if cached is None or cached[0] is not entries or len(cached[1]) != len(entries):
        cached = (entries, [e[0] for e in entries])
        _NORMS_CACHE[key] = cached
    return cached[1]

def _survivor_indices(variants, entries):
    """Indices of entries that could possibly hit for ANY variant, via two
    C-side cutoff passes (full ≥ THRESHOLD, token-set ≥ TOKENSET_THRESHOLD).
    None ⇒ prefilter unavailable; caller scores every entry (identical
    results, original speed)."""
    if not (MATCH_BLOCKING and _rf_process is not None
            and getattr(fuzz, "token_set_ratio", None)):
        return None
    norms = _entry_norms(entries)
    survivors = set()
    # With the shadow challenger on, the full-string cutoff drops to the shadow
    # band's floor so shadow-band pairs survive the prefilter too — the shadow
    # tally must be identical with blocking on or off (score ≥ shadow ⇒ full ≥
    # shadow keeps the cutoff a necessary condition, same argument as the hit
    # gates). Costs more survivors only while a challenger is being evidenced.
    full_cutoff = THRESHOLD if SHADOW_THRESHOLD_VALUE is None else min(THRESHOLD, SHADOW_THRESHOLD_VALUE)
    for cand in variants:
        for scorer, cutoff in ((fuzz.token_sort_ratio, full_cutoff),
                               (fuzz.token_set_ratio, TOKENSET_THRESHOLD)):
            for _choice, _score, idx in _rf_process.extract(
                    cand, norms, scorer=scorer, score_cutoff=cutoff, limit=None):
                survivors.add(idx)
    return sorted(survivors)

# ── Phonetic candidate index (keeps the C-side prefilter recall-complete) ────
# The two rapidfuzz cutoffs above are necessary conditions of the FUZZY gates
# only: a phonetic-only pair ("Muhamet Huseinn" ≈ 69) survives neither, so in
# blocked mode the phonetic branch would be silently unreachable — the exact
# defect class the blocking-equivalence property exists to catch. This index
# restores completeness: a posting list per phonetic key, and a candidate is
# any entry sharing ≥2 of a variant's distinct keys (or all of them when the
# variant has fewer than 2 distinct keys). That count rule covers all three
# hit shapes — equal key-lists share every key; a subset's shorter side (≥2
# tokens by gate) appears in one posting per token; the reverse direction
# contributes its ≥2 keys — so blocked and unblocked stay bit-identical.
# Cache carries the same identity + length-rebuild invariants as _NORMS_CACHE.
_PHON_IDX_CACHE = {}   # id(entries) -> (entries, postings, entry_count)

def _phonetic_postings(entries):
    key = id(entries)
    cached = _PHON_IDX_CACHE.get(key)
    if cached is None or cached[0] is not entries or cached[2] != len(entries):
        postings = {}
        for i, (en, _orig) in enumerate(entries):
            prof = _phonetic_profile(en)
            if prof is None:
                continue
            for k in {p[0] for p in prof}:
                postings.setdefault(k, []).append(i)
        cached = (entries, postings, len(entries))
        _PHON_IDX_CACHE[key] = cached
    return cached[1]

def _phonetic_candidates(variant_profiles, entries):
    postings = _phonetic_postings(entries)
    cand = set()
    for prof in variant_profiles:
        keys = {p[0] for p in prof}
        need = min(2, len(keys))
        counts = {}
        for k in keys:
            for i in postings.get(k, ()):
                counts[i] = counts.get(i, 0) + 1
        cand.update(i for i, c in counts.items() if c >= need)
    return cand

def screen_name(name, all_lists):
    n = normalize(name)
    if len(n) < 4: return []
    # Transliteration-aware recall: also screen Arabic/Turkish spelling variants
    # (Mohammed/Muhammad, Abdul/Abdel, bin/ibn …). Usually 1 variant; a handful
    # only for names containing a known particle, so cost stays bounded.
    variants = {n}
    for v in ai.name_variants(name):
        nv = normalize(v)
        if len(nv) >= 4:
            variants.add(nv)
    hits = []
    # Phonetic layer state for this subject: profiles of every variant, or an
    # empty list when the subject has <2 significant tokens (layer inert).
    phon_mode = _phonetic_mode()
    variant_profiles = []
    if phon_mode != "0":
        variant_profiles = [p for p in (_phonetic_profile(v) for v in variants)
                            if p is not None]
    for list_name, entries in all_lists.items():
        surv = _survivor_indices(variants, entries)
        if surv is not None and variant_profiles:
            # Union the phonetic candidates in so the C-side prefilter stays
            # recall-complete for the phonetic branch (bit-identical results
            # with blocking on or off — asserted by the equivalence property).
            surv = sorted(set(surv) | _phonetic_candidates(variant_profiles, entries))
        for en, orig in (entries if surv is None else (entries[i] for i in surv)):
            if len(en) < 2: continue
            best = None; best_tset = 0; subset = False
            for cand in variants:
                score, full, core, tset = match_score(cand, en)
                if best is None or score > best[0]:
                    best = (score, full, core)
                if tset > best_tset:
                    best_tset = tset
                if not subset and _is_token_subset(cand, en):
                    subset = True
            score, full, core = best
            # Short designated names (HAMAS, IRISL, ISIL, ANO …) are real and must
            # never be dropped from screening — but fuzzy-matching a <6-char string
            # invites false positives, so require a NEAR-EXACT match for short
            # entries rather than the normal fuzzy gate. Long entries keep the
            # combined full+core gate unchanged.
            if len(en) < 6:
                if score >= SHORT_ENTRY_THRESHOLD:
                    hits.append({"list": list_name, "matched_entry": orig, "score": score,
                                 "name_score": full, "core_score": core,
                                 "confidence": confidence_tier(core),
                                 "match_context": match_context_for(orig)})
                continue
            # Primary gate: whole-string AND distinctive-core agreement (min()).
            # Additive recall gate: a true token-SUBSET (every distinctive token of
            # the shorter name present in the longer designated entry) with a high
            # token_set_ratio also flags — the patronymic-chain / extra-middle-name
            # case the min() misses. Recorded at the conservative min-based score so
            # it reads as a POSSIBLE match for MLRO disambiguation, never confirmed.
            if (score >= THRESHOLD and core >= CORE_THRESHOLD) or \
               (subset and best_tset >= TOKENSET_THRESHOLD):
                hits.append({"list": list_name, "matched_entry": orig, "score": score,
                             "name_score": full, "core_score": core, "set_score": best_tset,
                             "confidence": confidence_tier(core),
                             "match_context": match_context_for(orig)})
            else:
                # Phonetic-only branch: strictly additive (behind the fuzzy
                # gates — it can never replace, lower or suppress a fuzzy
                # hit). Recorded at the conservative min-based score so it
                # always reads as a POSSIBLE match for MLRO disambiguation,
                # never confirmed.
                pm = None
                if variant_profiles:
                    e_prof = _phonetic_profile(en)
                    if e_prof is not None:
                        for vp in variant_profiles:
                            pm = _phonetic_pair_match(vp, e_prof)
                            if pm:
                                break
                if pm:
                    if phon_mode == "shadow":
                        _PHONETIC_SHADOW["count"] += 1
                        log(f'  PHONETIC-SHADOW: "{name}" ~ "{orig}" [{list_name}] '
                            f"{pm} key match, fuzzy score {score} — no hit emitted (shadow mode)")
                    else:
                        hits.append({"list": list_name, "matched_entry": orig, "score": score,
                                     "name_score": full, "core_score": core, "set_score": best_tset,
                                     "phonetic": True, "phonetic_shape": pm,
                                     "confidence": "WEAK (phonetic-only)",
                                     "match_context": match_context_for(orig)})
                elif SHADOW_THRESHOLD_VALUE is not None and score >= SHADOW_THRESHOLD_VALUE:
                    # Shadow challenger band [shadow, THRESHOLD): counted and
                    # logged as decision-log evidence — NEVER a hit, a case or
                    # a delta-state entry.
                    _SHADOW_CHALLENGER["count"] += 1
                    if len(_SHADOW_CHALLENGER["examples"]) < _SHADOW_LOG_CAP:
                        _SHADOW_CHALLENGER["examples"].append(
                            {"subject": name, "entry": orig, "list": list_name,
                             "score": round(score, 1)})
                        log(f'  SHADOW-CHALLENGER: "{name}" ~ "{orig}" [{list_name}] '
                            f"score {score:.1f} in [{SHADOW_THRESHOLD_VALUE:g}, {THRESHOLD:g}) — log-only, no hit")
    best = {}
    for h in hits:
        key = (h["list"], h["matched_entry"])
        if key not in best or h["score"] > best[key]["score"]:
            best[key] = h
    return sorted(best.values(), key=lambda x: -x["score"])

def _lost_script_letters(name):
    """True when the name carries LETTERS that normalize() strips entirely —
    Arabic/Cyrillic/CJK/Greek script, or unfoldable Latin like Ł/Æ. Their
    content vanishes from the match key, so the fuzzy pass compares only the
    Latin/digit residue. Diacritic Latin (Müller, İnönü) folds to A-Z and is
    NOT flagged. NFD after upper() mirrors normalize()'s own pipeline."""
    up = unicodedata.normalize("NFD", str(name or "").upper())
    return any(unicodedata.category(c).startswith("L") and not ("A" <= c <= "Z")
               for c in up)

def _unscreenable(name):
    # A name that carries content but collapses to fewer than 4 matchable chars
    # after normalize() (e.g. recorded only in Arabic/Cyrillic/CJK script, which
    # the Latin normaliser strips to empty) cannot be auto-screened. Returning no
    # hits would file it as "clear" — a silent sanctions false negative — so these
    # are surfaced for manual screening instead.
    # A MIXED-script name is the same gap in disguise: "محمد صالح TRADING LLC"
    # leaves an ≥4-char Latin residue ("TRADING LLC"), so the old length test
    # passed it to the fuzzy pass — which then screened boilerplate only and
    # cleared the customer while the all-Latin transliteration of the same name
    # hits. Any name whose letters are partly lost by normalize() therefore
    # ALSO surfaces for manual screening (its Latin residue is still fuzzy-
    # screened as before; the manual-review hit rides alongside).
    return bool(name and str(name).strip()) and (
        len(normalize(name)) < 4 or _lost_script_letters(name))

def _manual_review_hit(subject_type, subject_name, control_linkage):
    return {"subject_type": subject_type, "subject_name": subject_name,
            "control_linkage": control_linkage, "unscreenable": True,
            "list": "MANUAL REVIEW",
            "matched_entry": "name not auto-screenable (non-Latin script or too short) — screen this subject manually against all lists",
            "score": 0, "name_score": 0, "core_score": 0, "confidence": "REVIEW"}

def screen_customers(customers, all_lists):
    possible_matches, clear = [], []
    for c in customers:
        hits = []
        if _unscreenable(c["name"]):
            hits.append(_manual_review_hit("ENTITY", c["name"], False))
        for h in screen_name(c["name"], all_lists):
            hits.append({"subject_type":"ENTITY","subject_name":c["name"],
                         "control_linkage": False, **h})
        for ind in c["individuals"]:
            if _unscreenable(ind):
                hits.append(_manual_review_hit("INDIVIDUAL", ind, True))
            for h in screen_name(ind, all_lists):
                # An owner / director / UBO matching a designation flags the
                # COMPANY by ownership/control linkage (the 50%/control rule),
                # even though the company name itself did not match.
                hits.append({"subject_type":"INDIVIDUAL","subject_name":ind,
                             "control_linkage": True, **h})
        for ent in c.get("entity_owners", []):
            if _unscreenable(ent):
                hits.append(_manual_review_hit("ENTITY (owner)", ent, True))
            for h in screen_name(ent, all_lists):
                # A DESIGNATED corporate owner/parent flags the customer by the
                # 50%/control rule just like a natural-person owner.
                hits.append({"subject_type":"ENTITY (owner)","subject_name":ent,
                             "control_linkage": True, **h})
        if hits:
            possible_matches.append({**c,"hits":hits})
        else:
            clear.append(c)
    return possible_matches, clear

# ── DELTA ENGINE — "what changed since last run" ──────────────────────────────
# A daily control that re-reports the same standing matches every morning buries
# new risk in noise. We persist a fingerprint of everything already reported and
# flag only what is NEW. State is committed back to main by the workflow so the
# next run diffs against it. (A standing match is shown, but clearly marked as
# previously-seen, never dropped — coverage is never silently reduced.)
def load_delta_state():
    try:
        with open(DELTA_STATE_PATH) as f:
            d = json.load(f)
            return d if isinstance(d, dict) else {}
    except Exception:
        return {}

def save_delta_state(state):
    # Atomic write: the delta state gates what the NEXT run reports as new vs
    # standing; a half-written file would corrupt that judgement, so never write
    # it in place.
    if _atomic_write_text(DELTA_STATE_PATH, json.dumps(state, indent=0, sort_keys=True)):
        log(f"  delta state saved ({len(state)} fingerprints)")
    else:
        log("  delta state save error — next run may re-report standing items")

DELTA_RESURFACE_GAP_DAYS = 7     # re-alert an item that reappears after this gap (de-list → re-list)
DELTA_RETENTION_DAYS     = 400   # drop fingerprints unseen this long (bounds file growth)

def _delta_days(a, b):
    try:
        da = datetime.datetime.strptime(str(a)[:10], "%Y-%m-%d").date()
        db = datetime.datetime.strptime(str(b)[:10], "%Y-%m-%d").date()
        return abs((db - da).days)
    except Exception:
        return 0

def _name_sig(name: str) -> str:
    """Stable, non-empty fingerprint component for a name/title. normalize()
    strips non-Latin scripts to "" — used directly in a delta key, every
    Arabic/Cyrillic/CJK subject would collapse to the SAME key, so the 2nd+
    unscreenable customer is born 'standing' and never opens an MLRO case.
    Fall back to a hash of the NFC form when the Latin normalization is empty."""
    n = normalize(name)
    if n:
        return n
    s = unicodedata.normalize("NFC", str(name or "")).strip()
    if not s:
        return ""
    return "#" + hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]

def _delta_mark(state, key, today):
    """Returns (is_new, first_seen). Records first/last seen. An item that reappears
    after a gap of > DELTA_RESURFACE_GAP_DAYS (i.e. it fell off the lists and was
    re-listed, or coverage lapsed) is treated as NEW again, so a re-listing is not
    silently deduped as 'standing'. Backward-compatible with legacy string values."""
    rec = state.get(key)
    if isinstance(rec, str):
        first = last = rec                       # legacy: value was the first_seen date
    elif isinstance(rec, dict):
        first, last = rec.get("first"), rec.get("last") or rec.get("first")
    else:
        first = last = None
    resurfaced = bool(last) and _delta_days(last, today) > DELTA_RESURFACE_GAP_DAYS
    is_new = (first is None) or resurfaced
    if is_new:
        first = today
    state[key] = {"first": first, "last": today}
    return is_new, first

def prune_delta_state(state, today, retention_days=DELTA_RETENTION_DAYS):
    """Drop fingerprints not seen within the retention window so the state file
    cannot grow without bound. Returns the number pruned."""
    dropped = []
    for key, rec in list(state.items()):
        last = rec if isinstance(rec, str) else (rec.get("last") or rec.get("first") if isinstance(rec, dict) else None)
        if last and _delta_days(last, today) > retention_days:
            dropped.append(key)
    for key in dropped:
        del state[key]
    return len(dropped)

def classify_deltas(possible_matches, adverse_findings, pep_findings, state, today):
    """Annotate every hit/finding with is_new / first_seen. Returns new-counts."""
    n_s = n_a = n_p = 0
    for m in possible_matches:
        m_new = False
        for h in m["hits"]:
            # Include the SUBJECT (which owner/director/entity matched) in the key.
            # Without it, a newly-added director matching the same list entry the
            # entity already matched would dedupe to "standing" and never open an
            # MLRO case. (One-time effect on upgrade: existing standing matches
            # re-key and re-surface once for review — the conservative outcome.)
            key = (f"SANC|{_name_sig(m['name'])}|{h.get('subject_type','')}|"
                   f"{_name_sig(h.get('subject_name',''))}|{h['list']}|{normalize(h['matched_entry'])}")
            is_new, first = _delta_mark(state, key, today)
            h["is_new"], h["first_seen"] = is_new, first
            if is_new: n_s += 1; m_new = True
        m["is_new"] = m_new
    for f in adverse_findings:
        f_new = False
        for a in f["articles"]:
            # Key on the NORMALIZED TITLE, not the URL: Google News links carry
            # volatile tracking params that change every fetch, which would make the
            # same standing story re-appear as NEW forever. Title is stable.
            sig = _name_sig(a.get("title", "")) or (a.get("url", "") or "")
            key = f"AM|{_name_sig(f['subject_name'])}|{sig}"
            is_new, first = _delta_mark(state, key, today)
            a["is_new"], a["first_seen"] = is_new, first
            if is_new: n_a += 1; f_new = True
        f["is_new"] = f_new
    for p in pep_findings:
        # Fall back to description/label when the Wikidata id is empty, so two
        # different same-named PEP subjects don't collide to one blank key.
        pid = p.get("id") or normalize(p.get("description", ""))[:48] or normalize(p.get("label", ""))
        key = f"PEP|{_name_sig(p['subject_name'])}|{pid}"
        is_new, first = _delta_mark(state, key, today)
        p["is_new"], p["first_seen"] = is_new, first
        if is_new: n_p += 1
    return {"sanctions": n_s, "adverse": n_a, "pep": n_p}

def _internal_watchlist_block(list_meta):
    """Report block for the optional firm-internal watchlist. Zero entries is
    a valid state ("no internal designations") — rendered informationally,
    never as UNAVAILABLE, so an intentionally empty optional list can't read
    as an outage."""
    m = list_meta.get("internal", {})
    n = int(m.get("count", 0) or 0)
    head = ("✅ Internal — Firm Watchlist (optional, screened in addition to official lists)"
            if n else
            "▫ Internal — Firm Watchlist (optional — none designated; empty is a valid state)")
    return (f"{head}\n"
            f"   Source:    Maintained in-repo — data/internal-watchlist.json\n"
            f"   Entries:   {n:,}\n"
            f"   List Date: {m.get('date','unknown')}\n"
            f"   File Hash: {m.get('hash') or 'N/A'}")

# ── NARRATIVE BUILDER — DAILY ─────────────────────────────────────────────────
def build_daily_narrative(customers, possible_matches, clear, list_meta,
                           run_time, run_label):
    dt = run_time.strftime("%d %b %Y")
    tm = run_time.strftime("%H:%M")

    def list_line(key, label, source):
        m = list_meta.get(key,{})
        status = "✅" if m.get("count",0) > 0 else "⚠️  UNAVAILABLE"
        return (f"{status} {label}\n"
                f"   Source:    {source}\n"
                f"   Entries:   {m.get('count',0):,}\n"
                f"   List Date: {m.get('date','unknown')}\n"
                f"   File Hash: {m.get('hash','N/A')}")

    confirmed = [m for m in possible_matches if any(h["score"]>=100 for h in m["hits"])]
    potential = [m for m in possible_matches if all(h["score"]<100 for h in m["hits"])]

    # Confirmed hits block
    if not confirmed:
        confirmed_text = "No confirmed sanctions matches identified in this run.\nAll customers returned clear across all lists screened."
    else:
        lines = []
        for i,m in enumerate(confirmed,1):
            lines += [
                f"⛔ HIT {i}",
                f"   Customer:        {m['name']}",
                f"   Customer Record: {m['permalink']}",
            ]
            for h in m["hits"]:
                lines += [
                    f"   Matched List:    {h['list']}",
                    f"   Matched Entry:   {h['matched_entry']}",
                    f"   Score:           {_pct(h['score'])}",
                ]
                if h.get("match_context"):
                    lines.append(f"   List Attributes: {h['match_context']}")
            lines += [
                "   Action:          IMMEDIATE ESCALATION TO MLRO",
                "                    Do not tip off customer.",
                "                    Cabinet Resolution No. 74/2020 applies.",""
            ]
        confirmed_text = "\n".join(lines)

    # Potential matches + adverse media block
    if not potential:
        potential_text = "No potential matches requiring review in this run."
    else:
        lines = []
        for i,m in enumerate(potential,1):
            priority = "🚨 HIGH" if any(h["score"]>=92 for h in m["hits"]) else "⚠️  POSSIBLE"
            lines += [
                f"{priority} — MATCH {i}",
                f"   Customer:        {m['name']}",
                f"   Customer Record: {m['permalink']}",
            ]
            for h in m["hits"]:
                lines += [
                    f"   Subject:         [{h['subject_type']}] {h['subject_name']}",
                    f"   Matched List:    {h['list']}",
                    f"   Matched Entry:   {h['matched_entry']}",
                    f"   Score:           {_pct(h['score'])}",
                ]
                if h.get("match_context"):
                    lines.append(f"   List Attributes: {h['match_context']}")
            lines += [
                "   MLRO Decision:   ☐ False Positive   ☐ Escalate   ☐ Investigate",
                "",
                f"   ADVERSE MEDIA — {m['name']}",
            ]
            # Collect subjects to search
            subjects = [(m["name"],"ENTITY")]
            for h in m["hits"]:
                if h["subject_type"]=="INDIVIDUAL" and (h["subject_name"],"INDIVIDUAL") not in subjects:
                    subjects.append((h["subject_name"],"INDIVIDUAL"))

            for subject_name, subject_type in subjects:
                log(f"  Adverse media search: {subject_name}")
                # Degrade loudly, never abort: search_adverse_media raises when
                # every source fails, and an unguarded raise here would discard
                # the already-computed sanctions results and post NO task at all
                # (run_weekly_adverse and screen_subject_set both guard this).
                try:
                    articles = search_adverse_media(subject_name)
                    lines.append(format_adverse_block(subject_name, articles, subject_type))
                except Exception as e:
                    log(f"  ! adverse media unavailable for {subject_name}: {e}")
                    lines.append(f"   ⚠️  ADVERSE MEDIA UNAVAILABLE for {subject_name} — all sources failed this run; re-run or review manually.")

            lines.append("")
        potential_text = "\n".join(lines)

    narrative = f"""DAILY SANCTIONS SCREENING — AUTOMATED BATCH RUN
================================================

Date:                {dt}
Screening Time:      {tm} GST (UTC+4) — {run_label}
Triggered By:        Automated — GitHub Actions
                     Workflow: daily-sanctions-screen.yml
Prepared By:         Compliance Automation — Hawkeye Sterling V2
Reviewed By:         Compliance Department

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGULATORY BASIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— UAE Federal Decree-Law No. 10 of 2025 (AML/CFT/CPF Law — repeals FDL 20/2018 as amended by FDL 26/2021)
— UAE Cabinet Resolution No. 134 of 2025 (Executive Regulations of FDL 10/2025)
— UAE Cabinet Resolution No. 74 of 2020 (TFS Obligations)
— FATF Recommendation 6 (Targeted Financial Sanctions)
— FATF Recommendation 10 (Customer Due Diligence)
— MoE Due Diligence Regulations — DPMS Sector
— Cabinet Resolution No. 156 of 2025 (CPF Obligations)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LISTS SCREENED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{list_line("ofac","OFAC SDN — US Treasury / Office of Foreign Assets Control",
           "https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.csv")}

{list_line("un","UN Consolidated List — UN Security Council",
           "https://scsanctions.un.org/resources/xml/en/consolidated.xml")}

{list_line("eu","EU Financial Sanctions — OpenSanctions / EU FSF",
           "https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv")}

{list_line("uk","UK OFSI Consolidated List — HM Treasury",
           "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv")}

{list_line("eocn","UAE EOCN — Local Terrorist List",
           "Maintained in-repo — data/eocn-local-terrorist-list.json")}

{_internal_watchlist_block(list_meta)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Customers Screened:    {len(customers)}
Match Threshold:       85% minimum similarity score
Individual Coverage:   Extracted from written compliance assessments only
Adverse Media:         Google News RSS — run on flagged customers only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Customers Screened:              {len(customers)}
Confirmed Hits:                        {len(confirmed)}
Potential Matches — Pending Review:    {len(potential)}
Clear — No Match:                      {len(clear)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIRMED HITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{confirmed_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POTENTIAL MATCHES — PENDING MLRO REVIEW
(includes adverse media results per flagged subject)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{potential_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHODOLOGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sanctions screening uses fuzzy name matching at 85% threshold
against live government-published lists. Adverse media uses
Google News RSS search — raw headlines only, no interpretation.
All flagged items require MLRO human review before any action.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUDIT TRAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Script Version:           screen.py v3.0

OFAC SDN File Hash:       {list_meta.get('ofac',{}).get('hash','N/A')}
UN Consolidated Hash:     {list_meta.get('un',{}).get('hash','N/A')}
EU FSF File Hash:         {list_meta.get('eu',{}).get('hash','N/A')}
UK OFSI File Hash:        {list_meta.get('uk',{}).get('hash','N/A')}
UAE EOCN PDF Hash:        {list_meta.get('eocn',{}).get('hash','N/A')}

Customer List Source:     Asana — Customer Database
                          Project GID: {ASANA_CUSTOMER_DB_GID}
Customers at Time of Run: {len(customers)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MLRO SIGN-OFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MLRO Review Completed:  ☐ Yes   ☐ No
MLRO Name:              ___________________________
Date of Review:         ___________________________
Overall Decision:       ☐ All Clear — No Action
                        ☐ False Positives Cleared
                        ☐ Escalated to Senior Management
                        ☐ STR / SAR Filed
                        ☐ TFS Freeze Applied
STR Reference (if any): ___________________________

> RETENTION NOTICE: This record must be retained for
> 10 years — UAE AML framework (Federal Decree-Law
> No. 10 of 2025, repealing FDL 20/2018 as amended;
> duty formerly FDL 26/2021 Art. 23) and Cabinet
> Resolution No. 74 of 2020."""
    return narrative

# ── NARRATIVE BUILDER — WEEKLY ADVERSE MEDIA ──────────────────────────────────
def github_run_url():
    s = os.environ.get("GITHUB_SERVER_URL")
    r = os.environ.get("GITHUB_REPOSITORY")
    i = os.environ.get("GITHUB_RUN_ID")
    return f"{s}/{r}/actions/runs/{i}" if (s and r and i) else "local run (no GitHub run context)"

# The most material red flags, surfaced in the report header. The FULL search set
# (ADVERSE_KEYWORDS) is much larger; the narrative names the headline ones only.
KEY_RED_FLAGS = ("sanction", "money launder", "terrorist financing", "fraud",
                 "bribery", "corruption", "trafficking", "smuggling", "embezzle",
                 "OFAC / Interpol designation", "indicted / convicted", "arrest")

def build_adverse_narrative(findings, stats, run_start, run_end):
    """Detailed, audit-grade daily adverse-media report. findings: list of
       {subject_type, subject_name, parent, permalink, articles[]}."""
    dt        = run_start.strftime("%d %b %Y")
    start_uae = run_start.strftime("%H:%M")
    end_uae   = run_end.strftime("%H:%M")
    start_utc = (run_start - datetime.timedelta(hours=UAE_TZ_OFFSET)).strftime("%H:%M")
    end_utc   = (run_end   - datetime.timedelta(hours=UAE_TZ_OFFSET)).strftime("%H:%M")
    total_hits = sum(len(f["articles"]) for f in findings)
    attempted = stats["companies_screened"] + stats["individuals_screened"] + stats["errors"]
    coverage_pct = (100 * stats["subjects_total"] // attempted) if attempted else 0

    if not findings:
        findings_text = "No adverse media identified across any screened company or individual."
    else:
        b = []
        for idx, f in enumerate(findings, 1):
            who = f["subject_name"]
            if f["subject_type"] == "INDIVIDUAL" and f.get("parent"):
                who = f'{who}  (associated with {f["parent"]})'
            b.append(f'[{idx}]  {who}    [{f["subject_type"]}]')
            if f.get("permalink"):
                b.append(f'     Customer record:  {f["permalink"]}')
            for a in f["articles"]:
                b.append(f'     [!] {a["title"]}')
                if a.get("keywords"):
                    b.append(f'        Matched keywords:  {", ".join(a["keywords"])}')
                b.append(f'        Source / date:     {a.get("source","?")} - {a.get("date","?")}')
                if a.get("url"):
                    b.append(f'        Article link:      {a["url"]}')
            b.append('     MLRO Decision:  [ ] No action   [ ] Investigate   [ ] Escalate   [ ] File STR/SAR')
            b.append('     MLRO Note:      ______________________________________________')
            b.append('')
        findings_text = "\n".join(b)

    key_flags = ", ".join(KEY_RED_FLAGS)

    narrative = f"""DAILY ADVERSE MEDIA SCREENING - ALL CUSTOMERS
===============================================================

RUN PROVENANCE
  Report date:        {dt}
  Run window:         {start_uae} -> {end_uae} UAE  ({start_utc} -> {end_utc} UTC)
  Cadence:            Daily - delivered by 09:00 UAE
  Prepared by:        Compliance Automation - Hawkeye Sterling V2
  Workflow run:       {github_run_url()}
  Engine:             screen.py  (Google News RSS - no external paid feed)

SCOPE & COVERAGE ATTESTATION
  Customers in database:     {stats["customers_total"]}
  Companies screened:        {stats["companies_screened"]}
  Individuals screened:      {stats["individuals_screened"]}  (shareholders / UBOs / directors from KYC records)
  Total subjects screened:   {stats["subjects_total"]}  ({coverage_pct}% of attempted)
  Screening errors/skipped:  {stats["errors"]}          <- non-coverage is shown, never silent
  Source:                    Google News RSS - worldwide matrix, {ADVERSE_LOCALES} of {len(GNEWS_LOCALES)} country/language editions swept + Arabic risk query + GDELT global index (100+ languages)
  Query method:              Exact-phrase entity / individual-name search
  Adverse keyword set:       {ADVERSE_TERM_COUNT} red-flag terms across {ADVERSE_LANG_COUNT} languages ({len(ADVERSE_KEYWORDS)} EN + {len(FOREIGN_KEYWORDS)} multilingual; full set in screen.py) + GDELT global index (65+ languages)
  Key red flags:             {key_flags}
  Headlines per subject:     up to 5 (adverse prioritised)

RESULTS SUMMARY
  Subjects with adverse media:    {len(findings)}
  Total adverse headlines:        {total_hits}
  Clean - no adverse hits:        {max(0, stats["subjects_total"] - len(findings))}

REGULATORY BASIS
  Ongoing CDD / continuous monitoring - UAE Cabinet Resolution 134/2025
  (Executive Regulations of FDL 10/2025, superseding Cabinet Decision 10/2019);
  FATF Recommendation 10. Adverse media is a MONITORING signal; authoritative
  designation status is governed by the daily sanctions screen
  (OFAC / UN / EU / UK OFSI / UAE EOCN).

---------------------------------------------------------------
ADVERSE MEDIA FINDINGS - MLRO REVIEW REQUIRED
---------------------------------------------------------------

{findings_text}

---------------------------------------------------------------
METHODOLOGY
---------------------------------------------------------------

Exact-phrase Google News RSS search per company AND per associated
individual across {ADVERSE_LOCALES} of {len(GNEWS_LOCALES)} worldwide locales plus a targeted risk-term query.
Headlines filtered against a {ADVERSE_TERM_COUNT}-term multilingual ({ADVERSE_LANG_COUNT}-language)
red-flag keyword set. Raw headlines are presented without interpretation -
all review decisions rest with the MLRO. This sweep supplements, and does
not replace, the daily sanctions screening.

---------------------------------------------------------------
MLRO SIGN-OFF
---------------------------------------------------------------

MLRO Review Completed:  [ ] Yes   [ ] No
MLRO Name:              ___________________________
Date of Review:         ___________________________
Overall Decision:       [ ] All Clear - No Action
                        [ ] Items Escalated (see findings)
                        [ ] STR / SAR Filed

> RETENTION NOTICE: Retain 10 years — UAE AML framework (FDL No. 10 of 2025, repealing FDL 20/2018 as amended; duty formerly FDL 26/2021 Art. 23)."""
    return narrative

# -- DAILY ADVERSE MEDIA SWEEP (companies + associated individuals) -------------
def run_weekly_adverse(customers, run_time):
    log(f"Daily adverse media sweep - {len(customers)} customers + associated individuals")
    findings = []
    companies_screened = 0
    individuals_screened = 0
    errors = 0

    for i, c in enumerate(customers, 1):
        subjects = [("COMPANY", c["name"], None)]
        for ind in c.get("individuals", []):
            subjects.append(("INDIVIDUAL", ind, c["name"]))
        for subj_type, subj_name, parent in subjects:
            try:
                articles = search_adverse_media(subj_name, max_results=ADVERSE_MAX_RESULTS)
                if subj_type == "COMPANY":
                    companies_screened += 1
                else:
                    individuals_screened += 1
            except Exception as e:
                errors += 1
                log(f"  ! error screening {subj_name}: {e}")
                continue
            adverse = [a for a in articles if a["flagged"]]
            if adverse:
                findings.append({
                    "subject_type": subj_type,
                    "subject_name": subj_name,
                    "parent": parent,
                    "permalink": c.get("permalink", ""),
                    "articles": adverse,
                })
            time.sleep(1)  # rate-limit protection
        log(f"  [{i}/{len(customers)}] {c['name']} - {len(subjects)} subject(s)")

    run_end = now_uae()
    stats = {
        "customers_total": len(customers),
        "companies_screened": companies_screened,
        "individuals_screened": individuals_screened,
        "subjects_total": companies_screened + individuals_screened,
        "errors": errors,
    }
    narrative = build_adverse_narrative(findings, stats, run_time, run_end)

    flag = "[ALERT]" if findings else "[CLEAN]"
    dt = run_time.strftime("%d %b %Y")
    suffix = f"  [{len(findings)} flagged]" if findings else ""
    task_name = f"Daily Adverse Media Screening - All Customers - {dt} {flag}{suffix}"

    payload = {
        "data": {
            "name": task_name,
            "notes": cap_notes(narrative),
            "due_on": run_time.strftime("%Y-%m-%d"),
            "assignee": ASANA_ASSIGNEE_GID,
            "projects": _mlro_queue_targets()[0],
            "memberships": _mlro_queue_targets()[1],
        }
    }
    r = asana_request("POST", "https://app.asana.com/api/1.0/tasks", json=payload)
    if r is not None and r.status_code in (200, 201):
        log(f"OK Daily adverse media task created: {r.json()['data']['gid']}")
    else:
        log(f"FAIL task: {getattr(r,'status_code','network')} - {getattr(r,'text','')[:300]}")
        # Arm the delivery gate: a run whose report never reached the MLRO queue
        # must exit red, not green — this mode previously logged and exited 0.
        UNIFIED_DELIVERY_FAILED["failed"] = True

# -- ASANA - POST DAILY TASK ---------------------------------------------------
def post_daily_task(narrative, run_time, run_label, n_matches):
    dt = run_time.strftime("%d %b %Y")
    flag = "⚠️" if n_matches > 0 else "✅"
    task_name = (f"🔍 {flag} Daily Sanctions Screening — "
                 f"OFAC / UN / EU / UK / AU / CH / UAE EOCN — {dt} ({run_label})")
    payload = {
        "data": {
            "name": task_name,
            "notes": cap_notes(narrative),
            "due_on": run_time.strftime("%Y-%m-%d"),
            "assignee": ASANA_ASSIGNEE_GID,
            "projects": _mlro_queue_targets()[0],
            "memberships": _mlro_queue_targets()[1],
        }
    }
    r = asana_request("POST", "https://app.asana.com/api/1.0/tasks", json=payload)
    if r is not None and r.status_code in (200,201):
        log(f"✅ Daily task created: {r.json()['data']['gid']}")
    else:
        log(f"❌ Task failed: {getattr(r,'status_code','network')} — {getattr(r,'text','')[:300]}")
        # Arm the delivery gate: a run whose report never reached the MLRO queue
        # must exit red, not green — this mode previously logged and exited 0.
        UNIFIED_DELIVERY_FAILED["failed"] = True

def post_confirmed_hit_comment(customer_gid, hits, run_time):
    dt = run_time.strftime("%d %b %Y %H:%M GST")
    lines = [f"🚨 SANCTIONS MATCH — {dt}",
             "MLRO review required immediately.",
             "Do NOT tip off customer. CR 74/2020 applies.\n"]
    for h in hits:
        lines += [f"List:    {h.get('list','?')}",
                  f"Matched: {h.get('matched_entry','?')}"]
        if h.get("match_context"):
            lines.append(f"Context: {h['match_context']}")
        lines.append(f"Score:   {_pct(h.get('score',0))}\n")
    r = asana_request("POST", f"https://app.asana.com/api/1.0/tasks/{customer_gid}/stories",
                      json={"data": {"text": "\n".join(lines)}})
    if r is not None and r.status_code in (200,201):
        log(f"✅ Comment on {customer_gid}")
    else:
        # Secondary channel (the report still carries the hit) — but a failed
        # confirmed-hit comment must leave a trace, not vanish silently.
        log(f"❌ Confirmed-hit comment FAILED on {customer_gid}: "
            f"{getattr(r,'status_code','network')} — {getattr(r,'text','')[:200]}")

# ── UNIFIED DAILY REPORT (Sanctions + Adverse Media + PEP, ONE narrative) ─────
# ── EOCN mirror cross-check (drift detector, TFS-critical direction only) ─────
# The UAE Local Terrorist List is maintained as a curated in-repo JSON because
# the EOCN distributes updates by notification, not a stable machine endpoint.
# That design's failure mode is a STALE local file — a new designation the file
# hasn't picked up would screen clear, a false negative on a FREEZE duty. This
# cross-check downloads the OpenSanctions ae_local_terrorists dataset each run
# and alarms LOUDLY on any mirror designation missing locally. The local file
# stays authoritative (local-only names are informational — the mirror can lag
# or transliterate differently); an unreachable mirror is a soft note, never a
# degraded core control. Kill-switch: EOCN_MIRROR_CROSSCHECK=0.
# LICENSING: CC-BY-NC 4.0 — see docs/aims/third-party-register.md.
EOCN_MIRROR_CROSSCHECK = os.environ.get("EOCN_MIRROR_CROSSCHECK", "1") == "1"
EOCN_MIRROR_URL = "https://data.opensanctions.org/datasets/latest/ae_local_terrorists/targets.simple.csv"

# ── EOCN review-age gate (manual-review currency on the TFS list) ────────────
# The mirror cross-check above detects DIVERGENCE; this gate detects a LAPSED
# REVIEW: the curated local list is only as current as its own `lastReviewed`
# date, and nothing previously read that field. If the review is older than
# EOCN_REVIEW_MAX_AGE_DAYS the run still screens and delivers (screening with
# the current file beats not screening), then exits non-zero AFTER delivery so
# the workflow goes red and its failure alerting fires.
# Kill-switch: EOCN_REVIEW_HARD_FAIL=0 keeps the alarm but not the exit.
EOCN_REVIEW_MAX_AGE_DAYS = int(os.environ.get("EOCN_REVIEW_MAX_AGE_DAYS", "7"))
EOCN_REVIEW_HARD_FAIL = os.environ.get("EOCN_REVIEW_HARD_FAIL", "1") == "1"
EOCN_REVIEW_ALERT = {"overdue": False, "message": ""}

def eocn_review_age_days(last_reviewed, today=None):
    """Whole days since the list's lastReviewed date; None if missing/bad."""
    if not last_reviewed:
        return None
    try:
        reviewed = datetime.datetime.strptime(str(last_reviewed)[:10], "%Y-%m-%d").date()
    except Exception:
        return None
    today = today or datetime.date.today()
    return (today - reviewed).days

def eocn_review_check(last_reviewed, today=None, max_age_days=None):
    """(overdue, message) for the review-age gate. A missing or unparseable
    lastReviewed counts as overdue: an unverifiable review date is not
    evidence of currency."""
    limit = EOCN_REVIEW_MAX_AGE_DAYS if max_age_days is None else max_age_days
    age = eocn_review_age_days(last_reviewed, today)
    if age is None:
        return True, (f"EOCN REVIEW OVERDUE: data/eocn-local-terrorist-list.json has no parseable "
                      f"lastReviewed date; review the list against the official EOCN publication "
                      f"and set lastReviewed (max age {limit}d)")
    if age > limit:
        return True, (f"EOCN REVIEW OVERDUE: lastReviewed {str(last_reviewed)[:10]} is {age}d old "
                      f"(max {limit}d); re-verify data/eocn-local-terrorist-list.json against the "
                      f"official EOCN publication and update lastReviewed; treat EOCN 'clear' "
                      f"results as PROVISIONAL until reviewed")
    return False, ""

def enforce_eocn_review_gate():
    """Post-delivery hard fail: the run completed and delivered; a lapsed
    manual review must still turn the run red so the workflow's failure
    alerting fires (and the freshness check sees no success for the day)."""
    if EOCN_REVIEW_ALERT["overdue"]:
        log(f"EOCN REVIEW GATE: {EOCN_REVIEW_ALERT['message']}")
        if EOCN_REVIEW_HARD_FAIL:
            sys.exit(3)

# Set by post_unified_task when every attempt (including the shrink-and-retry
# budgets) failed; read by enforce_delivery_gate(). Kill-switch:
# DELIVERY_HARD_FAIL=0 keeps the alarm but not the exit.
UNIFIED_DELIVERY_FAILED = {"failed": False}
DELIVERY_HARD_FAIL = os.environ.get("DELIVERY_HARD_FAIL", "1") == "1"

def enforce_delivery_gate():
    """A screening run whose report never reached the MLRO queue must be RED.
    The freshness alarm and the Actions failure email key on the run
    CONCLUSION — observed live 2026-07-16: Asana 400s on oversized notes left
    the runs green while no task, no MLRO cases and no persisted delta-state
    existed, so the alarm chain saw a healthy control that had delivered
    nothing. Runs before the other gates: an undelivered run is the more
    fundamental failure."""
    if UNIFIED_DELIVERY_FAILED["failed"]:
        log("DELIVERY GATE: the unified screening task was never created — "
            "failing the run so the freshness alarm and Actions email fire")
        if DELIVERY_HARD_FAIL:
            sys.exit(5)

def load_eocn_mirror():
    """Returns (names, meta) for the OpenSanctions mirror of the UAE Local
    Terrorist List — SUPPLEMENTARY tier (drift tracking; never core coverage)."""
    if not EOCN_MIRROR_CROSSCHECK:
        log("  EOCN mirror cross-check disabled (EOCN_MIRROR_CROSSCHECK=0)")
        return set(), {"count": 0, "date": "disabled", "hash": "", "tier": "supplementary"}
    data = download(EOCN_MIRROR_URL, "EOCN mirror (OpenSanctions ae_local_terrorists)")
    names = parse_simple_csv(data, "EOCN mirror")
    if not names:
        log("  EOCN mirror: unavailable this run — cross-check skipped (local list remains authoritative)")
        return set(), {"count": 0, "date": "unavailable", "hash": "", "tier": "supplementary"}
    return names, {"count": len(names), "date": "live (OpenSanctions mirror)",
                   "hash": sha256_of(data), "tier": "supplementary"}

def crosscheck_eocn(local_names, mirror_names):
    """Designations present on the mirror but ABSENT from the curated local list
    (normalized exact or token-sorted match) — the false-negative direction on
    the TFS freeze duty. Returns a sorted list of the missing mirror names.
    Local-only names are deliberately NOT flagged: the curated file is the
    authority and the mirror may lag behind an EOCN de-listing."""
    def _keys(n):
        k = normalize(n)
        return {k, " ".join(sorted(k.split()))} if k else set()
    have = set()
    for n in local_names or ():
        have |= _keys(n)
    missing = []
    for n in mirror_names or ():
        ks = _keys(n)
        if ks and not (ks & have):
            missing.append(n)
    return sorted(missing)

def _mirror_fallback(names, dataset, label):
    """When an official core-list endpoint yields nothing (unreachable, refused
    redirect, garbled payload), fall back to its OpenSanctions mirror — same
    host that already serves EU FSF, so it is reachable wherever screening runs.
    The mirror's simple format carries primary names + designated aliases. The
    provenance is kept honest: the list's 'date' field says MIRROR so the report
    and audit trail show which source actually screened. Returns (names, date,
    hash) — unchanged inputs when the primary already loaded."""
    if names:
        return None
    data = download(f"https://data.opensanctions.org/datasets/latest/{dataset}/targets.simple.csv",
                    f"{label} (OpenSanctions mirror)")
    mirror_names = parse_simple_csv(data, label)
    if not mirror_names:
        return None
    log(f"  {label}: official endpoint unavailable — screened via OpenSanctions mirror")
    return mirror_names, "live (OpenSanctions mirror)", sha256_of(data)

# EU FSF is the one core list whose PRIMARY is the OpenSanctions host (webgate's
# exports drift formats; the mirror's simple shape is what every parser here
# shares) — so its fallback runs the OTHER way: official webgate XML, with the
# public 2017 token the EU publishes for exactly this purpose (the same token
# data/sanctions-sources.json documents and .gitleaks.toml allowlists).
EU_OFFICIAL_XML_URL = ("https://webgate.ec.europa.eu/fsd/fsf/public/files/"
                       "xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw")

def parse_eu_official_xml(data):
    """Names from the FSF fullSanctionsList XML: every <nameAlias> carries the
    designation's full name in a wholeName attribute (entities and aliases
    alike). Attribute extraction by regex keeps the fallback tolerant of the
    schema-version churn that motivated using the mirror as primary; dedupe
    folds entity names and aliases into one set like parse_simple_csv does."""
    if not data:
        return set()
    text = data.decode("utf-8", "replace") if isinstance(data, bytes) else str(data)
    names = {html.unescape(m).strip() for m in re.findall(r'wholeName="([^"]*)"', text)}
    return {n for n in names if len(n) >= 3}

def _eu_official_fallback(names):
    """When the OpenSanctions eu_fsf mirror yields nothing, screen via the
    official webgate XML instead. Same contract as _mirror_fallback: None when
    the primary already loaded or the fallback is also down (the degrade-loudly
    paths take over); provenance in the date field so the report and audit
    trail show which source actually screened."""
    if names:
        return None
    data = download(EU_OFFICIAL_XML_URL, "EU FSF (official webgate XML)")
    xml_names = parse_eu_official_xml(data)
    if not xml_names:
        return None
    log("  EU FSF: OpenSanctions mirror unavailable — screened via official webgate XML")
    return xml_names, "live (EU official XML)", sha256_of(data)

# ── Core-list coverage floors (zero/partial-load hard-fail) ──────────────────
# A core list that loads ZERO names (parse failure, the PR #128 bug class) or a
# fraction of its known size (truncated download, format drift) used to degrade
# to an UNAVAILABLE status line while screening continued - a silent
# under-screen in the false-negative direction. A core list below its floor is
# now handled by WHY it is small:
#   breach (source material obtained, parsed below floor) - corruption or
#     truncation: REFUSE the run before screening, because results computed
#     against corrupt data must never post as an all-clear;
#   outage (no source material obtained: endpoint down, absent or honestly
#     empty local file) - screening PROCEEDS without the list, the report
#     shows it unavailable/DEGRADED, and enforce_list_outage_gate() fails the
#     run AFTER delivery so the outage still goes red and cannot become
#     routine. (Treating outages as breaches killed the whole run, report and
#     Asana delivery included, on any transient source outage.)
# Only OFAC and UN have OpenSanctions mirror fallbacks (EU is itself fetched
# from that mirror; UK and the local EOCN file have no second source), and the
# legacy daily path has none, so outages here are real single-list gaps the
# mirrors did not absorb.
# Floors are ~50% of the verified 2026-07-02 baseline counts (OFAC 19,129 /
# UN 1,002 / UK 19,762 / EU 42,347 / EOCN 312): generous enough for real
# de-listings, tight enough to catch a broken parse.
# Per-list override: LIST_FLOOR_<KEY>=n. Kill-switch: LIST_FLOORS_ENFORCE=0.
LIST_FLOORS_ENFORCE = os.environ.get("LIST_FLOORS_ENFORCE", "1") == "1"
CORE_LIST_FLOORS = {
    "ofac": int(os.environ.get("LIST_FLOOR_OFAC", "9000")),
    "un":   int(os.environ.get("LIST_FLOOR_UN",   "500")),
    "uk":   int(os.environ.get("LIST_FLOOR_UK",   "9000")),
    "eu":   int(os.environ.get("LIST_FLOOR_EU",   "20000")),
    "eocn": int(os.environ.get("LIST_FLOOR_EOCN", "150")),
    # AU/CH (added 2026-07-29, OpenSanctions mirrors of DFAT Regulation 8 and
    # SECO's consolidated list): floors are PROVISIONAL and deliberately low —
    # no verified baseline count existed at introduction, and a too-tight
    # provisional floor would refuse whole runs. Tighten toward ~50% of the
    # observed baseline once the first runs have logged real counts.
    "au":   int(os.environ.get("LIST_FLOOR_AU",   "500")),
    "ch":   int(os.environ.get("LIST_FLOOR_CH",   "500")),
}

# Set by enforce_core_list_floors(); read by enforce_list_outage_gate() after
# the report has been delivered (same post-delivery pattern as EOCN_REVIEW_ALERT).
LIST_OUTAGE_ALERT = {"outages": []}
# Set by parse_eocn(): whether any EOCN source material (JSON entries or the
# fallback PDF) actually yielded names this run. False makes the floor
# classifier treat an EOCN shortfall as an outage (absent or honestly empty
# local file: the documented DEGRADED state) rather than as corruption.
EOCN_SOURCE_STATE = {"obtained": False}

def core_list_floor_breaches(list_meta, floors=None, fetched=None):
    """Classify core lists whose loaded name count sits below the coverage
    floor (zero included). Returns (breaches, outages):
      breaches - source material was obtained but parsed below floor: treat
                 as corruption/truncation and refuse to screen;
      outages  - no source material was obtained this run: screen DEGRADED,
                 deliver, then fail post-delivery via the outage gate.
    fetched maps list key -> whether source material was obtained; when
    fetched is None, or a key is missing from it, a sub-floor list counts as
    a breach (fail-closed, the original behavior). Lists absent from the
    floors map (supplementary tier) are never floored."""
    floors = CORE_LIST_FLOORS if floors is None else floors
    breaches, outages = [], []
    for key, floor in floors.items():
        meta = (list_meta or {}).get(key)
        if meta is None:
            continue
        count = int(meta.get("count", 0) or 0)
        if count >= floor:
            continue
        if fetched is not None and not fetched.get(key, True):
            outages.append(f"{key.upper()} source unavailable this run ({count:,} name(s) loaded, "
                           f"floor {floor:,}): screening proceeds DEGRADED without it")
        else:
            breaches.append(f"{key.upper()} loaded {count:,} name(s), below its coverage floor "
                            f"of {floor:,} - possible failed download / bad parse / truncated source")
    return breaches, outages

def enforce_core_list_floors(list_meta, fetched=None):
    """Refuse to screen when a core list was OBTAINED but parsed below its
    floor: screening against a partially loaded core list silently
    under-screens (false negatives), so the run must fail BEFORE any all-clear
    can be posted. A sub-floor list with NO obtained source material is an
    outage instead: it is recorded in LIST_OUTAGE_ALERT so the run screens
    DEGRADED, delivers its report, and enforce_list_outage_gate() then turns
    the run red. Kill-switch LIST_FLOORS_ENFORCE=0 logs both classes but
    refuses nothing (and the outage gate does not exit).
    Returns (breaches, outages) either way (for reports/tests)."""
    breaches, outages = core_list_floor_breaches(list_meta, fetched=fetched)
    for b in breaches:
        log(f"COVERAGE FLOOR BREACH: {b}")
    for o in outages:
        log(f"CORE LIST OUTAGE: {o}")
    LIST_OUTAGE_ALERT["outages"] = outages
    if breaches and LIST_FLOORS_ENFORCE:
        raise RuntimeError(
            "FATAL: core sanctions list(s) below coverage floor - refusing to screen or post "
            "an all-clear: " + "; ".join(breaches))
    return breaches, outages

def enforce_list_outage_gate():
    """Post-delivery hard fail for core-list outages: the run screened
    DEGRADED without the unavailable list(s) and delivered its report; the
    outage must still turn the run red (exit 4) so the workflow's failure
    alerting fires and a recurring outage cannot quietly become the routine
    state. Kill-switch: LIST_FLOORS_ENFORCE=0 (same switch as the floors)."""
    if LIST_OUTAGE_ALERT["outages"]:
        for o in LIST_OUTAGE_ALERT["outages"]:
            log(f"CORE LIST OUTAGE GATE: {o}")
        if LIST_FLOORS_ENFORCE:
            sys.exit(4)

def load_all_lists():
    LIST_ENTRY_ATTRS.clear()   # adjudication attributes are per-load state
    ofac_data = download("https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.csv","OFAC SDN")
    ofac_alt_data = download("https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/alt.csv","OFAC SDN a.k.a.")
    un_data   = download("https://scsanctions.un.org/resources/xml/en/consolidated.xml","UN Consolidated")
    uk_data   = download("https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv","UK OFSI")
    eu_data   = download("https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv","EU FSF")
    # AU + CH core lists via the OpenSanctions mirrors (same host, same
    # targets.simple.csv shape as the EU list): DFAT bot-gates its .xlsx and
    # SECO's XML needs its own endpoint, so the mirror is the reliable daily
    # path — exactly the arrangement the EU list has always used.
    au_data   = download("https://data.opensanctions.org/datasets/latest/au_dfat_sanctions/targets.simple.csv","Australia DFAT")
    ch_data   = download("https://data.opensanctions.org/datasets/latest/ch_seco_sanctions/targets.simple.csv","Switzerland SECO")
    # Track whether SOURCE MATERIAL was obtained per list (primary bytes, or a
    # mirror that answered): the floor check uses it to tell corruption (data
    # present but tiny: refuse) from an outage (nothing obtained: degrade).
    ofac_fetched = bool(ofac_data)
    un_fetched   = bool(un_data)
    ofac_names, ofac_date, ofac_hash = parse_ofac(ofac_data)
    un_names,   un_date,   un_hash   = parse_un(un_data)
    # Fallback check BEFORE folding alt.csv aliases: if the primary sdn.csv
    # failed but alt.csv loaded, the alias fold would leave ofac_names non-empty
    # and defeat the mirror — screening aliases-only OFAC coverage silently.
    fb = _mirror_fallback(ofac_names, "us_ofac_sdn", "OFAC SDN")
    if fb:
        ofac_names, ofac_date, ofac_hash = fb   # mirror already carries aliases
        ofac_fetched = True
    else:
        # Aliases broaden a LOADED primary only: with primary AND mirror both
        # down, alias-only coverage (~17k names) would pass the 9,000 floor
        # and read as "OFAC SDN: OK" — see _fold_ofac_aliases.
        ofac_names = _fold_ofac_aliases(ofac_names, ofac_alt_data)
    fb = _mirror_fallback(un_names, "un_sc_sanctions", "UN Consolidated")
    if fb:
        un_names, un_date, un_hash = fb
        un_fetched = True
    uk_fetched = bool(uk_data)
    eu_fetched = bool(eu_data)
    uk_names,   uk_date,   uk_hash   = parse_uk(uk_data)
    fb = _mirror_fallback(uk_names, "gb_hmt_sanctions", "UK OFSI")
    if fb:
        uk_names, uk_date, uk_hash = fb
        uk_fetched = True
    eu_names,   eu_date,   eu_hash   = parse_eu(eu_data)
    fb = _eu_official_fallback(eu_names)
    if fb:
        eu_names, eu_date, eu_hash = fb
        eu_fetched = True
    au_names,   au_date,   au_hash   = parse_eu(au_data)   # same targets.simple.csv shape
    ch_names,   ch_date,   ch_hash   = parse_eu(ch_data)
    # AU + CH have no second origin: DFAT bot-gates its .xlsx and SECO's own XML
    # is a different schema again, so an OpenSanctions outage takes both down —
    # that surfaces as the usual outage-gate DEGRADED, never a silent gap.
    eocn_names, eocn_date, eocn_hash = parse_eocn(EOCN_PDF_PATH)
    list_meta = {
        "ofac": {"count":len(ofac_names),"date":ofac_date,"hash":ofac_hash,"tier":"core"},
        "un":   {"count":len(un_names),"date":un_date,"hash":un_hash,"tier":"core"},
        "uk":   {"count":len(uk_names),"date":uk_date,"hash":uk_hash,"tier":"core"},
        "eu":   {"count":len(eu_names),"date":eu_date,"hash":eu_hash,"tier":"core"},
        "au":   {"count":len(au_names),"date":au_date,"hash":au_hash,"tier":"core"},
        "ch":   {"count":len(ch_names),"date":ch_date,"hash":ch_hash,"tier":"core"},
        "eocn": {"count":len(eocn_names),"date":eocn_date,"hash":eocn_hash,"tier":"core"},
    }
    # TFS drift detector: alarm if the OpenSanctions mirror carries a UAE Local
    # Terrorist List designation the curated local file is missing. Nested under
    # the eocn entry (not a top-level list) so the QA gate's core-list checks
    # and the "screened vs N list names" audit line stay exact.
    eocn_mirror_names, eocn_mirror_meta = load_eocn_mirror()
    missing_locally = crosscheck_eocn(eocn_names, eocn_mirror_names)
    list_meta["eocn"]["mirror"] = eocn_mirror_meta
    list_meta["eocn"]["crosscheck_missing"] = missing_locally
    if missing_locally:
        shown = ", ".join(missing_locally[:5]) + (f" +{len(missing_locally)-5} more"
                                                  if len(missing_locally) > 5 else "")
        log(f"  EOCN CROSS-CHECK ALARM: {len(missing_locally)} mirror designation(s) "
            f"not in the local list: {shown}")
    # Fail-safe: if EVERY core sanctions list failed to load, screening would clear
    # every customer for sanctions and post a green ✅. Abort instead — a total
    # list-fetch failure must never masquerade as "all clear".
    if sum(list_meta[k]["count"] for k in ("ofac","un","uk","eu","au","ch","eocn")) == 0:
        raise RuntimeError(
            "FATAL: no core sanctions list could be loaded (OFAC/UN/UK/EU/AU/CH/EOCN all empty) "
            "— refusing to screen or post an all-clear.")
    # Per-list coverage floors: an OBTAINED core list at zero (or a fraction
    # of its known size) is the same false-negative class as the all-empty
    # case above and refuses the run; a list with no obtainable source this
    # run degrades and turns the run red after delivery (outage gate).
    enforce_core_list_floors(list_meta, fetched={
        "ofac": ofac_fetched, "un": un_fetched,
        "uk": uk_fetched, "eu": eu_fetched,
        "au": bool(au_data), "ch": bool(ch_data),
        "eocn": EOCN_SOURCE_STATE["obtained"],
    })
    all_lists = {
        "OFAC SDN":         [(normalize(n),n) for n in ofac_names],
        "UN Consolidated":  [(normalize(n),n) for n in un_names],
        "UK OFSI":          [(normalize(n),n) for n in uk_names],
        "EU FSF":           [(normalize(n),n) for n in eu_names],
        "Australia DFAT":   [(normalize(n),n) for n in au_names],
        "Switzerland SECO": [(normalize(n),n) for n in ch_names],
        "UAE EOCN":         [(normalize(n),n) for n in eocn_names],
    }
    # ── Supplementary lists (best-effort): broaden coverage when reachable, but a
    # fetch miss is reported as "not reached", NOT as a degraded core control. ──
    ca_data = download("https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml","Canada SEMA")
    ca_names, ca_date, ca_hash = parse_canada(ca_data)
    list_meta["canada"] = {"count":len(ca_names),"date":ca_date,"hash":ca_hash,"tier":"supplementary"}
    if ca_names:
        all_lists["Canada (SEMA)"] = [(normalize(n),n) for n in ca_names]
    # Internal firm watchlist (optional, checklist A4): screened IN ADDITION to
    # the official lists. Supplementary tier so firm-internal names can never
    # satisfy a core-coverage fail-safe (floors sum core keys only), and empty
    # is a valid state.
    iw_names, iw_date, iw_hash = parse_internal_watchlist()
    list_meta["internal"] = {"count":len(iw_names),"date":iw_date,"hash":iw_hash,"tier":"supplementary"}
    if iw_names:
        all_lists["Internal Watchlist"] = [(normalize(n),n) for n in iw_names]
    return all_lists, list_meta

def _list_status_line(list_meta, key, label):
    m = list_meta.get(key, {})
    status = "OK" if m.get("count", 0) > 0 else "UNAVAILABLE"
    return f"      {label}: {status}  ({m.get('count',0):,} names · {m.get('date','?')})"

def build_unified_narrative(possible_matches, clear, adverse_findings, pep_findings,
                            list_meta, stats, run_time):
    dt = run_time.strftime("%d %b %Y")
    confirmed = [m for m in possible_matches if any(h["score"] >= 100 for h in m["hits"])]
    potential = [m for m in possible_matches if all(h["score"] < 100 for h in m["hits"])]
    # Degrade on ANY PEP lookup error, independent of whether some PEPs were found:
    # a run that finds 1 PEP but had 200 lookups fail on BOTH sources is NOT a
    # clean PEP pass — the 200 unknowns are provisional, not "no PEP". Individuals
    # the OpenSanctions mirror re-covered are screened (not errors), but the run
    # is labelled mirror-assisted so the MLRO knows the primary source was down.
    pep_degraded = stats.get("pep_errors", 0) > 0
    pep_mirror = stats.get("pep_mirror", 0)
    # Sanctions coverage: DEGRADED if ANY core list failed to load (not just if
    # all of them did) — a run missing one core list is not a clean "OK". The
    # core set is DERIVED from list_meta's tier, never enumerated here: this
    # line silently missed AU and CH for a few hours on 2026-07-29 because it
    # hardcoded the original five, which is exactly how a new core list's
    # outage would have stopped flipping the banner.
    # An entry with NO tier counts as core (fail-closed): a list_meta built
    # without tiers must never make this comprehension empty — all([]) is True,
    # which would read a fully-untagged meta as clean coverage.
    core_loaded = [m.get("count", 0) > 0 for m in list_meta.values() if m.get("tier", "core") == "core"]
    sanc_ok = all(core_loaded)
    # Adverse-media coverage, three-state: DEGRADED only when subjects had ZERO
    # adverse coverage from ANY net (news dead AND no watchlist); DEGRADED (news)
    # when the news sweep was lost but the watchlist stood — recall narrowed,
    # never silent; OK when every net ran.
    am_errors_n = stats.get("am_errors", 0)
    am_blackout = stats.get("am_blackout", 0)
    L = []; A = L.append

    delta = stats.get("delta", {})
    supp = {k: v for k, v in list_meta.items() if v.get("tier") == "supplementary"}
    sanc_status = "OK" if sanc_ok else ("DEGRADED" if any(core_loaded) else "FAILED")
    pep_status = ("DEGRADED" if pep_degraded
                  else ("OK (mirror-assisted)" if pep_mirror else "OK"))
    am_status = ("DEGRADED" if am_blackout
                 else ("DEGRADED (news)" if am_errors_n else "OK"))

    # ── Compact header — three result blocks (Sanctions · Adverse media · PEP)
    #    lead the report; everything here is a one-line snapshot. ──
    A(f"🛡️  DAILY SCREENING — {dt}")
    A(f"Subjects: {stats['subjects_total']}  ({stats['companies_screened']} companies + "
      f"{stats['individuals_screened']} owners / directors / UBOs)  ·  delivered by 09:00 UAE")
    A(f"Modules:  Sanctions {sanc_status}  ·  Adverse media {am_status}  ·  PEP {pep_status}")
    if delta:
        A(f"New since last run:  {delta.get('sanctions',0)} sanctions  ·  "
          f"{delta.get('adverse',0)} adverse  ·  {delta.get('pep',0)} PEP")
    A(f"Totals:  {len(possible_matches)} sanctions match(es)  ·  "
      f"{len(adverse_findings)} adverse subject(s)  ·  {len(pep_findings)} PEP")
    A("")

    A("━" * 70)
    A("①  SANCTIONS / WATCHLISTS")
    A("━" * 70)
    A("   Action class (TFS): a CONFIRMED designation is ILLEGAL TO ENGAGE — freeze without")
    A("   delay and without prior notice (tipping-off), report to the FIU, reject/offboard.")
    A("   Distinct from ② and ③ below: sanctions action is mandatory, not risk-based.")
    if not possible_matches:
        A("   No sanctions / watchlist matches — all subjects clear.")
    else:
        # NEW subjects first, then standing — most actionable at the top.
        ordered = sorted(confirmed + potential, key=lambda m: (not m.get("is_new"), m["name"]))
        for m in ordered:
            tag = ("CONFIRMED HIT" if m in confirmed
                   else ("HIGH" if any(h["score"] >= 92 for h in m["hits"]) else "POTENTIAL"))
            newtag = " 🆕 NEW" if m.get("is_new") else " [STANDING]"
            ctrl = "  ⚠ OWNERSHIP/CONTROL" if any(h.get("control_linkage") for h in m["hits"]) else ""
            risk = m.get("risk")
            risk_tag = f"  ·  RISK: {risk['rating']}" if risk else ""
            A(f"{m['name']}   [{tag}]{newtag}{ctrl}{risk_tag}")
            A(f"   Customer record: {m['permalink']}")
            if m.get("ai_summary"):
                ai_lbl = "AI" if m["ai_summary"].get("ai") else "Auto"
                A(f"   [{ai_lbl}] {m['ai_summary']['text']}")
            if risk:
                A(f"   Risk factors: {'; '.join(risk['factors'])}")
                A(f"   EDD: {risk['edd']}")
            # R.10 jurisdiction nexus + R.25 legal-arrangement note (when present).
            jur = m.get("jurisdiction") or {}
            if jur.get("reason"):
                A(f"   Jurisdiction (R.10): {jur['reason']}")
            if m.get("arrangement"):
                A(f"   Legal arrangement (R.25): {m['arrangement']} — every party screened; "
                  "a sanctioned/PEP party flags the arrangement.")
            shown = sorted(m["hits"], key=lambda h: -h["score"])[:10]
            for h in shown:
                conf = f" · {h.get('confidence','')}" if h.get("confidence") else ""
                nflag = " 🆕" if h.get("is_new") else ""
                link = " · owner/UBO → 50%/control rule" if h.get("control_linkage") else ""
                A(f"   -> [{h['subject_type']}] {h['subject_name']}  —  {h['list']}: "
                  f"\"{h['matched_entry']}\"   {_pct(h['score'])}{conf}{nflag}{link}")
                # List-side adjudication attributes (DOB/nationality where the
                # source publishes them) so plausibility is judged from the card.
                if h.get("match_context"):
                    A(f"        Adjudication: {h['match_context']}")
                # R.10 — identity dossier + open CDD gaps for the matched individual.
                if h.get("identity"):
                    A(f"        Identity (R.10): {h['identity']}")
                if h.get("cdd_gaps"):
                    A(f"        ⚠ CDD gaps: {'; '.join(h['cdd_gaps'])}")
            if len(m["hits"]) > 10:
                A(f"   -> … +{len(m['hits']) - 10} more similar candidates (see run log)")
            if ctrl:
                A("   NOTE: company flagged because an owner / director / UBO matches a designation —"
                  " apply OFAC/EU 50%/control aggregation; treat the entity as designated by extension pending review.")
            A("   MLRO Decision:  [ ] false positive   [ ] escalate / freeze   [ ] investigate")
            A("")
    # ALWAYS render list provenance — including on a zero-match run, so a clean
    # result can never hide that a core list was down (a "clear" against a list
    # that never loaded is not clear). Any core list at 0 names is flagged.
    A("   Lists screened:")
    A(_list_status_line(list_meta, "ofac", "OFAC SDN"))
    A(_list_status_line(list_meta, "un",   "UN Consolidated"))
    A(_list_status_line(list_meta, "eu",   "EU FSF"))
    A(_list_status_line(list_meta, "uk",   "UK OFSI"))
    A(_list_status_line(list_meta, "au",   "Australia DFAT"))
    A(_list_status_line(list_meta, "ch",   "Switzerland SECO"))
    A(_list_status_line(list_meta, "eocn", "UAE EOCN"))
    if not sanc_ok:
        _down = [lbl for k, lbl in (("ofac","OFAC"),("un","UN"),("uk","UK OFSI"),("eu","EU FSF"))
                 if list_meta.get(k, {}).get("count", 0) == 0]
        A(f"   ⚠ SANCTIONS COVERAGE DEGRADED — core list(s) not loaded: {', '.join(_down)}. "
          "Treat every 'clear' this run as PROVISIONAL and re-run.")
    if supp:
        A("   Supplementary lists (best-effort — never affect core coverage):")
        for k in supp:
            m_ = supp[k]
            label = {"canada": "Canada (SEMA)", "internal": "Internal Watchlist"}.get(k, k)
            if m_.get("count", 0) > 0:
                A(f"      {label}: screened  ({m_['count']:,} names · {m_.get('date','?')})")
            elif k == "internal":
                # Optional firm list: empty means "no internal designations",
                # a valid state — not an unreached source.
                A(f"      {label}: no internal designations (empty list is a valid state)")
            else:
                A(f"      {label}: not reached this run (supplementary — core lists unaffected)")
    A("")

    A("━" * 70)
    A("②  ADVERSE MEDIA")
    A("━" * 70)
    A("   Action class: RISK-BASED review — verify the story before acting; media alone is")
    A("   never conclusive. Source reliability: news = real-time but false-positive-prone;")
    A("   court/enforcement corroboration is strongest but can lag clearances — always")
    A("   confirm CURRENT status before an adverse decision.")
    if am_blackout:
        A(f"   Status: DEGRADED this run — {am_blackout} subject(s) had ZERO adverse coverage "
          "(news feeds AND watchlist unavailable). Treat their 'no adverse media' as provisional; re-run.")
    elif am_errors_n:
        A(f"   Status: news sweep lost for {am_errors_n} subject(s) (feed rate-limited the runner) — "
          "the adverse-exposure WATCHLIST still screened every subject; fresh-news recall is narrowed, "
          "standing exposure is covered.")
    if not adverse_findings:
        A("   No adverse media identified across any company or individual.")
    else:
        for f in sorted(adverse_findings, key=lambda f: (not f.get("is_new"), f["subject_name"])):
            who = f["subject_name"]
            if f["subject_type"] == "INDIVIDUAL" and f.get("parent"):
                who = f"{who}  (owner / director — {f['parent']})"
            newtag = " 🆕 NEW" if f.get("is_new") else " [STANDING]"
            A(f"{who}   [{f['subject_type']}]{newtag}")
            if f.get("permalink"):
                A(f"   Customer record: {f['permalink']}")
            for a in f["articles"]:
                nflag = " 🆕" if a.get("is_new") else ""
                tr = a.get("triage") or {}
                sev = f"  [{tr.get('severity','')} · relevance {tr.get('relevance','')}]" if tr else ""
                A(f"   [!] {a['title']}{nflag}{sev}")
                if tr.get("injection_suspected"):
                    A("       ⚠ input flagged (possible prompt-injection) — classified deterministically, model not used")
                cat = f"   {{{', '.join(a['categories'])}}}" if a.get("categories") else ""
                A(f"       {a.get('source','?')} — {a.get('date','?')}{cat}")
                if a.get("also_reported_by"):
                    extra = a["also_reported_by"]
                    shown_src = ", ".join(extra[:4]) + (f" +{len(extra)-4} more" if len(extra) > 4 else "")
                    A(f"       Also reported by: {shown_src}")
                A(f"       Link: {a.get('url','(no link)')}")
            A("   MLRO Decision:  [ ] no action   [ ] investigate   [ ] escalate   [ ] file STR/SAR")
            A("")
        rep = stats.get("adverse_repeat") or {}
        if rep:
            A(f"   ⚠ REPEAT ADVERSE-MEDIA PATTERN ({REPEAT_WINDOW_DAYS}-day window):")
            for s_, n_ in sorted(rep.items()):
                A(f"      {s_} — {n_} distinct stories — a pattern, not an isolated headline;")
                A( "         EDD review required + assess STR grounds (tipping-off rules apply).")
            A("")
        A(f"   Source: Google News RSS ({ADVERSE_LOCALES}/{len(GNEWS_LOCALES)} worldwide locales) + GDELT global index (65+ languages) · {len(ADVERSE_KEYWORDS)} EN + {len(FOREIGN_KEYWORDS)} multilingual ({ADVERSE_LANG_COUNT}-language) red-flag terms · duplicate stories merged · raw headlines, MLRO decides.")
        if stats.get("watchlist_loaded"):
            A(f"   Source: {WATCHLIST_LABEL} (bulk, deterministic — national wanted lists / enforcement actions; "
              f"immune to news-feed rate limits) · {stats.get('watchlist_findings', 0)} subject(s) listed · standing exposure, not headlines.")
    A("")

    A("━" * 70)
    A("③  PEP  (POLITICALLY EXPOSED PERSONS)")
    A("━" * 70)
    A("   Source: Wikidata (free) — politicians, ministers, MPs, judges, military / SOE chiefs,")
    A("           state-owned-enterprise heads + their relatives & close associates (RCA).")
    A("           Fallback: OpenSanctions consolidated PEP dataset (bulk mirror) covers any")
    A("           individual the live lookup could not screen — hits are provenance-marked.")
    A(f"   Scope:  {stats['individuals_screened']} individuals auto-screened across the full database "
      f"(companies are not natural persons → not PEP-screened, but ARE sanctions + adverse-media screened).")
    A("   Action class (R.12): PEP status is PERMISSIBLE WITH CONTROLS — a confirmed PEP/RCA")
    A("   requires EDD, senior-management approval, source-of-funds/wealth establishment and")
    A("   enhanced ongoing monitoring; it is not, by itself, grounds to decline.")
    if pep_degraded:
        A(f"   Status: DEGRADED this run ({stats.get('pep_errors',0)} individual(s) unscreened on BOTH sources) — treat 'no PEP' as provisional; re-run.")
    elif pep_mirror:
        A(f"   Status: mirror-assisted this run — {pep_mirror} individual(s) screened via the OpenSanctions")
        A("   PEP mirror because Wikidata was unavailable; a mirror hit means VERIFY, a miss is still provisional.")
    if not pep_findings:
        A("   No PEP matches identified." + ("  (provisional — see status above)" if pep_degraded else ""))
    else:
        A("")
        for p in sorted(pep_findings, key=lambda p: (not p.get("is_new"), p["subject_name"])):
            who = p["subject_name"]
            if p.get("parent"):
                who = f"{who}  (owner / director — {p['parent']})"
            newtag = " 🆕 NEW" if p.get("is_new") else " [STANDING]"
            A(f"{who}   [INDIVIDUAL]{newtag}")
            A(f"   Class: {p.get('category','PEP (political / public office)')}")
            A(f"   {p.get('description','(position recorded on Wikidata)')}")
            if p.get("id"):
                A(f"   Source: {p.get('source_url') or 'https://www.wikidata.org/wiki/' + p['id']}")
            if p.get("permalink"):
                A(f"   Customer record: {p['permalink']}")
            A("   MLRO Decision:  [ ] not a PEP   [ ] confirmed PEP — EDD + senior-mgmt approval   [ ] investigate")
            A("")
    A("")

    related = stats.get("related_parties") or []
    A("━" * 70)
    A("④  RELATED PARTIES  (network / hidden links)")
    A("━" * 70)
    if not related:
        A("   No shared owners / UBOs or entity-to-UBO links detected across the book.")
    else:
        A("   Hidden connections across the customer base — review for collusion / structuring:")
        for cl in related[:25]:
            A(f"   • {cl['key'].title()}  ({cl['type']})")
            A(f"       Linked: {', '.join(cl['members'])}")
        if len(related) > 25:
            A(f"   • … +{len(related) - 25} more clusters (see run log)")
    A("")

    A("━" * 70)
    A("⑤  OPERATIONAL MONITORING  (latency · usage · anomaly · coverage · R.16)")
    A("━" * 70)
    if stats.get("monitoring") and stats.get("coverage") is not None:
        A(monitoring.build_monitoring_section(
            stats["monitoring"], stats["coverage"], stats.get("txn_status")))
    if stats.get("cdd_gaps_total"):
        A(f"   CDD/identity gaps (R.10) across flagged subjects: {stats['cdd_gaps_total']} open — see hits above.")
    if stats.get("arrangements"):
        A(f"   Legal arrangements (R.25) among flagged subjects: {stats['arrangements']}.")
    A("")

    audit = stats.get("agent_audit")
    if audit:
        A("━" * 70)
        A("⑥  AGENTIC OPERATING MODEL  (audit trail + QA gate)")
        A("━" * 70)
        A(agents.build_audit_section(audit))
        A("")
        A("━" * 70)
        A("⑦  AI GOVERNANCE & COMPLIANCE ATTESTATION")
        A("━" * 70)
        A(agents.build_attestation(audit, stats.get("ai_mode", "deterministic"),
                                   stats.get("injection_blocked", 0), list_meta))
        A("")

    A("━" * 70)
    A("MLRO SIGN-OFF")
    A("━" * 70)
    A("   Reviewed by: ____________________   Date: __________")
    A("   Decision: [ ] all clear   [ ] items escalated   [ ] TFS freeze   [ ] STR/SAR filed   Ref: ______")
    A("")
    A("Engine: screen.py · one pass: name-match vs live designation lists, Google News + GDELT + Bing News")
    A("adverse media + OpenSanctions crime watchlist, Wikidata PEP (OpenSanctions mirror fallback),")
    A(f"AI risk-rating & triage · {github_run_url()}")
    A("> " + ai.governance_footer())
    A("> Decision-support only; a 'no match' is never a clearance when a module is degraded (shown, never hidden).")
    A("> Detection is automatic; no freeze / decline / report before MLRO + four-eyes review.")
    A("> RETENTION: retain 10 years — UAE FDL No. 10 of 2025 (AML/CFT/CPF; duty formerly FDL 26/2021 Art. 23); Cabinet Decision 74/2020.")
    return "\n".join(L)

def post_unified_task(narrative, run_time, possible_matches, adverse_findings, pep_findings, mode="daily"):
    dt = run_time.strftime("%d %b %Y")
    n_s, n_a, n_p = len(possible_matches), len(adverse_findings), len(pep_findings)
    flag = "⚠️" if (n_s + n_a + n_p) > 0 else "✅"
    if mode == "onboarding":
        task_name = f"🆕 {flag} Onboarding Screening — Sanctions {n_s} · Adverse {n_a} · PEP {n_p} — {dt}"
    else:
        task_name = f"🛡️ {flag} Daily Screening — Sanctions {n_s} · Adverse {n_a} · PEP {n_p} — {dt}"
    # Adaptive budget: open at the budget that delivered last run (learned via
    # delta-state; weekly probe re-tests headroom), shrink on rejection. See
    # notes_budget_plan for the strategy; the plan always ends in the classic
    # 0.6× shrink chain down to ASANA_NOTES_FLOOR as the universal safety net.
    probe = run_time.toordinal() % 7 == 0  # deterministic weekly headroom re-test
    plan, last = notes_budget_plan(NOTES_BUDGET["stored"], probe), None
    for i, budget in enumerate(plan):
        payload = {"data": {
            "name": task_name[:250],
            "notes": cap_notes(narrative, budget),
            "due_on": run_time.strftime("%Y-%m-%d"),
            "assignee": ASANA_ASSIGNEE_GID,
            "projects": _mlro_queue_targets()[0],
            "memberships": _mlro_queue_targets()[1],
        }}
        r = asana_request("POST", "https://app.asana.com/api/1.0/tasks", json=payload)
        if r is not None and r.status_code in (200, 201):
            gid = r.json()["data"]["gid"]
            NOTES_BUDGET["learned"] = budget  # persisted with the delta-state on delivery
            log(f"OK Unified daily task created: {gid}")
            return gid
        last = r
        body = (getattr(r, "text", "") or "").lower()
        if r is not None and r.status_code == 400 and "too large" in body and i + 1 < len(plan):
            log(f"  Asana rejects the notes at a {budget}-byte budget — retrying at {plan[i + 1]}")
            continue
        break
    log(f"FAIL unified task: {getattr(last,'status_code','network')} - {getattr(last,'text','')[:300]}")
    UNIFIED_DELIVERY_FAILED["failed"] = True
    return None

def create_case_subtask(parent_gid, name, notes, due_on):
    """One trackable MLRO case per NEW hit — assigned, with a disposition to set."""
    if not parent_gid: return False
    payload = {"data": {
        "name": name[:250], "notes": (notes or "")[:8000], "assignee": ASANA_ASSIGNEE_GID,
        "due_on": due_on, "parent": parent_gid,
    }}
    r = asana_request("POST", "https://app.asana.com/api/1.0/tasks", json=payload)
    if r is not None and r.status_code in (200, 201):
        return True
    log(f"  case subtask failed: {getattr(r,'status_code','network')} - {getattr(r,'text','')[:160]}")
    return False

def open_mlro_cases(parent_gid, possible_matches, adverse_findings, pep_findings, run_time,
                    state=None):
    """Create an assigned subtask for each NEW item (sanctions, PEP, adverse),
    capped at CASE_SUBTASK_CAP per run. Overflow and failed creates go to the
    reserved backlog in `state` (persisted with the delta state on delivery)
    and are drained on later runs — sanctions first, oldest first — so an item
    past the cap is cased LATER, not never."""
    due_on = run_time.strftime("%Y-%m-%d")
    queue = []  # (priority, name, notes)
    for m in possible_matches:
        new_hits = [h for h in m["hits"] if h.get("is_new")]
        if not new_hits: continue
        top = max(new_hits, key=lambda h: h["score"])
        ctrl = " [OWNERSHIP/CONTROL]" if top.get("control_linkage") else ""
        nm = f"🔴 SANCTIONS case: {m['name']} — {top['list']} {_pct(top['score'])}{ctrl}"
        notes = [f"Customer: {m['name']}", f"Record: {m.get('permalink','')}", ""]
        for h in new_hits:
            notes.append(f"- [{h['subject_type']}] {h['subject_name']} → {h['list']}: "
                         f"\"{h['matched_entry']}\"  {_pct(h['score'])} ({h.get('confidence','')})"
                         + ("  [owner/UBO → 50%/control rule]" if h.get("control_linkage") else ""))
            if h.get("match_context"):
                notes.append(f"    {h['match_context']}")
        notes += ["", "Disposition: [ ] false positive   [ ] escalate / freeze (TFS)   [ ] investigate",
                  "Do not tip off. UAE Cabinet Resolution 74/2020 applies."]
        # Attach an AI-assisted STR/SAR DRAFT for HIGH-risk / confirmed cases (human files).
        risk = m.get("risk")
        if risk and (risk["rating"] == "HIGH" or any(h["score"] >= 95 for h in new_hits)):
            notes += ["", ai.draft_str(m["name"], m.get("permalink", ""), new_hits,
                                       False, [], risk)]
        queue.append((0, nm, "\n".join(notes)))
    for p in pep_findings:
        if not p.get("is_new"): continue
        nm = f"🟠 PEP case: {p['subject_name']} — {p.get('category','PEP')}"
        # Only Wikidata-sourced findings carry a Q-id; mirror/manual findings
        # must not get a fabricated wikidata.org link to a non-existent page.
        pid = str(p.get('id') or '')
        source_line = (f"Wikidata: https://www.wikidata.org/wiki/{pid}" if pid.startswith("Q")
                       else (f"Source ref: {pid}" if pid else "Source: mirror / manual review"))
        notes = [f"Subject: {p['subject_name']}" + (f"  (owner/director — {p['parent']})" if p.get("parent") else ""),
                 source_line,
                 f"Description: {p.get('description','')}", f"Record: {p.get('permalink','')}",
                 "", "Disposition: [ ] not a PEP   [ ] confirmed PEP — apply EDD   [ ] investigate"]
        queue.append((1, nm, "\n".join(notes)))
    for f in adverse_findings:
        new_arts = [a for a in f["articles"] if a.get("is_new")]
        if not new_arts: continue
        nm = f"🟡 Adverse-media case: {f['subject_name']}"
        notes = [f"Subject: {f['subject_name']}" + (f"  (owner/director — {f['parent']})" if f.get("parent") else ""),
                 f"Record: {f.get('permalink','')}", ""]
        for a in new_arts:
            notes.append(f"- {a['title']}  [{', '.join(a.get('categories',[])) or 'uncategorised'}]")
            notes.append(f"  {a.get('source','?')} — {a.get('date','?')}  {a.get('url','')}")
        notes += ["", "Disposition: [ ] no action   [ ] investigate   [ ] escalate   [ ] file STR/SAR"]
        queue.append((2, nm, "\n".join(notes)))

    # Merge today's NEW items with the carried backlog. Sort key (priority,
    # queued-date, arrival order): a backlogged sanctions case beats today's
    # adverse case, and within a priority the longest-waiting item goes first.
    today_iso = due_on
    entries = [{"p": p, "name": nm, "notes": notes, "queued": today_iso}
               for p, nm, notes in sorted(queue, key=lambda x: x[0])]
    today_names = {e["name"] for e in entries}
    backlog = [e for e in load_case_backlog(state) if e["name"] not in today_names]
    if backlog:
        log(f"  case backlog: {len(backlog)} carried item(s) eligible this run")
    combined = sorted(entries + backlog,
                      key=lambda e: (e["p"], e["queued"] or today_iso))
    created = 0
    leftover = []
    for i, e in enumerate(combined):
        if i >= CASE_SUBTASK_CAP or not create_case_subtask(
                parent_gid, e["name"],
                (e["notes"] + (f"\n\n(backlogged since the {e['queued']} run — "
                               f"case capacity or a create failure deferred it)"
                               if e["queued"] and e["queued"] != today_iso else "")),
                due_on):
            leftover.append(e)
        else:
            created += 1
    if state is not None:
        # A failed create with a live parent is retried from the backlog next
        # run; with NO parent (delivery failed) the state is never persisted and
        # everything re-alerts as new, so skip the pointless carry.
        if parent_gid:
            if len(leftover) > CASE_BACKLOG_MAX:
                log(f"  case backlog OVER CAP: dropping {len(leftover) - CASE_BACKLOG_MAX} "
                    f"oldest-priority-last item(s) beyond {CASE_BACKLOG_MAX} — raise "
                    f"CASE_SUBTASK_CAP or clear the queue (items remain in the report body)")
                leftover = leftover[:CASE_BACKLOG_MAX]
            if leftover:
                log(f"  case backlog: {len(leftover)} item(s) carried to the next run")
            state[CASE_BACKLOG_KEY] = [
                {"p": e["p"], "name": e["name"][:250], "notes": e["notes"][:8000],
                 "queued": e["queued"] or today_iso} for e in leftover]
    if len(combined) > CASE_SUBTASK_CAP:
        log(f"  case cap: created {created}, {len(combined) - CASE_SUBTASK_CAP} additional NEW item(s) "
            f"deferred to the case backlog (all remain in the report body)")
    else:
        log(f"  MLRO cases created: {created}")
    return created

def _ai_mode_label():
    """Honest AI-mode label. An ANTHROPIC key merely being present (LLM
    *available*) is not the same as LLM triage being ON (LLM_TRIAGE=1, the
    PDPL gate): 14 Jul the report claimed mode=LLM with 0 LLM calls attempted.
    The broker/attestation contract keys off `!= "deterministic"`, so any
    key-present state must stay distinct from plain "deterministic" (the
    credential is issuable and the PDPL line must say the key is present)."""
    if not ai.llm_available():
        return "deterministic"
    return "AI-assisted triage" if ai.LLM_TRIAGE else "deterministic (LLM standby — triage off)"

def tally_enrichment(results, wl_hits, wl_loaded):
    """Pure tally of the enrichment pass → (counts, adverse_findings, pep_findings).

    Honest denominators (the 14 Jul incident): counts["subjects"] counts EVERY
    subject the pass attempted — including errored ones — so error ratios are
    true fractions of the book (795 news-dead subjects of 837 reads 95%, not the
    1893% that the old survivors-only denominator produced). A subject counts at
    most ONCE in counts["errors"] however many modules failed for it (the old
    am+pep sum reached 1231 errors for 837 subjects).

    counts["errors"] counts ACTIONABLE coverage failures only — a subject with
    zero adverse coverage from any net (news dead AND watchlist missing), or an
    individual unscreened for PEP on both sources. A news-only loss while the
    deterministic watchlist stands is a RECALL DEGRADATION, not an error: it is
    reported loudly (am_errors counter, "DEGRADED (news)" module status, §②
    status line) but must not feed the error rate or the sustained escalation —
    the watchlist is the compensating control, and an alarm that can re-raise
    forever on a mitigated, environmental condition (news feeds throttling
    shared CI egress) is alert fatigue, not resilience.
      am_errors    — subjects whose whole news sweep failed (GN + GDELT); same
                     meaning as the committed metrics history, kept comparable
      am_blackout  — of those, subjects with ZERO adverse coverage from ANY
                     source (the watchlist was missing too) — the original alarm
      pep_errors   — individuals with no PEP coverage from either source
      pep_mirror   — individuals screened via the OpenSanctions mirror fallback
      watchlist    — subjects with ≥1 adverse-exposure watchlist finding
    """
    companies = individuals = 0
    am_errors = am_blackout = pep_errors = pep_mirror = subject_errors = 0
    adverse_findings, pep_findings = [], []
    for r in results:
        if r["type"] == "INDIVIDUAL":
            individuals += 1
        else:
            companies += 1   # corporate owners count with companies — legal persons
        subj_err = False
        if r["am_error"]:
            am_errors += 1
            if not wl_loaded:
                # No net could screen this subject — actionable failure.
                am_blackout += 1
                subj_err = True
        # Adverse findings merge both nets: flagged news articles (when the sweep
        # ran) + watchlist listings (always, including for news-dead subjects —
        # that is the whole point of the third net).
        arts = list(r["adverse"] or [])
        seen_titles = {a.get("title") for a in arts}
        for a in wl_hits.get(r["name"], []):
            if a.get("title") not in seen_titles:
                arts.append(a)
        if arts:
            adverse_findings.append({"subject_type": r["type"], "subject_name": r["name"],
                "parent": r["parent"], "permalink": r["permalink"], "articles": arts})
        p = r.get("pep")
        if r["type"] == "INDIVIDUAL" and p is not None:
            if p.get("errored"):
                pep_errors += 1
                subj_err = True
            elif p.get("hit"):
                if p.get("via_mirror"):
                    pep_mirror += 1
                # Carry the review flag through: a manual-review PEP has no
                # Wikidata id BY DESIGN, and the QA gate must not report it
                # as a missing-source integrity violation on every run.
                pep_findings.append({"subject_name": r["name"], "parent": r["parent"],
                    "permalink": r["permalink"], "id": p.get("id", ""),
                    "category": p.get("category", ""), "review": bool(p.get("review")),
                    "label": p.get("label", ""), "description": p.get("description", ""),
                    "source_url": p.get("source_url", "")})
            elif p.get("via_mirror"):
                pep_mirror += 1   # mirror screened it, found no listing
        if subj_err:
            subject_errors += 1
    counts = {"subjects": companies + individuals, "companies": companies,
              "individuals": individuals, "errors": subject_errors,
              "am_errors": am_errors, "am_blackout": am_blackout,
              "pep_errors": pep_errors, "pep_mirror": pep_mirror,
              "watchlist": sum(1 for f in adverse_findings
                               if any(a.get("watchlist") for a in f["articles"]))}
    return counts, adverse_findings, pep_findings

def screen_subject_set(customers, all_lists, list_meta, run_time, mode="daily"):
    """Shared core: sanctions + adverse media + PEP over a set of customers, with
    delta classification, one Asana report and MLRO case subtasks. mode controls
    the task title only ('daily' vs 'onboarding')."""
    _t_start = time.time()
    today = run_time.strftime("%Y-%m-%d")

    # Subject set first — the watchlist pass below screens it before the
    # network-bound enrichment starts.
    subjects_all = []
    for c in customers:
        subjects_all.append(("COMPANY", c["name"], None, c))
        for ind in c.get("individuals", []):
            subjects_all.append(("INDIVIDUAL", ind, c["name"], c))
        # Corporate owners/parents are sanctions-screened (50%/control rule) —
        # sweep their adverse media too, or a designated parent's coverage is
        # never seen. No PEP check: PEP status is a natural-person concept.
        for ent in c.get("entity_owners", []):
            subjects_all.append(("ENTITY (owner)", ent, c["name"], c))

    # ADVERSE-EXPOSURE WATCHLIST (bulk, deterministic) — download + match BEFORE
    # the enrichment pool, so adverse coverage exists even if both news feeds
    # refuse the runner for the whole run (10–14 Jul).
    wl_entries, wl_ids, wl_meta = load_adverse_watchlist()
    wl_hits = screen_watchlist(subjects_all, wl_entries, wl_ids, today) if wl_entries else {}
    if wl_entries:
        log(f"  {WATCHLIST_LABEL}: {wl_meta['count']:,} names · "
            f"{len(wl_hits)} subject name(s) matched")
    _t_watchlist = time.time()

    # SOURCE-COVERAGE DRIFT (R-09): a list that silently shrank is the most
    # dangerous failure mode — it creates false negatives. Check before screening.
    # The watchlist joins as a SUPPLEMENTARY source (drift is a soft note, never
    # a degraded core control); list_meta itself stays pure — it feeds the QA
    # gate's core-list checks and the attestation.
    coverage_meta = {**list_meta, "adverse_watchlist": wl_meta}
    if isinstance(list_meta.get("eocn", {}).get("mirror"), dict):
        coverage_meta["eocn_mirror"] = list_meta["eocn"]["mirror"]
    coverage_result = monitoring.check_source_coverage(coverage_meta, today)
    for a in coverage_result.get("alarms", []):
        log(f"COVERAGE ALARM: {a}")
    # EOCN cross-check (TFS freeze duty): a mirror designation missing from the
    # curated local list is a possible FALSE NEGATIVE — alarm into the same
    # coverage path (QA gate + report §⑤ + MLRO attention), degrade loudly.
    _eocn_missing = list_meta.get("eocn", {}).get("crosscheck_missing") or []
    if _eocn_missing:
        _shown = ", ".join(_eocn_missing[:5]) + (f" +{len(_eocn_missing)-5} more"
                                                 if len(_eocn_missing) > 5 else "")
        _msg = (f"EOCN local list may be STALE — {len(_eocn_missing)} designation(s) on the "
                f"OpenSanctions ae_local_terrorists mirror not found locally ({_shown}); "
                "update data/eocn-local-terrorist-list.json from the EOCN notification and re-run "
                "— treat EOCN 'clear' results as PROVISIONAL until resolved")
        coverage_result.setdefault("alarms", []).append(_msg)
        coverage_result.setdefault("drops", []).append(_msg)
        log(f"COVERAGE ALARM: {_msg}")
    # EOCN review-age gate: a lapsed manual review of the curated local list
    # surfaces in the same coverage path (QA gate + report §⑤); the run itself
    # fails post-delivery via enforce_eocn_review_gate().
    if EOCN_REVIEW_ALERT["overdue"]:
        coverage_result.setdefault("alarms", []).append(EOCN_REVIEW_ALERT["message"])
        coverage_result.setdefault("drops", []).append(EOCN_REVIEW_ALERT["message"])
        log(f"COVERAGE ALARM: {EOCN_REVIEW_ALERT['message']}")

    # 1) SANCTIONS — entities + individuals, ALL matching candidates
    possible_matches, clear = screen_customers(customers, all_lists)
    _t_sanctions = time.time()
    log(f"Sanctions: {len(possible_matches)} flagged · {len(clear)} clear")
    for m in possible_matches:
        if any(h["score"] >= 100 for h in m["hits"]):
            post_confirmed_hit_comment(m["gid"], m["hits"], run_time)

    # 2) ADVERSE MEDIA on every subject + 3) PEP on every individual — run the
    # network-bound sweep in PARALLEL (bounded pool) so a full book screens in
    # minutes, not hours. Each worker still paces its own requests for politeness.

    def _enrich(subj):
        subj_type, subj_name, parent, c = subj
        r = {"type": subj_type, "name": subj_name, "parent": parent,
             "permalink": c.get("permalink", ""), "adverse": None, "pep": None, "am_error": False}
        try:
            articles = search_adverse_media(subj_name, max_results=ADVERSE_MAX_RESULTS)
            r["adverse"] = [a for a in articles if a["flagged"]]
        except Exception as e:
            r["am_error"] = True; r["am_msg"] = str(e)[:120]
        if subj_type == "INDIVIDUAL":
            try:
                r["pep"] = check_pep(subj_name)
            except Exception as e:
                r["pep"] = {"errored": True, "error": str(e)[:120]}
        return r

    total = len(subjects_all)
    log(f"Enriching {total} subjects with {SCREEN_CONCURRENCY} parallel workers...")
    done = 0
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=SCREEN_CONCURRENCY) as ex:
        for r in ex.map(_enrich, subjects_all):
            done += 1
            results.append(r)
            if done % 50 == 0 or done == total:
                log(f"  enriched {done}/{total}")

    # PEP MIRROR FALLBACK — individuals whose live lookup errored get one bulk
    # second chance (loud, provisional) instead of finishing as "PEP unknown".
    pep_unresolved = [r for r in results
                      if r["type"] == "INDIVIDUAL" and (r.get("pep") or {}).get("errored")]
    if pep_unresolved:
        log(f"  PEP: {len(pep_unresolved)} live lookup(s) failed — trying the OpenSanctions mirror")
        pep_index = load_pep_mirror()
        if pep_index is not None:
            for r in pep_unresolved:
                r["pep"] = pep_mirror_lookup(pep_index, r["name"])

    # Pure tally — honest denominators (every subject counts, errors once per
    # subject) + findings merged across the news and watchlist nets.
    counts, adverse_findings, pep_findings = tally_enrichment(
        results, wl_hits, wl_entries is not None)
    companies, individuals = counts["companies"], counts["individuals"]
    am_errors, pep_errors = counts["am_errors"], counts["pep_errors"]
    _t_enrich = time.time()

    # DELTA — flag only what is new since the last run (state committed by workflow)
    state = load_delta_state()
    NOTES_BUDGET["stored"] = _clamp_notes_budget(state.get(NOTES_BUDGET_KEY))
    NOTES_BUDGET["learned"] = None
    delta = classify_deltas(possible_matches, adverse_findings, pep_findings, state, today)
    # NOTE: state is persisted only AFTER the report is successfully delivered to
    # Asana (see end of function). Saving it here would let a failed post — which
    # the workflow commits anyway (`if: always()`) — permanently mark a brand-new
    # match as "already seen", so it would never become an MLRO case. Fail-safe:
    # if delivery fails, leave the on-disk state untouched so the match re-alerts.
    log(f"Delta: {delta['sanctions']} new sanctions · {delta['adverse']} new adverse · {delta['pep']} new PEP")

    # ── AI ENRICHMENT (decision-support; deterministic unless an LLM key is set) ──
    # Per flagged customer: a Low/Med/High risk rating (explainable factors) and a
    # short "why flagged / what to check" summary. Adverse-media items get a
    # severity/relevance triage. Network links are surfaced across the book.
    adv_by_link = {}
    injection_blocked = 0
    for f in adverse_findings:
        adv_by_link.setdefault(f.get("permalink", ""), []).extend(f.get("articles", []))
        for a in f["articles"]:
            a["triage"] = ai.triage_adverse(f["subject_name"], a)
            if a["triage"].get("injection_suspected"):
                injection_blocked += 1
    pep_links = {p.get("permalink", "") for p in pep_findings}
    jtable = kyc.load_jurisdiction_risk()   # FATF R.10 jurisdiction-risk (maintained list)
    for m in possible_matches:
        link = m.get("permalink", "")
        m_adverse = adv_by_link.get(link, [])
        m_pep = link in pep_links
        kyc_data = m.get("kyc") or {}
        kyc_inds = {kyc._norm(i.get("name", "")): i for i in kyc_data.get("individuals", [])}
        # R.10 — attach an identity dossier + open CDD gaps to each individual hit
        for h in m["hits"]:
            if h.get("subject_type") == "INDIVIDUAL":
                rec = kyc_inds.get(kyc._norm(h.get("subject_name", "")))
                if rec:
                    h["identity"] = kyc.identity_dossier(rec)
                    h["cdd_gaps"] = rec.get("cdd_gaps", [])
        nationalities = [i.get("nationality", "") for i in kyc_data.get("individuals", [])]
        jtier, jreason = kyc.jurisdiction_risk_for(m.get("country", ""), nationalities, jtable)
        m["jurisdiction"] = {"tier": jtier, "reason": jreason}
        # R.25 — legal-arrangement (trust/foundation/partnership) flag
        m["arrangement"] = kyc_data.get("arrangement_type", "") if kyc_data.get("is_arrangement") else ""
        cdd_gap_count = sum(len(i.get("cdd_gaps", [])) for i in kyc_data.get("individuals", []))
        m["cdd_gap_count"] = cdd_gap_count
        m["risk"] = ai.compute_risk_rating(
            sanctions_hits=m["hits"],
            is_control=any(h.get("control_linkage") for h in m["hits"]),
            pep=m_pep, adverse_articles=m_adverse,
            jurisdiction_high_risk=(jtier == "high"),
            jurisdiction_grey=(jtier == "grey"),
            cdd_gaps=cdd_gap_count)
        m["ai_summary"] = ai.alert_summary(m["name"], m["risk"], m["hits"], m_pep, m_adverse)
    related = ai.related_parties(customers)
    mode_lbl = ("LLM" if ai.llm_available() and ai.LLM_TRIAGE else
                "LLM-standby (triage off)" if ai.llm_available() else "deterministic")
    log(f"AI: risk-rated {len(possible_matches)} flagged · {len(related)} related-party cluster(s) · "
        f"mode={mode_lbl}")

    _t_ai = time.time()
    # ── OPERATIONAL MONITORING (latency · usage · anomaly) ──
    # subjects = every subject the pass ATTEMPTED (incl. errored ones) and
    # errors counts each subject at most once — see tally_enrichment. The old
    # survivors-only denominator made ratios nonsensical (14 Jul: "795/42").
    subjects_total = counts["subjects"]
    errors_total = counts["errors"]

    # Evidence log (committed to git) + repeat-pattern signal: the same entity
    # flagged in ≥3 distinct stories inside 90 days is a PATTERN, not a headline.
    repeat_patterns = {}
    try:
        repeat_patterns = update_adverse_evidence(adverse_findings, run_time.strftime("%Y-%m-%d"))
        for s_, n_ in sorted(repeat_patterns.items()):
            log(f"REPEAT ADVERSE PATTERN: {s_} — {n_} distinct stories in {REPEAT_WINDOW_DAYS}d — escalate to MLRO")
    except Exception as e:
        log(f"evidence log skipped ({e})")
    timings = {"watchlist": round(_t_watchlist - _t_start, 2),
               "sanctions": round(_t_sanctions - _t_watchlist, 2),
               "enrichment": round(_t_enrich - _t_sanctions, 2),
               "ai_triage": round(_t_ai - _t_enrich, 2),
               "total": round(_t_ai - _t_start, 2)}
    # Onboarding runs screen a handful of subjects — persisting their snapshots
    # would REPLACE the same-date daily snapshot (persist_run dedups by date) and
    # poison every baseline median (the committed history shows subjects=2 days).
    # They still get the absolute checks; only the daily batch writes history.
    run_monitor = monitoring.monitor_run(
        today,
        counts={"subjects": subjects_total, "errors": errors_total,
                "am_errors": am_errors, "am_blackout": counts["am_blackout"],
                "pep_errors": pep_errors, "pep_mirror": counts["pep_mirror"],
                "watchlist": counts["watchlist"],
                "flagged": len(possible_matches), "adverse": len(adverse_findings),
                "pep": len(pep_findings)},
        timings=timings, llm_calls=dict(ai.LLM_CALLS),
        persist=(mode == "daily"))
    for a in run_monitor.get("anomalies", []):
        log(f"RUNTIME ANOMALY: {a}")
    for s in run_monitor.get("sustained", []):
        log(f"SUSTAINED ANOMALY (escalate to MLRO): {s} — persisted across recent runs")
    txn_status = txn_monitor.status_line()   # R.16 — honest about the (absent) feed
    cdd_gaps_total = sum(m.get("cdd_gap_count", 0) for m in possible_matches)
    arrangements = sum(1 for m in possible_matches if m.get("arrangement"))

    stats = {"customers_total": len(customers), "companies_screened": companies,
             "individuals_screened": individuals, "subjects_total": subjects_total,
             "am_errors": am_errors, "pep_errors": pep_errors, "delta": delta,
             "am_blackout": counts["am_blackout"], "pep_mirror": counts["pep_mirror"],
             "watchlist_findings": counts["watchlist"], "watchlist_loaded": wl_entries is not None,
             "adverse_repeat": repeat_patterns,
             "related_parties": related, "injection_blocked": injection_blocked,
             "monitoring": run_monitor, "coverage": coverage_result,
             "txn_status": txn_status, "cdd_gaps_total": cdd_gaps_total,
             "arrangements": arrangements,
             "ai_mode": _ai_mode_label()}

    # ── AGENTIC OPERATING MODEL: audit trail + QA / governance gate ──
    new_s = sum(1 for m in possible_matches if any(h.get("is_new") for h in m["hits"]))
    new_p = sum(1 for p in pep_findings if p.get("is_new"))
    new_a = sum(1 for f in adverse_findings if any(a.get("is_new") for a in f["articles"]))
    cases_proposed = min(new_s + new_p + new_a, CASE_SUBTASK_CAP)
    stats["agent_audit"] = agents.run_pipeline_audit(
        stats, possible_matches, adverse_findings, pep_findings,
        list_meta, cases_proposed, stats["ai_mode"])
    if not stats["agent_audit"]["qa"]["passed"]:
        log(f"QA GATE: {len(stats['agent_audit']['qa']['issues'])} integrity issue(s) — see report")

    narrative = build_unified_narrative(possible_matches, clear, adverse_findings,
                                        pep_findings, list_meta, stats, run_time)
    parent_gid = post_unified_task(narrative, run_time, possible_matches,
                                   adverse_findings, pep_findings, mode=mode)
    # MLRO case subtasks for the NEW items only (keeps the case list actionable);
    # overflow/failed items ride the reserved backlog inside `state`.
    open_mlro_cases(parent_gid, possible_matches, adverse_findings, pep_findings, run_time,
                    state=state)
    # Persist the delta-state ONLY once the report was delivered. If the post
    # failed (parent_gid is None), keep the prior state so today's new matches are
    # flagged new again on the next run instead of being silently suppressed.
    if parent_gid:
        pruned = prune_delta_state(state, today)
        if pruned:
            log(f"  delta state: pruned {pruned} fingerprint(s) unseen > {DELTA_RETENTION_DAYS}d")
        if NOTES_BUDGET["learned"]:
            state[NOTES_BUDGET_KEY] = NOTES_BUDGET["learned"]
        save_delta_state(state)
    else:
        log("Delta-state NOT persisted: Asana delivery failed — new matches will re-alert next run.")
    return possible_matches, adverse_findings, pep_findings

def run_unified(run_time):
    log("UNIFIED daily screening — sanctions + adverse media + PEP")
    all_lists, list_meta = load_all_lists()
    customers = get_all_customers()
    screen_subject_set(customers, all_lists, list_meta, run_time, mode="daily")
    log("Unified run done.")
    enforce_delivery_gate()
    enforce_list_outage_gate()
    enforce_eocn_review_gate()

def run_onboarding(run_time):
    """Screen only customers created within the last ONBOARDING_WINDOW_HOURS, so a
    new customer is screened at onboarding rather than waiting for the daily batch."""
    log(f"ONBOARDING screening — customers created in the last {ONBOARDING_WINDOW_HOURS}h")
    customers = get_all_customers()
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=ONBOARDING_WINDOW_HOURS)
    fresh = []
    for c in customers:
        ts = c.get("created_at", "") or ""
        try:
            created = datetime.datetime.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S")
        except Exception:
            # Non-coverage is never silent: a customer we cannot date-stamp is
            # flagged so it is screened by the daily batch and reviewed.
            log(f"  onboarding: unparseable created_at for '{c.get('name','?')}' — left to daily batch")
            continue
        if created >= cutoff:
            fresh.append(c)
    log(f"  {len(fresh)} new customer(s) in window (of {len(customers)} total)")
    if not fresh:
        log("  No new customers to screen — no onboarding task posted.")
        return
    all_lists, list_meta = load_all_lists()
    screen_subject_set(fresh, all_lists, list_meta, run_time, mode="onboarding")
    log("Onboarding run done.")
    enforce_delivery_gate()
    enforce_list_outage_gate()
    enforce_eocn_review_gate()

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    run_time = now_uae()
    hour_uae = run_time.hour

    if RUN_MODE == "unified":
        run_unified(run_time)
        return

    if RUN_MODE == "onboarding":
        run_onboarding(run_time)
        return

    if RUN_MODE == "weekly_adverse":
        run_label = "Daily Adverse Media"
        log(f"Starting: {run_label}")
        customers = get_all_customers()
        run_weekly_adverse(customers, run_time)
        enforce_delivery_gate()   # an undelivered report must exit red, not green
        return

    # Daily sanctions run
    if TRIGGER_TYPE == "schedule" and hour_uae < 12:
        run_label = "Morning Run — 06:00 UAE"
    elif TRIGGER_TYPE == "schedule":
        run_label = "Evening Run — 18:00 UAE"
    else:
        run_label = "Manual Run"

    log(f"Starting: {run_label}")

    # Download lists
    LIST_ENTRY_ATTRS.clear()   # adjudication attributes are per-load state
    ofac_data = download("https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.csv","OFAC SDN")
    ofac_alt_data = download("https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/alt.csv","OFAC SDN a.k.a.")
    un_data   = download("https://scsanctions.un.org/resources/xml/en/consolidated.xml","UN Consolidated")
    uk_data   = download("https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv","UK OFSI")
    eu_data   = download("https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv","EU FSF")
    au_data   = download("https://data.opensanctions.org/datasets/latest/au_dfat_sanctions/targets.simple.csv","Australia DFAT")
    ch_data   = download("https://data.opensanctions.org/datasets/latest/ch_seco_sanctions/targets.simple.csv","Switzerland SECO")

    # Same fallback ladder as load_all_lists — the legacy manual path must not
    # be the one place a single-origin outage still bites. Fetched flags track
    # "source material obtained" (primary bytes OR a fallback that answered).
    ofac_fetched, un_fetched = bool(ofac_data), bool(un_data)
    uk_fetched,   eu_fetched = bool(uk_data),   bool(eu_data)
    ofac_names, ofac_date, ofac_hash = parse_ofac(ofac_data)
    # Fallback BEFORE the alias fold, or an alias-only load defeats the mirror
    # (same trap load_all_lists documents at its own fold).
    fb = _mirror_fallback(ofac_names, "us_ofac_sdn", "OFAC SDN")
    if fb:
        ofac_names, ofac_date, ofac_hash = fb   # mirror already carries aliases
        ofac_fetched = True
    else:
        ofac_names = _fold_ofac_aliases(ofac_names, ofac_alt_data)
    un_names,   un_date,   un_hash   = parse_un(un_data)
    fb = _mirror_fallback(un_names, "un_sc_sanctions", "UN Consolidated")
    if fb:
        un_names, un_date, un_hash = fb
        un_fetched = True
    uk_names,   uk_date,   uk_hash   = parse_uk(uk_data)
    fb = _mirror_fallback(uk_names, "gb_hmt_sanctions", "UK OFSI")
    if fb:
        uk_names, uk_date, uk_hash = fb
        uk_fetched = True
    eu_names,   eu_date,   eu_hash   = parse_eu(eu_data)
    fb = _eu_official_fallback(eu_names)
    if fb:
        eu_names, eu_date, eu_hash = fb
        eu_fetched = True
    au_names,   au_date,   au_hash   = parse_eu(au_data)   # same targets.simple.csv shape
    ch_names,   ch_date,   ch_hash   = parse_eu(ch_data)
    eocn_names, eocn_date, eocn_hash = parse_eocn(EOCN_PDF_PATH)

    list_meta = {
        "ofac":  {"count":len(ofac_names),  "date":ofac_date,  "hash":ofac_hash},
        "un":    {"count":len(un_names),    "date":un_date,    "hash":un_hash},
        "uk":    {"count":len(uk_names),    "date":uk_date,    "hash":uk_hash},
        "eu":    {"count":len(eu_names),    "date":eu_date,    "hash":eu_hash},
        "au":    {"count":len(au_names),    "date":au_date,    "hash":au_hash},
        "ch":    {"count":len(ch_names),    "date":ch_date,    "hash":ch_hash},
        "eocn":  {"count":len(eocn_names),  "date":eocn_date,  "hash":eocn_hash},
    }

    # Fail-safe (mirrors load_all_lists): if EVERY list failed to load, screening
    # would clear every customer and post a green ✅ task — a total list-fetch
    # failure must never masquerade as "all clear".
    if sum(m["count"] for m in list_meta.values()) == 0:
        raise RuntimeError(
            "FATAL: no sanctions list could be loaded (OFAC/UN/UK/EU/AU/CH/EOCN all empty) "
            "— refusing to screen or post an all-clear.")
    # Per-list coverage floors: an OBTAINED core list at zero (or a fraction
    # of its known size) is the same false-negative class as the all-empty
    # case above and refuses the run; a list with no obtainable source this
    # run degrades and turns the run red after delivery (outage gate).
    enforce_core_list_floors(list_meta, fetched={
        "ofac": ofac_fetched, "un": un_fetched,
        "uk": uk_fetched, "eu": eu_fetched,
        "au": bool(au_data), "ch": bool(ch_data),
        "eocn": EOCN_SOURCE_STATE["obtained"],
    })

    all_lists = {
        "OFAC SDN":         [(normalize(n),n) for n in ofac_names],
        "UN Consolidated":  [(normalize(n),n) for n in un_names],
        "UK OFSI":          [(normalize(n),n) for n in uk_names],
        "EU FSF":           [(normalize(n),n) for n in eu_names],
        "Australia DFAT":   [(normalize(n),n) for n in au_names],
        "Switzerland SECO": [(normalize(n),n) for n in ch_names],
        "UAE EOCN":         [(normalize(n),n) for n in eocn_names],
    }
    # Internal firm watchlist (optional): added AFTER the all-empty guard and
    # the floors so firm-internal names can never satisfy a core-coverage
    # fail-safe on this path either; empty is a valid state.
    iw_names, iw_date, iw_hash = parse_internal_watchlist()
    list_meta["internal"] = {"count":len(iw_names),"date":iw_date,"hash":iw_hash,"tier":"supplementary"}
    if iw_names:
        all_lists["Internal Watchlist"] = [(normalize(n),n) for n in iw_names]

    log("Fetching customers...")
    customers = get_all_customers()

    log("Screening...")
    possible_matches, clear = screen_customers(customers, all_lists)
    log(f"Results: {len(possible_matches)} matches | {len(clear)} clear")

    # Post comments on confirmed hits
    for m in possible_matches:
        if any(h["score"] >= 100 for h in m["hits"]):
            post_confirmed_hit_comment(m["gid"], m["hits"], run_time)

    narrative = build_daily_narrative(
        customers, possible_matches, clear, list_meta, run_time, run_label
    )
    post_daily_task(narrative, run_time, run_label, len(possible_matches))
    log("Done.")
    enforce_delivery_gate()   # an undelivered report is the more fundamental failure
    enforce_list_outage_gate()
    enforce_eocn_review_gate()

if __name__ == "__main__":
    main()
