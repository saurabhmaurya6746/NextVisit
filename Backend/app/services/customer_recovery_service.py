"""
Customer Recovery Service
--------------------------
Analytics + Campaign generation for recovering dormant customers.

REUSED (no duplication):
- CustomerRepository              — customer queries
- CustomerSegmentationRepository  — get_inactive_customers()
- CampaignRepository              — create / get campaigns
- CampaignLogRepository           — bulk_create logs (queue)
- CampaignType.RECOVERY           — existing enum value
- TargetSegment.INACTIVE_*        — existing enum values
- CampaignLogStatus               — PENDING / SENT / FAILED
- Visit model (VisitStatus.COMPLETED) — accurate last-visit date
- Customer model                  — total_spent, visit_count, last_visit_at
- OrderItem model                 — favorite item from order history

NEW:
- get_dashboard()        — bucket counts from DB
- get_customers()        — paginated recoverable customer list
- get_analytics()        — revenue, rate, ROI
- launch_campaign()      — create Campaign + bulk CampaignLog queue
- get_preview()          — preview before launching
- get_suggested_offers() — static offer list
- get_history()          — past recovery campaigns with outcomes
- get_settings()         — read recovery settings
- update_settings()      — write recovery settings
"""
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Integer, func, select
from sqlalchemy.orm import Session, joinedload

from app.models.business_settings import BusinessSettings
from app.models.campaign import (
    Campaign,
    CampaignLog,
    CampaignLogStatus,
    CampaignType,
    TargetSegment,
)
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.visit import Visit, VisitStatus
from app.models.user import User
from app.repositories.campaign_log_repository import CampaignLogRepository
from app.repositories.campaign_repository import CampaignRepository
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer_recovery import (
    RecoveryLaunchRequest,
    RecoverySettingsUpdate,
)

logger = logging.getLogger(__name__)

VALID_BUCKETS = {15, 30, 45, 60, 90}


