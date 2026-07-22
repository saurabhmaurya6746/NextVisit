from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    role: str
    is_active: bool


# ---------------------------------------------------------------------------
# Staff Management Schemas
# ---------------------------------------------------------------------------

class StaffCreate(BaseModel):
    name: str = Field(..., max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(default="STAFF")


class StaffUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    role: str | None = Field(default=None)


class StaffResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime