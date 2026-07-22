from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class BusinessType(BaseModel):
    __tablename__ = "business_types"

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )