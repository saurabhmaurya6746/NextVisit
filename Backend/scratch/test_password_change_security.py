import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.user import User
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, verify_password, hash_password

def test_password_change_security():
    print("=== TESTING CHANGE PASSWORD WORKFLOW & ERROR MESSAGES ===")

    client = TestClient(app)
    db = SessionLocal()
    try:
        test_user = db.query(User).filter(User.is_active == True, User.status == "ACTIVE").first()
        assert test_user is not None, "Test user must exist"

        # Set a known temporary password for testing
        test_user.hashed_password = hash_password("Password123!")
        db.commit()

        token = create_access_token({"sub": str(test_user.id), "role": test_user.role, "business_id": str(test_user.business_id)})
        headers = {"Authorization": f"Bearer {token}"}

        print("\n1. Testing Incorrect Old Password...")
        res1 = client.post(
            "/api/v1/business-settings/security/change-password",
            headers=headers,
            json={"old_password": "WrongPassword99", "new_password": "NewSecretPassword123!"}
        )
        assert res1.status_code == 400
        detail1 = res1.json().get("detail")
        print(f"   Response Detail: '{detail1}'")
        assert detail1 == "Current password is incorrect."

        print("\n2. Testing Short New Password (< 8 chars)...")
        res2 = client.post(
            "/api/v1/business-settings/security/change-password",
            headers=headers,
            json={"old_password": "Password123!", "new_password": "short"}
        )
        assert res2.status_code == 400
        detail2 = res2.json().get("detail")
        print(f"   Response Detail: '{detail2}'")
        assert detail2 == "New password must be at least 8 characters."

        print("\n3. Testing Same New Password...")
        res3 = client.post(
            "/api/v1/business-settings/security/change-password",
            headers=headers,
            json={"old_password": "Password123!", "new_password": "Password123!"}
        )
        assert res3.status_code == 400
        detail3 = res3.json().get("detail")
        print(f"   Response Detail: '{detail3}'")
        assert detail3 == "New password cannot be the same as the current password."

        print("\n4. Testing Successful Password Change...")
        res4 = client.post(
            "/api/v1/business-settings/security/change-password",
            headers=headers,
            json={"old_password": "Password123!", "new_password": "BrandNewPassword123!"}
        )
        assert res4.status_code == 200
        msg4 = res4.json().get("message")
        print(f"   Response Message: '{msg4}'")
        assert msg4 == "Password updated successfully."

        # Verify DB hash was updated
        db.refresh(test_user)
        assert verify_password("BrandNewPassword123!", test_user.hashed_password)

        # Reset back to test password
        test_user.hashed_password = hash_password("Password123!")
        db.commit()

        print("\nALL PASSWORD CHANGE SECURITY TESTS PASSED 100%!")

    finally:
        db.close()

if __name__ == "__main__":
    test_password_change_security()
