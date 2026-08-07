import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

INDIAN_GST_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


class BusinessSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID

    # 1. General Settings
    city: str | None = None
    state: str | None = None
    gst_number: str | None = None
    opening_time: str | None = None
    closing_time: str | None = None
    website: str | None = None

    # 2. WhatsApp Settings
    whatsapp_number: str | None = None
    default_country_code: str = "+91"
    default_message_signature: str | None = None
    enable_whatsapp_campaigns: bool = True
    enable_welcome_messages: bool = True
    review_booster_enabled: bool = True
    recovery_enabled: bool = True

    # 3. Google Settings
    review_link: str | None = None
    maps_link: str | None = None
    booking_link: str | None = None

    # 4. Invoice Settings
    invoice_prefix: str = "INV-"
    invoice_footer: str | None = None
    show_gst_on_invoice: bool = True
    show_qr_on_invoice: bool = True
    auto_print_invoice: bool = False

    # 5. Tax & Currency Settings
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    language: str = "en"
    enable_gst: bool = True
    tax_percentage: float = 18.0
    price_includes_gst: bool = False
    service_charge: float = 0.0
    round_off_bill: bool = True

    # 6. Notification Settings
    notify_orders: bool = True
    notify_qr_orders: bool = True
    notify_campaigns: bool = True
    notify_reviews: bool = True
    notify_email: bool = True

    # 7. AI Settings
    review_booster_ai_enabled: bool = True
    ai_default_tone: str = "Friendly"
    ai_max_monthly_requests: int = 500

    # 8. POS Settings
    enable_qr_ordering: bool = True
    enable_staff_ordering: bool = True
    enable_parcel: bool = True
    enable_takeaway: bool = True
    enable_dine_in: bool = True
    pos_auto_complete_order: bool = False
    pos_auto_free_table: bool = True
    pos_default_payment_method: str = "CASH"

    # Branding & Payments
    payment_qr_image: str | None = None
    payment_upi_id: str | None = None
    logo: str | None = None
    cover_image: str | None = None
    default_discount: float = 0.0

    created_at: datetime
    updated_at: datetime


class BusinessSettingsUpdate(BaseModel):
    # 1. General
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    gst_number: str | None = Field(default=None, max_length=50)
    opening_time: str | None = Field(default=None, max_length=20)
    closing_time: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=255)

    # 2. WhatsApp
    whatsapp_number: str | None = Field(default=None, max_length=20)
    default_country_code: str | None = Field(default=None, max_length=10)
    default_message_signature: str | None = Field(default=None, max_length=255)
    enable_whatsapp_campaigns: bool | None = None
    enable_welcome_messages: bool | None = None
    review_booster_enabled: bool | None = None
    recovery_enabled: bool | None = None

    # 3. Google
    review_link: str | None = Field(default=None, max_length=500)
    maps_link: str | None = Field(default=None, max_length=500)
    booking_link: str | None = Field(default=None, max_length=500)

    # 4. Invoice
    invoice_prefix: str | None = Field(default=None, max_length=20)
    invoice_footer: str | None = Field(default=None, max_length=255)
    show_gst_on_invoice: bool | None = None
    show_qr_on_invoice: bool | None = None
    auto_print_invoice: bool | None = None

    # 5. Tax & Currency
    currency: str | None = Field(default=None, max_length=10)
    timezone: str | None = Field(default=None, max_length=50)
    language: str | None = Field(default=None, max_length=10)
    enable_gst: bool | None = None
    tax_percentage: float | None = Field(default=None, ge=0, le=100)
    price_includes_gst: bool | None = None
    service_charge: float | None = Field(default=None, ge=0)
    round_off_bill: bool | None = None

    # 6. Notifications
    notify_orders: bool | None = None
    notify_qr_orders: bool | None = None
    notify_campaigns: bool | None = None
    notify_reviews: bool | None = None
    notify_email: bool | None = None

    # 7. AI
    review_booster_ai_enabled: bool | None = None
    ai_default_tone: str | None = Field(default=None, max_length=50)
    ai_max_monthly_requests: int | None = Field(default=None, ge=1)

    # 8. POS
    enable_qr_ordering: bool | None = None
    enable_staff_ordering: bool | None = None
    enable_parcel: bool | None = None
    enable_takeaway: bool | None = None
    enable_dine_in: bool | None = None
    pos_auto_complete_order: bool | None = None
    pos_auto_free_table: bool | None = None
    pos_default_payment_method: str | None = Field(default=None, max_length=20)

    # Branding & Payments
    payment_qr_image: str | None = Field(default=None, max_length=500)
    payment_upi_id: str | None = Field(default=None, max_length=100)
    logo: str | None = Field(default=None, max_length=500)
    cover_image: str | None = Field(default=None, max_length=500)
    default_discount: float | None = Field(default=None, ge=0)

    @field_validator("gst_number")
    @classmethod
    def validate_gst_number(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v_clean = v.strip().upper()
        if not v_clean:
            return None
        if not INDIAN_GST_REGEX.match(v_clean):
            raise ValueError("Invalid Indian GST Number format. Example: 22AAAAA0000A1Z5")
        return v_clean

    @field_validator("tax_percentage")
    @classmethod
    def validate_tax_percentage(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if v < 0 or v > 100:
            raise ValueError("GST Percentage must be between 0 and 100")
        return round(v, 2)


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


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1)


class Toggle2faRequest(BaseModel):
    enable: bool


class UserSessionItemResponse(BaseModel):
    id: UUID
    ip_address: str | None = None
    user_agent: str | None = None
    is_active: bool
    last_active_at: datetime
    created_at: datetime
