import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class CampaignType(str, enum.Enum):
    BIRTHDAY = "BIRTHDAY"
    ANNIVERSARY = "ANNIVERSARY"
    WELCOME = "WELCOME"
    RECOVERY = "RECOVERY"
    FESTIVAL = "FESTIVAL"
    VIP = "VIP"
    CUSTOM = "CUSTOM"


class TargetSegment(str, enum.Enum):
    NEW_CUSTOMERS = "NEW_CUSTOMERS"
    INACTIVE_15 = "INACTIVE_15"
    INACTIVE_30 = "INACTIVE_30"
    INACTIVE_60 = "INACTIVE_60"
    INACTIVE_90 = "INACTIVE_90"
    BIRTHDAY_TODAY = "BIRTHDAY_TODAY"
    ANNIVERSARY_TODAY = "ANNIVERSARY_TODAY"
    VIP_CUSTOMERS = "VIP_CUSTOMERS"
    ALL_CUSTOMERS = "ALL_CUSTOMERS"


class CampaignLogStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class Campaign(BaseModel):
    __tablename__ = "campaigns"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    campaign_type: Mapped[CampaignType] = mapped_column(
        SQLEnum(CampaignType, native_enum=False),
        nullable=False,
    )

    target_segment: Mapped[TargetSegment] = mapped_column(
        SQLEnum(TargetSegment, native_enum=False),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(2000), nullable=False)

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    business = relationship(
        "Business",
        back_populates="campaigns",
    )

    logs = relationship(
        "CampaignLog",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )


class CampaignLog(BaseModel):
    __tablename__ = "campaign_logs"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=False,
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=False,
    )

    status: Mapped[CampaignLogStatus] = mapped_column(
        SQLEnum(CampaignLogStatus, native_enum=False),
        default=CampaignLogStatus.PENDING,
        nullable=False,
    )

    scheduled_for: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    failure_reason: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    campaign = relationship(
        "Campaign",
        back_populates="logs",
    )

    customer = relationship("Customer")
