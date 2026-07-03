#!/usr/bin/env python3
"""
FINE GOLD LLC — DAILY SANCTIONS SCREENING + ADVERSE MEDIA
Hawkeye Sterling V2 — screen.py v3.0
==========================================
Modes:
  full_batch     : daily 06:00 + 18:00 UAE — sanctions + adverse media on flagged
  weekly_adverse : every Monday — adverse media on ALL 324 customers
"""

import os, sys, re, csv, json, hashlib, unicodedata, io, datetime, requests, time
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
ASANA_TOKEN           = os.environ["ASANA_TOKEN"]
TRIGGER_TYPE          = os.environ.get("TRIGGER_TYPE", "workflow_dispatch")
RUN_MODE              = os.environ.get("RUN_MODE", "full_batch")  # full_batch | weekly_adverse

ASANA_CUSTOMER_DB_GID = "1214107620220121"
ASANA_ONGOING_MON_GID = "1213914392047129"
ASANA_SECTION_GID     = "1213914392047131"   # Daily Sanctions Screening section
ASANA_ASSIGNEE_GID    = "1213645083721304"   # Luisa Fernanda

THRESHOLD             = 85   # combined (full + core) similarity to flag a match
CORE_THRESHOLD        = 82   # distinctive-token similarity required (false-positive guard)
EOCN_PDF_PATH         = "eocn_list.pdf"
EOCN_JSON_PATH        = "data/eocn-local-terrorist-list.json"
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
    "عقوبات": "sanction",
    "إرهاب": "terrorism",
    "تمويل الإرهاب": "terrorist financing",
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

# Non-Latin scripts where letter-case / \b word boundaries do not apply and terms
# must be matched by substring: Cyrillic, Arabic (+ supplement, covers fa/ur),
# Devanagari, Hiragana/Katakana, CJK ideographs, Hangul.
_NONLATIN_RE = re.compile(
    "[Ѐ-ӿ؀-ۿݐ-ݿऀ-ॿ぀-ヿ㐀-鿿가-힯]")

def match_adverse_keywords(title: str) -> list:
    """All adverse keywords found in one headline: the English set (word-boundary,
    case-insensitive) plus the 18-language multilingual set. Each non-English term
    maps to its English canonical so typology bucketing and reporting stay uniform.
    Latin-script foreign terms match on \b word boundaries (lower-cased); non-Latin
    scripts match by substring on the raw headline. Order preserved, no duplicates."""
    raw = title or ""
    tl = raw.lower()
    matched = [kw for kw in ADVERSE_KEYWORDS if re.search(r"\b" + re.escape(kw), tl)]
    for term, canon in FOREIGN_KEYWORDS.items():
        if canon in matched:
            continue
        hit = (term in raw) if _NONLATIN_RE.search(term) \
            else re.search(r"\b" + re.escape(term.lower()), tl) is not None
        if hit:
            matched.append(canon)
    return matched

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

def now_uae():
    utc = datetime.datetime.utcnow()
    return utc + datetime.timedelta(hours=UAE_TZ_OFFSET)

def log(msg):
    print(f"[{datetime.datetime.utcnow().strftime('%H:%M:%S')}] {msg}", flush=True)

# ── ASANA TRANSPORT (honours 429 rate-limit; retries transient errors) ────────
ASANA_NOTES_MAX = 65000  # Asana notes hard limit is ~65,535; stay under

def asana_request(method, url, **kw):
    """Single Asana call path. Retries on 429 (respecting Retry-After) and 5xx so a
    burst of reads/posts never crashes the run. Returns the final response (caller
    inspects status); returns None only if the network failed every attempt."""
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

def cap_notes(narrative):
    """Cap a report to Asana's notes limit WITHOUT amputating the sign-off / retention
    footer at the end — truncate the body, keep the tail."""
    if len(narrative) <= ASANA_NOTES_MAX:
        return narrative
    log(f"  notes truncated ({len(narrative)} → {ASANA_NOTES_MAX}); sign-off/retention preserved")
    tail = narrative[-1200:]
    head = narrative[: ASANA_NOTES_MAX - len(tail) - 40]
    return head + "\n…[body truncated — see workflow run log]…\n" + tail

# ── ADVERSE MEDIA ─────────────────────────────────────────────────────────────
# How many Google News locales (from the worldwide GNEWS_LOCALES matrix) to sweep
# per subject. Default 5 = the historic US/GB/AE(en)/TR/AE(ar) set (protects the
# mandatory control runtime); raise up to len(GNEWS_LOCALES) (36) for a full
# global sweep. Multilingual flagging is always on regardless of this number.
ADVERSE_LOCALES = int(os.environ.get("ADVERSE_LOCALES", "5"))
# A targeted second pass: the name AND a cluster of material risk terms, so adverse
# coverage surfaces even when it isn't in the subject's top general-news headlines.
RISK_QUERY = ("fraud OR sanctions OR \"money laundering\" OR arrest OR investigation OR "
              "court OR bribery OR corruption OR smuggling OR terrorism OR embezzlement OR "
              "convicted OR indicted OR seized OR raid OR probe OR lawsuit OR charged")
# Arabic counterpart of RISK_QUERY for the AE:ar locale — Arabic-language wrongdoing
# coverage that never uses the English terms (see ADVERSE_KEYWORDS_AR for mapping).
AR_RISK_QUERY = " OR ".join('"' + t + '"' for t in (
    "احتيال", "غسل الأموال", "عقوبات", "فساد", "رشوة", "اعتقال", "تهريب", "إرهاب"))

# GDELT DOC 2.0 — a free, no-key global news index (100+ languages; titles
# machine-translated to English). The independent SECOND feed, so adverse
# coverage never depends on Google News alone.
GDELT_URL = ("https://api.gdeltproject.org/api/v2/doc/doc?query={query}"
             "&mode=artlist&format=json&maxrecords=20&sort=datedesc&timespan=12m")
GDELT_RISK_TERMS = ["sanctions", '"money laundering"', "fraud", "corruption", "terrorism"]

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
    the caller can log it (the Google News passes still stand on their own)."""
    q = requests.utils.quote(f'"{name}" ({" OR ".join(GDELT_RISK_TERMS)})')
    r = requests.get(GDELT_URL.format(query=q), timeout=20,
                     headers={"User-Agent": "Mozilla/5.0 (compliance screening)"})
    if r.status_code != 200:
        raise RuntimeError(f"GDELT HTTP {r.status_code}")
    return parse_gdelt(r.json() if r.content else {}, max_results)

def search_adverse_media(name: str, max_results: int = 8) -> list:
    """
    Deep adverse-media search via Google News RSS.
      Pass 1 — exact name across the first ADVERSE_LOCALES worldwide locales
               (default US/GB/AE(en)/TR/AE(ar); up to 36 editions when raised).
      Pass 2 — exact name AND a material-risk-term cluster (en) to surface
               wrongdoing coverage that isn't in the general headlines.
      Pass 3 — targeted Arabic risk-term pass on the AE:ar edition.
    Headlines are flagged against an 18-language multilingual red-flag set,
    bucketed by typology, deduplicated across outlets, and ranked recent-first.
    Returns list of dicts: {title, source, date, ts, url, flagged, keywords, categories}.
    """
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
    for q, locales in passes:
        query = requests.utils.quote(q)
        for url_template in locales:
            url = url_template.format(query=query)
            try:
                r = requests.get(url, timeout=15,
                                 headers={"User-Agent": "Mozilla/5.0 (compliance screening)"})
                if r.status_code != 200:
                    continue
                root = ET.fromstring(r.content)
                for item in root.findall(".//item")[:max_results]:
                    title_el = item.find("title")
                    source_el = item.find("source")
                    pubdate_el = item.find("pubDate")
                    link_el = item.find("link")
                    if title_el is None: continue
                    title = (title_el.text or "").strip()
                    if title in seen_titles: continue
                    seen_titles.add(title)
                    source = (source_el.text if source_el is not None else "Unknown")
                    pub_date = (pubdate_el.text or "")[:16] if pubdate_el is not None else ""
                    link = (link_el.text or "") if link_el is not None else ""
                    matched = match_adverse_keywords(title)
                    articles.append({
                        "title": title,
                        "source": source,
                        "date": pub_date,
                        "ts": _parse_rss_date(pubdate_el.text if pubdate_el is not None else ""),
                        "url": link,
                        "flagged": bool(matched),
                        "keywords": matched,
                        "categories": typology_for(matched),
                    })
            except Exception:
                continue
            time.sleep(0.4)  # polite delay between requests

    # Independent second source — GDELT. Its failure alone never fails the
    # subject (the Google News passes above already ran); it is logged so a quiet
    # feed outage is visible in the run log instead of silently narrowing recall.
    try:
        for a in search_gdelt(name, max_results):
            if a["title"] not in seen_titles:
                seen_titles.add(a["title"])
                articles.append(a)
    except Exception as e:
        log(f"  GDELT unavailable for this subject ({str(e)[:80]}) — Google News coverage stands")

    articles = dedup_stories(articles)
    # Sort: flagged first, then most-recent first (recency ranking).
    articles.sort(key=lambda x: (not x["flagged"], -(x.get("ts") or 0)))
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
        lines.append(f"   ✅ No adverse headlines identified in top results.")
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
            key = (subj, a.get("title"))
            if not subj or not a.get("title") or key in seen:
                continue
            seen.add(key)
            entries.append({
                "date": str(today_iso)[:10], "subject": subj,
                "subject_type": f_.get("subject_type", ""), "parent": f_.get("parent") or "",
                "title": a.get("title", ""), "source": a.get("source", ""),
                "url": a.get("url", ""), "keywords": a.get("keywords", []),
                "categories": a.get("categories", []),
            })

    def _age_days(e):
        try:
            d = datetime.datetime.strptime(str(e.get("date", ""))[:10], "%Y-%m-%d")
            t = datetime.datetime.strptime(str(today_iso)[:10], "%Y-%m-%d")
            return (t - d).days
        except Exception:
            return 10 ** 6
    entries = [e for e in entries if _age_days(e) <= EVIDENCE_RETENTION_DAYS]
    try:
        d = os.path.dirname(path)
        if d:
            os.makedirs(d, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=1)
    except Exception as e:
        log(f"  evidence log write failed ({e}) — screening output unaffected")
    counts = {}
    for e in entries:
        if _age_days(e) <= REPEAT_WINDOW_DAYS:
            counts[e["subject"]] = counts.get(e["subject"], 0) + 1
    return {subj: n for subj, n in counts.items() if n >= REPEAT_THRESHOLD}

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

def _norm_lower(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s.lower())).strip()

def check_pep(name):
    """Returns {hit, id, label, description} | {hit:False} | {errored:True}."""
    key = _norm_lower(name)
    if not key or len(key) < 5:
        return {"hit": False}
    if key in _PEP_CACHE:
        return _PEP_CACHE[key]
    url = ("https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json"
           "&language=en&uselang=en&type=item&limit=7&search="
           + requests.utils.quote(str(name).strip()))
    try:
        r = requests.get(url, timeout=20, headers={
            "User-Agent": "HawkeyeSterling-PEP/1.0 (compliance screening)",
            "Accept": "application/json"})
        if r.status_code != 200:
            return {"errored": True, "error": f"HTTP {r.status_code}"}
        results = (r.json() or {}).get("search", []) or []
    except Exception as e:
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

# ── LIST DOWNLOADS ────────────────────────────────────────────────────────────
def download(url, label):
    log(f"Downloading {label}...")
    try:
        r = requests.get(url, timeout=90,
                         headers={"User-Agent": "FineGoldCompliance/3.0"})
        r.raise_for_status()
        log(f"  {label}: {len(r.content):,} bytes")
        return r.content
    except Exception as e:
        log(f"  ERROR {label}: {e}")
        return None

def parse_ofac(data):
    names = set()
    if not data: return names, "unavailable", ""
    try:
        reader = csv.reader(io.StringIO(data.decode("latin-1")))
        for row in reader:
            if len(row) > 1:
                n = row[1].strip().strip('"')
                if n and n != "-0-": names.add(n)
    except Exception as e:
        log(f"  OFAC parse error: {e}")
    return names, "live", sha256_of(data)

def parse_un(data):
    names = set()
    date_str = "unknown"
    if not data: return names, date_str, ""
    try:
        root = ET.fromstring(data)
        date_str = root.get("dateGenerated", "unknown")[:10]
        for section in ["INDIVIDUALS", "ENTITIES"]:
            sec = root.find(section)
            if sec is None: continue
            tag = "INDIVIDUAL" if section == "INDIVIDUALS" else "ENTITY"
            alias_tag = "INDIVIDUAL_ALIAS" if section == "INDIVIDUALS" else "ENTITY_ALIAS"
            for entry in sec.findall(tag):
                parts = []
                for field in ["FIRST_NAME","SECOND_NAME","THIRD_NAME","FOURTH_NAME","NAME"]:
                    el = entry.find(field)
                    if el is not None and el.text: parts.append(el.text.strip())
                if parts: names.add(" ".join(parts))
                # Designated a.k.a. names are real designations the party operates
                # under — capture them too (EU/UK parsers already do). Missing these
                # was a false-negative gap: a UN alias-only match would screen clear.
                for alias in entry.findall(alias_tag):
                    an = alias.find("ALIAS_NAME")
                    if an is not None and an.text and an.text.strip():
                        names.add(an.text.strip())
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
        if not (reader.fieldnames and "Name 6" in reader.fieldnames):
            reader = csv.DictReader(io.StringIO("\n".join(lines)))  # no title row
        if not (reader.fieldnames and "Name 6" in reader.fieldnames):
            log("  UK parse error: expected 'Name 6' column not found — list NOT parsed")
            return names, "PARSE ERROR — unexpected format", sha256_of(data)
        for row in reader:
            n6 = (row.get("Name 6") or "").strip()
            n1 = (row.get("Name 1") or "").strip()
            n2 = (row.get("Name 2") or "").strip()
            n3 = (row.get("Name 3") or "").strip()
            if n6: names.add(n6)
            combined = " ".join(p for p in [n1,n2,n3] if p)
            if combined: names.add(combined)
        date_str = lines[0].split(",")[-1].strip() if lines else "unknown"
    except Exception as e:
        log(f"  UK parse error: {e}")
    return names, date_str, sha256_of(data)

def parse_eu(data):
    names = set()
    if not data: return names, "unknown", ""
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
        log(f"  EU parse error: {e}")
    return names, "live", sha256_of(data)

def parse_canada(data):
    """Canada Consolidated Autonomous Sanctions (SEMA), Global Affairs Canada — free XML.
    Tolerant parse: pulls entity names and combined given/last person names."""
    names = set()
    if not data: return names, "unavailable", ""
    try:
        root = ET.fromstring(data)
        for rec in root.iter():
            # Each record groups name parts as child elements; collect name-ish fields.
            entity = given = last = ""
            for ch in list(rec):
                tag = ch.tag.split("}")[-1].lower()
                val = (ch.text or "").strip()
                if not val: continue
                if "entity" in tag or tag == "name": entity = entity or val
                elif "given" in tag or tag == "firstname": given = given or val
                elif "last" in tag or tag == "surname" or tag == "lastname": last = last or val
            if entity: names.add(entity)
            person = " ".join(p for p in [given, last] if p)
            if person and len(person) > 3: names.add(person)
    except Exception as e:
        log(f"  Canada SEMA parse error: {e}")
    if not names: return names, "unavailable", ""
    return names, "live", sha256_of(data)

def parse_eocn(pdf_path):
    """UAE EOCN Local Terrorist List.

    Primary source is the maintained in-repo JSON (data/eocn-local-terrorist-list.json),
    populated from the official EOCN publication — the EOCN site offers no free
    machine-readable feed and bot-gates its PDF/XLSX, so the list is kept here.
    A raw PDF at repo root (eocn_list.pdf), if present, is still parsed as a fallback."""
    names = set()
    # 1) Preferred: the maintained JSON list (zero-dependency, no PDF parsing).
    if os.path.exists(EOCN_JSON_PATH):
        try:
            raw = open(EOCN_JSON_PATH, "rb").read()
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
                log(f"  EOCN: {len(names)} names from {EOCN_JSON_PATH}")
                return names, "from maintained list (data/eocn-local-terrorist-list.json)", sha256_of(raw)
            log(f"  EOCN JSON present but 'entries' is empty — manual update required")
        except Exception as e:
            log(f"  EOCN JSON parse error: {e}")
    # 2) Fallback: a raw PDF uploaded to repo root.
    if not os.path.exists(pdf_path):
        log(f"  EOCN list not found — manual check required")
        return names, "NOT AVAILABLE — populate data/eocn-local-terrorist-list.json", ""
    try:
        raw = open(pdf_path,"rb").read()
        pdf_hash = sha256_of(raw)
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        for line in text.splitlines():
            line = line.strip()
            if 5 < len(line) < 80:
                if re.match(r"^[A-Z\s\-\'\.]+$", line) and len(line.split()) >= 2:
                    names.add(line)
        log(f"  EOCN: {len(names)} names extracted")
        return names, "from uploaded PDF", pdf_hash
    except Exception as e:
        log(f"  EOCN parse error: {e}")
        return names, "PARSE ERROR", ""

# ── CUSTOMER LOADING ──────────────────────────────────────────────────────────
SKIP_TOKENS = [
    "S.R.L","S.P.A","L.L.C","LLC","FZE","FZCO","DMCC","LTD","N/A",
    "PENDING","ROSYSON","HONOR INVESTMENTS","SIVAL GROUP","VECCHIA",
    "EURO-AGRI","FERRANO","HLC","BAYINDIR ELEKTRIK","HOMEROS",
    "ANONIM SIRKETI","ANONİM ŞİRKETİ","KIYMETLI MADENLER",
]

def extract_individuals(notes):
    if not notes or len(notes.strip()) < 100: return []
    pattern = r"Name:\s*([A-Za-zÀ-ÿ\s\.\-\']+?)(?:\n|Shares|Nationality|Passport|Date of|Gender|Emirates|Proof|PEP|$)"
    found = re.findall(pattern, notes)
    cleaned = []
    for n in found:
        n = n.strip()
        if len(n) < 5: continue
        if any(s.upper() in n.upper() for s in SKIP_TOKENS): continue
        if re.search(r"\d", n): continue
        cleaned.append(n)
    return list(dict.fromkeys(cleaned))

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
            individuals = [i["name"] for i in struct_inds] or extract_individuals(notes)
            customers.append({
                "gid": t["gid"],
                "name": t["name"],
                "permalink": t.get("permalink_url",""),
                "created_at": t.get("created_at",""),
                "individuals": individuals,
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
    return customers

# ── SCREENING ─────────────────────────────────────────────────────────────────
def core_tokens(norm):
    """Distinctive tokens of a normalized name (boilerplate removed)."""
    return [t for t in norm.split() if t not in STOPWORD_TOKENS and len(t) > 1]

def match_score(n_norm, e_norm):
    """Returns (decisive_score, full_score, core_score).

    decisive_score = min(full, core): a pair only scores high if BOTH the whole
    string AND its distinctive core agree. Two firms sharing only legal-form /
    sector boilerplate ("SANAYI VE TICARET ANONIM SIRKETI") score high on `full`
    but low on `core`, so the min collapses the false positive. When neither side
    has a distinctive core (e.g. a pure person-name), we fall back to `full`."""
    full = fuzz.token_sort_ratio(n_norm, e_norm)
    cn, ce = core_tokens(n_norm), core_tokens(e_norm)
    if not cn or not ce:
        return full, full, full
    core = fuzz.token_sort_ratio(" ".join(cn), " ".join(ce))
    return min(full, core), full, core

def confidence_tier(core):
    if core >= 92: return "STRONG"
    if core >= 85: return "MODERATE"
    return "WEAK"

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
    for list_name, entries in all_lists.items():
        for en, orig in entries:
            if len(en) < 6: continue
            best = None
            for cand in variants:
                score, full, core = match_score(cand, en)
                if best is None or score > best[0]:
                    best = (score, full, core)
            score, full, core = best
            if score >= THRESHOLD and core >= CORE_THRESHOLD:
                hits.append({"list": list_name, "matched_entry": orig, "score": score,
                             "name_score": full, "core_score": core,
                             "confidence": confidence_tier(core)})
    best = {}
    for h in hits:
        key = (h["list"], h["matched_entry"])
        if key not in best or h["score"] > best[key]["score"]:
            best[key] = h
    return sorted(best.values(), key=lambda x: -x["score"])

def _unscreenable(name):
    # A name that carries content but collapses to fewer than 4 matchable chars
    # after normalize() (e.g. recorded only in Arabic/Cyrillic/CJK script, which
    # the Latin normaliser strips to empty) cannot be auto-screened. Returning no
    # hits would file it as "clear" — a silent sanctions false negative — so these
    # are surfaced for manual screening instead.
    return bool(name and str(name).strip()) and len(normalize(name)) < 4

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
    try:
        os.makedirs(os.path.dirname(DELTA_STATE_PATH), exist_ok=True)
        with open(DELTA_STATE_PATH, "w") as f:
            json.dump(state, f, indent=0, sort_keys=True)
        log(f"  delta state saved ({len(state)} fingerprints)")
    except Exception as e:
        log(f"  delta state save error: {e}")

def _delta_mark(state, key, today):
    """Returns (is_new, first_seen). Records `today` as first_seen for new keys."""
    first = state.get(key)
    if first:
        return False, first
    state[key] = today
    return True, today

def classify_deltas(possible_matches, adverse_findings, pep_findings, state, today):
    """Annotate every hit/finding with is_new / first_seen. Returns new-counts."""
    n_s = n_a = n_p = 0
    for m in possible_matches:
        m_new = False
        for h in m["hits"]:
            key = f"SANC|{normalize(m['name'])}|{h['list']}|{normalize(h['matched_entry'])}"
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
            sig = normalize(a.get("title", "")) or (a.get("url", "") or "")
            key = f"AM|{normalize(f['subject_name'])}|{sig}"
            is_new, first = _delta_mark(state, key, today)
            a["is_new"], a["first_seen"] = is_new, first
            if is_new: n_a += 1; f_new = True
        f["is_new"] = f_new
    for p in pep_findings:
        # Fall back to description/label when the Wikidata id is empty, so two
        # different same-named PEP subjects don't collide to one blank key.
        pid = p.get("id") or normalize(p.get("description", ""))[:48] or normalize(p.get("label", ""))
        key = f"PEP|{normalize(p['subject_name'])}|{pid}"
        is_new, first = _delta_mark(state, key, today)
        p["is_new"], p["first_seen"] = is_new, first
        if is_new: n_p += 1
    return {"sanctions": n_s, "adverse": n_a, "pep": n_p}

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
            lines += [
                f"   Action:          IMMEDIATE ESCALATION TO MLRO",
                f"                    Do not tip off customer.",
                f"                    Cabinet Resolution No. 74/2020 applies.",""
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
            lines += [
                f"   MLRO Decision:   ☐ False Positive   ☐ Escalate   ☐ Investigate",
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
                articles = search_adverse_media(subject_name)
                lines.append(format_adverse_block(subject_name, articles, subject_type))

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

— UAE Federal Decree-Law No. 26 of 2021 (AML/CFT Law)
— UAE Cabinet Resolution No. 74 of 2020 (TFS Obligations)
— UAE Federal Decree-Law No. 10 of 2025 (AML/CFT Amendments)
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
> 10 years pursuant to UAE Federal Decree-Law No. 26
> of 2021, Article 23, and Cabinet Resolution No. 74
> of 2020."""
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
  Adverse keyword set:       {ADVERSE_TERM_COUNT} red-flag terms across 18 languages ({len(ADVERSE_KEYWORDS)} EN + {len(FOREIGN_KEYWORDS)} multilingual; full set in screen.py)
  Key red flags:             {key_flags}
  Headlines per subject:     up to 5 (adverse prioritised)

RESULTS SUMMARY
  Subjects with adverse media:    {len(findings)}
  Total adverse headlines:        {total_hits}
  Clean - no adverse hits:        {max(0, stats["subjects_total"] - len(findings))}

REGULATORY BASIS
  Ongoing CDD / continuous monitoring - UAE Cabinet Decision 10/2019 Art.7;
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
Headlines filtered against a {ADVERSE_TERM_COUNT}-term multilingual (18-language)
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

> RETENTION NOTICE: Retain 10 years per UAE FDL No. 26 of 2021, Article 23."""
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
                articles = search_adverse_media(subj_name, max_results=5)
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
            "projects": [ASANA_ONGOING_MON_GID],
            "memberships": [{"project": ASANA_ONGOING_MON_GID,
                             "section": ASANA_SECTION_GID}],
        }
    }
    r = asana_request("POST", "https://app.asana.com/api/1.0/tasks", json=payload)
    if r is not None and r.status_code in (200, 201):
        log(f"OK Daily adverse media task created: {r.json()['data']['gid']}")
    else:
        log(f"FAIL task: {getattr(r,'status_code','network')} - {getattr(r,'text','')[:300]}")

# -- ASANA - POST DAILY TASK ---------------------------------------------------
def post_daily_task(narrative, run_time, run_label, n_matches):
    dt = run_time.strftime("%d %b %Y")
    flag = "⚠️" if n_matches > 0 else "✅"
    task_name = (f"🔍 {flag} Daily Sanctions Screening — "
                 f"OFAC / UN / EU / UK / UAE EOCN — {dt} ({run_label})")
    payload = {
        "data": {
            "name": task_name,
            "notes": cap_notes(narrative),
            "due_on": run_time.strftime("%Y-%m-%d"),
            "assignee": ASANA_ASSIGNEE_GID,
            "projects": [ASANA_ONGOING_MON_GID],
            "memberships": [{"project": ASANA_ONGOING_MON_GID,
                             "section": ASANA_SECTION_GID}],
        }
    }
    r = asana_request("POST", "https://app.asana.com/api/1.0/tasks", json=payload)
    if r is not None and r.status_code in (200,201):
        log(f"✅ Daily task created: {r.json()['data']['gid']}")
    else:
        log(f"❌ Task failed: {getattr(r,'status_code','network')} — {getattr(r,'text','')[:300]}")

def post_confirmed_hit_comment(customer_gid, hits, run_time):
    dt = run_time.strftime("%d %b %Y %H:%M GST")
    lines = [f"🚨 SANCTIONS MATCH — {dt}",
             "MLRO review required immediately.",
             "Do NOT tip off customer. CR 74/2020 applies.\n"]
    for h in hits:
        lines += [f"List:    {h.get('list','?')}",
                  f"Matched: {h.get('matched_entry','?')}",
                  f"Score:   {_pct(h.get('score',0))}\n"]
    r = asana_request("POST", f"https://app.asana.com/api/1.0/tasks/{customer_gid}/stories",
                      json={"data": {"text": "\n".join(lines)}})
    if r is not None and r.status_code in (200,201):
        log(f"✅ Comment on {customer_gid}")

# ── UNIFIED DAILY REPORT (Sanctions + Adverse Media + PEP, ONE narrative) ─────
def load_all_lists():
    ofac_data = download("https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.csv","OFAC SDN")
    un_data   = download("https://scsanctions.un.org/resources/xml/en/consolidated.xml","UN Consolidated")
    uk_data   = download("https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv","UK OFSI")
    eu_data   = download("https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv","EU FSF")
    ofac_names, ofac_date, ofac_hash = parse_ofac(ofac_data)
    un_names,   un_date,   un_hash   = parse_un(un_data)
    uk_names,   uk_date,   uk_hash   = parse_uk(uk_data)
    eu_names,   eu_date,   eu_hash   = parse_eu(eu_data)
    eocn_names, eocn_date, eocn_hash = parse_eocn(EOCN_PDF_PATH)
    list_meta = {
        "ofac": {"count":len(ofac_names),"date":ofac_date,"hash":ofac_hash,"tier":"core"},
        "un":   {"count":len(un_names),"date":un_date,"hash":un_hash,"tier":"core"},
        "uk":   {"count":len(uk_names),"date":uk_date,"hash":uk_hash,"tier":"core"},
        "eu":   {"count":len(eu_names),"date":eu_date,"hash":eu_hash,"tier":"core"},
        "eocn": {"count":len(eocn_names),"date":eocn_date,"hash":eocn_hash,"tier":"core"},
    }
    # Fail-safe: if EVERY core sanctions list failed to load, screening would clear
    # every customer for sanctions and post a green ✅. Abort instead — a total
    # list-fetch failure must never masquerade as "all clear".
    if sum(list_meta[k]["count"] for k in ("ofac","un","uk","eu","eocn")) == 0:
        raise RuntimeError(
            "FATAL: no core sanctions list could be loaded (OFAC/UN/UK/EU/EOCN all empty) "
            "— refusing to screen or post an all-clear.")
    all_lists = {
        "OFAC SDN":        [(normalize(n),n) for n in ofac_names],
        "UN Consolidated": [(normalize(n),n) for n in un_names],
        "UK OFSI":         [(normalize(n),n) for n in uk_names],
        "EU FSF":          [(normalize(n),n) for n in eu_names],
        "UAE EOCN":        [(normalize(n),n) for n in eocn_names],
    }
    # ── Supplementary lists (best-effort): broaden coverage when reachable, but a
    # fetch miss is reported as "not reached", NOT as a degraded core control. ──
    ca_data = download("https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml","Canada SEMA")
    ca_names, ca_date, ca_hash = parse_canada(ca_data)
    list_meta["canada"] = {"count":len(ca_names),"date":ca_date,"hash":ca_hash,"tier":"supplementary"}
    if ca_names:
        all_lists["Canada (SEMA)"] = [(normalize(n),n) for n in ca_names]
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
    pep_degraded = stats.get("pep_errors", 0) > 0 and not pep_findings
    sanc_ok = any(list_meta.get(k, {}).get("count", 0) > 0 for k in ("ofac","un","uk","eu"))
    L = []; A = L.append

    delta = stats.get("delta", {})
    supp = {k: v for k, v in list_meta.items() if v.get("tier") == "supplementary"}
    supp_ok = [k for k, v in supp.items() if v.get("count", 0) > 0]
    sanc_status = "OK" if sanc_ok else "DEGRADED"
    pep_status = "DEGRADED" if pep_degraded else "OK"

    # ── Compact header — three result blocks (Sanctions · Adverse media · PEP)
    #    lead the report; everything here is a one-line snapshot. ──
    A(f"🛡️  DAILY SCREENING — {dt}")
    A(f"Subjects: {stats['subjects_total']}  ({stats['companies_screened']} companies + "
      f"{stats['individuals_screened']} owners / directors / UBOs)  ·  delivered by 09:00 UAE")
    A(f"Modules:  Sanctions {sanc_status}  ·  Adverse media OK  ·  PEP {pep_status}")
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
        A("   Lists screened:")
        A(_list_status_line(list_meta, "ofac", "OFAC SDN"))
        A(_list_status_line(list_meta, "un",   "UN Consolidated"))
        A(_list_status_line(list_meta, "eu",   "EU FSF"))
        A(_list_status_line(list_meta, "uk",   "UK OFSI"))
        A(_list_status_line(list_meta, "eocn", "UAE EOCN"))
        if supp:
            A("   Supplementary lists (best-effort — never affect core coverage):")
            for k in supp:
                m_ = supp[k]
                label = {"canada": "Canada (SEMA)"}.get(k, k)
                if m_.get("count", 0) > 0:
                    A(f"      {label}: screened  ({m_['count']:,} names · {m_.get('date','?')})")
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
                    A(f"       ⚠ input flagged (possible prompt-injection) — classified deterministically, model not used")
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
        A(f"   Source: Google News RSS ({ADVERSE_LOCALES}/{len(GNEWS_LOCALES)} worldwide locales) + GDELT global index (100+ languages) · {len(ADVERSE_KEYWORDS)} EN + {len(FOREIGN_KEYWORDS)} multilingual (18-language) red-flag terms · duplicate stories merged · raw headlines, MLRO decides.")
    A("")

    A("━" * 70)
    A("③  PEP  (POLITICALLY EXPOSED PERSONS)")
    A("━" * 70)
    A("   Source: Wikidata (free) — politicians, ministers, MPs, judges, military / SOE chiefs,")
    A("           state-owned-enterprise heads + their relatives & close associates (RCA).")
    A(f"   Scope:  {stats['individuals_screened']} individuals auto-screened across the full database "
      f"(companies are not natural persons → not PEP-screened, but ARE sanctions + adverse-media screened).")
    A("   Action class (R.12): PEP status is PERMISSIBLE WITH CONTROLS — a confirmed PEP/RCA")
    A("   requires EDD, senior-management approval, source-of-funds/wealth establishment and")
    A("   enhanced ongoing monitoring; it is not, by itself, grounds to decline.")
    if pep_degraded:
        A(f"   Status: DEGRADED this run ({stats.get('pep_errors',0)} lookups failed) — treat 'no PEP' as provisional; re-run.")
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
                A(f"   Source: https://www.wikidata.org/wiki/{p['id']}")
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
    A(f"Engine: screen.py · one pass: name-match vs live designation lists, Google News adverse")
    A(f"media, Wikidata PEP, AI risk-rating & triage · {github_run_url()}")
    A("> " + ai.governance_footer())
    A("> Decision-support only; a 'no match' is never a clearance when a module is degraded (shown, never hidden).")
    A("> Detection is automatic; no freeze / decline / report before MLRO + four-eyes review.")
    A("> RETENTION: retain 10 years — UAE FDL No. 26 of 2021, Art. 23; Cabinet Decision 74/2020.")
    return "\n".join(L)

def post_unified_task(narrative, run_time, possible_matches, adverse_findings, pep_findings, mode="daily"):
    dt = run_time.strftime("%d %b %Y")
    n_s, n_a, n_p = len(possible_matches), len(adverse_findings), len(pep_findings)
    flag = "⚠️" if (n_s + n_a + n_p) > 0 else "✅"
    if mode == "onboarding":
        task_name = f"🆕 {flag} Onboarding Screening — Sanctions {n_s} · Adverse {n_a} · PEP {n_p} — {dt}"
    else:
        task_name = f"🛡️ {flag} Daily Screening — Sanctions {n_s} · Adverse {n_a} · PEP {n_p} — {dt}"
    payload = {"data": {
        "name": task_name[:250],
        "notes": cap_notes(narrative),
        "due_on": run_time.strftime("%Y-%m-%d"),
        "assignee": ASANA_ASSIGNEE_GID,
        "projects": [ASANA_ONGOING_MON_GID],
        "memberships": [{"project": ASANA_ONGOING_MON_GID, "section": ASANA_SECTION_GID}],
    }}
    r = asana_request("POST", "https://app.asana.com/api/1.0/tasks", json=payload)
    if r is not None and r.status_code in (200, 201):
        gid = r.json()["data"]["gid"]
        log(f"OK Unified daily task created: {gid}")
        return gid
    log(f"FAIL unified task: {getattr(r,'status_code','network')} - {getattr(r,'text','')[:300]}")
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

def open_mlro_cases(parent_gid, possible_matches, adverse_findings, pep_findings, run_time):
    """Create an assigned subtask for each NEW item (sanctions, PEP, adverse),
    capped at CASE_SUBTASK_CAP; any overflow is logged, never silently dropped."""
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
        notes = [f"Subject: {p['subject_name']}" + (f"  (owner/director — {p['parent']})" if p.get("parent") else ""),
                 f"Wikidata: https://www.wikidata.org/wiki/{p.get('id','')}",
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

    queue.sort(key=lambda x: x[0])  # sanctions first, then PEP, then adverse
    created = 0
    for _, nm, notes in queue[:CASE_SUBTASK_CAP]:
        if create_case_subtask(parent_gid, nm, notes, due_on):
            created += 1
    if len(queue) > CASE_SUBTASK_CAP:
        log(f"  case cap: created {created}, {len(queue) - CASE_SUBTASK_CAP} additional NEW item(s) "
            f"not turned into subtasks (see report body)")
    else:
        log(f"  MLRO cases created: {created}")
    return created

def screen_subject_set(customers, all_lists, list_meta, run_time, mode="daily"):
    """Shared core: sanctions + adverse media + PEP over a set of customers, with
    delta classification, one Asana report and MLRO case subtasks. mode controls
    the task title only ('daily' vs 'onboarding')."""
    _t_start = time.time()
    # SOURCE-COVERAGE DRIFT (R-09): a list that silently shrank is the most
    # dangerous failure mode — it creates false negatives. Check before screening.
    coverage_result = monitoring.check_source_coverage(
        list_meta, run_time.strftime("%Y-%m-%d"))
    for a in coverage_result.get("alarms", []):
        log(f"COVERAGE ALARM: {a}")

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
    adverse_findings, pep_findings = [], []
    companies = individuals = am_errors = pep_errors = 0
    subjects_all = []
    for c in customers:
        subjects_all.append(("COMPANY", c["name"], None, c))
        for ind in c.get("individuals", []):
            subjects_all.append(("INDIVIDUAL", ind, c["name"], c))

    def _enrich(subj):
        subj_type, subj_name, parent, c = subj
        r = {"type": subj_type, "name": subj_name, "parent": parent,
             "permalink": c.get("permalink", ""), "adverse": None, "pep": None, "am_error": False}
        try:
            articles = search_adverse_media(subj_name, max_results=5)
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
    with concurrent.futures.ThreadPoolExecutor(max_workers=SCREEN_CONCURRENCY) as ex:
        for r in ex.map(_enrich, subjects_all):
            done += 1
            if r["am_error"]:
                am_errors += 1
            else:
                if r["type"] == "COMPANY": companies += 1
                else: individuals += 1
                if r["adverse"]:
                    adverse_findings.append({"subject_type": r["type"], "subject_name": r["name"],
                        "parent": r["parent"], "permalink": r["permalink"], "articles": r["adverse"]})
            p = r.get("pep")
            if r["type"] == "INDIVIDUAL" and p is not None:
                if p.get("errored"):
                    pep_errors += 1
                elif p.get("hit"):
                    pep_findings.append({"subject_name": r["name"], "parent": r["parent"],
                        "permalink": r["permalink"], "id": p.get("id", ""),
                        "category": p.get("category", ""),
                        "label": p.get("label", ""), "description": p.get("description", "")})
            if done % 50 == 0 or done == total:
                log(f"  enriched {done}/{total}")
    _t_enrich = time.time()

    # DELTA — flag only what is new since the last run (state committed by workflow)
    today = run_time.strftime("%Y-%m-%d")
    state = load_delta_state()
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
    log(f"AI: risk-rated {len(possible_matches)} flagged · {len(related)} related-party cluster(s) · "
        f"mode={'LLM' if ai.llm_available() else 'deterministic'}")

    _t_ai = time.time()
    # ── OPERATIONAL MONITORING (latency · usage · anomaly) ──
    subjects_total = companies + individuals
    errors_total = am_errors + pep_errors

    # Evidence log (committed to git) + repeat-pattern signal: the same entity
    # flagged in ≥3 distinct stories inside 90 days is a PATTERN, not a headline.
    repeat_patterns = {}
    try:
        repeat_patterns = update_adverse_evidence(adverse_findings, run_time.strftime("%Y-%m-%d"))
        for s_, n_ in sorted(repeat_patterns.items()):
            log(f"REPEAT ADVERSE PATTERN: {s_} — {n_} distinct stories in {REPEAT_WINDOW_DAYS}d — escalate to MLRO")
    except Exception as e:
        log(f"evidence log skipped ({e})")
    timings = {"sanctions": round(_t_sanctions - _t_start, 2),
               "enrichment": round(_t_enrich - _t_sanctions, 2),
               "ai_triage": round(_t_ai - _t_enrich, 2),
               "total": round(_t_ai - _t_start, 2)}
    run_monitor = monitoring.monitor_run(
        run_time.strftime("%Y-%m-%d"),
        counts={"subjects": subjects_total, "errors": errors_total,
                "am_errors": am_errors,
                "flagged": len(possible_matches), "adverse": len(adverse_findings),
                "pep": len(pep_findings)},
        timings=timings, llm_calls=dict(ai.LLM_CALLS))
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
             "adverse_repeat": repeat_patterns,
             "related_parties": related, "injection_blocked": injection_blocked,
             "monitoring": run_monitor, "coverage": coverage_result,
             "txn_status": txn_status, "cdd_gaps_total": cdd_gaps_total,
             "arrangements": arrangements,
             "ai_mode": "AI-assisted triage" if ai.llm_available() else "deterministic"}

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
    # MLRO case subtasks for the NEW items only (keeps the case list actionable)
    open_mlro_cases(parent_gid, possible_matches, adverse_findings, pep_findings, run_time)
    # Persist the delta-state ONLY once the report was delivered. If the post
    # failed (parent_gid is None), keep the prior state so today's new matches are
    # flagged new again on the next run instead of being silently suppressed.
    if parent_gid:
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
    ofac_data = download("https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.csv","OFAC SDN")
    un_data   = download("https://scsanctions.un.org/resources/xml/en/consolidated.xml","UN Consolidated")
    uk_data   = download("https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv","UK OFSI")
    eu_data   = download("https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv","EU FSF")

    ofac_names, ofac_date, ofac_hash = parse_ofac(ofac_data)
    un_names,   un_date,   un_hash   = parse_un(un_data)
    uk_names,   uk_date,   uk_hash   = parse_uk(uk_data)
    eu_names,   eu_date,   eu_hash   = parse_eu(eu_data)
    eocn_names, eocn_date, eocn_hash = parse_eocn(EOCN_PDF_PATH)

    list_meta = {
        "ofac":  {"count":len(ofac_names),  "date":ofac_date,  "hash":ofac_hash},
        "un":    {"count":len(un_names),    "date":un_date,    "hash":un_hash},
        "uk":    {"count":len(uk_names),    "date":uk_date,    "hash":uk_hash},
        "eu":    {"count":len(eu_names),    "date":eu_date,    "hash":eu_hash},
        "eocn":  {"count":len(eocn_names),  "date":eocn_date,  "hash":eocn_hash},
    }

    all_lists = {
        "OFAC SDN":        [(normalize(n),n) for n in ofac_names],
        "UN Consolidated": [(normalize(n),n) for n in un_names],
        "UK OFSI":         [(normalize(n),n) for n in uk_names],
        "EU FSF":          [(normalize(n),n) for n in eu_names],
        "UAE EOCN":        [(normalize(n),n) for n in eocn_names],
    }

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

if __name__ == "__main__":
    main()
