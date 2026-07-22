import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
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
    response_model=TokenResponse,
    summary="Register a new business and owner account",
)
def register(
    data: BusinessCreate,
    db: Session = Depends(get_db),
):
    return AuthService(db).register(data)


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
    Returns HTTP 401 for invalid credentials.
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