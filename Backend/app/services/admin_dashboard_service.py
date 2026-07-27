from datetime import datetime, timezone
import calendar

from sqlalchemy import extract, func, select, or_
from sqlalchemy.orm import Session

from app.models.business import Business, BusinessStatus
from app.models.business_type import BusinessType
from app.models.campaign import Campaign
from app.models.customer import Customer
from app.models.visit import Visit, VisitStatus
from app.schemas.admin_dashboard import (
    AdminDashboardAnalytics,
    AdminDashboardKpis,
    AdminDashboardResponse,
    AdminDashboardSummary,
    ClientGrowthPoint,
    RecentActivityItem,
    RevenueGrowthPoint,
)


class AdminDashboardService:

    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_data(self) -> AdminDashboardResponse:
        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = now.month

        # -------------------------------------------------------------------
        # 1. KPI & Summary Counts via DB Aggregations
        # -------------------------------------------------------------------
        total_clients = self.db.scalar(
            select(func.count(Business.id)).where(Business.is_deleted == False)
        ) or 0

        active_clients = self.db.scalar(
            select(func.count(Business.id)).where(
                Business.status == BusinessStatus.ACTIVE.value,
                Business.is_deleted == False,
            )
        ) or 0

        pending_clients = self.db.scalar(
            select(func.count(Business.id)).where(
                Business.status == BusinessStatus.PENDING.value,
                Business.is_deleted == False,
            )
        ) or 0

        rejected_clients = self.db.scalar(
            select(func.count(Business.id)).where(
                Business.status == BusinessStatus.REJECTED.value,
                Business.is_deleted == False,
            )
        ) or 0

        suspended_clients = self.db.scalar(
            select(func.count(Business.id)).where(
                Business.status == BusinessStatus.SUSPENDED.value,
                Business.is_deleted == False,
            )
        ) or 0

        trial_clients = self.db.scalar(
            select(func.count(Business.id)).where(
                Business.subscription_status == "trial",
                Business.is_deleted == False,
            )
        ) or 0

        new_clients_this_month = self.db.scalar(
            select(func.count(Business.id)).where(
                extract("year", Business.created_at) == current_year,
                extract("month", Business.created_at) == current_month,
                Business.is_deleted == False,
            )
        ) or 0

        total_customers = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.is_active == True)
        ) or 0

        active_campaigns = self.db.scalar(
            select(func.count(Campaign.id)).where(Campaign.is_active == True)
        ) or 0

        total_revenue = self.db.scalar(
            select(func.sum(Visit.total_amount)).where(
                Visit.status == VisitStatus.COMPLETED
            )
        ) or 0.0

        monthly_revenue = self.db.scalar(
            select(func.sum(Visit.total_amount)).where(
                Visit.status == VisitStatus.COMPLETED,
                extract("year", Visit.completed_at) == current_year,
                extract("month", Visit.completed_at) == current_month,
            )
        ) or 0.0

        churn_count = suspended_clients + rejected_clients
        churn_rate = round((churn_count / total_clients * 100), 1) if total_clients > 0 else 0.0

        kpis = AdminDashboardKpis(
            total_clients=total_clients,
            active_clients=active_clients,
            pending_clients=pending_clients,
            trial_clients=trial_clients,
            expired_clients=0,
            monthly_revenue=round(float(monthly_revenue), 2),
            total_revenue=round(float(total_revenue), 2),
            active_campaigns=active_campaigns,
            total_customers=total_customers,
            coupons_redeemed=0,
            new_clients_this_month=new_clients_this_month,
            churn_rate=churn_rate,
            pending_approvals=pending_clients,
        )

        # -------------------------------------------------------------------
        # 2. Business Type Summary Counts
        # -------------------------------------------------------------------
        total_restaurants = self.db.scalar(
            select(func.count(Business.id))
            .join(BusinessType, Business.business_type_id == BusinessType.id)
            .where(
                BusinessType.name.ilike("%restaurant%"),
                Business.is_deleted == False,
            )
        ) or 0

        total_salons = self.db.scalar(
            select(func.count(Business.id))
            .join(BusinessType, Business.business_type_id == BusinessType.id)
            .where(
                BusinessType.name.ilike("%salon%"),
                Business.is_deleted == False,
            )
        ) or 0

        active_percentage = round((active_clients / total_clients * 100), 1) if total_clients > 0 else 0.0
        pending_percentage = round((pending_clients / total_clients * 100), 1) if total_clients > 0 else 0.0
        rejected_percentage = round((rejected_clients / total_clients * 100), 1) if total_clients > 0 else 0.0
        suspended_percentage = round((suspended_clients / total_clients * 100), 1) if total_clients > 0 else 0.0

        summary = AdminDashboardSummary(
            total_restaurants=total_restaurants,
            total_salons=total_salons,
            total_businesses=total_clients,
            active_percentage=active_percentage,
            pending_percentage=pending_percentage,
            rejected_percentage=rejected_percentage,
            suspended_percentage=suspended_percentage,
        )

        # -------------------------------------------------------------------
        # 3. Analytics (Last 7 Months Growth)
        # -------------------------------------------------------------------
        months_list = []
        for i in range(6, -1, -1):
            m = current_month - i
            y = current_year
            if m <= 0:
                m += 12
                y -= 1
            month_name = calendar.month_abbr[m]
            months_list.append((y, m, month_name))

        client_growth = []
        revenue_growth = []

        for y, m, m_name in months_list:
            c_count = self.db.scalar(
                select(func.count(Business.id)).where(
                    extract("year", Business.created_at) == y,
                    extract("month", Business.created_at) == m,
                    Business.is_deleted == False,
                )
            ) or 0
            client_growth.append(ClientGrowthPoint(month=m_name, count=c_count))

            r_sum = self.db.scalar(
                select(func.sum(Visit.total_amount)).where(
                    Visit.status == VisitStatus.COMPLETED,
                    extract("year", Visit.completed_at) == y,
                    extract("month", Visit.completed_at) == m,
                )
            ) or 0.0
            revenue_growth.append(RevenueGrowthPoint(month=m_name, revenue=round(float(r_sum), 2)))

        analytics = AdminDashboardAnalytics(
            revenue_growth=revenue_growth,
            client_growth=client_growth,
            coupon_usage=[],
        )

        # -------------------------------------------------------------------
        # 4. Recent Activity (Aggregated from real platform events)
        # -------------------------------------------------------------------
        recent_activities: list[RecentActivityItem] = []

        # Latest Business Registrations / Approvals
        latest_businesses = self.db.scalars(
            select(Business)
            .where(Business.is_deleted == False)
            .order_by(Business.created_at.desc())
            .limit(5)
        ).all()

        for b in latest_businesses:
            activity_type = "BUSINESS_REGISTERED"
            title = f"New Business Registered: {b.name}"
            desc = f"{b.owner_name} signed up under status '{b.status}'."
            recent_activities.append(
                RecentActivityItem(
                    id=f"biz-{b.id}",
                    type=activity_type,
                    title=title,
                    description=desc,
                    timestamp=b.created_at,
                )
            )

        # Latest Campaigns
        latest_campaigns = self.db.scalars(
            select(Campaign)
            .order_by(Campaign.created_at.desc())
            .limit(5)
        ).all()

        for c in latest_campaigns:
            recent_activities.append(
                RecentActivityItem(
                    id=f"camp-{c.id}",
                    type="CAMPAIGN_CREATED",
                    title=f"Campaign Launched: {c.name}",
                    description=f"Type: {c.campaign_type} | Segment: {c.target_segment}",
                    timestamp=c.created_at,
                )
            )

        # Sort combined recent activities by timestamp descending
        recent_activities.sort(key=lambda x: x.timestamp, reverse=True)
        recent_activities = recent_activities[:10]

        return AdminDashboardResponse(
            kpis=kpis,
            analytics=analytics,
            summary=summary,
            recent_activity=recent_activities,
        )
