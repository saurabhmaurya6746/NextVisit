from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegistrationResponse(BaseModel):
    message: str
    email: EmailStr
    requires_verification: bool = True


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class VerifyOtpResponse(BaseModel):
    message: str
    verified: bool = True


class ResendOtpRequest(BaseModel):
    email: EmailStr


class ResendOtpResponse(BaseModel):
    message: str