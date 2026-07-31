from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerCreate(BaseModel):
    name: str = Field(..., max_length=150)
    phone: str = Field(..., max_length=20)
    email: EmailStr | None = None
    gender: str | None = Field(default=None, max_length=20)
    birth_date: date | None = None
    anniversary_date: date | None = None
    address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    gender: str | None = Field(default=None, max_length=20)
    birth_date: date | None = None
    anniversary_date: date | None = None
    address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    phone: str
    email: str | None
    gender: str | None
    birth_date: date | None
    anniversary_date: date | None
    address: str | None
    notes: str | None
    visit_count: int
    total_spent: float
    loyalty_points: int = 0
    first_visit_at: datetime | None
    last_visit_at: datetime | None
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Customer Segmentation Schemas
# ---------------------------------------------------------------------------

class SegmentCustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    last_visit_at: datetime | None
    visit_count: int
    total_spent: float


class CustomerSegmentsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    new_customers: list[SegmentCustomerResponse]
    inactive_15_days: list[SegmentCustomerResponse]
    inactive_30_days: list[SegmentCustomerResponse]
    inactive_60_days: list[SegmentCustomerResponse]
    inactive_90_days: list[SegmentCustomerResponse]
    birthday_today: list[SegmentCustomerResponse]
    anniversary_today: list[SegmentCustomerResponse]
    vip_customers: list[SegmentCustomerResponse]


# ---------------------------------------------------------------------------
# Customer CRM Comprehensive Schemas
# ---------------------------------------------------------------------------

class CustomerFavoriteItem(BaseModel):
    name: str
    count: int
    total_spent: float


class CustomerTimelineEvent(BaseModel):
    id: str
    type: str  # VISIT, ORDER, PAYMENT, LOYALTY, WHATSAPP, CAMPAIGN
    title: str
    description: str | None = None
    timestamp: datetime
    badge: str | None = None
    amount: float | None = None


class CustomerVisitItem(BaseModel):
    id: str
    visit_number: int
    date: datetime
    table_name: str
    dining_area_name: str
    source: str  # QR / STAFF
    status: str  # COMPLETED / ACTIVE / CANCELLED
    total_amount: float
    loyalty_earned: int
    payment_method: str | None = None


class CustomerOrderItemDetail(BaseModel):
    id: str
    name: str
    unit_price: float
    quantity: int
    subtotal: float
    notes: str | None = None


class CustomerOrderItem(BaseModel):
    id: str
    order_number: str
    status: str  # OPEN, PREPARING, READY, SERVED, CANCELLED
    source: str  # QR / STAFF
    table_name: str
    created_at: datetime
    completed_at: datetime | None = None
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    items: list[CustomerOrderItemDetail] = []


class CustomerLoyaltyLedgerItem(BaseModel):
    id: str
    date: datetime
    reason: str
    points: int
    type: str  # EARNED, REDEEMED, ADJUSTED
    balance_after: int


class CustomerWhatsAppLogItem(BaseModel):
    id: str
    campaign_name: str | None = None
    type: str
    message: str
    status: str  # DELIVERED, PENDING, FAILED
    sent_at: datetime


class CustomerCampaignItem(BaseModel):
    id: str
    name: str
    type: str
    status: str
    sent_at: datetime | None = None


class CustomerReviewItem(BaseModel):
    id: str
    rating: int
    comment: str
    date: datetime
    google_status: str


class CustomerCrmDetails(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    # Core profile
    profile: CustomerResponse

    # Top-level metrics
    total_visits: int
    total_orders: int
    total_spent: float
    avg_bill: float
    loyalty_points: int
    last_visit_at: datetime | None = None
    first_visit_at: datetime | None = None
    last_order_at: datetime | None = None
    customer_since: datetime
    total_qr_orders: int
    total_staff_orders: int

    # Customer Summary Preferences
    preferred_dining_area: str = "Main Hall"
    favorite_table: str = "Table 1"
    favorite_items: list[CustomerFavoriteItem] = []
    avg_visit_frequency_days: float | None = None
    customer_lifetime_value: float

    # Tab Data Lists
    timeline: list[CustomerTimelineEvent] = []
    visits: list[CustomerVisitItem] = []
    orders: list[CustomerOrderItem] = []
    loyalty_history: list[CustomerLoyaltyLedgerItem] = []
    loyalty_current_points: int = 0
    loyalty_lifetime_points: int = 0
    loyalty_redeemed_points: int = 0
    whatsapp_logs: list[CustomerWhatsAppLogItem] = []
    campaigns: list[CustomerCampaignItem] = []
    reviews: list[CustomerReviewItem] = []
    ai_insights: str = "AI insights will appear after sufficient customer activity."


# ---------------------------------------------------------------------------
# Welcome Campaign Schemas
# ---------------------------------------------------------------------------

class WelcomeCustomerItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    email: str | None = None
    first_visit_at: datetime | None = None
    last_visit_at: datetime | None = None
    visit_count: int
    total_spent: float
    loyalty_points: int = 0
    source: str = "Staff"
    customer_type: str = "New"
    welcome_status: str = "Pending"
    created_at: datetime


class WelcomeSummaryCards(BaseModel):
    todays_new: int
    this_week: int
    this_month: int
    returning: int
    birthdays_today: int
    recovery_due: int


class WelcomeMetrics(BaseModel):
    first_visit_count: int
    returning_pct: float
    avg_first_order_value: float
    avg_lifetime_value: float
    avg_visits: float


class PaginatedWelcomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    summary_cards: WelcomeSummaryCards
    metrics: WelcomeMetrics
    items: list[WelcomeCustomerItem]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


# ---------------------------------------------------------------------------
# VIP Campaign Schemas
# ---------------------------------------------------------------------------

class VipCustomerItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    email: str | None = None
    visit_count: int
    total_spent: float
    loyalty_points: int = 0
    favorite_item: str = "No favorite yet"
    last_visit_at: datetime | None = None
    first_visit_at: datetime | None = None
    created_at: datetime
    segment: str = "VIP"


class VipSummaryCards(BaseModel):
    total_vip: int
    total_lifetime_spend: float
    avg_visits: float
    avg_lifetime_spend: float
    total_loyalty_points: int


class PaginatedVipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    summary: VipSummaryCards
    items: list[VipCustomerItem]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool
