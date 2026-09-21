import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.user import User
from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.models.subscription_plan import SubscriptionPlan
from app.services.subscription_limit_service import SubscriptionLimitService
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
import uuid

def test_dynamic_subscription_credits():
    print("=== TESTING DYNAMIC SUBSCRIPTION FEATURE & AI CREDIT MANAGEMENT SYSTEM ===")

    client = TestClient(app)
    db = SessionLocal()
    try:
        # Create a dynamic plan with Super Admin custom settings (no hardcoded names)
        custom_plan_name = f"Custom Enterprise {uuid.uuid4().hex[:6]}"
        custom_plan = SubscriptionPlan(
            name=custom_plan_name,
            monthly_price=299.0,
            trial_days=14,
            max_staff=7,
            max_customers=1000,
            max_campaigns_per_month=50,
            monthly_ai_credits=300,
            features={"ai_generator": True},
            is_active=True
        )
        db.add(custom_plan)
        db.commit()
        db.refresh(custom_plan)
        print(f"\n1. Super Admin created dynamic plan: '{custom_plan.name}' (ID: {custom_plan.id})")
        print(f"   Configured Limits: Max Staff={custom_plan.max_staff}, Monthly AI Credits={custom_plan.monthly_ai_credits}")

        # Assign plan to test business
        user = db.query(User).filter(User.is_active == True, User.status == "ACTIVE", User.role == "OWNER").first()
        assert user is not None, "Owner user must exist"
        biz = db.query(Business).filter(Business.id == user.business_id).first()
        biz.subscription_plan_id = custom_plan.id
        db.commit()
        print(f"2. Assigned '{custom_plan.name}' to business '{biz.name}'")

        # Test SubscriptionLimitService dynamic resolution
        limit_svc = SubscriptionLimitService(db)
        resolved_plan = limit_svc.get_business_plan(biz.id)
        assert resolved_plan.id == custom_plan.id
        assert resolved_plan.name == custom_plan_name
        print("   [OK] Resolved plan dynamically without hardcoding!")

        # Test Dynamic Staff Limit
        staff_usage = limit_svc.get_staff_usage(biz.id)
        print(f"3. Dynamic Staff Usage: {staff_usage['active_count']} / {staff_usage['max_count']} (Remaining: {staff_usage['remaining_slots']})")
        assert staff_usage['max_count'] == 7

        # Test AI Credit Priority Consumption (Monthly First -> Purchased Second)
        settings = db.query(BusinessSettings).filter(BusinessSettings.business_id == biz.id).first()
        if not settings:
            settings = BusinessSettings(business_id=biz.id)
            db.add(settings)
            db.commit()

        # Set initial credit states: Monthly used = 298 (2 remaining out of 300), Purchased = 50
        settings.ai_monthly_used_credits = 298
        settings.purchased_ai_credits = 50
        db.commit()

        ai_usage1 = limit_svc.get_ai_credit_usage(biz.id)
        print(f"\n4. Initial AI Credit State:")
        print(f"   Monthly: {ai_usage1['monthly_used_credits']} / {ai_usage1['monthly_plan_credits']} Used (Remaining: {ai_usage1['monthly_remaining_credits']})")
        print(f"   Purchased: {ai_usage1['purchased_remaining_credits']} Remaining")
        print(f"   Total Remaining: {ai_usage1['total_remaining_credits']}")

        # Consume 1st credit -> should consume Monthly credit (monthly_used becomes 299)
        limit_svc.consume_ai_credit(biz.id)
        ai_usage2 = limit_svc.get_ai_credit_usage(biz.id)
        print(f"\n5. Consumed 1st AI Credit:")
        print(f"   Monthly Used: {ai_usage2['monthly_used_credits']} / 300 (Remaining Monthly: {ai_usage2['monthly_remaining_credits']})")
        print(f"   Purchased Remaining: {ai_usage2['purchased_remaining_credits']}")
        assert ai_usage2['monthly_used_credits'] == 299
        assert ai_usage2['purchased_remaining_credits'] == 50

        # Consume 2nd credit -> should consume last Monthly credit (monthly_used becomes 300)
        limit_svc.consume_ai_credit(biz.id)
        ai_usage3 = limit_svc.get_ai_credit_usage(biz.id)
        print(f"\n6. Consumed 2nd AI Credit:")
        print(f"   Monthly Used: {ai_usage3['monthly_used_credits']} / 300 (Remaining Monthly: {ai_usage3['monthly_remaining_credits']})")
        print(f"   Purchased Remaining: {ai_usage3['purchased_remaining_credits']}")
        assert ai_usage3['monthly_used_credits'] == 300
        assert ai_usage3['monthly_remaining_credits'] == 0
        assert ai_usage3['purchased_remaining_credits'] == 50

        # Consume 3rd credit -> Monthly is 0, should automatically consume 1 Purchased credit (purchased becomes 49)!
        limit_svc.consume_ai_credit(biz.id)
        ai_usage4 = limit_svc.get_ai_credit_usage(biz.id)
        print(f"\n7. Consumed 3rd AI Credit (Monthly exhausted!):")
        print(f"   Monthly Used: {ai_usage4['monthly_used_credits']} / 300 (Remaining Monthly: {ai_usage4['monthly_remaining_credits']})")
        print(f"   Purchased Remaining: {ai_usage4['purchased_remaining_credits']} (Decremented from 50!)")
        assert ai_usage4['monthly_remaining_credits'] == 0
        assert ai_usage4['purchased_remaining_credits'] == 49
        print("   [OK] Verified Credit Priority: Monthly Subscription Credits first, Purchased Extra Credits second!")

        # Test Monthly Reset behavior
        print("\n8. Testing Monthly Reset behavior:")
        # Force period change to simulate new month
        settings.ai_usage_period = "2026-07"
        db.commit()
        ai_usage_reset = limit_svc.get_ai_credit_usage(biz.id)
        print(f"   New Month Reset -> Monthly Used: {ai_usage_reset['monthly_used_credits']} (Reset to 0!)")
        print(f"   Purchased Credits: {ai_usage_reset['purchased_remaining_credits']} (UNTOUCHED & UNEXPIRED at 49!)")
        assert ai_usage_reset['monthly_used_credits'] == 0
        assert ai_usage_reset['purchased_remaining_credits'] == 49
        print("   [OK] Verified Monthly Reset: Resets ONLY Monthly Credits; Purchased Credits NEVER expire!")

        # Test Limit Exceeded Blocking Message
        print("\n9. Testing Limit Exceeded Error Message:")
        settings.ai_monthly_used_credits = 300
        settings.purchased_ai_credits = 0
        db.commit()
        try:
            limit_svc.check_ai_limit(biz.id)
            assert False, "Should have raised 403 HTTP Exception"
        except Exception as exc:
            print(f"   Error Message Raised: '{exc.detail}'")
            assert "You have used all available AI Credits" in str(exc.detail)
            assert "Upgrade your subscription or purchase additional AI Credits" in str(exc.detail)
            print("   [OK] Verified exact limit reached error message!")

        # Test GET /api/v1/subscription/usage API Endpoint
        token = create_access_token({"sub": str(user.id), "role": user.role, "business_id": str(user.business_id)})
        headers = {"Authorization": f"Bearer {token}"}
        res_usage = client.get("/api/v1/subscription/usage", headers=headers)
        assert res_usage.status_code == 200
        u_data = res_usage.json()
        print(f"\n10. GET /api/v1/subscription/usage API Response:")
        print(f"    Plan Name: {u_data['plan_name']}")
        print(f"    Staff Usage: {u_data['staff_usage']['active_count']} / {u_data['staff_usage']['max_count']}")
        print(f"    AI Usage: Monthly Plan={u_data['ai_usage']['monthly_plan_credits']}, Used={u_data['ai_usage']['monthly_used_credits']}, Purchased={u_data['ai_usage']['purchased_remaining_credits']}")

        print("\n=========================================================")
        print("ALL DYNAMIC SUBSCRIPTION FEATURE & AI CREDIT TESTS PASSED 100%!")
        print("=========================================================")

    finally:
        # Cleanup custom test plan
        db.close()

if __name__ == "__main__":
    test_dynamic_subscription_credits()
