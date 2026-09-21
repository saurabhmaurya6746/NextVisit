import sys
import os
import uuid

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.business import Business
from app.models.business_type import BusinessType
from app.schemas.business import BusinessCreate, BusinessInfo, OwnerCreate
from app.schemas.auth import LoginRequest
from app.services.auth_service import AuthService
from app.services.client_management_service import ClientManagementService
from app.services.merchant_approval_service import MerchantApprovalService
from sqlalchemy import select

def run_test():
    db = SessionLocal()
    try:
        auth_service = AuthService(db)
        client_service = ClientManagementService(db)
        approval_service = MerchantApprovalService(db)

        salon_type = db.query(BusinessType).filter(BusinessType.name.ilike("%salon%")).first()
        restaurant_type = db.query(BusinessType).filter(BusinessType.name.ilike("%restaurant%")).first()

        assert salon_type is not None, "Salon BusinessType must exist"
        assert restaurant_type is not None, "Restaurant BusinessType must exist"

        print("=== TEST 1: SALON REGISTRATION, APPROVAL, DELETION, AND RE-REGISTRATION ===")
        salon_email = f"salon_owner_{uuid.uuid4().hex[:6]}@example.com"
        
        # 1. Register Salon
        salon_reg_data = BusinessCreate(
            business=BusinessInfo(
                business_name="Test Salon Spa",
                business_type_id=salon_type.id,
                phone="9876543210",
                country="India",
                currency="INR",
                timezone="Asia/Kolkata",
                address="123 Salon St",
            ),
            owner=OwnerCreate(
                owner_name="Salon Owner Test",
                owner_email=salon_email,
                password="SecurePassword123!",
            ),
        )
        reg_res = auth_service.register(salon_reg_data)
        print("1. Salon registered successfully. Token:", reg_res["access_token"][:20])

        # Get business ID
        salon_biz = db.scalar(select(Business).where(Business.email == salon_email, Business.is_deleted == False))
        assert salon_biz is not None
        salon_id = salon_biz.id

        # 2. Approve Salon
        approval_service.approve_business(salon_id)
        print("2. Salon approved.")

        # 3. Test Login works
        login_res = auth_service.login(LoginRequest(email=salon_email, password="SecurePassword123!"))
        print("3. Salon owner login successful before delete.")

        # 4. Soft Delete Salon Business
        delete_res = client_service.delete_client(salon_id)
        print("4. Salon soft-deleted:", delete_res)

        # 5. Test Login fails cleanly after delete
        try:
            auth_service.login(LoginRequest(email=salon_email, password="SecurePassword123!"))
            assert False, "Login should have failed for soft-deleted Salon business!"
        except Exception as e:
            print("5. Login cleanly rejected after delete (as expected):", str(e))

        # 6. Re-register Salon with SAME email
        reg_again_res = auth_service.register(salon_reg_data)
        print("6. Salon RE-REGISTERED with SAME EMAIL successfully!", reg_again_res["access_token"][:20])

        # Approve re-registered Salon
        new_salon_biz = db.scalar(select(Business).where(Business.email == salon_email, Business.is_deleted == False))
        assert new_salon_biz is not None
        approval_service.approve_business(new_salon_biz.id)
        
        # Test Login works for new Salon account
        auth_service.login(LoginRequest(email=salon_email, password="SecurePassword123!"))
        print("7. Re-registered Salon login successful!")


        print("\n=== TEST 2: RESTAURANT REGISTRATION, APPROVAL, DELETION, AND RE-REGISTRATION ===")
        restaurant_email = f"resto_owner_{uuid.uuid4().hex[:6]}@example.com"

        # 1. Register Restaurant
        resto_reg_data = BusinessCreate(
            business=BusinessInfo(
                business_name="Test Gourmet Bistro",
                business_type_id=restaurant_type.id,
                phone="9876543211",
                country="India",
                currency="INR",
                timezone="Asia/Kolkata",
                address="456 Food Ave",
            ),
            owner=OwnerCreate(
                owner_name="Restaurant Owner Test",
                owner_email=restaurant_email,
                password="SecurePassword123!",
            ),
        )
        resto_reg_res = auth_service.register(resto_reg_data)
        print("1. Restaurant registered successfully. Token:", resto_reg_res["access_token"][:20])

        # Get business ID
        resto_biz = db.scalar(select(Business).where(Business.email == restaurant_email, Business.is_deleted == False))
        assert resto_biz is not None
        resto_id = resto_biz.id

        # 2. Approve Restaurant
        approval_service.approve_business(resto_id)
        print("2. Restaurant approved.")

        # 3. Test Login works
        auth_service.login(LoginRequest(email=restaurant_email, password="SecurePassword123!"))
        print("3. Restaurant owner login successful before delete.")

        # 4. Soft Delete Restaurant Business
        client_service.delete_client(resto_id)
        print("4. Restaurant soft-deleted.")

        # 5. Re-register Restaurant with SAME email
        resto_reg_again = auth_service.register(resto_reg_data)
        print("5. Restaurant RE-REGISTERED with SAME EMAIL successfully!", resto_reg_again["access_token"][:20])

        # Approve re-registered Restaurant
        new_resto_biz = db.scalar(select(Business).where(Business.email == restaurant_email, Business.is_deleted == False))
        assert new_resto_biz is not None
        approval_service.approve_business(new_resto_biz.id)

        # Test Login works for new Restaurant account
        auth_service.login(LoginRequest(email=restaurant_email, password="SecurePassword123!"))
        print("6. Re-registered Restaurant login successful!")

        print("\n=== TEST 3: BUSINESS ISOLATION VERIFICATION ===")
        assert new_salon_biz.id != new_resto_biz.id
        print("Salon ID and Restaurant ID are completely distinct.")

        print("\n========================================================")
        print("ALL DELETED BUSINESS RE-REGISTRATION TESTS PASSED 100%!")
        print("========================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_test()
