from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ClientDeviceCreate(BaseModel):
    device_name: str = Field(..., min_length=1, max_length=100)
    device_type: str = Field(default="DESKTOP_WINDOWS", max_length=50)
    device_prefix: str = Field(..., min_length=1, max_length=10)
    device_identifier: str | None = Field(default=None, max_length=100)


class ClientDeviceAutoRegister(BaseModel):
    device_name: str = Field(..., min_length=1, max_length=100)
    device_type: str = Field(default="DESKTOP_WINDOWS", max_length=50)
    device_identifier: str = Field(..., min_length=1, max_length=100)


class ClientDeviceUpdate(BaseModel):
    device_name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class ClientDeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    device_name: str
    device_type: str
    device_prefix: str
    device_identifier: str | None = None
    is_active: bool
    last_sync_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
