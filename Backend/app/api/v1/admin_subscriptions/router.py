import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.subscription import (
    BusinessSubscriptionAssignRequest,
    BusinessSubscriptionItemResponse,
    PaginatedSubscriptionUpgradeRequestsResponse,
    SubscriptionPlanCreate,
    SubscriptionPlanResponse,
    SubscriptionPlanUpdate,
    SubscriptionUpgradeRejectRequest,
    SubscriptionUpgradeRequestResponse,
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
    """Returns all platform subscription plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE, etc.)."""
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
    """Creates a new platform subscription plan."""
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
    """Updates details of a subscription plan."""
    return SubscriptionService(db).update_plan(plan_id, payload)


@router.delete(
    "/plans/{plan_id}",
    summary="Delete a subscription plan",
)
def delete_plan(
    plan_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Deletes a subscription plan if not assigned to active merchants."""
    return SubscriptionService(db).delete_plan(plan_id)


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
    """Assigns or updates a merchant's subscription plan, trial days, or expiration date."""
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
    """Returns a list of all businesses with their active subscription plan, trial end, and expiry details."""
    return SubscriptionService(db).list_business_subscriptions()


# ── Super Admin Upgrade Requests Workflow ──────────────────────────────────

@router.get(
    "/requests",
    response_model=PaginatedSubscriptionUpgradeRequestsResponse,
    summary="List merchant subscription upgrade requests",
)
def list_upgrade_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status: str = Query("ALL", description="PENDING, APPROVED, REJECTED, CANCELLED, or ALL"),
    search: str = Query("", description="Search by business, owner name, email or plan"),
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Paginated list of merchant subscription upgrade requests with status and search filters."""
    return SubscriptionService(db).list_admin_upgrade_requests(
        page=page, limit=limit, status_filter=status, search=search
    )


@router.post(
    "/requests/{request_id}/approve",
    response_model=SubscriptionUpgradeRequestResponse,
    summary="Approve merchant subscription upgrade request",
)
def approve_upgrade_request(
    request_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Approves upgrade request, updates business plan, updates limits, and generates invoice."""
    return SubscriptionService(db).approve_upgrade_request(current_admin, request_id)


@router.post(
    "/requests/{request_id}/reject",
    response_model=SubscriptionUpgradeRequestResponse,
    summary="Reject merchant subscription upgrade request",
)
def reject_upgrade_request(
    request_id: UUID,
    payload: SubscriptionUpgradeRejectRequest,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Rejects upgrade request with a reason."""
    return SubscriptionService(db).reject_upgrade_request(
        current_admin, request_id, payload.reason
    )
