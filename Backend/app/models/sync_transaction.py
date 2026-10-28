import enum
import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class SyncTransactionStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    COMMITTED = "COMMITTED"
    FAILED = "FAILED"


class SyncTransaction(BaseModel):
    __tablename__ = "sync_transactions"
    __table_args__ = (
        UniqueConstraint("business_id", "client_tx_id", name="uq_sync_tx_biz_client_tx"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("client_devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    client_tx_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    operation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="COMMITTED", nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    response_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    business = relationship("Business")
    device = relationship("ClientDevice")
