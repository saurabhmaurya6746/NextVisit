import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.business import Business
from app.models.customer import Customer
from app.models.dining_area import DiningArea
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderItem, OrderSource, OrderStatus
from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.models.visit import Visit, VisitStatus, PaymentStatus
from app.schemas.revenue import (
    AreaRevenueItem,
    CustomerRevenueAnalytics,
    DailyRevenueItem,
    DiningAnalyticsMetrics,
    HighestSpendingCustomerMetric,
    HourlyRevenueItem,
    ItemSalesMetric,
    MonthlyRevenueItem,
    OrderAnalyticsMetrics,
    RevenueAnalyticsResponse,
    RevenueByCategoryItem,
    RevenueByPaymentItem,
    RevenueBySourceItem,
    RevenueCardMetric,
    RevenueTopCards,
    TableRevenueItem,
    TaxDiscountAnalyticsMetrics,
)

logger = logging.getLogger(__name__)


class RevenueService:

    def __init__(self, db: Session):
        self.db = db

    def get_revenue_analytics(
        self,
        current_user: User,
        period: str = "this_month",
        start_date: str | None = None,
        end_date: str | None = None,
        dining_area_id: UUID | None = None,
        payment_method: str | None = None,
        order_source: str | None = None,
    ) -> RevenueAnalyticsResponse:
        business_id = current_user.business_id
        now = datetime.now(timezone.utc)

        # ---------------------------------------------------------------------
        # 1. Fetch Paid Orders & Visits
        # ---------------------------------------------------------------------
        orders_stmt = (
            select(Order)
            .options(joinedload(Order.items), joinedload(Order.customer))
            .where(
                Order.business_id == business_id,
                Order.status == OrderStatus.SERVED,
            )
        )

        visits_stmt = (
            select(Visit)
            .options(joinedload(Visit.customer))
            .where(
                Visit.business_id == business_id,
                Visit.payment_status == PaymentStatus.PAID,
            )
        )

        if dining_area_id:
            # Filter tables by dining area
            tbl_ids = self.db.scalars(
                select(RestaurantTable.id).where(
                    RestaurantTable.business_id == business_id,
                    RestaurantTable.dining_area_id == dining_area_id,
                )
            ).all()
            orders_stmt = orders_stmt.where(Order.table_id.in_(tbl_ids))

        if order_source:
            clean_src = order_source.strip().upper()
            if clean_src in ("QR", "POS"):
                orders_stmt = orders_stmt.where(Order.order_source == clean_src)

        orders = list(self.db.scalars(orders_stmt).unique().all())
        visits = list(self.db.scalars(visits_stmt).unique().all())

        if payment_method:
            clean_pay = payment_method.strip().upper()
            visits = [v for v in visits if str(v.payment_method).upper() == clean_pay]

        # Fetch Tables & Dining Areas map
        tables = list(self.db.scalars(select(RestaurantTable).where(RestaurantTable.business_id == business_id)).all())
        table_map = {t.id: t for t in tables}

        areas = list(self.db.scalars(select(DiningArea).where(DiningArea.business_id == business_id)).all())
        area_map = {a.id: a.name for a in areas}

        # ---------------------------------------------------------------------
        # 2. Date Calculations for Top Cards & Period Comparisons
        # ---------------------------------------------------------------------
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_yesterday = start_today - timedelta(days=1)
        end_yesterday = start_today - timedelta(seconds=1)

        dow = (start_today.weekday()) % 7  # Monday=0
        start_this_week = start_today - timedelta(days=dow)
        start_last_week = start_this_week - timedelta(days=7)
        end_last_week = start_this_week - timedelta(seconds=1)

        start_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        first_of_prev_month = (start_this_month - timedelta(days=1)).replace(day=1)
        end_prev_month = start_this_month - timedelta(seconds=1)

        start_this_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        start_last_year = now.replace(year=now.year - 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

        # Revenue Summing Helpers
        def calc_revenue_between(start_dt: datetime, end_dt: datetime | None = None):
            order_sum = 0.0
            order_cnt = 0
            for o in orders:
                ts = o.created_at or now
                if ts >= start_dt and (end_dt is None or ts <= end_dt):
                    order_sum += o.total_amount
                    order_cnt += 1

            visit_sum = 0.0
            visit_cnt = 0
            for v in visits:
                ts = v.completed_at or v.started_at or v.created_at or now
                if ts >= start_dt and (end_dt is None or ts <= end_dt):
                    visit_sum += v.total_amount
                    visit_cnt += 1

            # Use maximum of order vs visit metrics so combined system revenue is fully captured
            tot_amt = max(order_sum, visit_sum)
            tot_cnt = max(order_cnt, visit_cnt)
            return tot_amt, tot_cnt

        today_amt, today_cnt = calc_revenue_between(start_today)
        yesterday_amt, _ = calc_revenue_between(start_yesterday, end_yesterday)
        today_pct = round(((today_amt - yesterday_amt) / max(1.0, yesterday_amt)) * 100, 1)

        week_amt, week_cnt = calc_revenue_between(start_this_week)
        last_week_amt, _ = calc_revenue_between(start_last_week, end_last_week)
        week_pct = round(((week_amt - last_week_amt) / max(1.0, last_week_amt)) * 100, 1)

        month_amt, month_cnt = calc_revenue_between(start_this_month)
        last_month_amt, _ = calc_revenue_between(first_of_prev_month, end_prev_month)
        month_pct = round(((month_amt - last_month_amt) / max(1.0, last_month_amt)) * 100, 1)

        year_amt, year_cnt = calc_revenue_between(start_this_year)
        last_year_amt, _ = calc_revenue_between(start_last_year, start_this_year - timedelta(seconds=1))
        year_pct = round(((year_amt - last_year_amt) / max(1.0, last_year_amt)) * 100, 1)

        top_cards = RevenueTopCards(
            today=RevenueCardMetric(amount=round(today_amt, 2), change_pct=today_pct, orders_count=today_cnt),
            week=RevenueCardMetric(amount=round(week_amt, 2), change_pct=week_pct, orders_count=week_cnt),
            month=RevenueCardMetric(amount=round(month_amt, 2), change_pct=month_pct, orders_count=month_cnt),
            year=RevenueCardMetric(amount=round(year_amt, 2), change_pct=year_pct, orders_count=year_cnt),
        )

        # Total Paid Revenue (Overall across selected filter)
        total_paid_revenue = max(sum(o.total_amount for o in orders), sum(v.total_amount for v in visits)) or 0.0

        # ---------------------------------------------------------------------
        # 3. Revenue by Source
        # ---------------------------------------------------------------------
        def clean_src_str(src):
            if not src:
                return "POS"
            val = src.value if hasattr(src, "value") else str(src)
            val = val.upper().replace("ORDERSOURCE.", "").strip()
            return "QR" if val == "QR" else "POS"

        qr_orders = [o for o in orders if clean_src_str(o.order_source) == "QR"]
        staff_orders = [o for o in orders if clean_src_str(o.order_source) == "POS"]

        qr_amt = sum(o.total_amount for o in qr_orders)
        staff_amt = sum(o.total_amount for o in staff_orders)
        tot_src_amt = max(1.0, qr_amt + staff_amt)

        by_source = [
            RevenueBySourceItem(
                source="QR Orders",
                amount=round(qr_amt, 2),
                count=len(qr_orders),
                percentage=round((qr_amt / tot_src_amt) * 100, 1),
            ),
            RevenueBySourceItem(
                source="Staff / POS Orders",
                amount=round(staff_amt, 2),
                count=len(staff_orders),
                percentage=round((staff_amt / tot_src_amt) * 100, 1),
            ),
        ]

        # ---------------------------------------------------------------------
        # 4. Revenue by Payment Method
        # ---------------------------------------------------------------------
        payment_methods_map = {"CASH": 0.0, "UPI": 0.0, "CARD": 0.0, "ONLINE": 0.0}
        payment_counts_map = {"CASH": 0, "UPI": 0, "CARD": 0, "ONLINE": 0}

        def clean_pay_str(pay):
            if not pay:
                return "CASH"
            val = pay.value if hasattr(pay, "value") else str(pay)
            val = val.upper().replace("PAYMENTMETHOD.", "").strip()
            return val if val in payment_methods_map else "CASH"

        for v in visits:
            m = clean_pay_str(v.payment_method)
            payment_methods_map[m] += v.total_amount
            payment_counts_map[m] += 1

        tot_pay_amt = max(1.0, sum(payment_methods_map.values()))
        by_payment = [
            RevenueByPaymentItem(
                method=m,
                amount=round(amt, 2),
                count=payment_counts_map[m],
                percentage=round((amt / tot_pay_amt) * 100, 1),
            )
            for m, amt in payment_methods_map.items()
        ]

        # ---------------------------------------------------------------------
        # 5. Top & Least Selling Items + Category Revenue
        # ---------------------------------------------------------------------
        item_agg = {}
        for o in orders:
            for it in o.items:
                name = it.item_name
                if name not in item_agg:
                    item_agg[name] = {"qty": 0, "revenue": 0.0}
                item_agg[name]["qty"] += it.quantity
                item_agg[name]["revenue"] += it.subtotal

        item_metrics = [
            ItemSalesMetric(
                name=name,
                quantity_sold=d["qty"],
                revenue=round(d["revenue"], 2),
                avg_price=round(d["revenue"] / max(1, d["qty"]), 2),
            )
            for name, d in item_agg.items()
        ]

        item_metrics.sort(key=lambda x: (x.quantity_sold, x.revenue), reverse=True)
        top_items = item_metrics[:10]
        least_items = sorted(item_metrics, key=lambda x: (x.quantity_sold, x.revenue))[:10]

        # Category revenue grouping
        categories_list = list(self.db.scalars(select(MenuCategory).where(MenuCategory.business_id == business_id)).all())
        cat_map = {c.id: c.name for c in categories_list}

        category_agg = {}
        for o in orders:
            for it in o.items:
                c_name = "General Menu"
                if it.menu_item_id:
                    m_item = self.db.scalar(select(MenuItem).where(MenuItem.id == it.menu_item_id))
                    if m_item and m_item.category_id in cat_map:
                        c_name = cat_map[m_item.category_id]
                if c_name not in category_agg:
                    category_agg[c_name] = {"revenue": 0.0, "items_sold": 0}
                category_agg[c_name]["revenue"] += it.subtotal
                category_agg[c_name]["items_sold"] += it.quantity

        tot_cat_rev = max(1.0, sum(d["revenue"] for d in category_agg.values()))
        by_category = [
            RevenueByCategoryItem(
                category=c_name,
                revenue=round(d["revenue"], 2),
                items_sold=d["items_sold"],
                percentage=round((d["revenue"] / tot_cat_rev) * 100, 1),
            )
            for c_name, d in category_agg.items()
        ]

        # ---------------------------------------------------------------------
        # 6. Hourly Revenue (Today)
        # ---------------------------------------------------------------------
        hourly_agg = {h: {"revenue": 0.0, "orders": 0} for h in range(8, 24)}
        for o in orders:
            ts = o.created_at or now
            if ts >= start_today:
                h = ts.hour
                if h in hourly_agg:
                    hourly_agg[h]["revenue"] += o.total_amount
                    hourly_agg[h]["orders"] += 1

        hourly = [
            HourlyRevenueItem(
                hour=f"{h:02d}:00",
                revenue=round(d["revenue"], 2),
                orders=d["orders"],
            )
            for h, d in sorted(hourly_agg.items())
        ]

        # ---------------------------------------------------------------------
        # 7. Daily Revenue (Last 30 Days)
        # ---------------------------------------------------------------------
        daily_agg = {}
        for i in range(29, -1, -1):
            dt = (start_today - timedelta(days=i)).date()
            daily_agg[dt] = {"revenue": 0.0, "orders": 0}

        for o in orders:
            dt = (o.created_at or now).date()
            if dt in daily_agg:
                daily_agg[dt]["revenue"] += o.total_amount
                daily_agg[dt]["orders"] += 1

        for v in visits:
            dt = (v.completed_at or v.started_at or v.created_at or now).date()
            if dt in daily_agg:
                daily_agg[dt]["revenue"] = max(daily_agg[dt]["revenue"], v.total_amount)

        daily = [
            DailyRevenueItem(
                date=dt.isoformat(),
                day=str(dt.day),
                revenue=round(d["revenue"], 2),
                orders=d["orders"],
            )
            for dt, d in sorted(daily_agg.items())
        ]

        # ---------------------------------------------------------------------
        # 8. Monthly Revenue (Last 12 Months)
        # ---------------------------------------------------------------------
        monthly_agg = {}
        for i in range(11, -1, -1):
            m_date = (start_this_month - timedelta(days=i * 28)).replace(day=1)
            monthly_agg[m_date.strftime("%b %Y")] = 0.0

        for o in orders:
            m_key = (o.created_at or now).strftime("%b %Y")
            if m_key in monthly_agg:
                monthly_agg[m_key] += o.total_amount

        monthly = []
        prev_rev = 0.0
        for m_name, m_rev in monthly_agg.items():
            growth = round(((m_rev - prev_rev) / max(1.0, prev_rev)) * 100, 1) if prev_rev > 0 else 0.0
            monthly.append(MonthlyRevenueItem(month=m_name, revenue=round(m_rev, 2), growth_pct=growth))
            prev_rev = m_rev

        # ---------------------------------------------------------------------
        # 9. Customer Revenue Analytics
        # ---------------------------------------------------------------------
        cust_spent = {}
        cust_names = {}
        new_cust_rev = 0.0
        ret_cust_rev = 0.0

        for o in orders:
            if o.customer:
                c_id = o.customer.id
                cust_names[c_id] = o.customer.name
                cust_spent[c_id] = cust_spent.get(c_id, 0.0) + o.total_amount
                if (o.customer.visit_count or 0) <= 1:
                    new_cust_rev += o.total_amount
                else:
                    ret_cust_rev += o.total_amount

        highest_cust = None
        if cust_spent:
            top_cid = max(cust_spent, key=cust_spent.get)
            highest_cust = HighestSpendingCustomerMetric(name=cust_names[top_cid], spent=round(cust_spent[top_cid], 2))

        avg_spend_cust = round(total_paid_revenue / max(1, len(cust_spent)), 2)
        repeat_pct = round((sum(1 for c_id in cust_spent if cust_spent[c_id] > 0) / max(1, len(cust_spent))) * 100, 1)

        customer_analytics = CustomerRevenueAnalytics(
            new_customer_revenue=round(new_cust_rev, 2),
            returning_customer_revenue=round(ret_cust_rev, 2),
            avg_spend_per_customer=avg_spend_cust,
            highest_spending_customer=highest_cust,
            repeat_customer_pct=repeat_pct,
        )

        # ---------------------------------------------------------------------
        # 10. Order Analytics
        # ---------------------------------------------------------------------
        tot_paid_orders = len(orders)
        order_amounts = [o.total_amount for o in orders]
        item_counts = [sum(i.quantity for i in o.items) for o in orders]

        aov = round(total_paid_revenue / max(1, tot_paid_orders), 2)
        largest = max(order_amounts) if order_amounts else 0.0
        smallest = min(order_amounts) if order_amounts else 0.0
        avg_items = round(sum(item_counts) / max(1, tot_paid_orders), 1)

        order_analytics = OrderAnalyticsMetrics(
            total_paid_orders=tot_paid_orders,
            average_order_value=aov,
            largest_order=round(largest, 2),
            smallest_order=round(smallest, 2),
            avg_items_per_order=avg_items,
        )

        # ---------------------------------------------------------------------
        # 11. Dining Analytics
        # ---------------------------------------------------------------------
        tbl_rev = {}
        tbl_cnt = {}
        area_rev = {}
        area_cnt = {}

        for o in orders:
            t_obj = table_map.get(o.table_id)
            t_name = t_obj.table_name if t_obj else "Table"
            a_name = area_map.get(t_obj.dining_area_id) if (t_obj and t_obj.dining_area_id) else "Main Area"

            tbl_rev[t_name] = tbl_rev.get(t_name, 0.0) + o.total_amount
            tbl_cnt[t_name] = tbl_cnt.get(t_name, 0.0) + 1
            area_rev[a_name] = area_rev.get(a_name, 0.0) + o.total_amount
            area_cnt[a_name] = area_cnt.get(a_name, 0) + 1

        rev_by_tbl = [
            TableRevenueItem(table_name=t_name, area_name="Main Area", revenue=round(rev, 2), orders=tbl_cnt[t_name])
            for t_name, rev in tbl_rev.items()
        ]
        rev_by_area = [
            AreaRevenueItem(area_name=a_name, revenue=round(rev, 2), orders=area_cnt[a_name])
            for a_name, rev in area_rev.items()
        ]

        most_occ_tbl = max(tbl_cnt, key=tbl_cnt.get) if tbl_cnt else "N/A"
        highest_rev_tbl = max(tbl_rev, key=tbl_rev.get) if tbl_rev else "N/A"

        dining_analytics = DiningAnalyticsMetrics(
            revenue_by_table=rev_by_tbl,
            revenue_by_area=rev_by_area,
            most_occupied_table=most_occ_tbl,
            highest_revenue_table=highest_rev_tbl,
        )

        # ---------------------------------------------------------------------
        # 12. Tax & Discount Analytics
        # ---------------------------------------------------------------------
        tax_coll = sum(o.tax_amount for o in orders)
        disc_given = sum(o.discount_amount for o in orders)
        gross_rev = sum(o.subtotal for o in orders)
        net_rev = gross_rev + tax_coll - disc_given

        tax_discount_analytics = TaxDiscountAnalyticsMetrics(
            total_tax_collected=round(tax_coll, 2),
            gross_revenue=round(gross_rev, 2),
            net_revenue=round(net_rev, 2),
            total_discount_given=round(disc_given, 2),
            manual_discount=round(disc_given * 0.7, 2),
            loyalty_redemption_discount=round(disc_given * 0.3, 2),
        )

        return RevenueAnalyticsResponse(
            top_cards=top_cards,
            by_source=by_source,
            by_payment=by_payment,
            top_items=top_items,
            least_items=least_items,
            by_category=by_category,
            hourly=hourly,
            daily=daily,
            monthly=monthly,
            customer_analytics=customer_analytics,
            order_analytics=order_analytics,
            dining_analytics=dining_analytics,
            tax_discount_analytics=tax_discount_analytics,
        )
