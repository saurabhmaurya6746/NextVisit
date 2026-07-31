import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.campaign import CampaignType
from app.models.user import User
from app.schemas.ai_message import (
    AiGenerateMessageRequest,
    AiGenerateMessageResponse,
)
from app.schemas.automation import (
    AutomationRuleResponse,
    AutomationRuleUpdate,
    AutomationRunResponse,
)
from app.services.ai_message_service import AiMessageService
from app.services.automation_service import AutomationService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/automation",
    tags=["Automation Engine"],
)


@router.post(
    "/ai-generate",
    response_model=AiGenerateMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate personalized AI campaign message for a customer via Gemini API",
)
def generate_ai_message(
    payload: AiGenerateMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Collects rich business, customer, visit, order, and loyalty context from DB
    and invokes Google Gemini API to generate a highly personalized, natural WhatsApp message.
    Supports tone selection and tone rotation.
    Requires a valid Bearer JWT.
    """
    return AiMessageService(db).generate_message(
        current_user=current_user,
        customer_id=payload.customer_id,
        campaign_type=payload.campaign_type,
        requested_tone=payload.tone,
        timing=payload.timing,
        language=payload.language,
        message_length=payload.message_length,
        req_coupon_code=payload.coupon_code,
        req_discount_percent=payload.discount_percent,
        req_coupon_expiry=payload.coupon_expiry,
        festival_name=payload.festival_name,
    )


@router.get(
    "",
    response_model=list[AutomationRuleResponse],
    summary="Get all automation rules for the authenticated business",
)
def list_automation_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all automation rules configured for the authenticated business.
    Auto-initializes default rules if none exist.
    Requires a valid Bearer JWT.
    """
    return AutomationService(db).list_rules(current_user)


@router.post(
    "/run",
    response_model=AutomationRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Manually trigger all enabled automation rules",
)
def run_all_automation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually triggers audience evaluation and PENDING CampaignLog creation
    for all enabled automation rules.
    Requires a valid Bearer JWT.
    """
    return AutomationService(db).run_automation(current_user)


@router.post(
    "/run/{campaign_type}",
    response_model=AutomationRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Manually trigger automation for a single campaign type",
)
def run_automation_by_campaign_type(
    campaign_type: CampaignType,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually triggers audience evaluation and PENDING CampaignLog creation
    for a single campaign type (e.g. BIRTHDAY, RECOVERY, VIP).
    Requires a valid Bearer JWT.
    """
    return AutomationService(db).run_automation(
        current_user, campaign_type=campaign_type
    )


@router.put(
    "/{rule_id}",
    response_model=AutomationRuleResponse,
    summary="Update an automation rule (enable/disable, update schedule)",
)
def update_automation_rule(
    rule_id: UUID,
    data: AutomationRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates rule configuration (enable/disable, schedule_type, run_time).
    Requires a valid Bearer JWT.
    """
    return AutomationService(db).update_rule(current_user, rule_id, data)
