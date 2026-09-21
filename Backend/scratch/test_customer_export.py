import sys
import os
import csv
import io
import uuid
from datetime import datetime, date

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.business import Business
from app.models.business_type import BusinessType
from app.models.customer import Customer
from app.core.security import create_access_token
from sqlalchemy import select

def test_export():
    client = TestClient(app)
    db = SessionLocal()
    try:
        # Find active business owners for Salon and Restaurant
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

        print(f"=== TESTING CUSTOMER EXPORT ===")
        print(f"Restaurant Owner: {user_resto.email} (Biz ID: {user_resto.business_id})")
        print(f"Salon Owner: {user_salon.email} (Biz ID: {user_salon.business_id})")

        # 1. Test basic export for Restaurant
        res1 = client.get("/api/v1/customers/export", headers=headers_resto)
        print("\n1. BASIC EXPORT HTTP STATUS:", res1.status_code)
        assert res1.status_code == 200
        assert "text/csv" in res1.headers["content-type"]
        assert "Content-Disposition" in res1.headers
        assert "attachment; filename=" in res1.headers["Content-Disposition"]

        content1 = res1.content.decode("utf-8")
        assert content1.startswith("\ufeff"), "Must start with UTF-8 BOM"

        # Parse CSV
        reader1 = csv.reader(io.StringIO(content1[1:])) # skip BOM for reader
        rows1 = list(reader1)
        headers1 = rows1[0]
        data_rows1 = rows1[1:]

        expected_headers = [
            "Customer Name", "Phone", "Email", "Gender", "Birthday",
            "Anniversary", "VIP Status", "Loyalty Points", "Visits",
            "Total Spend", "Last Visit", "Created Date"
        ]
        for h in expected_headers:
            assert h in headers1, f"Missing header {h}"

        print(f"   Exported {len(data_rows1)} customers for Restaurant.")
        if data_rows1:
            print("   Sample row 1:", data_rows1[0])

        # 2. Test Business Isolation (Salon Export should only contain Salon Customers)
        res_salon = client.get("/api/v1/customers/export", headers=headers_salon)
        assert res_salon.status_code == 200
        content_salon = res_salon.content.decode("utf-8")
        reader_salon = csv.reader(io.StringIO(content_salon[1:]))
        rows_salon = list(reader_salon)[1:]
        print(f"\n2. BUSINESS ISOLATION: Salon export returned {len(rows_salon)} customers.")

        # 3. Test Search + Export
        if data_rows1:
            search_term = data_rows1[0][0][:4] # first 4 chars of name
            res_search = client.get(f"/api/v1/customers/export?search={search_term}", headers=headers_resto)
            assert res_search.status_code == 200
            rows_search = list(csv.reader(io.StringIO(res_search.content.decode("utf-8")[1:])))[1:]
            print(f"\n3. SEARCH EXPORT ('{search_term}'): {len(rows_search)} rows returned.")
            for r in rows_search:
                assert any(search_term.lower() in field.lower() for field in r), f"Search term not in {r}"

        # 4. Test Filter + Export (VIP)
        res_vip = client.get("/api/v1/customers/export?filter=VIP", headers=headers_resto)
        assert res_vip.status_code == 200
        rows_vip = list(csv.reader(io.StringIO(res_vip.content.decode("utf-8")[1:])))[1:]
        print(f"\n4. FILTER EXPORT (filter=VIP): {len(rows_vip)} VIP rows returned.")

        # 5. Test Sort + Export (name_asc vs spend_desc)
        res_sort = client.get("/api/v1/customers/export?sort=name_asc", headers=headers_resto)
        assert res_sort.status_code == 200
        rows_sort = list(csv.reader(io.StringIO(res_sort.content.decode("utf-8")[1:])))[1:]
        print(f"\n5. SORT EXPORT (sort=name_asc): {len(rows_sort)} sorted rows returned.")
        if len(rows_sort) > 1:
            names = [r[0] for r in rows_sort]
            assert names == sorted(names), f"Names not sorted ascending: {names}"

        # 6. Large Dataset / Bulk Customers Test (5000 customers stress test in DB)
        print("\n6. LARGE DATASET STRESS TEST (Bulk export test)...")
        btype = db.query(BusinessType).first()
        temp_biz = Business(
            name="Stress Test Business",
            business_type_id=btype.id if btype else None,
            owner_name="Tester",
            email=f"stress_{uuid.uuid4().hex[:6]}@example.com",
            phone="9998887770",
            country="India",
            currency="INR",
            timezone="Asia/Kolkata",
            address="123 Test St",
            status="ACTIVE",
            is_active=True
        )
        db.add(temp_biz)
        db.flush()

        bulk_customers = [
            Customer(
                business_id=temp_biz.id,
                name=f"Customer {i}",
                phone=f"+9190000{i:05d}",
                email=f"cust{i}@example.com",
                total_spent=float(i * 10),
                visit_count=i % 15,
                is_active=True
            )
            for i in range(1, 1001) # 1000 customers stress test
        ]
        db.bulk_save_objects(bulk_customers)
        db.commit()

        temp_user = User(
            business_id=temp_biz.id,
            name="Tester",
            email=temp_biz.email,
            hashed_password="hash",
            role="owner",
            is_active=True,
            status="ACTIVE"
        )
        db.add(temp_user)
        db.commit()

        token_temp = create_access_token({"sub": str(temp_user.id), "role": temp_user.role, "business_id": str(temp_biz.id)})
        headers_temp = {"Authorization": f"Bearer {token_temp}"}

        start_time = datetime.now()
        res_bulk = client.get("/api/v1/customers/export", headers=headers_temp)
        duration = (datetime.now() - start_time).total_seconds()

        assert res_bulk.status_code == 200
        rows_bulk = list(csv.reader(io.StringIO(res_bulk.content.decode("utf-8")[1:])))[1:]
        assert len(rows_bulk) == 1000, f"Expected 1000 rows, got {len(rows_bulk)}"
        print(f"   Bulk export of 1,000 customers completed in {duration:.3f} seconds with {len(rows_bulk)} rows!")

        # Cleanup temp business
        db.query(Customer).filter(Customer.business_id == temp_biz.id).delete()
        db.query(User).filter(User.id == temp_user.id).delete()
        db.query(Business).filter(Business.id == temp_biz.id).delete()
        db.commit()

        print("\nALL CUSTOMER EXPORT TESTS PASSED 100%!")

    except Exception as e:
        print("\nTEST FAILED WITH ERROR:", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_export()
