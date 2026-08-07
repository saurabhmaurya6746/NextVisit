import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class AiCreditAuditLog(BaseModel):
    __tablename__ = "ai_credit_audit_logs"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
    )

    admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admins.id"),
        nullable=True,
    )

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # "ADD_PURCHASED", "REMOVE_PURCHASED", "RESET_MONTHLY"

    amount: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    reason: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )  # "Manual Purchase", "Compensation", "Promotion", "Testing", "Other"

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    previous_balance: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    new_balance: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    business = relationship("Business")
    admin = relationship("Admin")
