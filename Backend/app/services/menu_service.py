import logging
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem
from app.models.user import User
from app.repositories.menu_repository import MenuRepository
from app.schemas.menu import (
    MenuCategoryCreate,
    MenuCategoryUpdate,
    MenuItemCreate,
    MenuItemUpdate,
)

logger = logging.getLogger(__name__)


class MenuService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = MenuRepository(db)

    # -------------------------------------------------------------------------
    # CATEGORIES
    # -------------------------------------------------------------------------

    def list_categories(self, current_user: User) -> list[MenuCategory]:
        return self.repo.list_categories(current_user.business_id)

    def get_category(self, current_user: User, category_id: uuid.UUID) -> MenuCategory:
        cat = self.repo.get_category_by_id(category_id, current_user.business_id)
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu category '{category_id}' not found.",
            )
        return cat

    def create_category(self, current_user: User, data: MenuCategoryCreate) -> MenuCategory:
        category = MenuCategory(
            business_id=current_user.business_id,
            name=data.name.strip(),
            display_order=data.display_order,
            is_active=data.is_active,
        )
        created = self.repo.create_category(category)
        logger.info("Menu category created: name=%s, business=%s", created.name, current_user.business_id)
        return created

    def update_category(self, current_user: User, category_id: uuid.UUID, data: MenuCategoryUpdate) -> MenuCategory:
        cat = self.get_category(current_user, category_id)
        update_dict = data.model_dump(exclude_unset=True)
        for key, val in update_dict.items():
            if key == "name" and val is not None:
                val = val.strip()
            setattr(cat, key, val)
        return self.repo.update_category(cat)

    def delete_category(self, current_user: User, category_id: uuid.UUID) -> None:
        cat = self.get_category(current_user, category_id)
        self.repo.delete_category(cat)
        logger.info("Menu category deleted: id=%s", category_id)

    # -------------------------------------------------------------------------
    # ITEMS
    # -------------------------------------------------------------------------

    def list_items(
        self,
        current_user: User,
        category_id: uuid.UUID | None = None,
        available_only: bool = False,
    ) -> list[MenuItem]:
        return self.repo.list_items(current_user.business_id, category_id, available_only)

    def get_item(self, current_user: User, item_id: uuid.UUID) -> MenuItem:
        item = self.repo.get_item_by_id(item_id, current_user.business_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu item '{item_id}' not found.",
            )
        return item

    def create_item(self, current_user: User, data: MenuItemCreate) -> MenuItem:
        # Validate category belongs to this business
        cat = self.repo.get_category_by_id(data.category_id, current_user.business_id)
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu category '{data.category_id}' not found for your business.",
            )

        item = MenuItem(
            category_id=data.category_id,
            business_id=current_user.business_id,
            name=data.name.strip(),
            description=data.description,
            price=data.price,
            gst_percentage=data.gst_percentage,
            is_veg=data.is_veg,
            is_available=data.is_available,
            display_order=data.display_order,
        )
        created = self.repo.create_item(item)
        logger.info("Menu item created: name=%s, category=%s", created.name, cat.name)
        return created

    def update_item(self, current_user: User, item_id: uuid.UUID, data: MenuItemUpdate) -> MenuItem:
        item = self.get_item(current_user, item_id)
        update_dict = data.model_dump(exclude_unset=True)

        if "category_id" in update_dict and update_dict["category_id"] is not None:
            cat = self.repo.get_category_by_id(update_dict["category_id"], current_user.business_id)
            if not cat:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Target category '{update_dict['category_id']}' not found.",
                )

        for key, val in update_dict.items():
            if key == "name" and val is not None:
                val = val.strip()
            setattr(item, key, val)
        return self.repo.update_item(item)

    def delete_item(self, current_user: User, item_id: uuid.UUID) -> None:
        item = self.get_item(current_user, item_id)
        self.repo.delete_item(item)
        logger.info("Menu item deleted: id=%s", item_id)
