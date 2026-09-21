import sys
import os
from datetime import datetime, timedelta, timezone

from app.db.database import SessionLocal
from app.models.business import Business
from app.models.customer import Customer
from app.models.visit import Visit, VisitStatus, PaymentMethod
from app.models.order import Order, OrderStatus, OrderSource
from app.models.user import User
from app.services.reports_service import ReportsService
from app.schemas.reports import ReportFilterParams

def run_loyalty_date_filter_test():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            print("No user found in database.")
            return

        biz_id = user.business_id
        customer = db.query(Customer).filter(Customer.business_id == biz_id).first()
        if not customer:
            print("No customer found for business.")
            return

        now = datetime.now(timezone.utc)
        today_dt = now.replace(hour=12, minute=0, second=0)
        yesterday_dt = (now - timedelta(days=1)).replace(hour=12, minute=0, second=0)
        
        first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0)
        last_month_dt = (first_of_this_month - timedelta(days=10)).replace(hour=12, minute=0, second=0)

        print(f"Testing for Business ID: {biz_id}")
        print(f"Dates -> Today: {today_dt}, Yesterday: {yesterday_dt}, Last Month: {last_month_dt}")

        # Clean up prior test visits/orders for clean run
        db.query(Visit).filter(Visit.notes == "__loyalty_test_visit__").delete()
        db.query(Order).filter(Order.notes == "__loyalty_test_order__").delete()
        db.commit()

        # Create test visits:
        # Today: 1000 total_amount -> 100 points
        v_today = Visit(
            business_id=biz_id,
            customer_id=customer.id,
            status=VisitStatus.COMPLETED,
            total_amount=1000.0,
            payment_method=PaymentMethod.CASH,
            created_at=today_dt,
            completed_at=today_dt,
            notes="__loyalty_test_visit__",
        )
        
        # Yesterday: 500 total_amount -> 50 points
        v_yesterday = Visit(
            business_id=biz_id,
            customer_id=customer.id,
            status=VisitStatus.COMPLETED,
            total_amount=500.0,
            payment_method=PaymentMethod.CASH,
            created_at=yesterday_dt,
            completed_at=yesterday_dt,
            notes="__loyalty_test_visit__",
        )

        # Last Month: 3000 total_amount -> 300 points
        v_last_month = Visit(
            business_id=biz_id,
            customer_id=customer.id,
            status=VisitStatus.COMPLETED,
            total_amount=3000.0,
            payment_method=PaymentMethod.CASH,
            created_at=last_month_dt,
            completed_at=last_month_dt,
            notes="__loyalty_test_visit__",
        )

        # Cancelled visit today (should be IGNORED): 2000 total_amount -> 0 points
        v_cancelled = Visit(
            business_id=biz_id,
            customer_id=customer.id,
            status=VisitStatus.CANCELLED,
            total_amount=2000.0,
            payment_method=PaymentMethod.CASH,
            created_at=today_dt,
            completed_at=today_dt,
            notes="__loyalty_test_visit__",
        )

        db.add_all([v_today, v_yesterday, v_last_month, v_cancelled])
        db.commit()

        svc = ReportsService(db)

        # 1. Test Today Filter
        res_today = svc.get_bi_reports_analytics(user, ReportFilterParams(date_range="today"))
        pts_today = res_today.kpi_summary.total_loyalty_points_earned
        print(f"TODAY Filter -> Loyalty Points: {pts_today}")

        # 2. Test Yesterday Filter
        res_yesterday = svc.get_bi_reports_analytics(user, ReportFilterParams(date_range="yesterday"))
        pts_yesterday = res_yesterday.kpi_summary.total_loyalty_points_earned
        print(f"YESTERDAY Filter -> Loyalty Points: {pts_yesterday}")

        # 3. Test Last 7 Days Filter
        res_7d = svc.get_bi_reports_analytics(user, ReportFilterParams(date_range="last_7_days"))
        pts_7d = res_7d.kpi_summary.total_loyalty_points_earned
        print(f"LAST 7 DAYS Filter -> Loyalty Points: {pts_7d}")

        # 4. Test Last Month Filter
        res_lm = svc.get_bi_reports_analytics(user, ReportFilterParams(date_range="last_month"))
        pts_lm = res_lm.kpi_summary.total_loyalty_points_earned
        print(f"LAST MONTH Filter -> Loyalty Points: {pts_lm}")

        # 5. Test Custom Range Filter
        start_str = (yesterday_dt - timedelta(hours=1)).isoformat()
        end_str = (today_dt + timedelta(hours=1)).isoformat()
        res_custom = svc.get_bi_reports_analytics(user, ReportFilterParams(date_range="custom", start_date=start_str, end_date=end_str))
        pts_custom = res_custom.kpi_summary.total_loyalty_points_earned
        print(f"CUSTOM RANGE Filter -> Loyalty Points: {pts_custom}")

        # Clean up test data
        db.query(Visit).filter(Visit.notes == "__loyalty_test_visit__").delete()
        db.commit()

    finally:
        db.close()

if __name__ == "__main__":
    run_loyalty_date_filter_test()
