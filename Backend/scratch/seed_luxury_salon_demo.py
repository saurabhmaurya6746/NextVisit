"""
Seed Script: Luxury Salon Demo Account Setup ("LV Makeup World")
================================================================
Idempotent, database-driven population of the LV Makeup World demo salon account.

Features populated:
1. Business & Settings (LV Makeup World, Salon Type, South Extension Delhi, 18% GST, INR)
2. Admin / Owner Account (lv.demo@nextvisit.co.in / Configurable via DEMO_ADMIN_PASSWORD, email_verified=True)
3. Staff Members (6 active specialists: Lavika Gusain, Ananya Sharma, Mehak Kapoor, Riya Verma, Pooja Singh, Simran Kaur)
4. Service Categories, Service Areas, Workstation Chairs
5. 16 Realistic Salon Services with market-standard INR pricing and descriptions
6. 45+ Realistic Indian Customers with demographic diversity, birthday, anniversary, and recovery distributions
7. 85+ Historical Visits across 6 months (March 2026 - August 2026) with realistic payment methods and items
8. 28+ Appointments across past, today (Aug 20, 2026), and future 1-14 days
9. Synchronized Customer Lifetime Stats (total_spent, visit_count, last_visit_at)
10. Loyalty Program Settings & Customer Point Balances (120, 350, 675, 1200, 2450)
11. Birthday & Anniversary Automations, Opportunities, and Campaign Logs
12. Multi-Bucket Lost Customer Recovery Data (15-30d, 30-45d, 45-60d, 60-90d, 90+d)
13. 5 Festival Campaigns (Diwali, Karwa Chauth, Wedding Season, Valentine's, Festive Glam)
14. Review Booster records with tracking tokens, clicks, and 5-star completions
15. 7 Message Templates (Birthday, Anniversary, Reminder, Thank You, Recovery, Review, Festival)
16. Active Enterprise Subscription Plan Association
"""

import sys
import os
import uuid
import random
from datetime import datetime, date, time, timedelta, timezone

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import func, select, or_
from app.db.database import SessionLocal
from app.core.security import hash_password
from app.models.business_type import BusinessType
from app.models.subscription_plan import SubscriptionPlan
from app.models.business import Business, BusinessStatus
from app.models.business_settings import BusinessSettings
from app.models.vip_settings import VipSettings
from app.models.user import User
from app.models.customer import Customer
from app.models.service import Service
from app.models.salon_service_category import SalonServiceCategory
from app.models.salon_service_area import SalonServiceArea
from app.models.salon_chair import SalonChair
from app.models.visit import Visit, VisitService, VisitStatus, PaymentMethod, PaymentStatus
from app.models.calendar_event import CalendarEvent
from app.models.loyalty import LoyaltySettings, CustomerLoyalty
from app.models.campaign import Campaign, CampaignLog, CampaignType, TargetSegment, CampaignLogStatus
from app.models.message_template import MessageTemplate
from app.models.automation import AutomationRule, ScheduleType
from app.models.festival import Festival, FestivalCampaign


# Deterministic Seed Anchor Date
ANCHOR_NOW = datetime(2026, 8, 20, 15, 30, 0, tzinfo=timezone.utc)
ANCHOR_DATE = date(2026, 8, 20)
DEMO_LOGIN_EMAIL = os.getenv("DEMO_ADMIN_EMAIL", "lv.demo@nextvisit.co.in")
DEMO_RAW_PASSWORD = os.getenv("DEMO_ADMIN_PASSWORD", "LVdemo@2026")
DEMO_BIZ_EMAIL = os.getenv("DEMO_BUSINESS_EMAIL", "demo@lvmakeupworld.com")


