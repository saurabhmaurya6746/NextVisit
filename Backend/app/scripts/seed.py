from app.db.database import SessionLocal
from app.models.business_type import BusinessType

db = SessionLocal()

types = [
    "Salon",
    "Restaurant",
]

for name in types:

    exists = db.query(BusinessType).filter_by(
        name=name
    ).first()

    if not exists:
        db.add(
            BusinessType(
                name=name
            )
        )

db.commit()

print("Business types seeded successfully.")