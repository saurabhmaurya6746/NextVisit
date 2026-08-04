import uuid
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class SalonServiceArea(BaseModel):
    __tablename__ = "salon_service_areas"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    business = relationship("Business", back_populates="salon_service_areas")
    chairs = relationship(
        "SalonChair",
        back_populates="service_area",
        cascade="all, delete-orphan",
        order_by="SalonChair.display_order",
    )
