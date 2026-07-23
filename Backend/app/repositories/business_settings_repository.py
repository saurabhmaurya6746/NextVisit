from uuid import UUID

from sqlalchemy import select

from app.models.business_settings import BusinessSettings
from app.repositories.base_repository import BaseRepository


class BusinessSettingsRepository(BaseRepository):

    def get_by_business(self, business_id: UUID) -> BusinessSettings | None:
        stmt = select(BusinessSettings).where(
            BusinessSettings.business_id == business_id
        )
        return self.db.scalar(stmt)

    def get_settings(self, business_id: UUID) -> BusinessSettings | None:
        return self.get_by_business(business_id)

    def create(self, settings: BusinessSettings) -> BusinessSettings:
        self.db.add(settings)
        self.db.flush()
        self.db.refresh(settings)
        return settings

    def update(self, settings: BusinessSettings) -> BusinessSettings:
        self.db.flush()
        self.db.refresh(settings)
        return settings
