from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean or "@" not in clean or "." not in clean:
            raise ValueError("A valid email address is required.")
        return clean


class ForgotPasswordResponse(BaseModel):
    message: str = (
        "If an account exists with this email, we've sent you a password reset link. "
        "Please check your inbox."
    )


class RegisterResponse(BaseModel):
    success: bool = True
    requires_email_verification: bool = True
    email: str
    message: str = "Verification code sent to your email."


class VerifyEmailRequest(BaseModel):
    email: str
    code: str

    @field_validator("email")
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean or "@" not in clean or "." not in clean:
            raise ValueError("A valid email address is required.")
        return clean

    @field_validator("code")
    def validate_code_format(cls, v: str) -> str:
        clean = v.strip()
        if not clean or not clean.isdigit() or len(clean) != 6:
            raise ValueError("Verification code must be a 6-digit number.")
        return clean


class VerifyEmailResponse(BaseModel):
    success: bool = True
    email_verified: bool = True
    status: str = "ADMIN_PENDING"
    message: str = "Email verified successfully. Your registration request has been sent for admin approval."


class ResendVerificationRequest(BaseModel):
    email: str

    @field_validator("email")
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean or "@" not in clean or "." not in clean:
            raise ValueError("A valid email address is required.")
        return clean


class ResendVerificationResponse(BaseModel):
    success: bool = True
    message: str = "A new verification code has been sent."


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str

    @field_validator("token")
    def validate_token_non_empty(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Reset token is required.")
        return clean


class ResetPasswordResponse(BaseModel):
    message: str = (
        "Your password has been updated successfully. You can now sign in with your new password."
    )