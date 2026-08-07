import uuid
from datetime import datetime, date
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Festival(BaseModel):
    __tablename__ = "festivals"

    business_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=True,
    )

    festival_name: Mapped[str] = mapped_column(String(150), nullable=False)
    festival_date: Mapped[date] = mapped_column(Date, nullable=False)
    festival_type: Mapped[str] = mapped_column(String(50), default="cultural", nullable=False)
    country: Mapped[str] = mapped_column(String(100), default="India", nullable=False)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    business = relationship("Business")
    campaigns = relationship("FestivalCampaign", back_populates="festival", cascade="all, delete-orphan")


class FestivalCampaign(BaseModel):
    __tablename__ = "festival_campaigns"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
    )

    festival_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("festivals.id"),
        nullable=False,
    )

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_percent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    coupon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    coupon_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    language: Mapped[str] = mapped_column(String(30), default="Hinglish", nullable=False)
    tone: Mapped[str] = mapped_column(String(40), default="Festive", nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_generated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sent: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)

    business = relationship("Business")
    festival = relationship("Festival", back_populates="campaigns")
