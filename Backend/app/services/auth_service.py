import logging

from fastapi import HTTPException, status
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
            existing_user = self.user_repo.get_by_email(
                data.owner.owner_email
            )
            if existing_user:
                logger.warning(
                    "Registration rejected — email already exists | email=%s",
                    data.owner.owner_email,
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                )

            # 3. Create Business
            logger.info(
                "Creating business | name=%s type_id=%s",
                data.business.business_name,
                data.business.business_type_id,
            )
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
            )
            business = self.business_repo.create(business)
            logger.info("Business flushed | business_id=%s", business.id)

            # 4. Create Owner User — business_id references businesses.id
            logger.info(
                "Creating owner user | email=%s business_id=%s",
                data.owner.owner_email,
                business.id,
            )
            user = User(
                business_id=business.id,   # FK → businesses.id (NOT business_type_id)
                name=data.owner.owner_name,
                email=data.owner.owner_email,
                hashed_password=hash_password(data.owner.password),
                role="OWNER",
            )
            user = self.user_repo.create(user)
            logger.info("User flushed | user_id=%s", user.id)

            # 5. Atomic commit — both Business and User in one transaction
            self.db.commit()
            self.db.refresh(user)
            self.db.refresh(business)
            logger.info(
                "Transaction committed | user_id=%s business_id=%s",
                user.id,
                business.id,
            )

            # 6. Generate JWT
            token = create_access_token(
                {
                    "sub": str(user.id),
                    "business_id": str(business.id),
                    "role": user.role,
                }
            )
            logger.info("Access token issued | user_id=%s", user.id)

            return {
                "access_token": token,
                "token_type": "bearer",
            }

        except HTTPException:
            # Re-raise FastAPI HTTP exceptions without rollback
            # (no DB write happened for 409 guard)
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
    # Login
    # ------------------------------------------------------------------

    def login(self, data: LoginRequest) -> dict:
        """
        Authenticate an existing user.

        Returns a signed JWT access token on success.
        Raises HTTP 401 for both unknown email AND wrong password
        (identical message prevents user-enumeration attacks).
        """
        logger.info("Login attempt | email=%s", data.email)

        _invalid = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        # 1. Look up user — reuse existing get_by_email()
        user = self.user_repo.get_by_email(data.email)
        if not user:
            logger.warning(
                "Login rejected — email not found | email=%s", data.email
            )
            raise _invalid

        # 2. Verify password — reuse existing verify_password()
        if not verify_password(data.password, user.hashed_password):
            logger.warning(
                "Login rejected — wrong password | email=%s", data.email
            )
            raise _invalid

        # 3. Guard: inactive account
        if not user.is_active:
            logger.warning(
                "Login rejected — account inactive | user_id=%s", user.id
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated.",
            )

        # 4. Issue JWT — reuse existing create_access_token()
        token = create_access_token(
            {
                "sub": str(user.id),
                "business_id": str(user.business_id),
                "role": user.role,
            }
        )
        logger.info("Login successful | user_id=%s", user.id)

        return {
            "access_token": token,
            "token_type": "bearer",
        }