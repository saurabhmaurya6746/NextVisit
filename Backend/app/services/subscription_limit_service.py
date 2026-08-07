import logging
from datetime import datetime, timezone
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.models.subscription_plan import SubscriptionPlan
from app.models.user import User

logger = logging.getLogger(__name__)


class SubscriptionLimitService:
    def __init__(self, db: Session):
        self.db = db

    def get_business_plan(self, business_id: UUID) -> SubscriptionPlan:
        """
        Dynamically resolves the active SubscriptionPlan for the business.
        Never hardcodes plan names. Reads configuration dynamically from DB.
        """
        business = self.db.scalar(select(Business).where(Business.id == business_id))
        if not business:
            raise HTTPException(status_code=404, detail="Business not found.")

        if business.subscription_plan_id:
            plan = self.db.scalar(
                select(SubscriptionPlan).where(
                    SubscriptionPlan.id == business.subscription_plan_id,
                    SubscriptionPlan.is_active == True,
                )
            )
            if plan:
                return plan

        # Fallback to default active plan in DB (e.g. lowest price or free plan)
        default_plan = self.db.scalar(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.is_active == True)
            .order_by(SubscriptionPlan.monthly_price.asc())
        )
        if not default_plan:
            default_plan = SubscriptionPlan(
                name="Free Plan",
                monthly_price=0.0,
                trial_days=0,
                max_staff=2,
                max_customers=50,
                max_campaigns_per_month=5,
                monthly_ai_credits=0,
                features={"ai_generator": False},
                is_active=True,
            )
            self.db.add(default_plan)
            self.db.commit()
            self.db.refresh(default_plan)

        return default_plan

    # ── GENERIC FEATURE & LIMIT RESOLVER ────────────────────────────────────

    def get_feature_limit(self, business_id: UUID, feature_key: str, default_val: int = 0) -> int:
        """
        Dynamically reads numerical limits configured by Super Admin on the subscription plan.
        Supports: 'max_staff', 'monthly_ai_credits', 'max_customers', 'max_campaigns_per_month', 'storage_limit_gb', etc.
        """
        plan = self.get_business_plan(business_id)
        if hasattr(plan, feature_key):
            val = getattr(plan, feature_key)
            if val is not None:
                return int(val)
        features = plan.features or {}
        if feature_key in features:
            val = features[feature_key]
            return int(val) if isinstance(val, (int, float, str)) and str(val).isdigit() else default_val
        return default_val

    # ── STAFF LIMIT MANAGEMENT (100% DYNAMIC) ─────────────────────────────

    def get_staff_usage(self, business_id: UUID) -> dict:
        plan = self.get_business_plan(business_id)
        max_staff = plan.max_staff or 2

        # Count ACTIVE staff accounts only
        active_count = self.db.scalar(
            select(func.count(User.id)).where(
                User.business_id == business_id,
                User.is_active == True,
                User.status == "ACTIVE",
                User.role == "STAFF",
            )
        ) or 0

        remaining_slots = max(0, max_staff - active_count)
        limit_reached = active_count >= max_staff

        return {
            "plan_name": plan.name,
            "active_count": active_count,
            "max_count": max_staff,
            "remaining_slots": remaining_slots,
            "limit_reached": limit_reached,
        }

    def check_staff_limit(self, business_id: UUID) -> None:
        usage = self.get_staff_usage(business_id)
        if usage["limit_reached"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You have reached your staff account limit. Upgrade your subscription to add more staff.",
            )

    # ── AI CREDIT SYSTEM (MONTHLY + PURCHASED PRIORITY) ─────────────────────

    def _sync_monthly_reset(self, business_id: UUID, settings: BusinessSettings) -> str:
        """
        Resets ONLY monthly subscription credits at the start of every billing month.
        Purchased credits are NEVER reset and NEVER expire!
        """
        now = datetime.now(timezone.utc)
        current_period = now.strftime("%Y-%m")

        if getattr(settings, "ai_usage_period", None) != current_period:
            setattr(settings, "ai_usage_period", current_period)
            setattr(settings, "ai_monthly_used_credits", 0)
            setattr(settings, "ai_requests_used_month", 0)
            self.db.commit()

        if now.month == 12:
            next_month = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            next_month = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)

        return next_month.strftime("%d %B %Y").lstrip("0")

    def get_ai_credit_usage(self, business_id: UUID) -> dict:
        plan = self.get_business_plan(business_id)

        # Read configured monthly AI credits dynamically
        monthly_plan_credits = getattr(plan, "monthly_ai_credits", 0) or 0
        if not monthly_plan_credits and plan.features:
            monthly_plan_credits = int(plan.features.get("monthly_ai_credits", 0))

        settings = self.db.scalar(
            select(BusinessSettings).where(BusinessSettings.business_id == business_id)
        )
        if not settings:
            settings = BusinessSettings(business_id=business_id)
            self.db.add(settings)
            self.db.commit()

        reset_date = self._sync_monthly_reset(business_id, settings)

        monthly_used = getattr(settings, "ai_monthly_used_credits", 0) or getattr(settings, "ai_requests_used_month", 0) or 0
        purchased_credits = getattr(settings, "purchased_ai_credits", 0) or 0

        monthly_remaining = max(0, monthly_plan_credits - monthly_used)
        total_remaining = monthly_remaining + purchased_credits
        total_available = monthly_plan_credits + purchased_credits
        limit_reached = (total_remaining <= 0)

        ai_enabled = True
        if plan.features and isinstance(plan.features, dict):
            if "ai_enabled" in plan.features:
                ai_enabled = bool(plan.features.get("ai_enabled"))
            elif "ai_generator" in plan.features:
                ai_enabled = bool(plan.features.get("ai_generator"))

        # If plan explicitly has 0 monthly credits and 0 purchased credits, mark AI as unavailable/disabled
        if monthly_plan_credits <= 0 and purchased_credits <= 0:
            ai_enabled = False

        return {
            "plan_name": plan.name,
            "ai_enabled": ai_enabled,
            "monthly_plan_credits": monthly_plan_credits,
            "monthly_used_credits": monthly_used,
            "monthly_remaining_credits": monthly_remaining,
            "purchased_remaining_credits": purchased_credits,
            "total_remaining_credits": total_remaining,
            "total_available_credits": total_available,
            "limit_reached": limit_reached,
            "reset_date": reset_date,
        }

    def check_ai_limit(self, business_id: UUID) -> None:
        plan = self.get_business_plan(business_id)
        # Check if AI is enabled on plan
        ai_enabled = True
        if plan.features and isinstance(plan.features, dict) and "ai_enabled" in plan.features:
            ai_enabled = bool(plan.features.get("ai_enabled"))
        if not ai_enabled or (getattr(plan, "monthly_ai_credits", 0) == 0 and not (plan.features or {}).get("monthly_ai_credits")):
            # If monthly credits is 0 and no purchased credits are present, check total remaining
            usage = self.get_ai_credit_usage(business_id)
            if usage["purchased_remaining_credits"] <= 0 and not ai_enabled:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="AI features are disabled for your current subscription plan. Upgrade your plan to unlock AI.",
                )

        usage = self.get_ai_credit_usage(business_id)
        if usage["limit_reached"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You have used all available AI Credits. Upgrade your subscription or purchase additional AI Credits.",
            )

    def consume_ai_credit(self, business_id: UUID) -> None:
        """
        Consumes 1 AI credit upon SUCCESSFUL AI generation.
        Priority:
        1. Monthly Subscription Credits first (increments ai_monthly_used_credits).
        2. Purchased Extra Credits second (decrements purchased_ai_credits).
        """
        plan = self.get_business_plan(business_id)
        monthly_plan_credits = getattr(plan, "monthly_ai_credits", 0) or 0

        settings = self.db.scalar(
            select(BusinessSettings).where(BusinessSettings.business_id == business_id)
        )
        if not settings:
            return

        monthly_used = getattr(settings, "ai_monthly_used_credits", 0) or getattr(settings, "ai_requests_used_month", 0) or 0

        if monthly_used < monthly_plan_credits:
            # Consume Monthly Credit
            setattr(settings, "ai_monthly_used_credits", monthly_used + 1)
            setattr(settings, "ai_requests_used_month", monthly_used + 1)
        else:
            # Consume Purchased Extra Credit
            purchased = getattr(settings, "purchased_ai_credits", 0) or 0
            if purchased > 0:
                setattr(settings, "purchased_ai_credits", purchased - 1)

        setattr(settings, "last_ai_activity_at", datetime.now(timezone.utc))
        self.db.commit()

    # Legacy alias for backward compatibility
    def record_ai_request(self, business_id: UUID) -> None:
        self.consume_ai_credit(business_id)

    # ── UNIFIED DYNAMIC USAGE SUMMARY ────────────────────────────────────────

    def get_full_usage_summary(self, business_id: UUID) -> dict:
        plan = self.get_business_plan(business_id)
        staff = self.get_staff_usage(business_id)
        ai = self.get_ai_credit_usage(business_id)

        return {
            "plan_id": str(plan.id) if hasattr(plan, "id") else "",
            "plan_name": plan.name,
            "monthly_price": float(plan.monthly_price or 0.0),
            "staff_usage": staff,
            "ai_usage": ai,
        }

    # ── SUPER ADMIN AI MANAGEMENT ─────────────────────────────────────────────

    def get_all_businesses_ai_usage(
        self,
        page: int = 1,
        limit: int = 20,
        search: str = "",
        business_type_filter: str | None = None,
        plan_filter: str | None = None,
        status_filter: str | None = None,
    ) -> dict:
        """
        Returns paginated & filtered AI credit usage for ALL businesses for Super Admin view.
        """
        from app.models.business import Business
        from app.models.business_type import BusinessType
        from app.models.admin import Admin

        page = max(1, page)
        limit = max(1, min(100, limit))

        stmt = (
            select(Business)
            .options(joinedload(Business.business_type), joinedload(Business.subscription_plan))
            .where(Business.is_deleted == False)
        )

        if search:
            pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                func.lower(Business.name).like(pattern)
                | func.lower(Business.owner_name).like(pattern)
                | func.lower(Business.email).like(pattern)
            )

        if business_type_filter and business_type_filter.lower() != "all":
            stmt = stmt.join(Business.business_type).where(
                func.lower(BusinessType.name).like(f"%{business_type_filter.strip().lower()}%")
            )

        if plan_filter and plan_filter.lower() != "all":
            stmt = stmt.join(Business.subscription_plan).where(
                func.lower(SubscriptionPlan.name) == plan_filter.strip().lower()
            )

        businesses = list(
            self.db.scalars(stmt.order_by(Business.name.asc())).all()
        )

        items = []
        for biz in businesses:
            try:
                ai_data = self.get_ai_credit_usage(biz.id)
                settings = self.db.scalar(
                    select(BusinessSettings).where(BusinessSettings.business_id == biz.id)
                )
                last_act = (
                    settings.last_ai_activity_at.strftime("%d %b %Y, %I:%M %p")
                    if (settings and settings.last_ai_activity_at)
                    else "Never"
                )

                monthly_used = ai_data["monthly_used_credits"]
                monthly_total = ai_data["monthly_plan_credits"]
                purchased_rem = ai_data["purchased_remaining_credits"]
                total_rem = ai_data["total_remaining_credits"]

                if total_rem <= 0 or ai_data["limit_reached"]:
                    computed_status = "Limit Reached"
                elif monthly_total > 0 and (monthly_used / monthly_total) >= 0.8:
                    computed_status = "Warning"
                else:
                    computed_status = "Normal"

                # Filter by status if specified
                if status_filter and status_filter.lower() != "all":
                    norm_sf = status_filter.strip().lower()
                    if norm_sf == "warning" and computed_status != "Warning":
                        continue
                    if norm_sf == "limit reached" and computed_status != "Limit Reached":
                        continue
                    if norm_sf == "normal" and computed_status != "Normal":
                        continue

                biz_type_str = (
                    biz.business_type.name.capitalize()
                    if biz.business_type
                    else "Restaurant"
                )

                items.append({
                    "business_id": str(biz.id),
                    "business_name": biz.name,
                    "business_type": biz_type_str,
                    "owner_name": biz.owner_name,
                    "email": biz.email,
                    "plan_name": ai_data["plan_name"],
                    "monthly_plan_credits": monthly_total,
                    "monthly_used_credits": monthly_used,
                    "monthly_remaining_credits": ai_data["monthly_remaining_credits"],
                    "purchased_remaining_credits": purchased_rem,
                    "total_remaining_credits": total_rem,
                    "limit_reached": ai_data["limit_reached"],
                    "reset_date": ai_data["reset_date"],
                    "last_ai_activity": last_act,
                    "status": computed_status,
                })
            except Exception:
                continue

        total = len(items)
        pages = max(1, (total + limit - 1) // limit)
        paginated_items = items[(page - 1) * limit : page * limit]

        return {
            "items": paginated_items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        }

    def reset_business_monthly_credits(self, business_id: UUID, current_admin=None) -> dict:
        """
        Resets the monthly AI used credits for a specific business.
        Stores an entry in AiCreditAuditLog.
        """
        from app.models.ai_credit_audit_log import AiCreditAuditLog

        settings = self.db.scalar(
            select(BusinessSettings).where(BusinessSettings.business_id == business_id)
        )
        if not settings:
            settings = BusinessSettings(business_id=business_id)
            self.db.add(settings)

        prev_used = getattr(settings, "ai_monthly_used_credits", 0) or 0
        setattr(settings, "ai_monthly_used_credits", 0)
        setattr(settings, "ai_requests_used_month", 0)

        now = datetime.now(timezone.utc)
        setattr(settings, "ai_usage_period", now.strftime("%Y-%m"))

        audit = AiCreditAuditLog(
            business_id=business_id,
            admin_id=current_admin.id if current_admin else None,
            action="RESET_MONTHLY",
            amount=0,
            reason="Monthly Usage Reset",
            notes="Super Admin manually reset monthly AI credit usage.",
            previous_balance=prev_used,
            new_balance=0,
        )
        self.db.add(audit)
        self.db.commit()

        logger.info("Monthly AI credits reset for business_id=%s by Super Admin", business_id)
        return {"message": "Monthly AI credits reset successfully.", "business_id": str(business_id)}

    def adjust_purchased_credits(
        self,
        business_id: UUID,
        amount: int,
        reason: str = "Manual Purchase",
        notes: str | None = None,
        current_admin=None,
    ) -> dict:
        """
        Adds or removes purchased AI credits for a business with a reason & audit logging.
        amount > 0: add credits
        amount < 0: remove credits (floor at 0)
        """
        from app.models.ai_credit_audit_log import AiCreditAuditLog

        settings = self.db.scalar(
            select(BusinessSettings).where(BusinessSettings.business_id == business_id)
        )
        if not settings:
            settings = BusinessSettings(business_id=business_id)
            self.db.add(settings)
            self.db.commit()

        current = getattr(settings, "purchased_ai_credits", 0) or 0
        new_total = max(0, current + amount)
        setattr(settings, "purchased_ai_credits", new_total)

        action = "ADD_PURCHASED" if amount >= 0 else "REMOVE_PURCHASED"
        audit = AiCreditAuditLog(
            business_id=business_id,
            admin_id=current_admin.id if current_admin else None,
            action=action,
            amount=amount,
            reason=reason,
            notes=notes,
            previous_balance=current,
            new_balance=new_total,
        )
        self.db.add(audit)
        self.db.commit()

        action_str = "added" if amount >= 0 else "removed"
        logger.info(
            "Purchased AI credits adjusted for business_id=%s | %s %d credits | new total=%d | reason=%s",
            business_id,
            action_str,
            abs(amount),
            new_total,
            reason,
        )
        return {
            "message": f"{abs(amount)} purchased AI credits {action_str} successfully.",
            "business_id": str(business_id),
            "previous_credits": current,
            "new_total_credits": new_total,
        }

    def get_business_ai_audit_logs(self, business_id: UUID) -> list[dict]:
        """
        Returns history of AI credit adjustments for a business.
        """
        from app.models.ai_credit_audit_log import AiCreditAuditLog
        from app.models.admin import Admin

        logs = list(
            self.db.scalars(
                select(AiCreditAuditLog)
                .options(joinedload(AiCreditAuditLog.admin))
                .where(AiCreditAuditLog.business_id == business_id)
                .order_by(AiCreditAuditLog.created_at.desc())
            ).all()
        )

        return [
            {
                "id": str(log.id),
                "business_id": str(log.business_id),
                "admin_id": str(log.admin_id) if log.admin_id else None,
                "admin_name": log.admin.name if log.admin else "Super Admin",
                "action": log.action,
                "amount": log.amount,
                "reason": log.reason,
                "notes": log.notes,
                "previous_balance": log.previous_balance,
                "new_balance": log.new_balance,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ]

