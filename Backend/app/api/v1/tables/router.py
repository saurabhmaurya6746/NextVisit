from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_optional_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dining_area import DiningAreaMapResponse
from app.schemas.restaurant_table import RestaurantTableCreate, RestaurantTableResponse, RestaurantTableUpdate
from app.services.restaurant_table_service import RestaurantTableService

router = APIRouter(prefix="/tables", tags=["Restaurant Tables"])


@router.get("/map", response_model=list[DiningAreaMapResponse], summary="Get grouped dining areas and table map")
def get_tables_map(
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return RestaurantTableService(db).get_tables_map(current_user)


@router.get("", response_model=list[RestaurantTableResponse], summary="List restaurant tables")
def list_restaurant_tables(
    dining_area_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return RestaurantTableService(db).list_tables(current_user, dining_area_id)


@router.post("", response_model=RestaurantTableResponse, status_code=status.HTTP_201_CREATED, summary="Create restaurant table")
def create_restaurant_table(
    data: RestaurantTableCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return RestaurantTableService(db).create_table(current_user, data)


@router.put("/{id}", response_model=RestaurantTableResponse, summary="Update restaurant table")
def update_restaurant_table(
    id: UUID,
    data: RestaurantTableUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return RestaurantTableService(db).update_table(current_user, id, data)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete restaurant table")
def delete_restaurant_table(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    RestaurantTableService(db).delete_table(current_user, id)
    return None


@router.post("/{id}/release", summary="Force release table (Manager Override)")
def force_release_table(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return RestaurantTableService(db).force_release_table(current_user, id)
