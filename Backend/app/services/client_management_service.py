import math
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.automation import AutomationRule
from app.models.business import Business, BusinessStatus
from app.models.business_settings import BusinessSettings
from app.models.campaign import Campaign
from app.models.customer import Customer
from app.models.loyalty import LoyaltySettings
from app.models.service import Service
from app.models.user import User
from app.models.visit import Visit
from app.repositories.business_repository import BusinessRepository
from app.repositories.user_repository import UserRepository
from app.schemas.approval import BusinessTypeResponse
from app.schemas.client_management import (
    ClientDetailResponse,
    ClientListItemResponse,
    ClientStatsResponse,
    ImpersonateTokenResponse,
    PaginatedClientListResponse,
)


class ClientManagementService:

    def __init__(self, db: Session):
        self.db = db
        self.business_repo = BusinessRepository(db)
        self.user_repo = UserRepository(db)

    def _get_last_login_for_business(self, business_id: UUID) -> datetime | None:
        stmt = (
            select(func.max(User.updated_at))
            .where(User.business_id == business_id)
        )
        return self.db.scalar(stmt)

    def list_clients(
        self,
        page: int = 1,
        page_size: int = 10,
        search: str | None = None,
        status_filter: str | None = None,
        business_type_id: UUID | None = None,
        subscription_status: str | None = None,
        country: str | None = None,
        sort_by: str = "newest",
    ) -> PaginatedClientListResponse:
        items, total = self.business_repo.get_clients(
            page=page,
            page_size=page_size,
            search=search,
            status=status_filter,
            business_type_id=business_type_id,
            subscription_status=subscription_status,
            country=country,
            sort_by=sort_by,
        )

        response_items = []
        for b in items:
            last_login = self._get_last_login_for_business(b.id)
            bt_resp = (
                BusinessTypeResponse.model_validate(b.business_type)
                if b.business_type
                else None
            )
            response_items.append(
                ClientListItemResponse(
                    id=b.id,
                    name=b.name,
                    owner_name=b.owner_name,
                    email=b.email,
                    phone=b.phone,
                    country=b.country,
                    subscription_status=b.subscription_status,
                    status=b.status,
                    created_at=b.created_at,
                    approved_at=b.approved_at,
                    last_login=last_login,
                    business_type=bt_resp,
                )
            )

        total_pages = math.ceil(total / page_size) if total > 0 else 0

        return PaginatedClientListResponse(
            items=response_items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def get_client_detail(self, business_id: UUID) -> ClientDetailResponse:
        business = self.business_repo.get_by_id(business_id)
        if not business or business.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client business with ID '{business_id}' not found.",
            )

        # Count metrics using direct queries
        cust_count = self.db.scalar(
            select(func.count(Customer.id)).where(
                Customer.business_id == business_id,
                Customer.is_active == True,
            )
        ) or 0

        serv_count = self.db.scalar(
            select(func.count(Service.id)).where(
                Service.business_id == business_id,
                Service.is_active == True,
            )
        ) or 0

        visit_count = self.db.scalar(
            select(func.count(Visit.id)).where(Visit.business_id == business_id)
        ) or 0

        camp_count = self.db.scalar(
            select(func.count(Campaign.id)).where(Campaign.business_id == business_id)
        ) or 0

        loyalty = self.db.scalar(
            select(LoyaltySettings).where(LoyaltySettings.business_id == business_id)
        )
        loyalty_enabled = (
            (loyalty.is_active if hasattr(loyalty, "is_active") else getattr(loyalty, "is_enabled", False))
            if loyalty
            else False
        )

        # Business Settings
        b_settings = self.db.scalar(
            select(BusinessSettings).where(BusinessSettings.business_id == business_id)
        )
        settings_dict = None
        if b_settings:
            settings_dict = {
                "tax_percentage": float(b_settings.tax_percentage) if b_settings.tax_percentage else 0.0,
                "service_charge": float(b_settings.service_charge) if b_settings.service_charge else 0.0,
                "currency": b_settings.currency,
                "timezone": b_settings.timezone,
                "language": b_settings.language,
                "payment_qr_image": b_settings.payment_qr_image,
                "payment_upi_id": b_settings.payment_upi_id,
                "review_link": b_settings.review_link,
                "booking_link": b_settings.booking_link,
            }

        from app.services.subscription_limit_service import SubscriptionLimitService
        sub_summary = SubscriptionLimitService(self.db).get_full_usage_summary(business_id)

        last_login = self._get_last_login_for_business(business_id)
        bt_resp = (
            BusinessTypeResponse.model_validate(business.business_type)
            if business.business_type
            else None
        )

        return ClientDetailResponse(
            id=business.id,
            name=business.name,
            owner_name=business.owner_name,
            email=business.email,
            phone=business.phone,
            country=business.country,
            currency=business.currency,
            timezone=business.timezone,
            address=business.address,
            logo_url=business.logo_url,
            subscription_status=business.subscription_status,
            status=business.status,
            rejection_reason=business.rejection_reason,
            created_at=business.created_at,
            approved_at=business.approved_at,
            last_login=last_login,
            business_type=bt_resp,
            stats=ClientStatsResponse(
                customer_count=cust_count,
                service_count=serv_count,
                visit_count=visit_count,
                campaign_count=camp_count,
                loyalty_enabled=loyalty_enabled,
            ),
            settings=settings_dict,
        )

    def update_client_status(
        self, business_id: UUID, new_status: str
    ) -> ClientDetailResponse:
        valid_statuses = [BusinessStatus.ACTIVE.value, BusinessStatus.SUSPENDED.value]
        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{new_status}'. Allowed statuses are ACTIVE or SUSPENDED.",
            )

        business = self.business_repo.get_by_id(business_id)
        if not business or business.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client business with ID '{business_id}' not found.",
            )

        if business.status == BusinessStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot manually set status for pending business approval. Use approvals module.",
            )

        if business.status == new_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Business is already {new_status}.",
            )

        try:
            business.status = new_status
            is_active_flag = new_status == BusinessStatus.ACTIVE.value

            self.db.query(User).filter(User.business_id == business_id).update(
                {"is_active": is_active_flag}
            )

            self.db.commit()
            self.db.refresh(business)
            return self.get_client_detail(business_id)
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update client status due to an internal error.",
            ) from e

    def delete_client(self, business_id: UUID) -> dict:
        business = self.business_repo.get_by_id(business_id)
        if not business or business.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client business with ID '{business_id}' not found.",
            )

        try:
            import uuid as uuid_lib
            suffix = uuid_lib.uuid4().hex[:8]

            business.is_deleted = True
            business.is_active = False
            if business.email and not business.email.startswith("deleted_"):
                business.email = f"deleted_{suffix}_{business.email}"

            # Deactivate and update emails/login_ids of all linked users (owner + staff)
            linked_users = self.db.query(User).filter(User.business_id == business_id).all()
            for user in linked_users:
                user.is_active = False
                user.status = "DELETED"
                if user.email and not user.email.startswith("deleted_"):
                    user.email = f"deleted_{suffix}_{user.email}"
                if user.login_id and not user.login_id.startswith("deleted_"):
                    user.login_id = f"deleted_{suffix}_{user.login_id}"

            self.db.commit()
            return {"message": "Client business soft-deleted successfully."}
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete client business due to an internal error.",
            ) from e

    def impersonate_client(self, business_id: UUID) -> ImpersonateTokenResponse:
        business = self.business_repo.get_by_id(business_id)
        if not business or business.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client business with ID '{business_id}' not found.",
            )

        if business.status != BusinessStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot impersonate business with status '{business.status}'. Business must be ACTIVE.",
            )

        # Find owner user for this business
        owner_user = (
            self.db.query(User)
            .filter(User.business_id == business_id, User.role == "OWNER")
            .first()
        )

        if not owner_user:
            # Fallback to any active user for this business
            owner_user = (
                self.db.query(User)
                .filter(User.business_id == business_id)
                .first()
            )

        if not owner_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No user account found for this business to impersonate.",
            )

        # Issue impersonated JWT token
        token = create_access_token(
            {
                "sub": str(owner_user.id),
                "business_id": str(business.id),
                "role": owner_user.role,
                "is_impersonated": True,
            }
        )

        return ImpersonateTokenResponse(
            access_token=token,
            token_type="bearer",
            business_id=business.id,
            business_name=business.name,
        )
