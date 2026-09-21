import logging
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard import DashboardAnalyticsResponse

logger = logging.getLogger(__name__)


class DashboardService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = DashboardRepository(db)

    def get_dashboard_stats(self, current_user: User) -> DashboardAnalyticsResponse:
        logger.info(
            "Fetching full database-driven dashboard analytics | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )

        analytics = self.repo.get_full_dashboard_analytics(current_user.business_id)
        return DashboardAnalyticsResponse.model_validate(analytics)
