import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import (
    PaginatedStaffResponse,
    StaffCreate,
    StaffResetPassword,
    StaffResponse,
    StaffStatusToggle,
    StaffUpdate,
)
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/staff",
    tags=["Staff Management"],
)


@router.get(
    "",
    response_model=PaginatedStaffResponse,
    summary="Get paginated list of business staff members",
)
def list_staff(
    search: str = Query("", description="Search by name, phone, email, designation, or login_id"),
    status: str = Query("ALL", description="Filter by status: ACTIVE, INACTIVE, or ALL"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns paginated list of staff members belonging to the authenticated business."""
    return UserService(db).list_staff(
        current_user=current_user, search=search, status_filter=status, page=page, limit=limit
    )


@router.get(
    "/next-login-id",
    summary="Get next auto-generated Staff Login ID preview for the business",
)
def get_next_login_id(
    name: str = Query("", description="Optional staff name to preview prefix"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the preview of the next auto-generated Staff Login ID (e.g. RST-SAU-1025)."""
    next_id = UserService(db).get_next_login_id_for_business(current_user, name=name)
    return {"next_login_id": next_id}


@router.post(
    "",
    response_model=StaffResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new staff member with custom permissions",
)
def create_staff(
    data: StaffCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new staff member with auto-generated login_id, password, and module permissions."""
    return UserService(db).create_staff(current_user, data)


@router.get(
    "/{user_id}",
    response_model=StaffResponse,
    summary="Get single staff member details",
)
def get_staff_detail(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns detailed profile and permissions of a staff member."""
    return UserService(db).get_staff_detail(current_user, user_id)


@router.put(
    "/{user_id}",
    response_model=StaffResponse,
    summary="Update staff member profile and permissions",
)
def update_staff(
    user_id: UUID,
    data: StaffUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates staff name, phone, email, designation, status, or module permissions."""
    return UserService(db).update_staff(current_user, user_id, data)


@router.patch(
    "/{user_id}/status",
    response_model=StaffResponse,
    summary="Toggle staff account status (ACTIVE / INACTIVE)",
)
def toggle_staff_status(
    user_id: UUID,
    payload: StaffStatusToggle,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Activates or deactivates a staff account."""
    return UserService(db).toggle_status(current_user, user_id, payload.status)


@router.post(
    "/{user_id}/reset-password",
    summary="Reset staff account password",
)
def reset_staff_password(
    user_id: UUID,
    payload: StaffResetPassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resets staff password."""
    return UserService(db).reset_password(current_user, user_id, payload.password)


@router.delete(
    "/{user_id}",
    summary="Delete a staff member account",
)
def delete_staff(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently deletes a staff member from the business."""
    return UserService(db).delete_staff(current_user, user_id)
