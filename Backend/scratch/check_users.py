from app.db.database import SessionLocal
from app.models.user import User
from app.models.business import Business
from app.models.business_type import BusinessType
from sqlalchemy.orm import joinedload

db = SessionLocal()
users = db.query(User).options(joinedload(User.business).joinedload(Business.business_type)).all()
for u in users:
    bt = u.business.business_type.name if (u.business and u.business.business_type) else "N/A"
    print(f"User: {u.email} | Biz: {u.business.name if u.business else 'N/A'} | Type: {bt}")
db.close()
