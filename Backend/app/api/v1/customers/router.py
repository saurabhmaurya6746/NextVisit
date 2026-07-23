import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.customer_service import CustomerService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)


@router.get(
    "",
    response_model=list[CustomerResponse],
    summary="Get all customers of the authenticated business",
)
def list_customers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all customers belonging to the authenticated user's business.
    Requires a valid Bearer JWT.
    """
    return CustomerService(db).list_customers(current_user)


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
    Requires a valid Bearer JWT.
    """
    return CustomerService(db).update_customer(current_user, customer_id, data)
