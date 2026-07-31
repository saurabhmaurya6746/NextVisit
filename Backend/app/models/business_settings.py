import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
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

    # General & Location
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    opening_time: Mapped[str | None] = mapped_column(String(20), nullable=True, default="09:00 AM")
    closing_time: Mapped[str | None] = mapped_column(String(20), nullable=True, default="10:00 PM")

    # Features Toggle
    enable_qr_ordering: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_staff_ordering: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_parcel: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_takeaway: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Invoice & Tax Settings
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV-", nullable=False)

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

    # Customer Recovery Settings
    recovery_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    # Comma-separated bucket days e.g. "15,30,45,60,90"
    recovery_buckets: Mapped[str] = mapped_column(
        String(50),
        default="15,30,45,60,90",
        nullable=False,
    )
    # Don't re-message a customer within this many days
    recovery_cooldown_days: Mapped[int] = mapped_column(
        Integer,
        default=7,
        nullable=False,
    )
    # Max messages sent per day per business
    recovery_max_messages_per_day: Mapped[int] = mapped_column(
        Integer,
        default=100,
        nullable=False,
    )
    # Days after campaign send to count a re-visit as "recovered"
    recovery_window_days: Mapped[int] = mapped_column(
        Integer,
        default=30,
        nullable=False,
    )

    # Review Booster Settings
    review_booster_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    review_booster_cooldown_days: Mapped[int] = mapped_column(
        Integer,
        default=7,
        nullable=False,
    )
    review_booster_auto_send: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    review_booster_ai_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    business = relationship(
        "Business",
        back_populates="settings",
    )
