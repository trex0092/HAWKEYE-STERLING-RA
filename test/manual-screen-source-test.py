#!/usr/bin/env python3
"""Credential-free regression tests for BOTH manual sanctions-screening sources.

No real Asana requests, files or customer records. A manually dispatched job
must never omit all twenty completed HR tasks or claim customer-only coverage.
"""
import importlib.util
import os
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
MODULE = ROOT / "scripts" / "daily-screen-fetch.py"
spec = importlib.util.spec_from_file_location("manual_screen_source", MODULE)
screen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(screen)

count = [0]
failed = [0]
def check(description, condition):
    count[0] += 1
    if condition:
        print("  ok ", description)
    else:
        print("FAIL ", description)
        failed[0] += 1

class Reply:
    def __init__(self, data, status=200):
        self.data, self.status_code, self.ok = data, status, 200 <= status < 300
    def json(self):
        return self.data

customer_a = {
    "gid": "999800001", "name": "SYNTHETIC TRADING COMPANY LLC",
    "permalink_url": "https://app.asana.com/0/0/999800001",
    "completed": False, "notes":
      "SECTION 4 — IDENTIFICATIONS\nIndividual 1 — Director\n"
      "Name: Synthetic Alpha Person\nNationality: Testland\n"
      "SECTION 5 — RISK REVIEW\n",
}
customer_b = {
    "gid": "999800002", "name": "SYNTHETIC METALS LTD",
    "permalink_url": "https://app.asana.com/0/0/999800002",
    "completed": False, "notes": "",
}
employees = [
    {
      "gid": str(999900000 + i),
      "name": "Synthetic Employee " + str(i + 1),
      "notes": "Nationality: Testland\n",
      "completed": True,
    }
    for i in range(20)
]
observed = []
def ok_asana(url, *, headers, params, timeout):
    project = params["project"]
    offset = params.get("offset")
    observed.append((project, offset, timeout))
    assert timeout == 30 and headers["Authorization"] == "Bearer synthetic"
    if project == screen.APPROVED_CUSTOMER_PROJECT:
        if offset is None:
            return Reply({"data": [customer_a], "next_page": {"offset": "p2"}})
        if offset == "p2":
            return Reply({"data": [customer_b], "next_page": None})
    elif project == screen.APPROVED_EMPLOYEE_PROJECT and offset is None:
        return Reply({"data": employees, "next_page": None})
    raise AssertionError("unrecognized synthetic Asana page")

customers = screen.fetch_source_tasks(
    "synthetic", screen.APPROVED_CUSTOMER_PROJECT, "Customer Database",
    request=ok_asana
)
staff = screen.fetch_source_tasks(
    "synthetic", screen.APPROVED_EMPLOYEE_PROJECT, "HR Employees",
    request=ok_asana
)
items = screen.compile_screening_subjects(customers, staff)
check("reads EVERY page of the approved Customer Database",
      len(customers) == 2 and len(observed) == 3 and observed[1][:2] ==
      (screen.APPROVED_CUSTOMER_PROJECT, "p2"))
check("completed training records still produce all 20 employee individuals",
      len(staff) == 20 and all(x["completed"] for x in staff) and
      sum(x.get("role") == "Employee" and x.get("kind") == "individual"
          for x in items) == 20)
check("two customers + their principal + twenty employees make 23 subjects",
      len(items) == 23 and
      sum(x.get("kind") == "entity" for x in items) == 2 and
      sum(x.get("role") == "Director" for x in items) == 1)
check("manual staff task IDs are preserved for Asana matching and human review",
      {x["gid"] for x in items if x.get("role") == "Employee"} ==
      {e["gid"] for e in employees})
check("manual employee records carry nationality and no fictional parent company",
      all(x.get("nationality") == "Testland" and x.get("parent") == ""
          for x in items if x.get("role") == "Employee"))

def expect_error(label, action, message):
    raised = ""
    try:
        action()
    except (RuntimeError, SystemExit) as err:
        raised = str(err)
    check(label, message in raised)

calls = []
def forbidden(*args, **kwargs):
    calls.append("unexpected call")
    raise RuntimeError("Test must never contact Asana")

