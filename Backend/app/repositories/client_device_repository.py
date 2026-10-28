import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.client_device import ClientDevice


class ClientDeviceRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, device: ClientDevice) -> ClientDevice:
        self.db.add(device)
        self.db.commit()
        self.db.refresh(device)
        return device

    def get_by_id(self, device_id: uuid.UUID) -> ClientDevice | None:
        stmt = select(ClientDevice).where(ClientDevice.id == device_id)
        return self.db.scalar(stmt)

    def get_by_id_and_business(self, device_id: uuid.UUID, business_id: uuid.UUID) -> ClientDevice | None:
        stmt = select(ClientDevice).where(
            ClientDevice.id == device_id,
            ClientDevice.business_id == business_id,
        )
        return self.db.scalar(stmt)

    def get_by_prefix(self, business_id: uuid.UUID, prefix: str) -> ClientDevice | None:
        stmt = select(ClientDevice).where(
            ClientDevice.business_id == business_id,
            ClientDevice.device_prefix == prefix.strip().upper(),
        )
        return self.db.scalar(stmt)

    def list_by_business(self, business_id: uuid.UUID) -> list[ClientDevice]:
        stmt = (
            select(ClientDevice)
            .where(ClientDevice.business_id == business_id)
            .order_by(ClientDevice.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def update(self, device: ClientDevice) -> ClientDevice:
        self.db.commit()
        self.db.refresh(device)
        return device

    def delete(self, device: ClientDevice) -> None:
        self.db.delete(device)
        self.db.commit()
