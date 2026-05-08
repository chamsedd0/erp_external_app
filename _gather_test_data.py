"""Gather leave_type_id and product_id for each tenant to fill in the test suite."""
import xmlrpc.client, ssl

ctx = ssl._create_unverified_context()

tenants = [
    {"slug": "zahr-v15",       "url": "https://zahr-stg5-31383341.dev.odoo.com",       "db": "zahr-stg5-31383341"},
    {"slug": "lavendary-v18",  "url": "https://lavendary-staging-31383652.dev.odoo.com","db": "lavendary-staging-31383652"},
    {"slug": "technostream-v16","url": "https://technostream-stg-rw-31298496.dev.odoo.com","db": "technostream-stg-rw-31298496"},
]

for t in tenants:
    print(f"\n=== {t['slug']} ===")
    try:
        common = xmlrpc.client.ServerProxy(f"{t['url']}/xmlrpc/2/common", context=ctx)
        uid = common.authenticate(t["db"], "admin", "123", {})
        print(f"  UID: {uid}")
        models = xmlrpc.client.ServerProxy(f"{t['url']}/xmlrpc/2/object", context=ctx)

        # Leave types
        try:
            lt = models.execute_kw(t["db"], uid, "123", "hr.leave.type", "search_read",
                                   [[]], {"fields": ["id", "name"], "limit": 3})
            print(f"  Leave types: {[(x['id'], x['name']) for x in lt]}")
        except Exception as e:
            print(f"  Leave types error: {e}")

        # Expense products
        try:
            prod = models.execute_kw(t["db"], uid, "123", "product.product", "search_read",
                                     [[["can_be_expensed", "=", True]]],
                                     {"fields": ["id", "name"], "limit": 3})
            print(f"  Expense products: {[(x['id'], x['name']) for x in prod]}")
        except Exception as e:
            print(f"  Expense products error: {e}")

        # Projects
        try:
            proj = models.execute_kw(t["db"], uid, "123", "project.project", "search_read",
                                     [[["active", "=", True]]],
                                     {"fields": ["id", "name"], "limit": 2})
            print(f"  Projects: {[(x['id'], x['name']) for x in proj]}")
        except Exception as e:
            print(f"  Projects error: {e}")

        # Employees with barcodes
        emps = models.execute_kw(t["db"], uid, "123", "hr.employee", "search_read",
                                 [[["barcode", "!=", False]]],
                                 {"fields": ["id", "name", "barcode", "pin", "company_id"], "limit": 3})
        for e in emps:
            print(f"  Emp ID={e['id']} {e['name']} company={e.get('company_id')} barcode={e['barcode']} pin={e['pin']}")

    except Exception as ex:
        print(f"  Connection failed: {ex}")
