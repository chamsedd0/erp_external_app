import xmlrpc.client, ssl, os

ctx = ssl._create_unverified_context()

# Odoo admin password for the test tenants — read from env, never hardcode.
ODOO_PASSWORD = os.environ.get("ODOO_PASSWORD", "")

tenants = [
    {
        "slug": "zahr-v15",
        "url": "https://zahr-stg5-31383341.dev.odoo.com",
        "db": "zahr-stg5-31383341",
        "employees": [
            {"id": 182, "name": "SHAHEZ",    "barcode": "18200001", "pin": "1111"},
            {"id": 246, "name": "Mohammed",  "barcode": "24600002", "pin": "2222"},
            {"id": 30,  "name": "DAFER",     "barcode": "03000003", "pin": "3333"},
        ]
    },
    {
        "slug": "lavendary-v18",
        "url": "https://lavendary-staging-31383652.dev.odoo.com",
        "db": "lavendary-staging-31383652",
        "employees": [
            {"id": 788, "name": "Aadil Ali Shaikh", "barcode": "78800001", "pin": "4444"},
            {"id": 738, "name": "Aadil Nazir",      "barcode": "73800002", "pin": "5555"},
            {"id": 141, "name": "Aadil Nazir (B)",  "barcode": "14100003", "pin": "6666"},
        ]
    },
]

for t in tenants:
    print(f"\n=== {t['slug']} ===")
    common = xmlrpc.client.ServerProxy(f"{t['url']}/xmlrpc/2/common", context=ctx)
    uid = common.authenticate(t["db"], "admin", ODOO_PASSWORD, {})
    models = xmlrpc.client.ServerProxy(f"{t['url']}/xmlrpc/2/object", context=ctx)

    for emp in t["employees"]:
        result = models.execute_kw(
            t["db"], uid, ODOO_PASSWORD,
            "hr.employee", "write",
            [[emp["id"]], {"barcode": emp["barcode"], "pin": emp["pin"]}]
        )
        status = "OK" if result else "FAIL"
        print(f"  [{status}] ID={emp['id']} {emp['name']} -> barcode={emp['barcode']} pin={emp['pin']}")
