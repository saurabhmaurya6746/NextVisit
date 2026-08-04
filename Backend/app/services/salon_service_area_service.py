import logging
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.salon_service_area import SalonServiceArea
from app.models.user import User
from app.schemas.salon_service_area import (
    SalonServiceAreaCreate,
    SalonServiceAreaReorderItem,
    SalonServiceAreaUpdate,
)

logger = logging.getLogger(__name__)


class SalonServiceAreaService:

    def __init__(self, db: Session):
        self.db = db

    def list_service_areas(self, current_user: User) -> list[SalonServiceArea]:
        return (
            self.db.query(SalonServiceArea)
            .filter(SalonServiceArea.business_id == current_user.business_id)
            .order_by(SalonServiceArea.display_order.asc(), SalonServiceArea.created_at.asc())
            .all()
        )

    def create_service_area(self, current_user: User, data: SalonServiceAreaCreate) -> SalonServiceArea:
        max_order = (
            self.db.query(SalonServiceArea)
            .filter(SalonServiceArea.business_id == current_user.business_id)
            .count()
        )
        area = SalonServiceArea(
            business_id=current_user.business_id,
            name=data.name.strip(),
            display_order=data.display_order or max_order,
            is_active=data.is_active,
        )
        self.db.add(area)
        self.db.commit()
        self.db.refresh(area)
        logger.info("Salon Service Area created | id=%s business_id=%s", area.id, area.business_id)
        return area

    def update_service_area(self, current_user: User, area_id: UUID, data: SalonServiceAreaUpdate) -> SalonServiceArea:
        area = (
            self.db.query(SalonServiceArea)
            .filter(SalonServiceArea.id == area_id, SalonServiceArea.business_id == current_user.business_id)
            .first()
        )
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service area not found.")

        if data.name is not None:
            area.name = data.name.strip()
        if data.display_order is not None:
            area.display_order = data.display_order
        if data.is_active is not None:
            area.is_active = data.is_active

        self.db.commit()
        self.db.refresh(area)
        return area

    def delete_service_area(self, current_user: User, area_id: UUID) -> None:
        area = (
            self.db.query(SalonServiceArea)
            .filter(SalonServiceArea.id == area_id, SalonServiceArea.business_id == current_user.business_id)
            .first()
        )
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service area not found.")

        self.db.delete(area)
        self.db.commit()

    def reorder_service_areas(self, current_user: User, items: list[SalonServiceAreaReorderItem]) -> list[SalonServiceArea]:
        for item in items:
            area = (
                self.db.query(SalonServiceArea)
                .filter(SalonServiceArea.id == item.id, SalonServiceArea.business_id == current_user.business_id)
                .first()
            )
            if area:
                area.display_order = item.display_order
        self.db.commit()
        return self.list_service_areas(current_user)
