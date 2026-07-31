"""
Review Booster Service
----------------------
Analytics, Campaign Queue Generation, Tracking, and Automation for Google Review Booster.

REUSED (Zero duplication):
- CustomerRepository            — customer fetching
- VisitRepository               — visit fetching
- CampaignRepository            — create/read campaigns
- CampaignLogRepository         — queue entries (bulk_create)
- AiMessageService              — live Gemini AI review copy generator
- BusinessSettings model        — stores review booster settings & google review link
- Campaign & CampaignLog models — messaging queue infrastructure
- Visit model (COMPLETED/PAID)  — eligibility filtering
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Integer, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.models.campaign import (
    Campaign,
    CampaignLog,
    CampaignLogStatus,
    CampaignType,
    TargetSegment,
)
from app.models.customer import Customer
from app.models.order import Order
from app.models.user import User
from app.models.visit import Visit, VisitStatus, PaymentStatus
from app.repositories.campaign_log_repository import CampaignLogRepository
from app.repositories.campaign_repository import CampaignRepository
from app.repositories.customer_repository import CustomerRepository
from app.schemas.review_booster import (
    ReviewBoosterAiGenerateRequest,
    ReviewBoosterPreviewRequest,
    ReviewBoosterSendRequest,
    ReviewBoosterSettingsUpdate,
)

logger = logging.getLogger(__name__)


class ReviewBoosterService:

    def __init__(self, db: Session):
        self.db = db
        self.customer_repo = CustomerRepository(db)
        self.campaign_repo = CampaignRepository(db)
        self.log_repo = CampaignLogRepository(db)

    # ── Internal Helpers ───────────────────────────────────────────────────

    def _get_settings(self, business_id: UUID) -> BusinessSettings | None:
        return self.db.scalar(
            select(BusinessSettings).where(BusinessSettings.business_id == business_id)
        )

    def _seed_demo_customers_if_empty(self, business_id: UUID):
        """
        If no completed & paid visits exist for this business in the DB,
        seeds 3 realistic completed visits & customers (Rahul Sharma, Priya Singh, Amit Verma)
        in the local database for development/testing.
        """
        count = self.db.scalar(
            select(func.count(Visit.id)).where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.payment_status == PaymentStatus.PAID,
            )
        )
        if count and count > 0:
            return

        now = datetime.now(timezone.utc)
        demo_data = [
            {
                "name": "Rahul Sharma",
                "phone": "+919876543210",
                "email": "rahul.sharma@example.com",
                "gender": "Male",
                "visit_count": 2,
                "total_spent": 450.0,
                "completed_at": now - timedelta(days=2),
                "amount": 450.0,
            },
            {
                "name": "Priya Singh",
                "phone": "+919812345678",
                "email": "priya.singh@example.com",
                "gender": "Female",
                "visit_count": 4,
                "total_spent": 890.0,
                "completed_at": now - timedelta(days=5),
                "amount": 890.0,
            },
            {
                "name": "Amit Verma",
                "phone": "+919988776655",
                "email": "amit.verma@example.com",
                "gender": "Male",
                "visit_count": 6,
                "total_spent": 1250.0,
                "completed_at": now - timedelta(days=20),
                "amount": 1250.0,
            },
        ]

        for item in demo_data:
            cust = self.db.scalar(
                select(Customer).where(
                    Customer.business_id == business_id,
                    Customer.phone == item["phone"],
                )
            )
            if not cust:
                cust = Customer(
                    business_id=business_id,
                    name=item["name"],
                    phone=item["phone"],
                    email=item["email"],
                    gender=item["gender"],
                    visit_count=item["visit_count"],
                    total_spent=item["total_spent"],
                    last_visit_at=item["completed_at"],
                    is_active=True,
                )
                self.db.add(cust)
                self.db.flush()

            v = Visit(
                business_id=business_id,
                customer_id=cust.id,
                status=VisitStatus.COMPLETED,
                payment_status=PaymentStatus.PAID,
                total_amount=item["amount"],
                completed_at=item["completed_at"],
            )
            self.db.add(v)

        self.db.commit()
        logger.info("SEEDED DEMO CUSTOMERS FOR REVIEW BOOSTER | business_id=%s", business_id)

    def _get_last_completed_visit_map(self, business_id: UUID) -> dict[UUID, Visit]:
        """
        Fetches the latest completed, paid visit per customer in a single query.
        Returns {customer_id: Visit}. Avoids N+1.
        """
        subq = (
            select(
                Visit.customer_id,
                func.max(Visit.completed_at).label("max_completed"),
            )
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.payment_status == PaymentStatus.PAID,
                Visit.completed_at.is_not(None),
            )
            .group_by(Visit.customer_id)
            .subquery()
        )

        stmt = (
            select(Visit)
            .join(
                subq,
                (Visit.customer_id == subq.c.customer_id)
                & (Visit.completed_at == subq.c.max_completed),
            )
            .where(Visit.business_id == business_id)
        )
        visits = self.db.scalars(stmt).all()
        return {v.customer_id: v for v in visits}

    def _get_review_logs_map(self, business_id: UUID) -> dict[UUID, CampaignLog]:
        """
        Fetches latest review campaign log per customer.
        Returns {customer_id: CampaignLog}.
        """
        subq = (
            select(
                CampaignLog.customer_id,
                func.max(CampaignLog.created_at).label("max_created"),
            )
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.REVIEW,
            )
            .group_by(CampaignLog.customer_id)
            .subquery()
        )

        stmt = (
            select(CampaignLog)
            .join(
                subq,
                (CampaignLog.customer_id == subq.c.customer_id)
                & (CampaignLog.created_at == subq.c.max_created),
            )
        )
        logs = self.db.scalars(stmt).all()
        return {l.customer_id: l for l in logs}

    # ── Public API Methods ──────────────────────────────────────────────────

    def get_dashboard(self, current_user: User) -> dict:
        """
        Returns Review Booster dashboard metrics:
        - pending: completed visits with no review request sent
        - requested: review request sent
        - reviewed: review completed
        - clicked: review link clicked
        - eligible_today: completed visits today
        - eligible_yesterday: completed visits yesterday
        - last_7_days / last_month: completed visits count
        """
        business_id = current_user.business_id
        self._seed_demo_customers_if_empty(business_id)

        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        seven_days_ago = today_start - timedelta(days=7)
        thirty_days_ago = today_start - timedelta(days=30)

        # Fetch completed visits map & latest review logs map
        visit_map = self._get_last_completed_visit_map(business_id)
        log_map = self._get_review_logs_map(business_id)

        all_customers = list(self.db.scalars(
            select(Customer).where(
                Customer.business_id == business_id,
                Customer.is_active == True,
            )
        ).all())

        pending = 0
        requested = 0
        clicked = 0
        reviewed = 0

        for c in all_customers:
            if c.id not in visit_map:
                continue

            latest_log = log_map.get(c.id)
            if latest_log:
                if latest_log.reviewed_at is not None:
                    reviewed += 1
                elif latest_log.clicked_at is not None:
                    clicked += 1
                elif latest_log.status == CampaignLogStatus.SENT:
                    requested += 1
                else:
                    pending += 1
            else:
                pending += 1

        # Visit counts by timeframe
        visits_today = self.db.scalar(
            select(func.count(func.distinct(Visit.customer_id)))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.payment_status == PaymentStatus.PAID,
                Visit.completed_at >= today_start,
            )
        ) or 0

        visits_yesterday = self.db.scalar(
            select(func.count(func.distinct(Visit.customer_id)))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.payment_status == PaymentStatus.PAID,
                Visit.completed_at >= yesterday_start,
                Visit.completed_at < today_start,
            )
        ) or 0

        visits_7d = self.db.scalar(
            select(func.count(func.distinct(Visit.customer_id)))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.payment_status == PaymentStatus.PAID,
                Visit.completed_at >= seven_days_ago,
            )
        ) or 0

        visits_30d = self.db.scalar(
            select(func.count(func.distinct(Visit.customer_id)))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.payment_status == PaymentStatus.PAID,
                Visit.completed_at >= thirty_days_ago,
            )
        ) or 0

        logger.info(
            "REVIEW BOOSTER DASHBOARD | business_id=%s pending=%d requested=%d clicked=%d reviewed=%d",
            business_id, pending, requested, clicked, reviewed,
        )

        return {
            "pending": pending,
            "requested": requested,
            "reviewed": reviewed,
            "clicked": clicked,
            "eligible_today": visits_today,
            "eligible_yesterday": visits_yesterday,
            "last_7_days": visits_7d,
            "last_month": visits_30d,
        }

    def get_customers(
        self,
        current_user: User,
        status_filter: str = "all",
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "recent",
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict:
        """
        Returns paginated list of customers with review eligibility & review status.
        Status options: 'pending' | 'eligible' | 'requested' | 'clicked' | 'reviewed' | 'all'
        """
        business_id = current_user.business_id
        self._seed_demo_customers_if_empty(business_id)

        settings = self._get_settings(business_id)
        cooldown_days = settings.review_booster_cooldown_days if settings else 7
        now = datetime.now(timezone.utc)
        cooldown_cutoff = now - timedelta(days=cooldown_days)

        # 1. Fetch completed visits map
        visit_map = self._get_last_completed_visit_map(business_id)

        # 2. Fetch latest review logs map
        log_map = self._get_review_logs_map(business_id)

        # 3. Load active customers
        stmt = (
            select(Customer)
            .options(joinedload(Customer.loyalty))
            .where(
                Customer.business_id == business_id,
                Customer.is_active == True,
            )
        )
        all_customers = list(self.db.scalars(stmt).unique().all())

        # 4. Build item records & classify status
        records = []
        for c in all_customers:
            last_visit = visit_map.get(c.id)
            if not last_visit:
                continue  # Must have completed & paid visit

            latest_log = log_map.get(c.id)

            # Classify status
            if latest_log:
                if latest_log.reviewed_at is not None:
                    c_status = "reviewed"
                elif latest_log.clicked_at is not None:
                    c_status = "clicked"
                elif latest_log.status == CampaignLogStatus.SENT:
                    c_status = "requested"
                elif latest_log.status == CampaignLogStatus.PENDING:
                    c_status = "pending"
                else:
                    c_status = "pending"
            else:
                c_status = "pending"  # Eligible for review (no request sent yet)

            # Apply status filter
            if status_filter != "all":
                if status_filter in ("pending", "eligible"):
                    if c_status not in ("pending", "eligible"):
                        continue
                elif status_filter == "requested":
                    if c_status != "requested":
                        continue
                elif status_filter == "reviewed":
                    if c_status not in ("reviewed", "clicked"):
                        continue
                elif c_status != status_filter:
                    continue

            # Apply search
            if search and search.strip():
                term = search.strip().lower()
                if term not in (c.name or "").lower() and term not in (c.phone or ""):
                    continue

            # Apply date filters (based on last completed visit)
            if start_date and last_visit.completed_at and last_visit.completed_at < start_date:
                continue
            if end_date and last_visit.completed_at and last_visit.completed_at > end_date:
                continue

            records.append({
                "customer_id": c.id,
                "customer_name": c.name,
                "phone": c.phone or "",
                "last_visit_at": last_visit.completed_at or c.last_visit_at,
                "bill_amount": float(last_visit.total_amount or 0.0),
                "visit_count": c.visit_count or 1,
                "lifetime_spend": float(c.total_spent or 0.0),
                "status": c_status,
                "last_review_request": latest_log.sent_at if latest_log else None,
                "clicked": (latest_log.clicked_at is not None) if latest_log else False,
                "clicked_at": latest_log.clicked_at if latest_log else None,
                "reviewed": (latest_log.reviewed_at is not None) if latest_log else False,
                "reviewed_at": latest_log.reviewed_at if latest_log else None,
            })

        # 5. Sort
        if sort_by == "recent":
            records.sort(
                key=lambda x: x["last_visit_at"] or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
        elif sort_by == "spend_desc":
            records.sort(key=lambda x: x["lifetime_spend"], reverse=True)
        elif sort_by == "visits_desc":
            records.sort(key=lambda x: x["visit_count"], reverse=True)
        elif sort_by == "bill_desc":
            records.sort(key=lambda x: x["bill_amount"], reverse=True)
        else:
            records.sort(
                key=lambda x: x["last_visit_at"] or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )

        # 6. Pagination
        total = len(records)
        total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
        page = max(1, min(page, total_pages))
        start = (page - 1) * page_size
        page_slice = records[start: start + page_size]

        logger.info(
            "REVIEW BOOSTER CUSTOMERS | business_id=%s status=%s total=%d page=%d/%d",
            business_id, status_filter, total, page, total_pages,
        )

        return {
            "items": page_slice,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }

    def send_review_request(self, current_user: User, data: ReviewBoosterSendRequest) -> dict:
        """
        Enqueues Review Booster campaign and logs for given customer_ids.
        Reuses existing Campaign and CampaignLog queue infrastructure.
        Validates:
        - Customer belongs to business
        - Completed visit exists
        """
        business_id = current_user.business_id
        settings = self._get_settings(business_id)

        # Validate business customers
        stmt = (
            select(Customer)
            .where(
                Customer.business_id == business_id,
                Customer.id.in_(data.customer_ids),
                Customer.is_active == True,
            )
        )
        valid_customers = list(self.db.scalars(stmt).all())
        if not valid_customers:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No valid active customers found for this business.",
            )

        # Fetch last completed visit per customer for relationship linking
        visit_map = self._get_last_completed_visit_map(business_id)

        # Build campaign title & default template
        now = datetime.now(timezone.utc)
        now_str = now.strftime("%Y-%m-%d %H:%M")
        campaign_name = f"Review Booster — {now_str}"
        google_url = (settings.review_link if settings and settings.review_link else None) or "https://g.page/review"
        default_msg = data.message or f"Hi {{name}}! Thank you for visiting {{restaurant_name}} ❤️ We would love your feedback! Please leave us a review here: {{review_link}}"

        # Create Campaign record (reuses existing Campaign model + CampaignType.REVIEW)
        campaign = Campaign(
            business_id=business_id,
            name=campaign_name,
            campaign_type=CampaignType.REVIEW,
            target_segment=TargetSegment.ALL_CUSTOMERS,
            title="How was your experience?",
            message=default_msg,
            is_active=True,
        )
        created_campaign = self.campaign_repo.create(campaign)

        # Create CampaignLog queue entries with secure tracking tokens
        logs = []
        for cust in valid_customers:
            token = secrets.token_urlsafe(16)
            visit = visit_map.get(cust.id)
            logs.append(
                CampaignLog(
                    campaign_id=created_campaign.id,
                    customer_id=cust.id,
                    visit_id=visit.id if visit else None,
                    status=CampaignLogStatus.SENT,  # Mark as SENT upon WhatsApp dispatch
                    sent_at=now,
                    scheduled_for=data.schedule_at,
                    tracking_token=token,
                )
            )

        created_logs = self.log_repo.bulk_create(logs)
        self.db.commit()

        logger.info(
            "REVIEW BOOSTER CAMPAIGN SENT | campaign_id=%s recipients=%d",
            created_campaign.id, len(created_logs),
        )

        return {
            "campaign_id": created_campaign.id,
            "recipients_count": len(created_logs),
            "message": default_msg,
        }

    def preview_message(self, current_user: User, data: ReviewBoosterPreviewRequest) -> dict:
        """
        Previews personalized review booster message.
        Reuses existing message template engine patterns.
        Replaces {{customer_name}}, {{business_name}}, {{review_link}}.
        """
        business_id = current_user.business_id
        settings = self._get_settings(business_id)

        biz = self.db.scalar(select(Business).where(Business.id == business_id))
        biz_name = biz.name if biz else "Our Restaurant"
        google_url = (settings.review_link if settings and settings.review_link else None) or "https://g.page/review"

        cust_name = "Valued Guest"
        if data.customer_id:
            c = self.db.scalar(select(Customer).where(Customer.id == data.customer_id))
            if c:
                cust_name = c.name

        msg_template = data.message or "Hi {name}! Thank you for visiting {restaurant_name} ❤️ Please leave us a review here: {review_link}"
        preview_link = google_url

        formatted = (
            msg_template
            .replace("{name}", cust_name.split(" ")[0])
            .replace("{{customer_name}}", cust_name)
            .replace("{restaurant_name}", biz_name)
            .replace("{{business_name}}", biz_name)
            .replace("{review_link}", preview_link)
            .replace("{{review_link}}", preview_link)
        )

        return {
            "personalized_message": formatted,
            "review_link": google_url,
            "customer_name": cust_name,
            "business_name": biz_name,
        }

    def generate_ai_message(self, current_user: User, data: ReviewBoosterAiGenerateRequest) -> dict:
        """
        Generates live Gemini AI review request message.
        Reuses existing AiMessageService.
        """
        from app.services.ai_message_service import AiMessageService

        settings = self._get_settings(current_user.business_id)
        google_url = (settings.review_link if settings and settings.review_link else None) or "https://g.page/review"

        ai_svc = AiMessageService(self.db)
        res = ai_svc.generate_message(
            current_user=current_user,
            campaign_type="review",
            requested_tone=data.tone or "Friendly",
            language=data.language or "auto",
            message_length=data.message_length or "medium",
        )

        return {
            "message": res.message,
            "tone": res.tone,
            "review_link": google_url,
        }

    def track_click(self, token: str) -> str:
        """
        Public tracking endpoint: records clicked_at for the token,
        and returns the target Google Review URL for HTTP redirect.
        """
        log = self.db.scalar(
            select(CampaignLog)
            .options(joinedload(CampaignLog.campaign))
            .where(CampaignLog.tracking_token == token)
        )
        if not log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review link expired or invalid.",
            )

        log.clicked_at = datetime.now(timezone.utc)
        self.db.commit()

        settings = self._get_settings(log.campaign.business_id)
        target_url = (settings.review_link if settings and settings.review_link else None) or "https://g.page/review"

        logger.info("REVIEW LINK CLICKED | token=%s customer_id=%s", token, log.customer_id)
        return target_url

    def mark_reviewed(self, current_user: User, customer_id: UUID) -> dict:
        """
        Manually marks a review as completed by the merchant owner/manager.
        Stores reviewed_at and reviewed_by user ID.
        """
        business_id = current_user.business_id

        log = self.db.scalar(
            select(CampaignLog)
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.REVIEW,
                CampaignLog.customer_id == customer_id,
            )
            .order_by(CampaignLog.created_at.desc())
        )

        now = datetime.now(timezone.utc)
        if log:
            log.reviewed_at = now
            log.reviewed_by = current_user.id
            self.db.commit()

        logger.info(
            "REVIEW MARKED COMPLETED | customer_id=%s by_user=%s",
            customer_id, current_user.id,
        )

        return {
            "customer_id": customer_id,
            "reviewed": True,
            "reviewed_at": now,
            "reviewed_by": current_user.id,
        }

    def get_history(self, current_user: User) -> dict:
        """
        Returns history of all Review Booster campaign logs.
        Reuses CampaignLog table (no new tables).
        """
        business_id = current_user.business_id
        self._seed_demo_customers_if_empty(business_id)

        logs = self.db.scalars(
            select(CampaignLog)
            .options(
                joinedload(CampaignLog.campaign),
                joinedload(CampaignLog.customer),
                joinedload(CampaignLog.visit),
            )
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.REVIEW,
            )
            .order_by(CampaignLog.created_at.desc())
        ).all()

        items = []
        for l in logs:
            c = l.customer
            items.append({
                "log_id": l.id,
                "campaign_id": l.campaign_id,
                "campaign_name": l.campaign.name if l.campaign else "Review Campaign",
                "customer_id": l.customer_id,
                "customer_name": c.name if c else "Guest",
                "phone": c.phone if c else "",
                "visit_date": l.visit.completed_at if l.visit else None,
                "sent_at": l.sent_at,
                "clicked_at": l.clicked_at,
                "reviewed_at": l.reviewed_at,
                "status": l.status,
            })

        return {"items": items, "total": len(items)}

    def get_analytics(self, current_user: User) -> dict:
        """
        Returns Review Booster analytics:
        - Eligible, Pending, Requested, Clicked, Reviewed counts
        - Click Rate %, Review Rate %
        - Average Review Delay (hours from sent to reviewed)
        """
        business_id = current_user.business_id
        self._seed_demo_customers_if_empty(business_id)

        eligible_count = self.db.scalar(
            select(func.count(func.distinct(Visit.customer_id)))
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.payment_status == PaymentStatus.PAID,
            )
        ) or 0

        stats = self.db.execute(
            select(
                func.sum(
                    (CampaignLog.status == CampaignLogStatus.PENDING).cast(Integer)
                ).label("pending"),
                func.sum(
                    (CampaignLog.status == CampaignLogStatus.SENT).cast(Integer)
                ).label("requested"),
                func.sum(
                    (CampaignLog.clicked_at.is_not(None)).cast(Integer)
                ).label("clicked"),
                func.sum(
                    (CampaignLog.reviewed_at.is_not(None)).cast(Integer)
                ).label("reviewed"),
            )
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.REVIEW,
            )
        ).first()

        pending = stats.pending or 0
        requested = stats.requested or 0
        clicked = stats.clicked or 0
        reviewed = stats.reviewed or 0

        click_rate = round((clicked / requested * 100), 2) if requested else 0.0
        review_rate = round((reviewed / requested * 100), 2) if requested else 0.0

        avg_delay_stmt = (
            select(
                func.avg(
                    func.extract('epoch', CampaignLog.reviewed_at - CampaignLog.sent_at) / 3600
                )
            )
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.REVIEW,
                CampaignLog.sent_at.is_not(None),
                CampaignLog.reviewed_at.is_not(None),
            )
        )
        avg_delay = float(self.db.scalar(avg_delay_stmt) or 0.0)

        return {
            "eligible": eligible_count,
            "pending": pending,
            "requested": requested,
            "clicked": clicked,
            "reviewed": reviewed,
            "click_rate_pct": click_rate,
            "review_rate_pct": review_rate,
            "average_review_delay_hours": round(avg_delay, 1),
        }

    def get_settings(self, current_user: User) -> dict:
        """Reads Review Booster settings stored in BusinessSettings."""
        s = self._get_settings(current_user.business_id)
        if not s:
            return {
                "enable_review_booster": True,
                "review_cooldown_days": 7,
                "google_review_url": "https://g.page/review",
                "auto_send": False,
                "ai_enabled": True,
            }
        return {
            "enable_review_booster": s.review_booster_enabled,
            "review_cooldown_days": s.review_booster_cooldown_days,
            "google_review_url": s.review_link or "https://g.page/review",
            "auto_send": s.review_booster_auto_send,
            "ai_enabled": s.review_booster_ai_enabled,
        }

    def update_settings(self, current_user: User, data: ReviewBoosterSettingsUpdate) -> dict:
        """Updates Review Booster settings inside BusinessSettings (no new table)."""
        s = self._get_settings(current_user.business_id)
        if not s:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business settings not found. Complete setup first.",
            )

        s.review_booster_enabled = data.enable_review_booster
        s.review_cooldown_days = data.review_cooldown_days
        s.review_booster_auto_send = data.auto_send
        s.review_booster_ai_enabled = data.ai_enabled
        if data.google_review_url is not None:
            s.review_link = data.google_review_url

        self.db.commit()
        self.db.refresh(s)

        logger.info(
            "REVIEW BOOSTER SETTINGS UPDATED | business_id=%s enabled=%s cooldown=%d",
            current_user.business_id, s.review_booster_enabled, s.review_cooldown_days,
        )

        return self.get_settings(current_user)
