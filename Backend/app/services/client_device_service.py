import logging
import re
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_device import ClientDevice
from app.models.user import User
from app.repositories.client_device_repository import ClientDeviceRepository
from app.schemas.client_device import ClientDeviceCreate, ClientDeviceUpdate

logger = logging.getLogger(__name__)


class ClientDeviceService:

    def __init__(self, db: Session):
        self.db = db
        self.device_repo = ClientDeviceRepository(db)

    def register_device(self, current_user: User, data: ClientDeviceCreate) -> ClientDevice:
        clean_prefix = data.device_prefix.strip().upper()
        if not re.match(r"^[A-Z0-9]{1,10}$", clean_prefix):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device prefix must be 1-10 alphanumeric uppercase characters (e.g., 'D1', 'POS01', 'TAB1').",
            )

        existing = self.device_repo.get_by_prefix(current_user.business_id, clean_prefix)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Device prefix '{clean_prefix}' is already registered for this business.",
            )

        device = ClientDevice(
            business_id=current_user.business_id,
            device_name=data.device_name.strip(),
            device_type=data.device_type.strip(),
            device_prefix=clean_prefix,
            device_identifier=data.device_identifier.strip() if data.device_identifier else None,
            is_active=True,
        )
        created = self.device_repo.create(device)
        logger.info(
            "POS Device registered: id=%s, name=%s, prefix=%s, business=%s",
            created.id,
            created.device_name,
            created.device_prefix,
            current_user.business_id,
        )
        return created

    def list_devices(self, current_user: User) -> list[ClientDevice]:
        return self.device_repo.list_by_business(current_user.business_id)

    def get_device(self, current_user: User, device_id: uuid.UUID) -> ClientDevice:
        device = self.device_repo.get_by_id_and_business(device_id, current_user.business_id)
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device '{device_id}' not found for this business.",
            )
        return device

    def update_device(self, current_user: User, device_id: uuid.UUID, data: ClientDeviceUpdate) -> ClientDevice:
        device = self.get_device(current_user, device_id)
        if data.device_name is not None and data.device_name.strip():
            device.device_name = data.device_name.strip()
        if data.is_active is not None:
            device.is_active = data.is_active
        return self.device_repo.update(device)

    def delete_device(self, current_user: User, device_id: uuid.UUID) -> None:
        device = self.get_device(current_user, device_id)
        self.device_repo.delete(device)
        logger.info("POS Device deleted: id=%s, business=%s", device_id, current_user.business_id)
