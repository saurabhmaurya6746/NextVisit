import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.platform_settings import PlatformSettings
from app.schemas.platform_settings import PlatformSettingsUpdate

logger = logging.getLogger(__name__)


class PlatformSettingsService:

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_settings(self) -> PlatformSettings:
        stmt = select(PlatformSettings)
        settings = self.db.scalar(stmt)

        if not settings:
            logger.info("No platform settings record found — creating initial default settings")
            settings = PlatformSettings(
                platform_name="NextVisit",
                support_email="support@nextvisit.com",
                default_plan="STARTER",
                trial_days=14,
                default_currency="INR",
                max_clients=1000,
                maintenance_mode=False,
                allow_new_registrations=True,
            )
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)

        return settings

    def update_settings(self, payload: PlatformSettingsUpdate) -> PlatformSettings:
        settings = self.get_or_create_settings()

        update_data = payload.model_dump(exclude_unset=True)

        if not update_data:
            return settings

        for field, value in update_data.items():
            setattr(settings, field, value)

        # Maintain single source of truth between PlatformSettings and SubscriptionPlan
        if "default_plan" in update_data or "trial_days" in update_data:
            from app.models.subscription_plan import SubscriptionPlan
            from sqlalchemy import func
            target_plan_name = (settings.default_plan or "STARTER").strip().upper()
            plan = self.db.scalar(
                select(SubscriptionPlan).where(
                    func.lower(SubscriptionPlan.name) == target_plan_name.lower()
                )
            )
            if plan:
                plan.trial_days = settings.trial_days

        try:
            self.db.commit()
            self.db.refresh(settings)
            logger.info("Platform settings updated successfully by Super Admin")
            return settings
        except Exception as e:
            self.db.rollback()
            logger.error("Failed to update platform settings: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update platform settings due to an internal error.",
            ) from e
