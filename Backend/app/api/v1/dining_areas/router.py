from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dining_area import DiningAreaCreate, DiningAreaResponse, DiningAreaUpdate
from app.services.dining_area_service import DiningAreaService

router = APIRouter(prefix="/dining-areas", tags=["Dining Areas"])


@router.get("", response_model=list[DiningAreaResponse], summary="List all dining areas")
def list_dining_areas(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DiningAreaService(db).list_areas(current_user)


@router.post("", response_model=DiningAreaResponse, status_code=status.HTTP_201_CREATED, summary="Create dining area")
def create_dining_area(
    data: DiningAreaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DiningAreaService(db).create_area(current_user, data)


@router.put("/{id}", response_model=DiningAreaResponse, summary="Update dining area")
def update_dining_area(
    id: UUID,
    data: DiningAreaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DiningAreaService(db).update_area(current_user, id, data)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete dining area")
def delete_dining_area(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    DiningAreaService(db).delete_area(current_user, id)
    return None
