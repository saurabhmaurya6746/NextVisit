import logging
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.salon_service_category import SalonServiceCategory
from app.models.user import User
from app.schemas.salon_service_category import (
    SalonServiceCategoryCreate,
    SalonServiceCategoryReorderItem,
    SalonServiceCategoryUpdate,
)

logger = logging.getLogger(__name__)


class SalonServiceCategoryService:

    def __init__(self, db: Session):
        self.db = db

    def list_categories(self, current_user: User) -> list[SalonServiceCategory]:
        return (
            self.db.query(SalonServiceCategory)
            .filter(SalonServiceCategory.business_id == current_user.business_id)
            .order_by(SalonServiceCategory.display_order.asc(), SalonServiceCategory.created_at.asc())
            .all()
        )

    def create_category(self, current_user: User, data: SalonServiceCategoryCreate) -> SalonServiceCategory:
        max_order = (
            self.db.query(SalonServiceCategory)
            .filter(SalonServiceCategory.business_id == current_user.business_id)
            .count()
        )
        category = SalonServiceCategory(
            business_id=current_user.business_id,
            name=data.name.strip(),
            display_order=data.display_order or max_order,
            is_active=data.is_active,
        )
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        logger.info("Salon Service Category created | id=%s business_id=%s", category.id, category.business_id)
        return category

    def update_category(self, current_user: User, category_id: UUID, data: SalonServiceCategoryUpdate) -> SalonServiceCategory:
        category = (
            self.db.query(SalonServiceCategory)
            .filter(SalonServiceCategory.id == category_id, SalonServiceCategory.business_id == current_user.business_id)
            .first()
        )
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service category not found.")

        if data.name is not None:
            category.name = data.name.strip()
        if data.display_order is not None:
            category.display_order = data.display_order
        if data.is_active is not None:
            category.is_active = data.is_active

        self.db.commit()
        self.db.refresh(category)
        return category

    def delete_category(self, current_user: User, category_id: UUID) -> None:
        category = (
            self.db.query(SalonServiceCategory)
            .filter(SalonServiceCategory.id == category_id, SalonServiceCategory.business_id == current_user.business_id)
            .first()
        )
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service category not found.")

        self.db.delete(category)
        self.db.commit()

    def reorder_categories(self, current_user: User, items: list[SalonServiceCategoryReorderItem]) -> list[SalonServiceCategory]:
        for item in items:
            cat = (
                self.db.query(SalonServiceCategory)
                .filter(SalonServiceCategory.id == item.id, SalonServiceCategory.business_id == current_user.business_id)
                .first()
            )
            if cat:
                cat.display_order = item.display_order
        self.db.commit()
        return self.list_categories(current_user)
