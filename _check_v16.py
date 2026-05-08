import xmlrpc.client, ssl, urllib.request

ctx = ssl._create_unverified_context()

url = "https://technostream-stg-rw-31298496.dev.odoo.com"
db  = "technostream-stg-rw-31298496"

# Try common/version first
try:
    common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common", context=ctx)
    info = common.version()
    print("Version:", info)
    uid = common.authenticate(db, "admin", "123", {})
    print("UID:", uid)
except Exception as e:
    print("Error:", e)

# Check if URL resolves at all
try:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    resp = urllib.request.urlopen(req, context=ctx, timeout=10)
    print(f"HTTP {resp.status} {resp.url}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.reason}")
except Exception as e:
    print(f"Unreachable: {e}")
