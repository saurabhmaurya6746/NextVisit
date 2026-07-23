import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.loyalty import CustomerLoyalty, LoyaltySettings
from app.models.user import User
from app.repositories.customer_repository import CustomerRepository
from app.repositories.loyalty_repository import LoyaltyRepository
from app.schemas.loyalty import (
    LoyaltyRedeemRequest,
    LoyaltyRedeemResponse,
    LoyaltySettingsUpdate,
)

logger = logging.getLogger(__name__)


class LoyaltyService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = LoyaltyRepository(db)
        self.customer_repo = CustomerRepository(db)

    def get_settings(self, current_user: User) -> LoyaltySettings:
        logger.info(
            "Fetching loyalty settings | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        settings = self.repo.get_settings(current_user.business_id)

        if not settings:
            logger.info(
                "No loyalty settings found for business; creating defaults | business_id=%s",
                current_user.business_id,
            )
            settings = LoyaltySettings(
                business_id=current_user.business_id,
                points_per_amount=10.0,
                amount_required=100.0,
                redeem_rate=0.5,
                minimum_redeem_points=100,
                is_active=True,
            )
            settings = self.repo.create_settings(settings)
            self.db.commit()
            self.db.refresh(settings)

        return settings

    def update_settings(
        self, current_user: User, data: LoyaltySettingsUpdate
    ) -> LoyaltySettings:
        logger.info(
            "Updating loyalty settings | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )

        settings = self.get_settings(current_user)

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(settings, field, value)

        self.repo.update_settings(settings)
        self.db.commit()
        self.db.refresh(settings)

        logger.info(
            "Loyalty settings updated successfully | business_id=%s fields=%s",
            settings.business_id,
            list(update_data.keys()),
        )
        return settings

    def get_customer_loyalty(
        self, current_user: User, customer_id: UUID
    ) -> CustomerLoyalty:
        customer = self.customer_repo.get_by_id(customer_id)
        if not customer or customer.business_id != current_user.business_id:
            logger.warning(
                "Customer loyalty fetch rejected — customer not found | customer_id=%s business_id=%s",
                customer_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found.",
            )

        loyalty = self.repo.get_customer_loyalty(customer_id)
        if not loyalty:
            logger.info(
                "Creating initial loyalty record for customer | customer_id=%s",
                customer_id,
            )
            loyalty = CustomerLoyalty(
                customer_id=customer_id,
                current_points=0,
                lifetime_points=0,
                redeemed_points=0,
            )
            loyalty = self.repo.create_customer_loyalty(loyalty)
            self.db.commit()
            self.db.refresh(loyalty)

        return loyalty

    def redeem_points(
        self, current_user: User, data: LoyaltyRedeemRequest
    ) -> LoyaltyRedeemResponse:
        logger.info(
            "Points redemption request | business_id=%s customer_id=%s points=%s",
            current_user.business_id,
            data.customer_id,
            data.points,
        )

        # 1. Validate customer & settings
        settings = self.get_settings(current_user)
        if not settings.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Loyalty program is currently disabled for this business.",
            )

        if data.points < settings.minimum_redeem_points:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum redeem threshold is {settings.minimum_redeem_points} points.",
            )

        # 2. Fetch customer loyalty record
        loyalty = self.get_customer_loyalty(current_user, data.customer_id)
        if loyalty.current_points < data.points:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient loyalty points. Available: {loyalty.current_points}, requested: {data.points}.",
            )

        # 3. Deduct points and calculate discount amount
        discount_amount = round(data.points * settings.redeem_rate, 2)
        loyalty.current_points -= data.points
        loyalty.redeemed_points += data.points

        self.repo.update_customer_loyalty(loyalty)
        self.db.commit()
        self.db.refresh(loyalty)

        logger.info(
            "Points redeemed successfully | customer_id=%s points_redeemed=%s discount_amount=%.2f remaining_points=%s",
            data.customer_id,
            data.points,
            discount_amount,
            loyalty.current_points,
        )

        return LoyaltyRedeemResponse(
            customer_id=data.customer_id,
            points_redeemed=data.points,
            discount_amount=discount_amount,
            remaining_points=loyalty.current_points,
        )
