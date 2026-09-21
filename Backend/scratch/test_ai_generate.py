import sys
from app.db.database import SessionLocal
from app.models.user import User
from app.services.festival_service import FestivalService
from app.services.automation_service import AutomationService

db = SessionLocal()

user = db.query(User).filter(User.email == "salon4@test.com").first()
if not user:
    user = db.query(User).first()

print(f"Testing for user: {user.email}, business_id: {user.business_id}")

try:
    fs = FestivalService(db)
    msg = fs.generate_ai_message(
        current_user=user,
        festival_id=None,
        festival_name="Independence Day",
        language="Hinglish",
        tone="Festive",
        coupon_code="INDEPE20",
        discount_percent="20%",
    )
    print("FESTIVAL AI GENERATED SUCCESS:")
    print(msg.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
except Exception as e:
    import traceback
    print("FESTIVAL AI ERROR:")
    traceback.print_exc()

db.close()
