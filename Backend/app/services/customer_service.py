import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.user import User
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate

logger = logging.getLogger(__name__)


class CustomerService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = CustomerRepository(db)

    def list_customers(self, current_user: User) -> list[Customer]:
        logger.info(
            "Listing customers | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        return self.repo.get_all_by_business(current_user.business_id)

    def get_customer(self, current_user: User, customer_id: UUID) -> Customer:
        customer = self.repo.get_by_id(customer_id)
        if not customer or customer.business_id != current_user.business_id:
            logger.warning(
                "Customer not found or tenant mismatch | customer_id=%s business_id=%s",
                customer_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found.",
            )

        logger.info(
            "Customer fetched | customer_id=%s business_id=%s",
            customer.id,
            customer.business_id,
        )
        return customer

    def create_customer(
        self, current_user: User, data: CustomerCreate
    ) -> Customer:
        logger.info(
            "Creating customer | business_id=%s phone=%s",
            current_user.business_id,
            data.phone,
        )

        existing_customer = self.repo.get_by_phone(
            current_user.business_id, data.phone
        )
        if existing_customer:
            logger.warning(
                "Customer creation rejected — duplicate phone inside business | business_id=%s phone=%s",
                current_user.business_id,
                data.phone,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A customer with this phone number already exists in your business.",
            )

        customer = Customer(
            business_id=current_user.business_id,
            **data.model_dump(),
        )
        created_customer = self.repo.create(customer)
        self.db.commit()
        self.db.refresh(created_customer)

        logger.info(
            "Customer created successfully | customer_id=%s business_id=%s",
            created_customer.id,
            created_customer.business_id,
        )
        return created_customer

    def update_customer(
        self,
        current_user: User,
        customer_id: UUID,
        data: CustomerUpdate,
    ) -> Customer:
        customer = self.get_customer(current_user, customer_id)

        if data.phone is not None and data.phone != customer.phone:
            existing_customer = self.repo.get_by_phone(
                current_user.business_id, data.phone
            )
            if existing_customer and existing_customer.id != customer.id:
                logger.warning(
                    "Customer update rejected — duplicate phone inside business | business_id=%s phone=%s",
                    current_user.business_id,
                    data.phone,
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A customer with this phone number already exists in your business.",
                )

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(customer, field, value)

        self.repo.update(customer)
        self.db.commit()
        self.db.refresh(customer)

        logger.info(
            "Customer updated successfully | customer_id=%s business_id=%s",
            customer.id,
            customer.business_id,
        )
        return customer
