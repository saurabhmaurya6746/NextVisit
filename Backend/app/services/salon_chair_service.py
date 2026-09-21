import logging
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.salon_chair import SalonChair
from app.models.salon_service_area import SalonServiceArea
from app.models.user import User
from app.schemas.salon_chair import (
    SalonChairCreate,
    SalonChairUpdate,
    SalonDashboardChairMetrics,
)

logger = logging.getLogger(__name__)


class SalonChairService:

    def __init__(self, db: Session):
        self.db = db

    def list_chairs(self, current_user: User, service_area_id: UUID | None = None) -> list[SalonChair]:
        q = self.db.query(SalonChair).filter(SalonChair.business_id == current_user.business_id)
        if service_area_id:
            q = q.filter(SalonChair.service_area_id == service_area_id)
        return q.order_by(SalonChair.display_order.asc(), SalonChair.created_at.asc()).all()

    def get_chair(self, current_user: User, chair_id: UUID) -> SalonChair:
        chair = (
            self.db.query(SalonChair)
            .filter(SalonChair.id == chair_id, SalonChair.business_id == current_user.business_id)
            .first()
        )
        if not chair:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chair not found.")
        return chair

    def get_chair_metrics(self, current_user: User) -> SalonDashboardChairMetrics:
        chairs = self.db.query(SalonChair).filter(SalonChair.business_id == current_user.business_id, SalonChair.is_active == True).all()
        available = sum(1 for c in chairs if c.status == "Available")
        occupied = sum(1 for c in chairs if c.status in ["In Service", "Occupied"])
        reserved = sum(1 for c in chairs if c.status == "Reserved")
        cleaning = sum(1 for c in chairs if c.status == "Cleaning")
        return SalonDashboardChairMetrics(
            available=available,
            occupied=occupied,
            reserved=reserved,
            cleaning=cleaning,
            total=len(chairs),
        )

    def create_chair(self, current_user: User, data: SalonChairCreate) -> SalonChair:
        area = (
            self.db.query(SalonServiceArea)
            .filter(SalonServiceArea.id == data.service_area_id, SalonServiceArea.business_id == current_user.business_id)
            .first()
        )
        if not area:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service area not found.")

        count = (
            self.db.query(SalonChair)
            .filter(SalonChair.business_id == current_user.business_id, SalonChair.service_area_id == data.service_area_id)
            .count()
        )
        chair = SalonChair(
            business_id=current_user.business_id,
            service_area_id=data.service_area_id,
            chair_name=data.chair_name.strip(),
            chair_number=data.chair_number.strip() if data.chair_number else None,
            workstation_type=data.workstation_type.strip() if data.workstation_type else "Chair",
            status=data.status or "Available",
            display_order=data.display_order or count,
            is_active=data.is_active,
        )
        self.db.add(chair)
        self.db.commit()
        self.db.refresh(chair)
        logger.info("Salon Chair created | id=%s business_id=%s area_id=%s", chair.id, chair.business_id, chair.service_area_id)
        return chair

    def update_chair(self, current_user: User, chair_id: UUID, data: SalonChairUpdate) -> SalonChair:
        chair = self.get_chair(current_user, chair_id)

        if data.service_area_id is not None:
            area = (
                self.db.query(SalonServiceArea)
                .filter(SalonServiceArea.id == data.service_area_id, SalonServiceArea.business_id == current_user.business_id)
                .first()
            )
            if not area:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service area not found.")
            chair.service_area_id = data.service_area_id

        if data.chair_name is not None:
            chair.chair_name = data.chair_name.strip()
        if data.chair_number is not None:
            chair.chair_number = data.chair_number.strip() if data.chair_number else None
        if data.workstation_type is not None:
            chair.workstation_type = data.workstation_type.strip()
        if data.status is not None:
            chair.status = data.status.strip()
        if data.display_order is not None:
            chair.display_order = data.display_order
        if data.is_active is not None:
            chair.is_active = data.is_active

        self.db.commit()
        self.db.refresh(chair)
        return chair

    def update_chair_status(self, current_user: User, chair_id: UUID, new_status: str) -> SalonChair:
        chair = self.get_chair(current_user, chair_id)
        new_st = new_status.strip()

        # Prevent double booking if reserving
        if new_st == "Reserved" and chair.status != "Available":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Chair is already {chair.status.lower()} and cannot be reserved.",
            )

        chair.status = new_st
        self.db.commit()
        self.db.refresh(chair)
        logger.info("Salon Chair status updated | id=%s new_status=%s", chair.id, new_st)
        return chair

    def release_chair(self, current_user: User, chair_id: UUID) -> SalonChair:
        chair = self.get_chair(current_user, chair_id)
        chair.status = "Available"
        self.db.commit()
        self.db.refresh(chair)
        logger.info("Salon Chair released to Available | id=%s", chair.id)
        return chair

    def delete_chair(self, current_user: User, chair_id: UUID) -> None:
        chair = self.get_chair(current_user, chair_id)
        self.db.delete(chair)
        self.db.commit()
