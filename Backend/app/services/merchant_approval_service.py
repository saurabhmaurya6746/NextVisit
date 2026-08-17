import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.business import Business, BusinessStatus
from app.models.user import User
from app.repositories.business_repository import BusinessRepository
from app.repositories.user_repository import UserRepository
from app.schemas.approval import PaginatedApprovalResponse


class MerchantApprovalService:

    def __init__(self, db: Session):
        self.db = db
        self.business_repo = BusinessRepository(db)
        self.user_repo = UserRepository(db)

    def list_pending_approvals(
        self,
        page: int = 1,
        page_size: int = 10,
        search: str | None = None,
        business_type_id: UUID | None = None,
    ) -> PaginatedApprovalResponse:
        items, total = self.business_repo.get_pending_approvals(
            page=page,
            page_size=page_size,
            search=search,
            business_type_id=business_type_id,
        )

        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return PaginatedApprovalResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def get_approval_by_id(self, business_id: UUID) -> Business:
        business = self.business_repo.get_by_id(business_id)
        if not business or business.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found.",
            )
        return business

    def approve_business(self, business_id: UUID) -> Business:
        business = self.business_repo.get_by_id(business_id)
        if not business or business.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found.",
            )

        if business.status == BusinessStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business is already approved and active.",
            )
        elif business.status == BusinessStatus.REJECTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business is already rejected.",
            )
        elif business.status == BusinessStatus.SUSPENDED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business is currently suspended.",
            )

        try:
            business.status = BusinessStatus.ACTIVE.value
            business.approved_at = datetime.now(timezone.utc)

            # Ensure business users are active
            self.db.query(User).filter(User.business_id == business_id).update(
                {"is_active": True}
            )

            self.db.commit()
            self.db.refresh(business)

            # Non-blocking User Approval Email Notification
            try:
                from app.services.email_service import EmailService
                owner_user = self.db.query(User).filter(User.business_id == business_id, User.role == "OWNER").first()
                recipient_email = owner_user.email if (owner_user and owner_user.email) else business.email
                recipient_name = owner_user.name if (owner_user and owner_user.name) else business.owner_name
                if recipient_email:
                    EmailService.send_account_approved_email(
                        owner_email=recipient_email,
                        owner_name=recipient_name,
                        business_name=business.name,
                    )
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).warning(
                    "Non-blocking approval email notification error: %s", str(email_err)
                )

            return business
        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to approve business due to an internal error.",
            ) from e

    def reject_business(self, business_id: UUID, reason: str | None = None) -> Business:
        business = self.business_repo.get_by_id(business_id)
        if not business or business.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business with ID '{business_id}' not found.",
            )

        if business.status == BusinessStatus.REJECTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business is already rejected.",
            )
        elif business.status == BusinessStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business is already approved and active.",
            )
        elif business.status == BusinessStatus.SUSPENDED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business is currently suspended.",
            )

        try:
            business.status = BusinessStatus.REJECTED.value
            if reason:
                business.rejection_reason = reason.strip()

            # Ensure business users are deactivated
            self.db.query(User).filter(User.business_id == business_id).update(
                {"is_active": False}
            )

            self.db.commit()
            self.db.refresh(business)

            # Non-blocking User Rejection Email Notification
            try:
                from app.services.email_service import EmailService
                owner_user = self.db.query(User).filter(User.business_id == business_id, User.role == "OWNER").first()
                recipient_email = owner_user.email if (owner_user and owner_user.email) else business.email
                recipient_name = owner_user.name if (owner_user and owner_user.name) else business.owner_name
                if recipient_email:
                    EmailService.send_account_rejected_email(
                        owner_email=recipient_email,
                        owner_name=recipient_name,
                        business_name=business.name,
                        reason=business.rejection_reason,
                    )
            except Exception as email_err:
                import logging
                logging.getLogger(__name__).warning(
                    "Non-blocking rejection email notification error: %s", str(email_err)
                )

            return business
        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reject business due to an internal error.",
            ) from e

