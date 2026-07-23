import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.campaign import (
    Campaign,
    CampaignLog,
    CampaignLogStatus,
    TargetSegment,
)
from app.models.user import User
from app.repositories.campaign_log_repository import CampaignLogRepository
from app.repositories.campaign_repository import CampaignRepository
from app.repositories.customer_repository import CustomerRepository
from app.repositories.customer_segmentation_repository import (
    CustomerSegmentationRepository,
)
from app.schemas.campaign import (
    CampaignCreate,
    CampaignGenerateAudienceResponse,
    CampaignUpdate,
)

logger = logging.getLogger(__name__)


class CampaignService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = CampaignRepository(db)
        self.log_repo = CampaignLogRepository(db)
        self.segment_repo = CustomerSegmentationRepository(db)
        self.customer_repo = CustomerRepository(db)

    def list_campaigns(self, current_user: User) -> list[Campaign]:
        logger.info(
            "Listing campaigns | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        return self.repo.get_all_by_business(current_user.business_id)

    def get_campaign(self, current_user: User, campaign_id: UUID) -> Campaign:
        campaign = self.repo.get_by_id(campaign_id)
        if not campaign or campaign.business_id != current_user.business_id:
            logger.warning(
                "Campaign not found or tenant mismatch | campaign_id=%s business_id=%s",
                campaign_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found.",
            )

        logger.info(
            "Campaign fetched | campaign_id=%s business_id=%s",
            campaign.id,
            campaign.business_id,
        )
        return campaign

    def create_campaign(
        self, current_user: User, data: CampaignCreate
    ) -> Campaign:
        logger.info(
            "Creating campaign | business_id=%s name=%s target_segment=%s",
            current_user.business_id,
            data.name,
            data.target_segment,
        )

        campaign = Campaign(
            business_id=current_user.business_id,
            **data.model_dump(),
        )
        created_campaign = self.repo.create(campaign)
        self.db.commit()
        self.db.refresh(created_campaign)

        logger.info(
            "Campaign created successfully | campaign_id=%s business_id=%s",
            created_campaign.id,
            created_campaign.business_id,
        )
        return created_campaign

    def update_campaign(
        self,
        current_user: User,
        campaign_id: UUID,
        data: CampaignUpdate,
    ) -> Campaign:
        campaign = self.get_campaign(current_user, campaign_id)

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(campaign, field, value)

        self.repo.update(campaign)
        self.db.commit()
        self.db.refresh(campaign)

        logger.info(
            "Campaign updated successfully | campaign_id=%s business_id=%s",
            campaign.id,
            campaign.business_id,
        )
        return campaign

    def delete_campaign(self, current_user: User, campaign_id: UUID) -> None:
        campaign = self.get_campaign(current_user, campaign_id)
        self.repo.delete(campaign)
        self.db.commit()

        logger.info(
            "Campaign deleted successfully | campaign_id=%s business_id=%s",
            campaign_id,
            current_user.business_id,
        )

    def generate_campaign_audience(
        self, current_user: User, campaign_id: UUID
    ) -> CampaignGenerateAudienceResponse:
        campaign = self.get_campaign(current_user, campaign_id)

        logger.info(
            "Generating campaign audience | campaign_id=%s target_segment=%s",
            campaign.id,
            campaign.target_segment,
        )

        now_utc = datetime.now(timezone.utc)
        segment = campaign.target_segment

        # Re-use existing Customer Segmentation Repository
        if segment == TargetSegment.NEW_CUSTOMERS:
            customers = self.segment_repo.get_new_customers(
                current_user.business_id, days=30
            )
        elif segment == TargetSegment.INACTIVE_15:
            customers = self.segment_repo.get_inactive_customers(
                current_user.business_id, days=15
            )
        elif segment == TargetSegment.INACTIVE_30:
            customers = self.segment_repo.get_inactive_customers(
                current_user.business_id, days=30
            )
        elif segment == TargetSegment.INACTIVE_60:
            customers = self.segment_repo.get_inactive_customers(
                current_user.business_id, days=60
            )
        elif segment == TargetSegment.INACTIVE_90:
            customers = self.segment_repo.get_inactive_customers(
                current_user.business_id, days=90
            )
        elif segment == TargetSegment.BIRTHDAY_TODAY:
            customers = self.segment_repo.get_birthday_today(
                current_user.business_id,
                month=now_utc.month,
                day=now_utc.day,
            )
        elif segment == TargetSegment.ANNIVERSARY_TODAY:
            customers = self.segment_repo.get_anniversary_today(
                current_user.business_id,
                month=now_utc.month,
                day=now_utc.day,
            )
        elif segment == TargetSegment.VIP_CUSTOMERS:
            customers = self.segment_repo.get_vip_customers(
                current_user.business_id, limit=20
            )
        elif segment == TargetSegment.ALL_CUSTOMERS:
            customers = self.customer_repo.get_all_by_business(
                current_user.business_id
            )
        else:
            customers = []

        logs = [
            CampaignLog(
                campaign_id=campaign.id,
                customer_id=cust.id,
                status=CampaignLogStatus.PENDING,
            )
            for cust in customers
        ]

        created_logs = self.log_repo.bulk_create(logs)
        self.db.commit()

        logger.info(
            "Campaign audience generated successfully | campaign_id=%s customers_found=%s logs_created=%s",
            campaign.id,
            len(customers),
            len(created_logs),
        )

        return CampaignGenerateAudienceResponse(
            campaign_id=campaign.id,
            customers_found=len(customers),
            logs_created=len(created_logs),
        )
