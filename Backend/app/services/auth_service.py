import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_otp,
    hash_password,
    verify_otp,
    verify_password,
)
from app.models.business import Business, BusinessStatus
from app.models.user import User
from app.repositories.business_repository import BusinessRepository
from app.repositories.business_type_repository import BusinessTypeRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest
from app.schemas.business import BusinessCreate

logger = logging.getLogger(__name__)


def validate_password_complexity(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter (A-Z).",
        )
    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one lowercase letter (a-z).",
        )
    if not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number (0-9).",
        )
    if not re.search(r"[^a-zA-Z0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one special character (e.g. !@#$%^&*()_+-=).",
        )


class AuthService:

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.business_repo = BusinessRepository(db)
        self.business_type_repo = BusinessTypeRepository(db)

    def register(self, data: BusinessCreate):
        logger.info(
            "Register request received | email=%s",
            data.owner.owner_email,
        )

        try:
            # 0. Validate password complexity
            validate_password_complexity(data.owner.password)

            # 1. Validate business_type_id exists
            business_type = self.business_type_repo.get_by_id(
                data.business.business_type_id
            )

            if not business_type:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Business type '{data.business.business_type_id}' does not exist.",
                )

            clean_email = data.owner.owner_email.strip().lower()

            # Clean up soft-deleted businesses/users with this email to prevent unique constraint conflict
            legacy_deleted_bizs = list(self.db.scalars(
                select(Business).where(
                    func.lower(Business.email) == clean_email,
                    Business.is_deleted.is_(True),
                )
            ).all())
            for b in legacy_deleted_bizs:
                import uuid as uuid_lib
                b.email = f"deleted_{uuid_lib.uuid4().hex[:8]}_{b.email}"

            legacy_deleted_users = list(self.db.scalars(
                select(User)
                .join(Business, User.business_id == Business.id)
                .where(
                    func.lower(User.email) == clean_email,
                    (Business.is_deleted.is_(True) | (User.status == "DELETED")),
                )
            ).all())
            for u in legacy_deleted_users:
                import uuid as uuid_lib
                u.email = f"deleted_{uuid_lib.uuid4().hex[:8]}_{u.email}"

            # 2. Check for existing non-deleted business with this email
            existing_biz = self.db.scalar(
                select(Business).where(
                    func.lower(Business.email) == clean_email,
                    Business.is_deleted.is_(False),
                )
            )

            # If not found by business.email, also check by user.email
            if not existing_biz:
                existing_user = self.db.scalar(
                    select(User)
                    .join(Business, User.business_id == Business.id)
                    .where(
                        func.lower(User.email) == clean_email,
                        Business.is_deleted.is_(False),
                        User.status != "DELETED",
                    )
                )
                if existing_user:
                    existing_biz = existing_user.business

            from app.models.subscription_plan import SubscriptionPlan
            starter_plan = self.db.scalar(
                select(SubscriptionPlan).where(SubscriptionPlan.name == "STARTER")
            )

            from app.services.automation_service import AutomationService
            from app.services.business_settings_service import BusinessSettingsService
            from app.services.message_template_service import MessageTemplateService

            if existing_biz:
                # Check status of existing business
                if existing_biz.status == BusinessStatus.PENDING.value:
                    owner_user = self.db.scalar(
                        select(User).where(
                            User.business_id == existing_biz.id,
                            func.lower(User.role) == "owner",
                            User.status != "DELETED",
                        )
                    )
                    if owner_user and not owner_user.email_verified:
                        # Allow resending verification / updating draft credentials
                        otp = str(secrets.randbelow(900000) + 100000)
                        owner_user.hashed_password = hash_password(data.owner.password)
                        owner_user.verification_code_hash = hash_otp(otp)
                        owner_user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
                        owner_user.verification_attempts = 0
                        owner_user.verification_last_sent_at = datetime.now(timezone.utc)
                        self.db.commit()

                        try:
                            from app.services.email_service import EmailService
                            EmailService.send_verification_otp_email(
                                to_email=clean_email,
                                owner_name=owner_user.name,
                                otp_code=otp,
                                expires_in_minutes=10,
                            )
                        except Exception as email_err:
                            logger.warning("Failed to send verification email on re-signup: %s", str(email_err))

                        return {
                            "success": True,
                            "requires_email_verification": True,
                            "email": clean_email,
                            "message": "Verification code sent to your email.",
                        }

                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="An account with this email is already pending administrator approval.",
                    )
                elif existing_biz.status in [
                    BusinessStatus.ACTIVE.value,
                    BusinessStatus.SUSPENDED.value,
                ]:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="An account with this email already exists.",
                    )
                elif existing_biz.status == BusinessStatus.REJECTED.value:
                    # ALLOW REAPPLICATION: Update and reset rejected business to PENDING
                    logger.info(
                        "Reapplying rejected business registration | business_id=%s email=%s",
                        existing_biz.id,
                        clean_email,
                    )
                    existing_biz.business_type_id = data.business.business_type_id
                    existing_biz.name = data.business.business_name
                    existing_biz.owner_name = data.owner.owner_name
                    existing_biz.email = data.owner.owner_email.strip()
                    existing_biz.phone = data.business.phone
                    existing_biz.country = data.business.country
                    existing_biz.currency = data.business.currency
                    existing_biz.timezone = data.business.timezone
                    existing_biz.address = data.business.address
                    existing_biz.status = BusinessStatus.PENDING.value
                    existing_biz.rejection_reason = None
                    existing_biz.approved_at = None
                    existing_biz.is_active = True
                    existing_biz.is_deleted = False
                    existing_biz.created_at = datetime.now(timezone.utc)
                    if not existing_biz.subscription_plan_id and starter_plan:
                        existing_biz.subscription_plan_id = starter_plan.id

                    otp = str(secrets.randbelow(900000) + 100000)

                    # Update or create owner user
                    owner_user = self.db.scalar(
                        select(User).where(
                            User.business_id == existing_biz.id,
                            func.lower(User.role) == "owner",
                        )
                    )
                    if not owner_user:
                        owner_user = self.db.scalar(
                            select(User).where(User.business_id == existing_biz.id)
                        )

                    if owner_user:
                        owner_user.name = data.owner.owner_name
                        owner_user.email = data.owner.owner_email.strip()
                        owner_user.hashed_password = hash_password(data.owner.password)
                        owner_user.role = "OWNER"
                        owner_user.status = "ACTIVE"
                        owner_user.is_active = True
                        owner_user.email_verified = False
                        owner_user.email_verified_at = None
                        owner_user.verification_code_hash = hash_otp(otp)
                        owner_user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
                        owner_user.verification_attempts = 0
                        owner_user.verification_last_sent_at = datetime.now(timezone.utc)
                    else:
                        owner_user = User(
                            business_id=existing_biz.id,
                            name=data.owner.owner_name,
                            email=data.owner.owner_email.strip(),
                            hashed_password=hash_password(data.owner.password),
                            role="OWNER",
                            status="ACTIVE",
                            is_active=True,
                            email_verified=False,
                            email_verified_at=None,
                            verification_code_hash=hash_otp(otp),
                            verification_code_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
                            verification_attempts=0,
                            verification_last_sent_at=datetime.now(timezone.utc),
                        )
                        owner_user = self.user_repo.create(owner_user)

                    # Initialize or ensure defaults
                    AutomationService(self.db).init_default_rules_for_business(existing_biz.id)
                    MessageTemplateService(self.db).init_default_templates_for_business(existing_biz.id)
                    BusinessSettingsService(self.db).init_default_settings_for_business(existing_biz.id)

                    self.db.commit()
                    self.db.refresh(owner_user)
                    self.db.refresh(existing_biz)

                    # Dispatch verification code email to re-applying merchant
                    try:
                        from app.services.email_service import EmailService
                        EmailService.send_verification_otp_email(
                            to_email=clean_email,
                            owner_name=owner_user.name,
                            otp_code=otp,
                            expires_in_minutes=10,
                        )
                        logger.info("Verification code sent to re-applying user email | user_id=%s email=%s", str(owner_user.id), clean_email)
                    except Exception as email_err:
                        logger.warning("Failed to send verification email on reapplication: %s", str(email_err))

                    return {
                        "success": True,
                        "requires_email_verification": True,
                        "email": clean_email,
                        "message": "Verification code sent to your email.",
                    }
                else:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="An account with this email already exists.",
                    )

            # 3. Create Brand New Business
            business = Business(
                business_type_id=data.business.business_type_id,
                name=data.business.business_name,
                owner_name=data.owner.owner_name,
                email=data.owner.owner_email.strip(),
                phone=data.business.phone,
                country=data.business.country,
                currency=data.business.currency,
                timezone=data.business.timezone,
                address=data.business.address,
                subscription_plan_id=starter_plan.id if starter_plan else None,
            )
            business = self.business_repo.create(business)

            otp = str(secrets.randbelow(900000) + 100000)

            # 4. Create Owner User with email verification pending
            user = User(
                business_id=business.id,
                name=data.owner.owner_name,
                email=data.owner.owner_email.strip(),
                hashed_password=hash_password(data.owner.password),
                role="OWNER",
                status="ACTIVE",
                is_active=True,
                email_verified=False,
                email_verified_at=None,
                verification_code_hash=hash_otp(otp),
                verification_code_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
                verification_attempts=0,
                verification_last_sent_at=datetime.now(timezone.utc),
            )
            user = self.user_repo.create(user)

            # 5. Initialize defaults
            AutomationService(self.db).init_default_rules_for_business(business.id)
            MessageTemplateService(self.db).init_default_templates_for_business(business.id)
            BusinessSettingsService(self.db).init_default_settings_for_business(business.id)

            # 6. Commit transaction
            self.db.commit()
            self.db.refresh(user)
            self.db.refresh(business)

            # 7. Send 6-digit OTP verification email to user
            try:
                from app.services.email_service import EmailService
                EmailService.send_verification_otp_email(
                    to_email=clean_email,
                    owner_name=user.name,
                    otp_code=otp,
                    expires_in_minutes=10,
                )
                logger.info("Verification code generated and sent to user email | user_id=%s email=%s", str(user.id), clean_email)
            except Exception as email_err:
                logger.warning("Non-blocking verification email send warning: %s", str(email_err))

            return {
                "success": True,
                "requires_email_verification": True,
                "email": clean_email,
                "message": "Verification code sent to your email.",
            }

        except HTTPException:
            self.db.rollback()
            raise

        except IntegrityError as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A record with the provided details already exists.",
            ) from exc

        except Exception as exc:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Registration failed due to an internal error. Please try again.",
            ) from exc

    # ------------------------------------------------------------------
    # Email Verification & Resend Endpoints
    # ------------------------------------------------------------------

    def verify_email(self, email: str, code: str) -> dict:
        """
        Verify the 6-digit OTP code sent to user email.
        On success, marks email_verified=True and dispatches admin approval notification.
        """
        clean_email = (email or "").strip().lower()
        clean_code = (code or "").strip()
        logger.info("Email verification attempt | email=%s", clean_email)

        if not clean_email or not clean_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and 6-digit verification code are required.",
            )

        user = self.db.scalar(
            select(User)
            .join(Business, User.business_id == Business.id)
            .where(
                func.lower(User.email) == clean_email,
                Business.is_deleted.is_(False),
                User.status != "DELETED",
            )
        )

        if not user:
            biz = self.db.scalar(
                select(Business).where(
                    func.lower(Business.email) == clean_email,
                    Business.is_deleted.is_(False),
                )
            )
            if biz:
                user = self.db.scalar(
                    select(User).where(
                        User.business_id == biz.id,
                        User.role == "OWNER",
                        User.status != "DELETED",
                    )
                )

        if not user:
            logger.warning("Email verification rejected — user not found | email=%s", clean_email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification request.",
            )

        if user.email_verified:
            return {
                "success": True,
                "email_verified": True,
                "status": "ADMIN_PENDING",
                "message": "Email is already verified. Your registration request has been sent for admin approval.",
            }

        if not user.verification_code_hash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active verification code found. Please request a new code.",
            )

        # Check maximum verification attempts (5 attempts limit)
        if (user.verification_attempts or 0) >= 5:
            user.verification_code_hash = None
            user.verification_code_expires_at = None
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect attempts. Please request a new verification code.",
            )

        now_utc = datetime.now(timezone.utc)
        if user.verification_code_expires_at and now_utc > user.verification_code_expires_at:
            user.verification_code_hash = None
            user.verification_code_expires_at = None
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This verification code has expired. Please request a new code.",
            )

        if not verify_otp(clean_code, user.verification_code_hash):
            user.verification_attempts = (user.verification_attempts or 0) + 1
            if user.verification_attempts >= 5:
                user.verification_code_hash = None
                user.verification_code_expires_at = None
                self.db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Too many incorrect attempts. Please request a new verification code.",
                )
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect verification code. Please try again.",
            )

        # Verification successful
        user.email_verified = True
        user.email_verified_at = now_utc
        user.verification_code_hash = None
        user.verification_code_expires_at = None
        user.verification_attempts = 0
        user.verification_last_sent_at = None

        business = user.business
        if business and business.status != BusinessStatus.ACTIVE.value:
            business.status = BusinessStatus.PENDING.value

        self.db.commit()
        self.db.refresh(user)
        if business:
            self.db.refresh(business)

        logger.info("Email verified successfully | user_id=%s email=%s", str(user.id), user.email)

        # Send Admin New Signup Notification Email now that merchant is email-verified
        try:
            from app.services.email_service import EmailService
            bt_name = getattr(business.business_type, "name", "") if business and business.business_type else ""
            sent, err_msg = EmailService.send_new_signup_notification(
                business_name=business.name if business else "N/A",
                owner_name=user.name,
                owner_email=user.email,
                business_type=bt_name,
                signup_time=business.created_at or now_utc if business else now_utc,
                business_id=str(business.id) if business else None,
            )
            if sent:
                logger.info("Admin signup notification email sent successfully for user ID %s (business ID: %s)", str(user.id), str(business.id) if business else "N/A")
            else:
                logger.warning("Failed to send admin signup notification email for user ID %s: %s", str(user.id), err_msg or "Unknown error")
        except Exception as email_err:
            logger.warning("Non-blocking signup admin email notification error: %s", str(email_err))

        return {
            "success": True,
            "email_verified": True,
            "status": "ADMIN_PENDING",
            "message": "Email verified successfully. Your registration request has been sent for admin approval.",
        }

    def resend_verification(self, email: str) -> dict:
        """
        Resend a new 6-digit OTP code to unverified user email with 60-second rate limiting cooldown.
        """
        clean_email = (email or "").strip().lower()
        logger.info("Resend verification code requested | email=%s", clean_email)

        generic_response = {
            "success": True,
            "message": "A new verification code has been sent to your email.",
        }

        if not clean_email:
            return generic_response

        user = self.db.scalar(
            select(User)
            .join(Business, User.business_id == Business.id)
            .where(
                func.lower(User.email) == clean_email,
                Business.is_deleted.is_(False),
                User.status != "DELETED",
            )
        )

        if not user:
            biz = self.db.scalar(
                select(Business).where(
                    func.lower(Business.email) == clean_email,
                    Business.is_deleted.is_(False),
                )
            )
            if biz:
                user = self.db.scalar(
                    select(User).where(
                        User.business_id == biz.id,
                        User.role == "OWNER",
                        User.status != "DELETED",
                    )
                )

        if not user:
            logger.info("Resend verification: user not found for %s", clean_email)
            return generic_response

        if user.email_verified:
            return {
                "success": True,
                "message": "This email is already verified. You can proceed to sign in.",
            }

        now_utc = datetime.now(timezone.utc)

        # Enforce 60-second cooldown
        if user.verification_last_sent_at:
            elapsed = (now_utc - user.verification_last_sent_at).total_seconds()
            if elapsed < 60:
                remaining = int(60 - elapsed)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {remaining} seconds before requesting another code.",
                )

        otp = str(secrets.randbelow(900000) + 100000)
        user.verification_code_hash = hash_otp(otp)
        user.verification_code_expires_at = now_utc + timedelta(minutes=10)
        user.verification_attempts = 0
        user.verification_last_sent_at = now_utc

        self.db.commit()

        try:
            from app.services.email_service import EmailService
            EmailService.send_verification_otp_email(
                to_email=user.email,
                owner_name=user.name,
                otp_code=otp,
                expires_in_minutes=10,
            )
            logger.info("Resent verification code to %s", user.email)
        except Exception as email_err:
            logger.warning("Failed to resend verification email: %s", str(email_err))

        return {
            "success": True,
            "message": "A new verification code has been sent to your email.",
        }

    # ------------------------------------------------------------------
    # Login (Supports Owner Email OR Staff Auto-Generated Login ID)
    # ------------------------------------------------------------------

    def login(self, data: LoginRequest) -> dict:
        """
        Unified login endpoint accepting Email or Auto-Generated Staff Login ID.
          - Contains '@' -> Authenticates Business Owner by Email
          - Otherwise -> Authenticates Staff Member by Login ID (e.g., JAIL-001)
        """
        identifier = (data.email or "").strip()
        logger.info("Login attempt | identifier=%s", identifier)

        _invalid = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Email / Staff ID or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        if not identifier:
            raise _invalid

        # 1. Detection: If identifier contains '@', lookup by email; else lookup by login_id (ignore soft-deleted)
        if "@" in identifier:
            user = self.db.scalar(
                select(User)
                .join(Business, User.business_id == Business.id)
                .where(
                    func.lower(User.email) == identifier.lower(),
                    Business.is_deleted.is_(False),
                    User.is_active.is_(True),
                    User.status != "DELETED",
                )
            )
        else:
            user = self.db.scalar(
                select(User)
                .join(Business, User.business_id == Business.id)
                .where(
                    func.lower(User.login_id) == identifier.lower(),
                    Business.is_deleted.is_(False),
                    User.is_active.is_(True),
                    User.status != "DELETED",
                )
            )

        if not user:
            logger.warning("Login rejected — identifier not found | identifier=%s", identifier)
            raise _invalid

        # 2. Verify password
        if not verify_password(data.password, user.hashed_password):
            logger.warning("Login rejected — wrong password | identifier=%s", identifier)
            raise _invalid

        # 2.5. Guard: Email verification check
        if not user.email_verified:
            logger.warning("Login rejected — email not verified | user_id=%s email=%s", user.id, user.email)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address before logging in.",
            )

        # 3. Guard: active account and status ACTIVE
        if not user.is_active or (user.status and user.status.upper() in ["INACTIVE", "DELETED"]):
            logger.warning("Login rejected — account inactive | user_id=%s", user.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This staff account has been deactivated by Business Owner.",
            )

        # 4. Guard: business status must be ACTIVE
        business = self.business_repo.get_by_id(user.business_id)
        if not business or business.is_deleted or business.status != "ACTIVE":
            status_val = business.status if (business and not business.is_deleted) else "DELETED"
            logger.warning(
                "Login rejected — business status not ACTIVE | business_id=%s status=%s",
                user.business_id,
                status_val,
            )
            if status_val == "DELETED":
                raise _invalid
            elif status_val == "PENDING":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your business account registration is pending administrator approval.",
                )
            elif status_val == "REJECTED":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your business account registration was rejected.",
                )
            elif status_val == "SUSPENDED":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your business account has been suspended.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your business account is not active.",
                )

        # 5. Record last_login timestamp
        user.last_login = datetime.now(timezone.utc)
        self.db.commit()

        # 6. Issue JWT access token
        token = create_access_token(
            {
                "sub": str(user.id),
                "business_id": str(user.business_id),
                "role": user.role,
            }
        )
        logger.info("Login successful | user_id=%s role=%s", user.id, user.role)

        # 7. Register / update active device session
        try:
            from app.repositories.user_session_repository import UserSessionRepository
            session_repo = UserSessionRepository(self.db)
            session_repo.register_or_update_session(
                user_id=user.id,
                business_id=user.business_id,
                device_id=getattr(data, "device_id", "web_default") or "web_default",
                device_name=getattr(data, "device_name", "Web Browser"),
                device_type=getattr(data, "device_type", "Desktop"),
                platform=getattr(data, "platform", "Web"),
            )
        except Exception as exc:
            logger.warning("Non-blocking device session registration error: %s", str(exc))

        return {
            "access_token": token,
            "token_type": "bearer",
        }

    def logout(self, user_id: str, device_id: str = "web_default") -> bool:
        """Mark user device session as inactive upon logout."""
        from uuid import UUID
        from app.repositories.user_session_repository import UserSessionRepository
        session_repo = UserSessionRepository(self.db)
        uid = UUID(user_id) if isinstance(user_id, str) else user_id
        active_sessions = session_repo.list_active_sessions(uid)
        for s in active_sessions:
            if s.device_id == device_id:
                session_repo.deactivate_session(s.id, uid)
                return True
        return False

    def list_active_devices(self, user_id: str):
        from uuid import UUID
        from app.repositories.user_session_repository import UserSessionRepository
        uid = UUID(user_id) if isinstance(user_id, str) else user_id
        return UserSessionRepository(self.db).list_active_sessions(uid)

    def revoke_device(self, user_id: str, session_id: str) -> bool:
        from uuid import UUID
        from app.repositories.user_session_repository import UserSessionRepository
        uid = UUID(user_id) if isinstance(user_id, str) else user_id
        sid = UUID(session_id) if isinstance(session_id, str) else session_id
        return UserSessionRepository(self.db).deactivate_session(sid, uid)

    def count_active_devices(self, user_id: str) -> int:
        from uuid import UUID
        from app.repositories.user_session_repository import UserSessionRepository
        uid = UUID(user_id) if isinstance(user_id, str) else user_id
        return UserSessionRepository(self.db).count_active_sessions(uid)

    def forgot_password(
        self,
        email: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> dict[str, str]:
        """
        Initiate password reset flow for a user.
        Always returns a generic message to prevent account enumeration attacks.
        """
        import hashlib
        import secrets
        from datetime import timedelta
        from app.core.config import settings
        from app.models.password_reset_token import PasswordResetToken
        from app.services.email_service import EmailService

        clean_email = email.strip().lower()
        logger.info("Forgot password requested | email=%s", clean_email)

        generic_response = {
            "message": (
                "If an account exists with this email, we've sent you a password reset link. "
                "Please check your inbox."
            )
        }

        try:
            # 1. Look up active user by email
            user = self.db.scalar(
                select(User)
                .join(Business, User.business_id == Business.id)
                .where(
                    func.lower(User.email) == clean_email,
                    Business.is_deleted.is_(False),
                    User.status != "DELETED",
                )
            )

            # If not found by user.email, check business.email for the primary owner
            if not user:
                biz = self.db.scalar(
                    select(Business).where(
                        func.lower(Business.email) == clean_email,
                        Business.is_deleted.is_(False),
                    )
                )
                if biz:
                    user = self.db.scalar(
                        select(User).where(
                            User.business_id == biz.id,
                            User.role == "OWNER",
                            User.status != "DELETED",
                        )
                    )

            if not user:
                logger.info(
                    "Forgot password: no user found for email=%s (returning generic response)",
                    clean_email,
                )
                return generic_response

            # If business is deleted, do not issue reset token
            if user.business and user.business.is_deleted:
                return generic_response

            # 2. Invalidate any existing unused reset tokens for this user
            existing_tokens = list(self.db.scalars(
                select(PasswordResetToken).where(
                    PasswordResetToken.user_id == user.id,
                    PasswordResetToken.is_used.is_(False),
                )
            ).all())
            now_utc = datetime.now(timezone.utc)
            for old_tok in existing_tokens:
                old_tok.is_used = True
                old_tok.used_at = now_utc

            # 3. Generate cryptographically secure random token (32 bytes urlsafe)
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            expires_at = now_utc + timedelta(minutes=45)

            reset_entry = PasswordResetToken(
                user_id=user.id,
                email=clean_email,
                token_hash=token_hash,
                expires_at=expires_at,
                is_used=False,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            self.db.add(reset_entry)
            self.db.commit()

            # 4. Dispatch password reset email
            frontend_base = settings.FRONTEND_URL.rstrip("/")
            reset_url = f"{frontend_base}/reset-password?token={raw_token}"

            user_display_name = user.name or (user.business.owner_name if user.business else "User")

            EmailService.send_password_reset_email(
                to_email=clean_email,
                user_name=user_display_name,
                reset_url=reset_url,
                expires_in_minutes=45,
            )

        except Exception as exc:
            logger.error("Error during forgot_password processing: %s", str(exc))
            # Always return generic message to caller
            return generic_response

        return generic_response

    def reset_password(
        self,
        token: str,
        password: str,
        confirm_password: str,
    ) -> dict[str, str]:
        """
        Reset user password using a verified, unexpired, single-use token.
        """
        import hashlib
        from app.models.password_reset_token import PasswordResetToken

        if password != confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Passwords do not match.",
            )

        # Validate password complexity rules
        validate_password_complexity(password)

        clean_token = token.strip()
        if not clean_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This password reset link is invalid or has expired.",
            )

        token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()

        # Look up token in database
        reset_entry = self.db.scalar(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash,
            )
        )

        now_utc = datetime.now(timezone.utc)

        if not reset_entry or reset_entry.is_used or reset_entry.expires_at < now_utc:
            logger.warning(
                "Password reset rejected | token_found=%s is_used=%s expired=%s",
                bool(reset_entry),
                reset_entry.is_used if reset_entry else None,
                (reset_entry.expires_at < now_utc) if reset_entry else None,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This password reset link is invalid or has expired.",
            )

        # Look up associated user
        user = self.db.scalar(
            select(User).where(
                User.id == reset_entry.user_id,
                User.status != "DELETED",
            )
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This password reset link is invalid or has expired.",
            )

        # Update password hash
        user.hashed_password = hash_password(password)

        # Invalidate current reset token
        reset_entry.is_used = True
        reset_entry.used_at = now_utc

        # Invalidate any other active tokens for this user
        other_tokens = list(self.db.scalars(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.is_used.is_(False),
            )
        ).all())
        for tok in other_tokens:
            tok.is_used = True
            tok.used_at = now_utc

        self.db.commit()
        logger.info("Password reset successfully completed | user_id=%s email=%s", user.id, user.email)

        return {
            "message": "Your password has been updated successfully. You can now sign in with your new password."
        }