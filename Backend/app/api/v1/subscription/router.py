import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.credit_management import AiCreditPackResponse
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


@router.get("/public-plans", response_model=list[SubscriptionPlanResponse], summary="List all active public platform plans")
@router.get("/plans", response_model=list[SubscriptionPlanResponse], summary="List all active platform plans")
def list_available_plans(
    db: Session = Depends(get_db),
):
    """Returns all active platform plans for homepage pricing, merchant viewing, and upgrade selection."""
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


@router.get("/usage", summary="Get current subscription usage summary (Staff & AI limits)")
def get_subscription_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns current active plan limits, active staff count, and monthly AI usage."""
    from app.services.subscription_limit_service import SubscriptionLimitService
    return SubscriptionLimitService(db).get_full_usage_summary(current_user.business_id)


@router.get("/ai-entitlement", summary="Get centralized AI entitlement details for active merchant")
def get_ai_entitlement(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns AI entitlement status: can_use_ai, ai_included_in_plan, credits_available, reason, current_plan, credits_remaining."""
    from app.services.subscription_limit_service import SubscriptionLimitService
    return SubscriptionLimitService(db).get_ai_entitlement(current_user.business_id)


@router.get("/credit-packs", response_model=list[AiCreditPackResponse], summary="List active AI credit packs for merchant purchasing")
def list_merchant_credit_packs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns active AI credit packs available for merchant top-up/purchase."""
    from app.services.credit_management_service import CreditManagementService
    return CreditManagementService(db).list_credit_packs(include_inactive=False)


@router.post("/buy-credit-pack/{pack_id}", summary="Submit AI Credit Pack purchase request for approval")
def buy_credit_pack(
    pack_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submits a purchase request for an AI credit pack for Super Admin approval."""
    from app.services.credit_management_service import CreditManagementService
    return CreditManagementService(db).purchase_credit_pack(pack_id, current_user)


@router.get("/my-credit-requests", summary="Get merchant's AI credit purchase request history")
def get_my_credit_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all AI credit purchase requests submitted by this merchant."""
    from app.services.credit_management_service import CreditManagementService
    return CreditManagementService(db).get_merchant_credit_requests(current_user)
