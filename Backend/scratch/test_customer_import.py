import sys
import os
import csv
import io
import uuid
from datetime import datetime

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.business import Business
from app.models.customer import Customer
from app.core.security import create_access_token
from sqlalchemy import select

def test_import():
    client = TestClient(app)
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active == True, User.status == "ACTIVE").all()
        assert len(users) > 0, "Users must exist"

        user_resto = None
        user_salon = None
        for u in users:
            if u.business:
                btype = u.business.business_type.name.lower() if u.business.business_type else ""
                if "resto" in btype or "restaurant" in btype:
                    if not user_resto: user_resto = u
                elif "salon" in btype or "spa" in btype:
                    if not user_salon: user_salon = u

        if not user_resto: user_resto = users[0]
        if not user_salon: user_salon = users[-1]

        token_resto = create_access_token({"sub": str(user_resto.id), "role": user_resto.role, "business_id": str(user_resto.business_id)})
        headers_resto = {"Authorization": f"Bearer {token_resto}"}

        token_salon = create_access_token({"sub": str(user_salon.id), "role": user_salon.role, "business_id": str(user_salon.business_id)})
        headers_salon = {"Authorization": f"Bearer {token_salon}"}

        print(f"=== TESTING CUSTOMER IMPORT ===")

        # 1. Test 10 Customers Import for Restaurant (Valid + Empty Rows + Invalid Phone + Missing Name)
        csv_data_10 = (
            "Customer Name,Phone,Email,Gender,Birthday,Anniversary,Notes\n"
            "Import Test 1,9111111111,import1@example.com,Male,1990-01-01,,Test note 1\n"
            "Import Test 2,+91 9111111112,import2@example.com,Female,1992-02-02,2020-05-05,Test note 2\n"
            "Import Test 3,9111111113,import3@example.com,Male,,,\n"
            "Import Test 4,9111111114,import4@example.com,Female,,,\n"
            "Import Test 5,9111111115,import5@example.com,Male,,,\n"
            ",,,\n"  # Completely Empty Row (should be skipped)
            ",9111111116,noname@example.com,Male,,,\n"  # Missing Customer Name (Row 8 - failed)
            "Invalid Phone User,12345,badphone@example.com,Female,,,\n"  # Invalid Phone (Row 9 - failed)
            "Import Test 6,9111111116,import6@example.com,Male,,,\n"
            "Import Test 7,9111111117,import7@example.com,Female,,,\n"
            "Import Test 8,9111111118,import8@example.com,Male,,,\n"
            "Import Test 9,9111111119,import9@example.com,Female,,,\n"
            "Import Test 10,9111111120,import10@example.com,Male,,,\n"
        )

        files_10 = {"file": ("test_import_10.csv", csv_data_10.encode("utf-8"), "text/csv")}
        res1 = client.post("/api/v1/customers/import", headers=headers_resto, files=files_10)
        print("\n1. IMPORT 10 CUSTOMERS HTTP STATUS:", res1.status_code)
        assert res1.status_code == 200
        data1 = res1.json()
        print("   Import Summary:", data1)
        assert data1["imported_count"] == 10
        assert data1["failed_count"] == 2
        assert data1["skipped_count"] == 1
        assert len(data1["errors"]) == 2

        # 2. Test Duplicate Phone Numbers (Re-importing same file)
        files_dup = {"file": ("test_import_dup.csv", csv_data_10.encode("utf-8"), "text/csv")}
        res_dup = client.post("/api/v1/customers/import", headers=headers_resto, files=files_dup)
        assert res_dup.status_code == 200
        data_dup = res_dup.json()
        print("\n2. DUPLICATE PHONE TEST SUMMARY:", data_dup)
        assert data_dup["imported_count"] == 0
        assert data_dup["duplicate_count"] == 10, f"Expected 10 duplicates, got {data_dup['duplicate_count']}"

        # 3. Test Salon Customer Import (Business Isolation: Same phone can exist in Salon without conflicting)
        csv_salon = (
            "Customer Name,Phone,Email,Gender\n"
            "Salon Client 1,9111111111,salon1@example.com,Female\n"  # Same phone as Restaurant 1!
            "Salon Client 2,9222222222,salon2@example.com,Female\n"
        )
        files_salon = {"file": ("salon_import.csv", csv_salon.encode("utf-8"), "text/csv")}
        res_salon = client.post("/api/v1/customers/import", headers=headers_salon, files=files_salon)
        assert res_salon.status_code == 200
        data_salon = res_salon.json()
        print("\n3. SALON BUSINESS ISOLATION IMPORT:", data_salon)
        assert data_salon["imported_count"] == 2

        # 4. Bulk 500 Customers Import Performance Test
        print("\n4. BULK 500 CUSTOMERS IMPORT TEST...")
        bulk_rows = ["Customer Name,Phone,Email,Gender"]
        for i in range(1, 501):
            bulk_rows.append(f"Bulk Cust {i},95000{i:05d},bulk{i}@example.com,Male")
        csv_bulk = "\n".join(bulk_rows)

        files_bulk = {"file": ("bulk_500.csv", csv_bulk.encode("utf-8"), "text/csv")}
        t_start = datetime.now()
        res_bulk = client.post("/api/v1/customers/import", headers=headers_resto, files=files_bulk)
        t_duration = (datetime.now() - t_start).total_seconds()

        assert res_bulk.status_code == 200
        data_bulk = res_bulk.json()
        print(f"   Imported 500 customers in {t_duration:.3f} seconds!")
        assert data_bulk["imported_count"] == 500

        # Cleanup test records created
        db.query(Customer).filter(Customer.phone.like("91111111%")).delete(synchronize_session=False)
        db.query(Customer).filter(Customer.phone.like("92222222%")).delete(synchronize_session=False)
        db.query(Customer).filter(Customer.phone.like("95000%")).delete(synchronize_session=False)
        db.commit()

        print("\nALL CUSTOMER IMPORT TESTS PASSED 100%!")

    except Exception as e:
        print("\nTEST FAILED WITH ERROR:", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_import()
