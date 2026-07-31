"""
Coupon Service
--------------
Manages coupons, dynamic status calculations, soft deletions, order validations,
and campaign/loyalty integrations.
"""
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.business_settings import BusinessSettings
from app.models.coupon import Coupon, CouponRedemption, CouponStatus, CouponType
from app.models.customer import Customer
from app.models.user import User
from app.schemas.coupon import (
    CouponCreate,
    CouponRedeemRequest,
    CouponUpdate,
    CouponValidateRequest,
)

logger = logging.getLogger(__name__)


class CouponService:

    def __init__(self, db: Session):
        self.db = db

    # ── Helpers ────────────────────────────────────────────────────────────

    def calculate_coupon_status(self, coupon: Coupon) -> str:
        """
        Dynamically calculates coupon status:
        DELETED -> INACTIVE -> UPCOMING -> EXPIRED -> ACTIVE
        """
        if coupon.is_deleted:
            return CouponStatus.DELETED.value

        if coupon.status == CouponStatus.INACTIVE:
            return CouponStatus.INACTIVE.value

        now = datetime.now(timezone.utc)

        if coupon.valid_from and coupon.valid_from > now:
            return CouponStatus.UPCOMING.value

        if coupon.valid_until and coupon.valid_until < now:
            return CouponStatus.EXPIRED.value

        if coupon.max_usage is not None and coupon.redeemed_count >= coupon.max_usage:
            return CouponStatus.EXPIRED.value

        return CouponStatus.ACTIVE.value

    def _seed_demo_coupons_if_empty(self, business_id: UUID):
        """
        If business has 0 coupons in DB, seeds 5 realistic coupons
        (WELCOME10, BIRTHDAY20, ANNIVERSARY25, FREEDESSERT, BOGOFRIDAY) for testing.
        """
        count = self.db.scalar(
            select(func.count(Coupon.id)).where(
                Coupon.business_id == business_id,
                Coupon.is_deleted == False,
            )
        )
        if count and count > 0:
            return

        demo_coupons = [
            {
                "code": "WELCOME10",
                "name": "15% OFF Welcome Coupon",
                "description": "Exclusive 15% discount for first-time visitors",
                "coupon_type": CouponType.PERCENTAGE,
                "reward_value": 15.0,
                "max_usage": 500,
                "per_customer_limit": 1,
                "min_order_amount": 100.0,
                "reward_description": "15% OFF",
            },
            {
                "code": "BIRTHDAY20",
                "name": "20% OFF Birthday Special",
                "description": "Happy Birthday! Enjoy 20% off your celebration meal",
                "coupon_type": CouponType.PERCENTAGE,
                "reward_value": 20.0,
                "max_usage": 200,
                "per_customer_limit": 1,
                "min_order_amount": 200.0,
                "reward_description": "20% OFF",
            },
            {
                "code": "ANNIVERSARY25",
                "name": "25% OFF Anniversary Treat",
                "description": "Celebrate your special day with 25% discount",
                "coupon_type": CouponType.PERCENTAGE,
                "reward_value": 25.0,
                "max_usage": 150,
                "per_customer_limit": 1,
                "min_order_amount": 300.0,
                "reward_description": "25% OFF",
            },
            {
                "code": "FREEDESSERT",
                "name": "Complimentary Free Dessert",
                "description": "Free Chef Special Dessert on orders over $50",
                "coupon_type": CouponType.FREE_ITEM,
                "reward_value": 0.0,
                "max_usage": 100,
                "per_customer_limit": 1,
                "min_order_amount": 50.0,
                "reward_description": "Free Dessert",
            },
            {
                "code": "BOGOFRIDAY",
                "name": "Buy 1 Get 1 Free Friday",
                "description": "Buy any main course and get second main course free",
                "coupon_type": CouponType.BOGO,
                "reward_value": 0.0,
                "max_usage": 300,
                "per_customer_limit": 1,
                "min_order_amount": 150.0,
                "reward_description": "Buy 1 Get 1 Free",
            },
        ]

        for item in demo_coupons:
            cp = Coupon(
                business_id=business_id,
                code=item["code"],
                name=item["name"],
                description=item["description"],
                coupon_type=item["coupon_type"],
                reward_value=item["reward_value"],
                max_usage=item["max_usage"],
                per_customer_limit=item["per_customer_limit"],
                min_order_amount=item["min_order_amount"],
                reward_description=item["reward_description"],
                status=CouponStatus.ACTIVE,
                is_deleted=False,
            )
            self.db.add(cp)

        self.db.commit()
        logger.info("SEEDED DEMO COUPONS FOR BUSINESS | business_id=%s", business_id)

    # ── CRUD Operations ───────────────────────────────────────────────────

    def get_coupons(
        self,
        current_user: User,
        status_filter: str = "all",
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "recent",
    ) -> dict:
        """
        Returns paginated list of coupons with calculated statuses.
        """
        business_id = current_user.business_id
        self._seed_demo_coupons_if_empty(business_id)

        stmt = select(Coupon).where(
            Coupon.business_id == business_id,
            Coupon.is_deleted == False,
        )

        all_coupons = list(self.db.scalars(stmt).all())

        # Filter & enrich
        records = []
        for cp in all_coupons:
            computed = self.calculate_coupon_status(cp)

            if status_filter != "all":
                if computed.lower() != status_filter.lower():
                    continue

            if search and search.strip():
                term = search.strip().lower()
                if (
                    term not in cp.code.lower()
                    and term not in cp.name.lower()
                    and term not in (cp.description or "").lower()
                    and term not in cp.coupon_type.value.lower()
                ):
                    continue

            dict_resp = {
                "id": cp.id,
                "business_id": cp.business_id,
                "code": cp.code,
                "name": cp.name,
                "description": cp.description,
                "coupon_type": cp.coupon_type.value,
                "reward_value": cp.reward_value,
                "reward_description": cp.reward_description or f"{cp.reward_value}% OFF" if cp.coupon_type == CouponType.PERCENTAGE else f"${cp.reward_value} OFF",
                "max_discount_amount": cp.max_discount_amount,
                "min_order_amount": cp.min_order_amount,
                "max_usage": cp.max_usage,
                "per_customer_limit": cp.per_customer_limit,
                "redeemed_count": cp.redeemed_count,
                "valid_from": cp.valid_from,
                "valid_until": cp.valid_until,
                "applicable_segment": cp.applicable_segment,
                "status": cp.status.value,
                "is_deleted": cp.is_deleted,
                "created_by": cp.created_by,
                "created_at": cp.created_at,
                "updated_at": cp.updated_at,
                "computed_status": computed,
            }
            records.append(dict_resp)

        # Sort
        if sort_by == "recent":
            records.sort(key=lambda x: x["created_at"], reverse=True)
        elif sort_by == "code":
            records.sort(key=lambda x: x["code"])
        elif sort_by == "usage_desc":
            records.sort(key=lambda x: x["redeemed_count"], reverse=True)

        # Pagination
        total = len(records)
        total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
        page = max(1, min(page, total_pages))
        start = (page - 1) * page_size
        page_slice = records[start : start + page_size]

        return {
            "items": page_slice,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }

    def create_coupon(self, current_user: User, data: CouponCreate) -> dict:
        """
        Creates a new coupon with validations:
        - Unique code per business
        - Expiry > valid_from
        - Percentage <= 100
        """
        business_id = current_user.business_id
        code_upper = data.code.strip().upper()

        # 1. Code uniqueness check
        existing = self.db.scalar(
            select(Coupon).where(
                Coupon.business_id == business_id,
                func.upper(Coupon.code) == code_upper,
                Coupon.is_deleted == False,
            )
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Coupon code '{code_upper}' already exists for this business.",
            )

        # 2. Date validation
        if data.valid_from and data.valid_until and data.valid_until <= data.valid_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expiry date must be after valid_from date.",
            )

        # 3. Value validation
        c_type = CouponType(data.coupon_type.upper())
        if c_type == CouponType.PERCENTAGE and data.reward_value > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Percentage discount cannot exceed 100%.",
            )

        reward_desc = data.reward_description
        if not reward_desc:
            if c_type == CouponType.PERCENTAGE:
                reward_desc = f"{data.reward_value}% OFF"
            elif c_type == CouponType.FLAT:
                reward_desc = f"${data.reward_value} OFF"
            elif c_type == CouponType.FREE_ITEM:
                reward_desc = "Free Item"
            elif c_type == CouponType.BOGO:
                reward_desc = "Buy 1 Get 1"

        cp = Coupon(
            business_id=business_id,
            code=code_upper,
            name=data.name.strip(),
            description=data.description,
            coupon_type=c_type,
            reward_value=data.reward_value,
            reward_description=reward_desc,
            max_discount_amount=data.max_discount_amount,
            min_order_amount=data.min_order_amount,
            max_usage=data.max_usage,
            per_customer_limit=data.per_customer_limit,
            valid_from=data.valid_from,
            valid_until=data.valid_until,
            applicable_segment=data.applicable_segment,
            status=CouponStatus(data.status.upper()) if data.status else CouponStatus.ACTIVE,
            created_by=current_user.id,
        )

        self.db.add(cp)
        self.db.commit()
        self.db.refresh(cp)

        logger.info("COUPON CREATED | code=%s business_id=%s", code_upper, business_id)

        computed = self.calculate_coupon_status(cp)
        return {
            "id": cp.id,
            "business_id": cp.business_id,
            "code": cp.code,
            "name": cp.name,
            "description": cp.description,
            "coupon_type": cp.coupon_type.value,
            "reward_value": cp.reward_value,
            "reward_description": cp.reward_description,
            "max_discount_amount": cp.max_discount_amount,
            "min_order_amount": cp.min_order_amount,
            "max_usage": cp.max_usage,
            "per_customer_limit": cp.per_customer_limit,
            "redeemed_count": cp.redeemed_count,
            "valid_from": cp.valid_from,
            "valid_until": cp.valid_until,
            "applicable_segment": cp.applicable_segment,
            "status": cp.status.value,
            "is_deleted": cp.is_deleted,
            "created_by": cp.created_by,
            "created_at": cp.created_at,
            "updated_at": cp.updated_at,
            "computed_status": computed,
        }

    def delete_coupon(self, current_user: User, coupon_id: UUID) -> dict:
        """
        Soft deletes coupon or marks as INACTIVE:
        - If redeemed_count == 0, sets is_deleted = True and status = DELETED
        - If redeemed_count > 0, sets status = INACTIVE (preserve audit history)
        """
        business_id = current_user.business_id
        cp = self.db.scalar(
            select(Coupon).where(
                Coupon.id == coupon_id,
                Coupon.business_id == business_id,
                Coupon.is_deleted == False,
            )
        )
        if not cp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Coupon not found.",
            )

        if cp.redeemed_count > 0:
            cp.status = CouponStatus.INACTIVE
            action = "marked INACTIVE (has redemption history)"
        else:
            cp.is_deleted = True
            cp.status = CouponStatus.DELETED
            action = "soft DELETED"

        self.db.commit()
        logger.info("COUPON DELETE | id=%s action=%s", coupon_id, action)

        return {
            "id": cp.id,
            "code": cp.code,
            "status": cp.status.value,
            "is_deleted": cp.is_deleted,
            "message": f"Coupon '{cp.code}' was {action}.",
        }

    # ── Validation & Redemption ───────────────────────────────────────────

    def validate_coupon(self, current_user: User, data: CouponValidateRequest) -> dict:
        """
        Validates coupon code for an order/customer.
        Calculates expected discount amount.
        """
        business_id = current_user.business_id
        code_upper = data.code.strip().upper()

        cp = self.db.scalar(
            select(Coupon).where(
                Coupon.business_id == business_id,
                func.upper(Coupon.code) == code_upper,
                Coupon.is_deleted == False,
            )
        )
        if not cp:
            return {"valid": False, "reason": "Coupon code not found.", "calculated_discount": 0.0}

        computed = self.calculate_coupon_status(cp)
        if computed != CouponStatus.ACTIVE.value:
            return {"valid": False, "reason": f"Coupon is {computed.lower()}.", "calculated_discount": 0.0}

        if data.order_amount < cp.min_order_amount:
            return {
                "valid": False,
                "reason": f"Minimum order amount of ${cp.min_order_amount:.2f} required.",
                "calculated_discount": 0.0,
            }

        # Check customer usage limit if customer_id provided
        if data.customer_id:
            cust_redemptions = self.db.scalar(
                select(func.count(CouponRedemption.id)).where(
                    CouponRedemption.coupon_id == cp.id,
                    CouponRedemption.customer_id == data.customer_id,
                )
            ) or 0
            if cust_redemptions >= cp.per_customer_limit:
                return {
                    "valid": False,
                    "reason": f"You have reached maximum redemption limit ({cp.per_customer_limit}) for this coupon.",
                    "calculated_discount": 0.0,
                }

        # Calculate discount
        calc_discount = 0.0
        if cp.coupon_type == CouponType.PERCENTAGE:
            calc_discount = (data.order_amount * cp.reward_value) / 100.0
            if cp.max_discount_amount is not None:
                calc_discount = min(calc_discount, cp.max_discount_amount)
        elif cp.coupon_type == CouponType.FLAT:
            calc_discount = min(cp.reward_value, data.order_amount)

        return {
            "valid": True,
            "reason": "Coupon is valid and ready to apply.",
            "calculated_discount": round(calc_discount, 2),
            "coupon": {
                "id": cp.id,
                "code": cp.code,
                "name": cp.name,
                "coupon_type": cp.coupon_type.value,
                "reward_value": cp.reward_value,
                "reward_description": cp.reward_description,
                "redeemed_count": cp.redeemed_count,
                "computed_status": computed,
            },
        }

    def redeem_coupon(self, current_user: User, data: CouponRedeemRequest) -> dict:
        """
        Redeems coupon for an order, logs CouponRedemption entry,
        and increments coupon redeemed_count.
        """
        val_res = self.validate_coupon(
            current_user,
            CouponValidateRequest(
                code=data.code,
                customer_id=data.customer_id,
                order_amount=data.order_amount,
            ),
        )
        if not val_res["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=val_res["reason"],
            )

        cp = self.db.scalar(
            select(Coupon).where(
                Coupon.business_id == current_user.business_id,
                func.upper(Coupon.code) == data.code.strip().upper(),
                Coupon.is_deleted == False,
            )
        )

        discount = val_res["calculated_discount"]

        redemption = CouponRedemption(
            business_id=current_user.business_id,
            coupon_id=cp.id,
            customer_id=data.customer_id,
            order_id=data.order_id,
            visit_id=data.visit_id,
            discount_amount=discount,
            redeemed_at=datetime.now(timezone.utc),
        )
        self.db.add(redemption)

        cp.redeemed_count += 1
        self.db.commit()

        logger.info("COUPON REDEEMED | code=%s discount=%f", cp.code, discount)

        return {
            "redemption_id": redemption.id,
            "coupon_code": cp.code,
            "discount_applied": discount,
            "new_redeemed_count": cp.redeemed_count,
        }
