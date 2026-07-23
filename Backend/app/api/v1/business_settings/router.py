import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.business_settings import (
    BusinessSettingsResponse,
    BusinessSettingsUpdate,
)
from app.services.business_settings_service import BusinessSettingsService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/business-settings",
    tags=["Business Settings"],
)


@router.get(
    "",
    response_model=BusinessSettingsResponse,
    summary="Get settings for the authenticated business",
)
def get_business_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns settings for the authenticated business.
    Auto-initializes default settings if none exist.
    Requires a valid Bearer JWT.
    """
    return BusinessSettingsService(db).get_settings(current_user)


@router.put(
    "",
    response_model=BusinessSettingsResponse,
    summary="Update settings for the authenticated business",
)
def update_business_settings(
    data: BusinessSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates settings (general, billing, payment, campaign links, branding paths)
    for the authenticated business.
    Requires a valid Bearer JWT.
    """
    return BusinessSettingsService(db).update_settings(current_user, data)
