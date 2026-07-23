from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BusinessSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    currency: str
    timezone: str
    language: str
    tax_percentage: float
    service_charge: float
    payment_qr_image: str | None
    payment_upi_id: str | None
    default_discount: float
    review_link: str | None
    booking_link: str | None
    logo: str | None
    cover_image: str | None
    created_at: datetime
    updated_at: datetime


class BusinessSettingsUpdate(BaseModel):
    currency: str | None = Field(default=None, max_length=10)
    timezone: str | None = Field(default=None, max_length=50)
    language: str | None = Field(default=None, max_length=10)
    tax_percentage: float | None = Field(default=None, ge=0)
    service_charge: float | None = Field(default=None, ge=0)
    payment_qr_image: str | None = Field(default=None, max_length=500)
    payment_upi_id: str | None = Field(default=None, max_length=100)
    default_discount: float | None = Field(default=None, ge=0)
    review_link: str | None = Field(default=None, max_length=500)
    booking_link: str | None = Field(default=None, max_length=500)
    logo: str | None = Field(default=None, max_length=500)
    cover_image: str | None = Field(default=None, max_length=500)
