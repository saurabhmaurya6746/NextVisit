import logging
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.dining_area import DiningArea
from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.repositories.dining_area_repository import DiningAreaRepository
from app.repositories.restaurant_table_repository import RestaurantTableRepository
from app.schemas.dining_area import DiningAreaCreate, DiningAreaUpdate
from app.schemas.setup import AreaSetupItem

logger = logging.getLogger(__name__)


class DiningAreaService:

    def __init__(self, db: Session):
        self.db = db
        self.area_repo = DiningAreaRepository(db)
        self.table_repo = RestaurantTableRepository(db)

    def list_areas(self, current_user: User) -> list[DiningArea]:
        return self.area_repo.list_by_business(current_user.business_id)

    def get_area(self, current_user: User, area_id: uuid.UUID) -> DiningArea:
        area = self.area_repo.get_by_id(area_id, current_user.business_id)
        if not area:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dining area '{area_id}' not found.",
            )
        return area

    def create_area(self, current_user: User, data: DiningAreaCreate) -> DiningArea:
        area = DiningArea(
            business_id=current_user.business_id,
            name=data.name.strip(),
            display_order=data.display_order,
            color=data.color,
            is_active=data.is_active,
        )
        created = self.area_repo.create(area)
        logger.info("Dining area created: name=%s, business_id=%s", created.name, current_user.business_id)
        return created

    def update_area(self, current_user: User, area_id: uuid.UUID, data: DiningAreaUpdate) -> DiningArea:
        area = self.get_area(current_user, area_id)
        update_dict = data.model_dump(exclude_unset=True)
        for key, val in update_dict.items():
            if key == "name" and val is not None:
                val = val.strip()
            setattr(area, key, val)
        return self.area_repo.update(area)

    def delete_area(self, current_user: User, area_id: uuid.UUID) -> None:
        area = self.get_area(current_user, area_id)
        # Service Validation Guard: Cannot delete area if tables exist
        table_count = self.table_repo.count_by_dining_area(area_id, current_user.business_id)
        if table_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete dining area '{area.name}' because it contains {table_count} active table(s). Please delete or move the tables first.",
            )
        self.area_repo.delete(area)
        logger.info("Dining area deleted: id=%s, business_id=%s", area_id, current_user.business_id)

    def batch_setup_tables(self, current_user: User, items: list[AreaSetupItem]) -> dict:
        areas_created = 0
        tables_created = 0

        existing_areas = self.area_repo.list_by_business(current_user.business_id)
        area_order_offset = len(existing_areas)

        for i, item in enumerate(items):
            area_name = item.name.strip()
            table_count = item.count

            # Check if area already exists for this business
            matching_area = next((a for a in existing_areas if a.name.lower() == area_name.lower()), None)

            if not matching_area:
                area = DiningArea(
                    business_id=current_user.business_id,
                    name=area_name,
                    display_order=area_order_offset + i + 1,
                    is_active=True,
                )
                matching_area = self.area_repo.create(area)
                existing_areas.append(matching_area)
                areas_created += 1

            existing_tables = self.table_repo.list_by_business(current_user.business_id, matching_area.id)
            table_order_offset = len(existing_tables)

            for t in range(1, table_count + 1):
                if table_count == 1 and table_order_offset == 0 and area_name.lower() in ("parcel", "take away", "takeaway"):
                    tbl_name = area_name
                elif table_count == 1 and table_order_offset == 0:
                    tbl_name = f"{area_name} 1" if "table" not in area_name.lower() else area_name
                else:
                    table_number = table_order_offset + t
                    tbl_name = f"{area_name} {table_number}"

                table = RestaurantTable(
                    business_id=current_user.business_id,
                    dining_area_id=matching_area.id,
                    table_name=tbl_name,
                    capacity=4,
                    display_order=table_order_offset + t,
                    is_active=True,
                )
                self.table_repo.create(table)
                tables_created += 1

        logger.info(
            "Batch table setup completed for business %s: %d areas, %d tables created.",
            current_user.business_id,
            areas_created,
            tables_created,
        )

        return {
            "message": f"Successfully configured {areas_created} dining area(s) and {tables_created} table(s).",
            "areas_created": areas_created,
            "tables_created": tables_created,
        }
