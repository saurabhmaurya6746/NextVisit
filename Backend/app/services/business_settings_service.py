import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.models.user import User
from app.repositories.business_settings_repository import (
    BusinessSettingsRepository,
)
from app.schemas.business_settings import (
    BusinessSettingsUpdate,
    RestaurantSetupSettingsUpdate,
)

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
                tax_percentage=5.0,
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

    def get_restaurant_setup_settings(self, current_user: User) -> dict:
        business = self.db.query(Business).filter(Business.id == current_user.business_id).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found.")
        settings = self.get_settings(current_user)

        is_saved = bool(business.address and business.phone and settings.city)

        return {
            "name": business.name,
            "phone": business.phone,
            "email": business.email,
            "address": business.address,
            "city": settings.city,
            "state": settings.state,
            "country": business.country,
            "gst_number": settings.gst_number,
            "currency": business.currency or settings.currency or "INR",
            "timezone": business.timezone or settings.timezone or "Asia/Kolkata",
            "opening_time": settings.opening_time or "09:00 AM",
            "closing_time": settings.closing_time or "10:00 PM",
            "enable_qr_ordering": settings.enable_qr_ordering,
            "enable_staff_ordering": settings.enable_staff_ordering,
            "enable_parcel": settings.enable_parcel,
            "enable_takeaway": settings.enable_takeaway,
            "tax_percentage": settings.tax_percentage,
            "invoice_prefix": settings.invoice_prefix or "INV-",
            "is_saved": is_saved,
        }

    def save_restaurant_setup_settings(
        self, current_user: User, data: RestaurantSetupSettingsUpdate
    ) -> dict:
        business = self.db.query(Business).filter(Business.id == current_user.business_id).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found.")

        # Update Business
        business.name = data.name.strip()
        business.phone = data.phone.strip()
        business.email = data.email.strip()
        business.address = data.address.strip()
        business.country = data.country.strip()
        business.currency = data.currency.strip()
        business.timezone = data.timezone.strip()

        # Update BusinessSettings
        settings = self.get_settings(current_user)
        settings.city = data.city.strip() if data.city else None
        settings.state = data.state.strip() if data.state else None
        settings.gst_number = data.gst_number.strip() if data.gst_number else None
        settings.currency = data.currency.strip()
        settings.timezone = data.timezone.strip()
        settings.opening_time = data.opening_time.strip() if data.opening_time else "09:00 AM"
        settings.closing_time = data.closing_time.strip() if data.closing_time else "10:00 PM"
        settings.enable_qr_ordering = data.enable_qr_ordering
        settings.enable_staff_ordering = data.enable_staff_ordering
        settings.enable_parcel = data.enable_parcel
        settings.enable_takeaway = data.enable_takeaway
        settings.tax_percentage = data.tax_percentage
        settings.invoice_prefix = data.invoice_prefix.strip() if data.invoice_prefix else "INV-"

        self.db.commit()
        self.db.refresh(business)
        self.db.refresh(settings)

        return self.get_restaurant_setup_settings(current_user)
