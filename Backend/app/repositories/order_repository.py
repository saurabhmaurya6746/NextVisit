import uuid
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload
from app.models.order import Order, OrderItem, OrderStatus


class OrderRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, order: Order) -> Order:
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        return order

    def get_by_id(self, order_id: uuid.UUID, business_id: uuid.UUID) -> Order | None:
        stmt = (
            select(Order)
            .options(joinedload(Order.items))
            .where(
                Order.id == order_id,
                Order.business_id == business_id,
            )
        )
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
            .options(joinedload(Order.items))
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

    def get_active_order_for_table(self, table_id: uuid.UUID, business_id: uuid.UUID) -> Order | None:
        stmt = (
            select(Order)
            .options(joinedload(Order.items))
            .where(
                Order.table_id == table_id,
                Order.business_id == business_id,
                Order.status != OrderStatus.CANCELLED,
            )
            .order_by(Order.created_at.desc())
        )
        return self.db.scalars(stmt).first()

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
