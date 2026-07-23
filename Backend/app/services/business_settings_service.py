import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.business_settings import BusinessSettings
from app.models.user import User
from app.repositories.business_settings_repository import (
    BusinessSettingsRepository,
)
from app.schemas.business_settings import BusinessSettingsUpdate

logger = logging.getLogger(__name__)


class BusinessSettingsService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = BusinessSettingsRepository(db)

    def init_default_settings_for_business(
        self, business_id: UUID
    ) -> BusinessSettings:
        settings = self.repo.get_by_business(business_id)
        if not settings:
            settings = BusinessSettings(
                business_id=business_id,
                currency="INR",
                timezone="Asia/Kolkata",
                language="en",
                tax_percentage=0.0,
                service_charge=0.0,
                default_discount=0.0,
            )
            self.repo.create(settings)
            self.db.commit()
            self.db.refresh(settings)
            logger.info(
                "Initialized default business settings | business_id=%s",
                business_id,
            )

        return settings

    def get_settings(self, current_user: User) -> BusinessSettings:
        logger.info(
            "Fetching business settings | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        settings = self.repo.get_by_business(current_user.business_id)
        if not settings:
            settings = self.init_default_settings_for_business(
                current_user.business_id
            )
        return settings

    def update_settings(
        self,
        current_user: User,
        data: BusinessSettingsUpdate,
    ) -> BusinessSettings:
        logger.info(
            "Updating business settings | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        settings = self.get_settings(current_user)

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(settings, field, value)

        self.repo.update(settings)
        self.db.commit()
        self.db.refresh(settings)

        logger.info(
            "Business settings updated successfully | business_id=%s fields=%s",
            current_user.business_id,
            list(update_data.keys()),
        )
        return settings
