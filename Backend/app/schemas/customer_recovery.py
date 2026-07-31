"""
Customer Recovery Schemas
-------------------------
Analytics + Campaign generation module for recovering dormant customers.
Reuses Campaign, CampaignLog, Customer, and Visit models from existing codebase.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Dashboard — Bucket counts
# ---------------------------------------------------------------------------

class RecoveryBucketCount(BaseModel):
    count: int


class RecoveryDashboardResponse(BaseModel):
    days_15: RecoveryBucketCount = Field(alias="15_days")
    days_30: RecoveryBucketCount = Field(alias="30_days")
    days_45: RecoveryBucketCount = Field(alias="45_days")
    days_60: RecoveryBucketCount = Field(alias="60_days")
    days_90: RecoveryBucketCount = Field(alias="90_days")
    total_recoverable: int

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Customer List
# ---------------------------------------------------------------------------

class RecoverableCustomerItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    email: str | None = None
    last_visit_at: datetime | None = None
    days_since_last_visit: int
    total_spent: float
    visit_count: int
    loyalty_points: int = 0
    favorite_item: str = "No favorite yet"
    is_vip: bool = False
    recovery_stage: str  # "15_days" | "30_days" | "45_days" | "60_days" | "90_days"


class PaginatedRecoverableCustomersResponse(BaseModel):
    items: list[RecoverableCustomerItem]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class RecoveryAnalyticsResponse(BaseModel):
    potential_revenue: float
    average_spend: float
    recoverable_customers: int
    recovery_rate_pct: float
    total_campaigns_sent: int
    total_recovered: int
    messages_sent: int
    messages_failed: int


# ---------------------------------------------------------------------------
# Campaign Launch
# ---------------------------------------------------------------------------

class RecoveryLaunchRequest(BaseModel):
    bucket: int = Field(..., description="Recovery bucket in days: 15, 30, 45, 60, or 90")
    message: str = Field(..., min_length=10, max_length=2000, description="WhatsApp message template")
    coupon_code: str | None = Field(default=None, max_length=50)
    schedule_at: datetime | None = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "bucket": 30,
                "message": "Hi {name}! We miss you at {restaurant}. Here's 15% off: MISSYOU15",
                "coupon_code": "MISSYOU15",
                "schedule_at": None,
            }
        }
    )


class RecoveryLaunchResponse(BaseModel):
    campaign_id: UUID
    campaign_name: str
    recipients_count: int
    bucket_days: int
    message: str


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------

class RecoveryPreviewResponse(BaseModel):
    recipients: int
    estimated_revenue: float
    estimated_message_count: int
    coupon_code: str | None = None
    bucket_days: int
    average_spend: float


# ---------------------------------------------------------------------------
# Suggested Offers
# ---------------------------------------------------------------------------

class SuggestedOfferItem(BaseModel):
    title: str
    type: str  # "percentage" | "free_item" | "bogo" | "flat"
    value: str | None = None


class SuggestedOffersResponse(BaseModel):
    offers: list[SuggestedOfferItem]


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

class RecoveryHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    campaign_id: UUID
    campaign_name: str
    bucket_days: int
    launched_at: datetime
    total_recipients: int
    sent: int
    failed: int
    recovered: int
    revenue_generated: float


class RecoveryHistoryResponse(BaseModel):
    items: list[RecoveryHistoryItem]
    total: int


# ---------------------------------------------------------------------------
# Recovery Settings
# ---------------------------------------------------------------------------

class RecoverySettingsUpdate(BaseModel):
    recovery_enabled: bool = True
    recovery_buckets: list[int] = Field(default=[15, 30, 45, 60, 90])
    recovery_cooldown_days: int = Field(default=7, ge=1, le=90)
    recovery_max_messages_per_day: int = Field(default=100, ge=1, le=10000)
    recovery_window_days: int = Field(default=30, ge=1, le=365)


class RecoverySettingsResponse(RecoverySettingsUpdate):
    pass


# ---------------------------------------------------------------------------
# AI Generate
# ---------------------------------------------------------------------------

class RecoveryAiGenerateRequest(BaseModel):
    bucket: int = Field(default=30)
    restaurant_name: str | None = None
    offer_type: str | None = None
    tone: str | None = "Friendly"
    language: str | None = "auto"


class RecoveryAiGenerateResponse(BaseModel):
    title: str
    message: str
    cta: str

