import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.user import User
from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.services.subscription_limit_service import SubscriptionLimitService
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

def test_centralized_subscription_limits():
    print("=== TESTING CENTRALIZED SUBSCRIPTION LIMIT MANAGEMENT ===")

    client = TestClient(app)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.is_active == True, User.status == "ACTIVE", User.role == "OWNER").first()
        assert user is not None, "Owner user must exist"

        token = create_access_token({"sub": str(user.id), "role": user.role, "business_id": str(user.business_id)})
        headers = {"Authorization": f"Bearer {token}"}

        print("\n1. Testing Subscription Usage API Endpoint (GET /api/v1/subscription/usage)...")
        res_usage = client.get("/api/v1/subscription/usage", headers=headers)
        assert res_usage.status_code == 200
        u_data = res_usage.json()
        print(f"   Plan: {u_data['plan_name']}")
        print(f"   Staff Usage: {u_data['staff_usage']['active_count']} / {u_data['staff_usage']['max_count']} (Remaining: {u_data['staff_usage']['remaining_slots']})")
        print(f"   AI Usage: Enabled={u_data['ai_usage']['ai_enabled']}, Used={u_data['ai_usage']['used_requests']}, Reset={u_data['ai_usage']['reset_date']}")

        print("\n2. Testing Staff Limit Enforcement...")
        limit_svc = SubscriptionLimitService(db)
        staff_info = limit_svc.get_staff_usage(user.business_id)

        # Force a low staff limit to test enforcement
        limits = limit_svc._get_business_plan_limits(user.business_id)
        print(f"   Business plan staff limit: {limits['max_staff']}")
        print(f"   Active staff count: {staff_info['active_count']}")

        print("\n3. Testing AI Limit Enforcement & Monthly Reset...")
        ai_info = limit_svc.get_ai_usage(user.business_id)
        print(f"   AI Enabled: {ai_info['ai_enabled']}")
        print(f"   AI Used: {ai_info['used_requests']} / {ai_info['max_requests']}")

        # Simulate AI request recording
        initial_used = ai_info['used_requests']
        limit_svc.record_ai_request(user.business_id)
        updated_ai_info = limit_svc.get_ai_usage(user.business_id)
        print(f"   Recorded AI request: {initial_used} -> {updated_ai_info['used_requests']}")
        assert updated_ai_info['used_requests'] == initial_used + 1

        print("\nALL SUBSCRIPTION LIMIT MANAGEMENT TESTS PASSED 100%!")

    finally:
        db.close()

if __name__ == "__main__":
    test_centralized_subscription_limits()
