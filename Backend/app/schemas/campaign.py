from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.campaign import CampaignLogStatus, CampaignType, TargetSegment


class CampaignCreate(BaseModel):
    name: str = Field(..., max_length=150)
    campaign_type: CampaignType
    target_segment: TargetSegment
    title: str = Field(..., max_length=200)
    message: str = Field(..., max_length=2000)
    is_active: bool = True


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    campaign_type: CampaignType | None = None
    target_segment: TargetSegment | None = None
    title: str | None = Field(default=None, max_length=200)
    message: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    campaign_type: CampaignType
    target_segment: TargetSegment
    title: str
    message: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CampaignLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    campaign_id: UUID
    customer_id: UUID
    status: CampaignLogStatus
    scheduled_for: datetime | None
    sent_at: datetime | None
    failure_reason: str | None
    created_at: datetime


class CampaignGenerateAudienceResponse(BaseModel):
    campaign_id: UUID
    customers_found: int
    logs_created: int
