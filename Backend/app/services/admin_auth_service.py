import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    verify_password,
)
from app.models.admin import Admin
from app.repositories.admin_repository import AdminRepository
from app.schemas.auth import LoginRequest

logger = logging.getLogger(__name__)


class AdminAuthService:

    def __init__(self, db: Session):
        self.db = db
        self.admin_repo = AdminRepository(db)

    def login(self, data: LoginRequest) -> dict:
        """
        Authenticate a Super Admin using email and password.

        Reuses security utilities (verify_password, create_access_token)
        and HTTP 401/403 exception patterns.
        """
        logger.info("Admin login attempt | email=%s", data.email)

        _invalid = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        admin = self.admin_repo.get_by_email(data.email)
        if not admin:
            logger.warning("Admin login rejected — email not found | email=%s", data.email)
            raise _invalid

        if not verify_password(data.password, admin.hashed_password):
            logger.warning("Admin login rejected — wrong password | email=%s", data.email)
            raise _invalid

        if not admin.is_active:
            logger.warning("Admin login rejected — account inactive | admin_id=%s", admin.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This admin account has been deactivated.",
            )

        token = create_access_token(
            {
                "sub": str(admin.id),
                "role": admin.role,
                "token_type": "admin",
            }
        )
        logger.info("Admin login successful | admin_id=%s", admin.id)

        return {
            "access_token": token,
            "token_type": "bearer",
        }
