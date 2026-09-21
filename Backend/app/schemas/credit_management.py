from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AiCreditPackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    ai_credits: int
    price: float
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class AiCreditPackCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    ai_credits: int = Field(..., ge=1)
    price: float = Field(..., ge=0.0)
    is_active: bool = True
    sort_order: int = Field(default=0, ge=0)


class AiCreditPackUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    ai_credits: int | None = Field(default=None, ge=1)
    price: float | None = Field(default=None, ge=0.0)
    is_active: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class CreditManagementAnalyticsResponse(BaseModel):
    total_businesses: int
    total_ai_credits_used_this_month: int
    businesses_near_limit: int
    businesses_out_of_credits: int
    total_purchased_credits_sold: int


class AiCreditPurchaseRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    business_name: str | None = None
    merchant_name: str | None = None
    merchant_email: str | None = None
    current_plan_name: str | None = None
    current_ai_credits: int | None = 0
    pack_id: UUID | None = None
    pack_name: str
    ai_credits: int
    amount: float
    payment_status: str
    approval_status: str
    requested_at: datetime
    approved_at: datetime | None = None
    approved_by_admin_name: str | None = None
    rejection_reason: str | None = None
    created_at: datetime
    updated_at: datetime


class RejectAiCreditPurchaseRequestPayload(BaseModel):
    reason: str = Field(..., min_length=1, description="Rejection reason: Payment Not Received | Duplicate Request | Invalid Request | Other")
    notes: str | None = None
