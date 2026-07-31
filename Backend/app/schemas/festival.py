from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field


class FestivalResponse(BaseModel):
    id: UUID
    festival_name: str
    festival_date: date
    festival_type: str = "cultural"
    country: str = "India"
    state: str | None = None
    is_active: bool = True

    class Config:
        from_attributes = True


class FestivalCampaignResponse(BaseModel):
    id: UUID
    festival_id: UUID
    festival_name: str
    festival_date: date
    days_remaining: int
    coupon_code: str | None = None
    language: str = "Hinglish"
    tone: str = "Festive"
    message: str | None = None
    ai_generated: bool = False
    last_generated: datetime | None = None
    last_sent: datetime | None = None
    enabled: bool = True
    eligible_customers: int = 0
    sent_count: int = 0
    pending_count: int = 0

    class Config:
        from_attributes = True


class UpcomingFestivalsResponse(BaseModel):
    next_festival: FestivalCampaignResponse | None = None
    this_month: list[FestivalCampaignResponse] = []
    next_30_days: list[FestivalCampaignResponse] = []
    next_90_days: list[FestivalCampaignResponse] = []
    total_campaigns: int = 0


class FestivalCampaignUpdate(BaseModel):
    festival_date: date | None = None
    coupon_code: str | None = None
    language: str | None = None
    tone: str | None = None
    message: str | None = None
    enabled: bool | None = None


class FestivalAiGenerateRequest(BaseModel):
    festival_id: UUID | None = None
    festival_name: str | None = "Festival"
    language: str = "Hinglish"
    tone: str = "Festive"
    coupon_code: str | None = None
    discount_percent: int | str | None = 20
    discount_desc: str | None = None


class FestivalSendRequest(BaseModel):
    customer_ids: list[UUID] = []
    message: str
