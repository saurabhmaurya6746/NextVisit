import logging
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.business import Business, BusinessStatus
from app.models.business_type import BusinessType
from app.models.otp import EmailOTP
from app.models.user import User
from app.schemas.auth import LoginRequest
from app.schemas.business import BusinessCreate, BusinessInfo, OwnerCreate
from app.services.auth_service import (
    AuthService,
    generate_otp,
    hash_otp,
    verify_otp_hash,
)
from app.services.merchant_approval_service import MerchantApprovalService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_otp_flow")


def test_comprehensive_otp_verification_flow():
    logger.info("=== Starting Comprehensive OTP Verification Flow Tests ===")
    db: Session = SessionLocal()

    try:
        # -------------------------------------------------------------
        # 1. Test OTP generation: 6 digits, cryptographically secure
        # -------------------------------------------------------------
        logger.info("[TEST 1] Testing OTP generation...")
        otps = [generate_otp() for _ in range(20)]
        for o in otps:
            assert len(o) == 6, f"Expected 6 digits, got {o}"
            assert o.isdigit(), f"Expected numeric string, got {o}"
        assert len(set(otps)) > 15, "OTPs must be distinct and non-deterministic"
        logger.info("✓ OTP generation passed.")

        # -------------------------------------------------------------
        # 2. Test OTP hashing and constant-time verification
        # -------------------------------------------------------------
        logger.info("[TEST 2] Testing OTP hashing & comparison...")
        email = "test_merchant@example.com"
        code = "123456"
        hashed = hash_otp(email, code)
        assert hashed != code, "Hashed OTP must never equal plaintext OTP"
        assert verify_otp_hash(email, code, hashed) is True, "Valid OTP must verify successfully"
        assert verify_otp_hash(email, "654321", hashed) is False, "Wrong OTP must fail verification"
        assert verify_otp_hash("other@example.com", code, hashed) is False, "Hash must be email-bound"
        logger.info("✓ OTP hashing passed.")

        # -------------------------------------------------------------
        # 3. Test Registration requiring verification & Brevo mock
        # -------------------------------------------------------------
        logger.info("[TEST 3] Testing Registration requiring OTP verification...")
        bt = db.query(BusinessType).first()
        if not bt:
            bt = BusinessType(name="Restaurant")
            db.add(bt)
            db.commit()
            db.refresh(bt)

        test_email = f"merchant_{uuid.uuid4().hex[:8]}@example.com"
        test_password = "Password@123"

        reg_payload = BusinessCreate(
            business=BusinessInfo(
                business_name="NextVisit Bistro",
                business_type_id=bt.id,
                phone="9876543210",
                country="India",
                currency="INR",
                timezone="Asia/Kolkata",
                address="Bandra West, Mumbai",
            ),
            owner=OwnerCreate(
                owner_name="Test Owner",
                owner_email=test_email,
                password=test_password,
            ),
        )

        with patch("app.services.brevo_service.requests.post") as mock_brevo_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 201
            mock_resp.json.return_value = {"messageId": "msg-12345"}
            mock_brevo_post.return_value = mock_resp

            auth_service = AuthService(db)
            reg_response = auth_service.register(reg_payload)

            # Check response
            assert reg_response["requires_verification"] is True
            assert reg_response["email"] == test_email
            assert "access_token" not in reg_response, "Access token must not be issued before verification"

            # Check Brevo API mock call
            mock_brevo_post.assert_called_once()
            called_payload = mock_brevo_post.call_args[1]["json"]
            assert called_payload["to"][0]["email"] == test_email
            logger.info("✓ Brevo email dispatch verified with mock.")

        # Verify DB state: user is unverified, business is PENDING
        created_user = db.query(User).filter(User.email == test_email).first()
        created_biz = db.query(Business).filter(Business.email == test_email).first()
        assert created_user is not None
        assert created_user.is_verified is False, "New user must start with is_verified=False"
        assert created_biz is not None
        assert created_biz.status == BusinessStatus.PENDING.value, "Business status must remain PENDING"

        # Verify OTP record in DB
        otp_record = (
            db.query(EmailOTP)
            .filter(EmailOTP.email == test_email)
            .order_by(EmailOTP.created_at.desc())
            .first()
        )
        assert otp_record is not None
        assert otp_record.is_used is False
        assert otp_record.attempts == 0
        assert otp_record.expires_at > datetime.now(timezone.utc)
        logger.info("✓ Registration flow and OTP storage passed.")

        # -------------------------------------------------------------
        # 4. Test Login rejected before email verification
        # -------------------------------------------------------------
        logger.info("[TEST 4] Testing Login rejection for unverified email...")
        try:
            auth_service.login(LoginRequest(email=test_email, password=test_password))
            assert False, "Login should have failed for unverified user"
        except HTTPException as e:
            assert e.status_code == 403
            assert "verify your email" in e.detail.lower()
            logger.info("✓ Login correctly rejected for unverified email: %s", e.detail)

        # -------------------------------------------------------------
        # 5. Test Invalid OTP and attempt counter
        # -------------------------------------------------------------
        logger.info("[TEST 5] Testing invalid OTP attempts...")
        try:
            auth_service.verify_otp(test_email, "000000")
            assert False, "Verification should fail on wrong OTP"
        except HTTPException as e:
            assert e.status_code == 400
            assert "invalid" in e.detail.lower()
            db.refresh(otp_record)
            assert otp_record.attempts == 1
            logger.info("✓ Invalid OTP attempt recorded (attempts = 1)")

        # -------------------------------------------------------------
        # 6. Test Max attempts lockout (limit = 5)
        # -------------------------------------------------------------
        logger.info("[TEST 6] Testing max attempts lockout...")
        otp_record.attempts = 4
        db.commit()

        # 5th failed attempt
        try:
            auth_service.verify_otp(test_email, "000000")
            assert False, "5th attempt should fail"
        except HTTPException as e:
            assert e.status_code == 429
            db.refresh(otp_record)
            assert otp_record.attempts == 5
            logger.info("✓ 5th failed attempt locked code (HTTP 429)")

        # 6th attempt when locked
        try:
            auth_service.verify_otp(test_email, "000000")
            assert False, "Should reject locked code"
        except HTTPException as e:
            assert e.status_code == 429
            logger.info("✓ Locked code blocked further attempts (HTTP 429)")

        # -------------------------------------------------------------
        # 7. Test Resend OTP cooldown and previous OTP invalidation
        # -------------------------------------------------------------
        logger.info("[TEST 7] Testing Resend cooldown and invalidation...")
        # Immediate resend should trigger 429 cooldown
        try:
            auth_service.resend_otp(test_email)
            assert False, "Immediate resend should trigger cooldown"
        except HTTPException as e:
            assert e.status_code == 429
            assert "wait" in e.detail.lower()
            logger.info("✓ Resend cooldown active: %s", e.detail)

        # Wind clock back by 65 seconds to simulate cooldown expiry
        otp_record.created_at = datetime.now(timezone.utc) - timedelta(seconds=65)
        db.commit()

        with patch("app.services.brevo_service.requests.post") as mock_brevo_resend:
            mock_resp = MagicMock()
            mock_resp.status_code = 201
            mock_brevo_resend.return_value = mock_resp

            resend_res = auth_service.resend_otp(test_email)
            assert "sent" in resend_res["message"].lower()
            mock_brevo_resend.assert_called_once()
            logger.info("✓ Resend succeeded after cooldown.")

        # Check old OTP is invalidated and new active OTP is created
        db.refresh(otp_record)
        assert otp_record.is_used is True, "Previous OTP must be invalidated"

        new_otp_record = (
            db.query(EmailOTP)
            .filter(EmailOTP.email == test_email, EmailOTP.is_used == False)
            .first()
        )
        assert new_otp_record is not None
        assert new_otp_record.id != otp_record.id
        logger.info("✓ Previous OTP invalidated and new OTP active.")

        # -------------------------------------------------------------
        # 8. Test Expired OTP
        # -------------------------------------------------------------
        logger.info("[TEST 8] Testing expired OTP rejection...")
        new_otp_record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()

        try:
            auth_service.verify_otp(test_email, "123456")
            assert False, "Expired OTP must be rejected"
        except HTTPException as e:
            assert e.status_code == 400
            assert "expired" in e.detail.lower()
            logger.info("✓ Expired OTP rejected: %s", e.detail)

        # -------------------------------------------------------------
        # 9. Test Successful OTP verification
        # -------------------------------------------------------------
        logger.info("[TEST 9] Testing successful OTP verification...")
        # Create a fresh valid OTP record
        valid_code = "654321"
        new_otp_record.hashed_otp = hash_otp(test_email, valid_code)
        new_otp_record.expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        new_otp_record.attempts = 0
        new_otp_record.is_used = False
        db.commit()

        verify_res = auth_service.verify_otp(test_email, valid_code)
        assert verify_res["verified"] is True
        logger.info("✓ verify_otp response: %s", verify_res["message"])

        # Check DB state
        db.refresh(created_user)
        db.refresh(new_otp_record)
        db.refresh(created_biz)
        assert created_user.is_verified is True, "User email must now be marked verified"
        assert new_otp_record.is_used is True, "OTP record must be marked used"
        assert created_biz.status == BusinessStatus.PENDING.value, "Business must remain PENDING admin approval"
        logger.info("✓ User verified and business status PENDING intact.")

        # -------------------------------------------------------------
        # 10. Test Reusing an already-used OTP
        # -------------------------------------------------------------
        logger.info("[TEST 10] Testing reuse of used OTP...")
        # Unset verified temporarily to test reuse rejection
        created_user.is_verified = False
        db.commit()

        try:
            auth_service.verify_otp(test_email, valid_code)
            assert False, "Reusing used OTP must fail"
        except HTTPException as e:
            assert e.status_code == 400
            assert "already been used" in e.detail.lower()
            logger.info("✓ Used OTP reuse rejected: %s", e.detail)

        # Restore verified
        created_user.is_verified = True
        db.commit()

        # -------------------------------------------------------------
        # 11. Test Admin approval workflow remains intact
        # -------------------------------------------------------------
        logger.info("[TEST 11] Testing admin approval workflow...")
        # Verified user still cannot login because business is PENDING
        try:
            auth_service.login(LoginRequest(email=test_email, password=test_password))
            assert False, "Login must fail while business is PENDING admin approval"
        except HTTPException as e:
            assert e.status_code == 403
            assert "pending administrator approval" in e.detail.lower()
            logger.info("✓ Verified user blocked with pending approval message: %s", e.detail)

        # Admin approves business
        approval_service = MerchantApprovalService(db)
        approved_biz = approval_service.approve_business(created_biz.id)
        assert approved_biz.status == BusinessStatus.ACTIVE.value
        logger.info("✓ Business approved by admin.")

        # Now login must succeed and issue token
        login_token = auth_service.login(LoginRequest(email=test_email, password=test_password))
        assert "access_token" in login_token
        assert login_token["token_type"] == "bearer"
        logger.info("✓ Login succeeded after admin approval! Access token issued.")

        # -------------------------------------------------------------
        # 12. Test Brevo error handling during registration
        # -------------------------------------------------------------
        logger.info("[TEST 12] Testing Brevo error handling during registration...")
        fail_email = f"fail_{uuid.uuid4().hex[:8]}@example.com"
        fail_payload = BusinessCreate(
            business=BusinessInfo(
                business_name="Fail Bistro",
                business_type_id=bt.id,
                phone="9876543210",
                country="India",
                currency="INR",
                timezone="Asia/Kolkata",
                address="Mumbai",
            ),
            owner=OwnerCreate(
                owner_name="Fail Owner",
                owner_email=fail_email,
                password=test_password,
            ),
        )

        with patch("app.services.brevo_service.requests.post") as mock_brevo_fail:
            mock_resp = MagicMock()
            mock_resp.status_code = 400
            mock_resp.text = "Sender email is not verified in Brevo"
            mock_brevo_fail.return_value = mock_resp

            try:
                auth_service.register(fail_payload)
                assert False, "Registration must fail if Brevo delivery fails"
            except HTTPException as e:
                assert e.status_code == 502
                logger.info("✓ Registration cleanly failed with 502 when Brevo rejects email: %s", e.detail)

            # Ensure transaction was rolled back — no orphaned user or business
            rolled_back_user = db.query(User).filter(User.email == fail_email).first()
            rolled_back_biz = db.query(Business).filter(Business.email == fail_email).first()
            assert rolled_back_user is None, "User should be rolled back"
            assert rolled_back_biz is None, "Business should be rolled back"
            logger.info("Database transaction rolled back cleanly on email failure.")

        print("\n=======================================================")
        print("[SUCCESS] ALL 12 OTP & REGISTRATION FLOW TESTS PASSED SUCCESSFULLY!")
        print("=======================================================\n")

    finally:
        # Clean up test entities
        try:
            db.query(EmailOTP).filter(EmailOTP.email.in_([test_email, fail_email])).delete(synchronize_session=False)
            db.query(User).filter(User.email.in_([test_email, fail_email])).delete(synchronize_session=False)
            db.query(Business).filter(Business.email.in_([test_email, fail_email])).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()
        db.close()


if __name__ == "__main__":
    test_comprehensive_otp_verification_flow()
