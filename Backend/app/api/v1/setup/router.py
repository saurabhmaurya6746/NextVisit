from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_optional_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.business_settings import (
    RestaurantSetupSettingsResponse,
    RestaurantSetupSettingsUpdate,
)
from app.schemas.setup import AreaSetupItem, AreaSetupResponse
from app.services.business_settings_service import BusinessSettingsService
from app.services.dining_area_service import DiningAreaService

router = APIRouter(prefix="/setup", tags=["Restaurant Setup"])


@router.get(
    "/business-settings",
    response_model=RestaurantSetupSettingsResponse,
    summary="Get business settings for restaurant setup wizard",
)
def get_restaurant_setup_settings(
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).get_restaurant_setup_settings(current_user)


@router.post(
    "/business-settings",
    response_model=RestaurantSetupSettingsResponse,
    summary="Save business settings in restaurant setup wizard",
)
def save_restaurant_setup_settings(
    data: RestaurantSetupSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).save_restaurant_setup_settings(current_user, data)


@router.post(
    "/tables",
    response_model=AreaSetupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Batch setup restaurant dining areas and tables",
)
def setup_restaurant_tables(
    items: list[AreaSetupItem],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DiningAreaService(db).batch_setup_tables(current_user, items)
