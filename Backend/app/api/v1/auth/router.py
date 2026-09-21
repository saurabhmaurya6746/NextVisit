import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RegistrationResponse,
    ResendOtpRequest,
    ResendOtpResponse,
    TokenResponse,
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
    response_model=RegistrationResponse,
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