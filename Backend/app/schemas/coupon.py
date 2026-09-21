from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class CouponBase(BaseModel):
    code: str = Field(..., max_length=50, description="Unique coupon code, e.g. WELCOME10")
    name: str = Field(..., max_length=100, description="Display name of the coupon")
    description: str | None = None
    coupon_type: str = Field(default="PERCENTAGE", description="PERCENTAGE, FLAT, FREE_ITEM, BOGO")
    reward_value: float = Field(default=0.0, ge=0.0, description="Discount amount or percentage value")
    reward_description: str | None = None
    max_discount_amount: float | None = Field(default=None, ge=0.0)
    min_order_amount: float = Field(default=0.0, ge=0.0)
    max_usage: int | None = Field(default=None, ge=1)
    per_customer_limit: int = Field(default=1, ge=1)
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    applicable_segment: str = Field(default="ALL")
    status: str = Field(default="ACTIVE")


class CouponCreate(CouponBase):
    pass


class CouponUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    coupon_type: str | None = None
    reward_value: float | None = None
    reward_description: str | None = None
    max_discount_amount: float | None = None
    min_order_amount: float | None = None
    max_usage: int | None = None
    per_customer_limit: int | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    applicable_segment: str | None = None
    status: str | None = None


class CouponResponse(CouponBase):
    id: UUID
    business_id: UUID
    redeemed_count: int
    is_deleted: bool
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    computed_status: str

    model_config = ConfigDict(from_attributes=True)


class PaginatedCouponsResponse(BaseModel):
    items: list[CouponResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


class CouponValidateRequest(BaseModel):
    code: str
    customer_id: UUID | None = None
    order_amount: float = 0.0


class CouponValidateResponse(BaseModel):
    valid: bool
    reason: str | None = None
    coupon: CouponResponse | None = None
    calculated_discount: float = 0.0


class CouponRedeemRequest(BaseModel):
    code: str
    customer_id: UUID
    order_id: UUID | None = None
    visit_id: UUID | None = None
    order_amount: float = 0.0
