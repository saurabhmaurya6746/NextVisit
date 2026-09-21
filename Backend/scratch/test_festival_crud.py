import sys, os
from datetime import date, timedelta
from app.db.database import SessionLocal, engine
from app.models.user import User
from app.services.festival_service import FestivalService
from app.schemas.festival import FestivalCampaignCreate, FestivalCampaignUpdate
from sqlalchemy import text

# Ensure columns exist in DB
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE festival_campaigns ADD COLUMN IF NOT EXISTS title VARCHAR(200);"))
    conn.execute(text("ALTER TABLE festival_campaigns ADD COLUMN IF NOT EXISTS description TEXT;"))
    conn.execute(text("ALTER TABLE festival_campaigns ADD COLUMN IF NOT EXISTS discount_percent VARCHAR(50);"))
    conn.execute(text("ALTER TABLE festival_campaigns ADD COLUMN IF NOT EXISTS image_url TEXT;"))
    conn.execute(text("ALTER TABLE festival_campaigns ADD COLUMN IF NOT EXISTS start_date DATE;"))
    conn.execute(text("ALTER TABLE festival_campaigns ADD COLUMN IF NOT EXISTS end_date DATE;"))
    conn.commit()

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == "demo@example.com").first()
    if not user:
        user = db.query(User).first()
    
    print(f"Testing Festival CRUD for user: {user.email}, business_id: {user.business_id}")
    fs = FestivalService(db)

    # 1. CREATE
    create_payload = FestivalCampaignCreate(
        festival_name="Grand Summer Beauty Bash",
        title="Summer Styling Fest",
        description="Exclusive summer pampering offers for all guests.",
        festival_date=date.today() + timedelta(days=15),
        start_date=date.today() + timedelta(days=10),
        end_date=date.today() + timedelta(days=20),
        coupon_code="SUMMER30",
        discount_percent="30% OFF",
        language="Hinglish",
        tone="Festive",
        message="Happy Summer Fest {name}! Enjoy 30% OFF at {salon_name}.",
        enabled=True,
    )
    created = fs.create_campaign(user, create_payload)
    print("CREATE SUCCESS! ID:", created.id, "Name:", created.festival_name)

    # 2. UPDATE
    update_payload = FestivalCampaignUpdate(
        festival_name="Grand Summer Beauty Bash Updated",
        coupon_code="SUMMER35",
        discount_percent="35% OFF",
        enabled=False,
    )
    updated = fs.update_campaign(user, created.id, update_payload)
    print("UPDATE SUCCESS! Name:", updated.festival_name, "Coupon:", updated.coupon_code, "Enabled:", updated.enabled)

    # 3. DELETE
    del_res = fs.delete_campaign(user, created.id)
    print("DELETE SUCCESS!", del_res)

finally:
    db.close()
