from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class SalonChairCreate(BaseModel):
    service_area_id: UUID
    chair_name: str = Field(..., min_length=1, max_length=100)
    chair_number: str | None = Field(default=None, max_length=50)
    workstation_type: str = Field("Chair", max_length=50)
    status: str = Field("Available", max_length=30)
    display_order: int = Field(0, ge=0)
    is_active: bool = True


class SalonChairUpdate(BaseModel):
    service_area_id: UUID | None = None
    chair_name: str | None = Field(default=None, min_length=1, max_length=100)
    chair_number: str | None = Field(default=None, max_length=50)
    workstation_type: str | None = Field(default=None, max_length=50)
    status: str | None = Field(default=None, max_length=30)
    display_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class SalonChairStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=30)


class SalonChairResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    service_area_id: UUID
    chair_name: str
    chair_number: str | None
    workstation_type: str
    status: str
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SalonChairMapItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chair_name: str
    chair_number: str | None
    workstation_type: str
    status: str
    display_order: int
    is_active: bool


class SalonServiceAreaMapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    display_order: int
    is_active: bool
    chairs: list[SalonChairMapItemResponse] = []


class SalonDashboardChairMetrics(BaseModel):
    available: int = 0
    occupied: int = 0
    reserved: int = 0
    cleaning: int = 0
    total: int = 0
