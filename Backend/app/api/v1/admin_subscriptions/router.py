import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.subscription import (
    BusinessSubscriptionAssignRequest,
    BusinessSubscriptionItemResponse,
    SubscriptionPlanCreate,
    SubscriptionPlanResponse,
    SubscriptionPlanUpdate,
)
from app.services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/subscriptions",
    tags=["Super Admin Subscription Management"],
)


@router.get(
    "/plans",
    response_model=list[SubscriptionPlanResponse],
    summary="Get all subscription plans",
)
def list_plans(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns all platform subscription plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE, etc.).
    Requires Super Admin authorization.
    """
    return SubscriptionService(db).list_plans()


@router.post(
    "/plans",
    response_model=SubscriptionPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new subscription plan",
)
def create_plan(
    payload: SubscriptionPlanCreate,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Creates a new platform subscription plan.
    Requires Super Admin authorization.
    """
    return SubscriptionService(db).create_plan(payload)


@router.put(
    "/plans/{plan_id}",
    response_model=SubscriptionPlanResponse,
    summary="Update an existing subscription plan",
)
def update_plan(
    plan_id: UUID,
    payload: SubscriptionPlanUpdate,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Updates details of a subscription plan.
    Requires Super Admin authorization.
    """
    return SubscriptionService(db).update_plan(plan_id, payload)


@router.patch(
    "/business/{business_id}",
    response_model=BusinessSubscriptionItemResponse,
    summary="Assign or change a business subscription",
)
def assign_business_subscription(
    business_id: UUID,
    payload: BusinessSubscriptionAssignRequest,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Assigns or updates a merchant's subscription plan, trial days, or expiration date.
    Requires Super Admin authorization.
    """
    return SubscriptionService(db).assign_business_subscription(
        business_id, payload
    )


@router.get(
    "/business",
    response_model=list[BusinessSubscriptionItemResponse],
    summary="Get all business subscriptions",
)
def list_business_subscriptions(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns a list of all businesses with their active subscription plan, trial end, and expiry details.
    Requires Super Admin authorization.
    """
    return SubscriptionService(db).list_business_subscriptions()
