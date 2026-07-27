from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.approval import BusinessTypeResponse


class ClientListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_name: str
    email: EmailStr
    phone: str
    country: str
    subscription_status: str
    status: str
    created_at: datetime
    approved_at: datetime | None = None
    last_login: datetime | None = None
    business_type: BusinessTypeResponse | None = None


class PaginatedClientListResponse(BaseModel):
    items: list[ClientListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ClientStatsResponse(BaseModel):
    customer_count: int = 0
    service_count: int = 0
    visit_count: int = 0
    campaign_count: int = 0
    loyalty_enabled: bool = False


class ClientDetailResponse(BaseModel):
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
    subscription_status: str
    status: str
    rejection_reason: str | None = None
    created_at: datetime
    approved_at: datetime | None = None
    last_login: datetime | None = None
    business_type: BusinessTypeResponse | None = None
    stats: ClientStatsResponse
    settings: dict | None = None


class ClientStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Must be ACTIVE or SUSPENDED")


class ImpersonateTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    business_id: UUID
    business_name: str
