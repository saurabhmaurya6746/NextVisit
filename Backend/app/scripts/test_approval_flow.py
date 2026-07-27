import logging
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.business import Business, BusinessStatus
from app.models.business_type import BusinessType
from app.schemas.auth import LoginRequest
from app.schemas.business import BusinessCreate, BusinessInfo, OwnerCreate
from app.services.auth_service import AuthService
from app.services.merchant_approval_service import MerchantApprovalService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_merchant_approval_and_login_flow():
    db = SessionLocal()
    try:
        # 1. Get or create a BusinessType
        bt = db.query(BusinessType).first()
        if not bt:
            bt = BusinessType(name="Salon")
            db.add(bt)
            db.commit()
            db.refresh(bt)

        # 2. Register a new business
        test_email = f"test_merchant_{uuid4().hex[:6]}@example.com"
        test_password = "Password@123"

        payload = BusinessCreate(
            business=BusinessInfo(
                business_name="Test Verification Salon",
                business_type_id=bt.id,
                phone="1234567890",
                country="Ireland",
                currency="EUR",
                timezone="UTC",
                address="123 Dublin St",
            ),
            owner=OwnerCreate(
                owner_name="Test Owner",
                owner_email=test_email,
                password=test_password,
            ),
        )

        auth_service = AuthService(db)
        reg_result = auth_service.register(payload)
        logger.info("Registration successful. Created account: %s", test_email)

        # Verify initial status is PENDING
        created_biz = db.query(Business).filter(Business.email == test_email).first()
        assert created_biz is not None, "Created business not found"
        assert created_biz.status == BusinessStatus.PENDING.value, f"Expected PENDING, got {created_biz.status}"
        logger.info("Verified: New business status is PENDING")

        # 3. Test login restriction while PENDING
        login_failed = False
        try:
            auth_service.login(LoginRequest(email=test_email, password=test_password))
        except Exception as e:
            login_failed = True
            logger.info("Verified: Login rejected while PENDING with message: %s", getattr(e, 'detail', str(e)))

        assert login_failed, "Login should have failed while business is PENDING"

        # 4. Approve the business via MerchantApprovalService
        approval_service = MerchantApprovalService(db)
        approved_biz = approval_service.approve_business(created_biz.id)
        assert approved_biz.status == BusinessStatus.ACTIVE.value, "Expected status ACTIVE after approval"
        assert approved_biz.approved_at is not None, "Expected approved_at timestamp set"
        logger.info("Verified: Business approved successfully. Status is now ACTIVE")

        # 5. Test login after approval
        token_data = auth_service.login(LoginRequest(email=test_email, password=test_password))
        assert "access_token" in token_data, "Access token should be issued after approval"
        logger.info("Verified: Business login succeeded after approval!")

        print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

    except Exception as e:
        logger.error("Verification failed: %s", e, exc_info=True)
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    test_merchant_approval_and_login_flow()
