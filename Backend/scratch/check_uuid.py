import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import SessionLocal
from sqlalchemy import text

def check():
    db = SessionLocal()
    try:
        target_uuid = "dfa6edf3-99e5-454f-a6c3-564e781b5078"
        
        # Check businesses
        b = db.execute(text(f"SELECT id, name, email, is_deleted, status FROM businesses WHERE id = '{target_uuid}'")).fetchall()
        print("BUSINESSES CHECK:", b)

        # Check users
        u = db.execute(text(f"SELECT id, name, email, business_id, is_active, status FROM users WHERE id = '{target_uuid}'")).fetchall()
        print("USERS CHECK (if ID is user_id):", u)
        if u:
            linked_biz_id = u[0][3]
            linked_b = db.execute(text(f"SELECT id, name, email, is_deleted, status FROM businesses WHERE id = '{linked_biz_id}'")).fetchall()
            print("  LINKED BUSINESS FOR THIS USER:", linked_b)

        # Check users where business_id is target_uuid
        ub = db.execute(text(f"SELECT id, name, email, business_id, is_active, status FROM users WHERE business_id = '{target_uuid}'")).fetchall()
        print("USERS FOR THIS BUSINESS ID:", ub)

    finally:
        db.close()

if __name__ == "__main__":
    check()
