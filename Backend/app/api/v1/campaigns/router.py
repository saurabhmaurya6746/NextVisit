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
    db: Session = Depends(get_db),
):
    """
    Generates a funny, witty, engaging WhatsApp marketing message via Google Gemini REST API.
    Reads GEMINI_API_KEY from backend environment.
    """
    from app.services.subscription_limit_service import SubscriptionLimitService
    sub_limit_svc = SubscriptionLimitService(db)
    sub_limit_svc.check_ai_limit(current_user.business_id)

    from app.models.business import Business
    biz = db.query(Business).filter(Business.id == current_user.business_id).first()
    biz_name = data.business_name or (biz.name if biz else "Our Business")
    biz_type = data.business_type or (biz.type if biz else "Business")

    tones = [
        "witty & playful",
        "energetic & exciting",
        "warm & personal",
        "catchy & promotional",
        "urgent & exclusive",
    ]
    tone_style = data.tone or random.choice(tones)

    prompt = (
        f"You are an expert marketing copywriter for a {biz_type} named '{biz_name}'.\n"
        f"Generate a customer-facing WhatsApp campaign message tailored for a {biz_type}.\n\n"
        f"Business Name: {biz_name}\n"
        f"Business Type: {biz_type}\n"
        f"Campaign Name: {data.campaign_name or 'Special Promo'}\n"
        f"Campaign Type: {data.campaign_type}\n"
        f"Target Segment: {data.target_segment or 'ALL_CUSTOMERS'}\n"
        f"Offer Title / Subject: {data.title or 'Special Offer'}\n"
        f"Discount / Offer Value: {data.discount or 'Special Discount'}\n"
    )

    if data.message_content and data.message_content.strip():
        prompt += f"Existing Message Template: {data.message_content.strip()}\n"

    if data.language:
        prompt += f"Language: {data.language}\n"
    prompt += f"Tone Style: {tone_style}\n"
    if data.length:
        prompt += f"Length: {data.length}\n"

    prompt += (
        f"\nSTRICT REQUIREMENTS:\n"
        f"1. You MUST strictly preserve placeholders like {{customer_name}} and {{discount}}. Do NOT rename, remove, or convert them into {{customer_name}} or single curly braces.\n"
        f"2. Adapt the vocabulary, tone, and emoji for a {biz_type} (e.g., food/dining terms for a restaurant, beauty/pampering terms for a salon).\n"
        f"3. Return ONLY the final message text without any surrounding quotes, markdown formatting, or introductory preambles."
    )

    api_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.85,
            "topP": 0.95,
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    generated_text = None
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            text = (
                res_body.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            if text:
                generated_text = text.strip()
    except Exception as e:
        logger.warning(f"[GEMINI AI BACKEND] Call failed: {e}")

    if not generated_text:
        # Fallback message preserving exact placeholders {{customer_name}} and {{discount}}
        fallbacks = [
            f"Hey {{customer_name}}! 🎉 {data.title or 'Special Treat'}! Get {{discount}} off on your next visit to {biz_name}. Book today! ✨",
            f"Psst {{customer_name}}! 🎁 {biz_name} has a special offer for you! Enjoy {{discount}} on your next order. Valid for a limited time! 🔥",
            f"Exclusive offer for {{customer_name}} at {biz_name} 🌟 {data.title or 'Claim your deal'}: Get {{discount}} off now! See you soon! ❤️",
        ]
        generated_text = random.choice(fallbacks)

    sub_limit_svc.consume_ai_credit(current_user.business_id)
    return CampaignAiGenerateResponse(generated_message=generated_text)


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
