from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.campaign import CampaignType


class MessageTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    campaign_type: CampaignType
    template_name: str
    message: str
    is_default: bool
    created_at: datetime
    updated_at: datetime


class MessageTemplateUpdate(BaseModel):
    template_name: str | None = Field(default=None, max_length=150)
    message: str | None = Field(default=None, max_length=2000)
    is_default: bool | None = None


class MessageTemplatePreviewRequest(BaseModel):
    template_id: UUID | None = None
    campaign_type: CampaignType | None = None
    message_override: str | None = Field(default=None, max_length=2000)
    customer_id: UUID | None = None
    discount: float | None = Field(default=None, ge=0)
    points: int | None = Field(default=None, ge=0)


class MessageTemplatePreviewResponse(BaseModel):
    preview_message: str
    placeholders_used: dict[str, str]
