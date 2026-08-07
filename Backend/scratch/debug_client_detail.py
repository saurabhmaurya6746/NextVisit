import sys
import os
import traceback

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.business import Business
from app.services.client_management_service import ClientManagementService
from sqlalchemy import select

def debug():
    db = SessionLocal()
    try:
        service = ClientManagementService(db)
        businesses = db.scalars(select(Business).where(Business.is_deleted == False)).all()
        print(f"FOUND {len(businesses)} active non-deleted businesses in DB:")
        for b in businesses:
            print(f"- ID: {b.id} | Name: {b.name} | Email: {b.email} | Type: {b.business_type}")

        if not businesses:
            print("NO ACTIVE BUSINESSES FOUND IN DB.")
            return

        target_b = businesses[0]
        print(f"\nFETCHING CLIENT DETAIL FOR BUSINESS ID: {target_b.id} ({target_b.name})")

        detail = service.get_client_detail(target_b.id)
        print("CLIENT DETAIL SUCCESS! RETURNED OBJECT:")
        print(detail.model_dump())

    except Exception as e:
        print("\nERROR FETCHING CLIENT DETAIL:")
        print(e)
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    debug()
