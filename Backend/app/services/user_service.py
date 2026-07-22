import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import StaffCreate, StaffUpdate

logger = logging.getLogger(__name__)

ALLOWED_STAFF_ROLES = {"MANAGER", "STAFF"}


class UserService:

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def list_staff(self, current_user: User) -> list[User]:
        logger.info(
            "Listing active staff | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        return self.user_repo.get_by_business_id(
            current_user.business_id, only_active=True
        )

    def create_staff(self, current_user: User, data: StaffCreate) -> User:
        if current_user.role != "OWNER":
            logger.warning(
                "Staff creation denied — non-owner user | user_id=%s role=%s",
                current_user.id,
                current_user.role,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners can create staff members.",
            )

        role = data.role.upper() if data.role else "STAFF"
        if role == "OWNER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owner cannot create another user with OWNER role.",
            )
        if role not in ALLOWED_STAFF_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role '{data.role}'. Allowed staff roles: MANAGER, STAFF.",
            )

        existing_user = self.user_repo.get_by_email(data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

        new_staff = User(
            business_id=current_user.business_id,
            name=data.name,
            email=data.email,
            hashed_password=hash_password(data.password),
            role=role,
            is_active=True,
        )
        created_user = self.user_repo.create(new_staff)
        self.db.commit()
        self.db.refresh(created_user)

        logger.info(
            "Staff created successfully | staff_id=%s business_id=%s role=%s",
            created_user.id,
            created_user.business_id,
            created_user.role,
        )
        return created_user

    def update_staff(
        self, current_user: User, user_id: UUID, data: StaffUpdate
    ) -> User:
        if current_user.role != "OWNER":
            logger.warning(
                "Staff update denied — non-owner user | user_id=%s role=%s",
                current_user.id,
                current_user.role,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners can update staff members.",
            )

        target_user = self.user_repo.get_by_id(user_id)
        if not target_user or target_user.business_id != current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found.",
            )

        if data.name is not None:
            target_user.name = data.name

        if data.role is not None:
            new_role = data.role.upper()
            if new_role == "OWNER":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot assign OWNER role to staff members.",
                )
            if new_role not in ALLOWED_STAFF_ROLES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid role '{data.role}'. Allowed staff roles: MANAGER, STAFF.",
                )
            target_user.role = new_role

        self.user_repo.update(target_user)
        self.db.commit()
        self.db.refresh(target_user)

        logger.info(
            "Staff updated successfully | staff_id=%s business_id=%s",
            target_user.id,
            target_user.business_id,
        )
        return target_user

    def deactivate_staff(self, current_user: User, user_id: UUID) -> User:
        if current_user.role != "OWNER":
            logger.warning(
                "Staff deactivation denied — non-owner user | user_id=%s role=%s",
                current_user.id,
                current_user.role,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only business owners can deactivate staff members.",
            )

        if current_user.id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Owners cannot deactivate their own account.",
            )

        target_user = self.user_repo.get_by_id(user_id)
        if not target_user or target_user.business_id != current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found.",
            )

        target_user.is_active = False
        self.user_repo.update(target_user)
        self.db.commit()
        self.db.refresh(target_user)

        logger.info(
            "Staff deactivated successfully | staff_id=%s business_id=%s",
            target_user.id,
            target_user.business_id,
        )
        return target_user
