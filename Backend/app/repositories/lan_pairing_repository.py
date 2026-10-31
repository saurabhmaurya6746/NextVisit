from datetime import datetime, timezone
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.lan_pairing import LanDevicePairing, LanPairingSession

logger = logging.getLogger(__name__)


class LanPairingRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_pairing_session(
        self,
        business_id: UUID,
        created_by_user_id: UUID,
        pairing_code: str,
        expires_at: datetime,
    ) -> LanPairingSession:
        session = LanPairingSession(
            business_id=business_id,
            created_by_user_id=created_by_user_id,
            pairing_code=pairing_code,
            expires_at=expires_at,
            is_claimed=False,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_valid_pairing_session(
        self, business_id: UUID, pairing_code: str, now: datetime
    ) -> LanPairingSession | None:
        return (
            self.db.query(LanPairingSession)
            .filter(
                LanPairingSession.business_id == business_id,
                LanPairingSession.pairing_code == pairing_code.strip(),
                LanPairingSession.is_claimed == False,  # noqa: E712
                LanPairingSession.expires_at > now,
            )
            .first()
        )

    def get_pairing_session_by_code(self, pairing_code: str) -> LanPairingSession | None:
        return (
            self.db.query(LanPairingSession)
            .filter(LanPairingSession.pairing_code == pairing_code.strip())
            .order_by(LanPairingSession.created_at.desc())
            .first()
        )

    def mark_session_claimed(
        self, session: LanPairingSession, device_id: UUID, claimed_at: datetime
    ) -> LanPairingSession:
        session.is_claimed = True
        session.claimed_by_device_id = device_id
        session.claimed_at = claimed_at
        self.db.commit()
        self.db.refresh(session)
        return session

    def upsert_device_pairing(
        self,
        business_id: UUID,
        device_id: UUID,
        lan_token_hash: str,
        token_expires_at: datetime,
    ) -> LanDevicePairing:
        existing = (
            self.db.query(LanDevicePairing)
            .filter(
                LanDevicePairing.business_id == business_id,
                LanDevicePairing.device_id == device_id,
            )
            .first()
        )
        now = datetime.now(timezone.utc)
        if existing:
            existing.lan_token_hash = lan_token_hash
            existing.token_expires_at = token_expires_at
            existing.is_revoked = False
            existing.last_seen_at = now
            self.db.commit()
            self.db.refresh(existing)
            return existing
        else:
            pairing = LanDevicePairing(
                business_id=business_id,
                device_id=device_id,
                lan_token_hash=lan_token_hash,
                token_expires_at=token_expires_at,
                is_revoked=False,
                last_seen_at=now,
            )
            self.db.add(pairing)
            self.db.commit()
            self.db.refresh(pairing)
            return pairing

    def get_pairing_by_token_hash(self, token_hash: str) -> LanDevicePairing | None:
        return (
            self.db.query(LanDevicePairing)
            .filter(LanDevicePairing.lan_token_hash == token_hash)
            .first()
        )

    def get_pairing_by_device(
        self, business_id: UUID, device_id: UUID
    ) -> LanDevicePairing | None:
        return (
            self.db.query(LanDevicePairing)
            .filter(
                LanDevicePairing.business_id == business_id,
                LanDevicePairing.device_id == device_id,
            )
            .first()
        )

    def revoke_pairing(self, business_id: UUID, device_id: UUID) -> bool:
        pairing = self.get_pairing_by_device(business_id, device_id)
        if pairing:
            pairing.is_revoked = True
            self.db.commit()
            return True
        return False

    def update_last_seen(self, pairing: LanDevicePairing, seen_at: datetime):
        pairing.last_seen_at = seen_at
        self.db.commit()
