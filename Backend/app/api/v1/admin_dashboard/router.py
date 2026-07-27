import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.admin_dashboard import AdminDashboardResponse
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
    Returns complete high-level platform statistics, KPIs, 7-month growth analytics,
    business type summary, and recent platform activity in one response.
    Requires Super Admin authorization.
    """
    return AdminDashboardService(db).get_dashboard_data()
