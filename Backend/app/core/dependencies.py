"""
core/dependencies.py
--------------------
Reusable FastAPI dependencies for the NextVisit backend.

Currently provides:
  - get_current_user()  →  decodes the Bearer JWT, loads the User row,
                           and returns the authenticated User ORM object.
"""
import logging
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.admin import Admin
from app.models.user import User
from app.repositories.admin_repository import AdminRepository
from app.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

# HTTPBearer extracts the token from the "Authorization: Bearer <token>" header.
# auto_error=False lets us return a structured 401 instead of FastAPI's default.
_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the JWT from the Authorization header and return the matching User.

    Raises HTTP 401 if:
      - No token is provided.
      - The token is malformed or has an invalid signature.
      - The token has expired.
      - The 'sub' claim is missing or does not match a live user record.
    """
    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        logger.warning("Request rejected — no Authorization header provided")
        raise _unauthorized

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except ExpiredSignatureError:
        logger.warning("Request rejected — JWT has expired")
        raise _unauthorized
    except JWTError as exc:
        logger.warning("Request rejected — JWT decode failed | error=%s", str(exc))
        raise _unauthorized

    user_id_raw: str | None = payload.get("sub")
    if not user_id_raw:
        logger.warning("Request rejected — JWT missing 'sub' claim")
        raise _unauthorized

    try:
        user_id = UUID(user_id_raw)
    except ValueError:
        logger.warning(
            "Request rejected — JWT 'sub' is not a valid UUID | sub=%s", user_id_raw
        )
        raise _unauthorized

    user_repo = UserRepository(db)
    user: User | None = user_repo.get_by_id(user_id)

    if user is None:
        logger.warning(
            "Request rejected — JWT subject not found in DB | user_id=%s", user_id
        )
        raise _unauthorized

    if not user.is_active:
        logger.warning(
            "Request rejected — user account is inactive | user_id=%s", user_id
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Returns the authenticated User if a valid Bearer JWT is provided.
    Otherwise, for public endpoints (such as public QR ordering), falls back
    to returning the active business User record from the database.
    """
    if credentials:
        try:
            return get_current_user(credentials, db)
        except HTTPException:
            pass

    from sqlalchemy import select
    stmt = select(User).where(User.is_active.is_(True)).order_by(User.created_at.asc())
    user = db.scalar(stmt)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active restaurant business profile found.",
        )
    return user


def get_current_super_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> Admin:
    """
    Decode the JWT from the Authorization header and return the matching Super Admin.

    Raises HTTP 401 if token is missing, invalid, or expired.
    Raises HTTP 403 if the admin account is deactivated or role is not SUPER_ADMIN.
    """
    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        logger.warning("Admin request rejected — no Authorization header provided")
        raise _unauthorized

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except ExpiredSignatureError:
        logger.warning("Admin request rejected — JWT has expired")
        raise _unauthorized
    except JWTError as exc:
        logger.warning("Admin request rejected — JWT decode failed | error=%s", str(exc))
        raise _unauthorized

    admin_id_raw: str | None = payload.get("sub")
    if not admin_id_raw:
        logger.warning("Admin request rejected — JWT missing 'sub' claim")
        raise _unauthorized

    try:
        admin_id = UUID(admin_id_raw)
    except ValueError:
        logger.warning("Admin request rejected — JWT 'sub' is not a valid UUID | sub=%s", admin_id_raw)
        raise _unauthorized

    admin_repo = AdminRepository(db)
    admin: Admin | None = admin_repo.get_by_id(admin_id)

    if admin is None:
        logger.warning("Admin request rejected — JWT subject not found in admins DB | admin_id=%s", admin_id)
        raise _unauthorized

    if not admin.is_active:
        logger.warning("Admin request rejected — admin account is inactive | admin_id=%s", admin_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This admin account has been deactivated.",
        )

    if admin.role != "SUPER_ADMIN":
        logger.warning("Admin request rejected — non-super-admin role | admin_id=%s role=%s", admin.id, admin.role)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied — Super Admin permissions required.",
        )

    return admin
