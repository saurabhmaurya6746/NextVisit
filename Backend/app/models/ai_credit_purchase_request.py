import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class AiCreditPurchaseRequest(Base):
    __tablename__ = "ai_credit_purchase_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    pack_id = Column(UUID(as_uuid=True), nullable=True)
    pack_name = Column(String(100), nullable=False)
    ai_credits = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)

    payment_status = Column(String(20), nullable=False, default="PENDING")  # PENDING, PAID, FAILED
    approval_status = Column(String(20), nullable=False, default="PENDING")  # PENDING, APPROVED, REJECTED, CANCELLED

    requested_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_admin_id = Column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=True)
    approved_by_admin_name = Column(String(100), nullable=True)

    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    business = relationship("Business", backref="ai_credit_purchase_requests")
