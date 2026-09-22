import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterResponse,
    RegistrationResponse,
    ResendOtpRequest,
    ResendOtpResponse,
    ResendVerificationRequest,
    ResendVerificationResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.schemas.business import BusinessCreate
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    summary="Register a new business and owner account",
)
def register(
    data: BusinessCreate,
    db: Session = Depends(get_db),
):
    """
    Register a new business and owner.
    Creates account in pending/unverified status, generates a 6-digit OTP,
    sends the OTP via Brevo, and prompts for verification.
    """
    return AuthService(db).register(data)


@router.post(
    "/signup",
    summary="Register a new business and owner account (alias for /register)",
)
def signup(
    data: BusinessCreate,
    db: Session = Depends(get_db),
):
    """
    Signup endpoint alias for /register.
    """
    return AuthService(db).register(data)



@router.post(
    "/verify-otp",
    response_model=VerifyOtpResponse,
    summary="Verify registration email using 6-digit OTP",
)
def verify_otp(
    data: VerifyOtpRequest,
    db: Session = Depends(get_db),
):
    """
    Verify submitted 6-digit OTP code against the stored hash.
    Marks the user's email as verified while keeping account in pending admin approval.
    """
    return AuthService(db).verify_otp(email=data.email, otp=data.otp)


@router.post(
    "/resend-otp",
    response_model=ResendOtpResponse,
    summary="Resend registration email OTP",
)
def resend_otp(
    data: ResendOtpRequest,
    db: Session = Depends(get_db),
):
    """
    Enforces a 60-second cooldown, invalidates older unused OTPs,
    and sends a new 6-digit code via Brevo.
    """
    return AuthService(db).resend_otp(email=data.email)


@router.post(
    "/verify-email",
    response_model=VerifyEmailResponse,
    summary="Verify 6-digit OTP code sent during registration",
)
def verify_email(
    data: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    return AuthService(db).verify_email(email=data.email, code=data.code)


@router.post(
    "/resend-verification",
    response_model=ResendVerificationResponse,
    summary="Resend 6-digit OTP code to unverified email",
)
def resend_verification(
    data: ResendVerificationRequest,
    db: Session = Depends(get_db),
):
    return AuthService(db).resend_verification(email=data.email)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate with email + password.
    Returns a signed JWT access token on success.
    Requires email to be verified and business status to be ACTIVE.
    """
    return AuthService(db).login(data)


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Request a password reset link",
)
def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Generate a secure single-use password reset token and dispatch a reset link email.
    Always returns a generic message to prevent account enumeration.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return AuthService(db).forgot_password(
        email=data.email,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    summary="Reset password using a valid reset token",
)
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Validate the token, verify expiration and single-use status,
    and update the user's password.
    """
    return AuthService(db).reset_password(
        token=data.token,
        password=data.password,
        confirm_password=data.confirm_password,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user's profile",
)
def me(
    current_user: User = Depends(get_current_user),
):
    """
    Protected endpoint — requires a valid Bearer JWT.
    Returns the authenticated user's profile:
      id, name, email, role, business_id
    """
    return current_user