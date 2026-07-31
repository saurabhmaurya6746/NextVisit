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
    city: str | None = None
    state: str | None = None
    gst_number: str | None = None
    opening_time: str | None = None
    closing_time: str | None = None
    enable_qr_ordering: bool = True
    enable_staff_ordering: bool = True
    enable_parcel: bool = True
    enable_takeaway: bool = True
    invoice_prefix: str = "INV-"
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
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    gst_number: str | None = Field(default=None, max_length=50)
    opening_time: str | None = Field(default=None, max_length=20)
    closing_time: str | None = Field(default=None, max_length=20)
    enable_qr_ordering: bool | None = None
    enable_staff_ordering: bool | None = None
    enable_parcel: bool | None = None
    enable_takeaway: bool | None = None
    invoice_prefix: str | None = Field(default=None, max_length=20)
    tax_percentage: float | None = Field(default=None, ge=0)
    service_charge: float | None = Field(default=None, ge=0)
    payment_qr_image: str | None = Field(default=None, max_length=500)
    payment_upi_id: str | None = Field(default=None, max_length=100)
    default_discount: float | None = Field(default=None, ge=0)
    review_link: str | None = Field(default=None, max_length=500)
    booking_link: str | None = Field(default=None, max_length=500)
    logo: str | None = Field(default=None, max_length=500)
    cover_image: str | None = Field(default=None, max_length=500)


class RestaurantSetupSettingsResponse(BaseModel):
    name: str
    phone: str
    email: str
    address: str
    city: str | None = None
    state: str | None = None
    country: str
    gst_number: str | None = None
    currency: str
    timezone: str
    opening_time: str | None = "09:00 AM"
    closing_time: str | None = "10:00 PM"
    enable_qr_ordering: bool = True
    enable_staff_ordering: bool = True
    enable_parcel: bool = True
    enable_takeaway: bool = True
    tax_percentage: float = 5.0
    invoice_prefix: str = "INV-"
    is_saved: bool = True


class RestaurantSetupSettingsUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    phone: str = Field(..., min_length=1, max_length=20)
    email: str = Field(..., min_length=1, max_length=150)
    address: str = Field(..., min_length=1, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str = Field(..., min_length=1, max_length=100)
    gst_number: str | None = Field(default=None, max_length=50)
    currency: str = Field(..., min_length=1, max_length=20)
    timezone: str = Field(..., min_length=1, max_length=100)
    opening_time: str | None = Field(default="09:00 AM", max_length=20)
    closing_time: str | None = Field(default="10:00 PM", max_length=20)
    enable_qr_ordering: bool = True
    enable_staff_ordering: bool = True
    enable_parcel: bool = True
    enable_takeaway: bool = True
    tax_percentage: float = Field(default=5.0, ge=0.0)
    invoice_prefix: str = Field(default="INV-", max_length=20)

