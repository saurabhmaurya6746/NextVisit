from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.visit import Visit, VisitStatus
from app.repositories.base_repository import BaseRepository


class VisitRepository(BaseRepository):

    def create(self, visit: Visit) -> Visit:
        self.db.add(visit)
        self.db.flush()
        self.db.refresh(visit)
        return visit

    def update(self, visit: Visit) -> Visit:
        self.db.flush()
        self.db.refresh(visit)
        return visit

    def get_by_id(self, visit_id: UUID) -> Visit | None:
        stmt = (
            select(Visit)
            .options(selectinload(Visit.services))
            .where(Visit.id == visit_id)
        )
        return self.db.scalar(stmt)

    def get_all_by_business(self, business_id: UUID) -> list[Visit]:
        stmt = (
            select(Visit)
            .options(selectinload(Visit.services))
            .where(Visit.business_id == business_id)
            .order_by(Visit.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_open_visits(self, business_id: UUID) -> list[Visit]:
        stmt = (
            select(Visit)
            .options(selectinload(Visit.services))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.OPEN,
            )
            .order_by(Visit.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_completed_visits(self, business_id: UUID) -> list[Visit]:
        stmt = (
            select(Visit)
            .options(selectinload(Visit.services))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
            )
            .order_by(Visit.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_paginated_by_business(
        self,
        business_id: UUID,
        page: int = 1,
        limit: int = 10,
        search: str | None = None,
        status: str | None = None,
        payment_status: str | None = None,
        staff_id: UUID | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        booking_source: str | None = None,
        sort: str | None = "newest",
    ) -> dict:
        import math
        from sqlalchemy import or_, func, cast, String
        from app.models.customer import Customer
        from app.models.user import User
        from app.models.visit import PaymentStatus

        query = (
            select(Visit)
            .options(selectinload(Visit.services))
            .outerjoin(Customer, Visit.customer_id == Customer.id)
            .outerjoin(User, Visit.staff_id == User.id)
            .where(Visit.business_id == business_id)
        )

        # 1. Status Filter
        if status and status.upper() != "ALL":
            s_upper = status.upper()
            if s_upper in ("OPEN", "IN_SERVICE", "ACTIVE"):
                query = query.where(Visit.status == VisitStatus.OPEN)
            elif s_upper in ("COMPLETED", "SETTLED"):
                query = query.where(Visit.status == VisitStatus.COMPLETED)
            elif s_upper in ("CANCELLED",):
                query = query.where(Visit.status == VisitStatus.CANCELLED)

        # 2. Payment Status Filter
        if payment_status and payment_status.upper() != "ALL":
            p_upper = payment_status.upper()
            if p_upper == "PAID":
                query = query.where(Visit.payment_status == PaymentStatus.PAID)
            elif p_upper in ("PENDING", "UNPAID"):
                query = query.where(Visit.payment_status == PaymentStatus.PENDING)

        # 3. Staff Filter
        if staff_id:
            query = query.where(Visit.staff_id == staff_id)

        # 4. Booking Source Filter
        if booking_source and booking_source.upper() != "ALL":
            bs = booking_source.lower()
            if bs == "online":
                query = query.where(Visit.notes.like("%online%"))
            elif bs == "staff":
                query = query.where(Visit.staff_id.isnot(None), or_(Visit.notes.is_(None), ~Visit.notes.like("%online%")))
            elif bs == "walkin":
                query = query.where(Visit.staff_id.is_(None), or_(Visit.notes.is_(None), ~Visit.notes.like("%online%")))

        # 5. Search Filter
        if search and search.strip():
            s_clean = f"%{search.strip()}%"
            query = query.where(
                or_(
                    cast(Visit.id, String).ilike(s_clean),
                    Customer.name.ilike(s_clean),
                    Customer.phone.ilike(s_clean),
                    User.name.ilike(s_clean),
                    Visit.notes.ilike(s_clean),
                )
            )

        # Count total
        subq = query.order_by(None).subquery()
        total = self.db.scalar(select(func.count()).select_from(subq)) or 0
        total_pages = max(1, math.ceil(total / limit)) if total > 0 else 1
        page = max(1, min(page, total_pages)) if total > 0 else 1
        offset = (page - 1) * limit

        # 6. Sorting
        s_lower = (sort or "newest").lower()
        if s_lower == "oldest":
            query = query.order_by(Visit.created_at.asc())
        elif s_lower in ("highest_amount", "amount_desc", "price_desc"):
            query = query.order_by(Visit.total_amount.desc())
        elif s_lower in ("lowest_amount", "amount_asc", "price_asc"):
            query = query.order_by(Visit.total_amount.asc())
        else:
            query = query.order_by(Visit.created_at.desc())

        items = list(self.db.scalars(query.offset(offset).limit(limit)).all())

        return {
            "items": items,
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }
