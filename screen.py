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

try:
    from rapidfuzz import fuzz
    import pdfplumber
except ImportError:
    os.system("pip install rapidfuzz pdfplumber -q")
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

THRESHOLD             = 85
EOCN_PDF_PATH         = "eocn_list.pdf"
UAE_TZ_OFFSET         = 4

ASANA_HEADERS = {
    "Authorization": f"Bearer {ASANA_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# Google News RSS — 7 locales for broader coverage
GNEWS_URLS = [
    "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q={query}&hl=en-GB&gl=GB&ceid=GB:en",
    "https://news.google.com/rss/search?q={query}&hl=en-AE&gl=AE&ceid=AE:en",
    "https://news.google.com/rss/search?q={query}&hl=tr&gl=TR&ceid=TR:tr",
    "https://news.google.com/rss/search?q={query}&hl=ar&gl=AE&ceid=AE:ar",
]

# Adverse media keywords — if headline contains any, flag it
ADVERSE_KEYWORDS = [
    "sanction", "fraud", "money launder", "aml", "corrupt", "bribe",
    "terror", "trafficking", "smuggl", "indict", "arrest", "convict",
    "prison", "jail", "investigation", "probe", "fine", "penalty",
    "seized", "frozen", "blocked", "ofac", "interpol", "wanted",
    "illicit", "illegal", "criminal", "prosecution", "defraud",
]

# ── HELPERS ───────────────────────────────────────────────────────────────────
def normalize(name):
    if not name: return ""
    name = name.upper()
    name = unicodedata.normalize("NFD", name)
    name = "".join(c for c in name if unicodedata.category(c) != "Mn")
    name = re.sub(r"[^A-Z0-9 ]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name

def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def now_uae():
    utc = datetime.datetime.utcnow()
    return utc + datetime.timedelta(hours=UAE_TZ_OFFSET)

def log(msg):
    print(f"[{datetime.datetime.utcnow().strftime('%H:%M:%S')}] {msg}", flush=True)

# ── ADVERSE MEDIA ─────────────────────────────────────────────────────────────
def search_adverse_media(name: str, max_results: int = 5) -> list:
    """
    Search Google News RSS for a name.
    Returns list of dicts: {title, source, date, url, flagged}
    flagged=True if headline contains adverse keywords.
    """
    query = requests.utils.quote(f'"{name}"')
    seen_titles = set()
    articles = []

    for url_template in GNEWS_URLS[:3]:  # limit to 3 locales to avoid rate limits
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
                flagged = any(kw in title.lower() for kw in ADVERSE_KEYWORDS)
                articles.append({
                    "title": title,
                    "source": source,
                    "date": pub_date,
                    "url": link,
                    "flagged": flagged,
                })
        except Exception:
            continue
        time.sleep(0.5)  # polite delay between locale requests

    # Sort: flagged first, then by date
    articles.sort(key=lambda x: (not x["flagged"], x.get("date", "")), reverse=False)
    return articles[:max_results]

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
            for entry in sec.findall(tag):
                parts = []
                for field in ["FIRST_NAME","SECOND_NAME","THIRD_NAME","FOURTH_NAME","NAME"]:
                    el = entry.find(field)
                    if el is not None and el.text: parts.append(el.text.strip())
                if parts: names.add(" ".join(parts))
    except Exception as e:
        log(f"  UN parse error: {e}")
    return names, date_str, sha256_of(data)

def parse_uk(data):
    names = set()
    date_str = "unknown"
    if not data: return names, date_str, ""
    try:
        lines = data.decode("utf-8-sig").splitlines()
        reader = csv.DictReader(io.StringIO("\n".join(lines[1:])))
        for row in reader:
            n6 = row.get("Name 6","").strip()
            n1 = row.get("Name 1","").strip()
            n2 = row.get("Name 2","").strip()
            n3 = row.get("Name 3","").strip()
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
            n = row.get("name","").strip()
            if n: names.add(n)
            for a in row.get("aliases","").split(";"):
                a = a.strip()
                if a: names.add(a)
    except Exception as e:
        log(f"  EU parse error: {e}")
    return names, "live", sha256_of(data)

def parse_eocn(pdf_path):
    names = set()
    if not os.path.exists(pdf_path):
        log(f"  EOCN PDF not found — manual check required")
        return names, "NOT AVAILABLE — upload eocn_list.pdf to repo root", ""
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
        "opt_fields": "gid,name,notes,permalink_url",
        "limit": 100,
    }
    while True:
        r = requests.get("https://app.asana.com/api/1.0/tasks",
                         headers=ASANA_HEADERS, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        for t in data["data"]:
            notes = t.get("notes","")
            customers.append({
                "gid": t["gid"],
                "name": t["name"],
                "permalink": t.get("permalink_url",""),
                "individuals": extract_individuals(notes),
                "has_assessment": len(notes.strip()) > 100,
            })
        next_page = data.get("next_page")
        if not next_page: break
        params["offset"] = next_page["offset"]
    log(f"Loaded {len(customers)} customers")
    return customers

# ── SCREENING ─────────────────────────────────────────────────────────────────
def screen_name(name, all_lists):
    n = normalize(name)
    if len(n) < 4: return []
    hits = []
    for list_name, entries in all_lists.items():
        for en, orig in entries:
            if len(en) < 6: continue
            score = fuzz.token_sort_ratio(n, en)
            if score >= THRESHOLD:
                hits.append({"list": list_name, "matched_entry": orig, "score": score})
    best = {}
    for h in hits:
        key = (h["list"], h["matched_entry"])
        if key not in best or h["score"] > best[key]["score"]:
            best[key] = h
    return sorted(best.values(), key=lambda x: -x["score"])

def screen_customers(customers, all_lists):
    possible_matches, clear = [], []
    for c in customers:
        hits = []
        for h in screen_name(c["name"], all_lists):
            hits.append({"subject_type":"ENTITY","subject_name":c["name"],**h})
        for ind in c["individuals"]:
            for h in screen_name(ind, all_lists):
                hits.append({"subject_type":"INDIVIDUAL","subject_name":ind,**h})
        if hits:
            possible_matches.append({**c,"hits":hits})
        else:
            clear.append(c)
    return possible_matches, clear

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
                    f"   Score:           {h['score']:.0f}%",
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
                    f"   Score:           {h['score']:.0f}%",
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
           "Uploaded PDF — eocn_list.pdf in repository root")}

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
def build_weekly_narrative(customers, results, run_time):
    dt = run_time.strftime("%d %b %Y")
    flagged = [r for r in results if r["has_adverse"]]
    clean   = [r for r in results if not r["has_adverse"]]

    if not flagged:
        flagged_text = "No adverse media identified across all 324 customers."
    else:
        lines = []
        for r in flagged:
            lines.append(f"⚠️  {r['name']}")
            for a in r["articles"]:
                flag = "🚩" if a["flagged"] else "  "
                lines.append(f"   {flag} {a['title']}")
                lines.append(f"      {a['source']} — {a['date']}")
            lines.append(f"   MLRO Decision: ☐ No action   ☐ Investigate   ☐ Escalate")
            lines.append("")
        flagged_text = "\n".join(lines)

    narrative = f"""WEEKLY ADVERSE MEDIA SCREENING — ALL CUSTOMERS
================================================

Date:             {dt}
Run:              Monday — Weekly Adverse Media Sweep
Prepared By:      Compliance Automation — Hawkeye Sterling V2
Reviewed By:      Compliance Department

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Customers Screened:    {len(customers)}
Source:                Google News RSS — 3 locales (US / GB / AE)
Coverage:              Entity name search for all customers
Adverse Keywords:      sanctions, fraud, money launder, corrupt,
                       terror, trafficking, arrest, conviction,
                       investigation, fine, OFAC, Interpol, illicit
Results shown:         Top 5 headlines per customer with adverse hit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULTS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Screened:        {len(customers)}
Adverse Media Found:   {len(flagged)}
Clean — No Hits:       {len(clean)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADVERSE MEDIA FINDINGS — MLRO REVIEW REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{flagged_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHODOLOGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Google News RSS search for each customer name (exact phrase).
Results filtered for adverse keywords. Raw headlines presented
without interpretation — all review decisions rest with MLRO.
This sweep does not replace the daily sanctions screening.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MLRO SIGN-OFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MLRO Review Completed:  ☐ Yes   ☐ No
MLRO Name:              ___________________________
Date of Review:         ___________________________
Decision:               ☐ All Clear — No Action
                        ☐ Items Escalated (see above)
                        ☐ STR / SAR Filed

> RETENTION NOTICE: Retain 10 years per UAE FDL
> No. 26 of 2021, Article 23."""
    return narrative

