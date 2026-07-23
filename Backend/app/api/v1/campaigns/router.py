import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.campaign import (
    CampaignCreate,
    CampaignGenerateAudienceResponse,
    CampaignResponse,
    CampaignUpdate,
)
from app.services.campaign_service import CampaignService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/campaigns",
    tags=["Campaign Engine"],
)


@router.get(
    "",
    response_model=list[CampaignResponse],
    summary="Get all campaigns of the authenticated business",
)
def list_campaigns(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all marketing campaigns for the authenticated business.
    Requires a valid Bearer JWT.
    """
    return CampaignService(db).list_campaigns(current_user)


@router.post(
    "",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new campaign",
)
def create_campaign(
    data: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new campaign for the authenticated business.
    Requires a valid Bearer JWT.
    """
    return CampaignService(db).create_campaign(current_user, data)


@router.get(
    "/{campaign_id}",
    response_model=CampaignResponse,
    summary="Get campaign by ID",
)
def get_campaign(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns details of a campaign.
    Requires a valid Bearer JWT.
    """
    return CampaignService(db).get_campaign(current_user, campaign_id)


@router.put(
    "/{campaign_id}",
    response_model=CampaignResponse,
    summary="Update an existing campaign",
)
def update_campaign(
    campaign_id: UUID,
    data: CampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates campaign details.
    Requires a valid Bearer JWT.
    """
    return CampaignService(db).update_campaign(current_user, campaign_id, data)


@router.delete(
    "/{campaign_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a campaign",
)
def delete_campaign(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a campaign and its linked logs.
    Requires a valid Bearer JWT.
    """
    CampaignService(db).delete_campaign(current_user, campaign_id)
    return {"message": "Campaign deleted successfully."}


@router.post(
    "/{campaign_id}/generate",
    response_model=CampaignGenerateAudienceResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate audience logs for a campaign segment",
)
def generate_campaign_audience(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Evaluates the target segment via Customer Segmentation module,
    and creates PENDING CampaignLog records for all matching customers.
    Requires a valid Bearer JWT.
    """
    return CampaignService(db).generate_campaign_audience(
        current_user, campaign_id
    )
