import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class CouponType(str, enum.Enum):
    PERCENTAGE = "PERCENTAGE"
    FLAT = "FLAT"
    FREE_ITEM = "FREE_ITEM"
    BOGO = "BOGO"


class CouponStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    EXPIRED = "EXPIRED"
    UPCOMING = "UPCOMING"
    DELETED = "DELETED"


class Coupon(BaseModel):
    __tablename__ = "coupons"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )

    code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    coupon_type: Mapped[CouponType] = mapped_column(
        SQLEnum(CouponType, native_enum=False),
        default=CouponType.PERCENTAGE,
        nullable=False,
    )

    reward_value: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    reward_description: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    max_discount_amount: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    min_order_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    max_usage: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    per_customer_limit: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    redeemed_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    applicable_segment: Mapped[str] = mapped_column(
        String(50),
        default="ALL",
        nullable=False,
    )

    status: Mapped[CouponStatus] = mapped_column(
        SQLEnum(CouponStatus, native_enum=False),
        default=CouponStatus.ACTIVE,
        nullable=False,
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    business = relationship("Business", foreign_keys=[business_id])
    creator = relationship("User", foreign_keys=[created_by])
    redemptions = relationship("CouponRedemption", back_populates="coupon", cascade="all, delete-orphan")


class CouponRedemption(BaseModel):
    __tablename__ = "coupon_redemptions"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )

    coupon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("coupons.id"),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=False,
        index=True,
    )

    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=True,
    )

    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visits.id"),
        nullable=True,
    )

    discount_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    redeemed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    coupon = relationship("Coupon", back_populates="redemptions")
    customer = relationship("Customer", back_populates="coupon_redemptions")
    order = relationship("Order")