class CustomerRecoveryService:

    def __init__(self, db: Session):
        self.db = db
        self.customer_repo = CustomerRepository(db)
        self.campaign_repo = CampaignRepository(db)
        self.log_repo = CampaignLogRepository(db)

    # ── Internal helpers ────────────────────────────────────────────────────

    def _get_settings(self, business_id: UUID) -> BusinessSettings | None:
        return self.db.scalar(
            select(BusinessSettings).where(BusinessSettings.business_id == business_id)
        )

    def _get_last_completed_visit_per_customer(self, business_id: UUID) -> dict[UUID, datetime]:
        """
        Single efficient query: for each customer of this business, find the
        max(completed_at) from Visit WHERE status = COMPLETED.
        Returns {customer_id: last_completed_visit_dt}.
        Avoids N+1 entirely — one query for all customers.
        """
        stmt = (
            select(
                Visit.customer_id,
                func.max(Visit.completed_at).label("last_completed"),
            )
            .where(
                Visit.business_id == business_id,
                Visit.status == VisitStatus.COMPLETED,
                Visit.completed_at.is_not(None),
            )
            .group_by(Visit.customer_id)
        )
        rows = self.db.execute(stmt).all()
        return {row.customer_id: row.last_completed for row in rows}

    def _get_favorite_items(self, business_id: UUID, customer_ids: list[UUID]) -> dict[UUID, str]:
        """
        Single query: aggregate order_items by customer → return top item per customer.
        Reuses Order + OrderItem models. No N+1.
        """
        if not customer_ids:
            return {}
        stmt = (
            select(
                Order.customer_id,
                OrderItem.item_name,
                func.sum(OrderItem.quantity).label("qty"),
            )
            .join(OrderItem, OrderItem.order_id == Order.id)
            .where(
                Order.business_id == business_id,
                Order.customer_id.in_(customer_ids),
            )
            .group_by(Order.customer_id, OrderItem.item_name)
            .order_by(Order.customer_id, func.sum(OrderItem.quantity).desc())
        )
        rows = self.db.execute(stmt).all()
        fav: dict[UUID, str] = {}
        for row in rows:
            if row.customer_id not in fav:
                fav[row.customer_id] = row.item_name
        return fav

    def _classify_bucket(self, days: int) -> str:
        """Maps integer days to bucket label."""
        if days >= 90:
            return "90_days"
        if days >= 60:
            return "60_days"
        if days >= 45:
            return "45_days"
        if days >= 30:
            return "30_days"
        return "15_days"

    def _get_recoverable_customers(
        self,
        business_id: UUID,
        bucket: int | None = None,
        search: str | None = None,
    ) -> list[dict]:
        """
        Core engine: fetches all active customers that qualify as recoverable.
        Uses last *completed* visit date (ignores cancelled visits).
        If bucket is specified, only returns customers in that bucket window.
        Returns enriched dicts — avoids ORM object mutation.
        """
        from app.models.campaign import Campaign as _Camp, CampaignLog as _CLog, CampaignType as _CType

        now = datetime.now(timezone.utc)

        # Fetch IDs of customers manually recovered or excluded
        skip_ids: set[UUID] = set()
        for special_name in ["__manual_recovered__", "__recovery_excluded__"]:
            special_camp = self.db.scalar(
                select(_Camp).where(
                    _Camp.business_id == business_id,
                    _Camp.name == special_name,
                )
            )
            if special_camp:
                logs = self.db.scalars(
                    select(_CLog.customer_id).where(
                        _CLog.campaign_id == special_camp.id
                    )
                ).all()
                skip_ids.update(logs)

        # 1. Load last completed visit per customer (single query)
        last_visit_map = self._get_last_completed_visit_per_customer(business_id)

        # 2. Load all active customers with loyalty (single query via joinedload)
        stmt = (
            select(Customer)
            .options(joinedload(Customer.loyalty))
            .where(
                Customer.business_id == business_id,
                Customer.is_active == True,
            )
        )
        all_customers = list(self.db.scalars(stmt).unique().all())

        # 3. Filter: only those whose last COMPLETED visit >= 15 days ago
        recoverable = []
        for c in all_customers:
            # Skip manually recovered or excluded customers
            if c.id in skip_ids:
                continue

            last_dt = last_visit_map.get(c.id)
            if last_dt is None:
                continue  # No completed visit → not a churned customer, skip

            # Make timezone-aware if naive
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)

            days_since = (now - last_dt).days
            if days_since < 15:
                continue  # Recently visited — not recoverable

            # Apply bucket filter if specified
            if bucket is not None:
                bucket_lower = {15: 15, 30: 30, 45: 45, 60: 60, 90: 90}[bucket]
                bucket_next = {15: 30, 30: 45, 45: 60, 60: 90, 90: 99999}[bucket]
                if not (bucket_lower <= days_since < bucket_next):
                    continue

            # Apply search
            if search and search.strip():
                term = search.strip().lower()
                if term not in (c.name or "").lower() and term not in (c.phone or ""):
                    continue

            recoverable.append({
                "customer": c,
                "last_visit_at": last_dt,
                "days_since": days_since,
            })

        return recoverable

    # ── Public API methods ───────────────────────────────────────────────────

    def get_dashboard(self, current_user: User) -> dict:
        """
        Returns customer counts per bucket.
        Uses completed visits only (not cancelled).
        """
        business_id = current_user.business_id
        now = datetime.now(timezone.utc)

        last_visit_map = self._get_last_completed_visit_per_customer(business_id)

        # Load active customers
        stmt = (
            select(Customer.id, Customer.last_visit_at)
            .where(Customer.business_id == business_id, Customer.is_active == True)
        )
        rows = self.db.execute(stmt).all()

        counts = {"15_days": 0, "30_days": 0, "45_days": 0, "60_days": 0, "90_days": 0}

        for row in rows:
            last_dt = last_visit_map.get(row.id)
            if last_dt is None:
                continue
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            days = (now - last_dt).days
            if days < 15:
                continue
            if 15 <= days < 30:
                counts["15_days"] += 1
            elif 30 <= days < 45:
                counts["30_days"] += 1
            elif 45 <= days < 60:
                counts["45_days"] += 1
            elif 60 <= days < 90:
                counts["60_days"] += 1
            elif days >= 90:
                counts["90_days"] += 1

        total = sum(counts.values())

        logger.info(
            "RECOVERY DASHBOARD | business_id=%s buckets=%s total=%d",
            business_id, counts, total,
        )

        return {
            "15_days": {"count": counts["15_days"]},
            "30_days": {"count": counts["30_days"]},
            "45_days": {"count": counts["45_days"]},
            "60_days": {"count": counts["60_days"]},
            "90_days": {"count": counts["90_days"]},
            "total_recoverable": total,
        }

    def get_customers(
        self,
        current_user: User,
        bucket: int,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        sort_by: str = "days_desc",
    ) -> dict:
        """
        Returns paginated list of recoverable customers for a given bucket.
        Each customer includes: last visit, days since visit, spend, visits, points, favorite item, VIP flag.
        """
        if bucket not in VALID_BUCKETS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid bucket. Must be one of: {sorted(VALID_BUCKETS)}",
            )

        business_id = current_user.business_id
        recoverable = self._get_recoverable_customers(business_id, bucket, search)

        # Sort
        if sort_by == "days_desc":
            recoverable.sort(key=lambda x: x["days_since"], reverse=True)
        elif sort_by == "days_asc":
            recoverable.sort(key=lambda x: x["days_since"])
        elif sort_by == "spend_desc":
            recoverable.sort(key=lambda x: float(x["customer"].total_spent or 0), reverse=True)
        elif sort_by == "spend_asc":
            recoverable.sort(key=lambda x: float(x["customer"].total_spent or 0))
        elif sort_by == "visits_desc":
            recoverable.sort(key=lambda x: x["customer"].visit_count or 0, reverse=True)
        else:
            recoverable.sort(key=lambda x: x["days_since"], reverse=True)

        total = len(recoverable)
        total_pages = max(1, (total + page_size - 1) // page_size)
        page = max(1, min(page, total_pages))
        start = (page - 1) * page_size
        page_slice = recoverable[start: start + page_size]

        # Batch fetch favorite items for this page only
        page_customer_ids = [r["customer"].id for r in page_slice]
        fav_map = self._get_favorite_items(business_id, page_customer_ids)

        # VIP threshold: spend >= 500 or visits >= 10
        items = []
        for r in page_slice:
            c = r["customer"]
            spent = float(c.total_spent or 0)
            pts = c.loyalty.current_points if c.loyalty else 0
            is_vip = spent >= 500 or (c.visit_count or 0) >= 10
            items.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone or "",
                "email": c.email,
                "gender": c.gender,
                "last_visit_at": r["last_visit_at"],
                "days_since_last_visit": r["days_since"],
                "avg_spend": round(spent / (c.visit_count or 1), 2),
                "total_spent": spent,
                "visit_count": c.visit_count or 0,
                "loyalty_points": pts,
                "membership": None,
                "favorite_item": fav_map.get(c.id, "No favorite yet"),
                "is_vip": is_vip,
                "recovery_stage": self._classify_bucket(r["days_since"]),
            })

        logger.info(
            "RECOVERY CUSTOMERS | business_id=%s bucket=%d total=%d page=%d/%d",
            business_id, bucket, total, page, total_pages,
        )

        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }

    def get_analytics(self, current_user: User) -> dict:
        """
        Returns recovery analytics:
        - Potential revenue = avg_spend × recoverable_customers
        - Recovery rate = recovered / (campaigns sent × recipients)
        - Messages sent/failed from campaign_logs
        """
        business_id = current_user.business_id
        recoverable = self._get_recoverable_customers(business_id)
        total = len(recoverable)
        avg_spend = (
            sum(float(r["customer"].total_spent or 0) for r in recoverable) / total
            if total else 0.0
        )
        potential_revenue = round(avg_spend * total, 2)

        # Campaign stats from existing campaign_logs
        sent_count = self.db.scalar(
            select(func.count(CampaignLog.id))
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.RECOVERY,
                CampaignLog.status == CampaignLogStatus.SENT,
            )
        ) or 0

        failed_count = self.db.scalar(
            select(func.count(CampaignLog.id))
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.RECOVERY,
                CampaignLog.status == CampaignLogStatus.FAILED,
            )
        ) or 0

        total_campaigns = self.db.scalar(
            select(func.count(Campaign.id)).where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.RECOVERY,
            )
        ) or 0

        # Recovered = customers who received a RECOVERY campaign AND visited after sent_at
        settings = self._get_settings(business_id)
        window_days = settings.recovery_window_days if settings else 30

        recovered_stmt = (
            select(func.count(func.distinct(CampaignLog.customer_id)))
            .join(Campaign, CampaignLog.campaign_id == Campaign.id)
            .join(
                Visit,
                (Visit.customer_id == CampaignLog.customer_id)
                & (Visit.business_id == business_id)
                & (Visit.status == VisitStatus.COMPLETED)
                & (Visit.completed_at > CampaignLog.sent_at)
                & (
                    Visit.completed_at
                    <= CampaignLog.sent_at + timedelta(days=window_days)
                ),
            )
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.RECOVERY,
                CampaignLog.status == CampaignLogStatus.SENT,
                CampaignLog.sent_at.is_not(None),
            )
        )
        recovered = self.db.scalar(recovered_stmt) or 0

        recovery_rate = round((recovered / sent_count * 100), 2) if sent_count else 0.0

        return {
            "potential_revenue": potential_revenue,
            "average_spend": round(avg_spend, 2),
            "recoverable_customers": total,
            "recovery_rate_pct": recovery_rate,
            "total_campaigns_sent": total_campaigns,
            "total_recovered": recovered,
            "messages_sent": sent_count,
            "messages_failed": failed_count,
        }

    def get_preview(
        self,
        current_user: User,
        bucket: int,
        coupon_code: str | None = None,
    ) -> dict:
        """
        Preview before launching a campaign.
        Returns recipient count, estimated revenue, message count.
        """
        if bucket not in VALID_BUCKETS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid bucket: {bucket}. Must be one of: {sorted(VALID_BUCKETS)}",
            )

        recoverable = self._get_recoverable_customers(current_user.business_id, bucket)
        recipients = len(recoverable)
        avg_spend = (
            sum(float(r["customer"].total_spent or 0) for r in recoverable) / recipients
            if recipients else 0.0
        )

        return {
            "recipients": recipients,
            "estimated_revenue": round(avg_spend * recipients, 2),
            "estimated_message_count": recipients,
            "coupon_code": coupon_code,
            "bucket_days": bucket,
            "average_spend": round(avg_spend, 2),
        }

    def launch_campaign(self, current_user: User, data: RecoveryLaunchRequest) -> dict:
        """
        Creates a Recovery Campaign and enqueues a CampaignLog per recipient.
        Reuses CampaignRepository and CampaignLogRepository (existing bulk_create queue).
        Validates:
        - Bucket must be valid
        - No duplicate active campaign for same bucket (cooldown check)
        """
        bucket = data.bucket
        if bucket not in VALID_BUCKETS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid bucket: {bucket}. Must be one of: {sorted(VALID_BUCKETS)}",
            )

        business_id = current_user.business_id

        # Cooldown check: block if another RECOVERY campaign was sent within cooldown window
        settings = self._get_settings(business_id)
        cooldown_days = settings.recovery_cooldown_days if settings else 7

        recent_campaign = self.db.scalar(
            select(Campaign)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.RECOVERY,
                Campaign.name.contains(f"bucket_{bucket}d"),
                Campaign.created_at >= datetime.now(timezone.utc) - timedelta(days=cooldown_days),
            )
        )
        if recent_campaign:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A recovery campaign for the {bucket}-day bucket was already launched within the last {cooldown_days} days (campaign: {recent_campaign.id}). Cooldown period has not expired.",
            )

        # Get recoverable customers for this bucket
        recoverable = self._get_recoverable_customers(business_id, bucket)
        if not recoverable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No recoverable customers found for the {bucket}-day bucket.",
            )

        # Create Campaign record (reuses existing Campaign model + CampaignType.RECOVERY)
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        campaign_name = f"Recovery {bucket}d — {now_str}"
        campaign = Campaign(
            business_id=business_id,
            name=campaign_name,
            campaign_type=CampaignType.RECOVERY,
            target_segment=TargetSegment.INACTIVE_30 if bucket <= 30 else TargetSegment.INACTIVE_90,
            title=f"Come back! We miss you 🙏",
            message=data.message,
            is_active=True,
        )
        created_campaign = self.campaign_repo.create(campaign)

        # Enqueue recipients as CampaignLog records (reuses existing bulk_create queue)
        schedule_at = data.schedule_at
        logs = [
            CampaignLog(
                campaign_id=created_campaign.id,
                customer_id=r["customer"].id,
                status=CampaignLogStatus.PENDING,
                scheduled_for=schedule_at,
            )
            for r in recoverable
        ]
        created_logs = self.log_repo.bulk_create(logs)
        self.db.commit()

        logger.info(
            "RECOVERY CAMPAIGN LAUNCHED | campaign_id=%s business_id=%s bucket=%d recipients=%d",
            created_campaign.id, business_id, bucket, len(created_logs),
        )

        return {
            "campaign_id": created_campaign.id,
            "campaign_name": campaign_name,
            "recipients_count": len(created_logs),
            "bucket_days": bucket,
            "message": data.message,
        }

    def get_suggested_offers(self, business_type: str = "restaurant") -> dict:
        """Returns standard suggested recovery offers, tailored to business type."""
        is_salon = "salon" in business_type.lower() or "beauty" in business_type.lower() or "spa" in business_type.lower()
        if is_salon:
            return {
                "offers": [
                    {"title": "15% Off Next Appointment", "type": "percentage", "value": "15%"},
                    {"title": "20% Off Any Service", "type": "percentage", "value": "20%"},
                    {"title": "Free Hair Wash", "type": "free_item", "value": "Hair Wash"},
                    {"title": "Buy One Get One Service", "type": "bogo", "value": None},
                    {"title": "Flat ₹100 Off on Service", "type": "flat", "value": "₹100"},
                    {"title": "Free Deep Conditioning on Rebook", "type": "free_item", "value": "Deep Conditioning"},
                ]
            }
        return {
            "offers": [
                {"title": "15% Discount", "type": "percentage", "value": "15%"},
                {"title": "20% Discount", "type": "percentage", "value": "20%"},
                {"title": "Free Dessert", "type": "free_item", "value": "1 Dessert"},
                {"title": "Buy One Get One", "type": "bogo", "value": None},
                {"title": "Flat ₹100 Off", "type": "flat", "value": "₹100"},
                {"title": "Free Beverage on Next Visit", "type": "free_item", "value": "1 Beverage"},
            ]
        }

    def get_history(self, current_user: User) -> dict:
        """
        Returns history of all RECOVERY campaigns with per-campaign stats.
        Reuses Campaign + CampaignLog (no new tables).
        """
        business_id = current_user.business_id
        settings = self._get_settings(business_id)
        window_days = settings.recovery_window_days if settings else 30

        campaigns = self.db.scalars(
            select(Campaign)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.RECOVERY,
            )
            .order_by(Campaign.created_at.desc())
        ).all()

        items = []
        for camp in campaigns:
            # Extract bucket from campaign name ("Recovery 30d — ...")
            bucket_days = 0
            try:
                parts = camp.name.split(" ")
                for p in parts:
                    if p.endswith("d") and p[:-1].isdigit():
                        bucket_days = int(p[:-1])
                        break
            except Exception:
                pass

            # Aggregate log stats
            stats = self.db.execute(
                select(
                    func.count(CampaignLog.id).label("total"),
                    func.sum(
                        (CampaignLog.status == CampaignLogStatus.SENT).cast(Integer)
                    ).label("sent"),
                    func.sum(
                        (CampaignLog.status == CampaignLogStatus.FAILED).cast(Integer)
                    ).label("failed"),
                )
                .where(CampaignLog.campaign_id == camp.id)
            ).first()

            total_recipients = stats.total or 0
            sent = stats.sent or 0
            failed = stats.failed or 0

            # Recovered = customers who visited after campaign was sent (within window)
            recovered = self.db.scalar(
                select(func.count(func.distinct(CampaignLog.customer_id)))
                .join(
                    Visit,
                    (Visit.customer_id == CampaignLog.customer_id)
                    & (Visit.business_id == business_id)
                    & (Visit.status == VisitStatus.COMPLETED)
                    & (Visit.completed_at > CampaignLog.sent_at)
                    & (
                        Visit.completed_at
                        <= CampaignLog.sent_at + timedelta(days=window_days)
                    ),
                )
                .where(
                    CampaignLog.campaign_id == camp.id,
                    CampaignLog.status == CampaignLogStatus.SENT,
                    CampaignLog.sent_at.is_not(None),
                )
            ) or 0

            # Revenue from recovered customers (visits within window after sent)
            revenue_stmt = (
                select(func.sum(Visit.total_amount))
                .join(CampaignLog, Visit.customer_id == CampaignLog.customer_id)
                .where(
                    CampaignLog.campaign_id == camp.id,
                    CampaignLog.status == CampaignLogStatus.SENT,
                    CampaignLog.sent_at.is_not(None),
                    Visit.business_id == business_id,
                    Visit.status == VisitStatus.COMPLETED,
                    Visit.completed_at > CampaignLog.sent_at,
                    Visit.completed_at
                    <= CampaignLog.sent_at + timedelta(days=window_days),
                )
            )
            revenue = float(self.db.scalar(revenue_stmt) or 0.0)

            items.append({
                "campaign_id": camp.id,
                "campaign_name": camp.name,
                "bucket_days": bucket_days,
                "launched_at": camp.created_at,
                "total_recipients": total_recipients,
                "sent": sent,
                "failed": failed,
                "recovered": recovered,
                "revenue_generated": revenue,
            })

        return {"items": items, "total": len(items)}

    def get_settings(self, current_user: User) -> dict:
        """Returns recovery settings for the business."""
        s = self._get_settings(current_user.business_id)
        if not s:
            return {
                "recovery_enabled": True,
                "recovery_buckets": [15, 30, 45, 60, 90],
                "recovery_cooldown_days": 7,
                "recovery_max_messages_per_day": 100,
                "recovery_window_days": 30,
            }
        return {
            "recovery_enabled": s.recovery_enabled,
            "recovery_buckets": [int(b) for b in (s.recovery_buckets or "15,30,45,60,90").split(",")],
            "recovery_cooldown_days": s.recovery_cooldown_days,
            "recovery_max_messages_per_day": s.recovery_max_messages_per_day,
            "recovery_window_days": s.recovery_window_days,
        }

    def update_settings(self, current_user: User, data: RecoverySettingsUpdate) -> dict:
        """Updates recovery settings stored in BusinessSettings (no new table)."""
        s = self._get_settings(current_user.business_id)
        if not s:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business settings not found. Please complete initial setup first.",
            )

        # Validate bucket list
        invalid = [b for b in data.recovery_buckets if b not in VALID_BUCKETS]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid recovery buckets: {invalid}. Must be from {sorted(VALID_BUCKETS)}.",
            )

        s.recovery_enabled = data.recovery_enabled
        s.recovery_buckets = ",".join(str(b) for b in sorted(set(data.recovery_buckets)))
        s.recovery_cooldown_days = data.recovery_cooldown_days
        s.recovery_max_messages_per_day = data.recovery_max_messages_per_day
        s.recovery_window_days = data.recovery_window_days

        self.db.commit()
        self.db.refresh(s)

        logger.info(
            "RECOVERY SETTINGS UPDATED | business_id=%s enabled=%s buckets=%s",
            current_user.business_id, s.recovery_enabled, s.recovery_buckets,
        )

        return self.get_settings(current_user)

    def generate_ai_message(
        self,
        current_user: User,
        bucket: int = 30,
        restaurant_name: str | None = None,
        offer_type: str | None = None,
        tone: str | None = "Friendly",
        language: str | None = "auto",
    ) -> dict:
        """
        Generates AI recovery copy using Gemini AI.
        Reuses existing AiMessageService.
        Returns { "title": ..., "message": ..., "cta": ... }
        """
        from app.services.ai_message_service import AiMessageService

        ai_svc = AiMessageService(self.db)
        res = ai_svc.generate_message(
            current_user=current_user,
            campaign_type="recovery",
            requested_tone=tone or "Friendly",
            language=language or "auto",
            req_coupon_code=f"COMEBACK{bucket}",
            req_discount_percent=offer_type or f"{bucket}% off",
        )

        title = f"Special Comeback Offer ({bucket} Days)"
        message = res.message
        cta = f"Claim offer with coupon COMEBACK{bucket}"

        return {
            "title": title,
            "message": message,
            "cta": cta,
        }

    def mark_recovered(self, customer_id: UUID, current_user: User) -> dict:
        """
        Marks a customer as manually recovered.
        Uses a special Campaign named __manual_recovered__ with CampaignLog SENT status.
        """
        business_id = current_user.business_id

        # Verify customer belongs to business
        customer = self.db.scalar(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.business_id == business_id,
            )
        )
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Find or create a "manual recovery" campaign for this business
        manual_camp = self.db.scalar(
            select(Campaign).where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.RECOVERY,
                Campaign.name == "__manual_recovered__",
            )
        )
        if not manual_camp:
            manual_camp = Campaign(
                business_id=business_id,
                name="__manual_recovered__",
                campaign_type=CampaignType.RECOVERY,
                target_segment=TargetSegment.INACTIVE_30,
                title="Manually Recovered Customers",
                message="Manually marked as recovered",
                is_active=True,
            )
            self.db.add(manual_camp)
            self.db.flush()

        # Upsert a CampaignLog entry with SENT status (marks them as "recovered")
        existing_log = self.db.scalar(
            select(CampaignLog).where(
                CampaignLog.campaign_id == manual_camp.id,
                CampaignLog.customer_id == customer_id,
            )
        )
        if not existing_log:
            log = CampaignLog(
                campaign_id=manual_camp.id,
                customer_id=customer_id,
                status=CampaignLogStatus.SENT,
                sent_at=datetime.now(timezone.utc),
            )
            self.db.add(log)
        else:
            existing_log.status = CampaignLogStatus.SENT
            existing_log.sent_at = datetime.now(timezone.utc)

        self.db.commit()
        logger.info("MARK RECOVERED | business_id=%s customer_id=%s", business_id, customer_id)

        return {
            "success": True,
            "customer_id": customer_id,
            "message": f"Customer {customer.name} marked as recovered",
        }

    def exclude_customer(self, customer_id: UUID, current_user: User) -> dict:
        """
        Excludes a customer from recovery lists.
        Uses a special Campaign named __recovery_excluded__ with CampaignLog FAILED status.
        """
        business_id = current_user.business_id

        customer = self.db.scalar(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.business_id == business_id,
            )
        )
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        excl_camp = self.db.scalar(
            select(Campaign).where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == CampaignType.RECOVERY,
                Campaign.name == "__recovery_excluded__",
            )
        )
        if not excl_camp:
            excl_camp = Campaign(
                business_id=business_id,
                name="__recovery_excluded__",
                campaign_type=CampaignType.RECOVERY,
                target_segment=TargetSegment.INACTIVE_30,
                title="Excluded from Recovery",
                message="Excluded from recovery campaigns",
                is_active=False,
            )
            self.db.add(excl_camp)
            self.db.flush()

        existing = self.db.scalar(
            select(CampaignLog).where(
                CampaignLog.campaign_id == excl_camp.id,
                CampaignLog.customer_id == customer_id,
            )
        )
        if not existing:
            log = CampaignLog(
                campaign_id=excl_camp.id,
                customer_id=customer_id,
                status=CampaignLogStatus.FAILED,
            )
            self.db.add(log)

        self.db.commit()
        logger.info("EXCLUDE CUSTOMER | business_id=%s customer_id=%s", business_id, customer_id)

        return {
            "success": True,
            "customer_id": customer_id,
            "message": f"Customer {customer.name} excluded from recovery",
        }
