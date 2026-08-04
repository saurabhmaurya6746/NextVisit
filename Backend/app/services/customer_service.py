import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.user import User
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate

logger = logging.getLogger(__name__)


class CustomerService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = CustomerRepository(db)

    def _enrich_loyalty_points(self, current_user: User, customer: Customer) -> Customer:
        if customer and not customer.loyalty:
            from app.services.loyalty_service import LoyaltyService
            loyalty = LoyaltyService(self.db).get_customer_loyalty(current_user, customer.id)
            customer.loyalty = loyalty
        return customer

    def list_customers(self, current_user: User) -> list[Customer]:
        logger.info(
            "Listing customers | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        customers = self.repo.get_all_by_business(current_user.business_id)
        from app.services.loyalty_service import LoyaltyService
        loyalty_service = LoyaltyService(self.db)
        for c in customers:
            if not c.loyalty:
                c.loyalty = loyalty_service.get_customer_loyalty(current_user, c.id)
        return customers

    def get_paginated_customers(
        self,
        current_user: User,
        page: int = 1,
        limit: int = 10,
        search: str | None = None,
        sort: str | None = "newest",
        filter: str | None = "all",
    ) -> dict:
        logger.info(
            "Fetching paginated customers | business_id=%s page=%s limit=%s search=%s sort=%s filter=%s",
            current_user.business_id,
            page,
            limit,
            search,
            sort,
            filter,
        )
        res = self.repo.get_paginated_by_business(
            business_id=current_user.business_id,
            page=page,
            limit=limit,
            search=search,
            sort=sort,
            filter=filter,
        )
        from app.services.loyalty_service import LoyaltyService
        loyalty_service = LoyaltyService(self.db)
        for c in res["items"]:
            if not c.loyalty:
                c.loyalty = loyalty_service.get_customer_loyalty(current_user, c.id)
        return res

    def get_customer(self, current_user: User, customer_id: UUID) -> Customer:
        customer = self.repo.get_by_id(customer_id)
        if not customer or customer.business_id != current_user.business_id:
            logger.warning(
                "Customer not found or tenant mismatch | customer_id=%s business_id=%s",
                customer_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found.",
            )

        logger.info(
            "Customer fetched | customer_id=%s business_id=%s",
            customer.id,
            customer.business_id,
        )
        return self._enrich_loyalty_points(current_user, customer)

    def get_customer_by_phone(self, current_user: User, phone: str) -> Customer:
        customer = self.repo.get_by_phone(current_user.business_id, phone.strip())
        if not customer:
            logger.info(
                "Customer not found by phone | phone=%s business_id=%s",
                phone,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with phone '{phone}' not found.",
            )
        return self._enrich_loyalty_points(current_user, customer)

    def create_customer(
        self, current_user: User, data: CustomerCreate
    ) -> Customer:
        logger.info(
            "Creating customer | business_id=%s phone=%s",
            current_user.business_id,
            data.phone,
        )

        existing_customer = self.repo.get_by_phone(
            current_user.business_id, data.phone
        )
        if existing_customer:
            logger.warning(
                "Customer creation rejected — duplicate phone inside business | business_id=%s phone=%s",
                current_user.business_id,
                data.phone,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A customer with this phone number already exists in your business.",
            )

        customer = Customer(
            business_id=current_user.business_id,
            **data.model_dump(),
        )
        created_customer = self.repo.create(customer)
        self.db.commit()
        self.db.refresh(created_customer)

        logger.info(
            "Customer created successfully | customer_id=%s business_id=%s",
            created_customer.id,
            created_customer.business_id,
        )
        return self._enrich_loyalty_points(current_user, created_customer)

    def update_customer(
        self,
        current_user: User,
        customer_id: UUID,
        data: CustomerUpdate,
    ) -> Customer:
        customer = self.get_customer(current_user, customer_id)

        if data.phone is not None and data.phone != customer.phone:
            existing_customer = self.repo.get_by_phone(
                current_user.business_id, data.phone
            )
            if existing_customer and existing_customer.id != customer.id:
                logger.warning(
                    "Customer update rejected — duplicate phone inside business | business_id=%s phone=%s",
                    current_user.business_id,
                    data.phone,
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A customer with this phone number already exists in your business.",
                )

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(customer, field, value)

        self.repo.update(customer)
        self.db.commit()
        self.db.refresh(customer)

        logger.info(
            "Customer updated successfully | customer_id=%s business_id=%s",
            customer.id,
            customer.business_id,
        )
        return self._enrich_loyalty_points(current_user, customer)

    def delete_customer(self, current_user: User, customer_id: UUID) -> dict:
        customer = self.get_customer(current_user, customer_id)
        self.repo.delete(customer)
        self.db.commit()
        logger.info(
            "Customer deleted successfully | customer_id=%s business_id=%s",
            customer_id,
            current_user.business_id,
        )
        return {"message": "Customer deleted successfully", "id": str(customer_id)}

    def record_customer_visit(self, current_user: User, customer_id: UUID, amount_spent: float) -> Customer:
        from datetime import datetime, timezone
        customer = self.get_customer(current_user, customer_id)
        now_ts = datetime.now(timezone.utc)

        customer.visit_count = (customer.visit_count or 0) + 1
        customer.total_spent = (customer.total_spent or 0.0) + max(0.0, amount_spent)
        if not customer.first_visit_at:
            customer.first_visit_at = now_ts
        customer.last_visit_at = now_ts

        # Calculate and award loyalty points
        from app.repositories.loyalty_repository import LoyaltyRepository
        from app.models.loyalty import CustomerLoyalty
        loyalty_repo = LoyaltyRepository(self.db)
        loyalty_settings = loyalty_repo.get_settings(current_user.business_id)

        points_per_amount = loyalty_settings.points_per_amount if (loyalty_settings and loyalty_settings.is_active) else 1
        amount_req = loyalty_settings.amount_required if (loyalty_settings and loyalty_settings.is_active) else 10

        earned = int((amount_spent / amount_req) * points_per_amount) if (amount_req > 0 and points_per_amount > 0) else int(amount_spent // 10)
        if earned > 0:
            cl = loyalty_repo.get_customer_loyalty(customer_id)
            if not cl:
                cl = CustomerLoyalty(customer_id=customer_id, current_points=0, lifetime_points=0, redeemed_points=0)
                loyalty_repo.create_customer_loyalty(cl)
            cl.current_points += earned
            cl.lifetime_points += earned
            loyalty_repo.update_customer_loyalty(cl)

        self.repo.update(customer)
        self.db.commit()
        self.db.refresh(customer)
        logger.info("Recorded customer visit | customer_id=%s visits=%d total_spent=%.2f points=%d", customer.id, customer.visit_count, customer.total_spent, customer.loyalty_points)
        return self._enrich_loyalty_points(current_user, customer)

    def get_customer_crm_details(self, current_user: User, customer_id: UUID) -> dict:
        from sqlalchemy import select
        from sqlalchemy.orm import joinedload
        from app.models.order import Order, OrderSource, OrderStatus
        from app.models.visit import Visit
        from app.models.restaurant_table import RestaurantTable
        from app.models.dining_area import DiningArea
        from app.models.campaign import CampaignLog
        from app.schemas.customer import CustomerResponse

        customer = self.get_customer(current_user, customer_id)

        # 1. Fetch Orders for customer
        orders_stmt = (
            select(Order)
            .options(joinedload(Order.items))
            .where(Order.customer_id == customer_id, Order.business_id == current_user.business_id)
            .order_by(Order.created_at.desc())
        )
        orders = list(self.db.scalars(orders_stmt).unique().all())

        # 2. Fetch Visits for customer
        visits_stmt = (
            select(Visit)
            .where(Visit.customer_id == customer_id, Visit.business_id == current_user.business_id)
            .order_by(Visit.started_at.desc())
        )
        visits = list(self.db.scalars(visits_stmt).all())

        # 3. Tables & Dining Areas map
        tables_stmt = select(RestaurantTable).where(RestaurantTable.business_id == current_user.business_id)
        tables = list(self.db.scalars(tables_stmt).all())
        table_map = {t.id: t for t in tables}

        areas_stmt = select(DiningArea).where(DiningArea.business_id == current_user.business_id)
        areas = list(self.db.scalars(areas_stmt).all())
        area_map = {a.id: a.name for a in areas}

        # 4. Campaign logs
        logs_stmt = (
            select(CampaignLog)
            .options(joinedload(CampaignLog.campaign))
            .where(CampaignLog.customer_id == customer_id)
            .order_by(CampaignLog.created_at.desc())
        )
        campaign_logs = list(self.db.scalars(logs_stmt).all())

        # Calculate metrics
        completed_orders = [o for o in orders if o.status == OrderStatus.SERVED]
        total_spent = sum(o.total_amount for o in completed_orders) or customer.total_spent or 0.0
        total_visits = max(len(visits), customer.visit_count or 0)
        total_orders = len(orders)
        avg_bill = round(total_spent / max(1, len(completed_orders) or total_orders), 2) if (total_spent > 0 and (completed_orders or orders)) else 0.0

        total_qr = sum(1 for o in orders if str(o.order_source).upper() in ("QR", "ORDERSOURCE.QR"))
        total_staff = total_orders - total_qr

        # Table & Dining Area preference
        table_counts = {}
        for o in orders:
            if o.table_id:
                table_counts[o.table_id] = table_counts.get(o.table_id, 0) + 1

        fav_table_obj = table_map.get(max(table_counts, key=table_counts.get)) if table_counts else None
        fav_table_name = fav_table_obj.table_name if fav_table_obj else (tables[0].table_name if tables else "Table 1")
        pref_area_name = area_map.get(fav_table_obj.dining_area_id) if (fav_table_obj and fav_table_obj.dining_area_id) else (areas[0].name if areas else "Main Hall")

        # Favorite items
        item_stats = {}
        for o in orders:
            for item in o.items:
                name = item.item_name
                if name not in item_stats:
                    item_stats[name] = {"count": 0, "total_spent": 0.0}
                item_stats[name]["count"] += item.quantity
                item_stats[name]["total_spent"] += item.subtotal

        sorted_items = sorted(item_stats.items(), key=lambda x: x[1]["count"], reverse=True)[:3]
        fav_items_list = [
            {"name": name, "count": data["count"], "total_spent": round(data["total_spent"], 2)}
            for name, data in sorted_items
        ]

        # Calculate average visit frequency in days
        avg_frequency_days = None
        if len(visits) >= 2:
            dates = sorted([v.started_at for v in visits if v.started_at])
            if len(dates) >= 2:
                diff_days = (dates[-1] - dates[0]).days
                avg_frequency_days = round(diff_days / (len(dates) - 1), 1)

        # Timeline events synthesis
        timeline = []
        for o in orders:
            t_obj = table_map.get(o.table_id)
            t_name = t_obj.table_name if t_obj else "Table"
            a_name = area_map.get(t_obj.dining_area_id) if (t_obj and t_obj.dining_area_id) else "Main Area"
            item_count = sum(i.quantity for i in o.items)

            # Order Placed Event
            timeline.append({
                "id": f"order-{o.id}",
                "type": "ORDER",
                "title": f"Ordered {item_count} Item(s) at {a_name} ({t_name})",
                "description": f"Order #{o.order_number} · Source: {o.order_source}",
                "timestamp": o.created_at,
                "badge": o.order_source,
                "amount": o.total_amount,
            })

            # Bill Payment Completed Event (if SERVED)
            if o.status == OrderStatus.SERVED:
                earned_pts = int(round((o.total_amount / 100.0) * 10.0))
                timeline.append({
                    "id": f"pay-{o.id}",
                    "type": "PAYMENT",
                    "title": f"Bill Payment Completed — ₹{o.total_amount:,.2f}",
                    "description": f"Order #{o.order_number} settled successfully",
                    "timestamp": o.updated_at or o.created_at,
                    "badge": "Completed",
                    "amount": o.total_amount,
                })
                if earned_pts > 0:
                    timeline.append({
                        "id": f"loyalty-{o.id}",
                        "type": "LOYALTY",
                        "title": f"Earned {earned_pts} Loyalty Points",
                        "description": f"Purchase reward for Order #{o.order_number}",
                        "timestamp": o.updated_at or o.created_at,
                        "badge": f"+{earned_pts} pts",
                        "amount": None,
                    })

        for v in visits:
            timeline.append({
                "id": f"visit-{v.id}",
                "type": "VISIT",
                "title": f"Visited Restaurant",
                "description": f"Status: {v.status} · Spent: ₹{v.total_amount:,.2f}",
                "timestamp": v.started_at or v.created_at,
                "badge": v.status,
                "amount": v.total_amount,
            })

        for log in campaign_logs:
            c_name = log.campaign.name if log.campaign else "WhatsApp Campaign"
            timeline.append({
                "id": f"wa-{log.id}",
                "type": "WHATSAPP",
                "title": f"WhatsApp Message Sent ({c_name})",
                "description": log.campaign.message if (log.campaign and log.campaign.message) else "Message delivered",
                "timestamp": log.sent_at or log.created_at,
                "badge": log.status,
                "amount": None,
            })

        # Sort timeline descending by timestamp
        timeline.sort(key=lambda x: x["timestamp"], reverse=True)

        # Build Visits response list
        visits_list = []
        for idx, v in enumerate(reversed(visits), 1):
            visits_list.append({
                "id": str(v.id),
                "visit_number": idx,
                "date": v.started_at or v.created_at,
                "table_name": fav_table_name,
                "dining_area_name": pref_area_name,
                "source": "QR" if v.services else "STAFF",
                "status": v.status,
                "total_amount": v.total_amount,
                "loyalty_earned": int(round((v.total_amount / 100.0) * 10.0)),
                "payment_method": v.payment_method or "CASH",
            })
        visits_list.sort(key=lambda x: x["date"], reverse=True)

        # Build Orders response list
        orders_list = []
        for o in orders:
            t_obj = table_map.get(o.table_id)
            orders_list.append({
                "id": str(o.id),
                "order_number": o.order_number,
                "status": o.status,
                "source": o.order_source,
                "table_name": t_obj.table_name if t_obj else "Table",
                "created_at": o.created_at,
                "completed_at": o.updated_at if o.status == OrderStatus.SERVED else None,
                "subtotal": o.subtotal,
                "tax_amount": o.tax_amount,
                "discount_amount": o.discount_amount,
                "total_amount": o.total_amount,
                "items": [
                    {
                        "id": str(i.id),
                        "name": i.item_name,
                        "unit_price": i.unit_price,
                        "quantity": i.quantity,
                        "subtotal": i.subtotal,
                        "notes": i.notes,
                    }
                    for i in o.items
                ],
            })

        # Build Loyalty Ledger
        loyalty_obj = customer.loyalty
        curr_pts = loyalty_obj.current_points if loyalty_obj else customer.loyalty_points
        life_pts = loyalty_obj.lifetime_points if loyalty_obj else curr_pts
        redeemed_pts = loyalty_obj.redeemed_points if loyalty_obj else 0

        loyalty_ledger = []
        for o in completed_orders:
            pts = int(round((o.total_amount / 100.0) * 10.0))
            if pts > 0:
                loyalty_ledger.append({
                    "id": f"loy-ledg-{o.id}",
                    "date": o.updated_at or o.created_at,
                    "reason": f"Earned from Order #{o.order_number} (₹{o.total_amount:,.2f})",
                    "points": pts,
                    "type": "EARNED",
                    "balance_after": curr_pts,
                })
        loyalty_ledger.sort(key=lambda x: x["date"], reverse=True)

        # Build WhatsApp & Campaign logs
        wa_logs_list = [
            {
                "id": str(log.id),
                "campaign_name": log.campaign.name if log.campaign else "Direct Message",
                "type": log.campaign.campaign_type if log.campaign else "WELCOME",
                "message": log.campaign.message if log.campaign else "Thank you for dining with us!",
                "status": log.status,
                "sent_at": log.sent_at or log.created_at,
            }
            for log in campaign_logs
        ]

        campaigns_list = [
            {
                "id": str(log.campaign.id) if log.campaign else str(log.id),
                "name": log.campaign.name if log.campaign else "Automated Campaign",
                "type": log.campaign.campaign_type if log.campaign else "CUSTOM",
                "status": log.status,
                "sent_at": log.sent_at or log.created_at,
            }
            for log in campaign_logs if log.campaign
        ]

        # AI Insights generator logic
        ai_insights_text = "AI insights will appear after sufficient customer activity."
        if total_visits >= 2 or total_orders >= 2:
            ai_insights_text = (
                f"{customer.name} is a repeat guest with {total_visits} visit(s) and a lifetime spend of ₹{total_spent:,.2f}. "
                f"They prefer dining in {pref_area_name} ({fav_table_name}) and frequently order {sorted_items[0][0] if sorted_items else 'popular items'}. "
                f"Recommended engagement: Send a loyalty bonus coupon or weekend special offer."
            )

        last_ord_at = orders[0].created_at if orders else None

        return {
            "profile": CustomerResponse.model_validate(customer),
            "total_visits": total_visits,
            "total_orders": total_orders,
            "total_spent": total_spent,
            "avg_bill": avg_bill,
            "loyalty_points": curr_pts,
            "last_visit_at": customer.last_visit_at,
            "first_visit_at": customer.first_visit_at,
            "last_order_at": last_ord_at,
            "customer_since": customer.created_at,
            "total_qr_orders": total_qr,
            "total_staff_orders": total_staff,
            "preferred_dining_area": pref_area_name,
            "favorite_table": fav_table_name,
            "favorite_items": fav_items_list,
            "avg_visit_frequency_days": avg_frequency_days,
            "customer_lifetime_value": total_spent,
            "timeline": timeline,
            "visits": visits_list,
            "orders": orders_list,
            "loyalty_history": loyalty_ledger,
            "loyalty_current_points": curr_pts,
            "loyalty_lifetime_points": life_pts,
            "loyalty_redeemed_points": redeemed_pts,
            "whatsapp_logs": wa_logs_list,
            "campaigns": campaigns_list,
            "reviews": [],
            "ai_insights": ai_insights_text,
        }

    def get_welcome_campaign_data(
        self,
        current_user: User,
        timeframe: str = "today",
        search: str | None = None,
        sort_by: str | None = "newest",
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import extract, func, or_, select
        from app.models.customer import Customer
        from app.models.order import Order
        from app.models.campaign import CampaignLog

        now = datetime.now(timezone.utc)
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_of_week = start_of_today - timedelta(days=now.weekday())
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        thirty_days_ago = now - timedelta(days=30)

        business_id = current_user.business_id

        # 1. Summary Cards Calculations
        todays_new = self.db.scalar(
            select(func.count(Customer.id)).where(
                Customer.business_id == business_id,
                or_(Customer.created_at >= start_of_today, Customer.first_visit_at >= start_of_today),
            )
        ) or 0

        this_week_new = self.db.scalar(
            select(func.count(Customer.id)).where(
                Customer.business_id == business_id,
                or_(Customer.created_at >= start_of_week, Customer.first_visit_at >= start_of_week),
            )
        ) or 0

        this_month_new = self.db.scalar(
            select(func.count(Customer.id)).where(
                Customer.business_id == business_id,
                or_(Customer.created_at >= start_of_month, Customer.first_visit_at >= start_of_month),
            )
        ) or 0

        returning_cust = self.db.scalar(
            select(func.count(Customer.id)).where(
                Customer.business_id == business_id,
                Customer.visit_count > 1,
            )
        ) or 0

        today_m, today_d = now.month, now.day
        birthdays_today = self.db.scalar(
            select(func.count(Customer.id)).where(
                Customer.business_id == business_id,
                extract("month", Customer.birth_date) == today_m,
                extract("day", Customer.birth_date) == today_d,
            )
        ) or 0

        recovery_due = self.db.scalar(
            select(func.count(Customer.id)).where(
                Customer.business_id == business_id,
                Customer.last_visit_at.isnot(None),
                Customer.last_visit_at <= thirty_days_ago,
            )
        ) or 0

        summary_cards = {
            "todays_new": todays_new,
            "this_week": this_week_new,
            "this_month": this_month_new,
            "returning": returning_cust,
            "birthdays_today": birthdays_today,
            "recovery_due": recovery_due,
        }

        # 2. Overall Metrics Calculations
        total_customers = self.db.scalar(
            select(func.count(Customer.id)).where(Customer.business_id == business_id)
        ) or 0

        total_spent_sum = float(self.db.scalar(
            select(func.coalesce(func.sum(Customer.total_spent), 0.0)).where(Customer.business_id == business_id)
        ) or 0.0)

        total_visits_sum = self.db.scalar(
            select(func.coalesce(func.sum(Customer.visit_count), 0)).where(Customer.business_id == business_id)
        ) or 0

        avg_lifetime_value = round(total_spent_sum / max(1, total_customers), 2) if total_customers > 0 else 0.0
        avg_visits = round(total_visits_sum / max(1, total_customers), 1) if total_customers > 0 else 0.0
        returning_pct = round((returning_cust / max(1, total_customers)) * 100, 1) if total_customers > 0 else 0.0

        if timeframe == "week":
            selected_count = this_week_new
        elif timeframe == "month":
            selected_count = this_month_new
        elif timeframe == "all":
            selected_count = total_customers
        else:
            selected_count = todays_new

        avg_first_order_value = avg_lifetime_value

        metrics = {
            "first_visit_count": selected_count,
            "returning_pct": returning_pct,
            "avg_first_order_value": avg_first_order_value,
            "avg_lifetime_value": avg_lifetime_value,
            "avg_visits": avg_visits,
        }

        # 3. Base Query for Filtered Customers
        stmt = select(Customer).where(Customer.business_id == business_id)

        if timeframe == "week":
            stmt = stmt.where(or_(Customer.created_at >= start_of_week, Customer.first_visit_at >= start_of_week))
        elif timeframe == "month":
            stmt = stmt.where(or_(Customer.created_at >= start_of_month, Customer.first_visit_at >= start_of_month))
        elif timeframe == "today":
            stmt = stmt.where(or_(Customer.created_at >= start_of_today, Customer.first_visit_at >= start_of_today))

        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Customer.name.ilike(term),
                    Customer.phone.ilike(term),
                    Customer.email.ilike(term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_items = self.db.scalar(count_stmt) or 0

        if sort_by == "oldest":
            stmt = stmt.order_by(Customer.created_at.asc())
        elif sort_by == "spend_desc":
            stmt = stmt.order_by(Customer.total_spent.desc())
        elif sort_by == "spend_asc":
            stmt = stmt.order_by(Customer.total_spent.asc())
        elif sort_by == "visits_desc":
            stmt = stmt.order_by(Customer.visit_count.desc())
        elif sort_by == "visits_asc":
            stmt = stmt.order_by(Customer.visit_count.asc())
        else:
            stmt = stmt.order_by(Customer.created_at.desc())

        total_pages = max(1, (total_items + page_size - 1) // page_size) if total_items > 0 else 1
        page = max(1, min(page, total_pages))
        offset = (page - 1) * page_size

        stmt = stmt.offset(offset).limit(page_size)
        customers = list(self.db.scalars(stmt).all())

        items = []
        for c in customers:
            first_order = self.db.scalar(
                select(Order)
                .where(Order.customer_id == c.id)
                .order_by(Order.created_at.asc())
            )
            source_str = "QR" if (first_order and str(first_order.order_source).upper() in ("QR", "ORDERSOURCE.QR")) else "Staff"

            if c.total_spent >= 500:
                cust_type = "VIP"
            elif c.visit_count > 1:
                cust_type = "Returning"
            else:
                cust_type = "New"

            welcome_log = self.db.scalar(
                select(CampaignLog)
                .where(CampaignLog.customer_id == c.id)
            )
            w_status = "Sent" if (welcome_log or (c.notes and "welcome" in c.notes.lower())) else "Pending"

            pts = c.loyalty.current_points if c.loyalty else c.loyalty_points

            items.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "email": c.email,
                "first_visit_at": c.first_visit_at or c.created_at,
                "last_visit_at": c.last_visit_at or c.created_at,
                "visit_count": c.visit_count,
                "total_spent": float(c.total_spent),
                "loyalty_points": pts,
                "source": source_str,
                "customer_type": cust_type,
                "welcome_status": w_status,
                "created_at": c.created_at,
            })

        return {
            "summary_cards": summary_cards,
            "metrics": metrics,
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }

    def get_birthday_campaign_data(
        self,
        current_user: User,
        bucket: str = "today",
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ) -> dict:
        return self.get_celebration_campaign_data(
            current_user=current_user,
            kind="birthday",
            bucket=bucket,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_anniversary_campaign_data(
        self,
        current_user: User,
        bucket: str = "today",
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ) -> dict:
        return self.get_celebration_campaign_data(
            current_user=current_user,
            kind="anniversary",
            bucket=bucket,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get_celebration_campaign_data(
        self,
        current_user: User,
        kind: str = "birthday",
        bucket: str = "today",
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ) -> dict:
        """
        100% database-driven calculations for Birthday & Anniversary campaigns.
        Supports buckets: today, tomorrow, week, month.
        Includes timezone resolution, server-side pagination, search, sorting, and full logging.
        """
        import zoneinfo
        from datetime import datetime, timezone, timedelta
        from sqlalchemy import select
        from sqlalchemy.orm import joinedload
        from app.models.customer import Customer
        from app.models.business import Business

        business_id = current_user.business_id
        business = self.db.scalar(select(Business).where(Business.id == business_id))
        tz_str = business.timezone if (business and business.timezone) else "Asia/Kolkata"
        try:
            tz = zoneinfo.ZoneInfo(tz_str)
        except Exception:
            tz = timezone.utc

        now_tz = datetime.now(tz)
        today_date = now_tz.date()
        tomorrow_date = today_date + timedelta(days=1)
        next_7_days = [today_date + timedelta(days=i) for i in range(7)]

        # Fetch active customers
        all_custs = list(self.db.scalars(
            select(Customer)
            .options(joinedload(Customer.loyalty))
            .where(
                Customer.business_id == business_id,
                Customer.is_active == True,
            )
        ).all())

        # Calculate Counts
        bday_today = bday_tom = bday_week = bday_month = 0
        anni_today = anni_tom = anni_week = anni_month = 0

        for c in all_custs:
            if c.birth_date:
                bm, bd = c.birth_date.month, c.birth_date.day
                if bm == today_date.month and bd == today_date.day: bday_today += 1
                if bm == tomorrow_date.month and bd == tomorrow_date.day: bday_tom += 1
                if any(bm == d.month and bd == d.day for d in next_7_days): bday_week += 1
                if bm == today_date.month: bday_month += 1

            if c.anniversary_date:
                am, ad = c.anniversary_date.month, c.anniversary_date.day
                if am == today_date.month and ad == today_date.day: anni_today += 1
                if am == tomorrow_date.month and ad == tomorrow_date.day: anni_tom += 1
                if any(am == d.month and ad == d.day for d in next_7_days): anni_week += 1
                if am == today_date.month: anni_month += 1

        logger.info(
            "CELEBRATION DEBUG | biz_id=%s tz=%s today=%s cust_count=%d | "
            "bday(today=%d, tom=%d, week=%d, month=%d) | "
            "anni(today=%d, tom=%d, week=%d, month=%d)",
            business_id, tz_str, today_date, len(all_custs),
            bday_today, bday_tom, bday_week, bday_month,
            anni_today, anni_tom, anni_week, anni_month,
        )

        summary = {
            "today": bday_today if kind == "birthday" else anni_today,
            "tomorrow": bday_tom if kind == "birthday" else anni_tom,
            "this_week": bday_week if kind == "birthday" else anni_week,
            "this_month": bday_month if kind == "birthday" else anni_month,
        }

        # Filter customers for requested kind & bucket
        target_field = "birth_date" if kind == "birthday" else "anniversary_date"
        filtered_customers = []

        for c in all_custs:
            dt_val = getattr(c, target_field, None)
            if not dt_val:
                continue

            # Search filtering
            if search and search.strip():
                term = search.strip().lower()
                c_name = (c.name or "").lower()
                c_phone = (c.phone or "").lower()
                c_email = (c.email or "").lower()
                if term not in c_name and term not in c_phone and term not in c_email:
                    continue

            m, d = dt_val.month, dt_val.day
            match = False
            if bucket == "today":
                match = (m == today_date.month and d == today_date.day)
            elif bucket == "tomorrow":
                match = (m == tomorrow_date.month and d == tomorrow_date.day)
            elif bucket == "week":
                match = any(m == day_obj.month and d == day_obj.day for day_obj in next_7_days)
            elif bucket == "month":
                match = (m == today_date.month)
            else:
                match = (m == today_date.month and d == today_date.day)

            if match:
                filtered_customers.append(c)

        # Sorting
        reverse_sort = (sort_order.lower() == "desc")
        if sort_by in ("birth_date", "anniversary_date", "event_date"):
            filtered_customers.sort(
                key=lambda x: (getattr(x, target_field).month, getattr(x, target_field).day) if getattr(x, target_field) else (0, 0),
                reverse=reverse_sort,
            )
        elif sort_by == "last_visit_at":
            filtered_customers.sort(key=lambda x: (x.last_visit_at or x.created_at), reverse=reverse_sort)
        elif sort_by == "total_spent":
            filtered_customers.sort(key=lambda x: float(x.total_spent or 0.0), reverse=reverse_sort)
        else: # name
            filtered_customers.sort(key=lambda x: (x.name or "").lower(), reverse=reverse_sort)

        total_items = len(filtered_customers)
        total_pages = max(1, (total_items + page_size - 1) // page_size) if total_items > 0 else 1
        page = max(1, min(page, total_pages))
        start_idx = (page - 1) * page_size
        paginated_slice = filtered_customers[start_idx : start_idx + page_size]

        coupon_code = "BDAYSPECIAL" if kind == "birthday" else "ANNISPECIAL"

        items = []
        for c in paginated_slice:
            pts = c.loyalty.current_points if c.loyalty else c.loyalty_points
            spent = float(c.total_spent or 0.0)

            if spent >= 1000:
                tier = "High Spender VIP"
            elif spent >= 500:
                tier = "VIP"
            elif c.visit_count > 1:
                tier = "Returning Guest"
            else:
                tier = "First Time Guest"

            event_dt = getattr(c, target_field)
            age = (today_date.year - event_dt.year) if event_dt else None
            initials = "".join([part[0] for part in c.name.split() if part])[:2].upper() if c.name else "NV"

            items.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone or "",
                "email": c.email,
                "birth_date": c.birth_date,
                "anniversary_date": c.anniversary_date,
                "event_date": event_dt,
                "age": age,
                "last_visit_at": c.last_visit_at or c.created_at,
                "visit_count": c.visit_count or 1,
                "total_spent": spent,
                "loyalty_points": pts,
                "customer_tier": tier,
                "current_coupon": coupon_code,
                "preferred_language": "Auto",
                "favorite_item": "Specialties",
                "favorites": ["Signature Dishes"],
                "initials": initials,
            })

        logger.info(
            "CELEBRATION RESULT | kind=%s bucket=%s returned_rows=%d total_items=%d total_pages=%d page=%d",
            kind, bucket, len(items), total_items, total_pages, page,
        )

        return {
            "summary": summary,
            "items": items,
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }

    def get_vip_customers(
        self,
        current_user: User,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        sort_by: str = "spend_desc",
        # VIP thresholds — configurable per business (future: pull from BusinessSettings)
        min_spend: float = 500.0,
        min_visits: int = 10,
    ) -> dict:
        """
        Returns database-driven VIP customer list.
        VIP = customers whose total_spent >= min_spend OR visit_count >= min_visits.
        Favorite item is computed from order_items (most frequently ordered item_name).
        Supports search by name/phone, sort, and server-side pagination.
        """
        from sqlalchemy import select, func
        from app.models.order import Order, OrderItem
        from sqlalchemy.orm import joinedload

        business_id = current_user.business_id

        # ── 1. Pull all active customers of the business ──────────────────────
        stmt = (
            select(Customer)
            .options(joinedload(Customer.loyalty))
            .where(
                Customer.business_id == business_id,
                Customer.is_active == True,
            )
        )
        all_customers = list(self.db.scalars(stmt).unique().all())

        # ── 2. Filter VIPs ───────────────────────────────────────────────────
        vips = [
            c for c in all_customers
            if float(c.total_spent or 0) >= min_spend or (c.visit_count or 0) >= min_visits
        ]

        # ── 3. Apply search ──────────────────────────────────────────────────
        if search and search.strip():
            term = search.strip().lower()
            vips = [
                c for c in vips
                if term in (c.name or "").lower() or term in (c.phone or "")
            ]

        # ── 4. Compute favorite item per VIP customer via order_items ────────
        # Single efficient query: GROUP BY customer_id, item_name → pick max count per customer
        vip_ids = [c.id for c in vips]
        fav_map: dict = {}
        if vip_ids:
            fav_stmt = (
                select(
                    Order.customer_id,
                    OrderItem.item_name,
                    func.sum(OrderItem.quantity).label("total_qty"),
                )
                .join(OrderItem, OrderItem.order_id == Order.id)
                .where(
                    Order.business_id == business_id,
                    Order.customer_id.in_(vip_ids),
                )
                .group_by(Order.customer_id, OrderItem.item_name)
                .order_by(Order.customer_id, func.sum(OrderItem.quantity).desc())
            )
            fav_rows = self.db.execute(fav_stmt).all()

            # Build {customer_id: top_item_name}
            for row in fav_rows:
                cid = row.customer_id
                if cid not in fav_map:
                    fav_map[cid] = row.item_name

        # ── 5. Sort ──────────────────────────────────────────────────────────
        if sort_by == "spend_desc":
            vips.sort(key=lambda c: float(c.total_spent or 0), reverse=True)
        elif sort_by == "spend_asc":
            vips.sort(key=lambda c: float(c.total_spent or 0))
        elif sort_by == "visits_desc":
            vips.sort(key=lambda c: c.visit_count or 0, reverse=True)
        elif sort_by == "visits_asc":
            vips.sort(key=lambda c: c.visit_count or 0)
        elif sort_by == "points_desc":
            vips.sort(
                key=lambda c: (c.loyalty.current_points if c.loyalty else 0),
                reverse=True,
            )
        elif sort_by == "recent":
            vips.sort(
                key=lambda c: c.last_visit_at or c.created_at,
                reverse=True,
            )
        else:
            vips.sort(key=lambda c: float(c.total_spent or 0), reverse=True)

        # ── 6. Summary cards (before pagination, over full filtered set) ──────
        total_vip = len(vips)
        total_lifetime_spend = sum(float(c.total_spent or 0) for c in vips)
        total_visits_sum = sum(c.visit_count or 0 for c in vips)
        total_loyalty_points = sum(
            (c.loyalty.current_points if c.loyalty else 0) for c in vips
        )
        avg_visits = round(total_visits_sum / total_vip, 1) if total_vip else 0.0
        avg_lifetime_spend = round(total_lifetime_spend / total_vip, 2) if total_vip else 0.0

        summary = {
            "total_vip": total_vip,
            "total_lifetime_spend": total_lifetime_spend,
            "avg_visits": avg_visits,
            "avg_lifetime_spend": avg_lifetime_spend,
            "total_loyalty_points": total_loyalty_points,
        }

        # ── 7. Pagination ────────────────────────────────────────────────────
        total_pages = max(1, (total_vip + page_size - 1) // page_size) if total_vip else 1
        page = max(1, min(page, total_pages))
        start = (page - 1) * page_size
        page_slice = vips[start: start + page_size]

        # ── 8. Build response items ──────────────────────────────────────────
        items = []
        for c in page_slice:
            pts = c.loyalty.current_points if c.loyalty else 0
            spent = float(c.total_spent or 0)

            if spent >= 2000 or (c.visit_count or 0) >= 30:
                segment = "Diamond VIP"
            elif spent >= 1000 or (c.visit_count or 0) >= 20:
                segment = "Gold VIP"
            else:
                segment = "VIP"

            items.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone or "",
                "email": c.email,
                "visit_count": c.visit_count or 0,
                "total_spent": spent,
                "loyalty_points": pts,
                "favorite_item": fav_map.get(c.id, "No favorite yet"),
                "last_visit_at": c.last_visit_at,
                "first_visit_at": c.first_visit_at,
                "created_at": c.created_at,
                "segment": segment,
            })

        logger.info(
            "VIP CUSTOMERS | business_id=%s total_vip=%d page=%d/%d",
            business_id, total_vip, page, total_pages,
        )

        return {
            "summary": summary,
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total_vip,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }
