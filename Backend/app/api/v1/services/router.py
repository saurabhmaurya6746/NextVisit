import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.service import (
    ServiceCreate,
    ServiceResponse,
    ServiceUpdate,
)
from app.services.service_service import ServiceService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/services",
    tags=["Services"],
)


@router.get(
    "",
    response_model=list[ServiceResponse],
    summary="Get all services of the authenticated business",
)
def list_services(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all services belonging to the authenticated user's business.
    Requires a valid Bearer JWT.
    """
    return ServiceService(db).list_services(current_user)


@router.get(
    "/{service_id}",
    response_model=ServiceResponse,
    summary="Get a service by ID",
)
def get_service(
    service_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns details of a service belonging to the authenticated user's business.
    Returns HTTP 404 if not found or belongs to another business.
    Requires a valid Bearer JWT.
    """
    return ServiceService(db).get_service(current_user, service_id)


@router.post(
    "",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new service for the business",
)
def create_service(
    data: ServiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new service under the authenticated user's business.
    Service name must be unique within the business.
    Requires a valid Bearer JWT.
    """
    return ServiceService(db).create_service(current_user, data)


@router.put(
    "/{service_id}",
    response_model=ServiceResponse,
    summary="Update an existing service",
)
def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates editable fields of a service belonging to the authenticated user's business.
    Returns HTTP 404 if not found or belongs to another business.
    Returns HTTP 409 if service name conflicts with another service in the business.
    Requires a valid Bearer JWT.
    """
    return ServiceService(db).update_service(current_user, service_id, data)
