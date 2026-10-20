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
ASANA_TASKS_URL = "https://app.asana.com/api/1.0/tasks"


def fetch_source_tasks(token, project_gid, source_name, request=None):
    """Retrieve the complete approved population. Never return partial records."""
    if project_gid not in (APPROVED_CUSTOMER_PROJECT, APPROVED_EMPLOYEE_PROJECT):
        raise RuntimeError("Asana screening project not approved")
    if request is None:
        request = requests.get
    records = []
    gids = set()
    offsets = set()
    params = {"project": project_gid, "opt_fields": "name,gid,permalink_url,notes,completed", "limit": 100}
    while True:
        response = request(ASANA_TASKS_URL,
                           headers={"Authorization": f"Bearer {token}"},
                           params=params, timeout=30)
        if not response.ok:
            raise RuntimeError(f"Asana {source_name} fetch failed - HTTP {response.status_code}")
        data = response.json()
        if not isinstance(data, dict) or not isinstance(data.get("data"), list):
            raise RuntimeError(f"Asana {source_name} malformed page")
        for task in data["data"]:
            if not isinstance(task, dict) or not str(task.get("gid") or "").strip():
                raise RuntimeError(f"Asana {source_name} unidentifiable record")
            gid = str(task["gid"])
            if gid in gids:
                raise RuntimeError(f"Asana {source_name} repeated a task identity")
            gids.add(gid)
            records.append(task)
        next_page = data.get("next_page")
        if next_page is None:
            break
        offset = next_page.get("offset") if isinstance(next_page, dict) else None
        if not offset or offset in offsets:
            raise RuntimeError(f"Asana {source_name} repeated or missing continuation cursor")
        offsets.add(offset)
        params["offset"] = offset
    if not records:
        raise RuntimeError(f"Asana {source_name} has no verified records")
    return records


def compile_screening_subjects(customers, staff):
    """Include company principals and every employee, even completed HR tasks."""
    if not customers or not staff:
        raise RuntimeError("One screening population has no verified records")
    subjects = []
    for task in customers:
        name = str(task.get("name") or "").strip()
        if not name:
            raise RuntimeError("Unidentifiable customer name")
        subjects.append({"name": name, "gid": task["gid"],
                         "url": task.get("permalink_url", ""),
                         "kind": "entity", "parent": ""})
        for person in extract_principals(task.get("notes", "")):
            subjects.append({"name": person["name"], "gid": task["gid"],
                             "url": task.get("permalink_url", ""),
                             "kind": "individual", "parent": name,
                             "role": person.get("role", "Principal"),
                             "nationality": person.get("nationality", "")})
    for task in staff:
        name = str(task.get("name") or "").strip()
        if not name:
            raise RuntimeError("Unidentifiable employee name")
        notes = task.get("notes") or ""
        nat_match = re.search(r"\bNationality\s*:\s*([^\n]+)", notes, re.I)
        subjects.append({"name": name, "gid": task["gid"],
                         "url": task.get("permalink_url", ""),
                         "kind": "individual", "parent": "", "role": "Employee",
                         "nationality": nat_match.group(1).strip() if nat_match else ""})
    return subjects


def main():
    token = os.environ.get("ASANA_PAT", "")
    customer = os.environ.get("CUSTOMER_DB_GID", "")
    employee = os.environ.get("EMPLOYEE_DB_GID", "")
    if customer != APPROVED_CUSTOMER_PROJECT or employee != APPROVED_EMPLOYEE_PROJECT:
        raise RuntimeError("both approved Asana screening source projects are required")
    if not token:
        raise RuntimeError("Asana screening credential missing")
    customers = fetch_source_tasks(token, customer, "Customer Database")
    staff = fetch_source_tasks(token, employee, "HR Employees")
    subjects = compile_screening_subjects(customers, staff)
    with open("/tmp/customers.json", "w", encoding="utf-8") as output:
        json.dump(subjects, output, ensure_ascii=False)
    entities = sum(1 for item in subjects if item["kind"] == "entity")
    employees = sum(1 for item in subjects if item.get("role") == "Employee")
    print(f"Fetched {entities} customers, {employees} employees, "
          f"{len(subjects) - entities - employees} principals/UBOs")


if __name__ == "__main__":
    main()