# ── WEEKLY ADVERSE MEDIA SWEEP ────────────────────────────────────────────────
def run_weekly_adverse(customers, run_time):
    log(f"Weekly adverse media sweep — {len(customers)} customers")
    results = []
    for i, c in enumerate(customers, 1):
        log(f"  [{i}/{len(customers)}] {c['name']}")
        articles = search_adverse_media(c["name"], max_results=5)
        adverse = [a for a in articles if a["flagged"]]
        results.append({
            "name": c["name"],
            "permalink": c["permalink"],
            "articles": adverse,  # only adverse ones
            "has_adverse": len(adverse) > 0,
        })
        time.sleep(1)  # rate limit protection

    narrative = build_weekly_narrative(customers, results, run_time)

    flagged_count = sum(1 for r in results if r["has_adverse"])
    flag = "⚠️" if flagged_count > 0 else "✅"
    dt = run_time.strftime("%d %b %Y")
    task_name = f"📰 {flag} Weekly Adverse Media Screening — All Customers — {dt}"

    payload = {
        "data": {
            "name": task_name,
            "notes": narrative,
            "due_on": run_time.strftime("%Y-%m-%d"),
            "assignee": ASANA_ASSIGNEE_GID,
            "projects": [ASANA_ONGOING_MON_GID],
            "memberships": [{"project": ASANA_ONGOING_MON_GID,
                             "section": ASANA_SECTION_GID}],
        }
    }
    r = requests.post("https://app.asana.com/api/1.0/tasks",
                      headers=ASANA_HEADERS, json=payload, timeout=30)
    if r.status_code in (200,201):
        log(f"✅ Weekly adverse media task created: {r.json()['data']['gid']}")
    else:
        log(f"❌ Task failed: {r.status_code} — {r.text[:300]}")

# ── ASANA — POST DAILY TASK ───────────────────────────────────────────────────
def post_daily_task(narrative, run_time, run_label, n_matches):
    dt = run_time.strftime("%d %b %Y")
    flag = "⚠️" if n_matches > 0 else "✅"
    task_name = (f"🔍 {flag} Daily Sanctions Screening — "
                 f"OFAC / UN / EU / UK / UAE EOCN — {dt} ({run_label})")
    payload = {
        "data": {
            "name": task_name,
            "notes": narrative,
            "due_on": run_time.strftime("%Y-%m-%d"),
            "assignee": ASANA_ASSIGNEE_GID,
            "projects": [ASANA_ONGOING_MON_GID],
            "memberships": [{"project": ASANA_ONGOING_MON_GID,
                             "section": ASANA_SECTION_GID}],
        }
    }
    r = requests.post("https://app.asana.com/api/1.0/tasks",
                      headers=ASANA_HEADERS, json=payload, timeout=30)
    if r.status_code in (200,201):
        log(f"✅ Daily task created: {r.json()['data']['gid']}")
    else:
        log(f"❌ Task failed: {r.status_code} — {r.text[:300]}")

def post_confirmed_hit_comment(customer_gid, hits, run_time):
    dt = run_time.strftime("%d %b %Y %H:%M GST")
    lines = [f"🚨 SANCTIONS MATCH — {dt}",
             "MLRO review required immediately.",
             "Do NOT tip off customer. CR 74/2020 applies.\n"]
    for h in hits:
        lines += [f"List:    {h['list']}",
                  f"Matched: {h['matched_entry']}",
                  f"Score:   {h['score']:.0f}%\n"]
    r = requests.post(
        f"https://app.asana.com/api/1.0/tasks/{customer_gid}/stories",
        headers=ASANA_HEADERS,
        json={"data": {"text": "\n".join(lines)}},
        timeout=30,
    )
    if r.status_code in (200,201):
        log(f"✅ Comment on {customer_gid}")

# ── MAIN ──────────────────────────────────────────────────────────────────────
def main():
    run_time = now_uae()
    hour_uae = run_time.hour

    if RUN_MODE == "weekly_adverse":
        run_label = "Weekly Adverse Media — Monday"
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
