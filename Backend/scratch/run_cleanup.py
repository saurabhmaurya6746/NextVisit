import sys, os, uuid
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Backend"))
sys.path.insert(0, backend_path)

from app.db.database import engine
from sqlalchemy import text

def cleanup():
    with engine.connect() as conn:
        del_bizs = conn.execute(text("SELECT id, email FROM businesses WHERE is_deleted = True AND email NOT LIKE 'deleted_%'")).fetchall()
        for b_id, email in del_bizs:
            new_email = f"deleted_{uuid.uuid4().hex[:8]}_{email}"
            conn.execute(text("UPDATE businesses SET email = :ne WHERE id = :bid"), {"ne": new_email, "bid": b_id})
        
        del_users = conn.execute(text("SELECT id, email, login_id FROM users WHERE (is_active = False OR status = 'DELETED') AND email NOT LIKE 'deleted_%'")).fetchall()
        for u_id, email, login_id in del_users:
            new_email = f"deleted_{uuid.uuid4().hex[:8]}_{email}" if email else None
            new_login = f"deleted_{uuid.uuid4().hex[:8]}_{login_id}" if login_id else None
            conn.execute(text("UPDATE users SET email = :ne, login_id = :nl, status = 'DELETED' WHERE id = :uid"), {"ne": new_email, "nl": new_login, "uid": u_id})
        
        conn.commit()
    print("EXISTING DB CLEANUP COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    cleanup()
