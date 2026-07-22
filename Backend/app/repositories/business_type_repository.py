from sqlalchemy import select

from app.models.business_type import BusinessType
from app.repositories.base_repository import BaseRepository


class BusinessTypeRepository(BaseRepository):

    def get_all(self):
        stmt = select(BusinessType).order_by(BusinessType.name)
        return self.db.scalars(stmt).all()

    def get_by_id(self, business_type_id):
        stmt = select(BusinessType).where(
            BusinessType.id == business_type_id
        )
        return self.db.scalar(stmt)

    def create(self, business_type: BusinessType):
        self.db.add(business_type)
        self.db.flush()
        self.db.refresh(business_type)
        return business_type