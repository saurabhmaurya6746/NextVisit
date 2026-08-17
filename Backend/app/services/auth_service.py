import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.business import Business
from app.models.user import User
from app.repositories.business_repository import BusinessRepository
from app.repositories.business_type_repository import BusinessTypeRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest
from app.schemas.business import BusinessCreate

logger = logging.getLogger(__name__)


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

            # 2. Guard: duplicate email (ignore soft-deleted users/businesses)
            existing_user = self.db.scalar(
                select(User)
                .join(Business, User.business_id == Business.id)
                .where(
                    func.lower(User.email) == clean_email,
                    Business.is_deleted.is_(False),
                    User.is_active.is_(True),
                    User.status != "DELETED",
                )
            )
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                )

            # Cleanup legacy soft-deleted business/user rows that have clean_email to avoid SQL UNIQUE constraint failure
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
                select(User).where(
                    func.lower(User.email) == clean_email,
                    (User.is_active.is_(False) | (User.status == "DELETED")),
                )
            ).all())
            for u in legacy_deleted_users:
                import uuid as uuid_lib
                u.email = f"deleted_{uuid_lib.uuid4().hex[:8]}_{u.email}"

            # 3. Create Business
            from app.models.subscription_plan import SubscriptionPlan
            starter_plan = self.db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.name == "STARTER"))
            business = Business(
                business_type_id=data.business.business_type_id,
                name=data.business.business_name,
                owner_name=data.owner.owner_name,
                email=data.owner.owner_email,
                phone=data.business.phone,
                country=data.business.country,
                currency=data.business.currency,
                timezone=data.business.timezone,
                address=data.business.address,
                subscription_plan_id=starter_plan.id if starter_plan else None,
            )
            business = self.business_repo.create(business)

            # 4. Create Owner User
            user = User(
                business_id=business.id,
                name=data.owner.owner_name,
                email=data.owner.owner_email,
                hashed_password=hash_password(data.owner.password),
                role="OWNER",
            )
            user = self.user_repo.create(user)

            # 5. Initialize defaults
            from app.services.automation_service import AutomationService
            from app.services.business_settings_service import BusinessSettingsService
            from app.services.message_template_service import MessageTemplateService
            AutomationService(self.db).init_default_rules_for_business(business.id)
            MessageTemplateService(self.db).init_default_templates_for_business(business.id)
            BusinessSettingsService(self.db).init_default_settings_for_business(business.id)

            # 6. Commit transaction
            self.db.commit()
            self.db.refresh(user)
            self.db.refresh(business)

            # 7. Non-blocking Admin Email Notification
            try:
                from app.services.email_service import EmailService
                business_type_name = getattr(business_type, "name", "") if business_type else ""
                sent = EmailService.send_new_signup_notification(
                    business_name=business.name,
                    owner_name=user.name,
                    owner_email=user.email,
                    business_type=business_type_name,
                    signup_time=business.created_at or datetime.now(timezone.utc),
                    business_id=str(business.id),
                )
                if sent:
                    logger.info("Admin signup notification email sent successfully for user ID %s (business ID: %s)", str(user.id), str(business.id))
                else:
                    logger.warning("Failed to send admin signup notification email for user ID %s (business ID: %s)", str(user.id), str(business.id))
            except Exception as email_err:
                logger.warning("Non-blocking signup admin email notification error: %s", str(email_err))


            token = create_access_token(
                {
                    "sub": str(user.id),
                    "business_id": str(business.id),
                    "role": user.role,
                }
            )

            return {
                "access_token": token,
                "token_type": "bearer",
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