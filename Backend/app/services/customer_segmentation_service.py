import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.customer_segmentation_repository import (
    CustomerSegmentationRepository,
)
from app.schemas.customer import CustomerSegmentsResponse

logger = logging.getLogger(__name__)


class CustomerSegmentationService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = CustomerSegmentationRepository(db)

    def get_customer_segments(
        self, current_user: User
    ) -> CustomerSegmentsResponse:
        logger.info(
            "Fetching customer segments | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )

        now_utc = datetime.now(timezone.utc)
        today_month = now_utc.month
        today_day = now_utc.day

        new_customers = self.repo.get_new_customers(
            current_user.business_id, days=30
        )
        inactive_15 = self.repo.get_inactive_customers(
            current_user.business_id, days=15
        )
        inactive_30 = self.repo.get_inactive_customers(
            current_user.business_id, days=30
        )
        inactive_60 = self.repo.get_inactive_customers(
            current_user.business_id, days=60
        )
        inactive_90 = self.repo.get_inactive_customers(
            current_user.business_id, days=90
        )
        birthday_today = self.repo.get_birthday_today(
            current_user.business_id, month=today_month, day=today_day
        )
        anniversary_today = self.repo.get_anniversary_today(
            current_user.business_id, month=today_month, day=today_day
        )
        vip_customers = self.repo.get_vip_customers(
            current_user.business_id, limit=20
        )

        return CustomerSegmentsResponse(
            new_customers=new_customers,
            inactive_15_days=inactive_15,
            inactive_30_days=inactive_30,
            inactive_60_days=inactive_60,
            inactive_90_days=inactive_90,
            birthday_today=birthday_today,
            anniversary_today=anniversary_today,
            vip_customers=vip_customers,
        )
