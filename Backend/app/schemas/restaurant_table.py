from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class RestaurantTableResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    dining_area_id: UUID
    table_name: str
    capacity: int
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RestaurantTableCreate(BaseModel):
    dining_area_id: UUID
    table_name: str = Field(..., min_length=1, max_length=100)
    capacity: int = Field(4, ge=1, le=100)
    display_order: int = Field(0, ge=0)
    is_active: bool = True


class RestaurantTableUpdate(BaseModel):
    dining_area_id: UUID | None = None
    table_name: str | None = Field(default=None, min_length=1, max_length=100)
    capacity: int | None = Field(default=None, ge=1, le=100)
    display_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class TableMapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    table_name: str
    capacity: int
    display_order: int
    is_active: bool
    status: str = "EMPTY"
    current_order_id: UUID | None = None
    pending_amount: float = 0.0
    item_count: int = 0
    order_source: str | None = None
    last_updated: datetime | str | None = None
