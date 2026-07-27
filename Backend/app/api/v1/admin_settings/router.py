import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.platform_settings import (
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
)
from app.services.platform_settings_service import PlatformSettingsService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/settings",
    tags=["Super Admin System Settings"],
)


@router.get(
    "",
    response_model=PlatformSettingsResponse,
    summary="Get current global platform settings",
)
def get_platform_settings(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns global platform settings (platform name, support email, trial days, max clients, etc.).
    Requires Super Admin authorization.
    """
    return PlatformSettingsService(db).get_or_create_settings()


@router.put(
    "",
    response_model=PlatformSettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Update global platform settings",
)
def update_platform_settings(
    payload: PlatformSettingsUpdate,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Updates global platform configuration.
    Requires Super Admin authorization.
    """
    return PlatformSettingsService(db).update_settings(payload)
