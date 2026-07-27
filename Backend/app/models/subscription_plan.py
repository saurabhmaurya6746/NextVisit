from typing import Any

from sqlalchemy import JSON, Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class SubscriptionPlan(BaseModel):
    __tablename__ = "subscription_plans"

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )

    monthly_price: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    trial_days: Mapped[int] = mapped_column(
        Integer,
        default=14,
        nullable=False,
    )

    max_customers: Mapped[int] = mapped_column(
        Integer,
        default=100,
        nullable=False,
    )

    max_staff: Mapped[int] = mapped_column(
        Integer,
        default=5,
        nullable=False,
    )

    max_campaigns_per_month: Mapped[int] = mapped_column(
        Integer,
        default=10,
        nullable=False,
    )

    storage_limit_gb: Mapped[float] = mapped_column(
        Float,
        default=1.0,
        nullable=False,
    )

    features: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    max_active_devices: Mapped[int] = mapped_column(
        Integer,
        default=5,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    @property
    def max_devices(self) -> int:
        """Property returning max_active_devices database value."""
        return self.max_active_devices
