from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


# -----------------------------------------------------------------------------
# MENU ITEM SCHEMAS
# -----------------------------------------------------------------------------

class MenuItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    business_id: UUID
    name: str
    description: str | None = None
    price: float
    gst_percentage: float
    is_veg: bool
    is_available: bool
    display_order: int
    created_at: datetime
    updated_at: datetime


class MenuItemCreate(BaseModel):
    category_id: UUID
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    price: float = Field(..., ge=0.0)
    gst_percentage: float = Field(0.0, ge=0.0, le=100.0)
    is_veg: bool = True
    is_available: bool = True
    display_order: int = Field(0, ge=0)


class MenuItemUpdate(BaseModel):
    category_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    price: float | None = Field(default=None, ge=0.0)
    gst_percentage: float | None = Field(default=None, ge=0.0, le=100.0)
    is_veg: bool | None = None
    is_available: bool | None = None
    display_order: int | None = Field(default=None, ge=0)


# -----------------------------------------------------------------------------
# MENU CATEGORY SCHEMAS
# -----------------------------------------------------------------------------

class MenuCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    display_order: int
    is_active: bool
    items: list[MenuItemResponse] = []
    created_at: datetime
    updated_at: datetime


class MenuCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_order: int = Field(0, ge=0)
    is_active: bool = True


class MenuCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    display_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
