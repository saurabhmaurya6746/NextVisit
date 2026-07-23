import uuid

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Service(BaseModel):
    __tablename__ = "services"

    __table_args__ = (
        UniqueConstraint("business_id", "name", name="uq_business_service_name"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    price: Mapped[float] = mapped_column(Float, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    business = relationship(
        "Business",
        back_populates="services",
    )
