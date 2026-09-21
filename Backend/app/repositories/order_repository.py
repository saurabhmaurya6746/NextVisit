import logging
import uuid
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload
from app.models.customer import Customer
from app.models.order import Order, OrderItem, OrderStatus

logger = logging.getLogger(__name__)


class OrderRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, order: Order) -> Order:
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        return order

    def get_by_id(self, order_id: uuid.UUID, business_id: uuid.UUID | None = None) -> Order | None:
        stmt = (
            select(Order)
            .options(joinedload(Order.items), joinedload(Order.customer).joinedload(Customer.loyalty))
            .where(Order.id == order_id)
        )
        if business_id:
            stmt = stmt.where(Order.business_id == business_id)
        return self.db.scalar(stmt)

    def get_by_visit_token(self, visit_token: str, business_id: uuid.UUID | None = None) -> Order | None:
        stmt = (
            select(Order)
            .options(joinedload(Order.items), joinedload(Order.customer).joinedload(Customer.loyalty))
            .where(
                Order.visit_token == visit_token,
                Order.status.in_([OrderStatus.OPEN, OrderStatus.PREPARING, OrderStatus.READY]),
            )
        )
        if business_id:
            stmt = stmt.where(Order.business_id == business_id)
        stmt = stmt.order_by(Order.created_at.desc())
        return self.db.scalar(stmt)

    def list_by_business(
        self,
        business_id: uuid.UUID,
        status: OrderStatus | None = None,
        table_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
    ) -> list[Order]:
        stmt = (
            select(Order)
            .options(joinedload(Order.items), joinedload(Order.customer).joinedload(Customer.loyalty))
            .where(Order.business_id == business_id)
        )
        if status:
            stmt = stmt.where(Order.status == status)
        if table_id:
            stmt = stmt.where(Order.table_id == table_id)
        if customer_id:
            stmt = stmt.where(Order.customer_id == customer_id)

        stmt = stmt.order_by(Order.created_at.desc())
        return list(self.db.scalars(stmt).unique().all())

    def list_by_business_paginated(
        self,
        business_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        status: OrderStatus | None = None,
        table_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
        order_source: str | None = None,
        search: str | None = None,
        date_filter: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict:
        import math
        from datetime import datetime, timezone, timedelta

        base_stmt = select(Order).where(Order.business_id == business_id)

        if status:
            base_stmt = base_stmt.where(Order.status == status)
        if table_id:
            base_stmt = base_stmt.where(Order.table_id == table_id)
        if customer_id:
            base_stmt = base_stmt.where(Order.customer_id == customer_id)

        if order_source:
            clean_src = str(order_source).upper().replace("ORDERSOURCE.", "").strip()
            if clean_src in ("QR", "POS"):
                base_stmt = base_stmt.where(Order.order_source == clean_src)

        if search and search.strip():
            term = f"%{search.strip()}%"
            base_stmt = base_stmt.outerjoin(Customer, Order.customer_id == Customer.id).where(
                Order.order_number.ilike(term) | Customer.name.ilike(term) | Customer.phone.ilike(term)
            )

        now = datetime.now(timezone.utc)
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        if date_filter == "today":
            base_stmt = base_stmt.where(Order.created_at >= start_today)
        elif date_filter == "yesterday":
            start_yesterday = start_today - timedelta(days=1)
            base_stmt = base_stmt.where(Order.created_at >= start_yesterday, Order.created_at < start_today)
        elif date_filter in ("week", "this_week"):
            dow = start_today.weekday() % 7
            start_week = start_today - timedelta(days=dow)
            base_stmt = base_stmt.where(Order.created_at >= start_week)
        elif date_filter in ("month", "this_month"):
            start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            base_stmt = base_stmt.where(Order.created_at >= start_month)
        elif date_filter == "custom":
            if start_date:
                try:
                    s_dt = datetime.fromisoformat(start_date)
                    base_stmt = base_stmt.where(Order.created_at >= s_dt)
                except Exception:
                    pass
            if end_date:
                try:
                    e_dt = datetime.fromisoformat(end_date) + timedelta(days=1)
                    base_stmt = base_stmt.where(Order.created_at < e_dt)
                except Exception:
                    pass

        # Total items count
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        total_items = self.db.scalar(count_stmt) or 0

        # Pagination calculations
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        total_pages = math.ceil(total_items / page_size) if total_items > 0 else 1
        offset = (page - 1) * page_size

        # Paginated fetch with LIMIT and OFFSET
        fetch_stmt = (
            base_stmt
            .options(joinedload(Order.items), joinedload(Order.customer).joinedload(Customer.loyalty))
            .order_by(Order.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )

        items = list(self.db.scalars(fetch_stmt).unique().all())

        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }

    def get_active_order_for_table(self, table_id: uuid.UUID, business_id: uuid.UUID) -> Order | None:
        import os
        from datetime import datetime, timezone
        stmt = (
            select(Order)
            .options(joinedload(Order.items), joinedload(Order.customer).joinedload(Customer.loyalty))
            .where(
                Order.table_id == table_id,
                Order.business_id == business_id,
                Order.status.in_([OrderStatus.OPEN, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED]),
            )
            .order_by(Order.updated_at.desc(), Order.created_at.desc())
        )
        orders = list(self.db.scalars(stmt).unique().all())
        now = datetime.now(timezone.utc)
        timeout_hours = float(os.getenv("QR_SESSION_TIMEOUT_HOURS", "3.0"))
        timeout_seconds = timeout_hours * 3600.0

        for o in orders:
            if o.status in (OrderStatus.OPEN, OrderStatus.PREPARING, OrderStatus.READY):
                last_act = o.last_activity_at or o.updated_at or o.created_at
                if last_act:
                    last_act_ts = last_act.replace(tzinfo=timezone.utc) if last_act.tzinfo is None else last_act
                    elapsed = (now - last_act_ts).total_seconds()
                    if elapsed > timeout_seconds:
                        o.status = OrderStatus.CANCELLED
                        o.visit_token = None
                        o.updated_at = now
                        self.db.commit()
                        logger.info("Order %s automatically expired after %.1f hours of inactivity.", o.order_number, timeout_hours)
                        continue
                return o
            elif o.status == OrderStatus.SERVED:
                # Active only during the 30-second release window
                updated_ts = o.updated_at.replace(tzinfo=timezone.utc) if o.updated_at and o.updated_at.tzinfo is None else o.updated_at
                if updated_ts and (now - updated_ts).total_seconds() < 30:
                    return o
        return None

    def count_orders_today(self, business_id: uuid.UUID) -> int:
        stmt = select(func.count(Order.id)).where(Order.business_id == business_id)
        return self.db.scalar(stmt) or 0

    def update(self, order: Order) -> Order:
        self.db.commit()
        self.db.refresh(order)
        return order

    def delete(self, order: Order) -> None:
        self.db.delete(order)
        self.db.commit()

    def get_item_by_id(self, item_id: uuid.UUID, order_id: uuid.UUID) -> OrderItem | None:
        stmt = select(OrderItem).where(
            OrderItem.id == item_id,
            OrderItem.order_id == order_id,
        )
        return self.db.scalar(stmt)

    def add_item(self, item: OrderItem) -> OrderItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete_item(self, item: OrderItem) -> None:
        self.db.delete(item)
        self.db.commit()
