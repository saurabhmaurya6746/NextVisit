from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr


class OwnerCreate(BaseModel):
    owner_name: str
    owner_email: EmailStr
    password: str


class BusinessInfo(BaseModel):
    business_name: str
    business_type_id: UUID
    phone: str
    country: str
    currency: str
    timezone: str
    address: str


class BusinessCreate(BaseModel):
    business: BusinessInfo
    owner: OwnerCreate


class BusinessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    subscription_status: str