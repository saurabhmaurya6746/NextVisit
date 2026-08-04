from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models.customer import Customer
from app.repositories.base_repository import BaseRepository


class CustomerRepository(BaseRepository):

    def get_all_by_business(self, business_id: UUID) -> list[Customer]:
        stmt = (
            select(Customer)
            .options(joinedload(Customer.loyalty))
            .where(Customer.business_id == business_id)
            .order_by(Customer.created_at.desc())
        )
        return list(self.db.scalars(stmt).unique().all())

    def get_paginated_by_business(
        self,
        business_id: UUID,
        page: int = 1,
        limit: int = 10,
        search: str | None = None,
        sort: str | None = "newest",
        filter: str | None = "all",
    ) -> dict:
        import math
        from sqlalchemy import or_, func

        query = select(Customer).options(joinedload(Customer.loyalty)).where(Customer.business_id == business_id)

        # Apply Filters
        if filter:
            f_lower = filter.lower()
            if f_lower == "active":
                query = query.where(Customer.is_active.is_(True))
            elif f_lower == "inactive":
                query = query.where(Customer.is_active.is_(False))
            elif f_lower == "vip":
                query = query.where(or_(Customer.total_spent >= 2500, Customer.visit_count >= 5))
            elif f_lower == "new":
                query = query.where(Customer.visit_count <= 1)

        # Apply Search
        if search and search.strip():
            s_clean = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Customer.name.ilike(s_clean),
                    Customer.phone.ilike(s_clean),
                    Customer.email.ilike(s_clean),
                )
            )

        # Count total filtered records
        count_stmt = select(func.count(Customer.id)).where(Customer.business_id == business_id)
        if filter:
            f_lower = filter.lower()
            if f_lower == "active":
                count_stmt = count_stmt.where(Customer.is_active.is_(True))
            elif f_lower == "inactive":
                count_stmt = count_stmt.where(Customer.is_active.is_(False))
            elif f_lower == "vip":
                count_stmt = count_stmt.where(or_(Customer.total_spent >= 2500, Customer.visit_count >= 5))
            elif f_lower == "new":
                count_stmt = count_stmt.where(Customer.visit_count <= 1)

        if search and search.strip():
            s_clean = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(
                    Customer.name.ilike(s_clean),
                    Customer.phone.ilike(s_clean),
                    Customer.email.ilike(s_clean),
                )
            )

        total = self.db.scalar(count_stmt) or 0
        total_pages = max(1, math.ceil(total / limit)) if total > 0 else 1
        page = max(1, min(page, total_pages)) if total > 0 else 1
        offset = (page - 1) * limit

        # Apply Sorting
        s_lower = (sort or "newest").lower()
        if s_lower == "oldest":
            query = query.order_by(Customer.created_at.asc())
        elif s_lower in ("highest_spend", "spend_desc", "spent"):
            query = query.order_by(Customer.total_spent.desc())
        elif s_lower in ("most_visits", "visits_desc", "visits"):
            query = query.order_by(Customer.visit_count.desc())
        elif s_lower in ("highest_loyalty", "loyalty_desc", "points"):
            query = query.order_by(Customer.created_at.desc())
        elif s_lower == "name_asc":
            query = query.order_by(Customer.name.asc())
        elif s_lower == "name_desc":
            query = query.order_by(Customer.name.desc())
        else:
            query = query.order_by(Customer.created_at.desc())

        items = list(self.db.scalars(query.offset(offset).limit(limit)).unique().all())

        return {
            "items": items,
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }

    def get_by_id(self, customer_id: UUID) -> Customer | None:
        stmt = (
            select(Customer)
            .options(joinedload(Customer.loyalty))
            .where(Customer.id == customer_id)
        )
        return self.db.scalar(stmt)

    def get_by_phone(self, business_id: UUID, phone: str) -> Customer | None:
        stmt = (
            select(Customer)
            .options(joinedload(Customer.loyalty))
            .where(
                Customer.business_id == business_id,
                Customer.phone == phone,
            )
        )
        return self.db.scalar(stmt)

    def create(self, customer: Customer) -> Customer:
        self.db.add(customer)
        self.db.flush()
        self.db.refresh(customer)
        return customer

    def update(self, customer: Customer) -> Customer:
        self.db.flush()
        self.db.refresh(customer)
        return customer

    def delete(self, customer: Customer) -> None:
        self.db.delete(customer)
        self.db.flush()
