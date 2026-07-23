import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class LoyaltySettings(BaseModel):
    __tablename__ = "loyalty_settings"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        unique=True,
        nullable=False,
    )

    points_per_amount: Mapped[float] = mapped_column(
        Float,
        default=10.0,
        nullable=False,
    )

    amount_required: Mapped[float] = mapped_column(
        Float,
        default=100.0,
        nullable=False,
    )

    redeem_rate: Mapped[float] = mapped_column(
        Float,
        default=0.5,
        nullable=False,
    )

    minimum_redeem_points: Mapped[int] = mapped_column(
        Integer,
        default=100,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    business = relationship(
        "Business",
        back_populates="loyalty_settings",
    )


class CustomerLoyalty(BaseModel):
    __tablename__ = "customer_loyalty"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        unique=True,
        nullable=False,
    )

    current_points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    lifetime_points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    redeemed_points: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    customer = relationship(
        "Customer",
        back_populates="loyalty",
    )
