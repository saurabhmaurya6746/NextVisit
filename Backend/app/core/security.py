from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# ---------------------------------------------------------------------------
# Password hashing — using bcrypt directly.
#
# passlib 1.7.4 is incompatible with bcrypt >= 4.0.0 because bcrypt 4.x
# dropped the C-extension API that passlib relied on internally.  Rather than
# pinning to an EOL library combination, we call bcrypt directly:
#   • Same bcrypt algorithm and cost factor (default rounds = 12).
#   • No security regression — identical hash output format ($2b$...).
#   • Works with bcrypt 4.x and 5.x on Python 3.12+.
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Return True if *plain_password* matches *hashed_password*."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def create_access_token(
    data: dict[str, Any],
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode = data.copy()
    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )