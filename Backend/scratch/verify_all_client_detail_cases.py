import sys
import os
import uuid

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.admin import Admin
from app.models.business import Business
from app.models.business_type import BusinessType
from app.core.security import create_access_token
from app.services.client_management_service import ClientManagementService

def verify():
    client = TestClient(app)
    db = SessionLocal()
    try:
        admin = db.query(Admin).first()
        token = create_access_token({"sub": str(admin.id), "role": admin.role})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Verify Salon Client Detail API
        salon = db.query(Business).filter(Business.is_deleted == False).join(BusinessType).filter(BusinessType.name.ilike("%salon%")).first()
        if salon:
            res_salon = client.get(f"/api/v1/admin/clients/{salon.id}", headers=headers)
            print(f"1. SALON CLIENT DETAIL ({salon.name}) HTTP STATUS:", res_salon.status_code)
            assert res_salon.status_code == 200
            salon_data = res_salon.json()
            assert salon_data["id"] == str(salon.id)
            assert "stats" in salon_data
            assert "settings" in salon_data

        # 2. Verify Restaurant Client Detail API (including dfa6edf3-99e5-454f-a6c3-564e781b5078)
        dfa_id = "dfa6edf3-99e5-454f-a6c3-564e781b5078"
        res_resto = client.get(f"/api/v1/admin/clients/{dfa_id}", headers=headers)
        print(f"2. RESTAURANT CLIENT DETAIL ({dfa_id}) HTTP STATUS:", res_resto.status_code)
        assert res_resto.status_code == 200
        resto_data = res_resto.json()
        assert resto_data["id"] == dfa_id
        assert resto_data["name"] == "Jail Restaurantt"
        assert resto_data["stats"]["loyalty_enabled"] == True

        # 3. Verify Soft-Deleted Client returns proper 404
        deleted_biz = db.query(Business).filter(Business.is_deleted == True).first()
        if deleted_biz:
            res_del = client.get(f"/api/v1/admin/clients/{deleted_biz.id}", headers=headers)
            print(f"3. DELETED CLIENT ({deleted_biz.id}) HTTP STATUS:", res_del.status_code)
            assert res_del.status_code == 404
            assert "not found" in res_del.json()["detail"].lower()

        # 4. Non-existent random UUID returns 404
        fake_uuid = str(uuid.uuid4())
        res_fake = client.get(f"/api/v1/admin/clients/{fake_uuid}", headers=headers)
        print(f"4. NON-EXISTENT CLIENT ({fake_uuid}) HTTP STATUS:", res_fake.status_code)
        assert res_fake.status_code == 404

        print("\nALL VERIFICATION TEST CASES PASSED 100%!")

    finally:
        db.close()

if __name__ == "__main__":
    verify()
