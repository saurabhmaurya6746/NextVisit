import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.calendar_event import (
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventUpdate,
)
from app.services.calendar_service import CalendarService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/calendar",
    tags=["Merchant Calendar"],
)


@router.get("/events", summary="List aggregated calendar events & system items")
def list_calendar_events(
    start_date: str | None = Query(None, description="ISO start date string e.g. 2026-08-01T00:00:00Z"),
    end_date: str | None = Query(None, description="ISO end date string e.g. 2026-08-31T23:59:59Z"),
    event_type: str | None = Query(None, description="Filter: BIRTHDAY, BOOKING, CAMPAIGN, ANNIVERSARY, STAFF, NOTE, REMINDER, TASK, APPOINTMENT, EVENT, ALL"),
    customer_id: UUID | None = Query(None),
    staff_id: UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns unified list of calendar events (custom notes, tasks, appointments, reminders)
    and system-generated customer Birthdays, Anniversaries, Bookings, Campaigns, and Staff records.
    """
    now = datetime.now(timezone.utc)
    if start_date:
        try:
            s_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except Exception:
            s_dt = now - timedelta(days=30)
    else:
        s_dt = now - timedelta(days=30)

    if end_date:
        try:
            e_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except Exception:
            e_dt = now + timedelta(days=60)
    else:
        e_dt = now + timedelta(days=60)

    return CalendarService(db).get_aggregated_events(
        business_id=current_user.business_id,
        start_date=s_dt,
        end_date=e_dt,
        event_type=event_type,
        customer_id=customer_id,
        staff_id=staff_id,
    )


@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED, summary="Create a new calendar event / note / task / reminder")
def create_calendar_event(
    payload: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new merchant calendar event, task, note, or reminder."""
    return CalendarService(db).create_event(
        business_id=current_user.business_id,
        current_user=current_user,
        data=payload,
    )


@router.get("/events/{event_id}", response_model=CalendarEventResponse, summary="Get single calendar event details")
def get_calendar_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a single calendar event by ID."""
    return CalendarService(db).get_event(
        business_id=current_user.business_id,
        event_id=event_id,
    )


@router.patch("/events/{event_id}", response_model=CalendarEventResponse, summary="Update calendar event")
def update_calendar_event(
    event_id: UUID,
    payload: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates an existing custom calendar event, task status, title, timing or assigned customer/staff."""
    return CalendarService(db).update_event(
        business_id=current_user.business_id,
        event_id=event_id,
        data=payload,
    )


@router.delete("/events/{event_id}", summary="Delete custom calendar event")
def delete_calendar_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a custom calendar event."""
    return CalendarService(db).delete_event(
        business_id=current_user.business_id,
        event_id=event_id,
    )
