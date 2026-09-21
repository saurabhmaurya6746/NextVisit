from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
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

    # 1. General Settings
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gst_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    opening_time: Mapped[str | None] = mapped_column(String(20), nullable=True, default="09:00 AM")
    closing_time: Mapped[str | None] = mapped_column(String(20), nullable=True, default="10:00 PM")
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 2. WhatsApp Settings
    whatsapp_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    default_country_code: Mapped[str] = mapped_column(String(10), default="+91", nullable=False)
    default_message_signature: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enable_whatsapp_campaigns: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_welcome_messages: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 3. Google Settings
    review_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    maps_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    booking_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 4. Invoice Settings
    invoice_prefix: Mapped[str] = mapped_column(String(20), default="INV-", nullable=False)
    invoice_footer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    show_gst_on_invoice: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_qr_on_invoice: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_print_invoice: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    receipt_paper_size: Mapped[str] = mapped_column(String(20), default="80mm", server_default="80mm", nullable=False)

    # 5. Tax & Currency Settings
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata", nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    enable_gst: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tax_percentage: Mapped[float] = mapped_column(Float, default=18.0, nullable=False)
    price_includes_gst: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    service_charge: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    round_off_bill: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    next_order_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # 6. Notification Settings
    notify_orders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_qr_orders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_campaigns: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_reviews: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 7. AI Settings
    ai_default_tone: Mapped[str] = mapped_column(String(50), default="Friendly", nullable=False)
    ai_max_monthly_requests: Mapped[int] = mapped_column(Integer, default=500, nullable=False)
    ai_requests_used_month: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ai_monthly_used_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    purchased_ai_credits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ai_usage_period: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_ai_activity_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 8. POS Settings
    enable_qr_ordering: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_staff_ordering: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_parcel: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_takeaway: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enable_dine_in: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pos_auto_complete_order: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pos_auto_free_table: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pos_default_payment_method: Mapped[str] = mapped_column(String(20), default="CASH", nullable=False)
    allow_guest_checkout: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    # Payment QR & Branding
    payment_qr_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payment_upi_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payment_payee_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    logo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    default_discount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Recovery & Review Booster
    recovery_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    recovery_buckets: Mapped[str] = mapped_column(String(50), default="15,30,45,60,90", nullable=False)
    recovery_cooldown_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    recovery_max_messages_per_day: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    recovery_window_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    review_booster_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    review_booster_cooldown_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    review_booster_auto_send: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    review_booster_ai_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    business = relationship("Business", back_populates="settings")
