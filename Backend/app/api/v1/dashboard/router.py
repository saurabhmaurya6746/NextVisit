import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get(
    "",
    response_model=DashboardResponse,
    summary="Get dashboard statistics for the authenticated business",
)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns aggregated statistics, top 5 services, and last 10 recent visits
    for the authenticated user's business.
    Requires a valid Bearer JWT.
    """
    return DashboardService(db).get_dashboard_stats(current_user)
