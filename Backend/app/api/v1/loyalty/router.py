import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.loyalty import (
    CustomerLoyaltyResponse,
    LoyaltyRedeemRequest,
    LoyaltyRedeemResponse,
    LoyaltySettingsResponse,
    LoyaltySettingsUpdate,
)
from app.services.loyalty_service import LoyaltyService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/loyalty",
    tags=["Loyalty Program"],
)


@router.get(
    "/settings",
    response_model=LoyaltySettingsResponse,
    summary="Get loyalty program settings for the authenticated business",
)
def get_loyalty_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns loyalty program configuration for the authenticated business.
    Auto-initializes default settings if none exist.
    Requires a valid Bearer JWT.
    """
    return LoyaltyService(db).get_settings(current_user)


@router.put(
    "/settings",
    response_model=LoyaltySettingsResponse,
    summary="Update loyalty program settings for the authenticated business",
)
def update_loyalty_settings(
    data: LoyaltySettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates points ratio, redeem rate, minimum threshold, or active status.
    Requires a valid Bearer JWT.
    """
    return LoyaltyService(db).update_settings(current_user, data)


@router.get(
    "/customer/{customer_id}",
    response_model=CustomerLoyaltyResponse,
    summary="Get loyalty points for a specific customer",
)
def get_customer_loyalty(
    customer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns current, lifetime, and redeemed points for a customer.
    Validates tenant ownership and returns HTTP 404 if customer is not found.
    Requires a valid Bearer JWT.
    """
    return LoyaltyService(db).get_customer_loyalty(current_user, customer_id)


@router.post(
    "/redeem",
    response_model=LoyaltyRedeemResponse,
    status_code=status.HTTP_200_OK,
    summary="Redeem customer loyalty points for discount",
)
def redeem_loyalty_points(
    data: LoyaltyRedeemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Validates points balance and minimum threshold, deducts points, and returns discount amount.
    Requires a valid Bearer JWT.
    """
    return LoyaltyService(db).redeem_points(current_user, data)
