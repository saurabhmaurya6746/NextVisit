import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import StaffCreate, StaffResponse, StaffUpdate
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/staff",
    tags=["Staff Management"],
)


@router.get(
    "",
    response_model=list[StaffResponse],
    summary="Get all active staff of the authenticated business",
)
def list_staff(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all active staff members belonging to the authenticated user's business.
    Requires a valid Bearer JWT.
    """
    return UserService(db).list_staff(current_user)


@router.post(
    "",
    response_model=StaffResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new staff member for the business",
)
def create_staff(
    data: StaffCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new staff member under the authenticated user's business.
    Only OWNER role can perform this operation.
    Cannot create another OWNER. Default role is STAFF.
    """
    return UserService(db).create_staff(current_user, data)


@router.put(
    "/{user_id}",
    response_model=StaffResponse,
    summary="Update a staff member's name or role",
)
def update_staff(
    user_id: UUID,
    data: StaffUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates the name or role of a staff member belonging to the business.
    Only OWNER role can perform this operation.
    Cannot update role to OWNER.
    """
    return UserService(db).update_staff(current_user, user_id, data)


@router.patch(
    "/{user_id}/deactivate",
    response_model=StaffResponse,
    summary="Deactivate a staff member",
)
def deactivate_staff(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deactivates a staff member (marks is_active = False).
    Only OWNER role can perform this operation.
    Owner cannot deactivate their own account.
    """
    return UserService(db).deactivate_staff(current_user, user_id)
