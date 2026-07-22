import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.business import BusinessProfileResponse, BusinessProfileUpdate
from app.services.business_service import BusinessService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/business",
    tags=["Business"],
)


@router.get(
    "",
    response_model=BusinessProfileResponse,
    summary="Get the authenticated business profile",
)
def get_business(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the full profile of the business that belongs to
    the currently authenticated user.

    Requires a valid Bearer JWT.
    """
    return BusinessService(db).get_current_business(current_user)


@router.put(
    "",
    response_model=BusinessProfileResponse,
    summary="Update the authenticated business profile",
)
def update_business(
    data: BusinessProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Partially update the authenticated business profile.

    Only the following fields can be updated:
    name, phone, country, currency, timezone, address, logo_url

    Omitted fields are left unchanged.
    Returns the complete updated profile.

    Requires a valid Bearer JWT.
    """
    return BusinessService(db).update_current_business(current_user, data)
