from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class BusinessTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class BusinessApprovalResponse(BaseModel):
    """Schema returning full signup/approval details of a merchant."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_name: str
    email: EmailStr
    phone: str
    country: str
    currency: str
    timezone: str
    address: str
    logo_url: str | None = None
    status: str
    rejection_reason: str | None = None
    created_at: datetime
    approved_at: datetime | None = None
    business_type: BusinessTypeResponse | None = None


class PaginatedApprovalResponse(BaseModel):
    items: list[BusinessApprovalResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class BusinessRejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
