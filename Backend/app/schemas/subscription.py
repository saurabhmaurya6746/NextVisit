from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SubscriptionPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    monthly_price: float
    trial_days: int
    max_customers: int
    max_staff: int
    max_active_devices: int
    max_campaigns_per_month: int
    storage_limit_gb: float
    features: dict[str, Any] | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SubscriptionPlanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    monthly_price: float = Field(default=0.0, ge=0)
    trial_days: int = Field(default=14, ge=0)
    max_customers: int = Field(default=100, ge=1)
    max_staff: int = Field(default=5, ge=1)
    max_active_devices: int | None = Field(default=None, ge=1)
    max_campaigns_per_month: int = Field(default=10, ge=0)
    storage_limit_gb: float = Field(default=1.0, ge=0.1)
    features: dict[str, Any] | None = None
    is_active: bool = True


class SubscriptionPlanUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    monthly_price: float | None = Field(default=None, ge=0)
    trial_days: int | None = Field(default=None, ge=0)
    max_customers: int | None = Field(default=None, ge=1)
    max_staff: int | None = Field(default=None, ge=1)
    max_active_devices: int | None = Field(default=None, ge=1)
    max_campaigns_per_month: int | None = Field(default=None, ge=0)
    storage_limit_gb: float | None = Field(default=None, ge=0.1)
    features: dict[str, Any] | None = None
    is_active: bool | None = None


class BusinessSubscriptionAssignRequest(BaseModel):
    plan_id: UUID
    trial_days: int | None = None
    expiry_date: datetime | None = None
    notes: str | None = None


class BusinessSubscriptionItemResponse(BaseModel):
    business_id: UUID
    business_name: str
    owner_name: str
    email: str
    current_plan: SubscriptionPlanResponse | None = None
    subscription_status: str
    status: str
    trial_end: datetime | None = None
    expiry_date: datetime | None = None
    created_at: datetime


# ── Upgrade Requests & Billing Schemas ─────────────────────────────────────

class SubscriptionUpgradeRequestCreate(BaseModel):
    requested_plan_id: UUID


class SubscriptionUpgradeRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    business_name: str
    owner_name: str
    email: str
    current_plan: SubscriptionPlanResponse | None = None
    requested_plan: SubscriptionPlanResponse
    status: str
    reason: str | None = None
    requested_at: datetime
    approved_by: str | None = None
    approved_at: datetime | None = None
    rejected_by: str | None = None
    rejected_at: datetime | None = None


class PaginatedSubscriptionUpgradeRequestsResponse(BaseModel):
    items: list[SubscriptionUpgradeRequestResponse]
    total: int
    page: int
    limit: int
    pages: int


class SubscriptionUpgradeRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class SubscriptionBillingHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    plan_name: str
    invoice_number: str
    amount: float
    billing_date: datetime
    renewal_date: datetime | None = None
    status: str


class MyPlanResponse(BaseModel):
    current_plan: SubscriptionPlanResponse | None = None
    subscription_status: str
    trial_status: dict[str, Any]
    expiry_date: datetime | None = None
    days_remaining: int | None = None
    features: dict[str, Any]
    limits: dict[str, Any]
    has_pending_request: bool = False
    pending_request: SubscriptionUpgradeRequestResponse | None = None
