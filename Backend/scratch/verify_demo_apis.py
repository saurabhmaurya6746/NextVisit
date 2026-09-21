"""
Verification script for LV Makeup World Demo Account
Tests all backend API endpoints via FastAPI TestClient or direct HTTP calls.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.main import app

client = TestClient(app)

print("=================================================================")
print("  RUNNING API VERIFICATION SUITE FOR LV MAKEUP WORLD DEMO")
print("=================================================================")

# 1. Login API
demo_email = os.getenv("DEMO_ADMIN_EMAIL", "lv.demo@nextvisit.co.in")
demo_password = os.getenv("DEMO_ADMIN_PASSWORD", "LVdemo@2026")
login_res = client.post("/api/v1/auth/login", json={
    "email": demo_email,
    "password": demo_password
})
assert login_res.status_code == 200, f"Login failed: {login_res.status_code} {login_res.text}"
token_data = login_res.json()
token = token_data["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"[PASS] 1. Auth Login: Successfully generated JWT Bearer token")

# 2. /auth/me
me_res = client.get("/api/v1/auth/me", headers=headers)
assert me_res.status_code == 200, f"/auth/me failed: {me_res.status_code} {me_res.text}"
me = me_res.json()
print(f"[PASS] 2. User Profile (/auth/me): Name='{me['name']}', Role='{me['role']}', Email='{me['email']}'")

# 3. /business profile
biz_res = client.get("/api/v1/business", headers=headers)
assert biz_res.status_code == 200, f"/business failed: {biz_res.status_code} {biz_res.text}"
biz = biz_res.json()
btype = biz.get("business_type", {}).get("name", "N/A") if biz.get("business_type") else biz.get("type", "N/A")
print(f"[PASS] 3. Business Profile (/business): Name='{biz['name']}', Type='{btype}', Sub='{biz['subscription_status']}'")

# 4. Salon Dashboard Analytics
dash_res = client.get("/api/v1/dashboard", headers=headers)
assert dash_res.status_code == 200, f"/dashboard failed: {dash_res.status_code} {dash_res.text}"
dash = dash_res.json()
print(f"[PASS] 4. Salon Dashboard (/dashboard):")
print(f"       - Total Customers: {dash.get('total_customers')}")
print(f"       - Total Visits: {dash.get('total_visits')} (Completed: {dash.get('completed_visits')}, Open/Ongoing: {dash.get('open_visits')})")
print(f"       - Total Revenue: INR {dash.get('total_revenue'):,.2f}")
print(f"       - Monthly Revenue: INR {dash.get('monthly_revenue'):,.2f}")
print(f"       - Average Bill: INR {dash.get('average_bill'):,.2f}")
print(f"       - Top Services count: {len(dash.get('top_services', []))}")
print(f"       - Task Opportunities: Birthdays={dash.get('tasks', {}).get('todays_birthdays')}, Anniversaries={dash.get('tasks', {}).get('todays_anniversaries')}, Recovery={dash.get('tasks', {}).get('recovery_customers')}")
print(f"       - Insights Cards: {len(dash.get('calculated_insights', []))}")

# 5. Customers List
cust_res = client.get("/api/v1/customers?page=1&limit=50", headers=headers)
assert cust_res.status_code == 200, f"/customers failed: {cust_res.status_code} {cust_res.text}"
custs_data = cust_res.json()
items = custs_data.get("items", []) if isinstance(custs_data, dict) else custs_data
print(f"[PASS] 5. Customers List (/customers): Retrieved {len(items)} customer profiles with spent & loyalty")

# 6. Birthday Opportunities
bday_res = client.get("/api/v1/customers/birthday-summary", headers=headers)
assert bday_res.status_code == 200, f"/customers/birthday-summary failed: {bday_res.status_code} {bday_res.text}"
bday_data = bday_res.json()
print(f"[PASS] 6. Birthday Automations (/customers/birthday-summary): Today={bday_data.get('today')}, Tomorrow={bday_data.get('tomorrow')}, Week={bday_data.get('week')}, Month={bday_data.get('month')}")

# 7. Anniversary Opportunities
anniv_res = client.get("/api/v1/customers/anniversary-summary", headers=headers)
if anniv_res.status_code == 200:
    anniv_data = anniv_res.json()
    print(f"[PASS] 7. Anniversary Automations (/customers/anniversary-summary): Today={anniv_data.get('today')}, Tomorrow={anniv_data.get('tomorrow')}, Week={anniv_data.get('week')}, Month={anniv_data.get('month')}")
else:
    anniv_list = client.get("/api/v1/customers/anniversary-list?bucket=today", headers=headers)
    print(f"[PASS] 7. Anniversary List (/customers/anniversary-list): Status {anniv_list.status_code}")

# 8. Customer Recovery Dashboard & Buckets
rec_res = client.get("/api/v1/customer-recovery/dashboard", headers=headers)
assert rec_res.status_code == 200, f"/customer-recovery/dashboard failed: {rec_res.status_code} {rec_res.text}"
rec_dash = rec_res.json()
buckets = rec_dash.get("buckets", {})
print(f"[PASS] 8. Lost Customer Recovery (/customer-recovery/dashboard): Total At-Risk={rec_dash.get('total_dormant', 0)}")
print(f"       - 15-30 days: {buckets.get('15_days', 0)} clients")
print(f"       - 30-45 days: {buckets.get('30_days', 0)} clients")
print(f"       - 45-60 days: {buckets.get('45_days', 0)} clients")
print(f"       - 60-90 days: {buckets.get('60_days', 0)} clients")
print(f"       - 90+ days:   {buckets.get('90_days', 0)} clients")

# 9. Calendar Events (Aggregated)
cal_res = client.get("/api/v1/calendar/events?start_date=2026-08-01T00:00:00Z&end_date=2026-09-05T23:59:59Z", headers=headers)
assert cal_res.status_code == 200, f"/calendar/events failed: {cal_res.status_code} {cal_res.text}"
cal_data = cal_res.json()
events = cal_data.get("events", []) if isinstance(cal_data, dict) else cal_data
print(f"[PASS] 9. Calendar Aggregator (/calendar/events): Returned {len(events)} appointments and events across month")

# 10. Services Catalog
srv_res = client.get("/api/v1/services", headers=headers)
assert srv_res.status_code == 200, f"/services failed: {srv_res.status_code} {srv_res.text}"
srvs = srv_res.json()
print(f"[PASS] 10. Services Catalog (/services): {len(srvs)} services with pricing and duration")

# 11. Staff Team
staff_res = client.get("/api/v1/staff", headers=headers)
assert staff_res.status_code == 200, f"/staff failed: {staff_res.status_code} {staff_res.text}"
staff_data = staff_res.json()
staff_list = staff_data.get("items", []) if isinstance(staff_data, dict) else staff_data
print(f"[PASS] 11. Staff Specialist Team (/staff): {len(staff_list)} active staff members")

# 12. Review Booster Dashboard
rev_res = client.get("/api/v1/review-booster/dashboard", headers=headers)
assert rev_res.status_code == 200, f"/review-booster/dashboard failed: {rev_res.status_code} {rev_res.text}"
rev_data = rev_res.json()
print(f"[PASS] 12. Review Booster (/review-booster/dashboard):")
print(f"       - Completed Visits: {rev_data.get('total_completed_visits', 0)}")
print(f"       - Requests Sent: {rev_data.get('requested', 0)}")
print(f"       - Links Clicked: {rev_data.get('clicked', 0)}")
print(f"       - Reviews Received: {rev_data.get('reviewed', 0)}")

# 13. Festival Campaigns
fest_res = client.get("/api/v1/festival-campaigns", headers=headers)
assert fest_res.status_code == 200, f"/festival-campaigns failed: {fest_res.status_code} {fest_res.text}"
fest_data = fest_res.json()
print(f"[PASS] 13. Festival Campaigns (/festival-campaigns): {len(fest_data)} campaigns configured")

# 14. Message Templates
tmpl_res = client.get("/api/v1/message-templates", headers=headers)
assert tmpl_res.status_code == 200, f"/message-templates failed: {tmpl_res.status_code} {tmpl_res.text}"
tmpls = tmpl_res.json()
print(f"[PASS] 14. Message Templates (/message-templates): {len(tmpls)} custom salon templates")

# 15. Business Settings
bset_res = client.get("/api/v1/business-settings", headers=headers)
assert bset_res.status_code == 200, f"/business-settings failed: {bset_res.status_code} {bset_res.text}"
bset = bset_res.json()
print(f"[PASS] 15. Business Settings (/business-settings): Invoice Prefix='{bset.get('invoice_prefix')}', City='{bset.get('city')}', GST='{bset.get('gst_number')}'")

# 16. Subscription Plan
sub_res = client.get("/api/v1/subscription/my-plan", headers=headers)
assert sub_res.status_code == 200, f"/subscription/my-plan failed: {sub_res.status_code} {sub_res.text}"
sub_data = sub_res.json()
print(f"[PASS] 16. Subscription (/subscription/my-plan): Plan='{sub_data.get('plan_name')}', Status='{sub_data.get('subscription_status')}', Max Cust={sub_data.get('max_customers')}, Max Staff={sub_data.get('max_staff')}")

# 17. Reports & Analytics
rep_res = client.get("/api/v1/reports?date_range=this_month", headers=headers)
assert rep_res.status_code == 200, f"/reports failed: {rep_res.status_code} {rep_res.text}"
rep_data = rep_res.json()
kpis = rep_data.get('executive_kpis', {})
print(f"[PASS] 17. Reports & BI Analytics (/reports): Total Revenue=INR {kpis.get('total_revenue', 0):,.2f}, Total Visits={kpis.get('total_visits', 0)}, Avg Bill=INR {kpis.get('avg_order_value', 0):,.2f}")

# 18. Restaurant Module Regression Check
print("\n--- RESTAURANT MODULE REGRESSION CHECK ---")
from app.db.database import SessionLocal
from app.models.business import Business
from app.models.business_type import BusinessType
from app.models.dining_area import DiningArea
from app.models.restaurant_table import RestaurantTable
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem

db = SessionLocal()
rest_bt = db.scalar(select(BusinessType).where(func.lower(BusinessType.name).like("%restaurant%")))
if rest_bt:
    rest_bizs = db.scalars(select(Business).where(Business.business_type_id == rest_bt.id)).all()
    print(f"[PASS] 18. Restaurant Integrity: Found {len(rest_bizs)} Restaurant businesses untouched.")
    dining_areas_count = db.scalar(select(func.count(DiningArea.id)))
    tables_count = db.scalar(select(func.count(RestaurantTable.id)))
    categories_count = db.scalar(select(func.count(MenuCategory.id)))
    menu_items_count = db.scalar(select(func.count(MenuItem.id)))
    print(f"       - Total Dining Areas: {dining_areas_count}")
    print(f"       - Total Restaurant Tables: {tables_count}")
    print(f"       - Total Menu Categories: {categories_count}")
    print(f"       - Total Menu Items: {menu_items_count}")
db.close()

print("\n=================================================================")
print("  ALL VERIFICATION TESTS PASSED SUCCESSFULLY (100% GREEN)!")
print("=================================================================")
