import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.subscription import (
    MyPlanResponse,
    SubscriptionBillingHistoryResponse,
    SubscriptionPlanResponse,
    SubscriptionUpgradeRequestCreate,
    SubscriptionUpgradeRequestResponse,
)
from app.services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/subscription",
    tags=["Merchant Subscription"],
)


@router.get("/my-plan", response_model=MyPlanResponse, summary="Get current merchant subscription plan details")
def get_my_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns current active plan, trial status, days remaining, limits, and pending upgrade request."""
    return SubscriptionService(db).get_my_plan(current_user)


@router.get("/plans", response_model=list[SubscriptionPlanResponse], summary="List all active platform plans")
def list_available_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all active platform plans for merchant viewing and upgrade selection."""
    return SubscriptionService(db).list_plans()


@router.post("/upgrade-request", response_model=SubscriptionUpgradeRequestResponse, status_code=status.HTTP_201_CREATED, summary="Submit a subscription upgrade request")
def request_upgrade(
    payload: SubscriptionUpgradeRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submits an upgrade request to Super Admin for approval. Prevents duplicate pending requests."""
    return SubscriptionService(db).request_upgrade(current_user, payload)


@router.get("/my-requests", response_model=list[SubscriptionUpgradeRequestResponse], summary="Get merchant's upgrade request history")
def get_my_upgrade_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all subscription upgrade requests submitted by this merchant."""
    return SubscriptionService(db).get_my_upgrade_requests(current_user)


@router.post("/cancel-request/{request_id}", summary="Cancel a pending upgrade request")
def cancel_upgrade_request(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancels a pending subscription upgrade request."""
    return SubscriptionService(db).cancel_upgrade_request(current_user, request_id)


@router.get("/billing-history", response_model=list[SubscriptionBillingHistoryResponse], summary="Get merchant billing invoice history")
def get_billing_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns past subscription invoices, payment amounts, and renewal dates."""
    return SubscriptionService(db).get_billing_history(current_user)
