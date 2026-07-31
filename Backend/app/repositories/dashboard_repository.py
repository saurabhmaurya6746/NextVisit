import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import extract, func, select, or_
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderItem, OrderStatus
from app.models.service import Service
from app.models.user import User
from app.models.visit import Visit, VisitService, VisitStatus
from app.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class DashboardRepository(BaseRepository):

    def get_full_dashboard_analytics(self, business_id: UUID) -> dict:
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
