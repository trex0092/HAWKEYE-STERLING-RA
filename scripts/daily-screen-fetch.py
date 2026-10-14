#!/usr/bin/env python3
"""
Manual sanctions screen — STEP 4: fetch BOTH approved Asana screening projects.

Extracted verbatim from .github/workflows/daily-sanctions-screen.yml, where it
lived as an inline `python3 << PYEOF` heredoc. Inside YAML it was invisible to
`python -m py_compile`, unreachable by any test, and unlintable by semgrep (which
scans .py files, not YAML strings) — roughly 840 lines of the daily screening
path with none of the guards the rest of the engine gets. Behaviour is unchanged.

Reads:  ASANA_PAT, CUSTOMER_DB_GID, EMPLOYEE_DB_GID (step env)
Writes: /tmp/customers.json — customer entities, principals/UBOs and employees
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


# This workflow is manual-only, but must not create a customer-only sanctions
# all-clear. The approved screening population is BOTH source projects.
APPROVED_CUSTOMER_PROJECT = "1214107620220121"
APPROVED_EMPLOYEE_PROJECT = "1216239131596624"
ASANA_PAGE_LIMIT = 500

def fetch_source_tasks(token, project_gid, label, request=None):
    """Read EVERY Asana task (including completed employee training records).
    
    All page identities and offsets are verified before returning a population.
    No remote error bodies, customer names, tokens or records enter public logs.
    """
    if not token or project_gid not in (APPROVED_CUSTOMER_PROJECT, APPROVED_EMPLOYEE_PROJECT):
        raise RuntimeError("FATAL: mandatory Asana screening source is not approved")
    get = requests.get if request is None else request
    rows, seen_ids, seen_offsets = [], set(), set()
    offset = None
    for page_no in range(ASANA_PAGE_LIMIT):
        params = {"project": project_gid,
                  "opt_fields": "name,gid,permalink_url,notes,completed",
                  "limit": 100}
        if offset:
            params["offset"] = offset
        try:
            reply = get("https://app.asana.com/api/1.0/tasks",
                        headers={"Authorization": "Bearer " + token},
                        params=params, timeout=30)
        except Exception:
            raise RuntimeError("FATAL: Asana " + label +
                               " transport failed; source coverage unverified") from None
        if not getattr(reply, "ok", False):
            status = getattr(reply, "status_code", "unknown")
            raise RuntimeError("FATAL: Asana " + label +
                               " HTTP " + str(status) + "; source coverage unverified")
        try:
            data = reply.json()
        except Exception:
            raise RuntimeError("FATAL: Asana " + label +
                               " supplied invalid JSON; source coverage unverified") from None
        if not isinstance(data, dict) or not isinstance(data.get("data"), list):
            raise RuntimeError("FATAL: Asana " + label +
                               " returned a malformed page; refusing partial screening")
        page = data["data"]
        if page_no and not page:
            raise RuntimeError("FATAL: Asana " + label +
                               " returned an empty continuation page")
        for task in page:
            gid = str(task.get("gid", "")) if isinstance(task, dict) else ""
            name = task.get("name") if isinstance(task, dict) else None
            if not gid.isdigit() or not isinstance(name, str) or not name.strip():
                raise RuntimeError("FATAL: Asana " + label +
                                   " has an unidentifiable record; human review required")
            if gid in seen_ids:
                raise RuntimeError("FATAL: Asana " + label +
                                   " repeated a task identity; coverage is unverified")
            seen_ids.add(gid)
            rows.append(task)
        next_page = data.get("next_page")
        if next_page is None:
            return rows
        if not isinstance(next_page, dict):
            raise RuntimeError("FATAL: Asana " + label +
                               " returned malformed pagination")
        next_offset = next_page.get("offset")
        if not isinstance(next_offset, str) or not next_offset or next_offset in seen_offsets:
            raise RuntimeError("FATAL: Asana " + label +
                               " returned a repeated or missing continuation cursor")
        seen_offsets.add(next_offset)
        offset = next_offset
    raise RuntimeError("FATAL: Asana " + label +
                       " pagination exceeded the safety cap; refusing partial screening")

def compile_screening_subjects(customer_rows, employee_rows):
    """Project task GIDs remain attached to all entity, principal and staff rows."""
    if not isinstance(customer_rows, list) or not customer_rows:
        raise RuntimeError("FATAL: Customer Database has no verified screening records")
    if not isinstance(employee_rows, list) or not employee_rows:
        raise RuntimeError("FATAL: HR Employees has no verified screening records")
    subjects = []
    for task in customer_rows:
        name = task["name"].strip()
        subjects.append({
            "name": name, "gid": task["gid"],
            "url": task.get("permalink_url", ""),
            "kind": "entity", "parent": ""
        })
        for person in extract_principals(task.get("notes", "")):
            subjects.append({
                "name": person["name"], "gid": task["gid"],
                "url": task.get("permalink_url", ""),
                "kind": "individual", "parent": name,
                "role": person.get("role", ""),
                "nationality": person.get("nationality", "")
            })
    for task in employee_rows:
        # Completed = training/workshop task complete; not employee offboarding.
        # Every HR task is an individual, not a corporate customer.
        notes = str(task.get("notes") or "")
        match = re.search(r"(?im)^\s*Nationality\s*:\s*([^\n]+)", notes)
        subjects.append({
            "name": task["name"].strip(), "gid": task["gid"],
            "url": task.get("permalink_url", ""),
            "kind": "individual", "parent": "", "role": "Employee",
            "nationality": match.group(1).strip() if match else ""
        })
    return subjects

def main():
    token = os.environ.get("ASANA_PAT", "")
    customer = os.environ.get("CUSTOMER_DB_GID", "")
    employee = os.environ.get("EMPLOYEE_DB_GID", "")
    # Refuse a redirected or omitted source BEFORE any remote API request.
    if customer != APPROVED_CUSTOMER_PROJECT or employee != APPROVED_EMPLOYEE_PROJECT:
        raise SystemExit("FATAL: both approved Customer Database and HR Employees Asana source projects are mandatory")
    if not token:
        raise SystemExit("FATAL: Asana token missing; source coverage unverified")
    try:
        customer_rows = fetch_source_tasks(token, customer, "Customer Database")
        employee_rows = fetch_source_tasks(token, employee, "HR Employees")
        subjects = compile_screening_subjects(customer_rows, employee_rows)
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    with open("/tmp/customers.json", "w", encoding="utf-8") as file:
        json.dump(subjects, file, ensure_ascii=False)
    customer_subjects = len(subjects) - len(employee_rows)
    print("Screening input verified: " + str(len(customer_rows)) +
          " customer tasks / " + str(customer_subjects) +
          " customer and principal subjects + " + str(len(employee_rows)) +
          " employee tasks = " + str(len(subjects)) + " total subjects")

if __name__ == "__main__":
    main()
