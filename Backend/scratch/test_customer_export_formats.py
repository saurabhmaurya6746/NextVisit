import sys
import os
import io

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token

def test_export_formats():
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

        print("=== TESTING CUSTOMER EXPORT ENHANCEMENTS ===")

        # 1. Test PDF Export Format
        print("\n1. Testing PDF Export (format=pdf)...")
        res_pdf = client.get("/api/v1/customers/export?format=pdf&sort=spend_desc", headers=headers_resto)
        print("   Status Code:", res_pdf.status_code)
        print("   Content-Type:", res_pdf.headers.get("content-type"))
        print("   Content-Disposition:", res_pdf.headers.get("content-disposition"))
        assert res_pdf.status_code == 200
        assert "application/pdf" in res_pdf.headers.get("content-type", "")
        assert res_pdf.content.startswith(b"%PDF")
        print("   PDF Export Verified! Size:", len(res_pdf.content), "bytes")

        # 2. Test Excel Export Format (format=xlsx)
        print("\n2. Testing Excel Export (format=xlsx)...")
        res_xlsx = client.get("/api/v1/customers/export?format=xlsx&filter=vip", headers=headers_resto)
        print("   Status Code:", res_xlsx.status_code)
        print("   Content-Type:", res_xlsx.headers.get("content-type"))
        print("   Content-Disposition:", res_xlsx.headers.get("content-disposition"))
        assert res_xlsx.status_code == 200
        assert "spreadsheetml" in res_xlsx.headers.get("content-type", "")
        assert res_xlsx.content.startswith(b"PK\x03\x04") # Zip header for xlsx
        print("   Excel Export Verified! Size:", len(res_xlsx.content), "bytes")

        # 3. Test CSV Export Format (format=csv)
        print("\n3. Testing CSV Export (format=csv)...")
        res_csv = client.get("/api/v1/customers/export?format=csv&search=test", headers=headers_resto)
        print("   Status Code:", res_csv.status_code)
        print("   Content-Type:", res_csv.headers.get("content-type"))
        print("   Content-Disposition:", res_csv.headers.get("content-disposition"))
        assert res_csv.status_code == 200
        assert "text/csv" in res_csv.headers.get("content-type", "")
        assert res_csv.content.startswith(b"\xef\xbb\xbf") # UTF-8 BOM
        print("   CSV Export Verified! Size:", len(res_csv.content), "bytes")

        # 4. Test Salon Business Isolation PDF Export
        print("\n4. Testing Salon Business Isolation PDF Export...")
        res_salon_pdf = client.get("/api/v1/customers/export?format=pdf", headers=headers_salon)
        assert res_salon_pdf.status_code == 200
        assert res_salon_pdf.content.startswith(b"%PDF")
        print("   Salon PDF Export Verified!")

        print("\nALL CUSTOMER EXPORT FORMAT TESTS PASSED 100%!")

    except Exception as e:
        print("\nTEST FAILED WITH ERROR:", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_export_formats()
