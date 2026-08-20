import calendar
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import extract, func, select, or_, and_
from sqlalchemy.orm import Session

from app.models.business import Business, BusinessStatus
from app.models.business_type import BusinessType
from app.models.campaign import Campaign
from app.models.coupon import Coupon, CouponRedemption
from app.models.customer import Customer
from app.models.subscription_billing_history import SubscriptionBillingHistory
from app.models.subscription_upgrade_request import SubscriptionUpgradeRequest
from app.models.user import User
from app.schemas.admin_dashboard import (
    AdminDashboardAnalytics,
    AdminDashboardKpis,
    AdminDashboardResponse,
    AdminDashboardSummary,
    CampaignDistributionResponse,
    ClientGrowthPoint,
    PaginatedActivityResponse,
    RecentActivityItem,
    RevenueGrowthPoint,
)

logger = logging.getLogger(__name__)


class AdminDashboardService:

    def __init__(self, db: Session):
        self.db = db

    def get_statistics(self) -> AdminDashboardKpis:
        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = now.month

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
                Business.id.in_(
                    select(User.business_id).where(
                        User.email_verified == True,
                        func.lower(User.role) == "owner",
                        User.status != "DELETED",
                    )
                ),
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

        expired_clients = self.db.scalar(
            select(func.count(Business.id)).where(
                or_(
                    Business.subscription_status == "expired",
                    Business.subscription_status == "cancelled",
                ),
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

        coupons_redeemed = self.db.scalar(
            select(func.count(CouponRedemption.id))
        ) or 0

        # Successful subscription payments only
        total_revenue = self.db.scalar(
            select(func.sum(SubscriptionBillingHistory.amount)).where(
                SubscriptionBillingHistory.status == "PAID"
            )
        ) or 0.0

        monthly_revenue = self.db.scalar(
            select(func.sum(SubscriptionBillingHistory.amount)).where(
                SubscriptionBillingHistory.status == "PAID",
                extract("year", SubscriptionBillingHistory.billing_date) == current_year,
                extract("month", SubscriptionBillingHistory.billing_date) == current_month,
            )
        ) or 0.0

        # Churn rate: expired/cancelled subscriptions only (excluding rejected registration approvals)
        churn_count = expired_clients
        churn_rate = round((churn_count / total_clients * 100), 2) if total_clients > 0 else 0.0

        return AdminDashboardKpis(
            total_clients=total_clients,
            active_clients=active_clients,
            pending_clients=pending_clients,
            trial_clients=trial_clients,
            expired_clients=expired_clients,
            monthly_revenue=round(float(monthly_revenue), 2),
            total_revenue=round(float(total_revenue), 2),
            active_campaigns=active_campaigns,
            total_customers=total_customers,
            coupons_redeemed=coupons_redeemed,
            new_clients_this_month=new_clients_this_month,
            churn_rate=churn_rate,
            pending_approvals=pending_clients,
        )

    def get_revenue_chart(self) -> list[RevenueGrowthPoint]:
        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = now.month

        months_list = []
        for i in range(5, -1, -1):
            m = current_month - i
            y = current_year
            if m <= 0:
                m += 12
                y -= 1
            month_name = calendar.month_abbr[m]
            months_list.append((y, m, month_name))

        revenue_points = []
        for y, m, m_name in months_list:
            r_sum = self.db.scalar(
                select(func.sum(SubscriptionBillingHistory.amount)).where(
                    SubscriptionBillingHistory.status == "PAID",
                    extract("year", SubscriptionBillingHistory.billing_date) == y,
                    extract("month", SubscriptionBillingHistory.billing_date) == m,
                )
            ) or 0.0

            c_count = self.db.scalar(
                select(func.count(Business.id)).where(
                    extract("year", Business.created_at) == y,
                    extract("month", Business.created_at) == m,
                    Business.is_deleted == False,
                )
            ) or 0

            revenue_points.append(
                RevenueGrowthPoint(
                    month=m_name,
                    revenue=round(float(r_sum), 2),
                    clients=c_count,
                )
            )

        return revenue_points

    def get_client_growth_chart(self) -> list[ClientGrowthPoint]:
        now = datetime.now(timezone.utc)
        current_year = now.year
        current_month = now.month

        months_list = []
        for i in range(5, -1, -1):
            m = current_month - i
            y = current_year
            if m <= 0:
                m += 12
                y -= 1
            month_name = calendar.month_abbr[m]
            months_list.append((y, m, month_name))

        growth_points = []
        for y, m, m_name in months_list:
            c_count = self.db.scalar(
                select(func.count(Business.id)).where(
                    extract("year", Business.created_at) == y,
                    extract("month", Business.created_at) == m,
                    Business.is_deleted == False,
                )
            ) or 0
            growth_points.append(ClientGrowthPoint(month=m_name, count=c_count))

        return growth_points

    def get_campaign_chart(self) -> CampaignDistributionResponse:
        active_cnt = self.db.scalar(
            select(func.count(Campaign.id)).where(Campaign.is_active == True)
        ) or 0

        redeemed_cnt = self.db.scalar(
            select(func.count(CouponRedemption.id))
        ) or 0

        expired_cnt = self.db.scalar(
            select(func.count(Campaign.id)).where(Campaign.is_active == False)
        ) or 0

        return CampaignDistributionResponse(
            active=active_cnt,
            redeemed=redeemed_cnt,
            expired=expired_cnt,
        )

    def get_activity_logs(
        self,
        page: int = 1,
        size: int = 10,
        activity_type: str | None = None,
        search: str | None = None,
        date_range: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> PaginatedActivityResponse:
        activities: list[RecentActivityItem] = []

        now = datetime.now(timezone.utc)
        filter_start: datetime | None = None
        filter_end: datetime | None = None

        if date_range == "today":
            filter_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif date_range == "last_7_days":
            filter_start = now - timedelta(days=7)
        elif date_range == "last_month":
            filter_start = now - timedelta(days=30)
        elif date_range == "custom" and start_date:
            filter_start = start_date
            filter_end = end_date or now

        # 1. Businesses
        try:
            biz_stmt = select(Business).where(Business.is_deleted == False)
            if filter_start:
                biz_stmt = biz_stmt.where(Business.created_at >= filter_start)
            if filter_end:
                biz_stmt = biz_stmt.where(Business.created_at <= filter_end)

            businesses = self.db.scalars(
                biz_stmt.order_by(Business.created_at.desc()).limit(50)
            ).all()

            for b in businesses:
                status_val = (b.status or "ACTIVE").upper()
                act_type = f"BUSINESS_{status_val}"
                if activity_type and activity_type.upper() not in ["ALL", act_type, "BUSINESS_REGISTERED", "BUSINESS_APPROVED", "BUSINESS_REJECTED", "BUSINESS_SUSPENDED"]:
                    continue

                b_name = b.name or "Business"
                owner_name = b.owner_name or ""
                phone_str = b.phone or ""

                if search:
                    s_lower = search.lower()
                    if s_lower not in b_name.lower() and s_lower not in owner_name.lower():
                        continue

                activities.append(
                    RecentActivityItem(
                        id=f"biz-{b.id}",
                        type=act_type,
                        title=f"Merchant {status_val.title()}: {b_name}",
                        description=f"{owner_name} ({phone_str}) registered under status {status_val}.",
                        created_at=b.created_at or now,
                        business_name=b_name,
                        user_name=owner_name,
                        activity_type=act_type,
                    )
                )
        except Exception as e:
            logger.error("Error fetching business activities: %s", str(e))

        # 2. Campaigns
        try:
            camp_stmt = select(Campaign)
            if filter_start:
                camp_stmt = camp_stmt.where(Campaign.created_at >= filter_start)
            if filter_end:
                camp_stmt = camp_stmt.where(Campaign.created_at <= filter_end)

            campaigns = self.db.scalars(
                camp_stmt.order_by(Campaign.created_at.desc()).limit(50)
            ).all()

            for c in campaigns:
                act_type = "CAMPAIGN_CREATED"
                if activity_type and activity_type.upper() not in ["ALL", act_type]:
                    continue

                c_name = c.name or "Campaign"
                if search and search.lower() not in c_name.lower():
                    continue

                b_name = c.business.name if (c.business and c.business.name) else "System"
                activities.append(
                    RecentActivityItem(
                        id=f"camp-{c.id}",
                        type=act_type,
                        title=f"Campaign Launched: {c_name}",
                        description=f"Type: {c.campaign_type} for segment {c.target_segment}.",
                        created_at=c.created_at or now,
                        business_name=b_name,
                        user_name=None,
                        activity_type=act_type,
                    )
                )
        except Exception as e:
            logger.error("Error fetching campaign activities: %s", str(e))

        # 3. Subscriptions / Payments
        try:
            sub_stmt = select(SubscriptionBillingHistory)
            if filter_start:
                sub_stmt = sub_stmt.where(SubscriptionBillingHistory.billing_date >= filter_start)
            if filter_end:
                sub_stmt = sub_stmt.where(SubscriptionBillingHistory.billing_date <= filter_end)

            billings = self.db.scalars(
                sub_stmt.order_by(SubscriptionBillingHistory.billing_date.desc()).limit(50)
            ).all()

            for sb in billings:
                act_type = "SUBSCRIPTION_PURCHASED"
                if activity_type and activity_type.upper() not in ["ALL", act_type]:
                    continue

                b_name = sb.business.name if (sb.business and sb.business.name) else "Merchant"
                if search and search.lower() not in b_name.lower():
                    continue

                activities.append(
                    RecentActivityItem(
                        id=f"sub-{sb.id}",
                        type=act_type,
                        title=f"Subscription Paid: ₹{(sb.amount or 0.0):.2f}",
                        description=f"Invoice {sb.invoice_number or 'INV'} paid by {b_name}.",
                        created_at=sb.billing_date or now,
                        business_name=b_name,
                        user_name=None,
                        activity_type=act_type,
                    )
                )
        except Exception as e:
            logger.error("Error fetching subscription billing activities: %s", str(e))

        # 4. Coupon Redemptions
        try:
            cp_stmt = select(CouponRedemption)
            if filter_start:
                cp_stmt = cp_stmt.where(CouponRedemption.redeemed_at >= filter_start)
            if filter_end:
                cp_stmt = cp_stmt.where(CouponRedemption.redeemed_at <= filter_end)

            redemptions = self.db.scalars(
                cp_stmt.order_by(CouponRedemption.redeemed_at.desc()).limit(50)
            ).all()

            for cr in redemptions:
                act_type = "COUPON_REDEEMED"
                if activity_type and activity_type.upper() not in ["ALL", act_type]:
                    continue

                b_name = cr.coupon.business.name if (cr.coupon and cr.coupon.business and cr.coupon.business.name) else "Merchant"
                c_name = cr.customer.name if (cr.customer and cr.customer.name) else "Customer"
                code_str = cr.coupon.code if (cr.coupon and cr.coupon.code) else "Discount"

                if search:
                    s_lower = search.lower()
                    if s_lower not in b_name.lower() and s_lower not in c_name.lower() and s_lower not in code_str.lower():
                        continue

                activities.append(
                    RecentActivityItem(
                        id=f"cp-{cr.id}",
                        type=act_type,
                        title=f"Coupon Redeemed: {code_str}",
                        description=f"{c_name} saved ₹{(cr.discount_amount or 0.0):.2f} at {b_name}.",
                        created_at=cr.redeemed_at or now,
                        business_name=b_name,
                        user_name=c_name,
                        activity_type=act_type,
                    )
                )
        except Exception as e:
            logger.error("Error fetching coupon redemption activities: %s", str(e))

        # Sort combined activities descending by date
        activities.sort(key=lambda x: x.created_at, reverse=True)

        total_cnt = len(activities)
        start_idx = (page - 1) * size
        end_idx = start_idx + size
        paged_items = activities[start_idx:end_idx]

        return PaginatedActivityResponse(
            items=paged_items,
            total=total_cnt,
            page=page,
            size=size,
        )

    def get_health_summary(self):
        from app.schemas.admin_dashboard import PlatformHealthSummary
        stats = self.get_statistics()
        return PlatformHealthSummary(
            total_clients=stats.total_clients,
            active_trials=stats.trial_clients,
            expired_clients=stats.expired_clients,
            active_campaigns=stats.active_campaigns,
            total_customers=stats.total_customers,
            total_revenue=stats.total_revenue,
        )

    def get_dashboard_data(self) -> AdminDashboardResponse:
        statistics = self.get_statistics()
        revenue_chart = self.get_revenue_chart()
        client_growth = self.get_client_growth_chart()
        campaign_chart = self.get_campaign_chart()

        activity_resp = self.get_activity_logs(page=1, size=10)

        # Business summary breakdown
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

        total_b = statistics.total_clients
        active_pct = round((statistics.active_clients / total_b * 100), 1) if total_b > 0 else 0.0
        pending_pct = round((statistics.pending_clients / total_b * 100), 1) if total_b > 0 else 0.0

        rejected_cnt = self.db.scalar(
            select(func.count(Business.id)).where(
                Business.status == BusinessStatus.REJECTED.value,
                Business.is_deleted == False,
            )
        ) or 0
        suspended_cnt = self.db.scalar(
            select(func.count(Business.id)).where(
                Business.status == BusinessStatus.SUSPENDED.value,
                Business.is_deleted == False,
            )
        ) or 0

        rejected_pct = round((rejected_cnt / total_b * 100), 1) if total_b > 0 else 0.0
        suspended_pct = round((suspended_cnt / total_b * 100), 1) if total_b > 0 else 0.0

        summary = AdminDashboardSummary(
            total_restaurants=total_restaurants,
            total_salons=total_salons,
            total_businesses=total_b,
            active_percentage=active_pct,
            pending_percentage=pending_pct,
            rejected_percentage=rejected_pct,
            suspended_percentage=suspended_pct,
        )

        charts = AdminDashboardAnalytics(
            revenue_growth=revenue_chart,
            client_growth=client_growth,
            campaign=campaign_chart,
        )

        return AdminDashboardResponse(
            statistics=statistics,
            charts=charts,
            recent_activity=activity_resp.items,
            pending_approvals=statistics.pending_approvals,
            summary=summary,
        )

