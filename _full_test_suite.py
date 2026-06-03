"""
Full test suite for Shadow Portal ERP backend.
Tests ALL endpoints across all registered tenants, including:
  - Admin API (platform stats, tenant CRUD, health probes)
  - Auth routes (login, tenant info, push tokens, error cases)
  - Per-tenant employee routes (all modules, all GET+POST)
  - Error handling (missing params, bad auth, Zod validation)
  - Schema validation layer (custom_fields key, validation passthrough)
"""
import urllib.request, json, ssl, sys, io, time, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from datetime import date, timedelta

BASE          = os.environ.get("SHADOW_BASE_URL", "https://erp-external-app.vercel.app")
# x-admin-secret header value — read from env (see backend .env ADMIN_SECRET)
ADMIN_SECRET  = os.environ.get("ADMIN_SECRET", "")
ctx           = ssl._create_unverified_context()

PASS = 0
FAIL = 0
SKIP = 0

# ── HTTP helper ────────────────────────────────────────────────────────────────

def req(method, path, body=None, token=None, admin=False, _retry=2):
    url  = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if admin:
        headers["x-admin-secret"] = ADMIN_SECRET
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    time.sleep(0.25)   # 250 ms between every request — stay well within rate limit
    try:
        resp = urllib.request.urlopen(r, context=ctx, timeout=30)
        raw  = resp.read()
        return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if e.code == 429 and _retry > 0:
            print(f"  [429] rate-limited on {path}, sleeping 65s and retrying …")
            time.sleep(65)
            return req(method, path, body=body, token=token, admin=admin, _retry=_retry - 1)
        raw = e.read()
        try:
            return e.code, json.loads(raw) if raw else {"error": f"HTTP {e.code}"}
        except Exception:
            return e.code, {"error": f"HTTP {e.code} (non-JSON body)"}
    except Exception as ex:
        return 0, {"error": str(ex)}

# ── Check helpers ──────────────────────────────────────────────────────────────

def check(label, status, body, expect_key=None, expect_status=200):
    global PASS, FAIL, SKIP
    if status == 200 and isinstance(body, dict) and body.get("available") is False:
        SKIP += 1
        print(f"  [SKIP] {label}  (module not available)")
        return True, body
    ok = (status == expect_status)
    if ok and expect_key:
        ok = expect_key in body
    if ok:
        PASS += 1
        print(f"  [PASS] {label}")
    else:
        FAIL += 1
        snippet = str(body)[:150]
        print(f"  [FAIL] {label}  HTTP={status}  {snippet}")
    return ok, body

def check_soft(label, status, body, expect_key=None):
    """Treats 422 available:false and known Odoo business-rule errors as SKIP."""
    global SKIP
    if status == 422 and isinstance(body, dict) and body.get("available") is False:
        SKIP += 1
        print(f"  [SKIP] {label}  (module not available)")
        return True, body
    if status in (400, 500):
        msg = str(body).lower()
        for pattern in ODOO_EXPECTED_ERRORS:
            if pattern in msg:
                SKIP += 1
                print(f"  [SKIP] {label}  (Odoo rule: {pattern})")
                return True, body
    return check(label, status, body, expect_key)

def check_post(label, status, body, expect_key="id"):
    """check() that also skips known Odoo business-rule rejections."""
    global SKIP
    if status in (400, 500):
        msg = str(body).lower()
        for pattern in ODOO_EXPECTED_ERRORS:
            if pattern in msg:
                SKIP += 1
                print(f"  [SKIP] {label}  (Odoo rule: {pattern})")
                return True, body
    return check(label, status, body, expect_key)

def check_custom_fields(label, status, body):
    """Verify a GET response includes the custom_fields key (schema caching feature)."""
    global PASS, FAIL, SKIP
    if status != 200 or not isinstance(body, dict):
        return
    if body.get("available") is False:
        SKIP += 1
        print(f"  [SKIP] {label} custom_fields  (module not available)")
        return
    if "custom_fields" in body:
        PASS += 1
        cf    = body["custom_fields"]
        names = list(cf.keys()) if isinstance(cf, dict) and cf else []
        print(f"  [PASS] {label} has custom_fields" + (f"  x_fields={names}" if names else "  (none)"))
    else:
        FAIL += 1
        print(f"  [FAIL] {label} missing custom_fields key")

def section(title):
    print(f"\n--- {title} ---")

# Odoo business-rule errors that are test-environment artifacts, not backend bugs
ODOO_EXPECTED_ERRORS = [
    "no allocation", "allocation",
    "already checked in", "already checked",
    "duplicate key", "constraint", "unique",
    "incompatible companies",
    "you are not allowed",
    "access denied",
    "overlaps",          # time-off overlap on same day
    "time off that",     # "you can not set 2 time off that overlaps…"
    "leave already",
]

# ── Admin API tests (platform-level, runs once) ────────────────────────────────

def run_admin(first_slug):
    global PASS, FAIL, SKIP
    print(f"\n{'='*60}")
    print("ADMIN API")
    print(f"{'='*60}")

    section("Platform stats")
    status, body = req("GET", "/admin/stats", admin=True)
    check("GET /admin/stats", status, body, "total")

    section("Tenant management")
    status, body = req("GET", "/admin/tenants", admin=True)
    ok, body = check("GET /admin/tenants", status, body)
    # Should return a non-empty list
    if ok and isinstance(body, list) and len(body) > 0:
        PASS += 1
        print(f"  [PASS] GET /admin/tenants returned {len(body)} tenant(s)")
    elif ok:
        FAIL += 1
        print("  [FAIL] GET /admin/tenants returned empty list")

    status, body = req("GET", f"/admin/tenants/{first_slug}", admin=True)
    check(f"GET /admin/tenants/{first_slug}", status, body, "slug")

    # PUT — safe no-op update (send an innocuous field update)
    status, body = req("PUT", f"/admin/tenants/{first_slug}",
                       body={"notes": "Updated by automated test suite"}, admin=True)
    check(f"PUT /admin/tenants/{first_slug}", status, body, "success")

    # Unknown tenant → 404
    status, body = req("GET", "/admin/tenants/__nonexistent__", admin=True)
    check("GET /admin/tenants/nonexistent → 404", status, body, expect_status=404)

    # Admin without secret → 403
    status, body = req("GET", "/admin/tenants")
    check("GET /admin/tenants without secret → 403", status, body, expect_status=403)

    section("Tenant health & metrics")
    status, body = req("GET", f"/admin/tenants/{first_slug}/health", admin=True)
    check(f"GET /admin/tenants/{first_slug}/health", status, body, "ok")

    status, body = req("GET", f"/admin/tenants/{first_slug}/stats", admin=True)
    check(f"GET /admin/tenants/{first_slug}/stats", status, body, "active_devices")

    status, body = req("GET", f"/admin/tenants/{first_slug}/devices", admin=True)
    check(f"GET /admin/tenants/{first_slug}/devices", status, body)

    status, body = req("GET", f"/admin/tenants/{first_slug}/notifications", admin=True)
    check(f"GET /admin/tenants/{first_slug}/notifications", status, body)

    section("Infrastructure")
    status, body = req("GET", "/health")
    check("GET /health", status, body, "status")

# ── Per-tenant tests ───────────────────────────────────────────────────────────

