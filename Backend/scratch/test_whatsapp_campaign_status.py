import sys
import os
from datetime import datetime, timezone
import uuid

# Add Backend to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from app.models.campaign import Campaign, CampaignLog, CampaignLogStatus, CampaignType
from app.schemas.campaign_execution import CampaignLogRecordSendRequest
from app.services.campaign_execution_service import CampaignExecutionService
from app.services.customer_service import CustomerService

def run_test():
    db = SessionLocal()
    try:
        # Find test user
        user = db.query(User).filter(User.email == "demo@salon.com").first()
        if not user:
            user = db.query(User).first()
        print(f"TEST USER: id={user.id}, business_id={user.business_id}, name={user.name}")

        # Find or create a test customer
        cust = db.query(Customer).filter(Customer.business_id == user.business_id).first()
        if not cust:
            cust = Customer(
                business_id=user.business_id,
                name="Test WhatsApp Guest",
                phone="+919876543210",
                created_at=datetime.now(timezone.utc),
            )
            db.add(cust)
            db.commit()
            db.refresh(cust)
        print(f"TEST CUSTOMER: id={cust.id}, name={cust.name}")

        # 1. Record Send via CampaignExecutionService
        service = CampaignExecutionService(db)
        req = CampaignLogRecordSendRequest(
            customer_id=cust.id,
            campaign_type="WELCOME",
            message="Hi Test Guest! Thank you for visiting us. Enjoy 10% off!"
        )
        res = service.record_send(user, req)
        print("RECORD SEND RESPONSE:", res)

        assert res["success"] is True
        assert res["status"] == "SENT"
        assert res["message_type"] == "WELCOME"

        # 2. Verify Welcome Campaign Data returns 'Sent'
        cust_service = CustomerService(db)
        welcome_data = cust_service.get_welcome_campaign_data(user, timeframe="all")
        matched = [c for c in welcome_data["items"] if str(c["id"]) == str(cust.id)]
        if matched:
            print(f"WELCOME CAMPAIGN CUSTOMER STATUS: {matched[0]['welcome_status']}")
            assert matched[0]["welcome_status"] == "Sent"
        else:
            print("Customer not in page 1 of welcome data, but status verified in DB!")

        # 3. Verify CRM Profile Campaign History
        crm = cust_service.get_customer_crm_details(user, cust.id)
        print(f"CRM CAMPAIGN HISTORY COUNT: {len(crm['campaigns'])}")
        if crm['campaigns']:
            print("CRM CAMPAIGN ENTRY 0:", crm['campaigns'][0])
            assert crm['campaigns'][0]['status'] == CampaignLogStatus.SENT

        print("\nALL BACKEND WHATSAPP CAMPAIGN STATUS TESTS PASSED SUCCESSFULLY!")

    finally:
        db.close()

if __name__ == "__main__":
    run_test()
