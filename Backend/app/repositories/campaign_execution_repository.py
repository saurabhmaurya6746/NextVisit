from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models.campaign import Campaign, CampaignLog, CampaignLogStatus
from app.repositories.base_repository import BaseRepository


class CampaignExecutionRepository(BaseRepository):

    def get_pending_logs(self, business_id: UUID) -> list[CampaignLog]:
        stmt = (
            select(CampaignLog)
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .options(
                joinedload(CampaignLog.campaign),
                joinedload(CampaignLog.customer),
            )
            .where(
                Campaign.business_id == business_id,
                CampaignLog.status == CampaignLogStatus.PENDING,
            )
            .order_by(CampaignLog.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_sent_logs(self, business_id: UUID) -> list[CampaignLog]:
        stmt = (
            select(CampaignLog)
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .options(
                joinedload(CampaignLog.campaign),
                joinedload(CampaignLog.customer),
            )
            .where(
                Campaign.business_id == business_id,
                CampaignLog.status == CampaignLogStatus.SENT,
            )
            .order_by(CampaignLog.sent_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_failed_logs(self, business_id: UUID) -> list[CampaignLog]:
        stmt = (
            select(CampaignLog)
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .options(
                joinedload(CampaignLog.campaign),
                joinedload(CampaignLog.customer),
            )
            .where(
                Campaign.business_id == business_id,
                CampaignLog.status == CampaignLogStatus.FAILED,
            )
            .order_by(CampaignLog.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_log_by_id(self, log_id: UUID) -> CampaignLog | None:
        stmt = (
            select(CampaignLog)
            .options(
                joinedload(CampaignLog.campaign),
                joinedload(CampaignLog.customer),
            )
            .where(CampaignLog.id == log_id)
        )
        return self.db.scalar(stmt)

    def update_status(self, log: CampaignLog) -> CampaignLog:
        self.db.flush()
        self.db.refresh(log)
        return log
