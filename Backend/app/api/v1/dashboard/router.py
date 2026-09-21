import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardAnalyticsResponse
from app.services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get(
    "",
    response_model=DashboardAnalyticsResponse,
    summary="Get complete database-driven dashboard analytics for the authenticated business",
)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns 100% database-driven dashboard metrics:
    - Core revenue & order counts
    - Today's tasks (birthdays, anniversaries, pending reviews, recovery)
    - Sales this week chart (paid revenue per day)
    - Bookings/visits chart
    - 6-month repeat customer % trend
    - Top selling items & categories
    - Revenue & payment breakdown
    - Time-range metrics (new vs returning customers)
    - Peak order hour & busiest weekday
    - Live activity feed & calculated database insights
    - Campaign & review suggestions
    - Month-over-month growth metrics & comparisons

    Requires a valid Bearer JWT.
    """
    return DashboardService(db).get_dashboard_stats(current_user)
