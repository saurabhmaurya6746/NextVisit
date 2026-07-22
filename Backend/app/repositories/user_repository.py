from uuid import UUID

from sqlalchemy import select

from app.models.user import User
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository):

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self.db.scalar(stmt)

    def get_by_id(self, user_id: UUID) -> User | None:
        stmt = select(User).where(User.id == user_id)
        return self.db.scalar(stmt)

    def get_by_business_id(
        self, business_id: UUID, only_active: bool = True
    ) -> list[User]:
        stmt = select(User).where(User.business_id == business_id)
        if only_active:
            stmt = stmt.where(User.is_active.is_(True))
        stmt = stmt.order_by(User.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def get_by_business_and_email(
        self, business_id: UUID, email: str
    ) -> User | None:
        stmt = select(User).where(
            User.business_id == business_id, User.email == email
        )
        return self.db.scalar(stmt)

    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        self.db.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.db.flush()
        self.db.refresh(user)
        return user