def seed_salon_demo():
    db = SessionLocal()
    print("=================================================================")
    print("  STARTING LV MAKEUP WORLD SALON DEMO SEED")
    print("=================================================================")

    try:
        # -------------------------------------------------------------------
        # 1. FETCH BUSINESS TYPE & SUBSCRIPTION PLAN
        # -------------------------------------------------------------------
        salon_bt = db.scalar(
            select(BusinessType).where(func.lower(BusinessType.name).like("%salon%"))
        )
        if not salon_bt:
            print("Creating Salon BusinessType...")
            salon_bt = BusinessType(name="Salon")
            db.add(salon_bt)
            db.flush()

        enterprise_plan = db.scalar(
            select(SubscriptionPlan).where(func.upper(SubscriptionPlan.name) == "ENTERPRISE")
        )
        if not enterprise_plan:
            enterprise_plan = db.scalar(
                select(SubscriptionPlan).where(func.upper(SubscriptionPlan.name) == "PROFESSIONAL")
            )
        if not enterprise_plan:
            enterprise_plan = db.query(SubscriptionPlan).first()

        print(f"Using BusinessType: {salon_bt.name} ({salon_bt.id})")
        print(f"Using SubscriptionPlan: {enterprise_plan.name if enterprise_plan else 'None'}")

        # -------------------------------------------------------------------
        # 2. CREATE OR UPDATE BUSINESS
        # -------------------------------------------------------------------
        biz = db.scalar(
            select(Business).where(
                or_(
                    func.lower(Business.email) == DEMO_BIZ_EMAIL.lower(),
                    func.lower(Business.name) == "lv makeup world",
                )
            )
        )

        if not biz:
            print("Creating new Business: LV Makeup World")
            biz = Business(
                business_type_id=salon_bt.id,
                name="LV Makeup World",
                owner_name="Lavika Gusain",
                email=DEMO_BIZ_EMAIL,
                phone="+91 8595 634 491",
                country="India",
                currency="INR",
                timezone="Asia/Kolkata",
                address="Plot 12, Main Ring Road, South Extension Part II, New Delhi, Delhi 110049",
                status=BusinessStatus.ACTIVE.value,
                approved_at=datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
                is_active=True,
                is_deleted=False,
                subscription_status="active",
                subscription_plan_id=enterprise_plan.id if enterprise_plan else None,
                plan_expires_at=datetime(2027, 8, 20, 23, 59, 59, tzinfo=timezone.utc),
                subscription_notes="Luxury Demo Account - NextVisit Enterprise Tier",
            )
            db.add(biz)
            db.flush()
        else:
            print(f"Found existing Business: {biz.name} ({biz.id}) — Updating details")
            biz.business_type_id = salon_bt.id
            biz.name = "LV Makeup World"
            biz.owner_name = "Lavika Gusain"
            biz.email = DEMO_BIZ_EMAIL
            biz.phone = "+91 8595 634 491"
            biz.country = "India"
            biz.currency = "INR"
            biz.timezone = "Asia/Kolkata"
            biz.address = "Plot 12, Main Ring Road, South Extension Part II, New Delhi, Delhi 110049"
            biz.status = BusinessStatus.ACTIVE.value
            biz.approved_at = datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
            biz.is_active = True
            biz.is_deleted = False
            biz.subscription_status = "active"
            biz.subscription_plan_id = enterprise_plan.id if enterprise_plan else None
            biz.plan_expires_at = datetime(2027, 8, 20, 23, 59, 59, tzinfo=timezone.utc)
            biz.subscription_notes = "Luxury Demo Account - NextVisit Enterprise Tier"
            db.flush()

        biz_id = biz.id

        # -------------------------------------------------------------------
        # 3. CREATE OR UPDATE BUSINESS SETTINGS & VIP SETTINGS
        # -------------------------------------------------------------------
        settings = db.scalar(select(BusinessSettings).where(BusinessSettings.business_id == biz_id))
        if not settings:
            print("Creating BusinessSettings...")
            settings = BusinessSettings(
                business_id=biz_id,
                city="New Delhi",
                state="Delhi",
                gst_number="DEMO-GST-NOT-FOR-BILLING",
                opening_time="10:00 AM",
                closing_time="08:30 PM",
                website="https://www.lvmakeupworld.com",
                whatsapp_number="+918595634491",
                default_country_code="+91",
                default_message_signature="Warm regards,\nLV Makeup World Team",
                enable_whatsapp_campaigns=True,
                enable_welcome_messages=True,
                review_link="https://g.page/r/lvmakeupworld/review",
                maps_link="https://maps.google.com/?q=LV+Makeup+World+South+Extension+Delhi",
                booking_link="https://lvmakeupworld.nextvisit.co.in/book",
                invoice_prefix="LVMW-",
                invoice_footer="Thank you for choosing LV Makeup World for your luxury beauty transformation!",
                show_gst_on_invoice=True,
                show_qr_on_invoice=True,
                auto_print_invoice=False,
                receipt_paper_size="80mm",
                currency="INR",
                timezone="Asia/Kolkata",
                language="en",
                enable_gst=True,
                tax_percentage=18.0,
                price_includes_gst=False,
                service_charge=0.0,
                round_off_bill=True,
                recovery_enabled=True,
                recovery_buckets="15,30,45,60,90",
                recovery_cooldown_days=7,
                recovery_max_messages_per_day=100,
                recovery_window_days=30,
                review_booster_enabled=True,
                review_booster_cooldown_days=7,
                review_booster_auto_send=False,
                review_booster_ai_enabled=True,
                ai_default_tone="Luxury & Polite",
                ai_max_monthly_requests=1000,
                ai_requests_used_month=42,
                purchased_ai_credits=500,
            )
            db.add(settings)
        else:
            settings.city = "New Delhi"
            settings.state = "Delhi"
            settings.gst_number = "DEMO-GST-NOT-FOR-BILLING"
            settings.opening_time = "10:00 AM"
            settings.closing_time = "08:30 PM"
            settings.website = "https://www.lvmakeupworld.com"
            settings.whatsapp_number = "+918595634491"
            settings.invoice_prefix = "LVMW-"
            settings.enable_gst = True
            settings.tax_percentage = 18.0
            settings.recovery_enabled = True
            settings.recovery_buckets = "15,30,45,60,90"
            settings.review_booster_enabled = True

        vip_set = db.scalar(select(VipSettings).where(VipSettings.business_id == biz_id))
        if not vip_set:
            vip_set = VipSettings(
                business_id=biz_id,
                min_lifetime_spend=25000.0,
                min_visits=3,
                min_avg_bill=5000.0,
                rule_logic="ANY",
                is_active=True,
            )
            db.add(vip_set)

        loyalty_set = db.scalar(select(LoyaltySettings).where(LoyaltySettings.business_id == biz_id))
        if not loyalty_set:
            loyalty_set = LoyaltySettings(
                business_id=biz_id,
                points_per_amount=10.0,
                amount_required=100.0,
                redeem_rate=0.5,
                minimum_redeem_points=100,
                is_active=True,
            )
            db.add(loyalty_set)

        db.flush()

        # -------------------------------------------------------------------
        # 4. CREATE DEMO OWNER / ADMIN ACCOUNT
        # -------------------------------------------------------------------
        owner_user = db.scalar(
            select(User).where(
                or_(
                    func.lower(User.email) == DEMO_LOGIN_EMAIL.lower(),
                    (User.business_id == biz_id) & (func.lower(User.role) == "owner"),
                )
            )
        )

        all_perms = [
            "all", "dashboard", "customers", "appointments", "services", "team",
            "calendar", "marketing", "campaigns", "birthday_campaigns",
            "anniversary_campaigns", "customer_recovery", "festival_campaigns",
            "review_booster", "loyalty", "revenue", "invoices", "reports",
            "settings", "subscription", "vip", "templates"
        ]

        if not owner_user:
            print(f"Creating Admin/Owner User: {DEMO_LOGIN_EMAIL}")
            owner_user = User(
                business_id=biz_id,
                name="Lavika Gusain",
                email=DEMO_LOGIN_EMAIL,
                phone="+91 8595 634 491",
                designation="Founder / Senior Makeup Artist",
                login_id="LV-FOUNDER",
                hashed_password=hash_password(DEMO_RAW_PASSWORD),
                role="OWNER",
                status="ACTIVE",
                is_active=True,
                email_verified=True,
                email_verified_at=datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
                permissions=all_perms,
            )
            db.add(owner_user)
        else:
            print(f"Updating Admin/Owner User: {owner_user.email}")
            owner_user.business_id = biz_id
            owner_user.name = "Lavika Gusain"
            owner_user.email = DEMO_LOGIN_EMAIL
            owner_user.phone = "+91 8595 634 491"
            owner_user.designation = "Founder / Senior Makeup Artist"
            owner_user.login_id = "LV-FOUNDER"
            owner_user.hashed_password = hash_password(DEMO_RAW_PASSWORD)
            owner_user.role = "OWNER"
            owner_user.status = "ACTIVE"
            owner_user.is_active = True
            owner_user.email_verified = True
            owner_user.email_verified_at = datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
            owner_user.permissions = all_perms

        db.flush()

        # -------------------------------------------------------------------
        # 5. CREATE STAFF MEMBERS
        # -------------------------------------------------------------------
        staff_defs = [
            {
                "name": "Ananya Sharma",
                "email": "ananya.sharma@lvmakeupworld.com",
                "phone": "+91 98112 34501",
                "designation": "Senior Makeup Artist",
                "login_id": "LVMW-ANA-101",
            },
            {
                "name": "Mehak Kapoor",
                "email": "mehak.kapoor@lvmakeupworld.com",
                "phone": "+91 98713 45612",
                "designation": "Makeup Artist",
                "login_id": "LVMW-MEH-102",
            },
            {
                "name": "Riya Verma",
                "email": "riya.verma@lvmakeupworld.com",
                "phone": "+91 98994 56723",
                "designation": "Hair Stylist",
                "login_id": "LVMW-RIY-103",
            },
            {
                "name": "Pooja Singh",
                "email": "pooja.singh@lvmakeupworld.com",
                "phone": "+91 98105 67834",
                "designation": "Beauty Specialist",
                "login_id": "LVMW-POO-104",
            },
            {
                "name": "Simran Kaur",
                "email": "simran.kaur@lvmakeupworld.com",
                "phone": "+91 98736 78945",
                "designation": "Makeup Assistant",
                "login_id": "LVMW-SIM-105",
            },
        ]

        staff_map = {"Lavika Gusain": owner_user}
        for sd in staff_defs:
            st_user = db.scalar(
                select(User).where(
                    (User.business_id == biz_id) &
                    ((func.lower(User.email) == sd["email"].lower()) | (User.login_id == sd["login_id"]))
                )
            )
            if not st_user:
                st_user = User(
                    business_id=biz_id,
                    name=sd["name"],
                    email=sd["email"],
                    phone=sd["phone"],
                    designation=sd["designation"],
                    login_id=sd["login_id"],
                    hashed_password=hash_password(DEMO_RAW_PASSWORD),
                    role="STAFF",
                    status="ACTIVE",
                    is_active=True,
                    email_verified=True,
                    email_verified_at=datetime(2026, 2, 1, 10, 0, 0, tzinfo=timezone.utc),
                    permissions=["dashboard", "appointments", "customers", "services", "calendar"],
                )
                db.add(st_user)
                db.flush()
            else:
                st_user.name = sd["name"]
                st_user.designation = sd["designation"]
                st_user.phone = sd["phone"]
                st_user.status = "ACTIVE"
                st_user.is_active = True
                st_user.email_verified = True
            staff_map[sd["name"]] = st_user

        db.flush()
        print(f"Seeded {len(staff_map)} staff specialists (including Founder)")

        # -------------------------------------------------------------------
        # 6. SERVICE CATEGORIES, SERVICE AREAS, CHAIRS
        # -------------------------------------------------------------------
        cat_defs = [
            ("Bridal & Wedding", 1),
            ("HD & Airbrush Makeup", 2),
            ("Occasion & Party", 3),
            ("Hair & Draping", 4),
            ("Packages & Pre-Bridal", 5),
            ("Masterclass & Training", 6),
        ]

        cat_map = {}
        for cname, order in cat_defs:
            cat = db.scalar(
                select(SalonServiceCategory).where(
                    (SalonServiceCategory.business_id == biz_id) &
                    (SalonServiceCategory.name == cname)
                )
            )
            if not cat:
                cat = SalonServiceCategory(
                    business_id=biz_id,
                    name=cname,
                    display_order=order,
                    is_active=True,
                )
                db.add(cat)
                db.flush()
            cat_map[cname] = cat

        area_defs = [
            ("Bridal Suite", ["Bridal Chair 1", "Bridal Chair 2"]),
            ("HD Studio", ["HD Station 1", "HD Station 2"]),
            ("Styling Lounge", ["Hair Station 1", "Hair Station 2"]),
            ("Academy Wing", ["Training Station 1", "Training Station 2"]),
        ]

        for order, (aname, chairs) in enumerate(area_defs, 1):
            area = db.scalar(
                select(SalonServiceArea).where(
                    (SalonServiceArea.business_id == biz_id) &
                    (SalonServiceArea.name == aname)
                )
            )
            if not area:
                area = SalonServiceArea(
                    business_id=biz_id,
                    name=aname,
                    display_order=order,
                    is_active=True,
                )
                db.add(area)
                db.flush()

            for c_order, cname in enumerate(chairs, 1):
                chair = db.scalar(
                    select(SalonChair).where(
                        (SalonChair.business_id == biz_id) &
                        (SalonChair.service_area_id == area.id) &
                        (SalonChair.chair_name == cname)
                    )
                )
                if not chair:
                    chair = SalonChair(
                        business_id=biz_id,
                        service_area_id=area.id,
                        chair_name=cname,
                        chair_number=f"{aname[:3].upper()}-{c_order}",
                        workstation_type="Specialist Station",
                        status="Available",
                        display_order=c_order,
                        is_active=True,
                    )
                    db.add(chair)

        db.flush()

        # -------------------------------------------------------------------
        # 7. POPULATE 16 SALON SERVICES
        # -------------------------------------------------------------------
        service_defs = [
            ("Bridal Makeup", 25000.0, 180, "Bridal & Wedding",
             "Signature luxury bridal makeup with customized lash application, jewelry setting, and long-lasting waterproof finish."),
            ("Destination Wedding Makeup", 75000.0, 360, "Bridal & Wedding",
             "Full-day destination wedding package including morning ritual, pheras, reception touch-ups, and pre-event skin prep."),
            ("Celebrity Makeup", 35000.0, 180, "Bridal & Wedding",
             "High-profile red carpet & celebrity glam tailored for camera, studio lighting, and high-resolution photography."),
            ("Bridal Package", 45000.0, 300, "Packages & Pre-Bridal",
             "Complete luxury bridal makeover including HD bridal makeup, luxury hair design, saree/lehenga draping, and customized accessories styling."),
            ("Pre-Bridal Package", 22000.0, 240, "Packages & Pre-Bridal",
             "Comprehensive skin glow rituals, body polishing, luxury hair spa, and bespoke facial treatment for brides-to-be."),
            ("HD Makeup", 15000.0, 120, "HD & Airbrush Makeup",
             "Flawless High-Definition makeup with high-end international cosmetics for a camera-ready, seamless radiance."),
            ("Airbrush Makeup", 18000.0, 120, "HD & Airbrush Makeup",
             "Ultra-lightweight, 24-hour waterproof airbrush makeup delivering a velvet smooth, poreless porcelain skin look."),
            ("Reception Makeup", 12000.0, 90, "Occasion & Party",
             "Elegant evening reception makeup with radiant skin base, sculpted contouring, and statement lip/eye glam."),
            ("Engagement Makeup", 8000.0, 90, "Occasion & Party",
             "Soft glam engagement makeup featuring dewy glass-skin finish, subtle eye shimmer, and romantic hair styling."),
            ("Party Makeup", 4500.0, 60, "Occasion & Party",
             "Chic party makeup with glowing complexion, smoky/shimmer eye art, and long-wear setting mist for social occasions."),
            ("Fashion / Editorial Makeup", 10000.0, 120, "Occasion & Party",
             "Avant-garde editorial and fashion portfolio makeup crafted for magazine shoots, runways, and creative portfolios."),
            ("Makeup Trial", 2500.0, 60, "Bridal & Wedding",
             "One-on-one bridal consultation and half-face makeup trial to finalize shades, lash style, and bridal aesthetic."),
            ("Hair Styling", 3500.0, 45, "Hair & Draping",
             "Intricate bridal & party hair styling, romantic waves, structured updos, floral hair decoration, and extensions."),
            ("Saree Draping", 2000.0, 30, "Hair & Draping",
             "Expert saree and dupatta draping in classic, Gujarati, South Indian, Bengali, and contemporary cocktail styles."),
            ("Professional Makeup Training", 35000.0, 480, "Masterclass & Training",
             "Master certification course covering color theory, skin analysis, bridal techniques, airbrushing, and live models."),
            ("Beauty Workshop", 6500.0, 180, "Masterclass & Training",
             "Interactive self-grooming and beauty masterclass focusing on daily makeup, contouring, and eye techniques."),
        ]

        services_map = {}
        for sname, price, duration, cat_name, desc in service_defs:
            srv = db.scalar(
                select(Service).where(
                    (Service.business_id == biz_id) &
                    (Service.name == sname)
                )
            )
            cat_obj = cat_map.get(cat_name)
            if not srv:
                srv = Service(
                    business_id=biz_id,
                    name=sname,
                    price=price,
                    duration_minutes=duration,
                    category=cat_name,
                    category_id=cat_obj.id if cat_obj else None,
                    description=desc,
                    is_active=True,
                )
                db.add(srv)
                db.flush()
            else:
                srv.price = price
                srv.duration_minutes = duration
                srv.category = cat_name
                srv.category_id = cat_obj.id if cat_obj else None
                srv.description = desc
                srv.is_active = True
            services_map[sname] = srv

        db.flush()
        print(f"Seeded {len(services_map)} Salon Services with categories and pricing")

        # -------------------------------------------------------------------
        # 8. POPULATE 45 REALISTIC CUSTOMERS
        # -------------------------------------------------------------------
        # Carefully crafted customer dataset with intentional birthdays, anniversaries, and recovery profiles
        customer_profiles = [
            # 1-6: VIP High Spenders (multiple past visits, large bridal/packages)
            {"name": "Radhika Aggarwal", "phone": "+91 98101 23411", "email": "radhika.aggarwal@gmail.com", "gender": "Female",
             "dob": date(1994, 8, 20), "anniv": date(2021, 8, 20), "addr": "Greater Kailash I, New Delhi", "notes": "VIP Bride · Prefers Airbrush & Lavika Gusain", "tag": "VIP"},
            {"name": "Sneha Malhotra", "phone": "+91 98112 34522", "email": "sneha.malhotra@gmail.com", "gender": "Female",
             "dob": date(1996, 8, 20), "anniv": date(2023, 11, 14), "addr": "South Extension II, New Delhi", "notes": "VIP Client · Bridal & Reception packages completed", "tag": "VIP"},
            {"name": "Tanya Kapoor", "phone": "+91 98713 45633", "email": "tanya.kapoor@outlook.com", "gender": "Female",
             "dob": date(1995, 8, 20), "anniv": date(2022, 12, 10), "addr": "Vasant Vihar, New Delhi", "notes": "VIP · Regular for Cocktail & HD Makeup", "tag": "VIP"},
            {"name": "Priya Singhania", "phone": "+91 98994 56744", "email": "priya.singhania@yahoo.com", "gender": "Female",
             "dob": date(1993, 8, 21), "anniv": date(2020, 8, 21), "addr": "Defence Colony, New Delhi", "notes": "VIP Bride · Destination Wedding client (Jaipur)", "tag": "VIP"},
            {"name": "Kritika Khurana", "phone": "+91 98105 67855", "email": "kritika.k@gmail.com", "gender": "Female",
             "dob": date(1997, 8, 21), "anniv": None, "addr": "Hauz Khas Enclave, New Delhi", "notes": "VIP Fashion Influencer · Editorial & HD Makeup", "tag": "VIP"},
            {"name": "Ananya Roy", "phone": "+91 98736 78966", "email": "ananya.roy@gmail.com", "gender": "Female",
             "dob": date(1992, 8, 23), "anniv": date(2019, 8, 24), "addr": "Panchsheel Park, New Delhi", "notes": "VIP Bride · Regular client for family events", "tag": "VIP"},

            # 7-12: This Week / Month Celebrations
            {"name": "Roshni Mehra", "phone": "+91 98117 89077", "email": "roshni.mehra@gmail.com", "gender": "Female",
             "dob": date(1995, 8, 25), "anniv": None, "addr": "Saket, New Delhi", "notes": "Birthday upcoming · Inquired about party glam", "tag": "Active"},
            {"name": "Bhavna Joshi", "phone": "+91 98728 90188", "email": "bhavna.joshi@gmail.com", "gender": "Female",
             "dob": date(1998, 8, 26), "anniv": None, "addr": "Dwarka Sector 11, New Delhi", "notes": "Birthday this week · Student of Makeup workshop", "tag": "Active"},
            {"name": "Shweta Narang", "phone": "+91 98939 01299", "email": "shweta.narang@gmail.com", "gender": "Female",
             "dob": date(1991, 5, 12), "anniv": date(2018, 8, 20), "addr": "Punjabi Bagh, New Delhi", "notes": "Anniversary today · Booked evening hair & makeup", "tag": "Active"},
            {"name": "Barkha Saxena", "phone": "+91 98140 12310", "email": "barkha.saxena@outlook.com", "gender": "Female",
             "dob": date(1993, 10, 5), "anniv": date(2021, 8, 21), "addr": "Noida Sector 50, UP", "notes": "Anniversary tomorrow · Saree draping regular", "tag": "Active"},
            {"name": "Mansi Grover", "phone": "+91 98751 23421", "email": "mansi.grover@gmail.com", "gender": "Female",
             "dob": date(1996, 8, 14), "anniv": date(2022, 8, 24), "addr": "DLF Phase 5, Gurgaon", "notes": "Anniversary upcoming · Prefers HD Glam", "tag": "Active"},
            {"name": "Payal Oberoi", "phone": "+91 98962 34532", "email": "payal.oberoi@yahoo.com", "gender": "Female",
             "dob": date(1994, 8, 28), "anniv": date(2020, 8, 26), "addr": "Golf Course Road, Gurgaon", "notes": "Birthday & Anniversary both in August", "tag": "VIP"},

            # 13-22: Active & Recent Clients (Visited in last 1-14 days)
            {"name": "Natasha Sethi", "phone": "+91 98173 45643", "email": "natasha.sethi@gmail.com", "gender": "Female",
             "dob": date(1997, 4, 18), "anniv": None, "addr": "Chanakyapuri, New Delhi", "notes": "Recent party makeup client · Loved hair styling", "tag": "Active"},
            {"name": "Divya Batra", "phone": "+91 98784 56754", "email": "divya.batra@gmail.com", "gender": "Female",
             "dob": date(1995, 8, 10), "anniv": date(2021, 11, 28), "addr": "Green Park, New Delhi", "notes": "Regular guest · Prefers Mehak Kapoor", "tag": "Active"},
            {"name": "Pooja Ahuja", "phone": "+91 98995 67865", "email": "pooja.ahuja@outlook.com", "gender": "Female",
             "dob": date(1992, 8, 5), "anniv": None, "addr": "Model Town, New Delhi", "notes": "Bridal trial completed · Finalizing December wedding", "tag": "Active"},
            {"name": "Simran Chawla", "phone": "+91 98106 78976", "email": "simran.chawla@gmail.com", "gender": "Female",
             "dob": date(1998, 1, 15), "anniv": None, "addr": "Lajpat Nagar, New Delhi", "notes": "Completed Beauty Workshop", "tag": "Active"},
            {"name": "Rhea Sen", "phone": "+91 98717 89087", "email": "rhea.sen@gmail.com", "gender": "Female",
             "dob": date(1994, 9, 12), "anniv": None, "addr": "New Friends Colony, New Delhi", "notes": "Fashion model · Editorial makeup", "tag": "Active"},
            {"name": "Aakriti Taneja", "phone": "+91 98928 90198", "email": "aakriti.taneja@gmail.com", "gender": "Female",
             "dob": date(1996, 12, 4), "anniv": date(2023, 2, 14), "addr": "Vasant Kunj, New Delhi", "notes": "Engagement glam completed", "tag": "Active"},
            {"name": "Neha Chadha", "phone": "+91 98139 01209", "email": "neha.chadha@gmail.com", "gender": "Female",
             "dob": date(1993, 3, 22), "anniv": date(2019, 8, 12), "addr": "Sunder Nagar, New Delhi", "notes": "Loyalty advocate · Referred 3 brides", "tag": "VIP"},
            {"name": "Ritika Dewan", "phone": "+91 98740 12311", "email": "ritika.dewan@outlook.com", "gender": "Female",
             "dob": date(1995, 7, 30), "anniv": date(2021, 8, 8), "addr": "Civil Lines, New Delhi", "notes": "Pre-bridal package completed", "tag": "Active"},
            {"name": "Kavita Gill", "phone": "+91 98951 23422", "email": "kavita.gill@gmail.com", "gender": "Female",
             "dob": date(1991, 11, 19), "anniv": date(2017, 12, 1), "addr": "Sushant Lok, Gurgaon", "notes": "Saree draping & Hair styling regular", "tag": "Active"},
            {"name": "Meera Sen", "phone": "+91 98162 34533", "email": "meera.sen@gmail.com", "gender": "Female",
             "dob": date(1996, 6, 25), "anniv": None, "addr": "Safdarjung Enclave, New Delhi", "notes": "HD makeup for family wedding", "tag": "Active"},

            # 23-32: Recovery Segment (Engineered Last Visit Days)
            # 15-30 days ago (July 25 - Aug 4, 2026: ~16 to ~26 days)
            {"name": "Simran Bajwa", "phone": "+91 98773 45644", "email": "simran.bajwa@gmail.com", "gender": "Female",
             "dob": date(1995, 10, 14), "anniv": None, "addr": "Indirapuram, Ghaziabad", "notes": "Dormant (23d) · Last visit July 28 for Hair Styling", "tag": "Recovery_15"},
            {"name": "Alisha Merchant", "phone": "+91 98984 56755", "email": "alisha.m@outlook.com", "gender": "Female",
             "dob": date(1997, 2, 9), "anniv": None, "addr": "Noida Sector 62, UP", "notes": "Dormant (21d) · Last visit July 30 for Party Makeup", "tag": "Recovery_15"},

            # 30-45 days ago (July 6 - July 20, 2026: ~31 to ~45 days)
            {"name": "Shruti Bhardwaj", "phone": "+91 98195 67866", "email": "shruti.bhardwaj@gmail.com", "gender": "Female",
             "dob": date(1994, 5, 3), "anniv": date(2022, 11, 20), "addr": "Janakpuri, New Delhi", "notes": "Dormant (39d) · Last visit July 12 for HD Makeup", "tag": "Recovery_30"},
            {"name": "Kanika Goel", "phone": "+91 98706 78977", "email": "kanika.goel@gmail.com", "gender": "Female",
             "dob": date(1993, 9, 17), "anniv": None, "addr": "Pitampura, New Delhi", "notes": "Dormant (36d) · Last visit July 15 for Saree Draping", "tag": "Recovery_30"},

            # 45-60 days ago (June 21 - July 5, 2026: ~46 to ~60 days)
            {"name": "Garima Mathur", "phone": "+91 98917 89088", "email": "garima.mathur@gmail.com", "gender": "Female",
             "dob": date(1996, 3, 11), "anniv": date(2020, 10, 15), "addr": "Kailash Colony, New Delhi", "notes": "Dormant (54d) · Last visit June 27 for Hair & Makeup", "tag": "Recovery_45"},
            {"name": "Meera Chawla", "phone": "+91 98128 90199", "email": "meera.chawla@outlook.com", "gender": "Female",
             "dob": date(1992, 12, 29), "anniv": None, "addr": "Nirmal Vihar, New Delhi", "notes": "Dormant (51d) · Last visit June 30 for Party Glam", "tag": "Recovery_45"},

            # 60-90 days ago (May 22 - June 20, 2026: ~61 to ~90 days)
            {"name": "Sonia Duggal", "phone": "+91 98739 01210", "email": "sonia.duggal@gmail.com", "gender": "Female",
             "dob": date(1990, 7, 8), "anniv": date(2016, 5, 10), "addr": "Mayur Vihar Phase 1, New Delhi", "notes": "Dormant (73d) · Last visit June 8 for Engagement Glam", "tag": "Recovery_60"},
            {"name": "Tanvi Mittal", "phone": "+91 98940 12321", "email": "tanvi.mittal@gmail.com", "gender": "Female",
             "dob": date(1998, 4, 2), "anniv": None, "addr": "Rohini Sector 9, New Delhi", "notes": "Dormant (66d) · Last visit June 15 for Hair Styling", "tag": "Recovery_60"},

            # 90+ days ago (Feb - May 2026: 95 to 180 days)
            {"name": "Ritu Aggarwal", "phone": "+91 98151 23432", "email": "ritu.aggarwal@gmail.com", "gender": "Female",
             "dob": date(1989, 11, 24), "anniv": date(2014, 11, 28), "addr": "Shanti Niketan, New Delhi", "notes": "Lost Client (98d) · Last visit May 14 for Airbrush Makeup", "tag": "Recovery_90"},
            {"name": "Pallavi Sen", "phone": "+91 98762 34543", "email": "pallavi.sen@gmail.com", "gender": "Female",
             "dob": date(1994, 1, 19), "anniv": None, "addr": "Anand Niketan, New Delhi", "notes": "Lost Client (126d) · Last visit April 16 for Bridal Trial", "tag": "Recovery_90"},
            {"name": "Jaspreet Anand", "phone": "+91 98973 45654", "email": "jaspreet.anand@yahoo.com", "gender": "Female",
             "dob": date(1991, 6, 15), "anniv": date(2018, 2, 21), "addr": "Rajouri Garden, New Delhi", "notes": "Lost Client (180d) · Last visit Feb 21 for Reception Glam", "tag": "Recovery_90"},

            # 33-45: New & Upcoming Clients / Workshop Trainees
            {"name": "Ishita Saxena", "phone": "+91 98184 56765", "email": "ishita.saxena@gmail.com", "gender": "Female",
             "dob": date(1999, 9, 21), "anniv": None, "addr": "Noida Sector 128, UP", "notes": "New Bride · Booked November wedding package", "tag": "New"},
            {"name": "Apoorva Vats", "phone": "+91 98795 67876", "email": "apoorva.vats@gmail.com", "gender": "Female",
             "dob": date(1997, 11, 11), "anniv": None, "addr": "DLF Cybercity, Gurgaon", "notes": "New Client · Inquired about Airbrush Trial", "tag": "New"},
            {"name": "Surbhi Bansal", "phone": "+91 98906 78987", "email": "surbhi.bansal@outlook.com", "gender": "Female",
             "dob": date(1995, 2, 28), "anniv": None, "addr": "Paschim Vihar, New Delhi", "notes": "Enrolled in Professional Makeup Masterclass", "tag": "Active"},
            {"name": "Garima Seth", "phone": "+91 98117 89098", "email": "garima.seth@gmail.com", "gender": "Female",
             "dob": date(1993, 10, 18), "anniv": date(2020, 12, 14), "addr": "Faridabad Sector 15, Haryana", "notes": "Regular for Saree Draping & Party Makeover", "tag": "Active"},
            {"name": "Aditi Roy Choudhury", "phone": "+91 98728 90109", "email": "aditi.rc@gmail.com", "gender": "Female",
             "dob": date(1994, 6, 7), "anniv": None, "addr": "Chittaranjan Park, New Delhi", "notes": "Pre-Bridal customer for upcoming Durga Puja", "tag": "Active"},
            {"name": "Zoya Khan", "phone": "+91 98939 01220", "email": "zoya.khan@gmail.com", "gender": "Female",
             "dob": date(1996, 5, 29), "anniv": None, "addr": "Zakir Nagar, New Delhi", "notes": "Party Makeup & Hair Design client", "tag": "Active"},
            {"name": "Kiran Bedi Malhotra", "phone": "+91 98140 12331", "email": "kiran.bm@gmail.com", "gender": "Female",
             "dob": date(1990, 8, 31), "anniv": date(2015, 10, 20), "addr": "Golf Links, New Delhi", "notes": "VIP Diplomatic Client · Celebrity & Red Carpet style", "tag": "VIP"},
            {"name": "Mahira Sharma", "phone": "+91 98751 23442", "email": "mahira.sharma@outlook.com", "gender": "Female",
             "dob": date(1998, 7, 14), "anniv": None, "addr": "Noida Sector 93, UP", "notes": "Attended 1-Day Self Makeup Workshop", "tag": "New"},
            {"name": "Tarini Khanna", "phone": "+91 98962 34553", "email": "tarini.khanna@gmail.com", "gender": "Female",
             "dob": date(1995, 4, 10), "anniv": None, "addr": "Sohna Road, Gurgaon", "notes": "Cocktail glam specialist fan", "tag": "Active"},
            {"name": "Prerna Kaul", "phone": "+91 98173 45664", "email": "prerna.kaul@gmail.com", "gender": "Female",
             "dob": date(1992, 1, 30), "anniv": date(2018, 11, 23), "addr": "Alaknanda, New Delhi", "notes": "Frequent hair spa & saree draping client", "tag": "Active"},
            {"name": "Esha Deol Puri", "phone": "+91 98784 56775", "email": "esha.puri@gmail.com", "gender": "Female",
             "dob": date(1997, 8, 19), "anniv": None, "addr": "Gulmohar Park, New Delhi", "notes": "Birthday was yesterday (Aug 19) · Visited for birthday makeover", "tag": "Active"},
        ]

        cust_map = {}
        for cdata in customer_profiles:
            c = db.scalar(
                select(Customer).where(
                    (Customer.business_id == biz_id) &
                    (Customer.phone == cdata["phone"])
                )
            )
            if not c:
                c = Customer(
                    business_id=biz_id,
                    name=cdata["name"],
                    phone=cdata["phone"],
                    email=cdata["email"],
                    gender=cdata["gender"],
                    birth_date=cdata["dob"],
                    anniversary_date=cdata["anniv"],
                    address=cdata["addr"],
                    notes=cdata["notes"],
                    visit_count=0,
                    total_spent=0.0,
                    is_active=True,
                )
                db.add(c)
                db.flush()
            else:
                c.name = cdata["name"]
                c.email = cdata["email"]
                c.gender = cdata["gender"]
                c.birth_date = cdata["dob"]
                c.anniversary_date = cdata["anniv"]
                c.address = cdata["addr"]
                c.notes = cdata["notes"]
                c.is_active = True
            cust_map[cdata["name"]] = c

        db.flush()
        print(f"Seeded {len(cust_map)} Customers with comprehensive profiles & anniversary/birthday data")

        # -------------------------------------------------------------------
        # 9. HISTORICAL VISITS ENGINE (March 2026 - August 2026)
        # -------------------------------------------------------------------
        # Wipe previous demo visits/appointments cleanly for idempotency
        existing_visits = db.scalars(select(Visit).where(Visit.business_id == biz_id)).all()
        for ev in existing_visits:
            db.delete(ev)
        db.flush()

        existing_events = db.scalars(select(CalendarEvent).where(CalendarEvent.business_id == biz_id)).all()
        for ee in existing_events:
            db.delete(ee)
        db.flush()

        # Define structured visit schedules across the 6-month operating timeline
        # Month offsets from ANCHOR_DATE (2026-08-20)
        # Each visit contains: (customer_name, service_name, staff_name, date_dt, payment_method, is_completed, notes)
        visit_schedule = [
            # MARCH 2026 (14 visits)
            ("Radhika Aggarwal", "Makeup Trial", "Lavika Gusain", datetime(2026, 3, 5, 11, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Bridal consultation and full face trial"),
            ("Radhika Aggarwal", "Pre-Bridal Package", "Pooja Singh", datetime(2026, 3, 12, 14, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Glow ritual skin prep"),
            ("Sneha Malhotra", "Makeup Trial", "Ananya Sharma", datetime(2026, 3, 8, 12, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Half face trial for engagement look"),
            ("Priya Singhania", "Destination Wedding Makeup", "Lavika Gusain", datetime(2026, 3, 15, 9, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Destination wedding in Jaipur - Full day package"),
            ("Kritika Khurana", "Fashion / Editorial Makeup", "Lavika Gusain", datetime(2026, 3, 18, 15, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Magazine cover photoshoot glam"),
            ("Jaspreet Anand", "Reception Makeup", "Ananya Sharma", datetime(2026, 2, 21, 16, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Reception evening look (180 days ago)"),
            ("Surbhi Bansal", "Professional Makeup Training", "Lavika Gusain", datetime(2026, 3, 20, 10, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Full day masterclass training session"),
            ("Divya Batra", "Party Makeup", "Mehak Kapoor", datetime(2026, 3, 22, 17, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Cocktail party glam"),
            ("Shweta Narang", "Hair Styling", "Riya Verma", datetime(2026, 3, 25, 13, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Romantic textured waves"),
            ("Kavita Gill", "Saree Draping", "Riya Verma", datetime(2026, 3, 25, 14, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Classic pleated saree drape"),
            ("Neha Chadha", "HD Makeup", "Ananya Sharma", datetime(2026, 3, 28, 16, 30, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Family anniversary dinner makeup"),
            ("Tanya Kapoor", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 3, 29, 15, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "High-glam red carpet finish"),

            # APRIL 2026 (15 visits)
            ("Pallavi Sen", "Makeup Trial", "Mehak Kapoor", datetime(2026, 4, 16, 11, 30, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Bridal trial (126 days ago)"),
            ("Radhika Aggarwal", "Bridal Package", "Lavika Gusain", datetime(2026, 4, 18, 10, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Complete luxury bridal makeover"),
            ("Sneha Malhotra", "Engagement Makeup", "Ananya Sharma", datetime(2026, 4, 20, 14, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Dewy engagement look"),
            ("Ananya Roy", "Bridal Makeup", "Lavika Gusain", datetime(2026, 4, 22, 10, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Luxury bridal styling & jewelry setting"),
            ("Payal Oberoi", "HD Makeup", "Ananya Sharma", datetime(2026, 4, 24, 16, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Evening reception HD glam"),
            ("Natasha Sethi", "Party Makeup", "Mehak Kapoor", datetime(2026, 4, 25, 17, 30, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Celebration party makeup"),
            ("Pooja Ahuja", "Makeup Trial", "Ananya Sharma", datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Bridal eye makeup and base trial"),
            ("Simran Chawla", "Beauty Workshop", "Lavika Gusain", datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Self-grooming masterclass"),
            ("Rhea Sen", "Fashion / Editorial Makeup", "Lavika Gusain", datetime(2026, 4, 28, 11, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Editorial summer portfolio shoot"),
            ("Aakriti Taneja", "Engagement Makeup", "Ananya Sharma", datetime(2026, 4, 29, 15, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Engagement glam with floral hair"),
            ("Garima Seth", "Saree Draping", "Riya Verma", datetime(2026, 4, 30, 13, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "South Indian silk saree drape"),
            ("Barkha Saxena", "Hair Styling", "Riya Verma", datetime(2026, 4, 30, 14, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Structured updo for sangeet"),

            # MAY 2026 (16 visits)
            ("Ritu Aggarwal", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 5, 14, 15, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Airbrush glam (98 days ago)"),
            ("Tanya Kapoor", "Celebrity Makeup", "Lavika Gusain", datetime(2026, 5, 8, 16, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Awards gala makeover"),
            ("Priya Singhania", "Reception Makeup", "Lavika Gusain", datetime(2026, 5, 10, 17, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Post-wedding grand reception glam"),
            ("Kritika Khurana", "HD Makeup", "Ananya Sharma", datetime(2026, 5, 12, 14, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "High-Definition camera-ready styling"),
            ("Sneha Malhotra", "Bridal Makeup", "Lavika Gusain", datetime(2026, 5, 16, 9, 30, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Royal bridal transformation"),
            ("Radhika Aggarwal", "Reception Makeup", "Ananya Sharma", datetime(2026, 5, 18, 16, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Post-wedding dinner makeup"),
            ("Divya Batra", "Party Makeup", "Mehak Kapoor", datetime(2026, 5, 20, 17, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Summer evening glow"),
            ("Mansi Grover", "HD Makeup", "Mehak Kapoor", datetime(2026, 5, 22, 15, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Cousin wedding sangeet glam"),
            ("Ritika Dewan", "Pre-Bridal Package", "Pooja Singh", datetime(2026, 5, 24, 11, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Body polishing and glow facials"),
            ("Aditi Roy Choudhury", "Hair Styling", "Riya Verma", datetime(2026, 5, 26, 14, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Voluminous blow-dry & curls"),
            ("Zoya Khan", "Party Makeup", "Mehak Kapoor", datetime(2026, 5, 28, 16, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Smoky eye and nude lip party look"),
            ("Kiran Bedi Malhotra", "Celebrity Makeup", "Lavika Gusain", datetime(2026, 5, 30, 11, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Diplomatic dinner red carpet makeover"),

            # JUNE 2026 (16 visits)
            ("Sonia Duggal", "Engagement Makeup", "Ananya Sharma", datetime(2026, 6, 8, 14, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Engagement makeover (73 days ago)"),
            ("Tanvi Mittal", "Hair Styling", "Riya Verma", datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Hair styling (66 days ago)"),
            ("Garima Mathur", "Hair Styling", "Riya Verma", datetime(2026, 6, 27, 13, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Updo styling (54 days ago)"),
            ("Meera Chawla", "Party Makeup", "Mehak Kapoor", datetime(2026, 6, 30, 16, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Cocktail glam (51 days ago)"),
            ("Neha Chadha", "Bridal Package", "Lavika Gusain", datetime(2026, 6, 10, 10, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Sister's wedding bridal package"),
            ("Payal Oberoi", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 6, 12, 15, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Airbrush finish with custom lashes"),
            ("Ananya Roy", "Celebrity Makeup", "Lavika Gusain", datetime(2026, 6, 18, 17, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "High-profile gala dinner"),
            ("Tanya Kapoor", "HD Makeup", "Ananya Sharma", datetime(2026, 6, 20, 14, 30, tzinfo=timezone.utc), PaymentMethod.CARD, True, "HD glam for family sangeet"),
            ("Kritika Khurana", "Fashion / Editorial Makeup", "Lavika Gusain", datetime(2026, 6, 22, 11, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Brand campaign editorial shoot"),
            ("Mahira Sharma", "Beauty Workshop", "Lavika Gusain", datetime(2026, 6, 24, 14, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Self grooming certification class"),
            ("Prerna Kaul", "Hair Styling", "Riya Verma", datetime(2026, 6, 25, 15, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Hollywood waves styling"),
            ("Prerna Kaul", "Saree Draping", "Riya Verma", datetime(2026, 6, 25, 16, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Cocktail drape for reception"),

            # JULY 2026 (16 visits)
            ("Shruti Bhardwaj", "HD Makeup", "Ananya Sharma", datetime(2026, 7, 12, 15, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "HD glam (39 days ago)"),
            ("Kanika Goel", "Saree Draping", "Riya Verma", datetime(2026, 7, 15, 13, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Saree drape (36 days ago)"),
            ("Simran Bajwa", "Hair Styling", "Riya Verma", datetime(2026, 7, 28, 12, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Hair styling (23 days ago)"),
            ("Alisha Merchant", "Party Makeup", "Mehak Kapoor", datetime(2026, 7, 30, 16, 30, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Party makeup (21 days ago)"),
            ("Radhika Aggarwal", "Party Makeup", "Mehak Kapoor", datetime(2026, 7, 5, 17, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Anniversary party guest makeover"),
            ("Priya Singhania", "HD Makeup", "Ananya Sharma", datetime(2026, 7, 8, 14, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "HD makeover for corporate event"),
            ("Sneha Malhotra", "Hair Styling", "Riya Verma", datetime(2026, 7, 10, 11, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Hair styling & volume blowdry"),
            ("Divya Batra", "HD Makeup", "Ananya Sharma", datetime(2026, 7, 16, 15, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Engagement guest styling"),
            ("Natasha Sethi", "Party Makeup", "Mehak Kapoor", datetime(2026, 7, 18, 17, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Weekend birthday bash makeup"),
            ("Rhea Sen", "HD Makeup", "Ananya Sharma", datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Studio photoshoot base"),
            ("Aakriti Taneja", "Hair Styling", "Riya Verma", datetime(2026, 7, 22, 13, 30, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Textured low bun with pearls"),
            ("Neha Chadha", "Reception Makeup", "Ananya Sharma", datetime(2026, 7, 24, 16, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Reception glam with statement eye"),
            ("Kiran Bedi Malhotra", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 7, 26, 15, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Diplomatic dinner airbrush base"),
            ("Tarini Khanna", "Party Makeup", "Mehak Kapoor", datetime(2026, 7, 31, 17, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Friday night glam"),

            # AUGUST 2026 (18 visits up to today Aug 20)
            ("Divya Batra", "Party Makeup", "Mehak Kapoor", datetime(2026, 8, 2, 16, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Family party makeup"),
            ("Pooja Ahuja", "Pre-Bridal Package", "Pooja Singh", datetime(2026, 8, 4, 10, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Glow facial & body polishing"),
            ("Simran Chawla", "Hair Styling", "Riya Verma", datetime(2026, 8, 6, 12, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Curls and styling"),
            ("Ritika Dewan", "HD Makeup", "Ananya Sharma", datetime(2026, 8, 8, 14, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Anniversary dinner HD look"),
            ("Neha Chadha", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 8, 12, 15, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Anniversary celebration airbrush makeup"),
            ("Mansi Grover", "Party Makeup", "Mehak Kapoor", datetime(2026, 8, 14, 17, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Birthday party glam"),
            ("Kavita Gill", "Saree Draping", "Riya Verma", datetime(2026, 8, 15, 11, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Independence Day cultural function drape"),
            ("Rhea Sen", "Fashion / Editorial Makeup", "Lavika Gusain", datetime(2026, 8, 16, 13, 0, tzinfo=timezone.utc), PaymentMethod.ONLINE, True, "Autumn fashion collection shoot"),
            ("Natasha Sethi", "HD Makeup", "Ananya Sharma", datetime(2026, 8, 17, 15, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "HD glam for dinner event"),
            ("Aditi Roy Choudhury", "Pre-Bridal Package", "Pooja Singh", datetime(2026, 8, 18, 11, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Skin rejuvenation treatment"),
            ("Esha Deol Puri", "Party Makeup", "Mehak Kapoor", datetime(2026, 8, 19, 16, 0, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Birthday evening makeover (Yesterday)"),
            ("Esha Deol Puri", "Hair Styling", "Riya Verma", datetime(2026, 8, 19, 17, 0, tzinfo=timezone.utc), PaymentMethod.CASH, True, "Birthday glam waves (Yesterday)"),

            # TODAY — AUG 20, 2026 (5 visits: 2 completed earlier today, 1 in-service/open right now, 2 completed morning)
            ("Radhika Aggarwal", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 8, 20, 10, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Anniversary & Birthday grand luxury makeover (Today Completed)"),
            ("Radhika Aggarwal", "Hair Styling", "Riya Verma", datetime(2026, 8, 20, 11, 30, tzinfo=timezone.utc), PaymentMethod.UPI, True, "Anniversary styling (Today Completed)"),
            ("Shweta Narang", "HD Makeup", "Ananya Sharma", datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc), PaymentMethod.CARD, True, "Anniversary lunch HD glam (Today Completed)"),
            ("Sneha Malhotra", "Party Makeup", "Mehak Kapoor", datetime(2026, 8, 20, 14, 0, tzinfo=timezone.utc), PaymentMethod.UPI, False, "Birthday celebration glam (Currently In Service / Open)"),
            ("Tanya Kapoor", "Hair Styling", "Riya Verma", datetime(2026, 8, 20, 14, 30, tzinfo=timezone.utc), PaymentMethod.CASH, False, "Birthday hair design (Currently In Service / Open)"),
        ]

        seeded_visits = []
        customer_spend_tracker = {cname: {"count": 0, "spent": 0.0, "first": None, "last": None} for cname in cust_map}

        for cname, sname, staff_name, v_date, pm, is_done, v_notes in visit_schedule:
            cust = cust_map.get(cname)
            srv = services_map.get(sname)
            st_user = staff_map.get(staff_name)

            if not cust or not srv or not st_user:
                continue

            subtotal = srv.price
            discount = 0.0
            # Occasional 5% or 10% discount on packages
            if subtotal >= 20000:
                discount = round(subtotal * 0.05, 2)
            total_amt = subtotal - discount

            v_status = VisitStatus.COMPLETED if is_done else VisitStatus.OPEN
            p_status = PaymentStatus.PAID if is_done else PaymentStatus.PENDING

            start_dt = v_date
            comp_dt = (v_date + timedelta(minutes=srv.duration_minutes)) if is_done else None

            v = Visit(
                business_id=biz_id,
                customer_id=cust.id,
                staff_id=st_user.id,
                status=v_status,
                notes=v_notes,
                subtotal=subtotal,
                discount=discount,
                total_amount=total_amt,
                payment_method=pm,
                payment_status=p_status,
                started_at=start_dt,
                completed_at=comp_dt,
                created_at=start_dt,
                updated_at=comp_dt or start_dt,
            )
            db.add(v)
            db.flush()

            # Add VisitService line item
            vs = VisitService(
                visit_id=v.id,
                service_id=srv.id,
                quantity=1,
                unit_price=srv.price,
                total_price=srv.price,
            )
            db.add(vs)
            seeded_visits.append(v)

            # Update customer metrics tracker
            if is_done:
                tr = customer_spend_tracker[cname]
                tr["count"] += 1
                tr["spent"] += total_amt
                if tr["first"] is None or start_dt < tr["first"]:
                    tr["first"] = start_dt
                if tr["last"] is None or comp_dt > tr["last"]:
                    tr["last"] = comp_dt

        db.flush()
        print(f"Seeded {len(seeded_visits)} Visits across 6 months with itemized VisitServices")

        # -------------------------------------------------------------------
        # 10. SYNCHRONIZE CUSTOMER TOTALS & LOYALTY BALANCES
        # -------------------------------------------------------------------
        for cname, cust in cust_map.items():
            tr = customer_spend_tracker.get(cname, {"count": 0, "spent": 0.0, "first": None, "last": None})
            cust.visit_count = tr["count"]
            cust.total_spent = round(tr["spent"], 2)
            cust.first_visit_at = tr["first"]
            cust.last_visit_at = tr["last"]

            # Compute loyalty points: 10 points per ₹100 spent (i.e. 10% of spend in points)
            lifetime_pts = int(tr["spent"] // 10)
            redeemed_pts = 0
            if lifetime_pts >= 1000:
                redeemed_pts = 500
            elif lifetime_pts >= 500:
                redeemed_pts = 200

            current_pts = max(0, lifetime_pts - redeemed_pts)

            cl = db.scalar(select(CustomerLoyalty).where(CustomerLoyalty.customer_id == cust.id))
            if not cl:
                cl = CustomerLoyalty(
                    customer_id=cust.id,
                    current_points=current_pts,
                    lifetime_points=lifetime_pts,
                    redeemed_points=redeemed_pts,
                )
                db.add(cl)
            else:
                cl.current_points = current_pts
                cl.lifetime_points = lifetime_pts
                cl.redeemed_points = redeemed_pts

        db.flush()
        print("Synchronized Customer lifetime spend, visit counts, and Loyalty point balances")

        # -------------------------------------------------------------------
        # 11. CALENDAR APPOINTMENTS ENGINE (Past, Today, and Next 14 Days)
        # -------------------------------------------------------------------
        # Seed appointments representing realistic salon schedule
        # Types: APPOINTMENT, REMINDER, EVENT, TASK
        appointment_schedule = [
            # TODAY — AUG 20, 2026
            ("Radhika Aggarwal", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 8, 20, 10, 0, tzinfo=timezone.utc), datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc), True, "APPOINTMENT", "Anniversary makeover booked in Bridal Suite"),
            ("Shweta Narang", "HD Makeup", "Ananya Sharma", datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc), datetime(2026, 8, 20, 13, 30, tzinfo=timezone.utc), True, "APPOINTMENT", "HD makeup in HD Studio"),
            ("Sneha Malhotra", "Party Makeup", "Mehak Kapoor", datetime(2026, 8, 20, 14, 0, tzinfo=timezone.utc), datetime(2026, 8, 20, 15, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Birthday party glam (Currently in Service)"),
            ("Tanya Kapoor", "Hair Styling", "Riya Verma", datetime(2026, 8, 20, 14, 30, tzinfo=timezone.utc), datetime(2026, 8, 20, 15, 15, tzinfo=timezone.utc), False, "APPOINTMENT", "Styling session in Styling Lounge"),
            ("Kritika Khurana", "Fashion / Editorial Makeup", "Lavika Gusain", datetime(2026, 8, 20, 17, 0, tzinfo=timezone.utc), datetime(2026, 8, 20, 19, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Upcoming today: Brand shoot trial"),
            ("Mansi Grover", "Saree Draping", "Riya Verma", datetime(2026, 8, 20, 18, 30, tzinfo=timezone.utc), datetime(2026, 8, 20, 19, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Upcoming today: Cocktail party draping"),

            # TOMORROW — AUG 21, 2026
            ("Priya Singhania", "Makeup Trial", "Lavika Gusain", datetime(2026, 8, 21, 11, 0, tzinfo=timezone.utc), datetime(2026, 8, 21, 12, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Birthday client · Destination wedding trial consultation"),
            ("Barkha Saxena", "Hair Styling", "Riya Verma", datetime(2026, 8, 21, 14, 0, tzinfo=timezone.utc), datetime(2026, 8, 21, 14, 45, tzinfo=timezone.utc), False, "APPOINTMENT", "Anniversary romantic blow-dry & curls"),
            ("Natasha Sethi", "HD Makeup", "Ananya Sharma", datetime(2026, 8, 21, 16, 0, tzinfo=timezone.utc), datetime(2026, 8, 21, 18, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Dinner party HD glam session"),

            # DAY 2 — AUG 22, 2026
            ("Ananya Roy", "Celebrity Makeup", "Lavika Gusain", datetime(2026, 8, 22, 10, 30, tzinfo=timezone.utc), datetime(2026, 8, 22, 13, 30, tzinfo=timezone.utc), False, "APPOINTMENT", "High-profile red carpet evening look"),
            ("Ishita Saxena", "Makeup Trial", "Ananya Sharma", datetime(2026, 8, 22, 14, 0, tzinfo=timezone.utc), datetime(2026, 8, 22, 15, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "New bride winter wedding consultation"),
            ("Divya Batra", "Party Makeup", "Mehak Kapoor", datetime(2026, 8, 22, 16, 30, tzinfo=timezone.utc), datetime(2026, 8, 22, 17, 30, tzinfo=timezone.utc), False, "APPOINTMENT", "Saturday evening party makeup"),

            # DAY 3 — AUG 23, 2026 (Sunday)
            ("Apoorva Vats", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 8, 23, 11, 0, tzinfo=timezone.utc), datetime(2026, 8, 23, 13, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Sunday airbrush trial"),
            ("Payal Oberoi", "Bridal Package", "Lavika Gusain", datetime(2026, 8, 23, 14, 0, tzinfo=timezone.utc), datetime(2026, 8, 23, 19, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Sunday luxury bridal package full makeover"),

            # DAY 4 — AUG 24, 2026
            ("Mansi Grover", "Reception Makeup", "Ananya Sharma", datetime(2026, 8, 24, 15, 0, tzinfo=timezone.utc), datetime(2026, 8, 24, 16, 30, tzinfo=timezone.utc), False, "APPOINTMENT", "Anniversary celebration reception glam"),
            ("Rhea Sen", "Hair Styling", "Riya Verma", datetime(2026, 8, 24, 17, 0, tzinfo=timezone.utc), datetime(2026, 8, 24, 17, 45, tzinfo=timezone.utc), False, "APPOINTMENT", "Editorial waves styling"),

            # DAY 5 — AUG 25, 2026
            ("Roshni Mehra", "Party Makeup", "Mehak Kapoor", datetime(2026, 8, 25, 16, 0, tzinfo=timezone.utc), datetime(2026, 8, 25, 17, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Birthday girl special party makeover"),
            ("Surbhi Bansal", "Professional Makeup Training", "Lavika Gusain", datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc), datetime(2026, 8, 25, 18, 0, tzinfo=timezone.utc), False, "EVENT", "Masterclass module 2 - Airbrush techniques"),

            # DAY 6 — AUG 26, 2026
            ("Bhavna Joshi", "HD Makeup", "Ananya Sharma", datetime(2026, 8, 26, 14, 0, tzinfo=timezone.utc), datetime(2026, 8, 26, 16, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Birthday makeover in HD Studio"),
            ("Pooja Ahuja", "Bridal Makeup", "Lavika Gusain", datetime(2026, 8, 26, 10, 0, tzinfo=timezone.utc), datetime(2026, 8, 26, 13, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Signature Bridal makeover"),

            # DAY 7-14 — AUG 27 - SEP 3, 2026
            ("Kiran Bedi Malhotra", "Celebrity Makeup", "Lavika Gusain", datetime(2026, 8, 28, 15, 0, tzinfo=timezone.utc), datetime(2026, 8, 28, 18, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Birthday celebration VIP dinner look"),
            ("Aditi Roy Choudhury", "Bridal Package", "Lavika Gusain", datetime(2026, 8, 30, 10, 0, tzinfo=timezone.utc), datetime(2026, 8, 30, 15, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Pre-festive bridal package session"),
            ("Mahira Sharma", "Beauty Workshop", "Lavika Gusain", datetime(2026, 8, 31, 14, 0, tzinfo=timezone.utc), datetime(2026, 8, 31, 17, 0, tzinfo=timezone.utc), False, "EVENT", "Interactive self makeup masterclass"),
            ("Zoya Khan", "Engagement Makeup", "Ananya Sharma", datetime(2026, 9, 1, 14, 0, tzinfo=timezone.utc), datetime(2026, 9, 1, 15, 30, tzinfo=timezone.utc), False, "APPOINTMENT", "Engagement ceremony makeover"),
            ("Tarini Khanna", "HD Makeup", "Mehak Kapoor", datetime(2026, 9, 2, 16, 0, tzinfo=timezone.utc), datetime(2026, 9, 2, 18, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Cocktail party HD makeup"),
            ("Neha Chadha", "Airbrush Makeup", "Lavika Gusain", datetime(2026, 9, 3, 15, 0, tzinfo=timezone.utc), datetime(2026, 9, 3, 17, 0, tzinfo=timezone.utc), False, "APPOINTMENT", "Autumn wedding guest styling"),

            # Past cancelled appointment for realistic CRM variety
            ("Simran Bajwa", "HD Makeup", "Ananya Sharma", datetime(2026, 8, 10, 14, 0, tzinfo=timezone.utc), datetime(2026, 8, 10, 16, 0, tzinfo=timezone.utc), True, "APPOINTMENT", "Client rescheduled due to out of station travel"),
        ]

        seeded_events = []
        for cname, sname, staff_name, s_time, e_time, is_comp, ev_type, ev_desc in appointment_schedule:
            cust = cust_map.get(cname)
            st_user = staff_map.get(staff_name)

            title = f"{sname} · {cname}" if cust else sname

            ev = CalendarEvent(
                business_id=biz_id,
                title=title,
                description=ev_desc,
                event_type=ev_type,
                start_at=s_time,
                end_at=e_time,
                customer_id=cust.id if cust else None,
                staff_id=st_user.id if st_user else None,
                reminder_minutes=60,
                is_completed=is_comp,
                recurrence_rule="NONE",
                created_by=owner_user.id,
                created_at=s_time - timedelta(days=2),
                updated_at=s_time,
            )
            db.add(ev)
            seeded_events.append(ev)

        db.flush()
        print(f"Seeded {len(seeded_events)} Calendar Appointments & Events across Today and Future 14 Days")

        # -------------------------------------------------------------------
        # 12. MESSAGE TEMPLATES (7 Standard Templates)
        # -------------------------------------------------------------------
        template_defs = [
            (CampaignType.BIRTHDAY, "Luxury Birthday Beauty Offer",
             "Happy Birthday {{customer_name}}! 🎂✨ Celebrate your special day with a luxurious makeover at LV Makeup World. Enjoy an exclusive 20% off on your styling or makeup booking this month. Use code: BDAYGLOW"),
            (CampaignType.ANNIVERSARY, "Romantic Anniversary Glam",
             "Happy Anniversary {{customer_name}}! ❤️ Celebrate your special milestone with LV Makeup World. Book your romantic glam or hair spa session and enjoy a complimentary beauty upgrade."),
            (CampaignType.WELCOME, "Appointment Reminder",
             "Hi {{customer_name}}, this is a friendly reminder for your upcoming appointment at LV Makeup World on {{appointment_date}} at {{appointment_time}} with {{staff_name}}. We look forward to pampering you!"),
            (CampaignType.CUSTOM, "Thank You for Visiting",
             "Thank you for visiting LV Makeup World, {{customer_name}}! 💄 We hope you loved your beauty experience. You've earned {{loyalty_points}} loyalty points on this visit."),
            (CampaignType.RECOVERY, "We Miss You VIP Glow Offer",
             "We miss you at LV Makeup World, {{customer_name}}! ✨ It's been a while since your last visit. Step in this week and enjoy an exclusive 15% VIP discount on your next hair & makeup session."),
            (CampaignType.REVIEW, "Google Review Experience Request",
             "Hi {{customer_name}}, thank you for choosing LV Makeup World for your beauty transformation. We'd love to hear about your experience! Please take 30 seconds to share your 5-star review: {{review_link}}"),
            (CampaignType.FESTIVAL, "Festive Glamour Celebration",
             "Celebrate the joyous festive season with LV Makeup World! 🪔 Step into the spotlight with our signature Bridal, HD & Party makeup packages at special festive prices."),
        ]

        for ctype, tname, msg in template_defs:
            tmpl = db.scalar(
                select(MessageTemplate).where(
                    (MessageTemplate.business_id == biz_id) &
                    (MessageTemplate.campaign_type == ctype)
                )
            )
            if not tmpl:
                tmpl = MessageTemplate(
                    business_id=biz_id,
                    campaign_type=ctype,
                    template_name=tname,
                    message=msg,
                    is_default=True,
                )
                db.add(tmpl)
            else:
                tmpl.template_name = tname
                tmpl.message = msg
                tmpl.is_default = True

        db.flush()
        print("Seeded 7 Official Message Templates")

        # -------------------------------------------------------------------
        # 13. AUTOMATION RULES (Default Enabled)
        # -------------------------------------------------------------------
        auto_types = [
            (CampaignType.BIRTHDAY, ScheduleType.DAILY, "09:00 AM"),
            (CampaignType.ANNIVERSARY, ScheduleType.DAILY, "09:30 AM"),
            (CampaignType.WELCOME, ScheduleType.DAILY, "10:00 AM"),
            (CampaignType.RECOVERY, ScheduleType.WEEKLY, "11:00 AM"),
            (CampaignType.REVIEW, ScheduleType.DAILY, "07:00 PM"),
            (CampaignType.FESTIVAL, ScheduleType.MANUAL, None),
            (CampaignType.VIP, ScheduleType.MONTHLY, "10:00 AM"),
        ]

        for ctype, stype, rtime in auto_types:
            rule = db.scalar(
                select(AutomationRule).where(
                    (AutomationRule.business_id == biz_id) &
                    (AutomationRule.campaign_type == ctype)
                )
            )
            if not rule:
                rule = AutomationRule(
                    business_id=biz_id,
                    campaign_type=ctype,
                    is_enabled=True,
                    schedule_type=stype,
                    run_time=rtime,
                    last_run_at=ANCHOR_NOW - timedelta(days=1),
                )
                db.add(rule)
            else:
                rule.is_enabled = True
                rule.schedule_type = stype
                rule.run_time = rtime

        db.flush()

        # -------------------------------------------------------------------
        # 14. FESTIVAL CAMPAIGNS & MARKETING CAMPAIGNS
        # -------------------------------------------------------------------
        camp_defs = [
            ("Diwali Glow Campaign", CampaignType.FESTIVAL, TargetSegment.ALL_CUSTOMERS,
             "Diwali Luxury Beauty Experience",
             "Celebrate Diwali with radiance! Book your signature HD Makeup & festive styling package at LV Makeup World."),
            ("Karwa Chauth Bridal Glow", CampaignType.FESTIVAL, TargetSegment.ALL_CUSTOMERS,
             "Karwa Chauth Bridal & Evening Glow",
             "Get ready for your special evening with our signature bridal glow, saree draping & mehndi-friendly styling."),
            ("Wedding Season Special", CampaignType.FESTIVAL, TargetSegment.VIP_CUSTOMERS,
             "Winter Wedding Season Luxury Packages",
             "Your dream wedding look starts here. Exclusive pre-booking open for 2026/2027 Bridal & Destination Wedding packages."),
            ("Valentine's Beauty Offer", CampaignType.CUSTOM, TargetSegment.ALL_CUSTOMERS,
             "Valentine's Day Glam & Makeover",
             "Pamper yourself or someone special with a luxury hair spa, radiant facial, and evening party makeup."),
            ("Festive Glam Package", CampaignType.FESTIVAL, TargetSegment.ALL_CUSTOMERS,
             "Grand Festive Makeup & Hair Bundle",
             "Complete festive makeover with HD finish, customized lash styling, and professional draping."),
        ]

        camp_map = {}
        for cname, ctype, cseg, ctitle, cmsg in camp_defs:
            camp = db.scalar(
                select(Campaign).where(
                    (Campaign.business_id == biz_id) &
                    (Campaign.name == cname)
                )
            )
            if not camp:
                camp = Campaign(
                    business_id=biz_id,
                    name=cname,
                    campaign_type=ctype,
                    target_segment=cseg,
                    title=ctitle,
                    message=cmsg,
                    is_active=True,
                )
                db.add(camp)
                db.flush()
            else:
                camp.title = ctitle
                camp.message = cmsg
                camp.is_active = True
            camp_map[cname] = camp

        # Festival Campaign associations with Festival model
        festivals = db.scalars(select(Festival)).all()
        for fest in festivals:
            fcamp = db.scalar(
                select(FestivalCampaign).where(
                    (FestivalCampaign.business_id == biz_id) &
                    (FestivalCampaign.festival_id == fest.id)
                )
            )
            if not fcamp:
                fcamp = FestivalCampaign(
                    business_id=biz_id,
                    festival_id=fest.id,
                    title=f"{fest.festival_name} Special Glamour Package",
                    description=f"Exclusive luxury makeover and styling offers for {fest.festival_name}.",
                    discount_percent="20%",
                    language="Hinglish",
                    tone="Festive",
                    message=f"Celebrate {fest.festival_name} with LV Makeup World! Get 20% off on all makeup and hair bookings.",
                    ai_generated=True,
                    last_generated=ANCHOR_NOW - timedelta(days=5),
                    enabled=True,
                )
                db.add(fcamp)

        db.flush()
        print("Seeded Marketing & Festival Campaigns")

        # -------------------------------------------------------------------
        # 15. REVIEW BOOSTER CAMPAIGN & LOGS (5-Star Google Reviews History)
        # -------------------------------------------------------------------
        review_camp = db.scalar(
            select(Campaign).where(
                (Campaign.business_id == biz_id) &
                (Campaign.campaign_type == CampaignType.REVIEW)
            )
        )
        if not review_camp:
            review_camp = Campaign(
                business_id=biz_id,
                name="Google Review Booster Campaign",
                campaign_type=CampaignType.REVIEW,
                target_segment=TargetSegment.ALL_CUSTOMERS,
                title="Share Your 5-Star Experience",
                message="Hi {{customer_name}}, thank you for choosing LV Makeup World! Please share your review on Google: {{review_link}}",
                is_active=True,
            )
            db.add(review_camp)
            db.flush()

        # Seed realistic review booster logs for completed customers
        # Clean existing logs for this campaign for idempotency
        db.query(CampaignLog).filter(CampaignLog.campaign_id == review_camp.id).delete()
        db.flush()

        review_log_samples = [
            ("Radhika Aggarwal", CampaignLogStatus.SENT, ANCHOR_NOW - timedelta(days=10), ANCHOR_NOW - timedelta(days=10), ANCHOR_NOW - timedelta(days=9)),
            ("Sneha Malhotra", CampaignLogStatus.SENT, ANCHOR_NOW - timedelta(days=14), ANCHOR_NOW - timedelta(days=14), ANCHOR_NOW - timedelta(days=13)),
            ("Priya Singhania", CampaignLogStatus.SENT, ANCHOR_NOW - timedelta(days=18), ANCHOR_NOW - timedelta(days=18), None),
            ("Divya Batra", CampaignLogStatus.SENT, ANCHOR_NOW - timedelta(days=5), ANCHOR_NOW - timedelta(days=5), None),
            ("Natasha Sethi", CampaignLogStatus.SENT, ANCHOR_NOW - timedelta(days=3), None, None),
            ("Shweta Narang", CampaignLogStatus.PENDING, None, None, None),
            ("Mansi Grover", CampaignLogStatus.PENDING, None, None, None),
        ]

        for cname, cstatus, sent_dt, click_dt, rev_dt in review_log_samples:
            cust = cust_map.get(cname)
            if not cust:
                continue
            clog = CampaignLog(
                campaign_id=review_camp.id,
                customer_id=cust.id,
                status=cstatus,
                sent_at=sent_dt,
                tracking_token=f"rev_{uuid.uuid4().hex[:12]}",
                clicked_at=click_dt,
                reviewed_at=rev_dt,
                sent_message=f"Hi {cust.name}, thank you for choosing LV Makeup World! We'd love your review: https://g.page/r/lvmakeupworld/review",
                sent_by_user_id=owner_user.id,
            )
            db.add(clog)

        db.flush()
        print("Seeded Review Booster Campaign and Tracking Logs")

        # -------------------------------------------------------------------
        # 16. COMMIT ALL CHANGES SAFELY
        # -------------------------------------------------------------------
        db.commit()
        print("=================================================================")
        print("  LV MAKEUP WORLD DEMO SEED COMPLETED SUCCESSFULLY!")
        print("=================================================================")

        # Quick summary stats
        print(f"Business ID: {biz.id}")
        print(f"Admin Login: {DEMO_LOGIN_EMAIL}")
        print(f"Total Services: {len(services_map)}")
        print(f"Total Staff: {len(staff_map)}")
        print(f"Total Customers: {len(cust_map)}")
        print(f"Total Visits: {len(seeded_visits)}")
        print(f"Total Appointments/Events: {len(seeded_events)}")

    except Exception as e:
        db.rollback()
        print(f"ERROR DURING SEEDING: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_salon_demo()
