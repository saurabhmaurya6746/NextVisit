import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.client_device import (
    ClientDeviceAutoRegister,
    ClientDeviceCreate,
    ClientDeviceResponse,
    ClientDeviceUpdate,
)
from app.services.client_device_service import ClientDeviceService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/devices",
    tags=["POS Device Management"],
)


@router.post(
    "",
    response_model=ClientDeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new POS device for offline operations",
)
def register_device(
    data: ClientDeviceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role.upper() not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and administrators are authorized to register POS devices.",
        )
    return ClientDeviceService(db).register_device(current_user, data)


@router.post(
    "/auto-register",
    response_model=ClientDeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Automatically enroll this POS app installation",
)
def auto_register_device(
    data: ClientDeviceAutoRegister,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role.upper() not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A business owner or administrator must sign in once to authorize this POS terminal.",
        )
    return ClientDeviceService(db).auto_register_device(current_user, data)


@router.get(
    "",
    response_model=list[ClientDeviceResponse],
    summary="List all registered POS devices for the authenticated business",
)
def list_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ClientDeviceService(db).list_devices(current_user)


@router.get(
    "/{device_id}",
    response_model=ClientDeviceResponse,
    summary="Get single device details",
)
def get_device(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ClientDeviceService(db).get_device(current_user, device_id)


@router.patch(
    "/{device_id}",
    response_model=ClientDeviceResponse,
    summary="Update device status or name",
)
def update_device(
    device_id: UUID,
    data: ClientDeviceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role.upper() not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and administrators are authorized to update POS devices.",
        )
    return ClientDeviceService(db).update_device(current_user, device_id, data)


@router.delete(
    "/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a registered POS device",
)
def delete_device(
    device_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role.upper() not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and administrators are authorized to delete POS devices.",
        )
    ClientDeviceService(db).delete_device(current_user, device_id)
    return None
