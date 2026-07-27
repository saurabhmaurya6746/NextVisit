from uuid import UUID

from sqlalchemy.orm import Session

from app.models.admin import Admin


class AdminRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, admin_id: UUID) -> Admin | None:
        return self.db.query(Admin).filter(Admin.id == admin_id).first()

    def get_by_email(self, email: str) -> Admin | None:
        return self.db.query(Admin).filter(Admin.email == email).first()

    def create(self, admin: Admin) -> Admin:
        self.db.add(admin)
        self.db.flush()
        return admin
