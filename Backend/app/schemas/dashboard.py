from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class TaskCounts(BaseModel):
    todays_birthdays: int
    todays_anniversaries: int
    pending_reviews: int
    recovery_customers: int
    expiring_coupons: int


class WeeklySalesDay(BaseModel):
    day: str
    sales: float


class WeeklyBookingsDay(BaseModel):
    day: str
    bookings: int


class RepeatCustomerMonth(BaseModel):
    month: str
    rate: float


class TopItem(BaseModel):
    name: str
    quantity: int
    revenue: float


class CategoryRevenue(BaseModel):
    category: str
    orders: int
    revenue: float


class RevenueBreakdown(BaseModel):
    qr_orders_revenue: float
    staff_orders_revenue: float
    walkin_revenue: float
    online_revenue: float


class PaymentBreakdown(BaseModel):
    cash: float
    upi: float
    card: float
    wallet: float
    other: float


class TimeRangeMetrics(BaseModel):
    today: int
    this_week: int
    this_month: int


class ActivityEvent(BaseModel):
    id: str
    type: str
    title: str
    description: str
    timestamp: str


class CalculatedInsight(BaseModel):
    id: str
    title: str
    detail: str
    type: str


class CampaignSuggestion(BaseModel):
    title: str
    detail: str
    count: int
    path: str


class ReviewSuggestion(BaseModel):
    customer_id: str
    customer_name: str
    phone: str
    visit_date: str


class RevenueComparison(BaseModel):
    today_vs_yesterday_pct: float
    week_vs_last_week_pct: float
    month_vs_last_month_pct: float


class GrowthMetrics(BaseModel):
    customer_growth_pct: float
    revenue_growth_pct: float
    visit_growth_pct: float
    order_growth_pct: float


# Legacy support sub-models
class TopServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    service_id: UUID | None = None
    service_name: str
    visit_count: int
    revenue: float


class RecentVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    visit_id: UUID | None = None
    customer_name: str
    total_amount: float
    payment_status: str
    status: str
    completed_at: datetime | str | None = None


class DashboardAnalyticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    today_orders: int
    today_visits: int
    today_revenue: float
    total_customers: int
    active_customers: int
    total_staff: int
    total_services: int
    total_visits: int
    open_visits: int
    completed_visits: int
    total_revenue: float
    monthly_visits: int
    monthly_revenue: float
    average_bill: float
    avg_daily_revenue: float
    most_busy_hour: str
    most_busy_day: str

    tasks: TaskCounts
    weekly_sales: list[WeeklySalesDay]
    weekly_bookings: list[WeeklyBookingsDay]
    repeat_customer_trend: list[RepeatCustomerMonth]
    top_selling_items: list[TopItem]
    top_categories: list[CategoryRevenue]
    revenue_breakdown: RevenueBreakdown
    payment_breakdown: PaymentBreakdown
    new_customers: TimeRangeMetrics
    returning_customers: TimeRangeMetrics
    recent_activity: list[ActivityEvent]
    calculated_insights: list[CalculatedInsight]
    campaign_suggestions: list[CampaignSuggestion]
    review_suggestions: list[ReviewSuggestion]
    revenue_comparison: RevenueComparison
    growth_metrics: GrowthMetrics

    top_services: list[TopServiceResponse]
    recent_visits: list[RecentVisitResponse]


# For backward compatibility
DashboardResponse = DashboardAnalyticsResponse
