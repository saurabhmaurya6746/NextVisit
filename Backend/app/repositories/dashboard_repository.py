import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import extract, func, select, or_
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.business_type import BusinessType
from app.models.customer import Customer
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderItem, OrderStatus
from app.models.service import Service
from app.models.user import User
from app.models.visit import PaymentStatus, Visit, VisitService, VisitStatus
from app.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class DashboardRepository(BaseRepository):

    def get_full_dashboard_analytics(self, business_id: UUID) -> dict:
        biz = self.db.get(Business, business_id)
        if biz:
            if biz.business_type_id:
                btype = self.db.get(BusinessType, biz.business_type_id)
                if btype:
                    btype_name = str(getattr(btype, "name", "") or "").lower()
                    btype_slug = str(getattr(btype, "slug", "") or "").lower()
                    if "salon" in btype_name or "spa" in btype_name or "salon" in btype_slug or "spa" in btype_slug:
                        return self.get_salon_dashboard_analytics(business_id)

            has_visits = self.db.scalar(
                select(func.count(Visit.id)).where(Visit.business_id == business_id)
            ) or 0
            if has_visits > 0:
                return self.get_salon_dashboard_analytics(business_id)

        now = datetime.now(timezone.utc)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_yesterday = start_of_today - timedelta(days=1)
        
        # Start of current week (Monday)
        start_of_week = start_of_today - timedelta(days=now.weekday())
        start_of_last_week = start_of_week - timedelta(days=7)
        
        # Start of current month
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Start of last month
        last_month_end = start_of_month - timedelta(seconds=1)
        start_of_last_month = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # -------------------------------------------------------------------
        # 1. CORE STATS & VISITS/ORDERS COUNTS
        # -------------------------------------------------------------------
        total_customers = (
            self.db.scalar(
                select(func.count(Customer.id)).where(Customer.business_id == business_id)
            )
            or 0
        )

        active_customers = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.is_active.is_(True),
                )
            )
            or 0
        )

        total_staff = (
            self.db.scalar(
                select(func.count(User.id)).where(User.business_id == business_id)
            )
            or 0
        )

        total_services = (
            self.db.scalar(
                select(func.count(Service.id)).where(Service.business_id == business_id)
            )
            or 0
        )

        # Orders & Visits counts
        total_orders_count = (
            self.db.scalar(
                select(func.count(Order.id)).where(Order.business_id == business_id)
            )
            or 0
        )

        today_orders_count = (
            self.db.scalar(
                select(func.count(Order.id)).where(
                    Order.business_id == business_id,
                    Order.created_at >= start_of_today,
                )
            )
            or 0
        )

        total_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(Visit.business_id == business_id)
            )
            or 0
        )

        today_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.created_at >= start_of_today,
                )
            )
            or 0
        )

        open_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.OPEN,
                )
            )
            or 0
        )

        completed_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                )
            )
            or 0
        )

        monthly_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.created_at >= start_of_month,
                )
            )
            or 0
        )

        # -------------------------------------------------------------------
        # 2. REVENUE CALCULATIONS
        # -------------------------------------------------------------------
        # Total Revenue (Paid Orders + Completed Visits)
        order_revenue_expr = func.coalesce(func.sum(Order.total_amount), 0.0)
        total_order_revenue = float(
            self.db.scalar(
                select(order_revenue_expr).where(
                    Order.business_id == business_id,
                    Order.status.in_([OrderStatus.SERVED, OrderStatus.READY, OrderStatus.OPEN, OrderStatus.PREPARING]),
                )
            )
            or 0.0
        )

        total_visit_revenue = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                )
            )
            or 0.0
        )

        total_revenue = max(total_order_revenue, total_visit_revenue)

        # Today Revenue
        today_order_rev = float(
            self.db.scalar(
                select(order_revenue_expr).where(
                    Order.business_id == business_id,
                    Order.status.in_([OrderStatus.SERVED, OrderStatus.READY, OrderStatus.OPEN, OrderStatus.PREPARING]),
                    Order.created_at >= start_of_today,
                )
            )
            or 0.0
        )
        today_visit_rev = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                    Visit.created_at >= start_of_today,
                )
            )
            or 0.0
        )
        today_revenue = max(today_order_rev, today_visit_rev)

        # Yesterday Revenue
        yesterday_order_rev = float(
            self.db.scalar(
                select(order_revenue_expr).where(
                    Order.business_id == business_id,
                    Order.status.in_([OrderStatus.SERVED, OrderStatus.READY, OrderStatus.OPEN, OrderStatus.PREPARING]),
                    Order.created_at >= start_of_yesterday,
                    Order.created_at < start_of_today,
                )
            )
            or 0.0
        )

        # Monthly Revenue
        monthly_order_rev = float(
            self.db.scalar(
                select(order_revenue_expr).where(
                    Order.business_id == business_id,
                    Order.status.in_([OrderStatus.SERVED, OrderStatus.READY, OrderStatus.OPEN, OrderStatus.PREPARING]),
                    Order.created_at >= start_of_month,
                )
            )
            or 0.0
        )
        monthly_revenue = max(monthly_order_rev, float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.created_at >= start_of_month,
            )
        ) or 0.0))

        # Last Month Revenue
        last_month_order_rev = float(
            self.db.scalar(
                select(order_revenue_expr).where(
                    Order.business_id == business_id,
                    Order.status.in_([OrderStatus.SERVED, OrderStatus.READY, OrderStatus.OPEN, OrderStatus.PREPARING]),
                    Order.created_at >= start_of_last_month,
                    Order.created_at < start_of_month,
                )
            )
            or 0.0
        )

        # Average Bill / Average Order Value
        total_completed_count = max(total_orders_count, completed_visits_count)
        average_bill = round(total_revenue / total_completed_count, 2) if total_completed_count > 0 else 0.0

        # Average Daily Revenue
        elapsed_days = max(1, now.day)
        avg_daily_revenue = round(monthly_revenue / elapsed_days, 2)

        # -------------------------------------------------------------------
        # 3. SECTION 1: TODAY'S TASKS
        # -------------------------------------------------------------------
        today_m = now.month
        today_d = now.day

        todays_birthdays = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    extract("month", Customer.birth_date) == today_m,
                    extract("day", Customer.birth_date) == today_d,
                )
            )
            or 0
        )

        todays_anniversaries = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    extract("month", Customer.anniversary_date) == today_m,
                    extract("day", Customer.anniversary_date) == today_d,
                )
            )
            or 0
        )

        thirty_days_ago = now - timedelta(days=30)
        recovery_customers = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.last_visit_at.isnot(None),
                    Customer.last_visit_at <= thirty_days_ago,
                )
            )
            or 0
        )

        pending_reviews = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.visit_count > 0,
                    or_(Customer.notes.is_(None), ~Customer.notes.like("%reviewed%")),
                )
            )
            or 0
        )

        expiring_coupons = 0  # Database ready for coupons

        # -------------------------------------------------------------------
        # 4. SECTION 2: SALES THIS WEEK GRAPH & SECTION 3: BOOKINGS CHART
        # -------------------------------------------------------------------
        days_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekly_sales_map = {d: 0.0 for d in days_names}
        weekly_bookings_map = {d: 0 for d in days_names}

        orders_this_week = self.db.execute(
            select(
                extract("dow", Order.created_at).label("dow"),
                func.sum(Order.total_amount).label("sales"),
                func.count(Order.id).label("bookings"),
            )
            .where(
                Order.business_id == business_id,
                Order.created_at >= start_of_week,
            )
            .group_by("dow")
        ).all()

        for row in orders_this_week:
            # PostgreSQL extract(dow): 0=Sun, 1=Mon, ..., 6=Sat
            dow_num = int(row.dow)
            idx = (dow_num - 1) % 7
            day_name = days_names[idx]
            weekly_sales_map[day_name] = float(row.sales or 0.0)
            weekly_bookings_map[day_name] = int(row.bookings or 0)

        weekly_sales = [{"day": d, "sales": round(weekly_sales_map[d], 2)} for d in days_names]
        weekly_bookings = [{"day": d, "bookings": weekly_bookings_map[d]} for d in days_names]

        # -------------------------------------------------------------------
        # 5. SECTION 4: REPEAT CUSTOMER % (LAST 6 MONTHS)
        # -------------------------------------------------------------------
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        repeat_customer_trend = []
        
        for i in range(5, -1, -1):
            target_month_date = now - timedelta(days=i * 30)
            m_num = target_month_date.month
            m_year = target_month_date.year
            m_label = month_names[m_num - 1]

            m_start = datetime(m_year, m_num, 1, tzinfo=timezone.utc)
            if m_num == 12:
                m_end = datetime(m_year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                m_end = datetime(m_year, m_num + 1, 1, tzinfo=timezone.utc)

            m_tot = self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.created_at <= m_end,
                )
            ) or 0

            m_repeat = self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.created_at <= m_end,
                    Customer.visit_count > 1,
                )
            ) or 0

            rate = round((m_repeat / m_tot) * 100, 1) if m_tot > 0 else 0.0
            repeat_customer_trend.append({"month": m_label, "rate": rate})

        # -------------------------------------------------------------------
        # 6. SECTION 5: TOP SELLING ITEMS & SECTION 6: TOP CATEGORIES
        # -------------------------------------------------------------------
        top_selling_items_query = self.db.execute(
            select(
                OrderItem.item_name.label("name"),
                func.sum(OrderItem.quantity).label("quantity"),
                func.sum(OrderItem.subtotal).label("revenue"),
            )
            .join(Order, OrderItem.order_id == Order.id)
            .where(Order.business_id == business_id)
            .group_by(OrderItem.item_name)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(5)
        ).all()

        top_selling_items = [
            {
                "name": r.name,
                "quantity": int(r.quantity or 0),
                "revenue": float(r.revenue or 0.0),
            }
            for r in top_selling_items_query
        ]

        top_categories_query = self.db.execute(
            select(
                func.coalesce(MenuCategory.name, "General").label("category"),
                func.count(OrderItem.id).label("orders"),
                func.sum(OrderItem.subtotal).label("revenue"),
            )
            .select_from(OrderItem)
            .join(Order, OrderItem.order_id == Order.id)
            .outerjoin(MenuItem, OrderItem.menu_item_id == MenuItem.id)
            .outerjoin(MenuCategory, MenuItem.category_id == MenuCategory.id)
            .where(Order.business_id == business_id)
            .group_by(func.coalesce(MenuCategory.name, "General"))
            .order_by(func.sum(OrderItem.subtotal).desc())
            .limit(5)
        ).all()

        top_categories = [
            {
                "category": r.category,
                "orders": int(r.orders or 0),
                "revenue": float(r.revenue or 0.0),
            }
            for r in top_categories_query
        ]

        # -------------------------------------------------------------------
        # 7. SECTION 7: REVENUE BREAKDOWN & SECTION 8: PAYMENT BREAKDOWN
        # -------------------------------------------------------------------
        qr_rev = float(self.db.scalar(
            select(func.coalesce(func.sum(Order.total_amount), 0.0)).where(
                Order.business_id == business_id,
                Order.order_source == "QR",
            )
        ) or 0.0)

        staff_rev = float(self.db.scalar(
            select(func.coalesce(func.sum(Order.total_amount), 0.0)).where(
                Order.business_id == business_id,
                Order.order_source.in_(["POS", "STAFF"]),
            )
        ) or 0.0)

        revenue_breakdown = {
            "qr_orders_revenue": qr_rev,
            "staff_orders_revenue": staff_rev,
            "walkin_revenue": max(0.0, total_revenue - (qr_rev + staff_rev)),
            "online_revenue": 0.0,
        }

        payment_breakdown_query = self.db.execute(
            select(
                Visit.payment_method,
                func.sum(Visit.total_amount).label("amount"),
            )
            .where(Visit.business_id == business_id, Visit.payment_method.isnot(None))
            .group_by(Visit.payment_method)
        ).all()

        pm_map = {str(r.payment_method).lower(): float(r.amount or 0.0) for r in payment_breakdown_query if r.payment_method}
        payment_breakdown = {
            "cash": pm_map.get("cash", 0.0),
            "upi": pm_map.get("upi", 0.0),
            "card": pm_map.get("card", 0.0),
            "wallet": pm_map.get("wallet", 0.0),
            "other": pm_map.get("other", 0.0),
        }

        # -------------------------------------------------------------------
        # 8. SECTION 11: NEW CUSTOMERS & SECTION 12: RETURNING CUSTOMERS
        # -------------------------------------------------------------------
        new_cust_today = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.business_id == business_id, Customer.created_at >= start_of_today)
        ) or 0
        new_cust_week = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.business_id == business_id, Customer.created_at >= start_of_week)
        ) or 0
        new_cust_month = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.business_id == business_id, Customer.created_at >= start_of_month)
        ) or 0

        new_customers = {
            "today": new_cust_today,
            "this_week": new_cust_week,
            "this_month": new_cust_month,
        }

        ret_cust_today = self.db.scalar(
            select(func.count(Order.id)).where(Order.business_id == business_id, Order.created_at >= start_of_today, Order.customer_id.isnot(None))
        ) or 0
        ret_cust_week = self.db.scalar(
            select(func.count(Order.id)).where(Order.business_id == business_id, Order.created_at >= start_of_week, Order.customer_id.isnot(None))
        ) or 0
        ret_cust_month = self.db.scalar(
            select(func.count(Order.id)).where(Order.business_id == business_id, Order.created_at >= start_of_month, Order.customer_id.isnot(None))
        ) or 0

        returning_customers = {
            "today": ret_cust_today,
            "this_week": ret_cust_week,
            "this_month": ret_cust_month,
        }

        # -------------------------------------------------------------------
        # 9. SECTION 13: MOST BUSY HOUR & SECTION 14: MOST BUSY DAY
        # -------------------------------------------------------------------
        busy_hour_query = self.db.execute(
            select(
                extract("hour", Order.created_at).label("hr"),
                func.count(Order.id).label("cnt"),
            )
            .where(Order.business_id == business_id)
            .group_by("hr")
            .order_by(func.count(Order.id).desc())
            .limit(1)
        ).first()

        if busy_hour_query and busy_hour_query.hr is not None:
            hr_val = int(busy_hour_query.hr)
            next_hr = (hr_val + 1) % 24
            hr_fmt = lambda h: f"{h if h <= 12 else h - 12} {'AM' if h < 12 else 'PM'}" if h != 0 else "12 AM"
            most_busy_hour = f"{hr_fmt(hr_val)} - {hr_fmt(next_hr)}"
        else:
            most_busy_hour = "No orders yet"

        busy_day_query = self.db.execute(
            select(
                extract("dow", Order.created_at).label("dow"),
                func.count(Order.id).label("cnt"),
            )
            .where(Order.business_id == business_id)
            .group_by("dow")
            .order_by(func.count(Order.id).desc())
            .limit(1)
        ).first()

        if busy_day_query and busy_day_query.dow is not None:
            dow_idx = (int(busy_day_query.dow) - 1) % 7
            full_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            most_busy_day = full_days[dow_idx]
        else:
            most_busy_day = "No orders yet"

        # -------------------------------------------------------------------
        # 10. SECTION 15: RECENT ACTIVITY FEED
        # -------------------------------------------------------------------
        recent_orders = self.db.execute(
            select(Order)
            .where(Order.business_id == business_id)
            .order_by(Order.created_at.desc())
            .limit(8)
        ).scalars().all()

        recent_activity = [
            {
                "id": str(o.id),
                "type": "qr_order" if o.order_source == "QR" else "staff_order",
                "title": f"{'QR Self-Order' if o.order_source == 'QR' else 'Staff Order'} {o.order_number}",
                "description": f"Total ₹{o.total_amount:.2f} · Status {o.status}",
                "timestamp": o.created_at.isoformat() if o.created_at else now.isoformat(),
            }
            for o in recent_orders
        ]

        # -------------------------------------------------------------------
        # 11. SECTION 16: CALCULATED AI INSIGHTS CARDS
        # -------------------------------------------------------------------
        calculated_insights = []
        if top_selling_items:
            calculated_insights.append({
                "id": "top_item",
                "title": f"Top selling item: {top_selling_items[0]['name']}",
                "detail": f"Sold {top_selling_items[0]['quantity']} units generating ₹{top_selling_items[0]['revenue']:.2f}",
                "type": "positive",
            })
        if most_busy_hour != "No orders yet":
            calculated_insights.append({
                "id": "busy_hour",
                "title": f"Peak Order Hour: {most_busy_hour}",
                "detail": "Staff allocation recommended during this window.",
                "type": "neutral",
            })
        if total_customers > 0:
            repeat_cnt = self.db.scalar(select(func.count(Customer.id)).where(Customer.business_id == business_id, Customer.visit_count > 1)) or 0
            rep_pct = round((repeat_cnt / total_customers) * 100, 1)
            calculated_insights.append({
                "id": "repeat_rate",
                "title": f"Repeat Customer Rate: {rep_pct}%",
                "detail": f"{repeat_cnt} of {total_customers} customers have visited more than once.",
                "type": "positive" if rep_pct >= 20 else "warning",
            })

        # -------------------------------------------------------------------
        # 12. SECTION 17: CAMPAIGN SUGGESTIONS & SECTION 18: REVIEWS
        # -------------------------------------------------------------------
        campaign_suggestions = [
            {
                "title": "Reactivate Inactive Customers",
                "detail": f"{recovery_customers} customers haven't visited in 30+ days.",
                "count": recovery_customers,
                "path": "customer-recovery",
            },
            {
                "title": "Today's Birthdays",
                "detail": f"{todays_birthdays} customers celebrating birthday today.",
                "count": todays_birthdays,
                "path": "birthday-campaigns/today",
            },
            {
                "title": "Today's Anniversaries",
                "detail": f"{todays_anniversaries} customers celebrating anniversary today.",
                "count": todays_anniversaries,
                "path": "anniversary-campaigns/today",
            },
        ]

        review_suggestions_query = self.db.execute(
            select(Customer)
            .where(
                Customer.business_id == business_id,
                Customer.visit_count > 0,
                or_(Customer.notes.is_(None), ~Customer.notes.like("%reviewed%")),
            )
            .limit(5)
        ).scalars().all()

        review_suggestions = [
            {
                "customer_id": str(c.id),
                "customer_name": c.name,
                "phone": c.phone,
                "visit_date": c.last_visit_at.isoformat() if c.last_visit_at else now.isoformat(),
            }
            for c in review_suggestions_query
        ]

        # -------------------------------------------------------------------
        # 13. SECTION 19: REVENUE COMPARISON & SECTION 20: GROWTH METRICS
        # -------------------------------------------------------------------
        calc_pct = lambda curr, prev: round(((curr - prev) / prev) * 100, 1) if prev > 0 else (100.0 if curr > 0 else 0.0)

        revenue_comparison = {
            "today_vs_yesterday_pct": calc_pct(today_revenue, yesterday_order_rev),
            "week_vs_last_week_pct": 0.0,
            "month_vs_last_month_pct": calc_pct(monthly_revenue, last_month_order_rev),
        }

        growth_metrics = {
            "customer_growth_pct": calc_pct(float(new_cust_month), float(total_customers - new_cust_month)),
            "revenue_growth_pct": calc_pct(monthly_revenue, last_month_order_rev),
            "visit_growth_pct": calc_pct(float(monthly_visits_count), 0.0),
            "order_growth_pct": calc_pct(float(today_orders_count), 0.0),
        }

        # -------------------------------------------------------------------
        # LEGACY RETRO COMPATIBILITY
        # -------------------------------------------------------------------
        top_services = [
            {
                "service_id": None,
                "service_name": item["name"],
                "visit_count": item["quantity"],
                "revenue": item["revenue"],
            }
            for item in top_selling_items
        ]

        recent_visits = [
            {
                "visit_id": o.id,
                "customer_name": o.customer.name if o.customer else "Guest Customer",
                "total_amount": float(o.total_amount),
                "payment_status": "PAID" if o.status in [OrderStatus.SERVED, OrderStatus.READY] else "PENDING",
                "status": str(o.status.value if hasattr(o.status, "value") else o.status),
                "completed_at": o.created_at,
            }
            for o in recent_orders
        ]

        return {
            "today_orders": max(today_orders_count, today_visits_count),
            "today_visits": today_visits_count,
            "today_revenue": today_revenue,
            "total_customers": total_customers,
            "active_customers": active_customers,
            "total_staff": total_staff,
            "total_services": total_services,
            "total_visits": total_visits_count,
            "open_visits": open_visits_count,
            "completed_visits": completed_visits_count,
            "total_revenue": total_revenue,
            "monthly_visits": monthly_visits_count,
            "monthly_revenue": monthly_revenue,
            "average_bill": average_bill,
            "avg_daily_revenue": avg_daily_revenue,
            "most_busy_hour": most_busy_hour,
            "most_busy_day": most_busy_day,
            "tasks": {
                "todays_birthdays": todays_birthdays,
                "todays_anniversaries": todays_anniversaries,
                "pending_reviews": pending_reviews,
                "recovery_customers": recovery_customers,
                "expiring_coupons": expiring_coupons,
            },
            "weekly_sales": weekly_sales,
            "weekly_bookings": weekly_bookings,
            "repeat_customer_trend": repeat_customer_trend,
            "top_selling_items": top_selling_items,
            "top_categories": top_categories,
            "revenue_breakdown": revenue_breakdown,
            "payment_breakdown": payment_breakdown,
            "new_customers": new_customers,
            "returning_customers": returning_customers,
            "recent_activity": recent_activity,
            "calculated_insights": calculated_insights,
            "campaign_suggestions": campaign_suggestions,
            "review_suggestions": review_suggestions,
            "revenue_comparison": revenue_comparison,
            "growth_metrics": growth_metrics,
            "top_services": top_services,
            "recent_visits": recent_visits,
        }

    def get_salon_dashboard_analytics(self, business_id: UUID) -> dict:
        ist = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(ist)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_yesterday = start_of_today - timedelta(days=1)
        start_of_week = start_of_today - timedelta(days=now.weekday())
        start_of_last_week = start_of_week - timedelta(days=7)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_end = start_of_month - timedelta(seconds=1)
        start_of_last_month = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # 1. CLIENTS & STAFF & SERVICES COUNTS
        total_customers = (
            self.db.scalar(select(func.count(Customer.id)).where(Customer.business_id == business_id))
            or 0
        )
        active_customers = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.is_active.is_(True),
                )
            )
            or 0
        )
        total_staff = (
            self.db.scalar(select(func.count(User.id)).where(User.business_id == business_id))
            or 0
        )
        total_services = (
            self.db.scalar(select(func.count(Service.id)).where(Service.business_id == business_id))
            or 0
        )

        # 2. APPOINTMENTS & SERVICES COUNTS (EXCLUDING CANCELLED)
        today_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.status != VisitStatus.CANCELLED,
                    or_(
                        Visit.created_at >= start_of_today,
                        Visit.started_at >= start_of_today,
                        Visit.completed_at >= start_of_today,
                    ),
                )
            )
            or 0
        )

        # Ongoing Appointments: ONLY visits actively OPEN / checkedin / in service
        open_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.OPEN,
                )
            )
            or 0
        )

        # Today's Completed Services: Sum of VisitService quantity for completed or paid visits today
        today_completed_services_count = (
            self.db.scalar(
                select(func.coalesce(func.sum(VisitService.quantity), 0))
                .join(Visit, VisitService.visit_id == Visit.id)
                .where(
                    Visit.business_id == business_id,
                    or_(
                        Visit.payment_status == PaymentStatus.PAID,
                        Visit.status == VisitStatus.COMPLETED,
                    ),
                    or_(
                        Visit.completed_at >= start_of_today,
                        Visit.started_at >= start_of_today,
                        Visit.created_at >= start_of_today,
                    ),
                )
            )
            or 0
        )
        if today_completed_services_count == 0:
            today_completed_services_count = (
                self.db.scalar(
                    select(func.count(Visit.id)).where(
                        Visit.business_id == business_id,
                        or_(
                            Visit.payment_status == PaymentStatus.PAID,
                            Visit.status == VisitStatus.COMPLETED,
                        ),
                        or_(
                            Visit.completed_at >= start_of_today,
                            Visit.started_at >= start_of_today,
                            Visit.created_at >= start_of_today,
                        ),
                    )
                )
                or 0
            )

        completed_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    or_(
                        Visit.payment_status == PaymentStatus.PAID,
                        Visit.status == VisitStatus.COMPLETED,
                    ),
                )
            )
            or 0
        )

        total_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    Visit.status != VisitStatus.CANCELLED,
                )
            )
            or 0
        )

        monthly_visits_count = (
            self.db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.business_id == business_id,
                    or_(
                        Visit.payment_status == PaymentStatus.PAID,
                        Visit.status == VisitStatus.COMPLETED,
                    ),
                    or_(
                        Visit.created_at >= start_of_month,
                        Visit.started_at >= start_of_month,
                        Visit.completed_at >= start_of_month,
                    ),
                )
            )
            or 0
        )

        # 3. REVENUE CALCULATIONS
        total_revenue = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    or_(
                        Visit.payment_status == PaymentStatus.PAID,
                        Visit.status == VisitStatus.COMPLETED,
                    ),
                )
            )
            or 0.0
        )

        today_revenue = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    or_(
                        Visit.payment_status == PaymentStatus.PAID,
                        Visit.status == VisitStatus.COMPLETED,
                    ),
                    or_(
                        Visit.completed_at >= start_of_today,
                        Visit.started_at >= start_of_today,
                        Visit.created_at >= start_of_today,
                    ),
                )
            )
            or 0.0
        )

        yesterday_revenue = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                    Visit.created_at >= start_of_yesterday,
                    Visit.created_at < start_of_today,
                )
            )
            or 0.0
        )

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

        last_month_revenue = float(
            self.db.scalar(
                select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                    Visit.created_at >= start_of_last_month,
                    Visit.created_at < start_of_month,
                )
            )
            or 0.0
        )

        if completed_visits_count > 0:
            average_service_value = round(total_revenue / completed_visits_count, 2)
        elif today_completed_services_count > 0:
            average_service_value = round(today_revenue / today_completed_services_count, 2)
        elif today_revenue > 0:
            average_service_value = round(today_revenue, 2)
        else:
            average_service_value = 0.0

        distinct_days_count = self.db.scalar(
            select(func.count(func.distinct(func.date(func.coalesce(Visit.completed_at, Visit.started_at, Visit.created_at))))).where(
                Visit.business_id == business_id,
                or_(
                    Visit.payment_status == PaymentStatus.PAID,
                    Visit.status == VisitStatus.COMPLETED,
                ),
            )
        ) or 0

        effective_days = max(1, distinct_days_count) if total_revenue > 0 else distinct_days_count
        avg_daily_revenue = (
            round(total_revenue / effective_days, 2)
            if (effective_days > 0 and total_revenue > 0)
            else 0.0
        )

        # 4. ACTION TASKS
        today_m = now.month
        today_d = now.day

        todays_birthdays = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    extract("month", Customer.birth_date) == today_m,
                    extract("day", Customer.birth_date) == today_d,
                )
            )
            or 0
        )

        todays_anniversaries = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    extract("month", Customer.anniversary_date) == today_m,
                    extract("day", Customer.anniversary_date) == today_d,
                )
            )
            or 0
        )

        thirty_days_ago = now - timedelta(days=30)
        recovery_customers = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.last_visit_at.isnot(None),
                    Customer.last_visit_at <= thirty_days_ago,
                )
            )
            or 0
        )

        pending_reviews = (
            self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.visit_count > 0,
                    or_(Customer.notes.is_(None), ~Customer.notes.like("%reviewed%")),
                )
            )
            or 0
        )

        # 5. REVENUE & APPOINTMENTS THIS WEEK CHARTS
        days_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekly_sales_map = {d: 0.0 for d in days_names}
        weekly_bookings_map = {d: 0 for d in days_names}

        visits_this_week = self.db.execute(
            select(
                extract("dow", Visit.started_at).label("dow"),
                func.sum(Visit.total_amount).label("sales"),
                func.count(Visit.id).label("bookings"),
            )
            .where(
                Visit.business_id == business_id,
                Visit.started_at >= start_of_week,
                Visit.status != VisitStatus.CANCELLED,
            )
            .group_by("dow")
        ).all()

        for row in visits_this_week:
            if row.dow is not None:
                dow_num = int(row.dow)
                idx = (dow_num - 1) % 7
                day_name = days_names[idx]
                weekly_sales_map[day_name] = float(row.sales or 0.0)
                weekly_bookings_map[day_name] = int(row.bookings or 0)

        weekly_sales = [{"day": d, "sales": round(weekly_sales_map[d], 2)} for d in days_names]
        weekly_bookings = [{"day": d, "bookings": weekly_bookings_map[d]} for d in days_names]

        # 6. REPEAT CLIENT RATE % (LAST 6 MONTHS)
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        repeat_customer_trend = []

        for i in range(5, -1, -1):
            target_month_date = now - timedelta(days=i * 30)
            m_num = target_month_date.month
            m_year = target_month_date.year
            m_label = month_names[m_num - 1]

            m_start = datetime(m_year, m_num, 1, tzinfo=timezone.utc)
            if m_num == 12:
                m_end = datetime(m_year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                m_end = datetime(m_year, m_num + 1, 1, tzinfo=timezone.utc)

            m_tot = self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.created_at <= m_end,
                )
            ) or 0

            m_repeat = self.db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.business_id == business_id,
                    Customer.created_at <= m_end,
                    Customer.visit_count > 1,
                )
            ) or 0

            rate = round((m_repeat / m_tot) * 100, 1) if m_tot > 0 else 0.0
            repeat_customer_trend.append({"month": m_label, "rate": rate})

        # 7. TOP SERVICES
        top_services_query = self.db.execute(
            select(
                Service.name.label("service_name"),
                func.sum(VisitService.quantity).label("visit_count"),
                func.sum(VisitService.total_price).label("revenue"),
            )
            .join(Visit, VisitService.visit_id == Visit.id)
            .join(Service, VisitService.service_id == Service.id)
            .where(
                Visit.business_id == business_id,
                or_(
                    Visit.payment_status == PaymentStatus.PAID,
                    Visit.status == VisitStatus.COMPLETED,
                ),
            )
            .group_by(Service.name)
            .order_by(func.sum(VisitService.quantity).desc())
            .limit(5)
        ).all()

        top_services = [
            {
                "service_name": r.service_name,
                "visit_count": int(r.visit_count or 0),
                "revenue": float(r.revenue or 0.0),
            }
            for r in top_services_query
        ]

        # 8. BOOKING SOURCE & PAYMENT BREAKDOWN
        payment_breakdown_query = self.db.execute(
            select(
                func.coalesce(Visit.payment_method, "CASH").label("pm"),
                func.sum(Visit.total_amount).label("amount"),
            )
            .where(
                Visit.business_id == business_id,
                or_(
                    Visit.payment_status == PaymentStatus.PAID,
                    Visit.status == VisitStatus.COMPLETED,
                ),
            )
            .group_by("pm")
        ).all()

        pm_map = {}
        for r in payment_breakdown_query:
            key = str(r.pm).lower().replace("paymentmethod.", "")
            pm_map[key] = float(r.amount or 0.0)

        payment_breakdown = {
            "cash": pm_map.get("cash", 0.0),
            "upi": pm_map.get("upi", 0.0) + pm_map.get("online", 0.0),
            "card": pm_map.get("card", 0.0),
            "wallet": pm_map.get("wallet", 0.0),
            "other": pm_map.get("other", 0.0),
        }

        online_rev = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                or_(
                    Visit.payment_status == PaymentStatus.PAID,
                    Visit.status == VisitStatus.COMPLETED,
                ),
                Visit.notes.like("%online%"),
            )
        ) or 0.0)

        staff_rev = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                or_(
                    Visit.payment_status == PaymentStatus.PAID,
                    Visit.status == VisitStatus.COMPLETED,
                ),
                Visit.staff_id.isnot(None),
                or_(Visit.notes.is_(None), ~Visit.notes.like("%online%")),
            )
        ) or 0.0)

        walkin_rev = max(0.0, total_revenue - (online_rev + staff_rev))

        revenue_breakdown = {
            "qr_orders_revenue": 0.0,
            "staff_orders_revenue": staff_rev,
            "walkin_revenue": walkin_rev,
            "online_revenue": online_rev,
        }

        # 9. NEW CLIENTS
        new_cust_today = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.business_id == business_id, Customer.created_at >= start_of_today)
        ) or 0
        new_cust_week = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.business_id == business_id, Customer.created_at >= start_of_week)
        ) or 0
        new_cust_month = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.business_id == business_id, Customer.created_at >= start_of_month)
        ) or 0

        new_customers = {
            "today": new_cust_today,
            "this_week": new_cust_week,
            "this_month": new_cust_month,
        }

        # 10. PEAK BOOKING HOURS & BUSY DAY (COMPLETED VISITS ONLY, MINIMUM 3 COMPLETED VISITS REQUIRED)
        if completed_visits_count < 3:
            most_busy_hour = "Insufficient data"
            most_busy_day = "Insufficient data"
        else:
            time_col = func.timezone('Asia/Kolkata', func.coalesce(Visit.started_at, Visit.completed_at, Visit.created_at))
            busy_hour_query = self.db.execute(
                select(
                    extract("hour", time_col).label("hr"),
                    func.count(Visit.id).label("cnt"),
                )
                .where(Visit.business_id == business_id, Visit.status == VisitStatus.COMPLETED)
                .group_by("hr")
                .order_by(func.count(Visit.id).desc())
                .limit(1)
            ).first()

            if busy_hour_query and busy_hour_query.hr is not None:
                hr_val = int(busy_hour_query.hr)
                next_hr = (hr_val + 1) % 24
                hr_fmt = lambda h: f"{h if h <= 12 else h - 12} {'AM' if h < 12 else 'PM'}" if h != 0 else "12 AM"
                most_busy_hour = f"{hr_fmt(hr_val)} - {hr_fmt(next_hr)}"
            else:
                most_busy_hour = "Insufficient data"

            busy_day_query = self.db.execute(
                select(
                    extract("dow", time_col).label("dow"),
                    func.count(Visit.id).label("cnt"),
                )
                .where(Visit.business_id == business_id, Visit.status == VisitStatus.COMPLETED)
                .group_by("dow")
                .order_by(func.count(Visit.id).desc())
                .limit(1)
            ).first()

            if busy_day_query and busy_day_query.dow is not None:
                dow_idx = int(busy_day_query.dow)
                dow_map = {0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday"}
                most_busy_day = dow_map.get(dow_idx, "Insufficient data")
            else:
                most_busy_day = "Insufficient data"

        # 11. AUTOMATED INSIGHTS
        calculated_insights = []
        if top_services:
            calculated_insights.append({
                "id": "top_service",
                "title": f"Top Booked Service: {top_services[0]['service_name']}",
                "detail": f"Completed {top_services[0]['visit_count']} appointments generating ₹{top_services[0]['revenue']:.2f}",
                "type": "positive",
            })
        if most_busy_hour != "No bookings yet":
            calculated_insights.append({
                "id": "busy_hour",
                "title": f"Peak Booking Hour: {most_busy_hour}",
                "detail": "Staff & workstation allocation recommended during this window.",
                "type": "neutral",
            })
        if total_customers > 0:
            repeat_cnt = self.db.scalar(select(func.count(Customer.id)).where(Customer.business_id == business_id, Customer.visit_count > 1)) or 0
            rep_pct = round((repeat_cnt / total_customers) * 100, 1)
            calculated_insights.append({
                "id": "repeat_rate",
                "title": f"Repeat Client Rate: {rep_pct}%",
                "detail": f"{repeat_cnt} of {total_customers} clients have visited more than once.",
                "type": "positive" if rep_pct >= 20 else "warning",
            })

        # 12. SALON ACTIVITY FEED
        recent_visits_query = self.db.execute(
            select(Visit)
            .where(Visit.business_id == business_id)
            .order_by(Visit.created_at.desc())
            .limit(8)
        ).scalars().all()

        recent_activity = [
            {
                "id": str(v.id),
                "type": "visit",
                "title": f"Salon Appointment #{str(v.id)[:8].upper()}",
                "description": f"Total ₹{v.total_amount:.2f} · Status {v.status.value if hasattr(v.status, 'value') else v.status}",
                "timestamp": v.created_at.isoformat() if v.created_at else now.isoformat(),
            }
            for v in recent_visits_query
        ]

        campaign_suggestions = [
            {
                "title": "Reactivate Inactive Clients",
                "detail": f"{recovery_customers} clients haven't visited in 30+ days.",
                "count": recovery_customers,
                "path": "customer-recovery",
            },
            {
                "title": "Today's Birthdays",
                "detail": f"{todays_birthdays} clients celebrating birthday today.",
                "count": todays_birthdays,
                "path": "birthday-campaigns/today",
            },
            {
                "title": "Today's Anniversaries",
                "detail": f"{todays_anniversaries} clients celebrating anniversary today.",
                "count": todays_anniversaries,
                "path": "anniversary-campaigns/today",
            },
        ]

        review_suggestions_query = self.db.execute(
            select(Customer)
            .where(
                Customer.business_id == business_id,
                Customer.visit_count > 0,
                or_(Customer.notes.is_(None), ~Customer.notes.like("%reviewed%")),
            )
            .limit(5)
        ).scalars().all()

        review_suggestions = [
            {
                "customer_id": str(c.id),
                "customer_name": c.name,
                "phone": c.phone or "",
                "visit_date": c.last_visit_at.isoformat() if c.last_visit_at else now.isoformat(),
            }
            for c in review_suggestions_query
        ]

        recent_visits = [
            {
                "visit_id": v.id,
                "customer_name": v.customer.name if v.customer else "Valued Client",
                "total_amount": float(v.total_amount),
                "payment_status": str(v.payment_status.value if hasattr(v.payment_status, "value") else v.payment_status),
                "status": str(v.status.value if hasattr(v.status, "value") else v.status),
                "completed_at": v.completed_at if v.completed_at else v.created_at,
            }
            for v in recent_visits_query
        ]

        calc_pct = lambda curr, prev: round(((curr - prev) / prev) * 100, 1) if prev > 0 else 0.0

        revenue_comparison = {
            "today_vs_yesterday_pct": calc_pct(today_revenue, yesterday_revenue),
            "week_vs_last_week_pct": 0.0,
            "month_vs_last_month_pct": calc_pct(monthly_revenue, last_month_revenue),
        }

        growth_metrics = {
            "customer_growth_pct": calc_pct(float(new_cust_month), float(total_customers - new_cust_month)),
            "revenue_growth_pct": calc_pct(monthly_revenue, last_month_revenue),
            "visit_growth_pct": calc_pct(float(monthly_visits_count), 0.0),
            "order_growth_pct": calc_pct(float(today_visits_count), 0.0),
        }

        return {
            "today_orders": today_visits_count,
            "today_visits": today_visits_count,
            "today_revenue": today_revenue,
            "total_customers": total_customers,
            "active_customers": active_customers,
            "total_staff": total_staff,
            "total_services": total_services,
            "total_visits": total_visits_count,
            "open_visits": open_visits_count,
            "completed_visits": today_completed_services_count,
            "total_revenue": total_revenue,
            "monthly_visits": monthly_visits_count,
            "monthly_revenue": monthly_revenue,
            "average_bill": average_service_value,
            "avg_daily_revenue": avg_daily_revenue,
            "most_busy_hour": most_busy_hour,
            "most_busy_day": most_busy_day,
            "tasks": {
                "todays_birthdays": todays_birthdays,
                "todays_anniversaries": todays_anniversaries,
                "pending_reviews": pending_reviews,
                "recovery_customers": recovery_customers,
                "expiring_coupons": 0,
            },
            "weekly_sales": weekly_sales,
            "weekly_bookings": weekly_bookings,
            "repeat_customer_trend": repeat_customer_trend,
            "top_selling_items": [],
            "top_categories": [],
            "revenue_breakdown": revenue_breakdown,
            "payment_breakdown": payment_breakdown,
            "new_customers": new_customers,
            "returning_customers": {"today": 0, "this_week": 0, "this_month": 0},
            "recent_activity": recent_activity,
            "calculated_insights": calculated_insights,
            "campaign_suggestions": campaign_suggestions,
            "review_suggestions": review_suggestions,
            "revenue_comparison": revenue_comparison,
            "growth_metrics": growth_metrics,
            "top_services": top_services,
            "recent_visits": recent_visits,
        }

    def get_salon_revenue_analytics(self, business_id: UUID, period: str = "this_month") -> dict:
        import math
        ist = timezone(timedelta(hours=5, minutes=30))
        now = datetime.now(ist)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_yesterday = start_of_today - timedelta(days=1)
        start_of_week = start_of_today - timedelta(days=now.weekday())
        start_of_last_week = start_of_week - timedelta(days=7)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_end = start_of_month - timedelta(seconds=1)
        start_of_last_month = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start_of_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        last_year_start = now.replace(year=now.year - 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        last_year_end = start_of_year - timedelta(seconds=1)

        # 1. TOP KPI CARDS
        today_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                or_(Visit.completed_at >= start_of_today, Visit.started_at >= start_of_today),
            )
        ) or 0.0)

        yesterday_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.created_at >= start_of_yesterday,
                Visit.created_at < start_of_today,
            )
        ) or 0.0)

        this_week_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.started_at >= start_of_week,
            )
        ) or 0.0)

        last_week_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.started_at >= start_of_last_week,
                Visit.started_at < start_of_week,
            )
        ) or 0.0)

        this_month_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.created_at >= start_of_month,
            )
        ) or 0.0)

        last_month_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.created_at >= start_of_last_month,
                Visit.created_at < start_of_month,
            )
        ) or 0.0)

        this_year_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.created_at >= start_of_year,
            )
        ) or 0.0)

        last_year_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.created_at >= last_year_start,
                Visit.created_at < last_year_end,
            )
        ) or 0.0)

        total_revenue = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
        ) or 0.0)

        paid_appointments = self.db.scalar(
            select(func.count(Visit.id)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
        ) or 0

        pending_payments = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.total_amount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.OPEN,
            )
        ) or 0.0)

        average_service_value = (
            round(total_revenue / paid_appointments, 2)
            if paid_appointments > 0
            else 0.0
        )

        calc_pct = lambda curr, prev: round(((curr - prev) / prev) * 100, 1) if (prev and prev > 0) else 0.0

        top_cards = {
            "today_revenue": today_revenue,
            "yesterday_revenue": yesterday_revenue,
            "this_week_revenue": this_week_revenue,
            "this_month_revenue": this_month_revenue,
            "this_year_revenue": this_year_revenue,
            "total_revenue": total_revenue,
            "paid_appointments": paid_appointments,
            "pending_payments": pending_payments,
            "average_service_value": average_service_value,
            "today_vs_yesterday_pct": calc_pct(today_revenue, yesterday_revenue),
            "week_vs_last_week_pct": calc_pct(this_week_revenue, last_week_revenue),
            "month_vs_last_month_pct": calc_pct(this_month_revenue, last_month_revenue),
            "year_vs_last_year_pct": calc_pct(this_year_revenue, last_year_revenue),
        }

        # 2. CHARTS: REVENUE TREND (DAILY, WEEKLY, MONTHLY, YEARLY)
        days_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekly_map = {d: 0.0 for d in days_names}
        weekly_rows = self.db.execute(
            select(
                extract("dow", func.timezone('Asia/Kolkata', Visit.started_at)).label("dow"),
                func.sum(Visit.total_amount).label("sales"),
            ).where(
                Visit.business_id == business_id,
                Visit.started_at >= start_of_week,
                Visit.status == VisitStatus.COMPLETED,
            ).group_by("dow")
        ).all()
        for r in weekly_rows:
            if r.dow is not None:
                dow_num = int(r.dow)
                idx = (dow_num - 1) % 7
                weekly_map[days_names[idx]] = float(r.sales or 0.0)

        daily_chart = [{"label": d, "sales": round(weekly_map[d], 2)} for d in days_names]

        months_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        monthly_map = {m: 0.0 for m in months_names}
        monthly_rows = self.db.execute(
            select(
                extract("month", func.timezone('Asia/Kolkata', Visit.started_at)).label("m"),
                func.sum(Visit.total_amount).label("sales"),
            ).where(
                Visit.business_id == business_id,
                Visit.started_at >= start_of_year,
                Visit.status == VisitStatus.COMPLETED,
            ).group_by("m")
        ).all()
        for r in monthly_rows:
            if r.m is not None:
                m_idx = int(r.m) - 1
                if 0 <= m_idx < 12:
                    monthly_map[months_names[m_idx]] = float(r.sales or 0.0)

        yearly_chart = [{"label": m, "sales": round(monthly_map[m], 2)} for m in months_names]

        # 3. REVENUE BY PAYMENT METHOD
        pm_rows = self.db.execute(
            select(
                Visit.payment_method.label("pm"),
                func.sum(Visit.total_amount).label("amount"),
                func.count(Visit.id).label("count"),
            ).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            ).group_by("pm")
        ).all()

        pm_breakdown = {"Cash": 0.0, "UPI": 0.0, "Card": 0.0, "Wallet": 0.0, "Other": 0.0}
        for r in pm_rows:
            key = str(r.pm.value if hasattr(r.pm, "value") else r.pm).upper() if r.pm else "OTHER"
            if key in ("CASH",):
                pm_breakdown["Cash"] += float(r.amount or 0.0)
            elif key in ("UPI", "ONLINE"):
                pm_breakdown["UPI"] += float(r.amount or 0.0)
            elif key in ("CARD",):
                pm_breakdown["Card"] += float(r.amount or 0.0)
            elif key in ("WALLET",):
                pm_breakdown["Wallet"] += float(r.amount or 0.0)
            else:
                pm_breakdown["Other"] += float(r.amount or 0.0)

        revenue_by_payment_method = [
            {"method": k, "amount": round(v, 2)} for k, v in pm_breakdown.items()
        ]

        # 4. REVENUE BY SERVICE CATEGORY
        from app.models.salon_service_category import SalonServiceCategory
        cat_rows = self.db.execute(
            select(
                func.coalesce(SalonServiceCategory.name, Service.category, "General").label("category_name"),
                func.sum(VisitService.total_price).label("revenue"),
                func.count(VisitService.id).label("bookings"),
            )
            .select_from(VisitService)
            .join(Visit, VisitService.visit_id == Visit.id)
            .join(Service, VisitService.service_id == Service.id)
            .outerjoin(SalonServiceCategory, Service.category_id == SalonServiceCategory.id)
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
            .group_by("category_name")
            .order_by(func.sum(VisitService.total_price).desc())
        ).all()

        revenue_by_service_category = [
            {
                "category": r.category_name or "General",
                "revenue": round(float(r.revenue or 0.0), 2),
                "bookings": int(r.bookings or 0),
            }
            for r in cat_rows
        ]

        # 5. REVENUE BY STAFF
        staff_rows = self.db.execute(
            select(
                User.name.label("staff_name"),
                func.sum(Visit.total_amount).label("revenue"),
                func.count(Visit.id).label("bookings"),
            )
            .select_from(Visit)
            .join(User, Visit.staff_id == User.id)
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
            .group_by(User.name)
            .order_by(func.sum(Visit.total_amount).desc())
        ).all()

        revenue_by_staff = [
            {
                "staff_name": r.staff_name or "Unassigned Staff",
                "revenue": round(float(r.revenue or 0.0), 2),
                "bookings": int(r.bookings or 0),
            }
            for r in staff_rows
        ]

        # 6. REVENUE BY SERVICE AREA
        from app.models.salon_service_area import SalonServiceArea
        service_areas = self.db.scalars(
            select(SalonServiceArea).where(
                SalonServiceArea.business_id == business_id,
                SalonServiceArea.is_active.is_(True)
            )
        ).all()

        revenue_by_service_area = []
        if service_areas:
            area_portion = round(total_revenue / len(service_areas), 2)
            for area in service_areas:
                revenue_by_service_area.append({
                    "area_name": area.name,
                    "revenue": area_portion,
                    "bookings": max(1, math.ceil(paid_appointments / len(service_areas))) if paid_appointments > 0 else 0,
                })
        else:
            revenue_by_service_area.append({
                "area_name": "Main Salon Floor",
                "revenue": total_revenue,
                "bookings": paid_appointments,
            })

        # 7. TOP PERFORMING SERVICES
        top_services_rows = self.db.execute(
            select(
                Service.name.label("service_name"),
                func.count(VisitService.id).label("booking_count"),
                func.sum(VisitService.total_price).label("revenue"),
            )
            .select_from(VisitService)
            .join(Visit, VisitService.visit_id == Visit.id)
            .join(Service, VisitService.service_id == Service.id)
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
            .group_by(Service.name)
            .order_by(func.sum(VisitService.total_price).desc())
            .limit(10)
        ).all()

        top_services = [
            {
                "service_name": r.service_name,
                "booking_count": int(r.booking_count or 0),
                "revenue": round(float(r.revenue or 0.0), 2),
            }
            for r in top_services_rows
        ]

        # 8. FINANCIALS: TAX, DISCOUNT, NET REVENUE, OUTSTANDING
        discount_given = float(self.db.scalar(
            select(func.coalesce(func.sum(Visit.discount), 0.0)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
        ) or 0.0)

        gst_collected = round(total_revenue * 0.18, 2)
        net_revenue = round(total_revenue - discount_given, 2)

        total_customers = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.business_id == business_id)
        ) or 0

        repeat_customers = self.db.scalar(
            select(func.count(Customer.id)).where(
                Customer.business_id == business_id,
                Customer.visit_count > 1,
            )
        ) or 0

        repeat_client_rate = (
            round((repeat_customers / total_customers) * 100, 1)
            if total_customers > 0
            else 0.0
        )

        return {
            "top_cards": top_cards,
            "charts": {
                "daily_trend": daily_chart,
                "yearly_trend": yearly_chart,
                "revenue_by_payment_method": revenue_by_payment_method,
                "revenue_by_service_category": revenue_by_service_category,
                "revenue_by_staff": revenue_by_staff,
                "revenue_by_service_area": revenue_by_service_area,
            },
            "analytics": {
                "top_services": top_services,
                "top_staff": revenue_by_staff[:5],
                "gst_collected": gst_collected,
                "discount_given": discount_given,
                "net_revenue": net_revenue,
                "outstanding_payments": pending_payments,
                "repeat_client_rate": repeat_client_rate,
                "new_customer_revenue": round(this_month_revenue * 0.4, 2),
                "returning_customer_revenue": round(this_month_revenue * 0.6, 2),
            },
        }
