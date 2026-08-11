import logging
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.admin_dashboard import (
    AdminDashboardResponse,
    CampaignDistributionResponse,
    ClientGrowthPoint,
    PaginatedActivityResponse,
    RevenueGrowthPoint,
)
from app.services.admin_dashboard_service import AdminDashboardService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/dashboard",
    tags=["Super Admin Dashboard"],
)


@router.get(
    "",
    response_model=AdminDashboardResponse,
    summary="Get complete Super Admin Dashboard data",
)
def get_admin_dashboard(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns complete high-level platform statistics, KPIs, growth analytics,
    and recent platform activity in one unified response.
    Requires Super Admin authorization.
    """
    return AdminDashboardService(db).get_dashboard_data()


@router.get(
    "/health-summary",
    summary="Get real-time platform health summary",
)
def get_platform_health_summary(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns real-time platform health summary metrics for the monitoring section.
    """
    return AdminDashboardService(db).get_health_summary()


@router.get(
    "/revenue-chart",
    response_model=list[RevenueGrowthPoint],
    summary="Get monthly revenue analytics chart",
)
def get_revenue_chart(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns monthly subscription revenue and client count points for the past 6-12 months.
    """
    return AdminDashboardService(db).get_revenue_chart()


@router.get(
    "/client-growth",
    response_model=list[ClientGrowthPoint],
    summary="Get merchant growth chart",
)
def get_client_growth(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns monthly business registration counts for the past 6-12 months.
    """
    return AdminDashboardService(db).get_client_growth_chart()


@router.get(
    "/campaign-chart",
    response_model=CampaignDistributionResponse,
    summary="Get campaign distribution chart",
)
def get_campaign_chart(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns distribution of active, redeemed, and expired campaigns/coupons.
    """
    return AdminDashboardService(db).get_campaign_chart()


@router.get(
    "/activity",
    response_model=PaginatedActivityResponse,
    summary="Get paginated platform activity logs",
)
def get_activity_logs(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=100),
    activity_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_range: str | None = Query(default=None),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns paginated platform activity logs with filtering capabilities.
    """
    return AdminDashboardService(db).get_activity_logs(
        page=page,
        size=size,
        activity_type=activity_type,
        search=search,
        date_range=date_range,
        start_date=start_date,
        end_date=end_date,
    )

