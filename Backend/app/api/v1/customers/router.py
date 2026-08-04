import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.celebration import (
    BirthdaySummaryResponse,
    PaginatedBirthdayResponse,
)
from app.schemas.customer import (
    CustomerCreate,
    CustomerCrmDetails,
    CustomerResponse,
    CustomerSegmentsResponse,
    CustomerUpdate,
    PaginatedWelcomeResponse,
    PaginatedVipResponse,
    PaginatedCustomersResponse,
)
from app.services.customer_segmentation_service import CustomerSegmentationService
from app.services.customer_service import CustomerService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)


@router.get(
    "/welcome",
    response_model=PaginatedWelcomeResponse,
    summary="Get Welcome Campaign database-driven metrics, summary cards, and paginated customer list",
)
def get_welcome_campaign_data(
    timeframe: str = "today",
    search: str | None = None,
    sort_by: str | None = "newest",
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns 100% database-driven welcome campaign summary cards, metrics, and server-side paginated customer records.
    """
    return CustomerService(db).get_welcome_campaign_data(
        current_user=current_user,
        timeframe=timeframe,
        search=search,
        sort_by=sort_by,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/birthday-summary",
    response_model=BirthdaySummaryResponse,
    summary="Get birthday summary card counts (today, tomorrow, week, month)",
)
def get_birthday_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns database-driven counts for today, tomorrow, this week, and this month's birthday customers.
    """
    data = CustomerService(db).get_birthday_campaign_data(current_user, bucket="today")
    return BirthdaySummaryResponse(**data["summary"])


@router.get(
    "/birthday-list",
    response_model=PaginatedBirthdayResponse,
    summary="Get paginated birthday customer list filtered by bucket",
)
def get_birthday_list(
    bucket: str = Query(default="today", description="today, tomorrow, week, month"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="name", description="name, birth_date, last_visit_at, total_spent"),
    sort_order: str = Query(default="asc", description="asc, desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns server-side paginated list of birthday customers with filters, search, and sorting.
    """
    return CustomerService(db).get_birthday_campaign_data(
        current_user=current_user,
        bucket=bucket,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/anniversary-summary",
    response_model=BirthdaySummaryResponse,
    summary="Get anniversary summary card counts (today, tomorrow, week, month)",
)
def get_anniversary_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns database-driven counts for today, tomorrow, this week, and this month's anniversary customers.
    """
    data = CustomerService(db).get_anniversary_campaign_data(current_user, bucket="today")
    return BirthdaySummaryResponse(**data["summary"])


@router.get(
    "/anniversary-list",
    response_model=PaginatedBirthdayResponse,
    summary="Get paginated anniversary customer list filtered by bucket",
)
def get_anniversary_list(
    bucket: str = Query(default="today", description="today, tomorrow, week, month"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="name", description="name, anniversary_date, last_visit_at, total_spent"),
    sort_order: str = Query(default="asc", description="asc, desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns server-side paginated list of anniversary customers with filters, search, and sorting.
    """
    return CustomerService(db).get_anniversary_campaign_data(
        current_user=current_user,
        bucket=bucket,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/vip",
    response_model=PaginatedVipResponse,
    summary="Get VIP customers with summary cards, search, sort and pagination",
)
def get_vip_customers(
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    sort_by: str = "spend_desc",
    min_spend: float = 500.0,
    min_visits: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns VIP customers identified automatically by lifetime spend and visit count.
    Includes summary cards, favorite item (from real order history), search, sort, and pagination.
    VIP = total_spent >= min_spend OR visit_count >= min_visits.
    """
    return CustomerService(db).get_vip_customers(
        current_user=current_user,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        min_spend=min_spend,
        min_visits=min_visits,
    )


@router.get(
    "",
    response_model=PaginatedCustomersResponse | list[CustomerResponse],
    summary="Get customers of the authenticated business (supports server-side pagination)",
)
def list_customers(
    page: int | None = Query(None, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: str | None = None,
    sort: str | None = "newest",
    filter: str | None = "all",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns customers belonging to the authenticated user's business.
    If page parameter is provided, returns server-side paginated response.
    """
    if page is not None:
        return CustomerService(db).get_paginated_customers(
            current_user=current_user,
            page=page,
            limit=limit,
            search=search,
            sort=sort,
            filter=filter,
        )
    return CustomerService(db).list_customers(current_user)


@router.get(
    "/segments",
    response_model=CustomerSegmentsResponse,
    summary="Get customer segmentations for the authenticated business",
)
def get_customer_segments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns customer segments (new, inactive 15/30/60/90 days, birthday/anniversary today, top 20 VIPs).
    Requires a valid Bearer JWT.
    """
    return CustomerSegmentationService(db).get_customer_segments(current_user)


@router.get(
    "/{customer_id}/crm",
    response_model=CustomerCrmDetails,
    summary="Get full customer CRM profile details including timeline, visits, orders, and loyalty",
)
def get_customer_crm_details(
    customer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns complete CRM metrics, activity timeline, visits, orders, loyalty history, and preferences.
    """
    return CustomerService(db).get_customer_crm_details(current_user, customer_id)


@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Get a customer by ID",
)
def get_customer(
    customer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns details of a customer belonging to the authenticated user's business.
    Returns HTTP 404 if not found or belongs to another business.
    Requires a valid Bearer JWT.
    """
    return CustomerService(db).get_customer(current_user, customer_id)


@router.get(
    "/phone/{phone}",
    response_model=CustomerResponse,
    summary="Get a customer by phone number",
)
def get_customer_by_phone(
    phone: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns details of a customer matching phone number in the authenticated business.
    Returns HTTP 404 if not found.
    Requires a valid Bearer JWT.
    """
    return CustomerService(db).get_customer_by_phone(current_user, phone)


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new customer for the business",
)
def create_customer(
    data: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new customer under the authenticated user's business.
    Phone number must be unique within the business.
    Requires a valid Bearer JWT.
    """
    return CustomerService(db).create_customer(current_user, data)


@router.put(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update an existing customer",
)
def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates editable fields of a customer belonging to the authenticated user's business.
    Returns HTTP 404 if not found or belongs to another business.
    Returns HTTP 409 if phone number conflicts with another customer in the business.
    """
    return CustomerService(db).update_customer(current_user, customer_id, data)


@router.delete(
    "/{customer_id}",
    summary="Delete a customer permanently from backend database",
)
def delete_customer(
    customer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a customer belonging to the authenticated user's business.
    Returns HTTP 404 if not found or belongs to another business.
    """
    return CustomerService(db).delete_customer(current_user, customer_id)


@router.post(
    "/{customer_id}/record-visit",
    response_model=CustomerResponse,
    summary="Record a completed visit & spend for a customer to update stats and loyalty",
)
def record_customer_visit(
    customer_id: UUID,
    amount_spent: float = Query(..., ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Increments customer's visit_count by 1, adds amount_spent to total_spent, and awards loyalty points.
    """
    return CustomerService(db).record_customer_visit(current_user, customer_id, amount_spent)
