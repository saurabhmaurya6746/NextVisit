import sys
import os
from datetime import datetime, timezone

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from app.schemas.campaign_execution import CampaignLogRecordSendRequest
from app.services.campaign_execution_service import CampaignExecutionService

def run_test():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "demo@salon.com").first()
        if not user:
            user = db.query(User).first()

        service = CampaignExecutionService(db)

        # 1. Send record with coupon code and message
        cust = db.query(Customer).filter(Customer.business_id == user.business_id).first()

        req = CampaignLogRecordSendRequest(
            customer_id=cust.id,
            campaign_type="FESTIVAL",
            message="Happy Diwali! Enjoy special coupon DIWALI20 for 20% off on all services!",
            coupon_code="DIWALI20"
        )
        send_res = service.record_send(user, req)
        print("RECORD SEND RES:", send_res)

        # 2. Fetch history API
        history = service.get_campaign_history(user, page=1, limit=10)
        print(f"HISTORY TOTAL: {history['total']}")
        assert history['total'] > 0
        first_item = history['items'][0]
        print("FIRST HISTORY ITEM:", first_item)

        assert first_item['customer_id'] == cust.id
        assert first_item['coupon_code'] == "DIWALI20"
        assert "Happy Diwali!" in first_item['message']
        assert first_item['sent_by'] == user.name
        assert first_item['status'] == "SENT"

        # 3. Test Search
        search_res = service.get_campaign_history(user, search="DIWALI20")
        assert search_res['total'] > 0
        print("SEARCH FOR 'DIWALI20' RETURNED:", search_res['total'], "items")

        print("\nALL WHATSAPP HISTORY BACKEND TESTS PASSED 100%!")

    finally:
        db.close()

if __name__ == "__main__":
    run_test()
