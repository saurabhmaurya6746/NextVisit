import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.campaign import CampaignLog, CampaignLogStatus, CampaignType
from app.models.user import User
from app.repositories.campaign_execution_repository import (
    CampaignExecutionRepository,
)
from app.schemas.campaign_execution import CampaignLogItemResponse

logger = logging.getLogger(__name__)


def _format_log_item(log: CampaignLog) -> CampaignLogItemResponse:
    campaign_name = log.campaign.name if log.campaign else "Unknown Campaign"
    campaign_type = (
        log.campaign.campaign_type if log.campaign else CampaignType.CUSTOM
    )
    message = log.campaign.message if log.campaign else ""
    customer_name = log.customer.name if log.customer else "Unknown Customer"
    customer_phone = log.customer.phone if log.customer else ""

    return CampaignLogItemResponse(
        id=log.id,
        campaign_id=log.campaign_id,
        campaign_name=campaign_name,
        campaign_type=campaign_type,
        customer_id=log.customer_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        message=message,
        status=log.status,
        scheduled_for=log.scheduled_for,
        sent_at=log.sent_at,
        failure_reason=log.failure_reason,
        created_at=log.created_at,
    )


class CampaignExecutionService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = CampaignExecutionRepository(db)

    def list_pending_logs(
        self, current_user: User
    ) -> list[CampaignLogItemResponse]:
        logger.info(
            "Listing pending campaign logs | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        logs = self.repo.get_pending_logs(current_user.business_id)
        return [_format_log_item(log) for log in logs]

    def list_sent_logs(
        self, current_user: User
    ) -> list[CampaignLogItemResponse]:
        logger.info(
            "Listing sent campaign logs | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        logs = self.repo.get_sent_logs(current_user.business_id)
        return [_format_log_item(log) for log in logs]

    def list_failed_logs(
        self, current_user: User
    ) -> list[CampaignLogItemResponse]:
        logger.info(
            "Listing failed campaign logs | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        logs = self.repo.get_failed_logs(current_user.business_id)
        return [_format_log_item(log) for log in logs]

    def mark_sent(
        self, current_user: User, log_id: UUID
    ) -> CampaignLogItemResponse:
        logger.info(
            "Marking campaign log SENT | log_id=%s requested_by=%s",
            log_id,
            current_user.id,
        )
        log = self.repo.get_log_by_id(log_id)
        if not log or not log.campaign or log.campaign.business_id != current_user.business_id:
            logger.warning(
                "Campaign log not found or tenant mismatch | log_id=%s business_id=%s",
                log_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign log not found.",
            )

        if log.status == CampaignLogStatus.SENT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign log is already marked as SENT.",
            )

        if log.status != CampaignLogStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PENDING campaign logs can be marked as SENT.",
            )

        now_utc = datetime.now(timezone.utc)
        log.status = CampaignLogStatus.SENT
        log.sent_at = now_utc

        self.repo.update_status(log)
        self.db.commit()
        self.db.refresh(log)

        logger.info(
            "Campaign log marked SENT successfully | log_id=%s sent_at=%s",
            log.id,
            now_utc,
        )
        return _format_log_item(log)

    def mark_failed(
        self,
        current_user: User,
        log_id: UUID,
        failure_reason: str | None = None,
    ) -> CampaignLogItemResponse:
        logger.info(
            "Marking campaign log FAILED | log_id=%s requested_by=%s",
            log_id,
            current_user.id,
        )
        log = self.repo.get_log_by_id(log_id)
        if not log or not log.campaign or log.campaign.business_id != current_user.business_id:
            logger.warning(
                "Campaign log not found or tenant mismatch | log_id=%s business_id=%s",
                log_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign log not found.",
            )

        if log.status != CampaignLogStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PENDING campaign logs can be marked as FAILED.",
            )

        log.status = CampaignLogStatus.FAILED
        if failure_reason:
            log.failure_reason = failure_reason

        self.repo.update_status(log)
        self.db.commit()
        self.db.refresh(log)

        logger.info(
            "Campaign log marked FAILED successfully | log_id=%s reason=%s",
            log.id,
            failure_reason,
        )
        return _format_log_item(log)
