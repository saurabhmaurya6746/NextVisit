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
from app.models.user import User
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
