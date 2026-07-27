from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.restaurant_table import RestaurantTableResponse, TableMapResponse


class DiningAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    display_order: int
    color: str | None = None
    is_active: bool
    tables: list[RestaurantTableResponse] = []
    created_at: datetime
    updated_at: datetime


class DiningAreaMapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    display_order: int
    color: str | None = None
    is_active: bool
    tables: list[TableMapResponse] = []


class DiningAreaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_order: int = Field(0, ge=0)
    color: str | None = Field(default=None, max_length=50)
    is_active: bool = True


class DiningAreaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    display_order: int | None = Field(default=None, ge=0)
    color: str | None = Field(default=None, max_length=50)
    is_active: bool | None = None
