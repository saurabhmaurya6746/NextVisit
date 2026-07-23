import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

class Business(BaseModel):
    __tablename__ = "businesses"

    business_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("business_types.id"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(150))
    owner_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(150), unique=True)
    phone: Mapped[str] = mapped_column(String(20))

    country: Mapped[str] = mapped_column(String(100))
    currency: Mapped[str] = mapped_column(String(20))
    timezone: Mapped[str] = mapped_column(String(100))

    address: Mapped[str] = mapped_column(String(500))

    logo_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    trial_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    trial_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    subscription_status: Mapped[str] = mapped_column(
        String(30),
        default="trial",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )
    
    business_type = relationship("BusinessType")
    users = relationship(
        "User",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    customers = relationship(
        "Customer",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    services = relationship(
        "Service",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    visits = relationship(
        "Visit",
        back_populates="business",
        cascade="all, delete-orphan",
    )