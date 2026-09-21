import sys
import os
import traceback
from uuid import UUID

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.services.client_management_service import ClientManagementService

def run():
    db = SessionLocal()
    try:
        biz_id = UUID("dfa6edf3-99e5-454f-a6c3-564e781b5078")
        service = ClientManagementService(db)
        
        print("Calling get_client_detail for dfa6edf3-99e5-454f-a6c3-564e781b5078 ...")
        res = service.get_client_detail(biz_id)
        print("SUCCESS! Output:")
        print(res.model_dump())

    except Exception as e:
        print("FAIL WITH EXCEPTION:")
        print(e)
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run()