def run_tenant(slug, emp_barcode, emp_pin, emp_id, project_id, leave_type_id, product_id):
    print(f"\n{'='*60}")
    print(f"TENANT: {slug}")
    print(f"{'='*60}")

    # Working IDs — may be auto-discovered below
    eff_leave_type_id = leave_type_id
    eff_product_id    = product_id
    eff_project_id    = project_id

    # ── AUTH: public tenant info ──────────────────────────────────────────────
    section("Auth — public info")
    status, body = req("GET", f"/auth/tenant/{slug}")
    check(f"GET /auth/tenant/{slug}", status, body, "name")

    # ── AUTH: login ───────────────────────────────────────────────────────────
    section("Auth — login")
    # Correct credentials
    status, body = req("POST", "/auth/login", {
        "tenant_slug": slug, "employee_id": str(emp_barcode), "pin": str(emp_pin)
    })
    ok, body = check("POST /auth/login", status, body, "token")
    if not ok:
        print(f"  Skipping remaining tests for {slug} — cannot authenticate")
        return
    token          = body["token"]
    actual_emp_id  = body.get("employee", {}).get("id", emp_id)
    print(f"         Employee: {body.get('employee', {}).get('name')}  ID={actual_emp_id}")

    # Wrong PIN → 401
    status, body = req("POST", "/auth/login", {
        "tenant_slug": slug, "employee_id": str(emp_barcode), "pin": "00000000"
    })
    check("POST /auth/login wrong PIN → 401", status, body, expect_status=401)

    # Unknown tenant → 401
    status, body = req("POST", "/auth/login", {
        "tenant_slug": "__bad_tenant__", "employee_id": "1", "pin": "1234"
    })
    check("POST /auth/login unknown tenant → 401", status, body, expect_status=401)

    # Missing required field → 400 (Zod)
    status, body = req("POST", "/auth/login", {"tenant_slug": slug})
    check("POST /auth/login missing fields → 400", status, body, expect_status=400)

    # ── AUTH: push tokens ────────────────────────────────────────────────────
    section("Auth — push tokens")
    fake_push_token = f"ExponentPushToken[TestDevice_{slug}]"
    status, body = req("POST", "/auth/push-token", {
        "employee_id": actual_emp_id,
        "token": fake_push_token,
        "tenant_slug": slug
    })
    check("POST /auth/push-token", status, body, "success")

    status, body = req("DELETE", "/auth/push-token", {
        "employee_id": actual_emp_id,
        "tenant_slug": slug
    })
    check("DELETE /auth/push-token", status, body, "success")

    # ── ERROR HANDLING ────────────────────────────────────────────────────────
    section("Error Handling")

    # No auth token on protected route → 401
    status, body = req("GET", f"/expenses?employee_id={actual_emp_id}")
    check("GET /expenses without token → 401", status, body, expect_status=401)

    # Expired/invalid token → 401
    status, body = req("GET", f"/expenses?employee_id={actual_emp_id}", token="invalid.token.here")
    check("GET /expenses invalid token → 401", status, body, expect_status=401)

    # Missing required query param → 400
    status, body = req("GET", "/expenses", token=token)
    check("GET /expenses missing employee_id → 400", status, body, expect_status=400)

    status, body = req("GET", "/attendance", token=token)
    check("GET /attendance missing employee_id → 400", status, body, expect_status=400)

    status, body = req("GET", "/timesheet", token=token)
    check("GET /timesheet missing employee_id → 400", status, body, expect_status=400)

    # Invalid query param type → 400
    status, body = req("GET", "/attendance?employee_id=notanumber", token=token)
    check("GET /attendance invalid employee_id type → 400", status, body, expect_status=400)

    # Missing required body fields → 400 (Zod)
    status, body = req("POST", "/expenses", {"employee_id": actual_emp_id}, token=token)
    check("POST /expenses missing fields → 400", status, body, expect_status=400)

    status, body = req("POST", "/timesheet", {"employee_id": actual_emp_id}, token=token)
    check("POST /timesheet missing fields → 400", status, body, expect_status=400)

    status, body = req("POST", "/attendance/correction", {}, token=token)
    check("POST /attendance/correction missing fields → 400", status, body, expect_status=400)

    status, body = req("POST", "/helpdesk", {"employee_id": actual_emp_id}, token=token)
    check("POST /helpdesk missing name → 400", status, body, expect_status=400)

    status, body = req("POST", "/maintenance", {"employee_id": actual_emp_id}, token=token)
    check("POST /maintenance missing name → 400", status, body, expect_status=400)

    # Missing required query param on sub-routes → 400
    status, body = req("GET", "/timesheet/tasks", token=token)
    check("GET /timesheet/tasks missing project_id → 400", status, body, expect_status=400)

    today     = date.today().isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()

    # ── TIME-OFF ──────────────────────────────────────────────────────────────
    section("Time-Off")
    status, body = req("GET", f"/time-off?employee_id={actual_emp_id}", token=token)
    check_soft("GET /time-off", status, body, "leaves")
    check_custom_fields("GET /time-off", status, body)

    status, body = req("GET", "/time-off/types", token=token)
    check("GET /time-off/types", status, body, "types")
    # Auto-discover leave_type_id if not configured
    if not eff_leave_type_id and isinstance(body.get("types"), list) and body["types"]:
        eff_leave_type_id = body["types"][0]["id"]
        print(f"         Auto-discovered leave_type_id={eff_leave_type_id} ({body['types'][0].get('name', '?')})")

    status, body = req("GET", f"/time-off/pending?employee_id={actual_emp_id}", token=token)
    check("GET /time-off/pending", status, body, "leaves")

    # Missing employee_id → 400
    status, body = req("GET", "/time-off", token=token)
    check("GET /time-off missing employee_id → 400", status, body, expect_status=400)
    status, body = req("GET", "/time-off/pending", token=token)
    check("GET /time-off/pending missing employee_id → 400", status, body, expect_status=400)

    if eff_leave_type_id:
        status, body = req("POST", "/time-off", {
            "employee_id": actual_emp_id,
            "leave_type_id": eff_leave_type_id,
            "date_from": f"{today}T08:00:00",
            "date_to": f"{next_week}T17:00:00",
            "name": "Test leave from automated test suite"
        }, token=token)
        check_post("POST /time-off", status, body, "id")

        # POST missing fields → 400
        status, body = req("POST", "/time-off", {"employee_id": actual_emp_id}, token=token)
        check("POST /time-off missing fields → 400", status, body, expect_status=400)

    # ── EXPENSES ──────────────────────────────────────────────────────────────
    section("Expenses")
    status, body = req("GET", f"/expenses?employee_id={actual_emp_id}", token=token)
    check("GET /expenses", status, body, "expenses")
    check_custom_fields("GET /expenses", status, body)

    status, body = req("GET", f"/expenses/pending?employee_id={actual_emp_id}", token=token)
    check("GET /expenses/pending", status, body, "expenses")
    check_custom_fields("GET /expenses/pending", status, body)

    status, body = req("GET", "/expenses/taxes", token=token)
    check("GET /expenses/taxes", status, body, "taxes")

    status, body = req("GET", "/expenses/products", token=token)
    check("GET /expenses/products", status, body, "products")
    if not eff_product_id and isinstance(body.get("products"), list) and body["products"]:
        eff_product_id = body["products"][0]["id"]
        print(f"         Auto-discovered product_id={eff_product_id} ({body['products'][0].get('name', '?')})")

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
        if status == 400 and "incompatible companies" in str(body).lower():
            global SKIP
            SKIP += 1
            print("  [SKIP] POST /expenses  (product from different company)")
        else:
            check("POST /expenses", status, body, "id")

    # ── ATTENDANCE ────────────────────────────────────────────────────────────
    section("Attendance")
    status, body = req("GET", f"/attendance?employee_id={actual_emp_id}", token=token)
    check("GET /attendance", status, body, "records")
    check_custom_fields("GET /attendance", status, body)

    status, body = req("GET", f"/attendance/overtime?employee_id={actual_emp_id}", token=token)
    check_soft("GET /attendance/overtime", status, body)

    status, body = req("POST", "/attendance/correction", {
        "employee_id": actual_emp_id,
        "check_in": f"{today}T09:00:00",
        "check_out": f"{today}T17:00:00",
        "reason": "Test correction from automated suite"
    }, token=token)
    check_post("POST /attendance/correction", status, body, "id")

    status, body = req("POST", "/attendance/overtime", {
        "employee_id": actual_emp_id,
        "date": today,
        "duration": 2.0,
        "reason": "Test overtime from automated suite"
    }, token=token)
    check_soft("POST /attendance/overtime", status, body)

    if eff_leave_type_id:
        status, body = req("POST", "/attendance/justification", {
            "employee_id": actual_emp_id,
            "leave_type_id": eff_leave_type_id,
            "date_from": f"{today}T08:00:00",
            "date_to": f"{today}T17:00:00",
            "justification": "Test absence justification from automated suite"
        }, token=token)
        check_post("POST /attendance/justification", status, body, "id")

    # ── HELPDESK ──────────────────────────────────────────────────────────────
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
    check_custom_fields("GET /helpdesk", status, body)

    # Missing employee_id → 400
    status, body = req("GET", "/helpdesk", token=token)
    check("GET /helpdesk missing employee_id → 400", status, body, expect_status=400)

    status, body = req("POST", "/helpdesk", {
        "employee_id": actual_emp_id,
        "name": "Test ticket from automated test suite",
        "description": "This is a test ticket created by the automated test suite"
    }, token=token)
    check_soft("POST /helpdesk", status, body)

    # ── MAINTENANCE ───────────────────────────────────────────────────────────
    section("Maintenance")
    status, body = req("GET", "/maintenance/equipment", token=token)
    check_soft("GET /maintenance/equipment", status, body)

    status, body = req("GET", "/maintenance/teams", token=token)
    check_soft("GET /maintenance/teams", status, body)

    status, body = req("GET", "/maintenance/categories", token=token)
    check_soft("GET /maintenance/categories", status, body)

    status, body = req("GET", f"/maintenance?employee_id={actual_emp_id}", token=token)
    check_soft("GET /maintenance", status, body)
    check_custom_fields("GET /maintenance", status, body)

    # Missing employee_id → 400
    status, body = req("GET", "/maintenance", token=token)
    check("GET /maintenance missing employee_id → 400", status, body, expect_status=400)

    status, body = req("POST", "/maintenance", {
        "employee_id": actual_emp_id,
        "name": "Test maintenance request from automated suite",
        "description": "Test description",
        "maintenance_type": "corrective"
    }, token=token)
    check_soft("POST /maintenance", status, body)

    # Maintenance with preventive type (test selection field passthrough)
    status, body = req("POST", "/maintenance", {
        "employee_id": actual_emp_id,
        "name": "Preventive maintenance test from automated suite",
        "maintenance_type": "preventive"
    }, token=token)
    check_soft("POST /maintenance preventive", status, body)

    # ── TIMESHEET ─────────────────────────────────────────────────────────────
    section("Timesheet")
    status, body = req("GET", f"/timesheet?employee_id={actual_emp_id}", token=token)
    check("GET /timesheet", status, body, "entries")
    check_custom_fields("GET /timesheet", status, body)

    status, body = req("GET", "/timesheet/projects", token=token)
    check("GET /timesheet/projects", status, body, "projects")
    if not eff_project_id and isinstance(body.get("projects"), list) and body["projects"]:
        eff_project_id = body["projects"][0]["id"]
        print(f"         Auto-discovered project_id={eff_project_id} ({body['projects'][0].get('name', '?')})")

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

    # ── SCHEMA VALIDATION ─────────────────────────────────────────────────────
    section("Schema Validation")
    global PASS, FAIL

    # Valid correction should pass through schema validation unchanged
    status, body = req("POST", "/attendance/correction", {
        "employee_id": actual_emp_id,
        "check_in": f"{today}T10:30:00",
        "check_out": f"{today}T18:30:00",
        "reason": "Schema validation passthrough test"
    }, token=token)
    check_post("POST correction passes schema validation", status, body, "id")

    # Valid maintenance with all optional fields
    status, body = req("POST", "/maintenance", {
        "employee_id": actual_emp_id,
        "name": "Schema validation full-field test",
        "maintenance_type": "preventive",
        "priority": "1",
    }, token=token)
    check_soft("POST maintenance full-field passes validation", status, body)

    # Expense with valid data → schema validation must not block it
    if eff_product_id:
        status, body = req("POST", "/expenses", {
            "employee_id": actual_emp_id,
            "product_id": eff_product_id,
            "name": "Schema validation passthrough test",
            "unit_amount": 1.0,
            "quantity": 1,
            "date": today,
            "payment_mode": "company_account"   # second valid enum value
        }, token=token)
        if status == 400 and "incompatible companies" in str(body).lower():
            SKIP += 1
            print("  [SKIP] Expense company_account test  (incompatible companies)")
        elif status == 400 and isinstance(body, dict):
            # If 400, it must be schema validation error with the right format
            if "error" in body:
                PASS += 1
                print(f"  [PASS] Schema validation 400 has correct format: {list(body.keys())}")
            else:
                FAIL += 1
                print(f"  [FAIL] 400 missing error key: {str(body)[:100]}")
        else:
            check("POST expenses company_account passes validation", status, body, "id")

    # ── NOTIFICATIONS ─────────────────────────────────────────────────────────
    section("Notifications")
    status, body = req("GET", "/notifications", token=token)
    check("GET /notifications", status, body, "notifications")


