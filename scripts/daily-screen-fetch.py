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

APPROVED_CUSTOMER_PROJECT = "1214107620220121"
APPROVED_EMPLOYEE_PROJECT = "1216239131596624"

pat = os.environ["ASANA_PAT"]
customer = os.environ["CUSTOMER_DB_GID"]
employee = os.environ["EMPLOYEE_DB_GID"]
if customer != APPROVED_CUSTOMER_PROJECT or employee != APPROVED_EMPLOYEE_PROJECT:
    raise SystemExit("FATAL: screening source does not match the approved Customer Database and HR Employees projects")

headers = {"Authorization": f"Bearer {pat}"}
url = "https://app.asana.com/api/1.0/tasks"


def fetch_source_tasks(token, project_gid, source_name):
    """Retrieve every page of an approved screening population or fail closed."""
    records = []
    params = {"project": project_gid, "opt_fields": "name,gid,permalink_url,notes", "limit": 100}
    while True:
        r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=30)
        if not r.ok:
            raise SystemExit(f"FATAL: Asana {source_name} fetch failed - HTTP {r.status_code}")
        data = r.json()
        if not isinstance(data.get("data"), list):
            raise SystemExit(f"FATAL: Asana {source_name} response has no task array")
        records.extend(data["data"])
        next_page = data.get("next_page")
        if not next_page:
            break
        if not isinstance(next_page, dict) or not next_page.get("offset"):
            raise SystemExit(f"FATAL: Asana {source_name} returned invalid pagination")
        params["offset"] = next_page["offset"]
    if not records:
        raise SystemExit(f"FATAL: Asana {source_name} returned 0 tasks; refusing all-clear")
    return records


customers = []
for t in fetch_source_tasks(pat, customer, "Customer Database"):
    cname = str(t.get("name") or "").strip()
    if not cname:
        continue
    customers.append({"name": cname, "gid": t["gid"],
                      "url": t.get("permalink_url", ""), "kind": "entity", "parent": ""})
    for pr in extract_principals(t.get("notes", "")):
        customers.append({"name": pr["name"], "gid": t["gid"],
                          "url": t.get("permalink_url", ""), "kind": "individual",
                          "parent": cname, "role": pr.get("role", ""),
                          "nationality": pr.get("nationality", "")})

# The HR project's completed tasks remain in scope. Completion represents
# training status, not termination of employment.
for t in fetch_source_tasks(pat, employee, "HR Employees"):
    name = str(t.get("name") or "").strip()
    if not name:
        continue
    customers.append({"name": name, "gid": t["gid"],
                      "url": t.get("permalink_url", ""), "kind": "employee", "parent": ""})

if not any(c["kind"] == "entity" for c in customers) or not any(c["kind"] == "employee" for c in customers):
    raise SystemExit("FATAL: customer or employee screening population is empty; refusing all-clear")

with open("/tmp/customers.json","w") as f:
    json.dump(customers, f, ensure_ascii=False)

entity_count = sum(1 for c in customers if c.get("kind") != "individual")
individual_count = len(customers) - entity_count
print(f"Fetched {entity_count} customers + {individual_count} principals/UBOs = {len(customers)} subjects to screen")
