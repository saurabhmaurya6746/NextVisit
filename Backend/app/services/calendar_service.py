import logging
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.calendar_event import CalendarEvent
from app.models.campaign import Campaign, CampaignLog
from app.models.customer import Customer
from app.models.order import Order
from app.models.user import User
from app.models.visit import Visit
from app.schemas.calendar_event import (
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventUpdate,
    CustomerMinimalResponse,
    StaffMinimalResponse,
)

logger = logging.getLogger(__name__)


class CalendarService:
    def __init__(self, db: Session):
        self.db = db

    def create_event(self, business_id: UUID, current_user: User, data: CalendarEventCreate) -> CalendarEventResponse:
        event = CalendarEvent(
            business_id=business_id,
            title=data.title.strip(),
            description=data.description.strip() if data.description else None,
            event_type=data.event_type.upper(),
            start_at=data.start_at,
            end_at=data.end_at,
            customer_id=data.customer_id,
            staff_id=data.staff_id,
            reminder_minutes=data.reminder_minutes,
            is_completed=data.is_completed,
            recurrence_rule=data.recurrence_rule.upper() if data.recurrence_rule else "NONE",
            created_by=current_user.id,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        return self._to_response(event)

    def update_event(self, business_id: UUID, event_id: UUID, data: CalendarEventUpdate) -> CalendarEventResponse:
        event = self.db.scalar(
            select(CalendarEvent).where(
                CalendarEvent.id == event_id,
                CalendarEvent.business_id == business_id,
            )
        )
        if not event:
            raise HTTPException(status_code=404, detail="Calendar event not found")

        if data.title is not None:
            event.title = data.title.strip()
        if data.description is not None:
            event.description = data.description.strip() if data.description else None
        if data.event_type is not None:
            event.event_type = data.event_type.upper()
        if data.start_at is not None:
            event.start_at = data.start_at
        if data.end_at is not None:
            event.end_at = data.end_at
        if data.customer_id is not None:
            event.customer_id = data.customer_id
        if data.staff_id is not None:
            event.staff_id = data.staff_id
        if data.reminder_minutes is not None:
            event.reminder_minutes = data.reminder_minutes
        if data.is_completed is not None:
            event.is_completed = data.is_completed
        if data.recurrence_rule is not None:
            event.recurrence_rule = data.recurrence_rule.upper()

        self.db.commit()
        self.db.refresh(event)
        return self._to_response(event)

    def delete_event(self, business_id: UUID, event_id: UUID) -> dict:
        event = self.db.scalar(
            select(CalendarEvent).where(
                CalendarEvent.id == event_id,
                CalendarEvent.business_id == business_id,
            )
        )
        if not event:
            raise HTTPException(status_code=404, detail="Calendar event not found")

        self.db.delete(event)
        self.db.commit()
        return {"detail": "Calendar event deleted successfully"}

    def get_event(self, business_id: UUID, event_id: UUID) -> CalendarEventResponse:
        event = self.db.scalar(
            select(CalendarEvent)
            .options(joinedload(CalendarEvent.customer), joinedload(CalendarEvent.staff))
            .where(
                CalendarEvent.id == event_id,
                CalendarEvent.business_id == business_id,
            )
        )
        if not event:
            raise HTTPException(status_code=404, detail="Calendar event not found")

        return self._to_response(event)

    def get_aggregated_events(
        self,
        business_id: UUID,
        start_date: datetime,
        end_date: datetime,
        event_type: str | None = None,
        customer_id: UUID | None = None,
        staff_id: UUID | None = None,
    ) -> list[dict]:
        """
        Unified aggregator that fetches both custom CalendarEvent records
        and system-generated Birthdays, Anniversaries, Bookings, Campaigns, and Staff.
        """
        aggregated: list[dict] = []

        # -------------------------------------------------------------------
        # 1. CUSTOM DB CALENDAR EVENTS
        # -------------------------------------------------------------------
        stmt = (
            select(CalendarEvent)
            .options(joinedload(CalendarEvent.customer), joinedload(CalendarEvent.staff))
            .where(CalendarEvent.business_id == business_id)
        )

        if customer_id:
            stmt = stmt.where(CalendarEvent.customer_id == customer_id)
        if staff_id:
            stmt = stmt.where(CalendarEvent.staff_id == staff_id)

        custom_events = self.db.scalars(stmt).all()

        for ev in custom_events:
            # Check recurrence vs date range
            occurrences = self._project_occurrences(ev, start_date, end_date)
            for occ_start in occurrences:
                if event_type and event_type.upper() != "ALL" and ev.event_type.upper() != event_type.upper():
                    continue

                cust_data = None
                if ev.customer:
                    cust_data = {
                        "id": str(ev.customer.id),
                        "name": ev.customer.name,
                        "phone": ev.customer.phone,
                        "email": ev.customer.email,
                        "visit_count": ev.customer.visit_count,
                        "total_spent": ev.customer.total_spent,
                        "last_visit_at": ev.customer.last_visit_at.isoformat() if ev.customer.last_visit_at else None,
                    }

                staff_data = None
                if ev.staff:
                    staff_data = {
                        "id": str(ev.staff.id),
                        "name": ev.staff.name,
                        "email": ev.staff.email,
                        "role": ev.staff.role,
                    }

                aggregated.append({
                    "id": str(ev.id),
                    "business_id": str(ev.business_id),
                    "title": ev.title,
                    "description": ev.description,
                    "event_type": ev.event_type.upper(),
                    "start_at": occ_start.isoformat(),
                    "end_at": ev.end_at.isoformat() if ev.end_at else None,
                    "customer_id": str(ev.customer_id) if ev.customer_id else None,
                    "staff_id": str(ev.staff_id) if ev.staff_id else None,
                    "reminder_minutes": ev.reminder_minutes,
                    "is_completed": ev.is_completed,
                    "recurrence_rule": ev.recurrence_rule or "NONE",
                    "is_system": False,
                    "source": "Calendar",
                    "customer": cust_data,
                    "staff": staff_data,
                    "created_at": ev.created_at.isoformat(),
                    "updated_at": ev.updated_at.isoformat(),
                })

        # -------------------------------------------------------------------
        # 2. SYSTEM BIRTHDAYS & ANNIVERSARIES FROM CUSTOMERS
        # -------------------------------------------------------------------
        customers = self.db.scalars(
            select(Customer).where(
                Customer.business_id == business_id,
                Customer.is_active == True,
            )
        ).all()

        cur = start_date
        while cur <= end_date:
            cur_date = cur.date()
            for c in customers:
                if customer_id and c.id != customer_id:
                    continue

                # Birthday
                if c.birth_date and c.birth_date.month == cur_date.month and c.birth_date.day == cur_date.day:
                    if not event_type or event_type.upper() in ["ALL", "BIRTHDAY"]:
                        b_start = datetime(cur_date.year, cur_date.month, cur_date.day, 9, 0, tzinfo=timezone.utc)
                        aggregated.append({
                            "id": f"birthday-{c.id}-{cur_date.isoformat()}",
                            "business_id": str(business_id),
                            "title": f"{c.name} · Birthday 🎂",
                            "description": f"Birthday celebration for {c.name}",
                            "event_type": "BIRTHDAY",
                            "start_at": b_start.isoformat(),
                            "end_at": None,
                            "customer_id": str(c.id),
                            "staff_id": None,
                            "reminder_minutes": 1440,
                            "is_completed": False,
                            "recurrence_rule": "YEARLY",
                            "is_system": True,
                            "source": "Customer",
                            "customer": {
                                "id": str(c.id),
                                "name": c.name,
                                "phone": c.phone,
                                "email": c.email,
                                "visit_count": c.visit_count,
                                "total_spent": c.total_spent,
                                "last_visit_at": c.last_visit_at.isoformat() if c.last_visit_at else None,
                            },
                            "staff": None,
                            "created_at": b_start.isoformat(),
                            "updated_at": b_start.isoformat(),
                        })

                # Anniversary
                if c.anniversary_date and c.anniversary_date.month == cur_date.month and c.anniversary_date.day == cur_date.day:
                    if not event_type or event_type.upper() in ["ALL", "ANNIVERSARY"]:
                        a_start = datetime(cur_date.year, cur_date.month, cur_date.day, 10, 0, tzinfo=timezone.utc)
                        aggregated.append({
                            "id": f"anniversary-{c.id}-{cur_date.isoformat()}",
                            "business_id": str(business_id),
                            "title": f"{c.name} · Anniversary ❤️",
                            "description": f"Anniversary for {c.name}",
                            "event_type": "ANNIVERSARY",
                            "start_at": a_start.isoformat(),
                            "end_at": None,
                            "customer_id": str(c.id),
                            "staff_id": None,
                            "reminder_minutes": 1440,
                            "is_completed": False,
                            "recurrence_rule": "YEARLY",
                            "is_system": True,
                            "source": "Customer",
                            "customer": {
                                "id": str(c.id),
                                "name": c.name,
                                "phone": c.phone,
                                "email": c.email,
                                "visit_count": c.visit_count,
                                "total_spent": c.total_spent,
                                "last_visit_at": c.last_visit_at.isoformat() if c.last_visit_at else None,
                            },
                            "staff": None,
                            "created_at": a_start.isoformat(),
                            "updated_at": a_start.isoformat(),
                        })

            cur += timedelta(days=1)

        # -------------------------------------------------------------------
        # 3. SYSTEM BOOKINGS / VISITS / APPOINTMENTS
        # -------------------------------------------------------------------
        if not event_type or event_type.upper() in ["ALL", "BOOKING", "APPOINTMENT"]:
            visits = self.db.scalars(
                select(Visit)
                .options(joinedload(Visit.customer))
                .where(
                    Visit.business_id == business_id,
                    Visit.created_at >= start_date,
                    Visit.created_at <= end_date,
                )
            ).all()

            for v in visits:
                if customer_id and v.customer_id != customer_id:
                    continue

                cust_name = v.customer.name if v.customer else "Customer"
                aggregated.append({
                    "id": f"visit-{v.id}",
                    "business_id": str(business_id),
                    "title": f"Booking · {cust_name} 📅",
                    "description": f"Visit/Booking #{str(v.id)[:8]} (Status: {v.status})",
                    "event_type": "BOOKING",
                    "start_at": v.created_at.isoformat(),
                    "end_at": None,
                    "customer_id": str(v.customer_id) if v.customer_id else None,
                    "staff_id": None,
                    "reminder_minutes": 30,
                    "is_completed": v.status in ["COMPLETED", "PAID"],
                    "recurrence_rule": "NONE",
                    "is_system": True,
                    "source": "Orders/Bookings",
                    "customer": {
                        "id": str(v.customer.id),
                        "name": v.customer.name,
                        "phone": v.customer.phone,
                        "email": v.customer.email,
                        "visit_count": v.customer.visit_count,
                        "total_spent": v.customer.total_spent,
                        "last_visit_at": v.customer.last_visit_at.isoformat() if v.customer.last_visit_at else None,
                    } if v.customer else None,
                    "staff": None,
                    "created_at": v.created_at.isoformat(),
                    "updated_at": v.updated_at.isoformat() if hasattr(v, "updated_at") and v.updated_at else v.created_at.isoformat(),
                })

        # -------------------------------------------------------------------
        # 4. SYSTEM CAMPAIGNS
        # -------------------------------------------------------------------
        if not event_type or event_type.upper() in ["ALL", "CAMPAIGN"]:
            campaigns = self.db.scalars(
                select(Campaign).where(
                    Campaign.business_id == business_id,
                    Campaign.created_at >= start_date,
                    Campaign.created_at <= end_date,
                )
            ).all()

            for camp in campaigns:
                aggregated.append({
                    "id": f"campaign-{camp.id}",
                    "business_id": str(business_id),
                    "title": f"{camp.name} 📣",
                    "description": f"Campaign Type: {camp.campaign_type} | Segment: {camp.target_segment}",
                    "event_type": "CAMPAIGN",
                    "start_at": camp.created_at.isoformat(),
                    "end_at": None,
                    "customer_id": None,
                    "staff_id": None,
                    "reminder_minutes": None,
                    "is_completed": True,
                    "recurrence_rule": "NONE",
                    "is_system": True,
                    "source": "Campaigns",
                    "customer": None,
                    "staff": None,
                    "created_at": camp.created_at.isoformat(),
                    "updated_at": camp.created_at.isoformat(),
                })

        # Sort all aggregated events by start_at asc
        aggregated.sort(key=lambda x: x["start_at"])
        return aggregated

    def _project_occurrences(self, event: CalendarEvent, window_start: datetime, window_end: datetime) -> list[datetime]:
        rule = (event.recurrence_rule or "NONE").upper()
        start = event.start_at
        if rule == "NONE":
            if window_start <= start <= window_end:
                return [start]
            return []

        occurrences: list[datetime] = []
        curr = start

        # Generate up to 365 steps
        limit = 365
        step = 0
        while curr <= window_end and step < limit:
            if curr >= window_start:
                occurrences.append(curr)

            if rule == "DAILY":
                curr += timedelta(days=1)
            elif rule == "WEEKLY":
                curr += timedelta(weeks=1)
            elif rule == "MONTHLY":
                # Add approx 30 days
                year = curr.year + (1 if curr.month == 12 else 0)
                month = 1 if curr.month == 12 else curr.month + 1
                day = min(curr.day, 28)
                curr = curr.replace(year=year, month=month, day=day)
            elif rule == "YEARLY":
                curr = curr.replace(year=curr.year + 1)
            else:
                break
            step += 1

        return occurrences

    def _to_response(self, event: CalendarEvent) -> CalendarEventResponse:
        cust_resp = None
        if event.customer:
            cust_resp = CustomerMinimalResponse(
                id=event.customer.id,
                name=event.customer.name,
                phone=event.customer.phone,
                email=event.customer.email,
                visit_count=event.customer.visit_count,
                total_spent=event.customer.total_spent,
                last_visit_at=event.customer.last_visit_at,
            )

        staff_resp = None
        if event.staff:
            staff_resp = StaffMinimalResponse(
                id=event.staff.id,
                name=event.staff.name,
                email=event.staff.email,
                role=event.staff.role,
            )

        return CalendarEventResponse(
            id=event.id,
            business_id=event.business_id,
            title=event.title,
            description=event.description,
            event_type=event.event_type.upper(),
            start_at=event.start_at,
            end_at=event.end_at,
            customer_id=event.customer_id,
            staff_id=event.staff_id,
            reminder_minutes=event.reminder_minutes,
            is_completed=event.is_completed,
            recurrence_rule=event.recurrence_rule or "NONE",
            is_system=False,
            source="Calendar",
            customer=cust_resp,
            staff=staff_resp,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )
