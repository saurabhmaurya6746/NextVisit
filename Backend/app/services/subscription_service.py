import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.subscription_plan import SubscriptionPlan
from app.schemas.subscription import (
    BusinessSubscriptionAssignRequest,
    BusinessSubscriptionItemResponse,
    SubscriptionPlanCreate,
    SubscriptionPlanResponse,
    SubscriptionPlanUpdate,
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
                max_customers=50,
                max_staff=2,
                max_active_devices=2,
                max_campaigns_per_month=5,
                storage_limit_gb=0.5,
                features={"analytics": False, "ai_generator": False, "priority_support": False},
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
                features={"analytics": True, "ai_generator": True, "priority_support": False},
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
                features={"analytics": True, "ai_generator": True, "priority_support": True},
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
                features={"analytics": True, "ai_generator": True, "priority_support": True, "custom_branding": True},
                is_active=True,
            ),
        ]
        self.db.add_all(default_plans)
        self.db.commit()
        logger.info("Default subscription plans initialized successfully.")

    def list_plans(self) -> list[SubscriptionPlan]:
        self.init_default_plans()
        stmt = select(SubscriptionPlan).order_by(SubscriptionPlan.monthly_price.asc())
        return list(self.db.scalars(stmt).all())

    def create_plan(self, data: SubscriptionPlanCreate) -> SubscriptionPlan:
        # Check duplicate name
        existing = self.db.scalar(
            select(SubscriptionPlan).where(
                func_lower(SubscriptionPlan.name) == data.name.strip().lower()
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
            features=data.features,
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

        # Validation: Cannot deactivate plan currently assigned to active businesses
        if data.is_active is False and plan.is_active:
            in_use = self.db.scalar(
                select(Business.id).where(
                    Business.subscription_plan_id == plan_id,
                    Business.is_deleted == False,
                )
            )
            if in_use:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot deactivate plan '{plan.name}' because it is currently in use by active merchants.",
                )

        update_dict = data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            if field == "name" and value:
                value = value.strip().upper()
                # Check duplicate name if changing
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

        # Sync trial_days with PlatformSettings if this is the default plan
        if "trial_days" in update_dict:
            from app.models.platform_settings import PlatformSettings
            p_settings = self.db.scalar(select(PlatformSettings))
            if p_settings and p_settings.default_plan.upper() == plan.name.upper():
                p_settings.trial_days = plan.trial_days

        self.db.commit()
        self.db.refresh(plan)
        return plan

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

        if not plan.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot assign inactive subscription plan '{plan.name}'.",
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
        elif trial_d > 0:
            business.plan_expires_at = business.trial_end

        if data.notes:
            business.subscription_notes = data.notes

        self.db.commit()
        self.db.refresh(business)

        plan_resp = SubscriptionPlanResponse.model_validate(plan) if plan else None
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
        stmt = (
            select(Business)
            .where(Business.is_deleted == False)
            .order_by(Business.created_at.desc())
        )
        businesses = list(self.db.scalars(stmt).all())

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


def func_lower(col):
    from sqlalchemy import func
    return func.lower(col)
