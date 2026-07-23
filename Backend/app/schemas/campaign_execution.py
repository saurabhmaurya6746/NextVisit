from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.campaign import CampaignLogStatus, CampaignType


class CampaignLogItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    campaign_id: UUID
    campaign_name: str
    campaign_type: CampaignType
    customer_id: UUID
    customer_name: str
    customer_phone: str
    message: str
    status: CampaignLogStatus
    scheduled_for: datetime | None
    sent_at: datetime | None
    failure_reason: str | None
    created_at: datetime


class CampaignLogMarkFailedRequest(BaseModel):
    failure_reason: str | None = Field(default=None, max_length=1000)
