import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.visit import VisitComplete, VisitCreate, VisitResponse
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
    response_model=list[VisitResponse],
    summary="Get all visits of the authenticated business",
)
def list_visits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all visits belonging to the authenticated user's business.
    Requires a valid Bearer JWT.
    """
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
