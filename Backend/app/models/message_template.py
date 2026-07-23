import uuid

from sqlalchemy import (
    Boolean,
    Enum as SQLEnum,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.campaign import CampaignType


class MessageTemplate(BaseModel):
    __tablename__ = "message_templates"

    __table_args__ = (
        UniqueConstraint(
            "business_id",
            "campaign_type",
            name="uq_business_campaign_type_template",
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

    template_name: Mapped[str] = mapped_column(String(150), nullable=False)

    message: Mapped[str] = mapped_column(String(2000), nullable=False)

    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    business = relationship(
        "Business",
        back_populates="message_templates",
    )
