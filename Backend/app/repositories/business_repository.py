from uuid import UUID

from sqlalchemy import select

from app.models.business import Business
from app.repositories.base_repository import BaseRepository


class BusinessRepository(BaseRepository):

    def create(self, business: Business) -> Business:
        self.db.add(business)
        self.db.flush()
        self.db.refresh(business)
        return business

    def get_by_id(self, business_id: UUID) -> Business | None:
        stmt = select(Business).where(Business.id == business_id)
        return self.db.scalar(stmt)

    def update(self, business: Business) -> Business:
        """
        Persist field changes already applied to the ORM object.
        Flushes to DB so the object is refreshed within the same transaction.
        Commit is owned by the service layer.
        """
        self.db.flush()
        self.db.refresh(business)
        return business