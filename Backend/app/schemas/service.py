from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ServiceCreate(BaseModel):
    name: str = Field(..., max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    price: float = Field(..., ge=0)
    duration_minutes: int = Field(..., gt=0)
    category: str | None = Field(default=None, max_length=100)
    is_active: bool = True


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    price: float | None = Field(default=None, ge=0)
    duration_minutes: int | None = Field(default=None, gt=0)
    category: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    description: str | None
    price: float
    duration_minutes: int
    category: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
