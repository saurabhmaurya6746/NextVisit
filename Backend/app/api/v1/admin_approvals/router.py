import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.approval import (
    BusinessApprovalResponse,
    BusinessRejectRequest,
    PaginatedApprovalResponse,
)
from app.services.merchant_approval_service import MerchantApprovalService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/approvals",
    tags=["Super Admin Merchant Approvals"],
)


@router.get(
    "",
    response_model=PaginatedApprovalResponse,
    summary="Get all businesses with status=PENDING",
)
def list_pending_approvals(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search by business name, owner name, or email"),
    business_type_id: UUID | None = Query(None, description="Filter by business type ID"),
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns a paginated list of pending merchant registrations.
    Requires Super Admin authorization.
    """
    return MerchantApprovalService(db).list_pending_approvals(
        page=page,
        page_size=page_size,
        search=search,
        business_type_id=business_type_id,
    )


@router.get(
    "/{business_id}",
    response_model=BusinessApprovalResponse,
    summary="Get detailed signup information for a business",
)
def get_approval_details(
    business_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns complete signup & owner details for the specified business.
    Requires Super Admin authorization.
    """
    return MerchantApprovalService(db).get_approval_by_id(business_id)


@router.post(
    "/{business_id}/approve",
    response_model=BusinessApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve a pending business registration",
)
def approve_business(
    business_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Approves the business and sets status = ACTIVE.
    Requires Super Admin authorization.
    """
    return MerchantApprovalService(db).approve_business(business_id)


@router.post(
    "/{business_id}/reject",
    response_model=BusinessApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a business registration",
)
def reject_business(
    business_id: UUID,
    data: BusinessRejectRequest | None = None,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Rejects the business and sets status = REJECTED with an optional reason.
    Requires Super Admin authorization.
    """
    reason = data.reason if data else None
    return MerchantApprovalService(db).reject_business(business_id, reason=reason)
