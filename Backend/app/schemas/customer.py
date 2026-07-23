from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerCreate(BaseModel):
    name: str = Field(..., max_length=150)
    phone: str = Field(..., max_length=20)
    email: EmailStr | None = None
    gender: str | None = Field(default=None, max_length=20)
    birth_date: date | None = None
    anniversary_date: date | None = None
    address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    gender: str | None = Field(default=None, max_length=20)
    birth_date: date | None = None
    anniversary_date: date | None = None
    address: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    phone: str
    email: str | None
    gender: str | None
    birth_date: date | None
    anniversary_date: date | None
    address: str | None
    notes: str | None
    visit_count: int
    total_spent: float
    first_visit_at: datetime | None
    last_visit_at: datetime | None
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Customer Segmentation Schemas
# ---------------------------------------------------------------------------

class SegmentCustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    last_visit_at: datetime | None
    visit_count: int
    total_spent: float


class CustomerSegmentsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    new_customers: list[SegmentCustomerResponse]
    inactive_15_days: list[SegmentCustomerResponse]
    inactive_30_days: list[SegmentCustomerResponse]
    inactive_60_days: list[SegmentCustomerResponse]
    inactive_90_days: list[SegmentCustomerResponse]
    birthday_today: list[SegmentCustomerResponse]
    anniversary_today: list[SegmentCustomerResponse]
    vip_customers: list[SegmentCustomerResponse]

