from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.visit import PaymentMethod, PaymentStatus, VisitStatus


class VisitServiceItemCreate(BaseModel):
    service_id: UUID
    quantity: int = Field(default=1, gt=0)


class VisitCreate(BaseModel):
    customer_id: UUID
    staff_id: UUID | None = None
    notes: str | None = Field(default=None, max_length=1000)
    payment_method: PaymentMethod | None = None
    discount: float = Field(default=0.0, ge=0)
    services: list[VisitServiceItemCreate] = Field(..., min_length=1)


class VisitComplete(BaseModel):
    payment_method: PaymentMethod | None = None
    notes: str | None = Field(default=None, max_length=1000)


class VisitServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    visit_id: UUID
    service_id: UUID
    quantity: int
    unit_price: float
    total_price: float


class VisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    customer_id: UUID
    staff_id: UUID | None
    status: VisitStatus
    notes: str | None
    subtotal: float
    discount: float
    total_amount: float
    payment_method: PaymentMethod | None
    payment_status: PaymentStatus
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    earned_points: int = 0
    services: list[VisitServiceResponse] = []
