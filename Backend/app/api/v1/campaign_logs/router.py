import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.campaign_execution import (
    CampaignLogItemResponse,
    CampaignLogMarkFailedRequest,
    CampaignLogRecordSendRequest,
    CampaignLogRecordSendResponse,
    PaginatedCampaignLogHistoryResponse,
)
from app.services.campaign_execution_service import CampaignExecutionService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/campaign-logs",
    tags=["Campaign Execution Queue"],
)


@router.get(
    "/history",
    response_model=PaginatedCampaignLogHistoryResponse,
    summary="Get 100% database-driven WhatsApp History with search, filters, and pagination",
)
def get_campaign_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None),
    campaign_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    date_range: str | None = Query(default=None),
    sort: str | None = Query(default="newest"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampaignExecutionService(db).get_campaign_history(
        current_user=current_user,
        page=page,
        limit=limit,
        search=search,
        campaign_type=campaign_type,
        status_filter=status,
        date_range=date_range,
        sort=sort,
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
    return CampaignExecutionService(db).list_failed_logs(current_user)


@router.post(
    "/record-send",
    response_model=CampaignLogRecordSendResponse,
    status_code=status.HTTP_200_OK,
    summary="Record or update a campaign message as SENT when user dispatches WhatsApp",
)
def record_campaign_send(
    data: CampaignLogRecordSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampaignExecutionService(db).record_send(current_user, data)


@router.post(
    "",
    response_model=CampaignLogRecordSendResponse,
    status_code=status.HTTP_200_OK,
    summary="Record or update a campaign message as SENT (backward compatibility)",
)
def record_campaign_send_base(
    data: CampaignLogRecordSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampaignExecutionService(db).record_send(current_user, data)


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
    failure_reason = body.failure_reason if body else None
    return CampaignExecutionService(db).mark_failed(current_user, log_id, failure_reason)
