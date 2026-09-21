import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.business import Business
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


class AuthService:

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.business_repo = BusinessRepository(db)
        self.business_type_repo = BusinessTypeRepository(db)

    def register(self, data: BusinessCreate) -> dict:
        normalized_email = data.owner.owner_email.lower().strip()
        logger.info(
            "Register request received | email=%s",
            normalized_email,
        )

        try:
            # 1. Validate business_type_id exists
            logger.info(
                "Validating business_type_id | id=%s",
                data.business.business_type_id,
            )
            business_type = self.business_type_repo.get_by_id(
                data.business.business_type_id
            )
            if not business_type:
                logger.warning(
                    "Registration rejected — business_type_id not found | id=%s",
                    data.business.business_type_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Business type '{data.business.business_type_id}' does not exist.",
                )

            # 2. Guard: duplicate email
            existing_user = self.user_repo.get_by_email(normalized_email)
            if existing_user:
                logger.warning(
                    "Registration rejected — email already exists | email=%s",
                    normalized_email,
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                )

            # 3. Create Business (status defaults to PENDING)
            logger.info(
                "Creating business | name=%s type_id=%s",
                data.business.business_name,
                data.business.business_type_id,
            )
            business = Business(
                business_type_id=data.business.business_type_id,
                name=data.business.business_name,
                owner_name=data.owner.owner_name,
                email=normalized_email,
                phone=data.business.phone,
                country=data.business.country,
                currency=data.business.currency,
                timezone=data.business.timezone,
                address=data.business.address,
            )
            business = self.business_repo.create(business)
            logger.info("Business flushed | business_id=%s", business.id)

            # 4. Create Owner User — is_verified=False
            logger.info(
                "Creating owner user | email=%s business_id=%s",
                normalized_email,
                business.id,
            )
            user = User(
                business_id=business.id,
                name=data.owner.owner_name,
                email=normalized_email,
                hashed_password=hash_password(data.owner.password),
                role="OWNER",
                is_verified=False,
            )
            user = self.user_repo.create(user)
            logger.info("User flushed | user_id=%s", user.id)

            # 5. Initialize default automation rules, message templates, and business settings
            from app.services.automation_service import AutomationService
            from app.services.business_settings_service import BusinessSettingsService
            from app.services.message_template_service import MessageTemplateService
            AutomationService(self.db).init_default_rules_for_business(business.id, commit=False)
            MessageTemplateService(self.db).init_default_templates_for_business(business.id, commit=False)
            BusinessSettingsService(self.db).init_default_settings_for_business(business.id, commit=False)

            # 6. Generate secure 6-digit OTP and store hashed record
            otp = generate_otp()
            hashed = hash_otp(normalized_email, otp)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

            otp_record = EmailOTP(
                email=normalized_email,
                hashed_otp=hashed,
                expires_at=expires_at,
                attempts=0,
                is_used=False,
            )
            self.db.add(otp_record)

            # 7. Dispatch OTP through Brevo service BEFORE final commit
            # (If Brevo email dispatch fails, rollback cleanly)
            brevo = BrevoService()
            brevo.send_otp_email(to_email=normalized_email, otp=otp, to_name=user.name)

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
                "message": "Registration successful. Please verify your email with the 6-digit verification code sent to your inbox.",
                "email": normalized_email,
                "requires_verification": True,
            }

        except HTTPException:
            self.db.rollback()
            raise

        except IntegrityError as exc:
            self.db.rollback()
            logger.error(
                "IntegrityError during registration | error=%s", str(exc.orig)
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A record with the provided details already exists.",
            ) from exc

        except Exception as exc:
            self.db.rollback()
            logger.exception(
                "Unexpected error during registration | error=%s", str(exc)
            )
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
        normalized_email = email.lower().strip()
        cleaned_otp = otp.strip()
        logger.info("Verify OTP request | email=%s", normalized_email)

        user = self.user_repo.get_by_email(normalized_email)
        if not user:
            logger.warning("Verify OTP rejected — user not found | email=%s", normalized_email)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account with this email address was not found.",
            )

        if user.is_verified:
            return {
                "message": "Email is already verified. Your account is pending administrator approval.",
                "verified": True,
            }

        # Find latest OTP record for this email
        otp_record = (
            self.db.query(EmailOTP)
            .filter(EmailOTP.email == normalized_email)
            .order_by(EmailOTP.created_at.desc())
            .first()
        )

        if not otp_record:
            logger.warning("Verify OTP rejected — no OTP record | email=%s", normalized_email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please request a new code.",
            )

        if otp_record.is_used:
            logger.warning("Verify OTP rejected — already used | email=%s", normalized_email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This verification code has already been used. Please request a new one.",
            )

        now = datetime.now(timezone.utc)
        exp = otp_record.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if now > exp:
            logger.warning("Verify OTP rejected — expired | email=%s", normalized_email)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please request a new code.",
            )

        if otp_record.attempts >= 5:
            logger.warning("Verify OTP rejected — max attempts exceeded | email=%s", normalized_email)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. This code is locked. Please request a new code.",
            )

        if not verify_otp_hash(normalized_email, cleaned_otp, otp_record.hashed_otp):
            otp_record.attempts += 1
            self.db.commit()
            remaining = 5 - otp_record.attempts
            logger.warning(
                "Verify OTP rejected — invalid code | email=%s attempts=%d",
                normalized_email,
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
        self.db.commit()

        logger.info("Email verified successfully | user_id=%s email=%s", user.id, normalized_email)

        return {
            "message": "Email verified successfully! Your registration is now pending administrator approval.",
            "verified": True,
        }

    # ------------------------------------------------------------------
    # Resend OTP
    # ------------------------------------------------------------------

    def resend_otp(self, email: str) -> dict:
        """
        Enforces 60-second cooldown, invalidates older active OTPs, generates
        a new 6-digit code, and dispatches via Brevo.
        """
        normalized_email = email.lower().strip()
        logger.info("Resend OTP request | email=%s", normalized_email)

        user = self.user_repo.get_by_email(normalized_email)
        if not user:
            logger.warning("Resend OTP rejected — user not found | email=%s", normalized_email)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account with this email address was not found.",
            )

        if user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your email is already verified. No new code is required.",
            )

        # Rate limiting: 60s cooldown from latest OTP record
        now = datetime.now(timezone.utc)
        latest_otp = (
            self.db.query(EmailOTP)
            .filter(EmailOTP.email == normalized_email)
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
                    normalized_email,
                    cooldown_remaining,
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {cooldown_remaining} seconds before requesting a new code.",
                )

        # Invalidate any previous unused OTPs
        self.db.query(EmailOTP).filter(
            EmailOTP.email == normalized_email,
            EmailOTP.is_used == False,
        ).update({"is_used": True})

        # Generate new OTP
        otp = generate_otp()
        hashed = hash_otp(normalized_email, otp)
        expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

        new_record = EmailOTP(
            email=normalized_email,
            hashed_otp=hashed,
            expires_at=expires_at,
            attempts=0,
            is_used=False,
        )
        self.db.add(new_record)

        # Send via Brevo before commit
        brevo = BrevoService()
        brevo.send_otp_email(to_email=normalized_email, otp=otp, to_name=user.name)

        self.db.commit()
        logger.info("Resend OTP dispatched successfully | email=%s", normalized_email)

        return {
            "message": "A new verification code has been sent to your email."
        }

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------

    def login(self, data: LoginRequest) -> dict:
        """
        Authenticate an existing user.
        Returns a signed JWT access token on success.
        """
        normalized_email = data.email.lower().strip()
        logger.info("Login attempt | email=%s", normalized_email)

        _invalid = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        # 1. Look up user
        user = self.user_repo.get_by_email(normalized_email)
        if not user:
            logger.warning(
                "Login rejected — email not found | email=%s", normalized_email
            )
            raise _invalid

        # 2. Verify password
        if not verify_password(data.password, user.hashed_password):
            logger.warning(
                "Login rejected — wrong password | email=%s", normalized_email
            )
            raise _invalid

        # 3. Guard: email verified
        if not user.is_verified:
            logger.warning(
                "Login rejected — email unverified | user_id=%s", user.id
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address before signing in.",
            )

        # 4. Guard: inactive account
        if not user.is_active:
            logger.warning(
                "Login rejected — account inactive | user_id=%s", user.id
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated.",
            )

        # 5. Guard: business status must be ACTIVE
        business = self.business_repo.get_by_id(user.business_id)
        if not business or business.status != "ACTIVE":
            status_val = business.status if business else "UNKNOWN"
            logger.warning(
                "Login rejected — business status not ACTIVE | business_id=%s status=%s",
                user.business_id,
                status_val,
            )
            if status_val == "PENDING":
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

        # 6. Issue JWT
        token = create_access_token(
            {
                "sub": str(user.id),
                "business_id": str(user.business_id),
                "role": user.role,
            }
        )
        logger.info("Login successful | user_id=%s", user.id)

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
        """Service method to list all active device sessions for a merchant user."""
        from uuid import UUID
        from app.repositories.user_session_repository import UserSessionRepository
        uid = UUID(user_id) if isinstance(user_id, str) else user_id
        return UserSessionRepository(self.db).list_active_sessions(uid)

    def revoke_device(self, user_id: str, session_id: str) -> bool:
        """Service method to revoke a specific device session."""
        from uuid import UUID
        from app.repositories.user_session_repository import UserSessionRepository
        uid = UUID(user_id) if isinstance(user_id, str) else user_id
        sid = UUID(session_id) if isinstance(session_id, str) else session_id
        return UserSessionRepository(self.db).deactivate_session(sid, uid)

    def count_active_devices(self, user_id: str) -> int:
        """Service method to count current active device sessions for a merchant user."""
        from uuid import UUID
        from app.repositories.user_session_repository import UserSessionRepository
        uid = UUID(user_id) if isinstance(user_id, str) else user_id
        return UserSessionRepository(self.db).count_active_sessions(uid)