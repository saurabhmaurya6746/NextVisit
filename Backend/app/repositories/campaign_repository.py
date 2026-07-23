from uuid import UUID

from sqlalchemy import select

from app.models.campaign import Campaign
from app.repositories.base_repository import BaseRepository


class CampaignRepository(BaseRepository):

    def get_all_by_business(self, business_id: UUID) -> list[Campaign]:
        stmt = (
            select(Campaign)
            .where(Campaign.business_id == business_id)
            .order_by(Campaign.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, campaign_id: UUID) -> Campaign | None:
        stmt = select(Campaign).where(Campaign.id == campaign_id)
        return self.db.scalar(stmt)

    def create(self, campaign: Campaign) -> Campaign:
        self.db.add(campaign)
        self.db.flush()
        self.db.refresh(campaign)
        return campaign

    def update(self, campaign: Campaign) -> Campaign:
        self.db.flush()
        self.db.refresh(campaign)
        return campaign

    def delete(self, campaign: Campaign) -> None:
        self.db.delete(campaign)
        self.db.flush()
