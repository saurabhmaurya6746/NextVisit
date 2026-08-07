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


class CampaignLogRecordSendRequest(BaseModel):
    customer_id: UUID
    campaign_type: str = Field(default="WELCOME", description="WELCOME, BIRTHDAY, ANNIVERSARY, FESTIVAL, VIP, RECOVERY, REVIEW, COUPON, CUSTOM")
    campaign_id: UUID | None = None
    message: str | None = None
    coupon_code: str | None = None


class CampaignLogRecordSendResponse(BaseModel):
    success: bool
    log_id: UUID
    customer_id: UUID
    status: str
    sent_at: str
    sent_by: str
    message_type: str


class CampaignLogHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    customer_name: str
    customer_phone: str
    customer_email: str | None = None
    business_id: UUID
    business_name: str
    business_type: str
    campaign_id: UUID | None = None
    campaign_name: str
    campaign_type: str
    message: str
    message_preview: str
    coupon_code: str | None = None
    status: str
    sent_by: str
    sent_by_role: str | None = None
    created_at: datetime
    sent_at: datetime | None = None


class PaginatedCampaignLogHistoryResponse(BaseModel):
    items: list[CampaignLogHistoryItem]
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_previous: bool
