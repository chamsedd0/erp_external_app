"""
Full test suite for Shadow Portal ERP backend.
Tests all endpoints across all registered tenants.
"""
import urllib.request, json, ssl, sys
from datetime import date, timedelta

BASE = "https://erp-external-app.vercel.app"
ADMIN_SECRET = "lkenflkegnelkngwjrkhvjhu9987hhhj"
ctx = ssl._create_unverified_context()

PASS = 0
FAIL = 0
SKIP = 0

def req(method, path, body=None, token=None, label=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, context=ctx, timeout=30)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())
    except Exception as ex:
        return 0, {"error": str(ex)}

def check(label, status, body, expect_key=None, expect_status=200):
    global PASS, FAIL
    ok = status == expect_status
    if ok and expect_key:
        ok = expect_key in body
    if ok:
        PASS += 1
        print(f"  [PASS] {label}")
    else:
        FAIL += 1
        snippet = str(body)[:120]
        print(f"  [FAIL] {label}  HTTP={status}  {snippet}")
    return ok, body

def check_soft(label, status, body, expect_key=None):
    """Like check() but treats 'available: false' as a SKIP, not FAIL."""
    global PASS, FAIL, SKIP
    if status == 200 and isinstance(body, dict) and body.get("available") is False:
        SKIP += 1
        print(f"  [SKIP] {label}  (module not available on this Odoo instance)")
        return True, body
    return check(label, status, body, expect_key)

def section(title):
    print(f"\n--- {title} ---")

def run_tenant(slug, emp_barcode, emp_pin, emp_id, project_id, leave_type_id, product_id):
    print(f"\n{'='*60}")
    print(f"TENANT: {slug}")
    print(f"{'='*60}")

    # ── AUTH ──────────────────────────────────────────────────────
    section("Authentication")
    status, body = req("POST", "/auth/login", {
        "tenant_slug": slug,
        "employee_id": str(emp_barcode),
        "pin": str(emp_pin)
    })
    ok, body = check("POST /auth/login", status, body, "token")
    if not ok:
        print(f"  Skipping remaining tests for {slug} — cannot authenticate")
        return
    token = body["token"]
    actual_emp_id = body.get("employee", {}).get("id", emp_id)
    print(f"         Employee: {body.get('employee', {}).get('name')}  ID={actual_emp_id}")

    # ── TIME-OFF ──────────────────────────────────────────────────
    section("Time-Off")
    status, body = req("GET", f"/time-off?employee_id={actual_emp_id}", token=token)
    check_soft("GET /time-off", status, body, "leaves")

    status, body = req("GET", "/time-off/types", token=token)
    check("GET /time-off/types", status, body, "types")

    status, body = req("GET", f"/time-off/pending?employee_id={actual_emp_id}", token=token)
    check("GET /time-off/pending", status, body, "leaves")

    today = date.today().isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()
    if leave_type_id:
        status, body = req("POST", "/time-off", {
            "employee_id": actual_emp_id,
            "leave_type_id": leave_type_id,
            "date_from": f"{today}T08:00:00",
            "date_to": f"{next_week}T17:00:00",
            "name": "Test leave from automated test suite"
        }, token=token)
        check("POST /time-off", status, body, "id")

    # ── EXPENSES ──────────────────────────────────────────────────
    section("Expenses")
    status, body = req("GET", f"/expenses?employee_id={actual_emp_id}", token=token)
    check("GET /expenses", status, body, "expenses")

    status, body = req("GET", f"/expenses/pending?employee_id={actual_emp_id}", token=token)
    check("GET /expenses/pending", status, body, "expenses")

    status, body = req("GET", "/expenses/taxes", token=token)
    check("GET /expenses/taxes", status, body, "taxes")

    status, body = req("GET", "/expenses/products", token=token)
    check("GET /expenses/products", status, body, "products")
    # Use first real product if none provided
    eff_product_id = product_id
    if not eff_product_id and isinstance(body.get("products"), list) and body["products"]:
        eff_product_id = body["products"][0]["id"]

    if eff_product_id:
        status, body = req("POST", "/expenses", {
            "employee_id": actual_emp_id,
            "product_id": eff_product_id,
            "name": "Test expense from automated test suite",
            "unit_amount": 50.0,
            "quantity": 1,
            "date": today,
            "payment_mode": "own_account"
        }, token=token)
        check("POST /expenses", status, body, "id")

    # ── ATTENDANCE ────────────────────────────────────────────────
    section("Attendance")
    status, body = req("GET", f"/attendance?employee_id={actual_emp_id}", token=token)
    check("GET /attendance", status, body, "records")

    status, body = req("GET", f"/attendance/overtime?employee_id={actual_emp_id}", token=token)
    check_soft("GET /attendance/overtime", status, body)

    status, body = req("POST", "/attendance/correction", {
        "employee_id": actual_emp_id,
        "check_in": f"{today}T09:00:00",
        "check_out": f"{today}T17:00:00",
        "reason": "Test correction from automated suite"
    }, token=token)
    check("POST /attendance/correction", status, body, "id")

    status, body = req("POST", "/attendance/overtime", {
        "employee_id": actual_emp_id,
        "date": today,
        "duration": 2.0,
        "reason": "Test overtime from automated suite"
    }, token=token)
    check_soft("POST /attendance/overtime", status, body)

    if leave_type_id:
        status, body = req("POST", "/attendance/justification", {
            "employee_id": actual_emp_id,
            "leave_type_id": leave_type_id,
            "date_from": f"{today}T08:00:00",
            "date_to": f"{today}T17:00:00",
            "justification": "Test absence justification from automated suite"
        }, token=token)
        check("POST /attendance/justification", status, body, "id")

    # ── HELPDESK ──────────────────────────────────────────────────
    section("Helpdesk")
    status, body = req("GET", "/helpdesk/ticket-types", token=token)
    check_soft("GET /helpdesk/ticket-types", status, body)

    status, body = req("GET", "/helpdesk/tags", token=token)
    check_soft("GET /helpdesk/tags", status, body)

    status, body = req("GET", "/helpdesk/agents", token=token)
    check_soft("GET /helpdesk/agents", status, body)

    status, body = req("GET", "/helpdesk/teams", token=token)
    check_soft("GET /helpdesk/teams", status, body)

    status, body = req("GET", f"/helpdesk?employee_id={actual_emp_id}", token=token)
    check_soft("GET /helpdesk", status, body)

    status, body = req("POST", "/helpdesk", {
        "employee_id": actual_emp_id,
        "name": "Test ticket from automated test suite",
        "description": "This is a test ticket created by the automated test suite"
    }, token=token)
    check_soft("POST /helpdesk", status, body)

    # ── MAINTENANCE ───────────────────────────────────────────────
    section("Maintenance")
    status, body = req("GET", "/maintenance/equipment", token=token)
    check_soft("GET /maintenance/equipment", status, body)

    status, body = req("GET", "/maintenance/teams", token=token)
    check_soft("GET /maintenance/teams", status, body)

    status, body = req("GET", "/maintenance/categories", token=token)
    check_soft("GET /maintenance/categories", status, body)

    status, body = req("GET", f"/maintenance?employee_id={actual_emp_id}", token=token)
    check_soft("GET /maintenance", status, body)

    status, body = req("POST", "/maintenance", {
        "employee_id": actual_emp_id,
        "name": "Test maintenance request from automated suite",
        "description": "Test description",
        "maintenance_type": "corrective"
    }, token=token)
    check_soft("POST /maintenance", status, body)

    # ── TIMESHEET ─────────────────────────────────────────────────
    section("Timesheet")
    status, body = req("GET", f"/timesheet?employee_id={actual_emp_id}", token=token)
    check("GET /timesheet", status, body, "entries")

    status, body = req("GET", "/timesheet/projects", token=token)
    check("GET /timesheet/projects", status, body, "projects")
    # Get real project if none provided
    eff_project_id = project_id
    if not eff_project_id and isinstance(body.get("projects"), list) and body["projects"]:
        eff_project_id = body["projects"][0]["id"]

    if eff_project_id:
        status, body = req("GET", f"/timesheet/tasks?project_id={eff_project_id}", token=token)
        check("GET /timesheet/tasks", status, body, "tasks")

        status, body = req("POST", "/timesheet", {
            "employee_id": actual_emp_id,
            "project_id": eff_project_id,
            "date": today,
            "unit_amount": 1.5,
            "name": "Test timesheet entry from automated suite"
        }, token=token)
        check("POST /timesheet", status, body, "id")

    # ── NOTIFICATIONS ─────────────────────────────────────────────
    section("Notifications")
    status, body = req("GET", "/notifications", token=token)
    check("GET /notifications", status, body, "notifications")


