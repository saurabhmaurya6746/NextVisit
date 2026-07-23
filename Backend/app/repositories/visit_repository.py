from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.visit import Visit, VisitStatus
from app.repositories.base_repository import BaseRepository


class VisitRepository(BaseRepository):

    def create(self, visit: Visit) -> Visit:
        self.db.add(visit)
        self.db.flush()
        self.db.refresh(visit)
        return visit

    def update(self, visit: Visit) -> Visit:
        self.db.flush()
        self.db.refresh(visit)
        return visit

    def get_by_id(self, visit_id: UUID) -> Visit | None:
        stmt = (
            select(Visit)
            .options(selectinload(Visit.services))
            .where(Visit.id == visit_id)
        )
        return self.db.scalar(stmt)

    def get_all_by_business(self, business_id: UUID) -> list[Visit]:
        stmt = (
            select(Visit)
            .options(selectinload(Visit.services))
            .where(Visit.business_id == business_id)
            .order_by(Visit.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_open_visits(self, business_id: UUID) -> list[Visit]:
        stmt = (
            select(Visit)
            .options(selectinload(Visit.services))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.OPEN,
            )
            .order_by(Visit.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_completed_visits(self, business_id: UUID) -> list[Visit]:
        stmt = (
            select(Visit)
            .options(selectinload(Visit.services))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
            .order_by(Visit.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())
