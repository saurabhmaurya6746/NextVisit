import logging
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem, OrderStatus
from app.models.user import User
from app.repositories.order_repository import OrderRepository
from app.repositories.restaurant_table_repository import RestaurantTableRepository
from app.schemas.order import OrderCreate, OrderItemCreate, OrderItemUpdate, OrderUpdate

logger = logging.getLogger(__name__)


class OrderService:

    def __init__(self, db: Session):
        self.db = db
        self.order_repo = OrderRepository(db)
        self.table_repo = RestaurantTableRepository(db)

    def list_orders(
        self,
        current_user: User,
        status_filter: OrderStatus | None = None,
        table_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
    ) -> list[Order]:
        return self.order_repo.list_by_business(
            current_user.business_id,
            status=status_filter,
            table_id=table_id,
            customer_id=customer_id,
        )

    def get_order(self, current_user: User, order_id: uuid.UUID) -> Order:
        order = self.order_repo.get_by_id(order_id, current_user.business_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' not found.",
            )
        return order

    def _recalculate_order(self, order: Order) -> Order:
        """Automatically recalculate order subtotal, tax_amount, and total_amount."""
        total_subtotal = 0.0
        total_tax = 0.0

        for item in order.items:
            item_base = (item.unit_price * item.quantity) - item.discount
            item_subtotal = max(0.0, round(item_base, 2))
            item_tax = max(0.0, round(item_subtotal * (item.tax_rate / 100.0), 2))

            item.subtotal = item_subtotal + item_tax
            total_subtotal += item_subtotal
            total_tax += item_tax

        order.subtotal = round(total_subtotal, 2)
        order.tax_amount = round(total_tax, 2)
        order.total_amount = max(0.0, round(order.subtotal + order.tax_amount - order.discount_amount, 2))

        return self.order_repo.update(order)

    def create_order(self, current_user: User, data: OrderCreate) -> Order:
        # Business Validation: Table must belong to business
        table = self.table_repo.get_by_id(data.table_id, current_user.business_id)
        if not table:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Restaurant table '{data.table_id}' not found.",
            )

        # Generate sequential order number
        count = self.order_repo.count_orders_today(current_user.business_id)
        order_number = f"ORD-{count + 1001}"

        order_items = []
        for item_data in data.items:
            item_base = (item_data.unit_price * item_data.quantity) - item_data.discount
            item_subtotal = max(0.0, round(item_base, 2))
            item_tax = max(0.0, round(item_subtotal * (item_data.tax_rate / 100.0), 2))

            order_items.append(
                OrderItem(
                    menu_item_id=item_data.menu_item_id or item_data.service_id,
                    service_id=item_data.service_id or item_data.menu_item_id,
                    item_name=item_data.item_name.strip(),
                    unit_price=item_data.unit_price,
                    quantity=item_data.quantity,
                    tax_rate=item_data.tax_rate,
                    discount=item_data.discount,
                    subtotal=item_subtotal + item_tax,
                    notes=item_data.notes,
                )
            )

        order = Order(
            business_id=current_user.business_id,
            table_id=data.table_id,
            customer_id=data.customer_id,
            order_number=order_number,
            order_source=data.order_source,
            status=data.status,
            subtotal=0.0,
            tax_amount=data.tax_amount,
            discount_amount=data.discount_amount,
            total_amount=0.0,
            notes=data.notes,
            created_by=current_user.id,
            items=order_items,
        )

        created = self.order_repo.create(order)
        self._recalculate_order(created)
        logger.info(
            "Temporary order created: order_number=%s, table=%s, total=%f",
            created.order_number,
            table.table_name,
            created.total_amount,
        )
        return created

    def update_order(self, current_user: User, order_id: uuid.UUID, data: OrderUpdate) -> Order:
        order = self.get_order(current_user, order_id)
        update_dict = data.model_dump(exclude_unset=True)

        if "table_id" in update_dict and update_dict["table_id"] is not None:
            table = self.table_repo.get_by_id(update_dict["table_id"], current_user.business_id)
            if not table:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Target table '{update_dict['table_id']}' not found.",
                )

        if "items" in update_dict and update_dict["items"] is not None:
            new_items = []
            for item_data in data.items or []:
                item_base = (item_data.unit_price * item_data.quantity) - item_data.discount
                item_subtotal = max(0.0, round(item_base, 2))
                item_tax = max(0.0, round(item_subtotal * (item_data.tax_rate / 100.0), 2))

                new_items.append(
                    OrderItem(
                        menu_item_id=item_data.menu_item_id or item_data.service_id,
                        service_id=item_data.service_id or item_data.menu_item_id,
                        item_name=item_data.item_name.strip(),
                        unit_price=item_data.unit_price,
                        quantity=item_data.quantity,
                        tax_rate=item_data.tax_rate,
                        discount=item_data.discount,
                        subtotal=item_subtotal + item_tax,
                        notes=item_data.notes,
                    )
                )
            order.items = new_items

        for key, val in update_dict.items():
            if key != "items" and val is not None:
                setattr(order, key, val)

        return self._recalculate_order(order)

    def delete_order(self, current_user: User, order_id: uuid.UUID) -> None:
        order = self.get_order(current_user, order_id)
        self.order_repo.delete(order)
        logger.info("Temporary order deleted/cancelled: id=%s", order_id)

    # -------------------------------------------------------------------------
    # ORDER ITEMS ENDPOINTS & RECALCULATION
    # -------------------------------------------------------------------------

    def list_order_items(self, current_user: User, order_id: uuid.UUID) -> list[OrderItem]:
        order = self.get_order(current_user, order_id)
        return order.items

    def add_order_item(self, current_user: User, order_id: uuid.UUID, data: OrderItemCreate) -> Order:
        order = self.get_order(current_user, order_id)

        item_base = (data.unit_price * data.quantity) - data.discount
        item_subtotal = max(0.0, round(item_base, 2))
        item_tax = max(0.0, round(item_subtotal * (data.tax_rate / 100.0), 2))

        new_item = OrderItem(
            order_id=order.id,
            menu_item_id=data.menu_item_id or data.service_id,
            service_id=data.service_id or data.menu_item_id,
            item_name=data.item_name.strip(),
            unit_price=data.unit_price,
            quantity=data.quantity,
            tax_rate=data.tax_rate,
            discount=data.discount,
            subtotal=item_subtotal + item_tax,
            notes=data.notes,
        )
        self.order_repo.add_item(new_item)
        order = self.get_order(current_user, order_id)
        return self._recalculate_order(order)

    def update_order_item(
        self, current_user: User, order_id: uuid.UUID, item_id: uuid.UUID, data: OrderItemUpdate
    ) -> Order:
        order = self.get_order(current_user, order_id)
        item = self.order_repo.get_item_by_id(item_id, order_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order item '{item_id}' not found in order '{order_id}'.",
            )

        update_dict = data.model_dump(exclude_unset=True)
        for key, val in update_dict.items():
            if key == "item_name" and val is not None:
                val = val.strip()
            setattr(item, key, val)

        self.db.commit()
        order = self.get_order(current_user, order_id)
        return self._recalculate_order(order)

    def delete_order_item(self, current_user: User, order_id: uuid.UUID, item_id: uuid.UUID) -> Order:
        order = self.get_order(current_user, order_id)
        item = self.order_repo.get_item_by_id(item_id, order_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order item '{item_id}' not found in order '{order_id}'.",
            )

        self.order_repo.delete_item(item)
        order = self.get_order(current_user, order_id)
        return self._recalculate_order(order)
