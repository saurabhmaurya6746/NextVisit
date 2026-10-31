import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class DeviceType(str, enum.Enum):
    DESKTOP_WINDOWS = "DESKTOP_WINDOWS"
    ANDROID_TABLET = "ANDROID_TABLET"
    ANDROID_MOBILE = "ANDROID_MOBILE"


class ClientDevice(BaseModel):
    __tablename__ = "client_devices"
    __table_args__ = (
        UniqueConstraint("business_id", "device_prefix", name="uq_client_devices_biz_prefix"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    device_name: Mapped[str] = mapped_column(String(100), nullable=False)
    device_type: Mapped[str] = mapped_column(String(50), nullable=False, default="DESKTOP_WINDOWS")
    device_prefix: Mapped[str] = mapped_column(String(10), nullable=False)
    device_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    business = relationship("Business", back_populates="client_devices")
