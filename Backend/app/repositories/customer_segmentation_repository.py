import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import extract, select

from app.models.customer import Customer
from app.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class CustomerSegmentationRepository(BaseRepository):

    def get_new_customers(
        self, business_id: UUID, days: int = 30
    ) -> list[Customer]:
        now_utc = datetime.now(timezone.utc)
        cutoff = now_utc - timedelta(days=days)

        stmt = (
            select(Customer)
            .where(
                Customer.business_id == business_id,
                Customer.is_active.is_(True),
                Customer.first_visit_at.is_not(None),
                Customer.first_visit_at >= cutoff,
            )
            .order_by(Customer.first_visit_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_inactive_customers(
        self, business_id: UUID, days: int
    ) -> list[Customer]:
        now_utc = datetime.now(timezone.utc)
        cutoff = now_utc - timedelta(days=days)

        stmt = (
            select(Customer)
            .where(
                Customer.business_id == business_id,
                Customer.is_active.is_(True),
                Customer.last_visit_at.is_not(None),
                Customer.last_visit_at <= cutoff,
            )
            .order_by(Customer.last_visit_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_birthday_today(
        self, business_id: UUID, month: int, day: int
    ) -> list[Customer]:
        stmt = (
            select(Customer)
            .where(
                Customer.business_id == business_id,
                Customer.is_active.is_(True),
                Customer.birth_date.is_not(None),
                extract("month", Customer.birth_date) == month,
                extract("day", Customer.birth_date) == day,
            )
            .order_by(Customer.name.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_anniversary_today(
        self, business_id: UUID, month: int, day: int
    ) -> list[Customer]:
        stmt = (
            select(Customer)
            .where(
                Customer.business_id == business_id,
                Customer.is_active.is_(True),
                Customer.anniversary_date.is_not(None),
                extract("month", Customer.anniversary_date) == month,
                extract("day", Customer.anniversary_date) == day,
            )
            .order_by(Customer.name.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_vip_customers(
        self, business_id: UUID, limit: int = 20
    ) -> list[Customer]:
        stmt = (
            select(Customer)
            .where(
                Customer.business_id == business_id,
                Customer.is_active.is_(True),
            )
            .order_by(Customer.total_spent.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())
