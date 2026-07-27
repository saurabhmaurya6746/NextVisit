import json
import logging
import random
import urllib.request
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.campaign import (
    CampaignAiGenerateRequest,
    CampaignAiGenerateResponse,
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
    "/generate-ai-message",
    response_model=CampaignAiGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI campaign message using Gemini",
)
def generate_ai_message(
    data: CampaignAiGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Generates a funny, witty, engaging WhatsApp marketing message via Google Gemini REST API.
    Reads GEMINI_API_KEY from backend environment.
    """
    tones = [
        "witty & playful",
        "energetic & exciting",
        "warm & personal",
        "catchy & promotional",
        "urgent & exclusive",
    ]
    random_tone = random.choice(tones)

    prompt = (
        f"Generate a short, unique, funny, and highly engaging WhatsApp marketing message for a business.\n"
        f"Campaign Type: {data.campaign_type}\n"
        f"Offer Title: {data.title or 'Special Offer'}\n"
        f"Discount Value: {data.discount or 'Special Discount'}\n"
        f"Tone Style: {random_tone}\n\n"
        f"Requirements:\n"
        f"1. Must explicitly include placeholders: {{customer_name}} and {{discount}}.\n"
        f"2. Keep it under 250 characters.\n"
        f"3. Make it catchy for WhatsApp. Give a completely different creative variation than standard templates. Return ONLY the message text without quotes or markdown formatting."
    )

    api_key = settings.GEMINI_API_KEY or "AQ.Ab8RN6K1gNUq0eoW1Rv6fYLWIiNk_2yz6BwQyZSW1cl-DILLBw"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.9,
            "topP": 0.95,
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            text = (
                res_body.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            if text:
                return CampaignAiGenerateResponse(generated_message=text.strip())
    except Exception as e:
        logger.warning(f"[GEMINI AI BACKEND] Call failed: {e}")

    # Fallback message
    fallbacks = [
        f"Hey {{customer_name}}! 🎉 {data.title or 'Special Treat'}! Get {{discount}} off on your next visit. Book your slot today! ✨",
        f"Psst {{customer_name}}! 🎁 We missed you! Enjoy {{discount}} on your next order. Valid for a limited time! 🔥",
        f"Exclusive offer for {{customer_name}} 🌟 {data.title or 'Claim your deal'}: Get {{discount}} off now! See you soon!",
    ]
    return CampaignAiGenerateResponse(generated_message=random.choice(fallbacks))


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
