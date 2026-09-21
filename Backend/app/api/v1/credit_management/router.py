import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.credit_management import (
    AiCreditPackCreate,
    AiCreditPackResponse,
    AiCreditPackUpdate,
    CreditManagementAnalyticsResponse,
    RejectAiCreditPurchaseRequestPayload,
)
from app.schemas.subscription import (
    AdjustPurchasedCreditsRequest,
)
from app.services.credit_management_service import CreditManagementService
from app.services.subscription_limit_service import SubscriptionLimitService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/credits",
    tags=["Super Admin Credit Management"],
)


@router.get(
    "/analytics",
    response_model=CreditManagementAnalyticsResponse,
    summary="Get top dashboard analytics cards for Credit Management",
)
def get_analytics(
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Returns analytics for Super Admin Credit Management (total businesses, credits used, near limit, out of credits, purchased credits sold)."""
    return CreditManagementService(db).get_analytics()


@router.get(
    "/packs",
    response_model=list[AiCreditPackResponse],
    summary="Get all AI credit packs (Super Admin)",
)
def list_credit_packs(
    include_inactive: bool = Query(True, description="Include disabled/inactive packs"),
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Returns all AI credit packs configured in the platform."""
    return CreditManagementService(db).list_credit_packs(include_inactive=include_inactive)


@router.post(
    "/packs",
    response_model=AiCreditPackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new AI credit pack",
)
def create_credit_pack(
    payload: AiCreditPackCreate,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Creates a new AI credit pack with name, ai_credits, price, status, and sort_order."""
    return CreditManagementService(db).create_credit_pack(payload)


@router.put(
    "/packs/{pack_id}",
    response_model=AiCreditPackResponse,
    summary="Update an existing AI credit pack",
)
def update_credit_pack(
    pack_id: UUID,
    payload: AiCreditPackUpdate,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Updates details of an existing AI credit pack."""
    return CreditManagementService(db).update_credit_pack(pack_id, payload)


@router.delete(
    "/packs/{pack_id}",
    summary="Delete an AI credit pack",
)
def delete_credit_pack(
    pack_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Deletes an AI credit pack."""
    return CreditManagementService(db).delete_credit_pack(pack_id)


@router.get(
    "/usage",
    summary="List business AI credit usage (Super Admin view)",
)
def list_business_ai_usage(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search by business name or owner name"),
    business_type: str | None = Query(None, description="Filter by business type: restaurant | salon | all"),
    plan: str | None = Query(None, description="Filter by plan name"),
    status: str | None = Query(None, description="Filter by status: normal | warning | limit reached | all"),
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Returns paginated business AI credit usage monitoring for Super Admin."""
    return SubscriptionLimitService(db).get_all_businesses_ai_usage(
        page=page,
        limit=limit,
        search=search,
        business_type_filter=business_type,
        plan_filter=plan,
        status_filter=status,
    )


@router.post(
    "/business/{business_id}/reset-monthly-credits",
    summary="Reset monthly AI credits for a business",
)
def reset_business_monthly_credits(
    business_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Resets monthly used AI credits for a business back to 0."""
    return SubscriptionLimitService(db).reset_business_monthly_credits(business_id, current_admin=current_admin)


@router.post(
    "/business/{business_id}/adjust-credits",
    summary="Add or remove purchased AI credits with reason and audit log",
)
def adjust_purchased_credits(
    business_id: UUID,
    payload: AdjustPurchasedCreditsRequest,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Adds or removes purchased AI credits for a merchant. Requires reason and logs to audit table."""
    return SubscriptionLimitService(db).adjust_purchased_credits(
        business_id=business_id,
        amount=payload.amount,
        reason=payload.reason,
        notes=payload.notes,
        current_admin=current_admin,
    )


@router.get(
    "/business/{business_id}/ai-audit-logs",
    summary="Get AI credit audit log history for a business",
)
def get_ai_audit_logs(
    business_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Returns full audit log history of AI credit adjustments for a business."""
    return SubscriptionLimitService(db).get_business_ai_audit_logs(business_id)


@router.get(
    "/requests",
    summary="List merchant AI credit purchase requests (Super Admin)",
)
def list_credit_purchase_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search by business name, merchant owner, or email"),
    status: str | None = Query(None, description="Filter by approval status: PENDING | APPROVED | REJECTED | CANCELLED | ALL"),
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Returns paginated AI credit purchase requests for Super Admin review & approval."""
    return CreditManagementService(db).list_purchase_requests(
        page=page,
        limit=limit,
        search=search,
        status_filter=status,
    )


@router.post(
    "/requests/{request_id}/approve",
    summary="Approve a merchant AI credit purchase request",
)
def approve_credit_purchase_request(
    request_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Approves a purchase request, updates payment & approval status, and adds credits to merchant balance."""
    return CreditManagementService(db).approve_purchase_request(request_id, current_admin=current_admin)


@router.post(
    "/requests/{request_id}/reject",
    summary="Reject a merchant AI credit purchase request",
)
def reject_credit_purchase_request(
    request_id: UUID,
    payload: RejectAiCreditPurchaseRequestPayload,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """Rejects a purchase request with reason (e.g. Payment Not Received, Duplicate Request, etc.)."""
    return CreditManagementService(db).reject_purchase_request(
        request_id=request_id,
        reason=payload.reason,
        notes=payload.notes,
        current_admin=current_admin,
    )
