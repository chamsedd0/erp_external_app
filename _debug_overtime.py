import urllib.request, json, ssl, os

BASE = os.environ.get("SHADOW_BASE_URL", "https://erp-external-app.vercel.app")
ctx = ssl._create_unverified_context()

# Test login credentials — read from env, never hardcode real PINs.
TENANT_CODE = os.environ.get("TEST_TENANT_CODE", "")
EMPLOYEE_ID = os.environ.get("TEST_EMPLOYEE_ID", "")
EMPLOYEE_PIN = os.environ.get("TEST_EMPLOYEE_PIN", "")

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
    "tenant_subscription_number": TENANT_CODE,
    "employee_id": EMPLOYEE_ID,
    "pin": EMPLOYEE_PIN
})
print(f"Login: {status}")
token = body.get("token")

# Full overtime error
status, body = req("GET", "/attendance/overtime?employee_id=2697", token=token)
print(f"\nOvertime GET status: {status}")
print(f"Full response: {json.dumps(body, indent=2)}")
