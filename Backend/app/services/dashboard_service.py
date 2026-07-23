import logging

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard import DashboardResponse

logger = logging.getLogger(__name__)


class DashboardService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = DashboardRepository(db)

    def get_dashboard_stats(self, current_user: User) -> DashboardResponse:
        logger.info(
            "Fetching dashboard statistics | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )

        metrics = self.repo.get_dashboard_metrics(current_user.business_id)
        top_services = self.repo.get_top_services(
            current_user.business_id, limit=5
        )
        recent_visits = self.repo.get_recent_visits(
            current_user.business_id, limit=10
        )

        return DashboardResponse(
            **metrics,
            top_services=top_services,
            recent_visits=recent_visits,
        )
