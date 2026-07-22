from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    business_id: Mapped[UUID] = mapped_column(
        ForeignKey("businesses.id"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    email: Mapped[str] = mapped_column(
        String(150),
        unique=True,
        nullable=False,
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(50),
        default="OWNER",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    business = relationship(
        "Business",
        back_populates="users",
    )