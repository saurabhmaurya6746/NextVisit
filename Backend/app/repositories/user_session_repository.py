import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user_session import UserSession

logger = logging.getLogger(__name__)


class UserSessionRepository:

    def __init__(self, db: Session):
        self.db = db

    def register_or_update_session(
        self,
        user_id: uuid.UUID,
        business_id: uuid.UUID,
        device_id: str,
        device_name: str | None = None,
        device_type: str | None = None,
        platform: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        jwt_id: str | None = None,
    ) -> UserSession:
        """Register a new device session or update last_seen on an existing active session."""
        now = datetime.now(timezone.utc)
        stmt = select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.device_id == device_id,
            UserSession.is_active == True,
        )
        session = self.db.scalar(stmt)

        if session:
            session.last_seen = now
            if device_name:
                session.device_name = device_name
            if ip_address:
                session.ip_address = ip_address
            if jwt_id:
                session.jwt_id = jwt_id
            logger.info("Updated existing active device session: user_id=%s, device_id=%s", user_id, device_id)
        else:
            session = UserSession(
                user_id=user_id,
                business_id=business_id,
                device_id=device_id,
                device_name=device_name or "Web Browser",
                device_type=device_type or "Desktop",
                platform=platform or "Web",
                ip_address=ip_address,
                user_agent=user_agent,
                jwt_id=jwt_id,
                login_at=now,
                last_seen=now,
                is_active=True,
            )
            self.db.add(session)
            logger.info("Registered new active device session: user_id=%s, device_id=%s", user_id, device_id)

        self.db.commit()
        self.db.refresh(session)
        return session

    def deactivate_session(self, session_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Mark a specific device session inactive (logout/revoke)."""
        now = datetime.now(timezone.utc)
        stmt = select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )
        session = self.db.scalar(stmt)
        if not session:
            return False

        session.is_active = False
        session.logout_at = now
        self.db.commit()
        logger.info("Deactivated device session: session_id=%s, user_id=%s", session_id, user_id)
        return True

    def list_active_sessions(self, user_id: uuid.UUID) -> list[UserSession]:
        """List all active device sessions for a given user."""
        stmt = (
            select(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.is_active == True,
            )
            .order_by(UserSession.last_seen.desc())
        )
        return list(self.db.scalars(stmt).all())

    def count_active_sessions(self, user_id: uuid.UUID) -> int:
        """Count total active device sessions for a given user."""
        stmt = select(func.count(UserSession.id)).where(
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )
        return self.db.scalar(stmt) or 0

    def deactivate_all_user_sessions(self, user_id: uuid.UUID) -> int:
        """Deactivate all sessions for a user (e.g. global logout / password change)."""
        now = datetime.now(timezone.utc)
        stmt = select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )
        active_sessions = list(self.db.scalars(stmt).all())
        for s in active_sessions:
            s.is_active = False
            s.logout_at = now
        self.db.commit()
        return len(active_sessions)
