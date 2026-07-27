from datetime import datetime
from pydantic import BaseModel, ConfigDict


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


class ClientGrowthPoint(BaseModel):
    month: str
    count: int


class AdminDashboardAnalytics(BaseModel):
    revenue_growth: list[RevenueGrowthPoint]
    client_growth: list[ClientGrowthPoint]
    coupon_usage: list[dict] = []


class RecentActivityItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    timestamp: datetime


class AdminDashboardSummary(BaseModel):
    total_restaurants: int
    total_salons: int
    total_businesses: int
    active_percentage: float
    pending_percentage: float
    rejected_percentage: float
    suspended_percentage: float


class AdminDashboardResponse(BaseModel):
    kpis: AdminDashboardKpis
    analytics: AdminDashboardAnalytics
    summary: AdminDashboardSummary
    recent_activity: list[RecentActivityItem]
