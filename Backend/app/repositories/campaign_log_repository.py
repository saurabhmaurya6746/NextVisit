from uuid import UUID

from sqlalchemy import select

from app.models.campaign import Campaign, CampaignLog, CampaignLogStatus
from app.repositories.base_repository import BaseRepository


class CampaignLogRepository(BaseRepository):

    def create(self, log: CampaignLog) -> CampaignLog:
        self.db.add(log)
        self.db.flush()
        self.db.refresh(log)
        return log

    def bulk_create(self, logs: list[CampaignLog]) -> list[CampaignLog]:
        if not logs:
            return []
        self.db.add_all(logs)
        self.db.flush()
        for log in logs:
            self.db.refresh(log)
        return logs

    def get_pending(self, business_id: UUID | None = None) -> list[CampaignLog]:
        stmt = select(CampaignLog).where(
            CampaignLog.status == CampaignLogStatus.PENDING
        )
        if business_id is not None:
            stmt = stmt.join(
                Campaign, CampaignLog.campaign_id == Campaign.id
            ).where(Campaign.business_id == business_id)

        stmt = stmt.order_by(CampaignLog.created_at.asc())
        return list(self.db.scalars(stmt).all())
