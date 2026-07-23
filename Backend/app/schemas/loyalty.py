from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoyaltySettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    points_per_amount: float
    amount_required: float
    redeem_rate: float
    minimum_redeem_points: int
    is_active: bool


class LoyaltySettingsUpdate(BaseModel):
    points_per_amount: float | None = Field(default=None, gt=0)
    amount_required: float | None = Field(default=None, gt=0)
    redeem_rate: float | None = Field(default=None, gt=0)
    minimum_redeem_points: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class CustomerLoyaltyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    current_points: int
    lifetime_points: int
    redeemed_points: int


class LoyaltyRedeemRequest(BaseModel):
    customer_id: UUID
    points: int = Field(..., gt=0)


class LoyaltyRedeemResponse(BaseModel):
    customer_id: UUID
    points_redeemed: int
    discount_amount: float
    remaining_points: int
