import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.repositories.dashboard_repository import DashboardRepository

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/salon/revenue",
    tags=["Salon Revenue"],
)


@router.get(
    "/analytics",
    summary="Get 100% database-driven Salon revenue analytics",
)
def get_salon_revenue_analytics(
    period: str = "this_month",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns dedicated Salon revenue analytics completely isolated from Restaurant code.
    Includes KPI cards, daily/weekly/yearly charts, payment methods, category breakdowns,
    staff performance, service area performance, top services, and GST/discount financials.
    """
    return DashboardRepository(db).get_salon_revenue_analytics(
        business_id=current_user.business_id,
        period=period,
    )
