import logging
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.business import Business, BusinessStatus
from app.models.business_type import BusinessType
from app.models.user import User
from app.schemas.auth import LoginRequest
from app.schemas.business import BusinessCreate, BusinessInfo, OwnerCreate
from app.services.auth_service import AuthService
from app.services.merchant_approval_service import MerchantApprovalService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_merchant_approval_and_login_flow():
    db = SessionLocal()
    test_email = f"test_merchant_{uuid4().hex[:6]}@example.com"
    test_password = "Password@123"
    try:
        # 1. Get or create a BusinessType
        bt = db.query(BusinessType).first()
        if not bt:
            bt = BusinessType(name="Salon")
            db.add(bt)
            db.commit()
            db.refresh(bt)

        # 2. Register a new business with Brevo mock
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
        with patch("app.services.brevo_service.requests.post") as mock_brevo:
            mock_resp = MagicMock()
            mock_resp.status_code = 201
            mock_resp.json.return_value = {"messageId": "msg-test-approval"}
            mock_brevo.return_value = mock_resp
            reg_result = auth_service.register(payload)

        logger.info("Registration successful. Created account: %s", test_email)

        # Verify initial status is PENDING and user is unverified
        created_biz = db.query(Business).filter(Business.email == test_email).first()
        created_user = db.query(User).filter(User.email == test_email).first()
        assert created_biz is not None, "Created business not found"
        assert created_biz.status == BusinessStatus.PENDING.value, f"Expected PENDING, got {created_biz.status}"
        assert created_user is not None, "Created user not found"
        assert created_user.is_verified is False, "User should start with is_verified=False"
        logger.info("Verified: New business status is PENDING and email is unverified")

        # 3. Test login restriction while unverified / PENDING
        login_failed = False
        try:
            auth_service.login(LoginRequest(email=test_email, password=test_password))
        except Exception as e:
            login_failed = True
            logger.info("Verified: Login rejected while unverified with message: %s", getattr(e, 'detail', str(e)))

        assert login_failed, "Login should have failed while unverified"

        # Now simulate OTP verification
        created_user.is_verified = True
        db.commit()
        logger.info("Verified: Email marked as verified")

        # Login must STILL fail because business is PENDING admin approval
        login_pending_failed = False
        try:
            auth_service.login(LoginRequest(email=test_email, password=test_password))
        except Exception as e:
            login_pending_failed = True
            logger.info("Verified: Login rejected while PENDING approval with message: %s", getattr(e, 'detail', str(e)))

        assert login_pending_failed, "Login should fail while business is PENDING admin approval"

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
        # Clean up test entities
        try:
            u = db.query(User).filter(User.email == test_email).first()
            if u:
                db.delete(u)
            b = db.query(Business).filter(Business.email == test_email).first()
            if b:
                db.delete(b)
            db.commit()
        except Exception:
            db.rollback()
        db.close()


if __name__ == "__main__":
    test_merchant_approval_and_login_flow()
