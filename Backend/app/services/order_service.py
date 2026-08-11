import logging
import math
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.order import Order, OrderItem, OrderStatus
from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.repositories.customer_repository import CustomerRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.restaurant_table_repository import RestaurantTableRepository
from app.schemas.order import OrderCreate, OrderItemCreate, OrderItemUpdate, OrderUpdate

logger = logging.getLogger(__name__)


class OrderService:

    def __init__(self, db: Session):
        self.db = db
        self.order_repo = OrderRepository(db)
        self.table_repo = RestaurantTableRepository(db)
        self.customer_repo = CustomerRepository(db)

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

    def list_orders_paginated(
        self,
        current_user: User,
        page: int = 1,
        page_size: int = 20,
        status_filter: OrderStatus | None = None,
        table_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
        order_source: str | None = None,
        search: str | None = None,
        date_filter: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict:
        return self.order_repo.list_by_business_paginated(
            current_user.business_id,
            page=page,
            page_size=page_size,
            status=status_filter,
            table_id=table_id,
            customer_id=customer_id,
            order_source=order_source,
            search=search,
            date_filter=date_filter,
            start_date=start_date,
            end_date=end_date,
        )

    def get_order(self, current_user: User | None, order_id: uuid.UUID) -> Order:
        order = self.order_repo.get_by_id(order_id)
        if not order:
            logger.warning("Order not found in DB: order_id=%s", order_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' not found.",
            )

        logger.info(
            "Order retrieved: visit_token=%s, order_id=%s, table_id=%s, business_id=%s",
            order.visit_token,
            order.id,
            order.table_id,
            order.business_id,
        )
        return order

    def _recalculate_order(self, order: Order) -> Order:
        """Automatically recalculate order subtotal, tax_amount, and total_amount."""
        from datetime import datetime, timezone
        from app.models.business_settings import BusinessSettings

        total_subtotal = 0.0

        for item in order.items:
            item_base = (item.unit_price * item.quantity) - item.discount
            item_subtotal = max(0.0, round(item_base, 2))

            item.subtotal = item_subtotal
            total_subtotal += item_subtotal

        order.subtotal = round(total_subtotal, 2)

        # Fetch BusinessSettings for configured GST percentage
        stmt = select(BusinessSettings).where(BusinessSettings.business_id == order.business_id)
        biz_settings = self.db.scalar(stmt)
        tax_rate = biz_settings.tax_percentage if (biz_settings and biz_settings.enable_gst) else 0.0

        order.tax_amount = max(0.0, round(order.subtotal * (tax_rate / 100.0), 2))
        order.total_amount = max(0.0, round(order.subtotal + order.tax_amount - order.discount_amount, 2))
        order.last_activity_at = datetime.now(timezone.utc)

        return self.order_repo.update(order)

    def create_order(self, current_user: User, data: OrderCreate) -> Order:
        # Table Resolution & Business Isolation: Lookup table by ID
        stmt = select(RestaurantTable).where(RestaurantTable.id == data.table_id)
        table = self.db.scalar(stmt)
        if not table or not table.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Restaurant table '{data.table_id}' not found or inactive.",
            )

        target_business_id = table.business_id

        # Customer details logic:
        # Case 1: Existing customer passed by ID or phone lookup
        # Case 2: New customer passed via customer_details -> create automatically
        # Case 3: Guest customer -> customer_id remains None
        customer_id = data.customer_id

        if not customer_id and data.customer_details:
            phone = data.customer_details.phone.strip()
            existing_cust = self.customer_repo.get_by_phone(target_business_id, phone)
            if existing_cust:
                customer_id = existing_cust.id
                if data.customer_details.name and data.customer_details.name.strip():
                    existing_cust.name = data.customer_details.name.strip()
                    self.customer_repo.update(existing_cust)
            else:
                new_cust = Customer(
                    business_id=target_business_id,
                    name=data.customer_details.name.strip(),
                    phone=phone,
                    email=data.customer_details.email.strip() if data.customer_details.email else None,
                    birth_date=data.customer_details.birth_date,
                    anniversary_date=data.customer_details.anniversary_date,
                    notes=data.customer_details.notes.strip() if data.customer_details.notes else None,
                )
                created_cust = self.customer_repo.create(new_cust)
                customer_id = created_cust.id
        elif customer_id:
            cust = self.customer_repo.get_by_id(customer_id)
            if not cust or cust.business_id != target_business_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Customer '{customer_id}' not found for business.",
                )

        # Generate atomic per-business 6-digit sequential order number with row locking
        import re
        from app.models.business_settings import BusinessSettings

        b_stmt = select(BusinessSettings).where(BusinessSettings.business_id == target_business_id).with_for_update()
        biz_settings = self.db.scalar(b_stmt)

        if biz_settings:
            seq = getattr(biz_settings, "next_order_number", 1) or 1
            if seq == 1:
                # Scan existing orders for this business to find highest historical numeric sequence
                orders_stmt = select(Order.order_number).where(Order.business_id == target_business_id)
                existing_numbers = self.db.scalars(orders_stmt).all()
                max_existing = 0
                for num in existing_numbers:
                    match = re.search(r'\d+', num or "")
                    if match:
                        try:
                            max_existing = max(max_existing, int(match.group(0)))
                        except ValueError:
                            pass
                if max_existing >= seq:
                    seq = max_existing + 1

            order_number = f"ORD-{seq:06d}"
            biz_settings.next_order_number = seq + 1
        else:
            orders_stmt = select(Order.order_number).where(Order.business_id == target_business_id)
            existing_numbers = self.db.scalars(orders_stmt).all()
            max_existing = 0
            for num in existing_numbers:
                match = re.search(r'\d+', num or "")
                if match:
                    try:
                        max_existing = max(max_existing, int(match.group(0)))
                    except ValueError:
                        pass
            order_number = f"ORD-{(max_existing + 1):06d}"

        # Deduplicate and merge items
        merged_items_map = {}
        for item_data in data.items:
            key = (
                f"m_{item_data.menu_item_id}" if item_data.menu_item_id else
                f"s_{item_data.service_id}" if item_data.service_id else
                f"n_{item_data.item_name.strip().lower()}"
            )
            if key in merged_items_map:
                existing = merged_items_map[key]
                existing["quantity"] += item_data.quantity
                if item_data.notes and item_data.notes.strip():
                    existing["notes"] = (existing["notes"] + "; " if existing["notes"] else "") + item_data.notes.strip()
            else:
                merged_items_map[key] = {
                    "menu_item_id": item_data.menu_item_id,
                    "service_id": item_data.service_id,
                    "item_name": item_data.item_name.strip(),
                    "unit_price": item_data.unit_price,
                    "quantity": item_data.quantity,
                    "tax_rate": item_data.tax_rate,
                    "discount": item_data.discount,
                    "notes": item_data.notes,
                }

        order_items = []
        for item_dict in merged_items_map.values():
            item_base = (item_dict["unit_price"] * item_dict["quantity"]) - item_dict["discount"]
            item_subtotal = max(0.0, round(item_base, 2))

            order_items.append(
                OrderItem(
                    menu_item_id=item_dict["menu_item_id"],
                    service_id=item_dict["service_id"],
                    item_name=item_dict["item_name"],
                    unit_price=item_dict["unit_price"],
                    quantity=item_dict["quantity"],
                    tax_rate=item_dict["tax_rate"],
                    discount=item_dict["discount"],
                    subtotal=item_subtotal,
                    notes=item_dict["notes"],
                )
            )

        visit_token = f"vt_{uuid.uuid4().hex}"

        order = Order(
            business_id=target_business_id,
            table_id=data.table_id,
            customer_id=customer_id,
            order_number=order_number,
            order_source=data.order_source,
            status=data.status,
            subtotal=0.0,
            tax_amount=data.tax_amount,
            discount_amount=data.discount_amount,
            total_amount=0.0,
            notes=data.notes,
            visit_token=visit_token,
            created_by=current_user.id if current_user else None,
            items=order_items,
        )

        created = self.order_repo.create(order)
        self._recalculate_order(created)
        logger.info(
            "Temporary order created: order_number=%s, table=%s, customer=%s, total=%f",
            created.order_number,
            table.table_name,
            customer_id,
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
            merged_items_map = {}
            for item_data in data.items or []:
                key = (
                    f"m_{item_data.menu_item_id}" if item_data.menu_item_id else
                    f"s_{item_data.service_id}" if item_data.service_id else
                    f"n_{item_data.item_name.strip().lower()}"
                )
                if key in merged_items_map:
                    existing = merged_items_map[key]
                    existing["quantity"] += item_data.quantity
                    if item_data.notes and item_data.notes.strip():
                        existing["notes"] = (existing["notes"] + "; " if existing["notes"] else "") + item_data.notes.strip()
                else:
                    merged_items_map[key] = {
                        "menu_item_id": item_data.menu_item_id,
                        "service_id": item_data.service_id,
                        "item_name": item_data.item_name.strip(),
                        "unit_price": item_data.unit_price,
                        "quantity": item_data.quantity,
                        "tax_rate": item_data.tax_rate,
                        "discount": item_data.discount,
                        "notes": item_data.notes,
                    }

            new_items = []
            for item_dict in merged_items_map.values():
                item_base = (item_dict["unit_price"] * item_dict["quantity"]) - item_dict["discount"]
                item_subtotal = max(0.0, round(item_base, 2))

                new_items.append(
                    OrderItem(
                        menu_item_id=item_dict["menu_item_id"],
                        service_id=item_dict["service_id"],
                        item_name=item_dict["item_name"],
                        unit_price=item_dict["unit_price"],
                        quantity=item_dict["quantity"],
                        tax_rate=item_dict["tax_rate"],
                        discount=item_dict["discount"],
                        subtotal=item_subtotal,
                        notes=item_dict["notes"],
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

        # Check if an order item with the same menu_item_id or service_id or item_name already exists!
        existing_item = None
        for item in order.items:
            if data.menu_item_id and item.menu_item_id == data.menu_item_id:
                existing_item = item
                break
            elif data.service_id and item.service_id == data.service_id:
                existing_item = item
                break
            elif (
                not data.menu_item_id
                and not data.service_id
                and item.item_name.strip().lower() == data.item_name.strip().lower()
            ):
                existing_item = item
                break

        if existing_item:
            existing_item.quantity += data.quantity
            item_base = (existing_item.unit_price * existing_item.quantity) - existing_item.discount
            item_subtotal = max(0.0, round(item_base, 2))
            existing_item.subtotal = item_subtotal
            if data.notes and data.notes.strip():
                existing_item.notes = (
                    (existing_item.notes + "; " if existing_item.notes else "") + data.notes.strip()
                )
            self.db.commit()
        else:
            item_base = (data.unit_price * data.quantity) - data.discount
            item_subtotal = max(0.0, round(item_base, 2))

            new_item = OrderItem(
                order_id=order.id,
                menu_item_id=data.menu_item_id,
                service_id=data.service_id,
                item_name=data.item_name.strip(),
                unit_price=data.unit_price,
                quantity=data.quantity,
                tax_rate=data.tax_rate,
                discount=data.discount,
                subtotal=item_subtotal,
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

    # -------------------------------------------------------------------------
    # CUSTOMER AUTO-DETECT & PAYMENT SETTLEMENT
    # -------------------------------------------------------------------------

    def auto_detect_customer(
        self, current_user: User, phone: str, order_amount: float = 0.0
    ) -> dict:
        clean_phone = phone.strip()
        customer = self.customer_repo.get_by_phone(current_user.business_id, clean_phone)

        if not customer:
            return {
                "exists": False,
                "customer_id": None,
                "name": None,
                "phone": clean_phone,
                "loyalty": None,
            }

        # Fetch loyalty stats using LoyaltyService (SINGLE SOURCE OF TRUTH)
        from app.services.loyalty_service import LoyaltyService

        loyalty_service = LoyaltyService(self.db)
        loyalty_settings = loyalty_service.get_settings(current_user)
        customer_loyalty = loyalty_service.get_customer_loyalty(current_user, customer.id)

        current_points = customer_loyalty.current_points if customer_loyalty else 0
        points_earned_estimated = 0
        reward_target = 100

        if (
            loyalty_settings
            and loyalty_settings.is_active
            and loyalty_settings.amount_required > 0
            and order_amount > 0
        ):
            points_earned_estimated = int(round((order_amount / loyalty_settings.amount_required) * loyalty_settings.points_per_amount))

        total_points_after = current_points + points_earned_estimated
        remaining_until_next = max(0, reward_target - (total_points_after % reward_target))

        return {
            "exists": True,
            "customer_id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "loyalty": {
                "current_points": current_points,
                "points_earned": points_earned_estimated,
                "remaining_until_next_reward": remaining_until_next,
                "reward_target": reward_target,
            },
        }

    def settle_order(self, current_user: User, order_id: uuid.UUID, data: any) -> dict:
        import math
        from datetime import datetime, timezone
        from app.models.loyalty import CustomerLoyalty
        from app.models.visit import PaymentStatus, Visit, VisitStatus, VisitService as VisitServiceModel
        from app.repositories.loyalty_repository import LoyaltyRepository
        from app.repositories.visit_repository import VisitRepository

        order = self.get_order(current_user, order_id)
        if order.status == OrderStatus.SERVED or order.status == OrderStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order is already {order.status.value.lower()}.",
            )

        clean_phone = data.phone.strip()
        customer = self.customer_repo.get_by_phone(current_user.business_id, clean_phone)

        if not customer:
            cust_name = data.customer_name.strip() if data.customer_name else f"Customer {clean_phone[-4:]}"
            new_cust = Customer(
                business_id=current_user.business_id,
                name=cust_name,
                phone=clean_phone,
                birth_date=data.birth_date,
                anniversary_date=data.anniversary_date,
                gender=data.gender,
            )
            customer = self.customer_repo.create(new_cust)
        elif data.customer_name and data.customer_name.strip():
            customer.name = data.customer_name.strip()
            self.customer_repo.update(customer)

        # 1. Update order status, clear visit token, set last activity
        now_ts = datetime.now(timezone.utc)
        order.customer_id = customer.id
        if data.discount_amount and data.discount_amount > 0:
            order.discount_amount = data.discount_amount
            self._recalculate_order(order)

        order.status = OrderStatus.SERVED
        order.visit_token = None  # Immediately invalidate visit token on DB!
        order.last_activity_at = now_ts
        order.updated_at = now_ts

        # 2. Create Visit Record
        visit_repo = VisitRepository(self.db)

        visit = Visit(
            business_id=current_user.business_id,
            customer_id=customer.id,
            staff_id=current_user.id,
            status=VisitStatus.COMPLETED,
            notes=order.notes,
            subtotal=order.subtotal,
            discount=order.discount_amount,
            total_amount=order.total_amount,
            payment_method=data.payment_method,
            payment_status=PaymentStatus.PAID,
            started_at=order.created_at or now_ts,
            completed_at=now_ts,
        )

        for item in order.items:
            if item.service_id:
                vs = VisitServiceModel(
                    service_id=item.service_id,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    total_price=item.subtotal,
                )
                visit.services.append(vs)

        created_visit = visit_repo.create(visit)

        # 3. Award Loyalty Points & Update Customer Stats
        customer.visit_count = (customer.visit_count or 0) + 1
        customer.total_spent = (customer.total_spent or 0.0) + order.total_amount
        if not customer.first_visit_at:
            customer.first_visit_at = now_ts
        customer.last_visit_at = now_ts
        self.customer_repo.update(customer)

        # Automatic VIP recalculation
        try:
            from app.services.customer_service import CustomerService
            cs = CustomerService(self.db)
            v_set = cs.get_or_create_vip_settings(current_user.business_id)
            is_vip, _ = cs.evaluate_customer_vip_status(customer, v_set)
            if is_vip:
                customer.status = "VIP"
        except Exception as ex:
            logger.warning("Failed to evaluate VIP status on order settlement: %s", ex)

        earned_points = 0
        from app.services.loyalty_service import LoyaltyService

        loyalty_service = LoyaltyService(self.db)
        loyalty_settings = loyalty_service.get_settings(current_user)
        customer_loyalty = loyalty_service.get_customer_loyalty(current_user, customer.id)

        if (
            loyalty_settings
            and loyalty_settings.is_active
            and loyalty_settings.amount_required > 0
        ):
            earned_points = int(round((order.total_amount / loyalty_settings.amount_required) * loyalty_settings.points_per_amount))

        customer_loyalty.current_points += earned_points
        customer_loyalty.lifetime_points += earned_points
        self.db.flush()

        reward_target = 100
        remaining_until_next = max(0, reward_target - (customer_loyalty.current_points % reward_target))

        # 4. Save Changes to DB
        self.db.commit()

        # 5. Build WhatsApp Receipt Summary
        receipt_text = (
            f"🎉 *Payment Successful!*\n"
            f"Order #: *{order.order_number}*\n"
            f"Amount Paid: *₹{order.total_amount:,.2f}*\n"
            f"Payment Method: *{data.payment_method}*\n"
            f"Points Earned: *+{earned_points} pts*\n"
            f"Current Loyalty Balance: *{customer_loyalty.current_points} pts*\n"
            f"Thank you for dining with us! See you soon. 🙏"
        )

        logger.info(
            "Order settled: order_number=%s, customer=%s, total=%f, earned_points=%d",
            order.order_number,
            customer.name,
            order.total_amount,
            earned_points,
        )

        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "business_id": order.business_id,
            "table_id": order.table_id,
            "customer_id": customer.id,
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "payment_method": data.payment_method,
            "total_amount": order.total_amount,
            "earned_points": earned_points,
            "new_loyalty_balance": customer_loyalty.current_points,
            "remaining_until_next_reward": remaining_until_next,
            "visit_id": created_visit.id,
            "whatsapp_receipt_sent": True,
            "whatsapp_receipt_text": receipt_text,
        }
