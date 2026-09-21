from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.salon_service_category import (
    SalonServiceCategoryCreate,
    SalonServiceCategoryReorderItem,
    SalonServiceCategoryResponse,
    SalonServiceCategoryUpdate,
)
from app.services.salon_service_category_service import SalonServiceCategoryService

router = APIRouter(prefix="/salon/service-categories", tags=["Salon Service Categories"])


@router.get("", response_model=list[SalonServiceCategoryResponse], summary="List all service categories for salon")
def list_service_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonServiceCategoryService(db).list_categories(current_user)


@router.post("", response_model=SalonServiceCategoryResponse, status_code=status.HTTP_201_CREATED, summary="Create service category")
def create_service_category(
    data: SalonServiceCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonServiceCategoryService(db).create_category(current_user, data)


@router.post("/reorder", response_model=list[SalonServiceCategoryResponse], summary="Reorder service categories")
def reorder_service_categories(
    items: list[SalonServiceCategoryReorderItem],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonServiceCategoryService(db).reorder_categories(current_user, items)


@router.put("/{id}", response_model=SalonServiceCategoryResponse, summary="Update service category")
def update_service_category(
    id: UUID,
    data: SalonServiceCategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonServiceCategoryService(db).update_category(current_user, id, data)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete service category")
def delete_service_category(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    SalonServiceCategoryService(db).delete_category(current_user, id)
    return None
