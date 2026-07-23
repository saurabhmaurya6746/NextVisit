import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.service import Service
from app.models.user import User
from app.models.visit import Visit, VisitService, VisitStatus
from app.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class DashboardRepository(BaseRepository):

    def get_dashboard_metrics(self, business_id: UUID) -> dict:
        now = datetime.now(timezone.utc)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_month = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        # 1. Total Customers
        total_customers = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id
                )
            )
            or 0
        )

        # 2. Active Customers
        active_customers = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.is_active.is_(True),
                )
            )
            or 0
        )

        # 3. Total Staff
        total_staff = (
            self.db.scalar(
                select(func.count(User.id)).where(User.business_id == business_id)
            )
            or 0
        )

        # 4. Total Services
        total_services = (
            self.db.scalar(
                select(func.count(Service.id)).where(
                    Service.business_id == business_id
                )
            )
            or 0
        )

        # 5. Total Visits
        total_visits = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id
                )
            )
            or 0
        )

        # 6. Open Visits
        open_visits = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.OPEN,
                )
            )
            or 0
        )

        # 7. Completed Visits
        completed_visits = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                )
            )
            or 0
        )

        # 8. Today Visits
        today_visits = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.created_at >= start_of_today,
                )
            )
            or 0
        )

        # 9. Today Revenue (completed visits today)
        today_revenue = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                    Visit.created_at >= start_of_today,
                )
            )
            or 0.0
        )

        # 10. Monthly Visits
        monthly_visits = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.created_at >= start_of_month,
                )
            )
            or 0
        )

        # 11. Monthly Revenue (completed visits this month)
        monthly_revenue = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                    Visit.created_at >= start_of_month,
                )
            )
            or 0.0
        )

        # 12. Total Revenue (all completed visits)
        total_revenue = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                )
            )
            or 0.0
        )

        # 13. Average Bill
        average_bill = (
            round(total_revenue / completed_visits, 2)
            if completed_visits > 0
            else 0.0
        )

        return {
            "total_customers": total_customers,
            "active_customers": active_customers,
            "total_staff": total_staff,
            "total_services": total_services,
            "total_visits": total_visits,
            "open_visits": open_visits,
            "completed_visits": completed_visits,
            "today_visits": today_visits,
            "today_revenue": today_revenue,
            "monthly_visits": monthly_visits,
            "monthly_revenue": monthly_revenue,
            "total_revenue": total_revenue,
            "average_bill": average_bill,
        }

    def get_top_services(
        self, business_id: UUID, limit: int = 5
    ) -> list[dict]:
        stmt = (
            select(
                Service.id.label("service_id"),
                Service.name.label("service_name"),
                func.count(func.distinct(VisitService.visit_id)).label(
                    "visit_count"
                ),
                func.coalesce(func.sum(VisitService.total_price), 0.0).label(
                    "revenue"
                ),
            )
            .join(VisitService, Service.id == VisitService.service_id)
            .join(Visit, VisitService.visit_id == Visit.id)
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
            .group_by(Service.id, Service.name)
            .order_by(func.sum(VisitService.total_price).desc())
            .limit(limit)
        )

        results = self.db.execute(stmt).all()
        return [
            {
                "service_id": row.service_id,
                "service_name": row.service_name,
                "visit_count": row.visit_count or 0,
                "revenue": float(row.revenue or 0.0),
            }
            for row in results
        ]

    def get_recent_visits(
        self, business_id: UUID, limit: int = 10
    ) -> list[dict]:
        stmt = (
            select(
                Visit.id.label("visit_id"),
                Customer.name.label("customer_name"),
                Visit.total_amount,
                Visit.payment_status,
                Visit.status,
                Visit.completed_at,
            )
            .join(Customer, Visit.customer_id == Customer.id)
            .where(Visit.business_id == business_id)
            .order_by(Visit.created_at.desc())
            .limit(limit)
        )

        results = self.db.execute(stmt).all()
        return [
            {
                "visit_id": row.visit_id,
                "customer_name": row.customer_name,
                "total_amount": float(row.total_amount or 0.0),
                "payment_status": row.payment_status,
                "status": row.status,
                "completed_at": row.completed_at,
            }
            for row in results
        ]
