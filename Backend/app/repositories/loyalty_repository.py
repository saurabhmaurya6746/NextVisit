from uuid import UUID

from sqlalchemy import select

from app.models.loyalty import CustomerLoyalty, LoyaltySettings
from app.repositories.base_repository import BaseRepository


class LoyaltyRepository(BaseRepository):

    def get_settings(self, business_id: UUID) -> LoyaltySettings | None:
        stmt = select(LoyaltySettings).where(
            LoyaltySettings.business_id == business_id
        )
        return self.db.scalar(stmt)

    def create_settings(self, settings: LoyaltySettings) -> LoyaltySettings:
        self.db.add(settings)
        self.db.flush()
        self.db.refresh(settings)
        return settings

    def update_settings(self, settings: LoyaltySettings) -> LoyaltySettings:
        self.db.flush()
        self.db.refresh(settings)
        return settings

    def get_customer_loyalty(self, customer_id: UUID) -> CustomerLoyalty | None:
        stmt = select(CustomerLoyalty).where(
            CustomerLoyalty.customer_id == customer_id
        )
        return self.db.scalar(stmt)

    def create_customer_loyalty(
        self, loyalty: CustomerLoyalty
    ) -> CustomerLoyalty:
        self.db.add(loyalty)
        self.db.flush()
        self.db.refresh(loyalty)
        return loyalty

    def update_customer_loyalty(
        self, loyalty: CustomerLoyalty
    ) -> CustomerLoyalty:
        self.db.flush()
        self.db.refresh(loyalty)
        return loyalty
