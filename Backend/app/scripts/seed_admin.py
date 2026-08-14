import logging
from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.admin import Admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_super_admin():
    db = SessionLocal()
    try:
        email = "admin@nextvisit.com"
        existing = db.query(Admin).filter(Admin.email == email).first()
        if not existing:
            admin = Admin(
                name="Super Admin",
                email=email,
                hashed_password=hash_password("Admin@12345"),
                role="SUPER_ADMIN",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            logger.info("Super Admin seeded successfully | email=%s", email)
        else:
            logger.info("Super Admin already exists | email=%s", email)
    except Exception as e:
        db.rollback()
        logger.error("Error seeding Super Admin: %s", e)
    finally:
        db.close()

if __name__ == "__main__":
    seed_super_admin()
