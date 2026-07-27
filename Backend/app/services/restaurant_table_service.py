import logging
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.repositories.dining_area_repository import DiningAreaRepository
from app.repositories.restaurant_table_repository import RestaurantTableRepository
from app.schemas.restaurant_table import RestaurantTableCreate, RestaurantTableUpdate

from app.repositories.order_repository import OrderRepository

logger = logging.getLogger(__name__)


class RestaurantTableService:

    def __init__(self, db: Session):
        self.db = db
        self.table_repo = RestaurantTableRepository(db)
        self.area_repo = DiningAreaRepository(db)
        self.order_repo = OrderRepository(db)

    def list_tables(self, current_user: User, dining_area_id: uuid.UUID | None = None) -> list[RestaurantTable]:
        if dining_area_id:
            # Validate area belongs to business
            area = self.area_repo.get_by_id(dining_area_id, current_user.business_id)
            if not area:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Dining area '{dining_area_id}' not found.",
                )
        return self.table_repo.list_by_business(current_user.business_id, dining_area_id)

    def get_table(self, current_user: User, table_id: uuid.UUID) -> RestaurantTable:
        table = self.table_repo.get_by_id(table_id, current_user.business_id)
        if not table:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Restaurant table '{table_id}' not found.",
            )
        return table

    def create_table(self, current_user: User, data: RestaurantTableCreate) -> RestaurantTable:
        # Business Validation: Ensure dining_area_id belongs to the business
        area = self.area_repo.get_by_id(data.dining_area_id, current_user.business_id)
        if not area:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dining area '{data.dining_area_id}' not found for your business.",
            )

        table = RestaurantTable(
            business_id=current_user.business_id,
            dining_area_id=data.dining_area_id,
            table_name=data.table_name.strip(),
            capacity=data.capacity,
            display_order=data.display_order,
            is_active=data.is_active,
        )
        created = self.table_repo.create(table)
        logger.info("Restaurant table created: name=%s, area=%s", created.table_name, area.name)
        return created

    def update_table(self, current_user: User, table_id: uuid.UUID, data: RestaurantTableUpdate) -> RestaurantTable:
        table = self.get_table(current_user, table_id)
        update_dict = data.model_dump(exclude_unset=True)

        if "dining_area_id" in update_dict and update_dict["dining_area_id"] is not None:
            area = self.area_repo.get_by_id(update_dict["dining_area_id"], current_user.business_id)
            if not area:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Target dining area '{update_dict['dining_area_id']}' not found.",
                )

        for key, val in update_dict.items():
            if key == "table_name" and val is not None:
                val = val.strip()
            setattr(table, key, val)
        return self.table_repo.update(table)

    def delete_table(self, current_user: User, table_id: uuid.UUID) -> None:
        table = self.get_table(current_user, table_id)
        self.table_repo.delete(table)
        logger.info("Restaurant table deleted: id=%s, business_id=%s", table_id, current_user.business_id)

    def get_tables_map(self, current_user: User) -> list[dict]:
        areas = self.area_repo.list_by_business(current_user.business_id)
        result = []

        for area in areas:
            tables = self.table_repo.list_by_business(current_user.business_id, area.id)
            tables_data = []

            for t in tables:
                active_order = self.order_repo.get_active_order_for_table(t.id, current_user.business_id)

                if active_order:
                    table_info = {
                        "id": t.id,
                        "table_name": t.table_name,
                        "capacity": t.capacity,
                        "display_order": t.display_order,
                        "is_active": t.is_active,
                        "status": active_order.status.value,
                        "current_order_id": active_order.id,
                        "pending_amount": float(active_order.total_amount),
                        "item_count": sum(it.quantity for it in active_order.items),
                        "order_source": active_order.order_source.value,
                        "last_updated": active_order.updated_at or active_order.created_at,
                    }
                else:
                    table_info = {
                        "id": t.id,
                        "table_name": t.table_name,
                        "capacity": t.capacity,
                        "display_order": t.display_order,
                        "is_active": t.is_active,
                        "status": "EMPTY",
                        "current_order_id": None,
                        "pending_amount": 0.0,
                        "item_count": 0,
                        "order_source": None,
                        "last_updated": None,
                    }
                tables_data.append(table_info)

            result.append({
                "id": area.id,
                "name": area.name,
                "display_order": area.display_order,
                "color": area.color,
                "is_active": area.is_active,
                "tables": tables_data,
            })

        return result
