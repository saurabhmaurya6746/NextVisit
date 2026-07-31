import uuid
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem


class MenuRepository:

    def __init__(self, db: Session):
        self.db = db

    # -------------------------------------------------------------------------
    # CATEGORIES
    # -------------------------------------------------------------------------

    def create_category(self, category: MenuCategory) -> MenuCategory:
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def get_category_by_id(self, category_id: uuid.UUID, business_id: uuid.UUID) -> MenuCategory | None:
        stmt = select(MenuCategory).where(
            MenuCategory.id == category_id,
            MenuCategory.business_id == business_id,
        )
        return self.db.scalar(stmt)

    def get_category_by_name(self, business_id: uuid.UUID, name: str) -> MenuCategory | None:
        stmt = select(MenuCategory).where(
            MenuCategory.business_id == business_id,
            func.lower(MenuCategory.name) == func.lower(name.strip()),
        )
        return self.db.scalar(stmt)

    def list_categories(self, business_id: uuid.UUID) -> list[MenuCategory]:
        stmt = (
            select(MenuCategory)
            .options(joinedload(MenuCategory.items))
            .where(MenuCategory.business_id == business_id)
            .order_by(MenuCategory.display_order.asc(), MenuCategory.created_at.asc())
        )
        return list(self.db.scalars(stmt).unique().all())

    def update_category(self, category: MenuCategory) -> MenuCategory:
        self.db.commit()
        self.db.refresh(category)
        return category

    def delete_category(self, category: MenuCategory) -> None:
        self.db.delete(category)
        self.db.commit()

    # -------------------------------------------------------------------------
    # ITEMS
    # -------------------------------------------------------------------------

    def create_item(self, item: MenuItem) -> MenuItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_item_by_id(self, item_id: uuid.UUID, business_id: uuid.UUID) -> MenuItem | None:
        stmt = select(MenuItem).where(
            MenuItem.id == item_id,
            MenuItem.business_id == business_id,
        )
        return self.db.scalar(stmt)

    def get_item_by_name_and_category(
        self, business_id: uuid.UUID, category_id: uuid.UUID, name: str
    ) -> MenuItem | None:
        stmt = select(MenuItem).where(
            MenuItem.business_id == business_id,
            MenuItem.category_id == category_id,
            func.lower(MenuItem.name) == func.lower(name.strip()),
        )
        return self.db.scalar(stmt)

    def list_items(
        self,
        business_id: uuid.UUID,
        category_id: uuid.UUID | None = None,
        available_only: bool = False,
    ) -> list[MenuItem]:
        stmt = (
            select(MenuItem)
            .where(MenuItem.business_id == business_id)
        )
        if category_id:
            stmt = stmt.where(MenuItem.category_id == category_id)
        if available_only:
            stmt = stmt.where(MenuItem.is_available == True)
        stmt = stmt.order_by(MenuItem.display_order.asc(), MenuItem.created_at.asc())
        return list(self.db.scalars(stmt).all())

    def update_item(self, item: MenuItem) -> MenuItem:
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_item(self, item: MenuItem) -> None:
        self.db.delete(item)
        self.db.commit()
