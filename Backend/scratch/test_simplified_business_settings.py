import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.user import User
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

def test_simplified_business_settings():
    print("=== TESTING SIMPLIFIED BUSINESS SETTINGS & PDF EXPORTS ===")

    client = TestClient(app)
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True, User.status == "ACTIVE").all()
        assert len(users) > 0, "Users must exist"

        user_resto = None
        user_salon = None
        for u in users:
            if u.business:
                btype = u.business.business_type.name.lower() if u.business.business_type else ""
                if "resto" in btype or "restaurant" in btype:
                    if not user_resto: user_resto = u
                elif "salon" in btype or "spa" in btype:
                    if not user_salon: user_salon = u

        if not user_resto: user_resto = users[0]
        if not user_salon: user_salon = users[-1]

        token_resto = create_access_token({"sub": str(user_resto.id), "role": user_resto.role, "business_id": str(user_resto.business_id)})
        headers_resto = {"Authorization": f"Bearer {token_resto}"}

        token_salon = create_access_token({"sub": str(user_salon.id), "role": user_salon.role, "business_id": str(user_salon.business_id)})
        headers_salon = {"Authorization": f"Bearer {token_salon}"}

        print("\n1. Testing Restaurant Profile & Settings...")
        res1 = client.get("/api/v1/business", headers=headers_resto)
        assert res1.status_code == 200
        print(f"   Restaurant Profile OK: {res1.json()['name']}")

        print("\n2. Testing Salon Profile & Settings...")
        res2 = client.get("/api/v1/business", headers=headers_salon)
        assert res2.status_code == 200
        print(f"   Salon Profile OK: {res2.json()['name']}")

        print("\n3. Testing Restaurant Catalog PDF Export...")
        res_cat_resto = client.get("/api/v1/business-settings/export/catalog-pdf", headers=headers_resto)
        assert res_cat_resto.status_code == 200
        assert res_cat_resto.headers["content-type"] == "application/pdf"
        assert len(res_cat_resto.content) > 1000
        print(f"   Restaurant Catalog PDF Generated ({len(res_cat_resto.content)} bytes)!")

        print("\n4. Testing Salon Catalog PDF Export...")
        res_cat_salon = client.get("/api/v1/business-settings/export/catalog-pdf", headers=headers_salon)
        assert res_cat_salon.status_code == 200
        assert res_cat_salon.headers["content-type"] == "application/pdf"
        assert len(res_cat_salon.content) > 1000
        print(f"   Salon Catalog PDF Generated ({len(res_cat_salon.content)} bytes)!")

        print("\nSIMPLIFIED SETTINGS & BRANDED PDF EXPORTS PASSED 100%!")

    finally:
        db.close()

if __name__ == "__main__":
    test_simplified_business_settings()
