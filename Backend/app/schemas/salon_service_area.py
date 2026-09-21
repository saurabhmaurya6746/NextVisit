from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class SalonServiceAreaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_order: int = Field(0, ge=0)
    is_active: bool = True


class SalonServiceAreaUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    display_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class SalonServiceAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SalonServiceAreaReorderItem(BaseModel):
    id: UUID
    display_order: int
