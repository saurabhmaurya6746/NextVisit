from app.db.database import SessionLocal
from app.models.business_type import BusinessType
from app.models.subscription_plan import SubscriptionPlan
from app.models.business import Business
from app.models.user import User
from app.models.customer import Customer
from app.models.service import Service
from app.models.salon_service_category import SalonServiceCategory
from app.models.salon_service_area import SalonServiceArea
from app.models.salon_chair import SalonChair
from app.models.visit import Visit, VisitService
from app.models.calendar_event import CalendarEvent
from app.models.loyalty import LoyaltySettings, CustomerLoyalty
from app.models.campaign import Campaign, CampaignLog
from app.models.message_template import MessageTemplate
from app.models.vip_settings import VipSettings
from app.models.business_settings import BusinessSettings
from app.models.festival import Festival, FestivalCampaign

db = SessionLocal()

print("--- BUSINESS TYPES ---")
for bt in db.query(BusinessType).all():
    print(f"ID: {bt.id}, Name: {bt.name}")

print("\n--- SUBSCRIPTION PLANS ---")
for sp in db.query(SubscriptionPlan).all():
    print(f"ID: {sp.id}, Name: {sp.name}, Price: {sp.monthly_price}, Max Cust: {sp.max_customers}, Max Staff: {sp.max_staff}, Max Camp: {sp.max_campaigns_per_month}, AI Credits: {sp.monthly_ai_credits}, Features: {sp.features}")

print("\n--- SALON BUSINESSES ---")
salon_bts = db.query(BusinessType).filter(BusinessType.name.ilike("%salon%")).all()
salon_bt_ids = [bt.id for bt in salon_bts]
for b in db.query(Business).filter(Business.business_type_id.in_(salon_bt_ids)).all():
    print(f"Salon Biz: {b.name}, ID: {b.id}, Email: {b.email}, Phone: {b.phone}, Status: {b.status}, Sub Status: {b.subscription_status}")

db.close()