expect_error("unapproved Asana project refuses any fetch",
    lambda: screen.fetch_source_tasks("synthetic", "123456789", "Customer", forbidden),
    "not approved")
check("redirected source attempts did not contact Asana", not calls)
expect_error("customer-only manual run fails before any network activity",
    lambda: screen.main(), "both approved") if False else None
with patch.dict(os.environ, {
    "ASANA_PAT": "synthetic", "CUSTOMER_DB_GID": screen.APPROVED_CUSTOMER_PROJECT,
    "EMPLOYEE_DB_GID": ""
}):
    expect_error("missing HR project variable aborts before fetching customers",
                 screen.main, "both approved")
check("missing HR source caused zero actual network calls", not calls)

def fake_response(resp):
    return lambda *args, **kwargs: resp
expect_error("a rate-limited customer fetch cannot become a false all-clear",
    lambda: screen.fetch_source_tasks("synthetic", screen.APPROVED_CUSTOMER_PROJECT,
       "Customer Database",
       request=fake_response(Reply({"errors": [{"message": "Private synthetic identifier"}]}, 429))),
    "HTTP 429")
expect_error("malformed Asana collection never silently screens zero records",
    lambda: screen.fetch_source_tasks("synthetic", screen.APPROVED_EMPLOYEE_PROJECT,
       "HR Employees", request=fake_response(Reply({"data": None, "next_page": None}))),
    "malformed page")
expect_error("duplicate GID prevents silently double-counting employees",
    lambda: screen.fetch_source_tasks("synthetic", screen.APPROVED_EMPLOYEE_PROJECT,
       "HR Employees", request=fake_response(Reply({"data": [employees[0], employees[0]],
                                                     "next_page": None}))),
    "repeated a task identity")
expect_error("missing continuation cursor blocks an incomplete customer database",
    lambda: screen.fetch_source_tasks("synthetic", screen.APPROVED_CUSTOMER_PROJECT,
       "Customer Database",
       request=fake_response(Reply({"data": [customer_a], "next_page": {}}))),
    "repeated or missing continuation cursor")
expect_error("an unidentifiable HR record triggers human review",
    lambda: screen.fetch_source_tasks("synthetic", screen.APPROVED_EMPLOYEE_PROJECT,
       "HR Employees",
       request=fake_response(Reply({"data": [{"gid": "", "name": "Unknown Employee"}],
                                     "next_page": None}))),
    "unidentifiable record")
expect_error("zero employees is never a complete two-project screen",
    lambda: screen.compile_screening_subjects(customers, []), "no verified")

workflow = (ROOT / ".github/workflows/daily-sanctions-screen.yml").read_text()
matcher = (ROOT / "scripts/daily-screen-run.py").read_text()
report = (ROOT / "scripts/daily-screen-report.py").read_text()
ci = (ROOT / ".github/workflows/ci.yml").read_text()
check("manual-only workflow provides two exact mandatory Asana source GIDs",
      "CUSTOMER_DB_GID: " in workflow and
      "EMPLOYEE_DB_GID: " in workflow and
      screen.APPROVED_CUSTOMER_PROJECT in workflow and
      screen.APPROVED_EMPLOYEE_PROJECT in workflow)
check("both success and refusal results attest the employee population",
      matcher.count('"employee_count": sum(1 for c in customers if c.get("role") == "Employee")') == 2)
check("report fails closed if employee_count is absent or zero",
      '0 < employee_count <= individual_count' in report)
check("report names both authoritative source project IDs, not only the customer base",
      "Screening Source 1:" in report and "Screening Source 2:" in report and
      screen.APPROVED_CUSTOMER_PROJECT in report and
      screen.APPROVED_EMPLOYEE_PROJECT in report)
check("CI runs the manual two-project source regression with Python available",
      ci.index("actions/setup-python@") < ci.index("python test/manual-screen-source-test.py")
      < ci.index("python test/engine_test.py"))
print(str(count[0] - failed[0]) + " passed, " + str(failed[0]) + " failed")
if failed[0]:
    raise SystemExit(1)
