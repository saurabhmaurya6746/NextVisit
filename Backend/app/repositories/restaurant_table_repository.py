import uuid
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.restaurant_table import RestaurantTable


class RestaurantTableRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, table: RestaurantTable) -> RestaurantTable:
        self.db.add(table)
        self.db.commit()
        self.db.refresh(table)
        return table

    def get_by_id(self, table_id: uuid.UUID, business_id: uuid.UUID) -> RestaurantTable | None:
        stmt = select(RestaurantTable).where(
            RestaurantTable.id == table_id,
            RestaurantTable.business_id == business_id,
        )
        return self.db.scalar(stmt)

    def list_by_business(
        self, business_id: uuid.UUID, dining_area_id: uuid.UUID | None = None
    ) -> list[RestaurantTable]:
        stmt = select(RestaurantTable).where(RestaurantTable.business_id == business_id)
        if dining_area_id:
            stmt = stmt.where(RestaurantTable.dining_area_id == dining_area_id)
        stmt = stmt.order_by(RestaurantTable.display_order.asc(), RestaurantTable.created_at.asc())
        return list(self.db.scalars(stmt).all())

    def count_by_dining_area(self, dining_area_id: uuid.UUID, business_id: uuid.UUID) -> int:
        stmt = select(func.count(RestaurantTable.id)).where(
            RestaurantTable.dining_area_id == dining_area_id,
            RestaurantTable.business_id == business_id,
        )
        return self.db.scalar(stmt) or 0

    def update(self, table: RestaurantTable) -> RestaurantTable:
        self.db.commit()
        self.db.refresh(table)
        return table

    def delete(self, table: RestaurantTable) -> None:
        self.db.delete(table)
        self.db.commit()
