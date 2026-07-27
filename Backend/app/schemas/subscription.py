from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SubscriptionPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    monthly_price: float
    trial_days: int
    max_customers: int
    max_staff: int
    max_active_devices: int = 5
    max_campaigns_per_month: int
    storage_limit_gb: float
    features: dict[str, Any] | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SubscriptionPlanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    monthly_price: float = Field(0.0, ge=0.0)
    trial_days: int = Field(14, ge=0, le=365)
    max_customers: int = Field(100, ge=1)
    max_staff: int = Field(5, ge=1)
    max_active_devices: int = Field(5, ge=1)
    max_campaigns_per_month: int = Field(10, ge=0)
    storage_limit_gb: float = Field(1.0, ge=0.1)
    features: dict[str, Any] | None = None
    is_active: bool = True


class SubscriptionPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    monthly_price: float | None = Field(default=None, ge=0.0)
    trial_days: int | None = Field(default=None, ge=0, le=365)
    max_customers: int | None = Field(default=None, ge=1)
    max_staff: int | None = Field(default=None, ge=1)
    max_active_devices: int | None = Field(default=None, ge=1)
    max_campaigns_per_month: int | None = Field(default=None, ge=0)
    storage_limit_gb: float | None = Field(default=None, ge=0.1)
    features: dict[str, Any] | None = None
    is_active: bool | None = None


class BusinessSubscriptionAssignRequest(BaseModel):
    plan_id: UUID
    trial_days: int | None = Field(default=None, ge=0)
    expiry_date: datetime | None = None
    notes: str | None = Field(default=None, max_length=500)


class BusinessSubscriptionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    business_id: UUID
    business_name: str
    owner_name: str
    email: EmailStr
    current_plan: SubscriptionPlanResponse | None = None
    subscription_status: str
    status: str
    trial_end: datetime | None = None
    expiry_date: datetime | None = None
    created_at: datetime
