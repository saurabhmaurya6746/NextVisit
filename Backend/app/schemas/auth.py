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