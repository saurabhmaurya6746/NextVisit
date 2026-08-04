import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class BusinessStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"

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

    subscription_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subscription_plans.id"),
        nullable=True,
    )

    plan_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    subscription_notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default=BusinessStatus.PENDING.value,
        nullable=False,
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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
    subscription_plan = relationship("SubscriptionPlan")
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
    loyalty_settings = relationship(
        "LoyaltySettings",
        back_populates="business",
        uselist=False,
        cascade="all, delete-orphan",
    )
    campaigns = relationship(
        "Campaign",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    automation_rules = relationship(
        "AutomationRule",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    message_templates = relationship(
        "MessageTemplate",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    settings = relationship(
        "BusinessSettings",
        back_populates="business",
        uselist=False,
        cascade="all, delete-orphan",
    )
    dining_areas = relationship(
        "DiningArea",
        back_populates="business",
        cascade="all, delete-orphan",
        order_by="DiningArea.display_order",
    )
    menu_categories = relationship(
        "MenuCategory",
        back_populates="business",
        cascade="all, delete-orphan",
        order_by="MenuCategory.display_order",
    )
    menu_items = relationship(
        "MenuItem",
        back_populates="business",
        cascade="all, delete-orphan",
        order_by="MenuItem.display_order",
    )
    salon_service_areas = relationship(
        "SalonServiceArea",
        back_populates="business",
        cascade="all, delete-orphan",
        order_by="SalonServiceArea.display_order",
    )