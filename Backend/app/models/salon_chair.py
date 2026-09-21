import uuid
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class SalonChair(BaseModel):
    __tablename__ = "salon_chairs"

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )

    service_area_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salon_service_areas.id", ondelete="CASCADE"),
        nullable=False,
    )

    chair_name: Mapped[str] = mapped_column(String(100), nullable=False)
    chair_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    workstation_type: Mapped[str] = mapped_column(String(50), default="Chair", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Available", nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    service_area = relationship("SalonServiceArea", back_populates="chairs")
    business = relationship("Business")
