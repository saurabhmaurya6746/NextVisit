import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
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


def test_complete_email_verification_and_approval_flow():
    db = SessionLocal()
    try:
        # 1. Ensure a BusinessType exists
        bt = db.query(BusinessType).first()
        if not bt:
            bt = BusinessType(name="Restaurant")
            db.add(bt)
            db.commit()
            db.refresh(bt)

        # 2. Register a new merchant
        unique_suffix = uuid4().hex[:6]
        test_email = f"merchant_{unique_suffix}@example.com"
        test_password = "Password@123"

        payload = BusinessCreate(
            business=BusinessInfo(
                business_name=f"Verification Test Cafe {unique_suffix}",
                business_type_id=bt.id,
                phone="9876543210",
                country="India",
                currency="INR",
                timezone="Asia/Kolkata",
                address="MG Road, Bangalore",
            ),
            owner=OwnerCreate(
                owner_name="Verification Owner",
                owner_email=test_email,
                password=test_password,
            ),
        )

        auth_service = AuthService(db)
        reg_res = auth_service.register(payload)

        assert reg_res.get("success") is True, f"Expected success=True, got {reg_res}"
        assert reg_res.get("requires_email_verification") is True, "Expected requires_email_verification=True"
        assert "access_token" not in reg_res, "Access token must NOT be returned before email verification"
        logger.info("Step 1: Registration completed. requires_email_verification=True confirmed.")

        # Check DB state after registration
        created_user = db.query(User).filter(User.email == test_email).first()
        assert created_user is not None, "Owner user was not created"
        assert created_user.email_verified is False, "User email_verified should be False initially"
        assert created_user.verification_code_hash is not None, "Verification code hash must be set"
        assert created_user.verification_code_expires_at is not None, "Verification code expiry must be set"
        assert created_user.verification_attempts == 0, "Verification attempts should be 0"
        logger.info("Step 2: DB state verified: email_verified=False, verification_code_hash set.")

        created_biz = db.query(Business).filter(Business.id == created_user.business_id).first()
        assert created_biz is not None, "Business was not created"
        assert created_biz.status == BusinessStatus.PENDING.value, f"Expected status PENDING, got {created_biz.status}"

        # 3. Super Admin queue check: Unverified user must NOT appear in pending approval queue
        approval_service = MerchantApprovalService(db)
        pending_list = approval_service.list_pending_approvals(page=1, page_size=100)
        pending_ids = [str(b.id) for b in pending_list.items]
        assert str(created_biz.id) not in pending_ids, "Unverified merchant MUST NOT appear in admin pending approval queue"
        logger.info("Step 3: Verified unverified merchant is excluded from Super Admin pending approval queue.")

        # 4. Unverified login attempt: Must return 403 Forbidden with email verification error
        login_failed = False
        try:
            auth_service.login(LoginRequest(email=test_email, password=test_password))
        except HTTPException as e:
            login_failed = True
            assert e.status_code == 403, f"Expected 403, got {e.status_code}"
            assert "verify your email" in e.detail.lower(), f"Unexpected error detail: {e.detail}"
            logger.info("Step 4: Unverified login correctly rejected with 403: %s", e.detail)

        assert login_failed, "Unverified login should have failed"

        # 5. Wrong OTP verification attempt
        wrong_otp_failed = False
        try:
            auth_service.verify_email(email=test_email, code="000000")
        except HTTPException as e:
            wrong_otp_failed = True
            assert e.status_code == 400, f"Expected 400, got {e.status_code}"
            logger.info("Step 5: Wrong OTP correctly rejected with 400: %s", e.detail)

        assert wrong_otp_failed, "Wrong OTP should have failed"
        db.refresh(created_user)
        assert created_user.verification_attempts == 1, f"Expected attempts=1, got {created_user.verification_attempts}"

        # 6. Resend cooldown test (< 60 seconds)
        cooldown_failed = False
        try:
            auth_service.resend_verification(email=test_email)
        except HTTPException as e:
            cooldown_failed = True
            assert e.status_code == 429, f"Expected 429 cooldown, got {e.status_code}"
            logger.info("Step 6: Resend cooldown correctly enforced: %s", e.detail)

        assert cooldown_failed, "Resend within 60s should have been blocked"

        # 7. Fast-forward last_sent_at by 65s to test successful resend
        created_user.verification_last_sent_at = datetime.now(timezone.utc) - timedelta(seconds=65)
        db.commit()

        resend_res = auth_service.resend_verification(email=test_email)
        assert resend_res.get("success") is True, f"Expected resend success=True, got {resend_res}"
        db.refresh(created_user)
        assert created_user.verification_attempts == 0, "Attempts should be reset to 0 upon resend"
        logger.info("Step 7: Resend verification code succeeded after cooldown.")

        # 8. Test 5 failed attempts lockout
        for attempt in range(5):
            try:
                auth_service.verify_email(email=test_email, code="999999")
            except HTTPException:
                pass

        db.refresh(created_user)
        assert created_user.verification_code_hash is None, "Hash should be cleared after 5 failed attempts"
        logger.info("Step 8: Max 5 failed attempts successfully invalidated the OTP.")

        # 9. Resend again after clearing cooldown to get a fresh OTP
        created_user.verification_last_sent_at = datetime.now(timezone.utc) - timedelta(seconds=65)
        db.commit()
        auth_service.resend_verification(email=test_email)
        db.refresh(created_user)

        # 10. Simulate correct OTP verification
        from app.core.security import hash_otp
        known_otp = "123456"
        created_user.verification_code_hash = hash_otp(known_otp)
        created_user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        db.commit()

        verify_res = auth_service.verify_email(email=test_email, code=known_otp)
        assert verify_res.get("success") is True, f"Expected success=True, got {verify_res}"
        assert verify_res.get("email_verified") is True, "Expected email_verified=True"
        assert verify_res.get("status") == "ADMIN_PENDING", f"Expected ADMIN_PENDING, got {verify_res.get('status')}"
        logger.info("Step 9: Email verification succeeded with correct OTP. Status: ADMIN_PENDING.")

        db.refresh(created_user)
        assert created_user.email_verified is True, "User.email_verified should be True"
        assert created_user.email_verified_at is not None, "User.email_verified_at should be set"
        assert created_user.verification_code_hash is None, "OTP hash should be cleared"

        # 11. Super Admin queue check: Verified merchant MUST now appear in pending approval queue
        pending_list_after = approval_service.list_pending_approvals(page=1, page_size=100)
        pending_ids_after = [str(b.id) for b in pending_list_after.items]
        assert str(created_biz.id) in pending_ids_after, "Verified merchant MUST now appear in admin pending approval queue"
        logger.info("Step 10: Verified merchant is now visible to Super Admin in pending approvals queue.")

        # 12. Verified user login before admin approval -> should fail with pending administrator approval message
        admin_pending_failed = False
        try:
            auth_service.login(LoginRequest(email=test_email, password=test_password))
        except HTTPException as e:
            admin_pending_failed = True
            assert e.status_code == 403, f"Expected 403, got {e.status_code}"
            assert "pending administrator approval" in e.detail.lower(), f"Unexpected detail: {e.detail}"
            logger.info("Step 11: Login before admin approval correctly blocked with: %s", e.detail)

        assert admin_pending_failed, "Login should fail while awaiting admin approval"

        # 13. Super Admin approves merchant
        approved_biz = approval_service.approve_business(created_biz.id)
        assert approved_biz.status == BusinessStatus.ACTIVE.value, "Business status must be ACTIVE after approval"
        logger.info("Step 12: Super Admin approved merchant successfully.")

        # 14. Merchant login after approval -> should succeed and return access token
        token_data = auth_service.login(LoginRequest(email=test_email, password=test_password))
        assert "access_token" in token_data, "Access token must be returned after approval"
        logger.info("Step 13: Merchant login after approval succeeded with valid token.")

        print("\n" + "=" * 60)
        print("ALL 13 EMAIL VERIFICATION & APPROVAL FLOW TESTS PASSED!")
        print("=" * 60)

    except Exception as e:
        logger.error("Test failed with exception: %s", e, exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    test_complete_email_verification_and_approval_flow()
