from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.auth import LoginRequest, TokenResponse


class AdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


# Aliases reusing existing auth schemas to avoid duplication
AdminLoginRequest = LoginRequest
AdminTokenResponse = TokenResponse
