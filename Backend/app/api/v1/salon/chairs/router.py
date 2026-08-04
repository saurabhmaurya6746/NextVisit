from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.salon_chair import (
    SalonChairCreate,
    SalonChairResponse,
    SalonChairStatusUpdate,
    SalonChairUpdate,
    SalonDashboardChairMetrics,
)
from app.services.salon_chair_service import SalonChairService

router = APIRouter(prefix="/salon/chairs", tags=["Salon Chairs"])


@router.get("/metrics", response_model=SalonDashboardChairMetrics, summary="Get Salon Dashboard Chair metrics")
def get_chair_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonChairService(db).get_chair_metrics(current_user)


@router.get("", response_model=list[SalonChairResponse], summary="List salon chairs")
def list_chairs(
    service_area_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonChairService(db).list_chairs(current_user, service_area_id)


@router.post("", response_model=SalonChairResponse, status_code=status.HTTP_201_CREATED, summary="Create salon chair")
def create_chair(
    data: SalonChairCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonChairService(db).create_chair(current_user, data)


@router.put("/{id}", response_model=SalonChairResponse, summary="Update salon chair")
def update_chair(
    id: UUID,
    data: SalonChairUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonChairService(db).update_chair(current_user, id, data)


@router.put("/{id}/status", response_model=SalonChairResponse, summary="Update salon chair status (with double booking check)")
def update_chair_status(
    id: UUID,
    body: SalonChairStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonChairService(db).update_chair_status(current_user, id, body.status)


@router.put("/{id}/release", response_model=SalonChairResponse, summary="Release chair status to Available (30-second release API)")
def release_chair(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SalonChairService(db).release_chair(current_user, id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete salon chair")
def delete_chair(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    SalonChairService(db).delete_chair(current_user, id)
    return None
