from uuid import UUID

from sqlalchemy import select

from app.models.service import Service
from app.repositories.base_repository import BaseRepository


class ServiceRepository(BaseRepository):

    def get_all_by_business(self, business_id: UUID) -> list[Service]:
        stmt = (
            select(Service)
            .where(Service.business_id == business_id)
            .order_by(Service.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, service_id: UUID) -> Service | None:
        stmt = select(Service).where(Service.id == service_id)
        return self.db.scalar(stmt)

    def get_by_name(self, business_id: UUID, name: str) -> Service | None:
        stmt = select(Service).where(
            Service.business_id == business_id,
            Service.name == name,
        )
        return self.db.scalar(stmt)

    def create(self, service: Service) -> Service:
        self.db.add(service)
        self.db.flush()
        self.db.refresh(service)
        return service

    def update(self, service: Service) -> Service:
        self.db.flush()
        self.db.refresh(service)
        return service
