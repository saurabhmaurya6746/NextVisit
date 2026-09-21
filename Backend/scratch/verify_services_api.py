from app.db.database import engine
from app.models.user import User
from app.models.service import Service
from app.services.service_service import ServiceService
from app.schemas.service import ServiceResponse
from sqlalchemy.orm import Session

def main():
    with Session(engine) as db:
        user = db.query(User).first()
        if not user:
            print("No user found")
            return
        print(f"Testing for user: {user.email} (business_id={user.business_id})")
        services = ServiceService(db).list_services(user)
        print(f"Retrieved {len(services)} services!")
        for s in services:
            resp = ServiceResponse.model_validate(s)
            print(f" - [{resp.category_name or resp.category}] {resp.name} | ₹{resp.price} | {resp.duration_minutes}m | ID: {resp.id}")

if __name__ == "__main__":
    main()
