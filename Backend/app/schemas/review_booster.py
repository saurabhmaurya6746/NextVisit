"""
Review Booster Schemas
-----------------------
Schemas for Review Booster dashboard, customer list, send campaigns,
preview, AI generator, tracking, history, analytics, and settings.
Reuses existing BaseModel, ConfigDict, and Pydantic validators.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class ReviewBoosterDashboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pending: int
    requested: int
    reviewed: int
    clicked: int
    eligible_today: int
    eligible_yesterday: int
    last_7_days: int
    last_month: int


# ---------------------------------------------------------------------------
# Customer List
# ---------------------------------------------------------------------------

class ReviewBoosterCustomerItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: UUID
    customer_name: str
    phone: str
    last_visit_at: datetime | None = None
    bill_amount: float
    visit_count: int
    lifetime_spend: float
    status: str  # "eligible" | "pending" | "requested" | "clicked" | "reviewed"
    last_review_request: datetime | None = None
    clicked: bool = False
    clicked_at: datetime | None = None
    reviewed: bool = False
    reviewed_at: datetime | None = None


class PaginatedReviewBoosterCustomersResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[ReviewBoosterCustomerItem]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


# ---------------------------------------------------------------------------
# Send & Preview
# ---------------------------------------------------------------------------

class ReviewBoosterSendRequest(BaseModel):
    customer_ids: list[UUID] = Field(..., min_items=1)
    template_id: UUID | None = None
    message: str | None = Field(default=None, max_length=2000)
    schedule_at: datetime | None = None


class ReviewBoosterSendResponse(BaseModel):
    campaign_id: UUID
    recipients_count: int
    message: str


class ReviewBoosterPreviewRequest(BaseModel):
    template_id: UUID | None = None
    message: str | None = None
    customer_id: UUID | None = None


class ReviewBoosterPreviewResponse(BaseModel):
    personalized_message: str
    review_link: str
    customer_name: str
    business_name: str


# ---------------------------------------------------------------------------
# AI Generate
# ---------------------------------------------------------------------------

class ReviewBoosterAiGenerateRequest(BaseModel):
    tone: str | None = Field(default="Friendly")
    language: str | None = Field(default="auto")
    message_length: str | None = Field(default="medium")
    custom_prompt: str | None = None


class ReviewBoosterAiGenerateResponse(BaseModel):
    message: str
    tone: str
    review_link: str


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

class ReviewBoosterHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: UUID
    campaign_id: UUID
    campaign_name: str
    customer_id: UUID
    customer_name: str
    phone: str
    visit_date: datetime | None = None
    sent_at: datetime | None = None
    clicked_at: datetime | None = None
    reviewed_at: datetime | None = None
    status: str


class ReviewBoosterHistoryResponse(BaseModel):
    items: list[ReviewBoosterHistoryItem]
    total: int


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class ReviewBoosterAnalyticsResponse(BaseModel):
    eligible: int
    pending: int
    requested: int
    clicked: int
    reviewed: int
    click_rate_pct: float
    review_rate_pct: float
    average_review_delay_hours: float


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class ReviewBoosterSettingsUpdate(BaseModel):
    enable_review_booster: bool = True
    review_cooldown_days: int = Field(default=7, ge=1, le=90)
    google_review_url: str | None = Field(default=None, max_length=500)
    auto_send: bool = False
    ai_enabled: bool = True


class ReviewBoosterSettingsResponse(ReviewBoosterSettingsUpdate):
    pass
