import sys
from app.db.database import SessionLocal
from app.models.user import User
from app.services.festival_service import FestivalService
from app.services.ai_message_service import AiMessageService

db = SessionLocal()

user = db.query(User).filter(User.email == "jailrestaurant1@gmail.com").first()
if not user:
    user = db.query(User).first()

print(f"Testing Restaurant AI generation for user: {user.email}, business_id: {user.business_id}")

try:
    fs = FestivalService(db)
    msg = fs.generate_ai_message(
        current_user=user,
        festival_id=None,
        festival_name="Diwali",
        language="Hinglish",
        tone="Festive",
        coupon_code="DIWALI25",
        discount_percent="25%",
    )
    print("RESTAURANT FESTIVAL AI GENERATED SUCCESS:")
    print(msg.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
except Exception as e:
    import traceback
    print("RESTAURANT FESTIVAL AI ERROR:")
    traceback.print_exc()

db.close()
