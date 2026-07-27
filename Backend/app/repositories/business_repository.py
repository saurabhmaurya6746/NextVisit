from uuid import UUID

from sqlalchemy import select

from app.models.business import Business
from app.repositories.base_repository import BaseRepository


class BusinessRepository(BaseRepository):

    def create(self, business: Business) -> Business:
        self.db.add(business)
        self.db.flush()
        self.db.refresh(business)
        return business

    def get_by_id(self, business_id: UUID) -> Business | None:
        stmt = select(Business).where(Business.id == business_id)
        return self.db.scalar(stmt)

    def update(self, business: Business) -> Business:
        """
        Persist field changes already applied to the ORM object.
        Flushes to DB so the object is refreshed within the same transaction.
        Commit is owned by the service layer.
        """
        self.db.flush()
        self.db.refresh(business)
        return business

    def get_pending_approvals(
        self,
        page: int = 1,
        page_size: int = 10,
        search: str | None = None,
        business_type_id: UUID | None = None,
    ) -> tuple[list[Business], int]:
        from sqlalchemy import func, or_
        from app.models.business import BusinessStatus

        stmt = select(Business).where(
            Business.status == BusinessStatus.PENDING.value,
            Business.is_deleted == False,
        )

        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Business.name.ilike(term),
                    Business.owner_name.ilike(term),
                    Business.email.ilike(term),
                )
            )

        if business_type_id:
            stmt = stmt.where(Business.business_type_id == business_type_id)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        stmt = stmt.order_by(Business.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        items = list(self.db.scalars(stmt).all())
        return items, total

    def get_clients(
        self,
        page: int = 1,
        page_size: int = 10,
        search: str | None = None,
        status: str | None = None,
        business_type_id: UUID | None = None,
        subscription_status: str | None = None,
        country: str | None = None,
        sort_by: str = "newest",
    ) -> tuple[list[Business], int]:
        from sqlalchemy import func, or_
        from app.models.business import BusinessStatus

        stmt = select(Business).where(
            Business.is_deleted == False,
        )

        if status:
            stmt = stmt.where(Business.status == status)
        else:
            stmt = stmt.where(Business.status != BusinessStatus.PENDING.value)

        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Business.name.ilike(term),
                    Business.owner_name.ilike(term),
                    Business.email.ilike(term),
                    Business.phone.ilike(term),
                )
            )

        if business_type_id:
            stmt = stmt.where(Business.business_type_id == business_type_id)

        if subscription_status:
            stmt = stmt.where(Business.subscription_status == subscription_status)

        if country:
            stmt = stmt.where(Business.country.ilike(f"%{country.strip()}%"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        if sort_by == "oldest":
            stmt = stmt.order_by(Business.created_at.asc())
        elif sort_by == "name":
            stmt = stmt.order_by(Business.name.asc())
        elif sort_by == "plan_expiry":
            stmt = stmt.order_by(Business.trial_end.asc().nulls_last())
        else:
            stmt = stmt.order_by(Business.created_at.desc())

        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        items = list(self.db.scalars(stmt).all())
        return items, total