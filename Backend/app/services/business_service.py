import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.business_repository import BusinessRepository
from app.schemas.business import BusinessProfileUpdate

logger = logging.getLogger(__name__)


class BusinessService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = BusinessRepository(db)

    def get_current_business(self, current_user: User):
        """
        Load the business that belongs to the authenticated user.
        Returns HTTP 404 if the business row does not exist.
        """
        logger.info(
            "Fetching business profile | business_id=%s user_id=%s",
            current_user.business_id,
            current_user.id,
        )

        business = self.repo.get_by_id(current_user.business_id)
        if not business:
            logger.warning(
                "Business not found | business_id=%s", current_user.business_id
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business profile not found.",
            )

        logger.info(
            "Business profile fetched | business_id=%s", business.id
        )
        return business

    def update_current_business(
        self,
        current_user: User,
        data: BusinessProfileUpdate,
    ):
        """
        Apply the supplied partial update to the authenticated user's business.

        - Only fields that are explicitly provided (not None) are updated.
        - Commit + refresh happen here; the router receives the updated object.
        - Returns HTTP 404 if the business row does not exist.
        """
        business = self.get_current_business(current_user)

        # Apply only the fields that were explicitly sent in the request body.
        # model_dump(exclude_none=True) skips fields left as None (not provided).
        update_data = data.model_dump(exclude_none=True)

        if not update_data:
            # Nothing to update — return current state without touching the DB.
            logger.info(
                "Business profile update skipped — no fields provided | business_id=%s",
                business.id,
            )
            return business

        for field, value in update_data.items():
            setattr(business, field, value)

        self.repo.update(business)   # flush + refresh within the transaction
        self.db.commit()
        self.db.refresh(business)    # refresh again after commit for server-side defaults

        logger.info(
            "Business profile updated | business_id=%s fields=%s",
            business.id,
            list(update_data.keys()),
        )
        return business
