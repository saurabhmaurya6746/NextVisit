from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class CalendarEventCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = None
    event_type: str = Field(default="EVENT", description="NOTE, REMINDER, APPOINTMENT, TASK, EVENT, STAFF")
    start_at: datetime
    end_at: datetime | None = None
    customer_id: UUID | None = None
    staff_id: UUID | None = None
    reminder_minutes: int | None = None
    is_completed: bool = False
    recurrence_rule: str | None = "NONE"


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_type: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    customer_id: UUID | None = None
    staff_id: UUID | None = None
    reminder_minutes: int | None = None
    is_completed: bool | None = None
    recurrence_rule: str | None = None


class CustomerMinimalResponse(BaseModel):
    id: UUID
    name: str
    phone: str
    email: str | None = None
    visit_count: int = 0
    total_spent: float = 0.0
    last_visit_at: datetime | None = None


class StaffMinimalResponse(BaseModel):
    id: UUID
    name: str
    email: str | None = None
    role: str | None = None


class CalendarEventResponse(BaseModel):
    id: UUID
    business_id: UUID
    title: str
    description: str | None = None
    event_type: str
    start_at: datetime
    end_at: datetime | None = None
    customer_id: UUID | None = None
    staff_id: UUID | None = None
    reminder_minutes: int | None = None
    is_completed: bool = False
    recurrence_rule: str | None = "NONE"
    is_system: bool = False
    source: str = "Calendar"
    customer: CustomerMinimalResponse | None = None
    staff: StaffMinimalResponse | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
