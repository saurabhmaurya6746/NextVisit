import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.campaign import CampaignType


class ScheduleType(str, enum.Enum):
    MANUAL = "MANUAL"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"


class AutomationRule(BaseModel):
    __tablename__ = "automation_rules"

    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "campaign_type",
            name="uq_business_campaign_type_automation",
        ),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
    )

    campaign_type: Mapped[CampaignType] = mapped_column(
        SQLEnum(CampaignType, native_enum=False),
        nullable=False,
    )

    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    schedule_type: Mapped[ScheduleType] = mapped_column(
        SQLEnum(ScheduleType, native_enum=False),
        default=ScheduleType.MANUAL,
        nullable=False,
    )

    run_time: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )

    last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    business = relationship(
        "Business",
        back_populates="automation_rules",
    )
