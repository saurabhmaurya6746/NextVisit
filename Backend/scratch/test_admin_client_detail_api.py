import sys
import os
from fastapi.testclient import TestClient

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.main import app
from app.db.database import SessionLocal
from app.models.admin import Admin
from app.core.security import create_access_token
from app.services.client_management_service import ClientManagementService

def test_api():
    client = TestClient(app)
    db = SessionLocal()
    try:
        admin = db.query(Admin).first()
        assert admin is not None, "Admin must exist"

        token = create_access_token({"sub": str(admin.id), "role": admin.role})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Get List of Clients
        res = client.get("/api/v1/admin/clients", headers=headers)
        print("LIST CLIENTS HTTP STATUS:", res.status_code)
        if res.status_code != 200:
            print("LIST CLIENTS ERROR:", res.text)
            return

        list_data = res.json()
        items = list_data.get("items", [])
        print(f"LIST CLIENTS RETURNED {len(items)} items.")
        for item in items:
            print(f" - ID: {item['id']} | Name: {item['name']} | Email: {item['email']}")

        if not items:
            print("NO ITEMS IN CLIENT LIST.")
            return

        first_client = items[0]
        biz_id = first_client["id"]
        print(f"\n2. TESTING GET CLIENT DETAIL FOR BIZ ID: {biz_id} ({first_client['name']})")

        detail_res = client.get(f"/api/v1/admin/clients/{biz_id}", headers=headers)
        print("GET CLIENT DETAIL HTTP STATUS:", detail_res.status_code)
        print("GET CLIENT DETAIL RESPONSE:", detail_res.text[:500])

    except Exception as e:
        print("TEST ERROR:", e)
    finally:
        db.close()

if __name__ == "__main__":
    test_api()
