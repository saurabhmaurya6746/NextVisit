import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class OwnerCreate(BaseModel):
    owner_name: str
    owner_email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z).")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter (a-z).")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number (0-9).")
        if not re.search(r"[^a-zA-Z0-9]", v):
            raise ValueError("Password must contain at least one special character (e.g. !@#$%^&*()_+-=).")
        return v



class BusinessInfo(BaseModel):
    business_name: str
    business_type_id: UUID
    phone: str
    country: str
    currency: str
    timezone: str
    address: str


class BusinessCreate(BaseModel):
    business: BusinessInfo
    owner: OwnerCreate


class BusinessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    subscription_status: str


# ---------------------------------------------------------------------------
# Business Profile — read
# ---------------------------------------------------------------------------

from app.schemas.business_type import BusinessTypeResponse

class BusinessProfileResponse(BaseModel):
    """Full business profile returned by GET /api/v1/business."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    business_type_id: UUID
    type: str | None = None
    business_type: BusinessTypeResponse | None = None
    owner_name: str
    email: str
    phone: str
    country: str
    currency: str
    timezone: str
    address: str
    logo_url: str | None
    subscription_status: str
    trial_start: datetime | None
    trial_end: datetime | None
    is_active: bool


# ---------------------------------------------------------------------------
# Business Profile — update
# ---------------------------------------------------------------------------

class BusinessProfileUpdate(BaseModel):
    """
    Payload accepted by PUT /api/v1/business.

    All fields are optional so the client can update any subset.
    Immutable fields (id, business_type_id, email, owner_name,
    subscription_status, trial_start, trial_end, created_at, updated_at)
    are intentionally absent from this schema.
    """
    name: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=100)
    currency: str | None = Field(default=None, max_length=20)
    timezone: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=500)
    logo_url: str | None = Field(default=None, max_length=500)