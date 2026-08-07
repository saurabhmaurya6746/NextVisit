import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Customer(BaseModel):
    __tablename__ = "customers"

    __table_args__ = (
        UniqueConstraint("business_id", "phone", name="uq_business_customer_phone"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)

    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    anniversary_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    visit_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    total_spent: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False,
    )

    first_visit_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_visit_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    business = relationship(
        "Business",
        back_populates="customers",
    )
    visits = relationship(
        "Visit",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    loyalty = relationship(
        "CustomerLoyalty",
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def loyalty_points(self) -> int:
        if hasattr(self, "loyalty") and self.loyalty is not None:
            return self.loyalty.current_points
        return int((self.total_spent or 0.0) // 10)

    @property
    def status(self) -> str:
        v = self.visit_count or 0
        s = self.total_spent or 0.0
        # Check attached business.vip_settings if available
        if hasattr(self, "business") and self.business is not None and getattr(self.business, "vip_settings", None) is not None:
            v_set = self.business.vip_settings
            conds = []
            if v_set.min_lifetime_spend > 0:
                conds.append(s >= v_set.min_lifetime_spend)
            if v_set.min_visits > 0:
                conds.append(v >= v_set.min_visits)
            if conds:
                is_v = any(conds) if str(v_set.rule_logic).upper() == "ANY" else all(conds)
                if is_v:
                    return "VIP"
        # Default fallback
        if v > 1:
            return "Returning"
        return "New"
