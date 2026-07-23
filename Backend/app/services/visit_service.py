import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.visit import (
    PaymentStatus,
    Visit,
    VisitService as VisitServiceModel,
    VisitStatus,
)
from app.repositories.customer_repository import CustomerRepository
from app.repositories.service_repository import ServiceRepository
from app.repositories.user_repository import UserRepository
from app.repositories.visit_repository import VisitRepository
from app.schemas.visit import VisitComplete, VisitCreate

logger = logging.getLogger(__name__)


class VisitService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = VisitRepository(db)
        self.customer_repo = CustomerRepository(db)
        self.user_repo = UserRepository(db)
        self.service_repo = ServiceRepository(db)

    def list_visits(self, current_user: User) -> list[Visit]:
        logger.info(
            "Listing all visits | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        return self.repo.get_all_by_business(current_user.business_id)

    def list_open_visits(self, current_user: User) -> list[Visit]:
        logger.info(
            "Listing open visits | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        return self.repo.get_open_visits(current_user.business_id)

    def list_completed_visits(self, current_user: User) -> list[Visit]:
        logger.info(
            "Listing completed visits | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        return self.repo.get_completed_visits(current_user.business_id)

    def get_visit(self, current_user: User, visit_id: UUID) -> Visit:
        visit = self.repo.get_by_id(visit_id)
        if not visit or visit.business_id != current_user.business_id:
            logger.warning(
                "Visit not found or tenant mismatch | visit_id=%s business_id=%s",
                visit_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Visit not found.",
            )

        logger.info(
            "Visit fetched | visit_id=%s business_id=%s",
            visit.id,
            visit.business_id,
        )
        return visit

    def create_visit(self, current_user: User, data: VisitCreate) -> Visit:
        logger.info(
            "Creating visit | business_id=%s customer_id=%s",
            current_user.business_id,
            data.customer_id,
        )

        # 1. Validate customer belongs to current business
        customer = self.customer_repo.get_by_id(data.customer_id)
        if not customer or customer.business_id != current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found.",
            )

        # 2. Validate staff_id if provided
        if data.staff_id:
            staff = self.user_repo.get_by_id(data.staff_id)
            if not staff or staff.business_id != current_user.business_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Staff member not found.",
                )

        # 3. Validate services and calculate subtotal
        if not data.services:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one service is required for a visit.",
            )

        valid_service_items = []
        subtotal = 0.0

        for item in data.services:
            service = self.service_repo.get_by_id(item.service_id)
            if not service or service.business_id != current_user.business_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Service with ID '{item.service_id}' not found.",
                )
            if not service.is_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Service '{service.name}' is currently inactive.",
                )

            unit_price = service.price
            total_price = unit_price * item.quantity
            subtotal += total_price
            valid_service_items.append((service, item, unit_price, total_price))

        # 4. Calculate total_amount
        discount = data.discount if data.discount else 0.0
        total_amount = max(0.0, subtotal - discount)

        # 5. Create Visit object
        now_ts = datetime.now(timezone.utc)
        visit = Visit(
            business_id=current_user.business_id,
            customer_id=data.customer_id,
            staff_id=data.staff_id,
            status=VisitStatus.OPEN,
            notes=data.notes,
            subtotal=subtotal,
            discount=discount,
            total_amount=total_amount,
            payment_method=data.payment_method,
            payment_status=PaymentStatus.PENDING,
            started_at=now_ts,
        )

        # 6. Create VisitService records
        for service, item, unit_price, total_price in valid_service_items:
            vs = VisitServiceModel(
                service_id=service.id,
                quantity=item.quantity,
                unit_price=unit_price,
                total_price=total_price,
            )
            visit.services.append(vs)

        created_visit = self.repo.create(visit)
        self.db.commit()
        self.db.refresh(created_visit)

        logger.info(
            "Visit created successfully | visit_id=%s business_id=%s subtotal=%.2f total=%.2f",
            created_visit.id,
            created_visit.business_id,
            created_visit.subtotal,
            created_visit.total_amount,
        )
        return created_visit

    def complete_visit(
        self,
        current_user: User,
        visit_id: UUID,
        data: VisitComplete | None = None,
    ) -> Visit:
        visit = self.get_visit(current_user, visit_id)

        if visit.status == VisitStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Visit is already completed.",
            )

        if visit.status == VisitStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot complete a cancelled visit.",
            )

        if data:
            if data.payment_method:
                visit.payment_method = data.payment_method
            if data.notes:
                visit.notes = data.notes

        now_ts = datetime.now(timezone.utc)
        visit.status = VisitStatus.COMPLETED
        visit.payment_status = PaymentStatus.PAID
        visit.completed_at = now_ts

        # Automatically update Customer stats
        customer = self.customer_repo.get_by_id(visit.customer_id)
        if customer:
            customer.visit_count = (customer.visit_count or 0) + 1
            customer.total_spent = (customer.total_spent or 0.0) + visit.total_amount
            if not customer.first_visit_at:
                customer.first_visit_at = now_ts
            customer.last_visit_at = now_ts
            self.customer_repo.update(customer)

        self.repo.update(visit)
        self.db.commit()
        self.db.refresh(visit)

        logger.info(
            "Visit completed successfully | visit_id=%s customer_id=%s total_spent_added=%.2f",
            visit.id,
            visit.customer_id,
            visit.total_amount,
        )
        return visit
