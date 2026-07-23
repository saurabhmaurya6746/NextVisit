from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.visit import PaymentStatus, VisitStatus


class TopServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    service_id: UUID
    service_name: str
    visit_count: int
    revenue: float


class RecentVisitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    visit_id: UUID
    customer_name: str
    total_amount: float
    payment_status: PaymentStatus
    status: VisitStatus
    completed_at: datetime | None


class DashboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_customers: int
    active_customers: int
    total_staff: int
    total_services: int

    total_visits: int
    open_visits: int
    completed_visits: int

    today_visits: int
    today_revenue: float

    monthly_visits: int
    monthly_revenue: float

    total_revenue: float
    average_bill: float

    top_services: list[TopServiceResponse]
    recent_visits: list[RecentVisitResponse]
