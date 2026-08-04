from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Query Filter Parameters Schema
# ---------------------------------------------------------------------------

class ReportFilterParams(BaseModel):
    date_range: str = Field(default="this_month", description="today | yesterday | last_7_days | last_30_days | this_month | last_month | custom")
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    payment_method: Optional[str] = "all"  # CASH | UPI | CARD | ONLINE | all
    booking_source: Optional[str] = "all"  # walk_in | online | staff | POS | QR | all
    staff_id: Optional[str] = None
    service_area_id: Optional[str] = None
    chair_id: Optional[str] = None
    customer_type: Optional[str] = "all"  # all | vip | regular | new | returning
    membership: Optional[str] = "all"     # all | has_membership | none
    campaign_type: Optional[str] = "all"  # all | WELCOME | BIRTHDAY | ANNIVERSARY | FESTIVAL | VIP | RECOVERY
    status: Optional[str] = "all"         # all | COMPLETED | OPEN | CANCELLED


# ---------------------------------------------------------------------------
# Filter Options for Dropdowns
# ---------------------------------------------------------------------------

class FilterOptionItem(BaseModel):
    id: str
    name: str


class ReportFilterOptionsResponse(BaseModel):
    staff: list[FilterOptionItem] = []
    service_areas: list[FilterOptionItem] = []
    chairs: list[FilterOptionItem] = []


# ---------------------------------------------------------------------------
# KPI Metrics
# ---------------------------------------------------------------------------

class ReportsKpiSummary(BaseModel):
    total_revenue: float = 0.0
    net_revenue: float = 0.0
    total_appointments_or_orders: int = 0
    completed_visits: int = 0
    cancelled_visits: int = 0
    average_order_or_service_value: float = 0.0
    average_daily_revenue: float = 0.0
    total_customers: int = 0
    new_customers: int = 0
    returning_customers: int = 0
    repeat_rate_pct: float = 0.0
    total_loyalty_points_earned: int = 0
    coupons_redeemed: int = 0
    campaign_revenue: float = 0.0
    gst_collected: float = 0.0
    discount_given: float = 0.0


# ---------------------------------------------------------------------------
# Chart Data Models
# ---------------------------------------------------------------------------

class TimeSeriesPoint(BaseModel):
    label: str
    revenue: float = 0.0
    net_revenue: float = 0.0
    count: int = 0
    completed: int = 0
    cancelled: int = 0


class CustomerGrowthPoint(BaseModel):
    label: str
    new_customers: int = 0
    returning_customers: int = 0


class BreakdownPieItem(BaseModel):
    name: str
    value: float = 0.0
    count: int = 0


class CategoryBreakdownItem(BaseModel):
    name: str
    revenue: float = 0.0
    quantity: int = 0


# ---------------------------------------------------------------------------
# Salon Specific Reports
# ---------------------------------------------------------------------------

class StaffPerformanceItem(BaseModel):
    staff_id: str
    name: str
    designation: Optional[str] = None
    appointments_completed: int = 0
    revenue_generated: float = 0.0
    average_rating: float = 4.8
    average_ticket_size: float = 0.0
    working_hours: float = 0.0
    commission_earned: float = 0.0
    rank: str = "Regular"  # Top Performer | High | Regular | Needs Attention


class ServicePerformanceItem(BaseModel):
    service_id: str
    service_name: str
    category_name: str
    booked_count: int = 0
    total_revenue: float = 0.0
    avg_duration_minutes: int = 0
    is_top: bool = False
    is_lowest: bool = False


class WorkstationUtilizationItem(BaseModel):
    chair_id: str
    chair_name: str
    service_area_name: str
    usage_pct: float = 0.0
    appointments_count: int = 0


class CustomerDemographics(BaseModel):
    male_count: int = 0
    female_count: int = 0
    other_count: int = 0
    birthday_customers_in_period: int = 0
    anniversary_customers_in_period: int = 0
    vip_count: int = 0
    regular_count: int = 0


class SalonSpecificReports(BaseModel):
    staff_performance: list[StaffPerformanceItem] = []
    service_performance: list[ServicePerformanceItem] = []
    workstation_utilization: list[WorkstationUtilizationItem] = []
    customer_demographics: CustomerDemographics = CustomerDemographics()


# ---------------------------------------------------------------------------
# Restaurant Specific Reports
# ---------------------------------------------------------------------------

class TableUtilizationItem(BaseModel):
    table_id: str
    table_name: str
    dining_area_name: str
    orders_count: int = 0
    total_revenue: float = 0.0
    avg_dining_minutes: int = 45


class MenuItemSalesItem(BaseModel):
    menu_item_id: str
    item_name: str
    category_name: str
    quantity_sold: int = 0
    total_revenue: float = 0.0
    is_top: bool = False
    is_lowest: bool = False


class OrderTypeBreakdownItem(BaseModel):
    order_type: str  # Dine-in | QR Order | POS Order | Takeaway | Delivery
    count: int = 0
    revenue: float = 0.0


class RestaurantSpecificReports(BaseModel):
    table_utilization: list[TableUtilizationItem] = []
    menu_item_sales: list[MenuItemSalesItem] = []
    order_type_breakdown: list[OrderTypeBreakdownItem] = []


# ---------------------------------------------------------------------------
# Shared Reports Models
# ---------------------------------------------------------------------------

class TopCustomerReportItem(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    visits: int = 0
    lifetime_spend: float = 0.0
    average_spend: float = 0.0
    last_visit: Optional[str] = None
    membership: Optional[str] = "Regular"
    loyalty_points: int = 0
    total_coupons_used: int = 0


class CampaignReportItem(BaseModel):
    campaign_type: str
    name: str
    messages_sent: int = 0
    delivered: int = 0
    failed: int = 0
    read: int = 0
    clicked: int = 0
    coupons_used: int = 0
    revenue_generated: float = 0.0
    conversion_rate_pct: float = 0.0


class LoyaltyReportSummary(BaseModel):
    points_earned: int = 0
    points_redeemed: int = 0
    points_expired: int = 0
    top_loyalty_customers: list[TopCustomerReportItem] = []


# ---------------------------------------------------------------------------
# Master BI Reports Response Schema
# ---------------------------------------------------------------------------

class BiReportsAnalyticsResponse(BaseModel):
    business_type: str  # salon | restaurant
    business_name: str
    applied_period_label: str
    start_date: str
    end_date: str

    kpi_summary: ReportsKpiSummary
    
    # Trends
    revenue_trend: list[TimeSeriesPoint] = []
    appointments_or_orders_trend: list[TimeSeriesPoint] = []
    customer_growth_trend: list[CustomerGrowthPoint] = []
    revenue_by_payment_method: list[BreakdownPieItem] = []
    revenue_by_booking_source: list[BreakdownPieItem] = []
    top_categories_chart: list[CategoryBreakdownItem] = []
    
    # Business-specific sections
    salon_reports: Optional[SalonSpecificReports] = None
    restaurant_reports: Optional[RestaurantSpecificReports] = None
    
    # Top tables / lists
    top_customers: list[TopCustomerReportItem] = []
    campaign_reports: list[CampaignReportItem] = []
    loyalty_reports: LoyaltyReportSummary = LoyaltyReportSummary()

    model_config = ConfigDict(from_attributes=True)
