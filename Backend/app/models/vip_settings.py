from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class VipSettings(BaseModel):
    __tablename__ = "vip_settings"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    min_lifetime_spend: Mapped[float] = mapped_column(
        Float,
        default=10000.0,
        nullable=False,
    )

    min_visits: Mapped[int] = mapped_column(
        Integer,
        default=15,
        nullable=False,
    )

    min_avg_bill: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    last_visit_within_days: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )

    rule_logic: Mapped[str] = mapped_column(
        String(10),
        default="ANY",  # "ANY" (OR) or "ALL" (AND)
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    business = relationship("Business", back_populates="vip_settings")
