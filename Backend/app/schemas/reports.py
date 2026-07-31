from pydantic import BaseModel, ConfigDict


class RevenueSeriesItem(BaseModel):
    day: str
    sales: float


class BookingsSeriesItem(BaseModel):
    day: str
    bookings: int


class TopCustomerItem(BaseModel):
    id: str
    name: str
    visits: int
    spent: float


class TopSellingItem(BaseModel):
    name: str
    sold: int
    revenue: float


class CampaignPerformanceItem(BaseModel):
    name: str
    sent: int
    opened: int
    converted: int


class ReportsSummary(BaseModel):
    total_revenue: float
    total_bookings: int
    total_customers: int
    total_campaigns: int


class ReportsAnalyticsResponse(BaseModel):
    revenue_series: list[RevenueSeriesItem]
    bookings_series: list[BookingsSeriesItem]
    top_customers: list[TopCustomerItem]
    top_items: list[TopSellingItem]
    campaign_performance: list[CampaignPerformanceItem]
    summary: ReportsSummary

    model_config = ConfigDict(from_attributes=True)
