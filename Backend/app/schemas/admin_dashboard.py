from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class AdminDashboardKpis(BaseModel):
    total_clients: int
    active_clients: int
    pending_clients: int
    trial_clients: int
    expired_clients: int
    monthly_revenue: float
    total_revenue: float
    active_campaigns: int
    total_customers: int
    coupons_redeemed: int
    new_clients_this_month: int
    churn_rate: float
    pending_approvals: int


class RevenueGrowthPoint(BaseModel):
    month: str
    revenue: float
    clients: int = 0


class ClientGrowthPoint(BaseModel):
    month: str
    count: int


class CampaignDistributionResponse(BaseModel):
    active: int
    redeemed: int
    expired: int


class AdminDashboardAnalytics(BaseModel):
    revenue_growth: list[RevenueGrowthPoint]
    client_growth: list[ClientGrowthPoint]
    campaign: CampaignDistributionResponse = Field(
        default_factory=lambda: CampaignDistributionResponse(active=0, redeemed=0, expired=0)
    )
    coupon_usage: list[dict] = []


class RecentActivityItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    created_at: datetime
    business_name: str | None = None
    user_name: str | None = None
    activity_type: str

    # Compatibility alias for timestamp
    @property
    def timestamp(self) -> datetime:
        return self.created_at


class PaginatedActivityResponse(BaseModel):
    items: list[RecentActivityItem]
    total: int
    page: int
    size: int


class AdminDashboardSummary(BaseModel):
    total_restaurants: int
    total_salons: int
    total_businesses: int
    active_percentage: float
    pending_percentage: float
    rejected_percentage: float
    suspended_percentage: float


class AdminDashboardResponse(BaseModel):
    statistics: AdminDashboardKpis
    charts: AdminDashboardAnalytics
    recent_activity: list[RecentActivityItem]
    pending_approvals: int
    summary: AdminDashboardSummary

    # Compatibility getters
    @property
    def kpis(self) -> AdminDashboardKpis:
        return self.statistics

    @property
    def analytics(self) -> AdminDashboardAnalytics:
        return self.charts


class PlatformHealthSummary(BaseModel):
    total_clients: int
    active_trials: int
    expired_clients: int
    active_campaigns: int
    total_customers: int
    total_revenue: float


