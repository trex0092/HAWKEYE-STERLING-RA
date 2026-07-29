#!/usr/bin/env python3
"""
Daily sanctions screen — STEP 4: fetch the customer/principal list from Asana.

Extracted verbatim from .github/workflows/daily-sanctions-screen.yml, where it
lived as an inline `python3 << PYEOF` heredoc. Inside YAML it was invisible to
`python -m py_compile`, unreachable by any test, and unlintable by semgrep (which
scans .py files, not YAML strings) — roughly 840 lines of the daily screening
path with none of the guards the rest of the engine gets. Behaviour is unchanged.

Reads:  ASANA_PAT, CUSTOMER_DB_GID (step env)
Writes: /tmp/customers.json — the entity + principal/UBO subjects to screen
"""

import requests, json, os, re

def extract_principals(notes):
    # Pull natural-person principals (UBOs / shareholders / directors) out
    # of the CDD record's "SECTION 4 — IDENTIFICATIONS" block so each is
    # screened in their own right, not just the company name.
    if not notes: return []
    m = re.search(r'SECTION\s*4\b[^\n]*(?:IDENTIFICATION|IDENTITIES|UBO|BENEFICIAL|SHAREHOLDER|DIRECTOR)([\s\S]*?)(?=\n\s*(?:SECTION|PART)\b|$)', notes, re.I)
    if not m: return []
    block = m.group(0); people = []; seen = set()
    def push(name, role, nat):
        n = re.sub(r'\s+', ' ', (name or '')).strip()
        k = n.lower()
        if not n or k in seen: return
        if re.match(r'^(n/?a|none|nil|not applicable|pending|tbc)$', n, re.I): return
        seen.add(k); people.append({"name": n, "role": re.sub(r'\s+', ' ', (role or 'Principal')).strip(), "nationality": (nat or '').strip()})
    structured = False
    for p in re.split(r'(?=Individual\s*\d+\s*[—–\-:])', block):
        rm = re.match(r'Individual\s*\d+\s*[—–\-:]\s*([^\n]*)', p, re.I)
        nm = re.search(r'\bName\s*:\s*([^\n]+)', p, re.I)
        if rm and nm:
            structured = True
            nat = re.search(r'\bNationality\s*:\s*([^\n]+)', p, re.I)
            push(nm.group(1), rm.group(1), nat.group(1) if nat else '')
    if not structured:
        for nm in re.finditer(r'\b(?:Name|UBO|Beneficial Owner|Authori[sz]ed Signatory|Signatory|Shareholder|Director|Partner)\s*:\s*([^\n]+)', block, re.I):
            push(nm.group(1), 'Principal', '')
    return people

pat = os.environ["ASANA_PAT"]
project_gid = os.environ["CUSTOMER_DB_GID"]
headers = {"Authorization": f"Bearer {pat}"}
customers = []
url = f"https://app.asana.com/api/1.0/tasks"
params = {
    "project": project_gid,
    "opt_fields": "name,gid,permalink_url,notes",
    "limit": 100
}

while True:
    r = requests.get(url, headers=headers, params=params)
    # Fail LOUDLY on an auth/rate error. Without this, a 401 (expired
    # ASANA_PAT) / 403 / 429 returns a JSON error body that parses fine,
    # data.get("data") is [], and the run posts an all-clear for a
    # customer base it never actually read — a silent false negative.
    if not r.ok:
        raise SystemExit(f"FATAL: Asana customer fetch failed — HTTP {r.status_code}: {r.text[:300]}")
    data = r.json()
    for t in data.get("data", []):
        if t.get("name","").strip():
            cname = t["name"].strip()
            customers.append({
                "name": cname,
                "gid": t["gid"],
                "url": t.get("permalink_url",""),
                "kind": "entity",
                "parent": ""
            })
            # Screen every recorded principal / UBO / director too.
            for pr in extract_principals(t.get("notes","")):
                customers.append({
                    "name": pr["name"],
                    "gid": t["gid"],
                    "url": t.get("permalink_url",""),
                    "kind": "individual",
                    "parent": cname,
                    "role": pr.get("role",""),
                    "nationality": pr.get("nationality","")
                })
    next_page = data.get("next_page")
    if not next_page:
        break
    params["offset"] = next_page["offset"]

# An empty customer base is never a valid "all clear" — it means the
# project GID is wrong or the read was blocked. Fail rather than post a
# vacuous clean screen.
if not customers:
    raise SystemExit("FATAL: 0 customers read from the Asana Customer Database — refusing to post an all-clear. Check ASANA_CUSTOMER_DB_GID and the token's access.")

with open("/tmp/customers.json","w") as f:
    json.dump(customers, f, ensure_ascii=False)

entity_count = sum(1 for c in customers if c.get("kind") != "individual")
individual_count = len(customers) - entity_count
print(f"Fetched {entity_count} customers + {individual_count} principals/UBOs = {len(customers)} subjects to screen")
