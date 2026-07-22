from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OwnerCreate(BaseModel):
    owner_name: str
    owner_email: EmailStr
    password: str


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

class BusinessProfileResponse(BaseModel):
    """Full business profile returned by GET /api/v1/business."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    business_type_id: UUID
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