from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PlatformSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    platform_name: str
    logo_url: str | None = None
    support_email: EmailStr
    support_phone: str | None = None
    default_plan: str
    trial_days: int
    default_currency: str
    max_clients: int
    maintenance_mode: bool
    allow_new_registrations: bool
    created_at: datetime
    updated_at: datetime


class PlatformSettingsUpdate(BaseModel):
    platform_name: str | None = Field(default=None, min_length=1, max_length=150)
    logo_url: str | None = Field(default=None, max_length=500)
    support_email: EmailStr | None = None
    support_phone: str | None = Field(default=None, max_length=50)
    default_plan: str | None = Field(default=None, max_length=50)
    trial_days: int | None = Field(default=None, ge=0, le=365)
    default_currency: str | None = Field(default=None, min_length=1, max_length=20)
    max_clients: int | None = Field(default=None, ge=1, le=1000000)
    maintenance_mode: bool | None = None
    allow_new_registrations: bool | None = None
