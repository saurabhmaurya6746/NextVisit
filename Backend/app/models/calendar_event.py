import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class CalendarEvent(BaseModel):
    __tablename__ = "calendar_events"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Event types: NOTE, REMINDER, APPOINTMENT, TASK, EVENT, STAFF
    event_type: Mapped[str] = mapped_column(String(50), default="EVENT", nullable=False, index=True)

    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Reminder timing in minutes before start_at (e.g. 15, 30, 60, 1440)
    reminder_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Recurrence rule: NONE, DAILY, WEEKLY, MONTHLY, YEARLY
    recurrence_rule: Mapped[str | None] = mapped_column(String(50), default="NONE", nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    business = relationship("Business", foreign_keys=[business_id])
    customer = relationship("Customer", foreign_keys=[customer_id])
    staff = relationship("User", foreign_keys=[staff_id])
    creator = relationship("User", foreign_keys=[created_by])
