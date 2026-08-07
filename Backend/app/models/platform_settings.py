from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class PlatformSettings(BaseModel):
    __tablename__ = "platform_settings"

    platform_name: Mapped[str] = mapped_column(
        String(150),
        default="NextVisit",
        nullable=False,
    )

    logo_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    support_email: Mapped[str] = mapped_column(
        String(150),
        default="support@nextvisit.com",
        nullable=False,
    )

    support_phone: Mapped[str | None] = mapped_column(
        String(50),
        default="+91 98765 43210",
        nullable=True,
    )

    default_plan: Mapped[str] = mapped_column(
        String(50),
        default="STARTER",
        nullable=False,
    )

    trial_days: Mapped[int] = mapped_column(
        Integer,
        default=14,
        nullable=False,
    )

    default_currency: Mapped[str] = mapped_column(
        String(20),
        default="INR",
        nullable=False,
    )

    max_clients: Mapped[int] = mapped_column(
        Integer,
        default=1000,
        nullable=False,
    )

    maintenance_mode: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    allow_new_registrations: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
