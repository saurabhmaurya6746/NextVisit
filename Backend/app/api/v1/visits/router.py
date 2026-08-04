import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.visit import (
    VisitComplete,
    VisitCreate,
    VisitResponse,
    VisitServicesUpdatePayload,
    PaginatedVisitsResponse,
)
from app.services.visit_service import VisitService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/visits",
    tags=["Visits"],
)


@router.post(
    "",
    response_model=VisitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new visit for a customer",
)
def create_visit(
    data: VisitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new visit for the authenticated business.
    Calculates subtotal and total_amount on backend.
    Requires a valid Bearer JWT.
    """
    return VisitService(db).create_visit(current_user, data)


@router.get(
    "",
    response_model=PaginatedVisitsResponse | list[VisitResponse],
    summary="Get visits of the authenticated business (supports server-side pagination)",
)
def list_visits(
    page: int | None = Query(None, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    payment_status: str | None = None,
    staff_id: UUID | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    booking_source: str | None = None,
    sort: str | None = "newest",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns visits belonging to the authenticated user's business.
    If page parameter is provided, returns server-side paginated response.
    """
    if page is not None:
        return VisitService(db).get_paginated_visits(
            current_user=current_user,
            page=page,
            limit=limit,
            search=search,
            status=status,
            payment_status=payment_status,
            staff_id=staff_id,
            date_from=date_from,
            date_to=date_to,
            booking_source=booking_source,
            sort=sort,
        )
    return VisitService(db).list_visits(current_user)


@router.get(
    "/open",
    response_model=list[VisitResponse],
    summary="Get all open visits",
)
def list_open_visits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all open visits for the authenticated business.
    Requires a valid Bearer JWT.
    """
    return VisitService(db).list_open_visits(current_user)


@router.get(
    "/completed",
    response_model=list[VisitResponse],
    summary="Get all completed visits",
)
def list_completed_visits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all completed visits for the authenticated business.
    Requires a valid Bearer JWT.
    """
    return VisitService(db).list_completed_visits(current_user)


@router.get(
    "/{visit_id}",
    response_model=VisitResponse,
    summary="Get a visit by ID",
)
def get_visit(
    visit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns details of a visit belonging to the authenticated user's business.
    Returns HTTP 404 if not found or belongs to another business.
    Requires a valid Bearer JWT.
    """
    return VisitService(db).get_visit(current_user, visit_id)


@router.put(
    "/{visit_id}/services",
    response_model=VisitResponse,
    summary="Update or append services for an open visit",
)
def update_visit_services(
    visit_id: UUID,
    payload: VisitServicesUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates or appends services for an active visit and recalculates totals in backend PostgreSQL.
    """
    return VisitService(db).update_visit_services(current_user, visit_id, [s.model_dump() for s in payload.services])


@router.post(
    "/{visit_id}/complete",
    response_model=VisitResponse,
    summary="Complete a visit and update customer stats",
)
def complete_visit(
    visit_id: UUID,
    data: VisitComplete | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks a visit as COMPLETED and payment_status as PAID.
    Automatically updates customer's visit_count, total_spent, and visit dates.
    Requires a valid Bearer JWT.
    """
    return VisitService(db).complete_visit(current_user, visit_id, data)


@router.get(
    "/{visit_id}/pdf",
    summary="Download Salon Visit Invoice PDF",
)
def download_visit_pdf(
    visit_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates an official PDF invoice for the visit directly from PostgreSQL database records.
    """
    from fastapi import Response
    from app.services.pdf_service import SalonInvoicePdfService
    pdf_bytes, filename = SalonInvoicePdfService(db).generate_pdf_for_visit(current_user, visit_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
