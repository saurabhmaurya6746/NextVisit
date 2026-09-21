from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.salon_service_area import (
    SalonServiceAreaCreate,
    SalonServiceAreaReorderItem,
    SalonServiceAreaResponse,
    SalonServiceAreaUpdate,
)
from app.services.salon_service_area_service import SalonServiceAreaService

router = APIRouter(prefix="/salon/service-areas", tags=["Salon Service Areas"])


@router.get("", response_model=list[SalonServiceAreaResponse], summary="List all service areas for salon")
def list_service_areas(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonServiceAreaService(db).list_service_areas(current_user)


@router.post("", response_model=SalonServiceAreaResponse, status_code=status.HTTP_201_CREATED, summary="Create service area")
def create_service_area(
    data: SalonServiceAreaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonServiceAreaService(db).create_service_area(current_user, data)


@router.post("/reorder", response_model=list[SalonServiceAreaResponse], summary="Reorder service areas")
def reorder_service_areas(
    items: list[SalonServiceAreaReorderItem],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonServiceAreaService(db).reorder_service_areas(current_user, items)


@router.put("/{id}", response_model=SalonServiceAreaResponse, summary="Update service area")
def update_service_area(
    id: UUID,
    data: SalonServiceAreaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonServiceAreaService(db).update_service_area(current_user, id, data)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete service area")
def delete_service_area(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    SalonServiceAreaService(db).delete_service_area(current_user, id)
    return None
