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
from app.schemas.order import DirectSaleCreate, OrderCreate, OrderItemCreate, OrderItemUpdate, OrderUpdate

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

    def get_order(
        self,
        current_user: User | None,
        order_id: uuid.UUID,
        visit_token: str | None = None,
    ) -> Order:
        order = self.order_repo.get_by_id(order_id)
        if not order and current_user:
            # Fallback: support looking up by client_order_id within user's business
            order = self.order_repo.get_by_client_order_id(current_user.business_id, order_id)
        if not order:
            logger.warning("Order not found in DB: order_id=%s", order_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' not found.",
            )

        if current_user:
            if order.business_id != current_user.business_id:
                logger.warning("Access denied to order %s: belongs to business %s, caller is %s", order_id, order.business_id, current_user.business_id)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: order belongs to another business.",
                )
            return order

        clean_token = visit_token.strip() if (visit_token and visit_token.strip()) else None
        if not clean_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required: provide valid user credentials or visit token.",
            )

        if not order.visit_token or order.visit_token.strip() != clean_token:
            logger.warning("Invalid visit token for order %s: token mismatch or order expired", order_id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired visit token for this order.",
            )

        logger.info(
            "Order retrieved via visit token: order_id=%s, table_id=%s, business_id=%s",
            order.id,
            order.table_id,
            order.business_id,
        )
        return order

    def _recalculate_order(self, order: Order, auto_commit: bool = True) -> Order:
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

        return self.order_repo.update(order, auto_commit=auto_commit)

    def create_order(self, current_user: User, data: OrderCreate, auto_commit: bool = True) -> Order:
        # Table Resolution & Business Isolation: Lookup table by ID
        stmt = select(RestaurantTable).where(RestaurantTable.id == data.table_id)
        table = self.db.scalar(stmt)
        if not table or not table.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Restaurant table '{data.table_id}' not found or inactive.",
            )
        if current_user and table.business_id != current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: restaurant table belongs to another business.",
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
        else:
            # Guest checkout (no customer_id and no customer_details provided)
            # Enforce backend security rule: Check if business allows guest checkout
            from app.models.business_settings import BusinessSettings
            b_chk_stmt = select(BusinessSettings).where(BusinessSettings.business_id == target_business_id)
            chk_settings = self.db.scalar(b_chk_stmt)
            if chk_settings and chk_settings.allow_guest_checkout is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Guest checkout is disabled for this restaurant. A valid customer phone number is required to place an order.",
                )

        # Generate or use client-provided order number
        import re
        from app.models.business_settings import BusinessSettings

        if getattr(data, "order_number", None) and str(data.order_number).strip():
            order_number = str(data.order_number).strip()
            incoming_client_order_id = getattr(data, "client_order_id", None) or getattr(data, "id", None)
            incoming_device_id = getattr(data, "device_id", None)

            # 1. First check client_order_id idempotency within business:
            # If an order with this client_order_id already exists (even if reconciled to a new order_number),
            # return it immediately and safely.
            if incoming_client_order_id:
                existing_by_client = self.order_repo.get_by_client_order_id(target_business_id, incoming_client_order_id)
                if existing_by_client:
                    if existing_by_client.device_id and incoming_device_id and str(existing_by_client.device_id) != str(incoming_device_id):
                        logger.warning(
                            "Conflict: client_order_id %s belongs to device %s, contradictory to incoming device %s",
                            incoming_client_order_id,
                            existing_by_client.device_id,
                            incoming_device_id,
                        )
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Order exists with client_order_id '{incoming_client_order_id}' under a contradictory device.",
                        )
                    logger.info(
                        "Order %s with verified client_order_id %s already exists for business %s. Returning existing order idempotently.",
                        existing_by_client.order_number,
                        incoming_client_order_id,
                        target_business_id,
                    )
                    return existing_by_client

            # 2. Check if order_number collides with any existing order for this business
            existing_ord = self.order_repo.get_by_order_number(target_business_id, order_number)
            if existing_ord:
                # Reject contradictory device IDs
                if existing_ord.device_id and incoming_device_id and str(existing_ord.device_id) != str(incoming_device_id):
                    logger.warning(
                        "Conflict: order_number %s belongs to device %s, contradictory to incoming device %s",
                        order_number,
                        existing_ord.device_id,
                        incoming_device_id,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Order number '{order_number}' already exists for this business under a contradictory device.",
                    )

                # Verified same offline order: client_order_id matches and device_id is not contradictory
                if incoming_client_order_id and existing_ord.client_order_id and str(existing_ord.client_order_id) == str(incoming_client_order_id):
                    logger.info(
                        "Order %s with verified client_order_id %s already exists for business %s. Returning existing order idempotently.",
                        order_number,
                        incoming_client_order_id,
                        target_business_id,
                    )
                    return existing_ord

                # Safe reconciliation for offline sequence restart collisions:
                # If existing_ord is CANCELLED (historical order) and incoming order has verified client_order_id:
                # DO NOT mutate existing_ord! Historical order, its order_number, and audit trail are strictly immutable.
                # Instead, safely reconcile the INCOMING offline order to the next available sequence slot for this device prefix.
                if existing_ord.status == OrderStatus.CANCELLED and incoming_client_order_id:
                    device_prefix = None
                    if incoming_device_id:
                        from app.models.client_device import ClientDevice
                        dev = self.db.get(ClientDevice, incoming_device_id)
                        if dev:
                            device_prefix = dev.device_prefix
                    if not device_prefix:
                        match = re.match(r"^ORD-([A-Z0-9]+)-\d+$", order_number)
                        if match:
                            device_prefix = match.group(1)

                    reconciled_num = None
                    if device_prefix:
                        prefix_pattern = f"ORD-{device_prefix}-"
                        orders_stmt = select(Order.order_number).where(
                            Order.business_id == target_business_id,
                            Order.order_number.like(f"{prefix_pattern}%"),
                        )
                        existing_nums = self.db.scalars(orders_stmt).all()
                        max_seq = 0
                        for num_str in existing_nums:
                            suffix = (num_str or "")[len(prefix_pattern):]
                            if suffix.isdigit():
                                max_seq = max(max_seq, int(suffix))
                        cand_seq = max_seq + 1
                        while True:
                            cand_num = f"ORD-{device_prefix}-{cand_seq:06d}"
                            if not self.order_repo.get_by_order_number(target_business_id, cand_num):
                                reconciled_num = cand_num
                                break
                            cand_seq += 1

                    if not reconciled_num:
                        cand_seq = 1
                        while True:
                            cand_num = f"{order_number}-RECON-{cand_seq}"
                            if not self.order_repo.get_by_order_number(target_business_id, cand_num):
                                reconciled_num = cand_num
                                break
                            cand_seq += 1

                    logger.info(
                        "Order number collision: %s is held by immutable cancelled order %s. Reconciling incoming offline order %s to safe sequence %s.",
                        order_number,
                        existing_ord.id,
                        incoming_client_order_id,
                        reconciled_num,
                    )
                    order_number = reconciled_num
                else:
                    # Require a verified client_order_id match within the business and reject contradictory device IDs.
                    # Do NOT claim idempotent success or attach IDs based on order_number alone.
                    if not incoming_client_order_id or not existing_ord.client_order_id:
                        logger.warning(
                            "Conflict: order_number %s already exists for business %s but lacks verified client_order_id identity (existing=%s, incoming=%s)",
                            order_number,
                            target_business_id,
                            existing_ord.client_order_id,
                            incoming_client_order_id,
                        )
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail=f"Order number '{order_number}' already exists for this business without verified client order identity. Manual reconciliation required.",
                        )

                    logger.warning(
                        "Conflict: order_number %s has mismatched client_order_id (existing=%s, incoming=%s)",
                        order_number,
                        existing_ord.client_order_id,
                        incoming_client_order_id,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Order number '{order_number}' already exists for this business with a different client order ID.",
                    )
        else:
            # Generate atomic per-business 6-digit sequential order number with row locking
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
                    "id": getattr(item_data, "id", None),
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

            item_kwargs = {
                "menu_item_id": item_dict["menu_item_id"],
                "service_id": item_dict["service_id"],
                "item_name": item_dict["item_name"],
                "unit_price": item_dict["unit_price"],
                "quantity": item_dict["quantity"],
                "tax_rate": item_dict["tax_rate"],
                "discount": item_dict["discount"],
                "subtotal": item_subtotal,
                "notes": item_dict["notes"],
            }
            if item_dict.get("id"):
                item_kwargs["id"] = item_dict["id"]

            order_items.append(OrderItem(**item_kwargs))

        visit_token = f"vt_{uuid.uuid4().hex}"

        order_kwargs = {
            "business_id": target_business_id,
            "table_id": data.table_id,
            "customer_id": customer_id,
            "order_number": order_number,
            "order_source": data.order_source,
            "status": data.status,
            "subtotal": 0.0,
            "tax_amount": data.tax_amount,
            "discount_amount": data.discount_amount,
            "total_amount": 0.0,
            "notes": data.notes,
            "visit_token": visit_token,
            "created_by": current_user.id if current_user else None,
            "device_id": getattr(data, "device_id", None),
            "client_order_id": getattr(data, "client_order_id", None) or getattr(data, "id", None),
            "items": order_items,
        }
        if getattr(data, "id", None):
            order_kwargs["id"] = data.id

        order = Order(**order_kwargs)

        created = self.order_repo.create(order, auto_commit=auto_commit)
        self._recalculate_order(created, auto_commit=auto_commit)
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

    def add_order_item(
        self,
        current_user: User | None,
        order_id: uuid.UUID,
        data: OrderItemCreate,
        visit_token: str | None = None,
    ) -> Order:
        order = self.get_order(current_user, order_id, visit_token=visit_token)

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

        order = self.get_order(current_user, order_id, visit_token=visit_token)
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
        self, current_user: User | None, phone: str, order_amount: float = 0.0
    ) -> dict:
        clean_phone = phone.strip()
        if not current_user:
            return {
                "exists": False,
                "customer_id": None,
                "name": None,
                "phone": clean_phone,
                "loyalty": None,
            }

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

    def settle_order(self, current_user: User, order_id: uuid.UUID, data: any, auto_commit: bool = True) -> dict:
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
        if auto_commit:
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

    def create_and_settle_order(self, current_user: User, data: DirectSaleCreate, auto_commit: bool = True) -> dict:
        """
        Atomically creates and settles an offline sale in a single database transaction.
        Creates: Order (SERVED), OrderItems, Customer (if new), Visit (COMPLETED/PAID),
        and updates Customer Loyalty points. Full rollback on any failure.
        """
        import re
        from datetime import datetime, timezone
        from app.models.business_settings import BusinessSettings
        from app.models.customer import Customer
        from app.models.loyalty import CustomerLoyalty
        from app.models.order import Order, OrderItem, OrderStatus
        from app.models.restaurant_table import RestaurantTable
        from app.models.visit import PaymentStatus, Visit, VisitStatus, VisitService as VisitServiceModel
        from app.repositories.loyalty_repository import LoyaltyRepository
        from app.repositories.visit_repository import VisitRepository

        # 1. Resolve table
        stmt = select(RestaurantTable).where(RestaurantTable.id == data.table_id)
        table = self.db.scalar(stmt)
        if not table or not table.is_active or table.business_id != current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Restaurant table '{data.table_id}' not found or inactive for this business.",
            )
        target_business_id = current_user.business_id

        # 2. Resolve customer
        clean_phone = data.customer_phone.strip()
        customer = self.customer_repo.get_by_phone(target_business_id, clean_phone)
        if not customer:
            cust_name = data.customer_name.strip() if data.customer_name else f"Customer {clean_phone[-4:]}"
            new_cust = Customer(
                business_id=target_business_id,
                name=cust_name,
                phone=clean_phone,
            )
            customer = self.customer_repo.create(new_cust)
        elif data.customer_name and data.customer_name.strip():
            customer.name = data.customer_name.strip()
            self.customer_repo.update(customer)

        # 3. Determine order number
        if getattr(data, "order_number", None) and str(data.order_number).strip():
            order_number = str(data.order_number).strip()
            existing_ord = self.order_repo.get_by_order_number(target_business_id, order_number)
            if existing_ord:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Order number '{order_number}' already exists for this business.",
                )
        else:
            b_stmt = select(BusinessSettings).where(BusinessSettings.business_id == target_business_id).with_for_update()
            biz_settings = self.db.scalar(b_stmt)
            if biz_settings:
                seq = getattr(biz_settings, "next_order_number", 1) or 1
                if seq == 1:
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

        # 4. Deduplicate and merge items
        order_items = []
        total_subtotal = 0.0
        for item_data in data.items:
            item_base = (item_data.unit_price * item_data.quantity) - item_data.discount
            item_subtotal = max(0.0, round(item_base, 2))
            total_subtotal += item_subtotal

            item_kwargs = {
                "menu_item_id": item_data.menu_item_id,
                "service_id": item_data.service_id,
                "item_name": item_data.item_name.strip(),
                "unit_price": item_data.unit_price,
                "quantity": item_data.quantity,
                "tax_rate": item_data.tax_rate,
                "discount": item_data.discount,
                "subtotal": item_subtotal,
                "notes": item_data.notes,
            }
            if getattr(item_data, "id", None):
                item_kwargs["id"] = item_data.id

            order_items.append(OrderItem(**item_kwargs))

        now_ts = data.client_created_at or datetime.now(timezone.utc)
        subtotal_val = round(total_subtotal, 2)
        total_amount_val = max(0.0, round(subtotal_val + data.tax_amount - data.discount_amount, 2))

        # 5. Create Order with status SERVED
        order_kwargs = {
            "business_id": target_business_id,
            "table_id": data.table_id,
            "customer_id": customer.id,
            "order_number": order_number,
            "order_source": data.order_source,
            "status": OrderStatus.SERVED,
            "subtotal": subtotal_val,
            "tax_amount": data.tax_amount,
            "discount_amount": data.discount_amount,
            "total_amount": total_amount_val,
            "notes": data.notes,
            "visit_token": None,
            "created_by": current_user.id,
            "device_id": data.device_id,
            "client_order_id": data.client_order_id or data.id,
            "last_activity_at": now_ts,
            "items": order_items,
        }
        if data.id:
            order_kwargs["id"] = data.id

        order = Order(**order_kwargs)
        self.db.add(order)
        self.db.flush()

        # 6. Create completed Visit record
        visit = Visit(
            business_id=target_business_id,
            customer_id=customer.id,
            staff_id=current_user.id,
            status=VisitStatus.COMPLETED,
            notes=order.notes,
            subtotal=order.subtotal,
            discount=order.discount_amount,
            total_amount=order.total_amount,
            payment_method=data.payment_method,
            payment_status=PaymentStatus.PAID,
            started_at=now_ts,
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

        self.db.add(visit)
        self.db.flush()

        # 7. Update Customer stats & Loyalty
        customer.visit_count = (customer.visit_count or 0) + 1
        customer.total_spent = (customer.total_spent or 0.0) + order.total_amount
        if not customer.first_visit_at:
            customer.first_visit_at = now_ts
        customer.last_visit_at = now_ts
        self.customer_repo.update(customer)

        earned_points = 0
        from app.services.loyalty_service import LoyaltyService
        loyalty_service = LoyaltyService(self.db)
        loyalty_settings = loyalty_service.get_settings(current_user)
        customer_loyalty = loyalty_service.get_customer_loyalty(current_user, customer.id)

        if loyalty_settings and loyalty_settings.is_active and loyalty_settings.amount_required > 0:
            earned_points = int(round((order.total_amount / loyalty_settings.amount_required) * loyalty_settings.points_per_amount))

        customer_loyalty.current_points += earned_points
        customer_loyalty.lifetime_points += earned_points
        self.db.flush()

        reward_target = 100
        remaining_until_next = max(0, reward_target - (customer_loyalty.current_points % reward_target))

        # 8. Commit atomic transaction
        if auto_commit:
            self.db.commit()

        logger.info(
            "Direct offline sale atomic created and settled: order_number=%s, customer=%s, total=%f, earned_points=%d",
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
            "visit_id": visit.id,
            "whatsapp_receipt_sent": False,
        }