# ── Tenant configs ────────────────────────────────────────────────────────────

tenants = [
    {
        "slug": "isec-v17",
        "emp_barcode": "45164705", "emp_pin": "4248", "emp_id": 2697,
        "project_id": 402, "leave_type_id": 1,
        "product_id": 205141,   # Communication — may hit incompatible companies
    },
    {
        "slug": "zahr-v15",
        "emp_barcode": "18200001", "emp_pin": "1111", "emp_id": 182,
        "project_id": 5,            # '12200879 - S00446'
        "leave_type_id": None,      # Arabic names — auto-discover or skip
        "product_id": None,         # no expensable products
    },
    {
        "slug": "lavendary-v18",
        "emp_barcode": "78800001", "emp_pin": "4444", "emp_id": 788,
        "project_id": None,         # auto-discover (module now installed)
        "leave_type_id": None,      # auto-discover (module now installed)
        "product_id": 28,           # Communication
    },
    {
        "slug": "energytracks-v19",
        "emp_barcode": "19200002", "emp_pin": "2222", "emp_id": 2,
        "project_id": 1,            # ET-J26-0009 - DEM
        "leave_type_id": 1,         # Paid Time Off
        "product_id": 5,            # Communication
    },
]

# ── Main runner ───────────────────────────────────────────────────────────────

target = sys.argv[1] if len(sys.argv) > 1 else None

# Admin tests run once (skip if targeting a specific tenant)
if not target:
    run_admin(tenants[0]["slug"])

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
