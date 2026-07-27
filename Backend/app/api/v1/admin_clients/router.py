import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_super_admin
from app.db.database import get_db
from app.models.admin import Admin
from app.schemas.client_management import (
    ClientDetailResponse,
    ClientStatusUpdateRequest,
    ImpersonateTokenResponse,
    PaginatedClientListResponse,
)
from app.services.client_management_service import ClientManagementService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/clients",
    tags=["Super Admin Client Management"],
)


@router.get(
    "",
    response_model=PaginatedClientListResponse,
    summary="Get all registered client businesses",
)
def list_clients(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search by business name, owner name, email, or phone"),
    status: str | None = Query(None, description="Filter by business status (ACTIVE, SUSPENDED, REJECTED)"),
    business_type_id: UUID | None = Query(None, description="Filter by business type ID"),
    subscription_status: str | None = Query(None, description="Filter by subscription status (e.g. trial, active)"),
    country: str | None = Query(None, description="Filter by country"),
    sort_by: str = Query("newest", description="Sort by newest, oldest, name, or plan_expiry"),
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns a paginated list of client businesses (excluding PENDING by default).
    Requires Super Admin authorization.
    """
    return ClientManagementService(db).list_clients(
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status,
        business_type_id=business_type_id,
        subscription_status=subscription_status,
        country=country,
        sort_by=sort_by,
    )


@router.get(
    "/{business_id}",
    response_model=ClientDetailResponse,
    summary="Get detailed client merchant information & statistics",
)
def get_client_detail(
    business_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Returns complete merchant details, including calculated statistics and settings.
    Requires Super Admin authorization.
    """
    return ClientManagementService(db).get_client_detail(business_id)


@router.patch(
    "/{business_id}/status",
    response_model=ClientDetailResponse,
    summary="Update business status (ACTIVE or SUSPENDED)",
)
def update_client_status(
    business_id: UUID,
    payload: ClientStatusUpdateRequest,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Updates the status of a merchant (ACTIVE or SUSPENDED).
    Requires Super Admin authorization.
    """
    return ClientManagementService(db).update_client_status(
        business_id, payload.status
    )


@router.delete(
    "/{business_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a client business",
)
def delete_client(
    business_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Soft-deletes a merchant business.
    Requires Super Admin authorization.
    """
    return ClientManagementService(db).delete_client(business_id)


@router.post(
    "/{business_id}/impersonate",
    response_model=ImpersonateTokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Impersonate merchant dashboard as business owner",
)
def impersonate_client(
    business_id: UUID,
    current_admin: Admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db),
):
    """
    Generates a temporary access token for Super Admin to access merchant portal as business owner.
    Requires Super Admin authorization.
    """
    return ClientManagementService(db).impersonate_client(business_id)
