import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.campaign_execution import (
    CampaignLogItemResponse,
    CampaignLogMarkFailedRequest,
)
from app.services.campaign_execution_service import CampaignExecutionService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/campaign-logs",
    tags=["Campaign Execution Queue"],
)


@router.get(
    "/pending",
    response_model=list[CampaignLogItemResponse],
    summary="Get all PENDING campaign execution logs",
)
def list_pending_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all PENDING campaign logs for manual WhatsApp / message delivery queue.
    Requires a valid Bearer JWT.
    """
    return CampaignExecutionService(db).list_pending_logs(current_user)


@router.get(
    "/sent",
    response_model=list[CampaignLogItemResponse],
    summary="Get all SENT campaign execution logs",
)
def list_sent_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all SENT campaign logs for the authenticated business.
    Requires a valid Bearer JWT.
    """
    return CampaignExecutionService(db).list_sent_logs(current_user)


@router.get(
    "/failed",
    response_model=list[CampaignLogItemResponse],
    summary="Get all FAILED campaign execution logs",
)
def list_failed_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all FAILED campaign logs for the authenticated business.
    Requires a valid Bearer JWT.
    """
    return CampaignExecutionService(db).list_failed_logs(current_user)


@router.post(
    "/{log_id}/mark-sent",
    response_model=CampaignLogItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a campaign log as SENT",
)
def mark_sent(
    log_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks a PENDING campaign log as SENT and records the current UTC sent_at timestamp.
    Returns HTTP 400 if already marked SENT or not PENDING.
    Requires a valid Bearer JWT.
    """
    return CampaignExecutionService(db).mark_sent(current_user, log_id)


@router.post(
    "/{log_id}/mark-failed",
    response_model=CampaignLogItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a campaign log as FAILED",
)
def mark_failed(
    log_id: UUID,
    body: CampaignLogMarkFailedRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks a PENDING campaign log as FAILED and optionally records the failure reason.
    Returns HTTP 400 if not PENDING.
    Requires a valid Bearer JWT.
    """
    reason = body.failure_reason if body else None
    return CampaignExecutionService(db).mark_failed(
        current_user, log_id, failure_reason=reason
    )
