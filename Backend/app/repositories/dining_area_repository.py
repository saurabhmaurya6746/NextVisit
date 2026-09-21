import uuid
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.dining_area import DiningArea


class DiningAreaRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, area: DiningArea) -> DiningArea:
        self.db.add(area)
        self.db.commit()
        self.db.refresh(area)
        return area

    def get_by_id(self, area_id: uuid.UUID, business_id: uuid.UUID) -> DiningArea | None:
        stmt = select(DiningArea).where(
            DiningArea.id == area_id,
            DiningArea.business_id == business_id,
        )
        return self.db.scalar(stmt)

    def get_by_name(self, business_id: uuid.UUID, name: str) -> DiningArea | None:
        stmt = select(DiningArea).where(
            DiningArea.business_id == business_id,
            func.lower(DiningArea.name) == func.lower(name.strip()),
        )
        return self.db.scalar(stmt)

    def list_by_business(self, business_id: uuid.UUID) -> list[DiningArea]:
        stmt = (
            select(DiningArea)
            .where(DiningArea.business_id == business_id)
            .order_by(DiningArea.display_order.asc(), DiningArea.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def update(self, area: DiningArea) -> DiningArea:
        self.db.commit()
        self.db.refresh(area)
        return area

    def delete(self, area: DiningArea) -> None:
        self.db.delete(area)
        self.db.commit()
