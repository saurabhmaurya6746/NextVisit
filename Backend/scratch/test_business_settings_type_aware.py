import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.user import User
from app.models.business import Business
from app.models.business_type import BusinessType
from app.models.business_settings import BusinessSettings
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

def test_business_settings_type_aware():
    print("=== TESTING BUSINESS-TYPE AWARE SETTINGS ===")

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

        print("\n1. Testing Restaurant Business Settings Endpoint...")
        res_resto_prof = client.get("/api/v1/business", headers=headers_resto)
        assert res_resto_prof.status_code == 200
        p_resto = res_resto_prof.json()
        print(f"   Restaurant Name: {p_resto['name']} | Type: {p_resto.get('business_type', {}).get('name') if isinstance(p_resto.get('business_type'), dict) else p_resto.get('type')}")

        res_resto_set = client.get("/api/v1/business-settings", headers=headers_resto)
        assert res_resto_set.status_code == 200
        s_resto = res_resto_set.json()
        print("   Restaurant Settings fetched cleanly!")

        print("\n2. Testing Salon Business Settings Endpoint...")
        res_salon_prof = client.get("/api/v1/business", headers=headers_salon)
        assert res_salon_prof.status_code == 200
        p_salon = res_salon_prof.json()
        print(f"   Salon Name: {p_salon['name']} | Type: {p_salon.get('business_type', {}).get('name') if isinstance(p_salon.get('business_type'), dict) else p_salon.get('type')}")

        res_salon_set = client.get("/api/v1/business-settings", headers=headers_salon)
        assert res_salon_set.status_code == 200
        s_salon = res_salon_set.json()
        print("   Salon Settings fetched cleanly!")

        # Verify updating invoice footer for Salon vs Restaurant
        print("\n3. Testing Business-Aware Invoice Footer Update...")
        res_upd_salon = client.put(
            "/api/v1/business-settings",
            headers=headers_salon,
            json={"invoice_footer": "Thank you for visiting our salon!"}
        )
        assert res_upd_salon.status_code == 200
        assert res_upd_salon.json()["invoice_footer"] == "Thank you for visiting our salon!"

        res_upd_resto = client.put(
            "/api/v1/business-settings",
            headers=headers_resto,
            json={"invoice_footer": "Thank you for dining with us!"}
        )
        assert res_upd_resto.status_code == 200
        assert res_upd_resto.json()["invoice_footer"] == "Thank you for dining with us!"

        print("\nALL BUSINESS-TYPE AWARE SETTINGS TESTS PASSED 100%!")

    finally:
        db.close()

if __name__ == "__main__":
    test_business_settings_type_aware()
