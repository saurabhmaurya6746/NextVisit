import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.festival import (
    FestivalAiGenerateRequest,
    FestivalCampaignResponse,
    FestivalCampaignUpdate,
    FestivalSendRequest,
    UpcomingFestivalsResponse,
)
from app.services.festival_service import FestivalService

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Festival Campaigns"],
)


@router.get(
    "/festival-campaigns",
    response_model=list[FestivalCampaignResponse],
    summary="Get database-driven festival campaigns for the business",
)
def list_festival_campaigns(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns 100% database-driven festival campaigns with days remaining, eligible customers, and coupon attachment.
    """
    return FestivalService(db).list_campaigns(current_user)


@router.get(
    "/festival-campaigns/upcoming",
    response_model=UpcomingFestivalsResponse,
    summary="Get upcoming festival campaign metrics (next festival, this month, next 30/90 days)",
)
def get_upcoming_festivals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns upcoming festival buckets derived from database dates.
    """
    return FestivalService(db).get_upcoming_festivals(current_user)


@router.put(
    "/festival-campaigns/{campaign_id}",
    response_model=FestivalCampaignResponse,
    summary="Update a festival campaign template, language, tone, or date",
)
def update_festival_campaign(
    campaign_id: UUID,
    data: FestivalCampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates campaign template, coupon code, language, tone, enabled status, or date.
    """
    return FestivalService(db).update_campaign(current_user, campaign_id, data)


@router.post(
    "/festival-campaigns/generate-ai",
    summary="Generate festival-specific Gemini AI message with intact placeholders",
)
def generate_festival_ai(
    payload: FestivalAiGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates 50-100 word festival message via Gemini AI in English, Hindi, or Hinglish with placeholder preservation.
    """
    message = FestivalService(db).generate_ai_message(
        current_user=current_user,
        festival_id=payload.festival_id,
        festival_name=payload.festival_name,
        language=payload.language,
        tone=payload.tone,
        coupon_code=payload.coupon_code,
        discount_percent=payload.discount_percent,
        discount_desc=payload.discount_desc,
    )
    return {"message": message, "language": payload.language, "tone": payload.tone}