# ── Tenant configs ────────────────────────────────────────────────────────────
tenants = [
    {
        "slug": "isec-v17",
        "emp_barcode": "45164705", "emp_pin": "4248", "emp_id": 2697,
        "project_id": 402, "leave_type_id": 1, "product_id": 205141,
    },
    {
        "slug": "zahr-v15",
        "emp_barcode": "18200001", "emp_pin": "1111", "emp_id": 182,
        "project_id": None, "leave_type_id": None, "product_id": None,
    },
    {
        "slug": "lavendary-v18",
        "emp_barcode": "78800001", "emp_pin": "4444", "emp_id": 788,
        "project_id": None, "leave_type_id": None, "product_id": None,
    },
    {
        "slug": "technostream-v16",
        "emp_barcode": None, "emp_pin": None, "emp_id": None,
        "project_id": None, "leave_type_id": None, "product_id": None,
    },
]

target = sys.argv[1] if len(sys.argv) > 1 else None

for t in tenants:
    if target and t["slug"] != target:
        continue
    if not t["emp_barcode"]:
        print(f"\n[SKIP] {t['slug']} — no barcode configured")
        continue
    run_tenant(
        t["slug"], t["emp_barcode"], t["emp_pin"], t["emp_id"],
        t["project_id"], t["leave_type_id"], t["product_id"]
    )

print(f"\n{'='*60}")
print(f"RESULTS: {PASS} PASS  {FAIL} FAIL  {SKIP} SKIP")
print(f"{'='*60}")
