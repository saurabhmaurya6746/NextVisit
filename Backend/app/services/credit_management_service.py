import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ai_credit_audit_log import AiCreditAuditLog
from app.models.ai_credit_pack import AiCreditPack
from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.schemas.credit_management import (
    AiCreditPackCreate,
    AiCreditPackUpdate,
    CreditManagementAnalyticsResponse,
)
from app.services.subscription_limit_service import SubscriptionLimitService

logger = logging.getLogger(__name__)


class CreditManagementService:

    def __init__(self, db: Session):
        self.db = db

    def init_default_credit_packs(self) -> None:
        """Seed default platform AI credit packs if table is empty."""
        count = self.db.scalar(select(func.count(AiCreditPack.id)))
        if count and count > 0:
            return

        logger.info("Initializing default AI Credit Packs...")
        default_packs = [
            AiCreditPack(
                name="Starter Pack",
                ai_credits=100,
                price=49.0,
                is_active=True,
                sort_order=1,
            ),
            AiCreditPack(
                name="Business Pack",
                ai_credits=500,
                price=199.0,
                is_active=True,
                sort_order=2,
            ),
            AiCreditPack(
                name="Enterprise Pack",
                ai_credits=1000,
                price=349.0,
                is_active=True,
                sort_order=3,
            ),
        ]
        self.db.add_all(default_packs)
        self.db.commit()
        logger.info("Default AI Credit Packs seeded successfully.")

    def list_credit_packs(self, include_inactive: bool = True) -> list[AiCreditPack]:
        self.init_default_credit_packs()
        stmt = select(AiCreditPack)
        if not include_inactive:
            stmt = stmt.where(AiCreditPack.is_active == True)
        stmt = stmt.order_by(AiCreditPack.sort_order.asc(), AiCreditPack.created_at.asc())
        return list(self.db.scalars(stmt).all())

    def create_credit_pack(self, data: AiCreditPackCreate) -> AiCreditPack:
        existing = self.db.scalar(
            select(AiCreditPack).where(
                func.lower(AiCreditPack.name) == data.name.strip().lower()
            )
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Credit pack with name '{data.name}' already exists.",
            )

        pack = AiCreditPack(
            name=data.name.strip(),
            ai_credits=data.ai_credits,
            price=data.price,
            is_active=data.is_active,
            sort_order=data.sort_order,
        )
        self.db.add(pack)
        self.db.commit()
        self.db.refresh(pack)
        return pack

    def update_credit_pack(self, pack_id: UUID, data: AiCreditPackUpdate) -> AiCreditPack:
        pack = self.db.scalar(select(AiCreditPack).where(AiCreditPack.id == pack_id))
        if not pack:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Credit pack with ID '{pack_id}' not found.",
            )

        update_dict = data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            if field == "name" and value:
                value = value.strip()
                dup = self.db.scalar(
                    select(AiCreditPack).where(
                        func.lower(AiCreditPack.name) == value.lower(),
                        AiCreditPack.id != pack_id,
                    )
                )
                if dup:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Credit pack with name '{value}' already exists.",
                    )
            setattr(pack, field, value)

        pack.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(pack)
        return pack

    def delete_credit_pack(self, pack_id: UUID) -> dict[str, str]:
        pack = self.db.scalar(select(AiCreditPack).where(AiCreditPack.id == pack_id))
        if not pack:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Credit pack with ID '{pack_id}' not found.",
            )
        self.db.delete(pack)
        self.db.commit()
        return {"message": f"Credit pack '{pack.name}' deleted successfully."}

    def get_analytics(self) -> CreditManagementAnalyticsResponse:
        """Top Dashboard Cards analytics for Super Admin Credit Management."""
        total_businesses = self.db.scalar(
            select(func.count(Business.id)).where(Business.is_deleted == False)
        ) or 0

        # Total monthly AI credits used
        total_ai_credits_used_this_month = self.db.scalar(
            select(func.coalesce(func.sum(BusinessSettings.ai_monthly_used_credits), 0))
        ) or 0

        # Calculate near limit and out of credits across all businesses
        limit_service = SubscriptionLimitService(self.db)
        ai_usage_data = limit_service.get_all_businesses_ai_usage(page=1, limit=1000)
        items = ai_usage_data.get("items", [])

        near_limit = sum(1 for item in items if item.get("status") == "Warning")
        out_of_credits = sum(1 for item in items if item.get("status") == "Limit Reached" or item.get("limit_reached"))

        # Total Purchased Credits Sold / Added
        total_purchased_sold = self.db.scalar(
            select(func.coalesce(func.sum(AiCreditAuditLog.amount), 0)).where(AiCreditAuditLog.amount > 0)
        ) or 0
        if total_purchased_sold == 0:
            total_purchased_sold = self.db.scalar(
                select(func.coalesce(func.sum(BusinessSettings.purchased_ai_credits), 0))
            ) or 0

        return CreditManagementAnalyticsResponse(
            total_businesses=total_businesses,
            total_ai_credits_used_this_month=total_ai_credits_used_this_month,
            businesses_near_limit=near_limit,
            businesses_out_of_credits=out_of_credits,
            total_purchased_credits_sold=total_purchased_sold,
        )

    def purchase_credit_pack(self, pack_id: UUID, current_user) -> dict:
        """Merchant self-service credit pack purchase request submission."""
        return self.submit_credit_purchase_request(pack_id, current_user)

    def submit_credit_purchase_request(self, pack_id: UUID, current_user) -> dict:
        """Submits a new AI Credit purchase request for Super Admin approval."""
        from app.models.ai_credit_purchase_request import AiCreditPurchaseRequest

        pack = self.db.scalar(
            select(AiCreditPack).where(
                AiCreditPack.id == pack_id,
                AiCreditPack.is_active == True,
            )
        )
        if not pack:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected credit pack is not active or available.",
            )

        # Check for existing pending request for same pack to avoid spam
        existing_pending = self.db.scalar(
            select(AiCreditPurchaseRequest).where(
                AiCreditPurchaseRequest.business_id == current_user.business_id,
                AiCreditPurchaseRequest.pack_id == pack_id,
                AiCreditPurchaseRequest.approval_status == "PENDING",
            )
        )
        if existing_pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a pending purchase request for '{pack.name}'. Please wait for Super Admin approval.",
            )

        req = AiCreditPurchaseRequest(
            business_id=current_user.business_id,
            pack_id=pack.id,
            pack_name=pack.name,
            ai_credits=pack.ai_credits,
            amount=pack.price,
            payment_status="PENDING",
            approval_status="PENDING",
            requested_at=datetime.now(timezone.utc),
        )
        self.db.add(req)

        # Log request creation in audit log
        audit = AiCreditAuditLog(
            business_id=current_user.business_id,
            admin_id=None,
            action="REQUEST_CREATED",
            amount=pack.ai_credits,
            reason="Merchant Purchase Request Submitted",
            notes=f"Submitted purchase request for '{pack.name}' ({pack.ai_credits} Credits for ₹{pack.price})",
            previous_balance=0,
            new_balance=0,
        )
        self.db.add(audit)
        self.db.commit()

        return {
            "success": True,
            "message": "Your AI Credit purchase request has been submitted. Status: Pending Approval. The request will be reviewed by the administrator.",
            "request_id": str(req.id),
            "approval_status": req.approval_status,
            "payment_status": req.payment_status,
        }

    def get_merchant_credit_requests(self, current_user) -> list[dict]:
        """Returns purchase request history for merchant UI."""
        from app.models.ai_credit_purchase_request import AiCreditPurchaseRequest

        requests = self.db.scalars(
            select(AiCreditPurchaseRequest)
            .where(AiCreditPurchaseRequest.business_id == current_user.business_id)
            .order_by(AiCreditPurchaseRequest.requested_at.desc())
        ).all()

        return [
            {
                "id": str(r.id),
                "pack_name": r.pack_name,
                "ai_credits": r.ai_credits,
                "amount": r.amount,
                "payment_status": r.payment_status,
                "approval_status": r.approval_status,
                "requested_at": r.requested_at.isoformat() if r.requested_at else None,
                "approved_at": r.approved_at.isoformat() if r.approved_at else None,
                "rejection_reason": r.rejection_reason,
            }
            for r in requests
        ]

    def list_purchase_requests(
        self,
        page: int = 1,
        limit: int = 20,
        search: str = "",
        status_filter: str | None = None,
    ) -> dict:
        """Returns paginated list of purchase requests for Super Admin."""
        from app.models.ai_credit_purchase_request import AiCreditPurchaseRequest

        stmt = select(AiCreditPurchaseRequest).join(Business, AiCreditPurchaseRequest.business_id == Business.id)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                (func.lower(Business.name).like(term))
                | (func.lower(Business.owner_name).like(term))
                | (func.lower(Business.email).like(term))
            )

        if status_filter and status_filter.upper() != "ALL":
            stmt = stmt.where(AiCreditPurchaseRequest.approval_status == status_filter.upper())

        stmt = stmt.order_by(AiCreditPurchaseRequest.requested_at.desc())

        # Total count
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        pages = max(1, (total + limit - 1) // limit)

        # Pagination
        records = self.db.scalars(stmt.offset((page - 1) * limit).limit(limit)).all()

        limit_service = SubscriptionLimitService(self.db)
        items = []
        for r in records:
            biz = r.business
            plan = limit_service.get_business_plan(biz.id) if biz else None
            ai_data = limit_service.get_ai_credit_usage(biz.id) if biz else {}

            items.append({
                "id": r.id,
                "business_id": r.business_id,
                "business_name": biz.name if biz else "Unknown Business",
                "merchant_name": biz.owner_name if biz else "Unknown Owner",
                "merchant_email": biz.email if biz else "No Email",
                "current_plan_name": plan.name if plan else "Free",
                "current_ai_credits": ai_data.get("total_remaining_credits", 0),
                "pack_id": r.pack_id,
                "pack_name": r.pack_name,
                "ai_credits": r.ai_credits,
                "amount": r.amount,
                "payment_status": r.payment_status,
                "approval_status": r.approval_status,
                "requested_at": r.requested_at,
                "approved_at": r.approved_at,
                "approved_by_admin_name": r.approved_by_admin_name,
                "rejection_reason": r.rejection_reason,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        }

    def approve_purchase_request(self, request_id: UUID, current_admin) -> dict:
        """Approves a pending purchase request, updates payment & approval status, and adds credits."""
        from app.models.ai_credit_purchase_request import AiCreditPurchaseRequest

        req = self.db.scalar(
            select(AiCreditPurchaseRequest).where(AiCreditPurchaseRequest.id == request_id)
        )
        if not req:
            raise HTTPException(status_code=404, detail="Purchase request not found.")

        if req.approval_status != "PENDING":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve request with status '{req.approval_status}'.",
            )

        admin_name = getattr(current_admin, "name", None) or getattr(current_admin, "email", "Super Admin")

        # 1. Update request status
        req.approval_status = "APPROVED"
        req.payment_status = "PAID"
        req.approved_at = datetime.now(timezone.utc)
        req.approved_by_admin_id = current_admin.id
        req.approved_by_admin_name = admin_name

        # 2. Add purchased credits to merchant business
        limit_service = SubscriptionLimitService(self.db)
        res = limit_service.adjust_purchased_credits(
            business_id=req.business_id,
            amount=req.ai_credits,
            reason="Purchase Request Approved",
            notes=f"Approved purchase request for '{req.pack_name}' ({req.ai_credits} Credits for ₹{req.amount}) by {admin_name}",
            current_admin=current_admin,
        )

        # 3. Store in audit log
        audit = AiCreditAuditLog(
            business_id=req.business_id,
            admin_id=current_admin.id,
            action="APPROVED_PURCHASE",
            amount=req.ai_credits,
            reason="Super Admin Approval",
            notes=f"Request #{req.id} approved by {admin_name}",
            previous_balance=res.get("previous_purchased_balance", 0),
            new_balance=res.get("new_purchased_balance", 0),
        )
        self.db.add(audit)
        self.db.commit()

        logger.info("Purchase request %s approved by %s for business %s", request_id, admin_name, req.business_id)

        return {
            "success": True,
            "message": f"Purchase request approved! {req.ai_credits} AI Credits added to {req.business.name if req.business else 'business'}.",
            "request_id": str(req.id),
            "approval_status": req.approval_status,
            "payment_status": req.payment_status,
        }

    def reject_purchase_request(self, request_id: UUID, reason: str, notes: str | None, current_admin) -> dict:
        """Rejects a pending purchase request with a reason."""
        from app.models.ai_credit_purchase_request import AiCreditPurchaseRequest

        req = self.db.scalar(
            select(AiCreditPurchaseRequest).where(AiCreditPurchaseRequest.id == request_id)
        )
        if not req:
            raise HTTPException(status_code=404, detail="Purchase request not found.")

        if req.approval_status != "PENDING":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reject request with status '{req.approval_status}'.",
            )

        admin_name = getattr(current_admin, "name", None) or getattr(current_admin, "email", "Super Admin")
        full_rejection_reason = f"{reason.strip()}{f' - {notes.strip()}' if notes and notes.strip() else ''}"

        req.approval_status = "REJECTED"
        req.payment_status = "FAILED"
        req.rejection_reason = full_rejection_reason

        # Log rejection in audit log
        audit = AiCreditAuditLog(
            business_id=req.business_id,
            admin_id=current_admin.id,
            action="REJECTED_PURCHASE",
            amount=0,
            reason=f"Rejected: {reason}",
            notes=notes,
            previous_balance=0,
            new_balance=0,
        )
        self.db.add(audit)
        self.db.commit()

        logger.info("Purchase request %s rejected by %s: %s", request_id, admin_name, full_rejection_reason)

        return {
            "success": True,
            "message": f"Purchase request rejected: {reason}",
            "request_id": str(req.id),
            "approval_status": req.approval_status,
            "payment_status": req.payment_status,
        }
