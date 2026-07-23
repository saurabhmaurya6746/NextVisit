import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.message_template import (
    MessageTemplatePreviewRequest,
    MessageTemplatePreviewResponse,
    MessageTemplateResponse,
    MessageTemplateUpdate,
)
from app.services.message_template_service import MessageTemplateService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/message-templates",
    tags=["Message Template Engine"],
)


@router.get(
    "",
    response_model=list[MessageTemplateResponse],
    summary="Get all message templates for the authenticated business",
)
def list_message_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all message templates configured for the authenticated business.
    Auto-initializes default templates if none exist.
    Requires a valid Bearer JWT.
    """
    return MessageTemplateService(db).list_templates(current_user)


@router.post(
    "/preview",
    response_model=MessageTemplatePreviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Preview generated message by replacing template placeholders",
)
def preview_message_template(
    data: MessageTemplatePreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates a final rendered text message by replacing supported placeholders
    ({{customer_name}}, {{business_name}}, {{discount}}, {{points}}, {{visit_count}}).
    Does NOT send WhatsApp/SMS messages.
    Requires a valid Bearer JWT.
    """
    return MessageTemplateService(db).preview_template(current_user, data)


@router.put(
    "/{template_id}",
    response_model=MessageTemplateResponse,
    summary="Update a message template",
)
def update_message_template(
    template_id: UUID,
    data: MessageTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates message template details (name, message text, default flag).
    Requires a valid Bearer JWT.
    """
    return MessageTemplateService(db).update_template(
        current_user, template_id, data
    )
