import hashlib
import hmac
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.business import Business, BusinessStatus
from app.models.otp import EmailOTP
from app.models.user import User
from app.repositories.business_repository import BusinessRepository
from app.repositories.business_type_repository import BusinessTypeRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest
from app.schemas.business import BusinessCreate
from app.services.brevo_service import BrevoService

logger = logging.getLogger(__name__)


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP."""
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(email: str, otp: str) -> str:
    """Generate HMAC-SHA256 hash of email + OTP using settings.SECRET_KEY."""
    normalized_email = email.lower().strip()
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"{normalized_email}:{otp}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_otp_hash(email: str, otp: str, stored_hash: str) -> bool:
    """Safely verify OTP hash in constant time."""
    computed_hash = hash_otp(email, otp)
    return hmac.compare_digest(computed_hash, stored_hash)


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

    def register(self, data: BusinessCreate) -> dict:
        clean_email = data.owner.owner_email.strip().lower()
        logger.info(
            "Register request received | email=%s",
            clean_email,
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
                    if owner_user and not (owner_user.is_verified or owner_user.email_verified):
                        # Allow resending verification / updating draft credentials
                        otp = generate_otp()
                        hashed_otp_val = hash_otp(clean_email, otp)
                        now_utc = datetime.now(timezone.utc)
                        expires_at = now_utc + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

                        owner_user.hashed_password = hash_password(data.owner.password)
                        owner_user.is_verified = False
                        owner_user.email_verified = False
                        owner_user.verification_code_hash = hashed_otp_val
                        owner_user.verification_code_expires_at = expires_at
                        owner_user.verification_attempts = 0
                        owner_user.verification_last_sent_at = now_utc

                        otp_rec = EmailOTP(
                            email=clean_email,
                            hashed_otp=hashed_otp_val,
                            expires_at=expires_at,
                            attempts=0,
                            is_used=False,
                        )
                        self.db.add(otp_rec)

                        # Send via Brevo before commit
                        brevo = BrevoService()
                        brevo.send_otp_email(to_email=clean_email, otp=otp, to_name=owner_user.name)

                        self.db.commit()
                        return {
                            "success": True,
                            "requires_verification": True,
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

                    otp = generate_otp()
                    hashed_otp_val = hash_otp(clean_email, otp)
                    now_utc = datetime.now(timezone.utc)
                    expires_at = now_utc + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

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
                        owner_user.email = clean_email
                        owner_user.hashed_password = hash_password(data.owner.password)
                        owner_user.role = "OWNER"
                        owner_user.status = "ACTIVE"
                        owner_user.is_active = True
                        owner_user.is_verified = False
                        owner_user.email_verified = False
                        owner_user.email_verified_at = None
                        owner_user.verification_code_hash = hashed_otp_val
                        owner_user.verification_code_expires_at = expires_at
                        owner_user.verification_attempts = 0
                        owner_user.verification_last_sent_at = now_utc
                    else:
                        owner_user = User(
                            business_id=existing_biz.id,
                            name=data.owner.owner_name,
                            email=clean_email,
                            hashed_password=hash_password(data.owner.password),
                            role="OWNER",
                            status="ACTIVE",
                            is_active=True,
                            is_verified=False,
                            email_verified=False,
                            email_verified_at=None,
                            verification_code_hash=hashed_otp_val,
                            verification_code_expires_at=expires_at,
                            verification_attempts=0,
                            verification_last_sent_at=now_utc,
                        )
                        owner_user = self.user_repo.create(owner_user)

                    # Initialize or ensure defaults with commit=False
                    AutomationService(self.db).init_default_rules_for_business(existing_biz.id, commit=False)
                    MessageTemplateService(self.db).init_default_templates_for_business(existing_biz.id, commit=False)
                    BusinessSettingsService(self.db).init_default_settings_for_business(existing_biz.id, commit=False)

                    otp_rec = EmailOTP(
                        email=clean_email,
                        hashed_otp=hashed_otp_val,
                        expires_at=expires_at,
                        attempts=0,
                        is_used=False,
                    )
                    self.db.add(otp_rec)

                    # Dispatch via Brevo before commit
                    brevo = BrevoService()
                    brevo.send_otp_email(to_email=clean_email, otp=otp, to_name=owner_user.name)

                    self.db.commit()
                    self.db.refresh(owner_user)
                    self.db.refresh(existing_biz)

                    return {
                        "success": True,
                        "requires_verification": True,
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
                email=clean_email,
                phone=data.business.phone,
                country=data.business.country,
                currency=data.business.currency,
                timezone=data.business.timezone,
                address=data.business.address,
                subscription_plan_id=starter_plan.id if starter_plan else None,
            )
            business = self.business_repo.create(business)

            # 4. Create Owner User
            otp = generate_otp()
            hashed_otp_val = hash_otp(clean_email, otp)
            now_utc = datetime.now(timezone.utc)
            expires_at = now_utc + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

            user = User(
                business_id=business.id,
                name=data.owner.owner_name,
                email=clean_email,
                hashed_password=hash_password(data.owner.password),
                role="OWNER",
                status="ACTIVE",
                is_active=True,
                is_verified=False,
                email_verified=False,
                email_verified_at=None,
                verification_code_hash=hashed_otp_val,
                verification_code_expires_at=expires_at,
                verification_attempts=0,
                verification_last_sent_at=now_utc,
            )
            user = self.user_repo.create(user)

            # 5. Initialize defaults with commit=False
            AutomationService(self.db).init_default_rules_for_business(business.id, commit=False)
            MessageTemplateService(self.db).init_default_templates_for_business(business.id, commit=False)
            BusinessSettingsService(self.db).init_default_settings_for_business(business.id, commit=False)

            # 6. Generate secure 6-digit OTP and store hashed record
            otp_record = EmailOTP(
                email=clean_email,
                hashed_otp=hashed_otp_val,
                expires_at=expires_at,
                attempts=0,
                is_used=False,
            )
            self.db.add(otp_record)

            # 7. Dispatch OTP through Brevo service BEFORE final commit
            brevo = BrevoService()
            brevo.send_otp_email(to_email=clean_email, otp=otp, to_name=user.name)

            # 8. Atomic commit
            self.db.commit()
            self.db.refresh(user)
            self.db.refresh(business)

            logger.info(
                "Registration committed & OTP sent | user_id=%s business_id=%s",
                user.id,
                business.id,
            )

            return {
                "success": True,
                "message": "Registration successful. Please verify your email with the 6-digit verification code sent to your inbox.",
                "email": clean_email,
                "requires_verification": True,
                "requires_email_verification": True,
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
    # Verify OTP
    # ------------------------------------------------------------------

    def verify_otp(self, email: str, otp: str) -> dict:
        """
        Verify submitted 6-digit OTP code against the stored hash.
        Marks email as verified while preserving the existing PENDING admin approval status.
        """
        clean_email = (email or "").strip().lower()
        clean_otp = (otp or "").strip()
        logger.info("Verify OTP request | email=%s", clean_email)

        if not clean_email or not clean_otp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and 6-digit verification code are required.",
            )

        user = self.user_repo.get_by_email(clean_email)
        if not user:
            # Fallback search by business email
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
            logger.warning("Verify OTP rejected — user not found | email=%s", clean_email)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account with this email address was not found.",
            )

        if user.is_verified and user.email_verified:
            return {
                "success": True,
                "verified": True,
                "email_verified": True,
                "status": "ADMIN_PENDING",
                "message": "Email is already verified. Your account is pending administrator approval.",
            }

        # Find latest OTP record for this email
        otp_record = (
            self.db.query(EmailOTP)
            .filter(EmailOTP.email == clean_email)
            .order_by(EmailOTP.created_at.desc())
            .first()
        )

        if not otp_record:
            logger.warning("Verify OTP rejected — no OTP record | email=%s", clean_email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please request a new code.",
            )

        if otp_record.is_used:
            logger.warning("Verify OTP rejected — already used | email=%s", clean_email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This verification code has already been used. Please request a new one.",
            )

        now = datetime.now(timezone.utc)
        exp = otp_record.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if now > exp:
            logger.warning("Verify OTP rejected — expired | email=%s", clean_email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please request a new code.",
            )

        if otp_record.attempts >= 5:
            logger.warning("Verify OTP rejected — max attempts exceeded | email=%s", clean_email)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. This code is locked. Please request a new code.",
            )

        if not verify_otp_hash(clean_email, clean_otp, otp_record.hashed_otp):
            otp_record.attempts += 1
            self.db.commit()
            remaining = 5 - otp_record.attempts
            logger.warning(
                "Verify OTP rejected — invalid code | email=%s attempts=%d",
                clean_email,
                otp_record.attempts,
            )
            if remaining > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid verification code. {remaining} attempt(s) remaining.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many failed attempts. This code is locked. Please request a new code.",
                )

        # Successful verification
        otp_record.is_used = True
        user.is_verified = True
        user.email_verified = True
        user.email_verified_at = now
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

        logger.info("Email verified successfully | user_id=%s email=%s", user.id, clean_email)

        # Non-blocking notification to admin
        try:
            from app.services.email_service import EmailService
            bt_name = getattr(business.business_type, "name", "") if business and business.business_type else ""
            EmailService.send_new_signup_notification(
                business_name=business.name if business else "N/A",
                owner_name=user.name,
                owner_email=user.email,
                business_type=bt_name,
                signup_time=business.created_at or now if business else now,
                business_id=str(business.id) if business else None,
            )
        except Exception as email_err:
            logger.warning("Admin signup notification skipped: %s", str(email_err))

        return {
            "success": True,
            "verified": True,
            "email_verified": True,
            "status": "ADMIN_PENDING",
            "message": "Email verified successfully! Your registration is now pending administrator approval.",
        }

    def verify_email(self, email: str, code: str) -> dict:
        """Alias for verify_otp to support both frontend and API route patterns."""
        return self.verify_otp(email=email, otp=code)

    # ------------------------------------------------------------------
    # Resend OTP
    # ------------------------------------------------------------------

    def resend_otp(self, email: str) -> dict:
        """
        Enforces 60-second cooldown, invalidates older active OTPs, generates
        a new 6-digit code, and dispatches via Brevo.
        """
        clean_email = (email or "").strip().lower()
        logger.info("Resend OTP request | email=%s", clean_email)

        user = self.user_repo.get_by_email(clean_email)
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
            logger.warning("Resend OTP rejected — user not found | email=%s", clean_email)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account with this email address was not found.",
            )

        if user.is_verified and user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your email is already verified. No new code is required.",
            )

        # Rate limiting: 60s cooldown from latest OTP record
        now = datetime.now(timezone.utc)
        latest_otp = (
            self.db.query(EmailOTP)
            .filter(EmailOTP.email == clean_email)
            .order_by(EmailOTP.created_at.desc())
            .first()
        )

        if latest_otp and latest_otp.created_at:
            created_at = latest_otp.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            elapsed = (now - created_at).total_seconds()
            if elapsed < 60:
                cooldown_remaining = int(60 - elapsed)
                logger.warning(
                    "Resend OTP rejected — cooldown active | email=%s remaining=%ds",
                    clean_email,
                    cooldown_remaining,
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {cooldown_remaining} seconds before requesting a new code.",
                )

        # Invalidate any previous unused OTPs
        self.db.query(EmailOTP).filter(
            EmailOTP.email == clean_email,
            EmailOTP.is_used == False,
        ).update({"is_used": True})

        # Generate new OTP
        otp = generate_otp()
        hashed = hash_otp(clean_email, otp)
        expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

        new_record = EmailOTP(
            email=clean_email,
            hashed_otp=hashed,
            expires_at=expires_at,
            attempts=0,
            is_used=False,
        )
        self.db.add(new_record)

        # Sync on user entity as well
        user.verification_code_hash = hashed
        user.verification_code_expires_at = expires_at
        user.verification_attempts = 0
        user.verification_last_sent_at = now

        # Send via Brevo before commit
        brevo = BrevoService()
        brevo.send_otp_email(to_email=clean_email, otp=otp, to_name=user.name)

        self.db.commit()
        logger.info("Resend OTP dispatched successfully | email=%s", clean_email)

        return {
            "success": True,
            "message": "A new verification code has been sent to your email."
        }

    def resend_verification(self, email: str) -> dict:
        """Alias for resend_otp to support both frontend and API route patterns."""
        return self.resend_otp(email=email)

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

        # 1. Lookup by email or login_id
        if "@" in identifier:
            user = self.db.scalar(
                select(User)
                .join(Business, User.business_id == Business.id)
                .where(
                    func.lower(User.email) == identifier.lower(),
                    Business.is_deleted.is_(False),
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

        # 3. Guard: Email verification check
        if not (user.is_verified or user.email_verified):
            logger.warning("Login rejected — email not verified | user_id=%s email=%s", user.id, user.email)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address before signing in.",
            )

        # 4. Guard: active account
        if not user.is_active or (user.status and user.status.upper() in ["INACTIVE", "DELETED"]):
            logger.warning("Login rejected — account inactive | user_id=%s", user.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This staff account has been deactivated by Business Owner.",
            )

        # 5. Guard: business status must be ACTIVE
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

        # 6. Record last_login timestamp
        user.last_login = datetime.now(timezone.utc)
        self.db.commit()

        # 7. Issue JWT access token
        token = create_access_token(
            {
                "sub": str(user.id),
                "business_id": str(user.business_id),
                "role": user.role,
            }
        )
        logger.info("Login successful | user_id=%s role=%s", user.id, user.role)

        # 8. Register / update active device session
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