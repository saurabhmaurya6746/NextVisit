import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignLog, CampaignLogStatus, CampaignType, TargetSegment
from app.models.customer import Customer
from app.models.user import User
from app.repositories.campaign_execution_repository import (
    CampaignExecutionRepository,
)
from app.schemas.campaign_execution import CampaignLogItemResponse, CampaignLogRecordSendRequest

logger = logging.getLogger(__name__)


def _format_log_item(log: CampaignLog) -> CampaignLogItemResponse:
    campaign_name = log.campaign.name if log.campaign else "Unknown Campaign"
    campaign_type = (
        log.campaign.campaign_type if log.campaign else CampaignType.CUSTOM
    )
    message = log.campaign.message if log.campaign else ""
    customer_name = log.customer.name if log.customer else "Unknown Customer"
    customer_phone = log.customer.phone if log.customer else ""

    return CampaignLogItemResponse(
        id=log.id,
        campaign_id=log.campaign_id,
        campaign_name=campaign_name,
        campaign_type=campaign_type,
        customer_id=log.customer_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        message=message,
        status=log.status,
        scheduled_for=log.scheduled_for,
        sent_at=log.sent_at,
        failure_reason=log.failure_reason,
        created_at=log.created_at,
    )


class CampaignExecutionService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = CampaignExecutionRepository(db)

    def list_pending_logs(
        self, current_user: User
    ) -> list[CampaignLogItemResponse]:
        logger.info(
            "Listing pending campaign logs | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        logs = self.repo.get_pending_logs(current_user.business_id)
        return [_format_log_item(log) for log in logs]

    def list_sent_logs(
        self, current_user: User
    ) -> list[CampaignLogItemResponse]:
        logger.info(
            "Listing sent campaign logs | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        logs = self.repo.get_sent_logs(current_user.business_id)
        return [_format_log_item(log) for log in logs]

    def list_failed_logs(
        self, current_user: User
    ) -> list[CampaignLogItemResponse]:
        logger.info(
            "Listing failed campaign logs | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        logs = self.repo.get_failed_logs(current_user.business_id)
        return [_format_log_item(log) for log in logs]

    def mark_sent(
        self, current_user: User, log_id: UUID
    ) -> CampaignLogItemResponse:
        logger.info(
            "Marking campaign log SENT | log_id=%s requested_by=%s",
            log_id,
            current_user.id,
        )
        log = self.repo.get_log_by_id(log_id)
        if not log or not log.campaign or log.campaign.business_id != current_user.business_id:
            logger.warning(
                "Campaign log not found or tenant mismatch | log_id=%s business_id=%s",
                log_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign log not found.",
            )

        if log.status == CampaignLogStatus.SENT:
            return _format_log_item(log)

        if log.status != CampaignLogStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PENDING campaign logs can be marked SENT.",
            )

        log.status = CampaignLogStatus.SENT
        log.sent_at = datetime.now(timezone.utc)
        self.repo.update_log(log)
        self.db.commit()
        self.db.refresh(log)

        logger.info(
            "Campaign log marked SENT successfully | log_id=%s business_id=%s",
            log.id,
            current_user.business_id,
        )
        return _format_log_item(log)

    def mark_failed(
        self, current_user: User, log_id: UUID, failure_reason: str | None = None
    ) -> CampaignLogItemResponse:
        logger.info(
            "Marking campaign log FAILED | log_id=%s requested_by=%s",
            log_id,
            current_user.id,
        )
        log = self.repo.get_log_by_id(log_id)
        if not log or not log.campaign or log.campaign.business_id != current_user.business_id:
            logger.warning(
                "Campaign log not found or tenant mismatch | log_id=%s business_id=%s",
                log_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign log not found.",
            )

        if log.status != CampaignLogStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PENDING campaign logs can be marked FAILED.",
            )

        log.status = CampaignLogStatus.FAILED
        log.failure_reason = failure_reason or "Unknown execution error"
        self.repo.update_log(log)
        self.db.commit()
        self.db.refresh(log)

        logger.info(
            "Campaign log marked FAILED successfully | log_id=%s business_id=%s",
            log.id,
            current_user.business_id,
        )
        return _format_log_item(log)

    def record_send(
        self, current_user: User, data: CampaignLogRecordSendRequest
    ) -> dict:
        biz_id = current_user.business_id
        
        # 1. Verify Customer
        customer = self.db.scalar(
            select(Customer).where(Customer.id == data.customer_id, Customer.business_id == biz_id)
        )
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found in your business.",
            )

        # 2. Map CampaignType
        camp_type_str = (data.campaign_type or "WELCOME").upper()
        try:
            camp_type_enum = CampaignType(camp_type_str)
        except Exception:
            camp_type_enum = CampaignType.CUSTOM

        # 3. Find or Create System Campaign for business & campaign_type
        campaign = None
        if data.campaign_id:
            campaign = self.db.scalar(
                select(Campaign).where(Campaign.id == data.campaign_id, Campaign.business_id == biz_id)
            )

        if not campaign:
            sys_camp_name = f"__system_{camp_type_enum.value.lower()}__"
            campaign = self.db.scalar(
                select(Campaign).where(
                    Campaign.business_id == biz_id,
                    Campaign.name == sys_camp_name,
                )
            )
            if not campaign:
                campaign = Campaign(
                    business_id=biz_id,
                    name=sys_camp_name,
                    campaign_type=camp_type_enum,
                    target_segment=TargetSegment.ALL_CUSTOMERS,
                    title=f"System {camp_type_enum.value.capitalize()} Campaign",
                    message=data.message or f"WhatsApp {camp_type_enum.value.capitalize()} message sent",
                    is_active=True,
                )
                self.db.add(campaign)
                self.db.flush()

        # 4. Upsert CampaignLog
        now_ts = datetime.now(timezone.utc)
        existing_log = self.db.scalar(
            select(CampaignLog).where(
                CampaignLog.campaign_id == campaign.id,
                CampaignLog.customer_id == data.customer_id,
            )
        )

        if existing_log:
            existing_log.status = CampaignLogStatus.SENT
            existing_log.sent_at = now_ts
            if data.message:
                existing_log.sent_message = data.message
            if data.coupon_code:
                existing_log.coupon_code = data.coupon_code
            existing_log.sent_by_user_id = current_user.id
            log_obj = existing_log
        else:
            log_obj = CampaignLog(
                campaign_id=campaign.id,
                customer_id=data.customer_id,
                status=CampaignLogStatus.SENT,
                sent_at=now_ts,
                sent_message=data.message,
                coupon_code=data.coupon_code,
                sent_by_user_id=current_user.id,
            )
            self.db.add(log_obj)

        # Fallback check for welcome campaign notes
        if camp_type_enum == CampaignType.WELCOME:
            if not customer.notes:
                customer.notes = "welcome message sent"
            elif "welcome" not in customer.notes.lower():
                customer.notes = f"{customer.notes} | welcome message sent"

        self.db.commit()
        self.db.refresh(log_obj)

        logger.info(
            "RECORD CAMPAIGN SEND | biz=%s cust=%s type=%s log_id=%s sent_by=%s",
            biz_id, customer.id, camp_type_enum.value, log_obj.id, current_user.id,
        )

        return {
            "success": True,
            "log_id": str(log_obj.id),
            "customer_id": str(data.customer_id),
            "status": "SENT",
            "sent_at": log_obj.sent_at.isoformat(),
            "sent_by": current_user.name,
            "message_type": camp_type_enum.value,
        }

    def get_campaign_history(
        self,
        current_user: User,
        page: int = 1,
        limit: int = 10,
        search: str | None = None,
        campaign_type: str | None = None,
        status_filter: str | None = None,
        date_range: str | None = None,
        sort: str | None = "newest",
    ) -> dict:
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import func, or_, select
        from sqlalchemy.orm import joinedload
        from app.models.business import Business

        biz_id = current_user.business_id
        business = self.db.scalar(select(Business).where(Business.id == biz_id))
        biz_name = business.name if business else "My Business"
        if business and business.business_type:
            bt = business.business_type
            biz_type = str(getattr(bt, "name", getattr(bt, "value", str(bt)))).lower()
        else:
            biz_type = "restaurant"

        stmt = (
            select(CampaignLog)
            .options(
                joinedload(CampaignLog.campaign),
                joinedload(CampaignLog.customer),
                joinedload(CampaignLog.sender),
            )
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .where(Campaign.business_id == biz_id)
        )

        # Campaign Type Filter
        if campaign_type and campaign_type.lower() != "all":
            c_type_upper = campaign_type.upper()
            stmt = stmt.where(Campaign.campaign_type == c_type_upper)

        # Status Filter
        if status_filter and status_filter.lower() != "all":
            st_upper = status_filter.upper()
            stmt = stmt.where(CampaignLog.status == st_upper)

        # Date Range Filter
        now = datetime.now(timezone.utc)
        if date_range == "today":
            start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            stmt = stmt.where(CampaignLog.created_at >= start_of_today)
        elif date_range == "week":
            start_of_week = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())
            stmt = stmt.where(CampaignLog.created_at >= start_of_week)
        elif date_range == "month":
            start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            stmt = stmt.where(CampaignLog.created_at >= start_of_month)

        # Search Filter (Name, Phone, Message, Coupon, Campaign Type)
        if search and search.strip():
            term = f"%{search.strip()}%"
            stmt = stmt.join(Customer, CampaignLog.customer_id == Customer.id).where(
                or_(
                    Customer.name.ilike(term),
                    Customer.phone.ilike(term),
                    CampaignLog.sent_message.ilike(term),
                    CampaignLog.coupon_code.ilike(term),
                    Campaign.message.ilike(term),
                    Campaign.name.ilike(term),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_items = self.db.scalar(count_stmt) or 0

        # Sorting
        if sort == "oldest":
            stmt = stmt.order_by(CampaignLog.created_at.asc())
        else:
            stmt = stmt.order_by(CampaignLog.created_at.desc())

        # Pagination
        total_pages = max(1, (total_items + limit - 1) // limit) if total_items > 0 else 1
        page = max(1, min(page, total_pages))
        offset = (page - 1) * limit

        stmt = stmt.offset(offset).limit(limit)
        logs = list(self.db.scalars(stmt).unique().all())

        items = []
        for l in logs:
            cust = l.customer
            c_name = cust.name if cust else "Guest"
            c_phone = cust.phone if cust else "—"
            c_email = cust.email if cust else None

            msg = l.sent_message or (l.campaign.message if l.campaign else "WhatsApp Notification")
            preview = (msg[:60] + "...") if len(msg) > 65 else msg

            sender_name = l.sender.name if l.sender else current_user.name
            sender_role = str(l.sender.role.value if (l.sender and hasattr(l.sender.role, 'value')) else (l.sender.role if l.sender else current_user.role))

            c_type = l.campaign.campaign_type.value if (l.campaign and hasattr(l.campaign.campaign_type, 'value')) else (l.campaign.campaign_type if l.campaign else "CUSTOM")

            items.append({
                "id": l.id,
                "customer_id": l.customer_id,
                "customer_name": c_name,
                "customer_phone": c_phone,
                "customer_email": c_email,
                "business_id": biz_id,
                "business_name": biz_name,
                "business_type": biz_type,
                "campaign_id": l.campaign_id,
                "campaign_name": l.campaign.name if l.campaign else "System Campaign",
                "campaign_type": str(c_type),
                "message": msg,
                "message_preview": preview,
                "coupon_code": l.coupon_code,
                "status": str(l.status.value if hasattr(l.status, 'value') else l.status),
                "sent_by": sender_name,
                "sent_by_role": sender_role,
                "created_at": l.created_at,
                "sent_at": l.sent_at or l.created_at,
            })

        return {
            "items": items,
            "total": total_items,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }
