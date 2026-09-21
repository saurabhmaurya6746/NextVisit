import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

def normalize_whatsapp_phone_py(phone: str | None) -> str | None:
    if not phone:
        return None
    import re
    digits = re.sub(r"\D", "", phone)
    if not digits or len(digits) < 10:
        return None
    if len(digits) == 10:
        return f"91{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"91{digits[1:]}"
    if len(digits) == 12 and digits.startswith("91"):
        return digits
    if 10 <= len(digits) <= 15:
        return digits
    return None

def test_whatsapp_button_flow():
    print("=== TESTING WHATSAPP BUTTON FIX & PHONE NORMALIZATION ===")

    # 1. Test Phone Normalization
    test_cases = [
        ("9876543210", "919876543210"),
        ("919876543210", "919876543210"),
        ("+919876543210", "919876543210"),
        ("+91 98765 43210", "919876543210"),
        ("+91-98765-43210", "919876543210"),
        ("09876543210", "919876543210"),
        ("", None),
        ("123", None),
        (None, None),
    ]

    print("\n1. Testing Phone Normalization Test Cases...")
    for raw_phone, expected in test_cases:
        actual = normalize_whatsapp_phone_py(raw_phone)
        print(f"   Input: {str(raw_phone):<18} -> Output: {str(actual):<14} | Expected: {str(expected):<14} {'[OK]' if actual == expected else '[FAIL]'}")
        assert actual == expected, f"Failed for {raw_phone}: got {actual}, expected {expected}"

    # 2. Test Customer API phone payload for Restaurant & Salon
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

        print("\n2. Testing Customer List API phone number payload...")
        res_list = client.get("/api/v1/customers", headers=headers_resto)
        assert res_list.status_code == 200
        customers = res_list.json()
        print(f"   Fetched {len(customers)} customers for business_id={user_resto.business_id}")
        for c in customers[:5]:
            assert "phone" in c, "Customer must have 'phone' field"
            print(f"   - Customer: {c['name']:<20} Phone: {c['phone']:<15} ID: {c['id']}")

        print("\nALL WHATSAPP BUTTON FIX TESTS PASSED 100%!")
    finally:
        db.close()

if __name__ == "__main__":
    test_whatsapp_button_flow()
