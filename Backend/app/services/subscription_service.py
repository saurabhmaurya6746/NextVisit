import logging
import random
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.admin import Admin
from app.models.business import Business
from app.models.subscription_billing_history import SubscriptionBillingHistory
from app.models.subscription_plan import SubscriptionPlan
from app.models.subscription_upgrade_request import SubscriptionUpgradeRequest
from app.models.user import User
from app.schemas.subscription import (
    BusinessSubscriptionAssignRequest,
    BusinessSubscriptionItemResponse,
    MyPlanResponse,
    PaginatedSubscriptionUpgradeRequestsResponse,
    SubscriptionBillingHistoryResponse,
    SubscriptionPlanCreate,
    SubscriptionPlanResponse,
    SubscriptionPlanUpdate,
    SubscriptionUpgradeRequestCreate,
    SubscriptionUpgradeRequestResponse,
)

logger = logging.getLogger(__name__)


class SubscriptionService:

    def __init__(self, db: Session):
        self.db = db

    def init_default_plans(self) -> None:
        """Seed default subscription plans if table is empty."""
        existing_count = self.db.scalar(select(SubscriptionPlan.id))
        if existing_count:
            return

        logger.info("Initializing default platform subscription plans...")
        default_plans = [
            SubscriptionPlan(
                name="FREE",
                monthly_price=0.0,
                trial_days=0,
                max_customers=100,
                max_staff=2,
                max_active_devices=2,
                max_campaigns_per_month=5,
                storage_limit_gb=0.5,
                monthly_ai_credits=0,
                features={"ai_enabled": True, "pdf_export": True, "priority_support": False},
                is_active=True,
            ),
            SubscriptionPlan(
                name="STARTER",
                monthly_price=29.0,
                trial_days=14,
                max_customers=500,
                max_staff=5,
                max_active_devices=5,
                max_campaigns_per_month=20,
                storage_limit_gb=2.0,
                monthly_ai_credits=0,
                features={"ai_enabled": True, "pdf_export": True, "priority_support": False},
                is_active=True,
            ),
            SubscriptionPlan(
                name="PROFESSIONAL",
                monthly_price=79.0,
                trial_days=14,
                max_customers=2500,
                max_staff=15,
                max_active_devices=15,
                max_campaigns_per_month=100,
                storage_limit_gb=10.0,
                monthly_ai_credits=0,
                features={"ai_enabled": True, "pdf_export": True, "priority_support": True},
                is_active=True,
            ),
            SubscriptionPlan(
                name="ENTERPRISE",
                monthly_price=199.0,
                trial_days=30,
                max_customers=100000,
                max_staff=100,
                max_active_devices=100,
                max_campaigns_per_month=1000,
                storage_limit_gb=50.0,
                monthly_ai_credits=0,
                features={"ai_enabled": True, "pdf_export": True, "priority_support": True},
                is_active=True,
            ),
        ]
        self.db.add_all(default_plans)
        self.db.commit()
        logger.info("Default subscription plans initialized successfully.")

    def list_plans(self) -> list[SubscriptionPlan]:
        self.init_default_plans()
        stmt = select(SubscriptionPlan).where(SubscriptionPlan.is_active == True).order_by(SubscriptionPlan.monthly_price.asc())
        return list(self.db.scalars(stmt).all())

    def create_plan(self, data: SubscriptionPlanCreate) -> SubscriptionPlan:
        existing = self.db.scalar(
            select(SubscriptionPlan).where(
                func.lower(SubscriptionPlan.name) == data.name.strip().lower()
            )
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Subscription plan with name '{data.name}' already exists.",
            )

        plan = SubscriptionPlan(
            name=data.name.strip().upper(),
            monthly_price=data.monthly_price,
            trial_days=data.trial_days,
            max_customers=data.max_customers,
            max_staff=data.max_staff,
            max_active_devices=data.max_active_devices or data.max_staff,
            max_campaigns_per_month=data.max_campaigns_per_month,
            storage_limit_gb=data.storage_limit_gb,
            features=data.features or {"analytics": True, "ai_generator": True},
            is_active=data.is_active,
        )
        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def update_plan(self, plan_id: UUID, data: SubscriptionPlanUpdate) -> SubscriptionPlan:
        plan = self.db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subscription plan with ID '{plan_id}' not found.",
            )

        update_dict = data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            if field == "name" and value:
                value = value.strip().upper()
                dup = self.db.scalar(
                    select(SubscriptionPlan).where(
                        SubscriptionPlan.name == value,
                        SubscriptionPlan.id != plan_id,
                    )
                )
                if dup:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Subscription plan with name '{value}' already exists.",
                    )
            setattr(plan, field, value)

        self.db.commit()
        self.db.refresh(plan)
        return plan

    def delete_plan(self, plan_id: UUID):
        plan = self.db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subscription plan with ID '{plan_id}' not found.",
            )
        assigned = self.db.scalar(
            select(Business).where(Business.subscription_plan_id == plan_id, Business.is_deleted == False)
        )
        if assigned:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete plan '{plan.name}' because it is assigned to active merchant(s).",
            )
        self.db.delete(plan)
        self.db.commit()
        return {"message": f"Plan '{plan.name}' deleted successfully."}

    def assign_business_subscription(
        self, business_id: UUID, data: BusinessSubscriptionAssignRequest
    ) -> BusinessSubscriptionItemResponse:
        business = self.db.scalar(select(Business).where(Business.id == business_id, Business.is_deleted == False))
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found.",
            )

        plan = self.db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.id == data.plan_id))
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subscription plan with ID '{data.plan_id}' not found.",
            )

        now = datetime.now(timezone.utc)
        business.subscription_plan_id = plan.id

        trial_d = data.trial_days if data.trial_days is not None else plan.trial_days
        if trial_d > 0:
            business.subscription_status = "trial"
            business.trial_start = now
            business.trial_end = now + timedelta(days=trial_d)
        else:
            business.subscription_status = "active"

        if data.expiry_date:
            business.plan_expires_at = data.expiry_date
        else:
            business.plan_expires_at = now + timedelta(days=30)

        if data.notes:
            business.subscription_notes = data.notes

        # Record billing history
        inv_num = f"SUB-{now.year}-{random.randint(1000, 9999)}"
        billing = SubscriptionBillingHistory(
            business_id=business.id,
            plan_id=plan.id,
            invoice_number=inv_num,
            amount=plan.monthly_price,
            billing_date=now,
            renewal_date=business.plan_expires_at,
            status="PAID",
        )
        self.db.add(billing)

        self.db.commit()
        self.db.refresh(business)

        plan_resp = SubscriptionPlanResponse.model_validate(plan)
        return BusinessSubscriptionItemResponse(
            business_id=business.id,
            business_name=business.name,
            owner_name=business.owner_name,
            email=business.email,
            current_plan=plan_resp,
            subscription_status=business.subscription_status,
            status=business.status,
            trial_end=business.trial_end,
            expiry_date=business.plan_expires_at,
            created_at=business.created_at,
        )

    def list_business_subscriptions(self) -> list[BusinessSubscriptionItemResponse]:
        businesses = list(self.db.scalars(
            select(Business).where(Business.is_deleted == False).order_by(Business.created_at.desc())
        ).all())

        results = []
        for b in businesses:
            plan_resp = (
                SubscriptionPlanResponse.model_validate(b.subscription_plan)
                if b.subscription_plan
                else None
            )
            results.append(
                BusinessSubscriptionItemResponse(
                    business_id=b.id,
                    business_name=b.name,
                    owner_name=b.owner_name,
                    email=b.email,
                    current_plan=plan_resp,
                    subscription_status=b.subscription_status,
                    status=b.status,
                    trial_end=b.trial_end,
                    expiry_date=b.plan_expires_at,
                    created_at=b.created_at,
                )
            )
        return results

    # ── Merchant Current Plan & Upgrade Requests ──────────────────────────────

    def get_my_plan(self, current_user: User) -> MyPlanResponse:
        business = self.db.scalar(select(Business).where(Business.id == current_user.business_id))
        if not business:
            raise HTTPException(status_code=404, detail="Business not found.")

        self.init_default_plans()

        # Current Plan
        plan = business.subscription_plan
        if not plan:
            plan = self.db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.name == "STARTER"))

        now = datetime.now(timezone.utc)

        # Trial calculation
        is_trial = business.subscription_status == "trial" or (business.trial_end and business.trial_end > now)
        trial_days_remaining = 0
        if business.trial_end:
            delta = business.trial_end - now
            trial_days_remaining = max(0, delta.days)

        trial_status = {
            "is_trial": is_trial,
            "trial_start": business.trial_start,
            "trial_end": business.trial_end,
            "days_remaining": trial_days_remaining,
        }

        # Expiry date
        expiry = business.plan_expires_at or business.trial_end
        days_rem = max(0, (expiry - now).days) if expiry else None

        # Pending upgrade request check
        pending_req = self.db.scalar(
            select(SubscriptionUpgradeRequest)
            .where(
                SubscriptionUpgradeRequest.business_id == business.id,
                SubscriptionUpgradeRequest.status == "PENDING",
            )
            .order_by(SubscriptionUpgradeRequest.requested_at.desc())
        )

        plan_resp = SubscriptionPlanResponse.model_validate(plan) if plan else None
        pending_resp = self._format_upgrade_request(pending_req) if pending_req else None

        features = plan.features if (plan and plan.features) else {
            "ai_enabled": True,
            "pdf_export": True,
            "priority_support": False,
        }

        limits = {
            "max_staff": plan.max_staff if plan else 5,
            "max_active_devices": plan.max_active_devices if plan else 5,
            "storage_limit_gb": plan.storage_limit_gb if plan else 2.0,
            "monthly_ai_credits": plan.monthly_ai_credits if plan else 0,
        }

        return MyPlanResponse(
            current_plan=plan_resp,
            subscription_status=business.subscription_status or "active",
            trial_status=trial_status,
            expiry_date=expiry,
            days_remaining=days_rem,
            features=features,
            limits=limits,
            has_pending_request=bool(pending_req),
            pending_request=pending_resp,
        )

    def request_upgrade(self, current_user: User, data: SubscriptionUpgradeRequestCreate) -> SubscriptionUpgradeRequestResponse:
        business_id = current_user.business_id
        business = self.db.scalar(select(Business).where(Business.id == business_id))
        if not business:
            raise HTTPException(status_code=404, detail="Business not found.")

        # Check requested plan
        req_plan = self.db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.id == data.requested_plan_id))
        if not req_plan or not req_plan.is_active:
            raise HTTPException(status_code=404, detail="Requested subscription plan not found or inactive.")

        # Validation 1: Cannot request duplicate pending
        existing_pending = self.db.scalar(
            select(SubscriptionUpgradeRequest).where(
                SubscriptionUpgradeRequest.business_id == business_id,
                SubscriptionUpgradeRequest.status == "PENDING",
            )
        )
        if existing_pending:
            req_plan_name = existing_pending.requested_plan.name if existing_pending.requested_plan else "Plan"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a pending upgrade request for '{req_plan_name}' under review by Admin.",
            )

        # Validation 2: Cannot request current plan
        if business.subscription_plan_id == req_plan.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Your business is already subscribed to the '{req_plan.name}' plan.",
            )

        upgrade_req = SubscriptionUpgradeRequest(
            business_id=business_id,
            current_plan_id=business.subscription_plan_id,
            requested_plan_id=req_plan.id,
            status="PENDING",
            requested_at=datetime.now(timezone.utc),
        )
        self.db.add(upgrade_req)
        self.db.commit()
        self.db.refresh(upgrade_req)

        logger.info(
            "Subscription upgrade request submitted | biz=%s req_plan=%s",
            business_id,
            req_plan.name,
        )
        return self._format_upgrade_request(upgrade_req)

    def get_my_upgrade_requests(self, current_user: User) -> list[SubscriptionUpgradeRequestResponse]:
        requests = list(self.db.scalars(
            select(SubscriptionUpgradeRequest)
            .where(SubscriptionUpgradeRequest.business_id == current_user.business_id)
            .order_by(SubscriptionUpgradeRequest.requested_at.desc())
        ).all())
        return [self._format_upgrade_request(r) for r in requests]

    def cancel_upgrade_request(self, current_user: User, request_id: UUID) -> dict:
        req = self.db.scalar(
            select(SubscriptionUpgradeRequest).where(
                SubscriptionUpgradeRequest.id == request_id,
                SubscriptionUpgradeRequest.business_id == current_user.business_id,
            )
        )
        if not req:
            raise HTTPException(status_code=404, detail="Upgrade request not found.")
        if req.status != "PENDING":
            raise HTTPException(status_code=400, detail=f"Cannot cancel request with status '{req.status}'.")

        req.status = "CANCELLED"
        self.db.commit()
        return {"message": "Subscription upgrade request cancelled successfully."}

    def get_billing_history(self, current_user: User) -> list[SubscriptionBillingHistoryResponse]:
        records = list(self.db.scalars(
            select(SubscriptionBillingHistory)
            .where(SubscriptionBillingHistory.business_id == current_user.business_id)
            .order_by(SubscriptionBillingHistory.billing_date.desc())
        ).all())

        return [
            SubscriptionBillingHistoryResponse(
                id=r.id,
                business_id=r.business_id,
                plan_name=r.plan.name if r.plan else "Subscription Plan",
                invoice_number=r.invoice_number,
                amount=r.amount,
                billing_date=r.billing_date,
                renewal_date=r.renewal_date,
                status=r.status,
            )
            for r in records
        ]

    # ── Super Admin Panel Methods ──────────────────────────────────────────

    def list_admin_upgrade_requests(
        self, page: int = 1, limit: int = 10, status_filter: str = "ALL", search: str = ""
    ) -> PaginatedSubscriptionUpgradeRequestsResponse:
        page = max(1, page)
        limit = max(1, min(100, limit))

        query = select(SubscriptionUpgradeRequest).join(Business, SubscriptionUpgradeRequest.business_id == Business.id)

        if status_filter and status_filter.upper() != "ALL":
            query = query.where(SubscriptionUpgradeRequest.status == status_filter.upper())

        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.join(SubscriptionPlan, SubscriptionUpgradeRequest.requested_plan_id == SubscriptionPlan.id)
            query = query.where(
                or_(
                    func.lower(Business.name).like(pattern),
                    func.lower(Business.owner_name).like(pattern),
                    func.lower(Business.email).like(pattern),
                    func.lower(SubscriptionPlan.name).like(pattern),
                )
            )

        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        pages = max(1, (total + limit - 1) // limit)

        items = list(self.db.scalars(
            query.order_by(SubscriptionUpgradeRequest.requested_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        ).all())

        formatted_items = [self._format_upgrade_request(r) for r in items]

        return PaginatedSubscriptionUpgradeRequestsResponse(
            items=formatted_items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    def approve_upgrade_request(self, current_admin: Admin, request_id: UUID) -> SubscriptionUpgradeRequestResponse:
        req = self.db.scalar(select(SubscriptionUpgradeRequest).where(SubscriptionUpgradeRequest.id == request_id))
        if not req:
            raise HTTPException(status_code=404, detail="Upgrade request not found.")
        if req.status != "PENDING":
            raise HTTPException(status_code=400, detail=f"Request is already '{req.status}'.")

        now = datetime.now(timezone.utc)
        req.status = "APPROVED"
        req.approved_by_id = current_admin.id
        req.approved_at = now

        # Update Business Plan & Limits
        business = self.db.scalar(select(Business).where(Business.id == req.business_id))
        req_plan = self.db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.id == req.requested_plan_id))

        if business and req_plan:
            business.subscription_plan_id = req_plan.id
            business.subscription_status = "active"
            business.plan_expires_at = now + timedelta(days=30)

            # Record Billing History
            inv_num = f"SUB-{now.year}-{random.randint(1000, 9999)}"
            billing = SubscriptionBillingHistory(
                business_id=business.id,
                plan_id=req_plan.id,
                invoice_number=inv_num,
                amount=req_plan.monthly_price,
                billing_date=now,
                renewal_date=business.plan_expires_at,
                status="PAID",
            )
            self.db.add(billing)

        self.db.commit()
        self.db.refresh(req)

        logger.info(
            "Upgrade request APPROVED by Admin | req_id=%s admin=%s biz=%s plan=%s",
            req.id,
            current_admin.email,
            business.name if business else "",
            req_plan.name if req_plan else "",
        )
        return self._format_upgrade_request(req)

    def reject_upgrade_request(self, current_admin: Admin, request_id: UUID, reason: str) -> SubscriptionUpgradeRequestResponse:
        req = self.db.scalar(select(SubscriptionUpgradeRequest).where(SubscriptionUpgradeRequest.id == request_id))
        if not req:
            raise HTTPException(status_code=404, detail="Upgrade request not found.")
        if req.status != "PENDING":
            raise HTTPException(status_code=400, detail=f"Request is already '{req.status}'.")

        now = datetime.now(timezone.utc)
        req.status = "REJECTED"
        req.rejected_by_id = current_admin.id
        req.rejected_at = now
        req.reason = reason.strip()

        self.db.commit()
        self.db.refresh(req)

        logger.info(
            "Upgrade request REJECTED by Admin | req_id=%s admin=%s reason=%s",
            req.id,
            current_admin.email,
            reason,
        )
        return self._format_upgrade_request(req)

    def _format_upgrade_request(self, req: SubscriptionUpgradeRequest) -> SubscriptionUpgradeRequestResponse:
        biz = req.business
        cur_plan_resp = SubscriptionPlanResponse.model_validate(req.current_plan) if req.current_plan else None
        req_plan_resp = SubscriptionPlanResponse.model_validate(req.requested_plan)

        return SubscriptionUpgradeRequestResponse(
            id=req.id,
            business_id=req.business_id,
            business_name=biz.name if biz else "Merchant",
            owner_name=biz.owner_name if biz else "Owner",
            email=biz.email if biz else "",
            current_plan=cur_plan_resp,
            requested_plan=req_plan_resp,
            status=req.status,
            reason=req.reason,
            requested_at=req.requested_at,
            approved_by=req.approved_by.name if req.approved_by else None,
            approved_at=req.approved_at,
            rejected_by=req.rejected_by.name if req.rejected_by else None,
            rejected_at=req.rejected_at,
        )
