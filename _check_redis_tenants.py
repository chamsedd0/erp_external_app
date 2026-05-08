import urllib.request, json, ssl

url = "https://large-emu-118280.upstash.io"
token = "gQAAAAAAAc4IAAIgcDEzMjBkNjVhZmY2NjU0MTdlYTAxNDA2N2QxMzIyZDllYw"
ctx = ssl._create_unverified_context()

def redis_get(key):
    req = urllib.request.Request(
        f"{url}/get/{key}",
        headers={"Authorization": f"Bearer {token}"}
    )
    return json.loads(urllib.request.urlopen(req, context=ctx).read())

result = redis_get("shadow:tenants")
raw = result["result"]
if raw:
    tenants = json.loads(raw)
    for slug, cfg in tenants.items():
        print(f"\n=== {slug} ===")
        print(f"  url:     {cfg.get('odoo_url')}")
        print(f"  db:      {cfg.get('odoo_db')}")
        print(f"  enabled: {cfg.get('enabled')}")
else:
    print("No tenants found in shadow:tenants")
