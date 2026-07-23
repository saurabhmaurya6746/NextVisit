import uuid

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class BusinessSettings(BaseModel):
    __tablename__ = "business_settings"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        unique=True,
        nullable=False,
    )

    # General
    currency: Mapped[str] = mapped_column(
        String(10),
        default="INR",
        nullable=False,
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        default="Asia/Kolkata",
        nullable=False,
    )
    language: Mapped[str] = mapped_column(
        String(10),
        default="en",
        nullable=False,
    )

    # Billing
    tax_percentage: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    service_charge: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    # Payment
    payment_qr_image: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    payment_upi_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    # Campaign
    default_discount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )
    review_link: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    booking_link: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Business Branding
    logo: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    cover_image: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    business = relationship(
        "Business",
        back_populates="settings",
    )
