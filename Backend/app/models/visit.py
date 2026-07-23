import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class VisitStatus(str, enum.Enum):
    OPEN = "OPEN"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    ONLINE = "ONLINE"


class Visit(BaseModel):
    __tablename__ = "visits"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=False,
    )

    staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    status: Mapped[VisitStatus] = mapped_column(
        SQLEnum(VisitStatus, native_enum=False),
        default=VisitStatus.OPEN,
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        SQLEnum(PaymentMethod, native_enum=False),
        nullable=True,
    )

    payment_status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus, native_enum=False),
        default=PaymentStatus.PENDING,
        nullable=False,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    business = relationship(
        "Business",
        back_populates="visits",
    )

    customer = relationship(
        "Customer",
        back_populates="visits",
    )

    staff = relationship(
        "User",
        back_populates="visits",
    )

    services = relationship(
        "VisitService",
        back_populates="visit",
        cascade="all, delete-orphan",
    )


class VisitService(BaseModel):
    __tablename__ = "visit_services"

    visit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visits.id"),
        nullable=False,
    )

    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id"),
        nullable=False,
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    unit_price: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    total_price: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    visit = relationship(
        "Visit",
        back_populates="services",
    )

    service = relationship("Service")
