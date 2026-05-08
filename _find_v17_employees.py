import xmlrpc.client, ssl, json

ctx = ssl._create_unverified_context()

url = "https://isec-a-stg1-31229137.dev.odoo.com"
db = "isec-a-stg1-31229137"

common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common", context=ctx)
uid = common.authenticate(db, "admin", "123", {})
print(f"UID: {uid}")

models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object", context=ctx)

# Employees with barcodes
employees = models.execute_kw(
    db, uid, "123",
    "hr.employee", "search_read",
    [[['barcode', '!=', False]]],
    {"fields": ["id", "name", "barcode", "pin"], "limit": 10}
)
print(f"\nEmployees with barcodes ({len(employees)}):")
for e in employees:
    print(f"  ID={e['id']} {e['name']} barcode={e['barcode']} pin={e['pin']}")

if not employees:
    print("\nNo barcodes. Getting first 5 employees:")
    all_emps = models.execute_kw(
        db, uid, "123",
        "hr.employee", "search_read",
        [[]],
        {"fields": ["id", "name"], "limit": 5}
    )
    for e in all_emps:
        print(f"  ID={e['id']} {e['name']}")

    # Set up barcodes for first 3
    print("\nSetting barcodes for first 3 employees...")
    for i, emp in enumerate(all_emps[:3]):
        result = models.execute_kw(
            db, uid, "123",
            "hr.employee", "write",
            [[emp["id"]], {"barcode": f"{emp['id']:08d}", "pin": str(i+1)*4}]
        )
        print(f"  [{('OK' if result else 'FAIL')}] ID={emp['id']} {emp['name']} -> barcode={emp['id']:08d} pin={str(i+1)*4}")

# Projects
try:
    projects = models.execute_kw(
        db, uid, "123",
        "project.project", "search_read",
        [[["active", "=", True]]],
        {"fields": ["id", "name"], "limit": 3}
    )
    print(f"\nProjects: {[(p['id'], p['name']) for p in projects]}")
except Exception as e:
    print(f"\nProjects error: {e}")

# Leave types
try:
    leave_types = models.execute_kw(
        db, uid, "123",
        "hr.leave.type", "search_read",
        [[]],
        {"fields": ["id", "name"], "limit": 3}
    )
    print(f"Leave types: {[(t['id'], t['name']) for t in leave_types]}")
except Exception as e:
    print(f"Leave types error: {e}")

# Expense products
try:
    products = models.execute_kw(
        db, uid, "123",
        "product.product", "search_read",
        [[["can_be_expensed", "=", True]]],
        {"fields": ["id", "name"], "limit": 3}
    )
    print(f"Expensable products: {[(p['id'], p['name']) for p in products]}")
except Exception as e:
    print(f"Expense products error: {e}")
