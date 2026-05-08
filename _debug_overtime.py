import urllib.request, json, ssl

BASE = "https://erp-external-app.vercel.app"
ctx = ssl._create_unverified_context()

def req(method, path, body=None, token=None):
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

# Login
status, body = req("POST", "/auth/login", {
    "tenant_slug": "isec-v17",
    "employee_id": "45164705",
    "pin": "4248"
})
print(f"Login: {status}")
token = body.get("token")

# Full overtime error
status, body = req("GET", "/attendance/overtime?employee_id=2697", token=token)
print(f"\nOvertime GET status: {status}")
print(f"Full response: {json.dumps(body, indent=2)}")
