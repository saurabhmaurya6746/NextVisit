import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.admin import AdminResponse
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.admin_auth_service import AdminAuthService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/auth",
    tags=["Super Admin Authentication"],
)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Super Admin Login with email and password",
)
def admin_login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate a Super Admin with email + password.
    Returns a signed JWT access token on success.
    Returns HTTP 401 for invalid credentials.
    """
    return AdminAuthService(db).login(data)


@router.get(
    "/me",
    response_model=AdminResponse,
    summary="Get the currently authenticated Super Admin profile",
)
def admin_me(
    current_admin: Admin = Depends(get_current_super_admin),
):
    """
    Protected endpoint — requires a valid Bearer JWT for a SUPER_ADMIN user.
    Returns the authenticated Super Admin profile:
      id, name, email, role, is_active, created_at, updated_at
    """
    return current_admin
