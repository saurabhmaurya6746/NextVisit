import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.automation import AutomationRule, ScheduleType
from app.models.campaign import (
    Campaign,
    CampaignLog,
    CampaignLogStatus,
    CampaignType,
    TargetSegment,
)
from app.models.user import User
from app.repositories.automation_repository import AutomationRepository
from app.repositories.campaign_log_repository import CampaignLogRepository
from app.repositories.campaign_repository import CampaignRepository
from app.repositories.customer_repository import CustomerRepository
from app.repositories.customer_segmentation_repository import (
    CustomerSegmentationRepository,
)
from app.schemas.automation import (
    AutomationRuleUpdate,
    AutomationRunDetail,
    AutomationRunResponse,
)

logger = logging.getLogger(__name__)

DEFAULT_CAMPAIGN_MAPPINGS = {
    CampaignType.BIRTHDAY: (
        TargetSegment.BIRTHDAY_TODAY,
        "Happy Birthday!",
        "Wishing you a very Happy Birthday! Visit us today for a special treat.",
    ),
    CampaignType.ANNIVERSARY: (
        TargetSegment.ANNIVERSARY_TODAY,
        "Happy Anniversary!",
        "Celebrating your special day with us! Enjoy an exclusive discount.",
    ),
    CampaignType.WELCOME: (
        TargetSegment.NEW_CUSTOMERS,
        "Welcome to NextVisit!",
        "Thank you for visiting us! We look forward to serving you again soon.",
    ),
    CampaignType.RECOVERY: (
        TargetSegment.INACTIVE_30,
        "We Miss You!",
        "It has been a while since your last visit. Come back and enjoy a special offer!",
    ),
    CampaignType.FESTIVAL: (
        TargetSegment.ALL_CUSTOMERS,
        "Festive Greetings!",
        "Celebrate the festival with us! Check out our special offers.",
    ),
    CampaignType.VIP: (
        TargetSegment.VIP_CUSTOMERS,
        "Exclusive VIP Offer!",
        "As one of our most valued guests, enjoy an exclusive VIP reward on your next visit.",
    ),
    CampaignType.CUSTOM: (
        TargetSegment.ALL_CUSTOMERS,
        "Special Announcement",
        "We have exciting news and updates for you!",
    ),
}


class AutomationService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = AutomationRepository(db)
        self.campaign_repo = CampaignRepository(db)
        self.log_repo = CampaignLogRepository(db)
        self.segment_repo = CustomerSegmentationRepository(db)
        self.customer_repo = CustomerRepository(db)

    def init_default_rules_for_business(self, business_id: UUID) -> list[AutomationRule]:
        created_rules = []
        for ctype in CampaignType:
            existing = self.repo.get_by_campaign_type(business_id, ctype)
            if not existing:
                rule = AutomationRule(
                    business_id=business_id,
                    campaign_type=ctype,
                    is_enabled=True,
                    schedule_type=ScheduleType.MANUAL,
                )
                self.repo.create(rule)
                created_rules.append(rule)

        if created_rules:
            self.db.commit()
            logger.info(
                "Initialized %s default automation rules | business_id=%s",
                len(created_rules),
                business_id,
            )

        return self.repo.get_all_by_business(business_id)

    def list_rules(self, current_user: User) -> list[AutomationRule]:
        rules = self.repo.get_all_by_business(current_user.business_id)
        if not rules:
            rules = self.init_default_rules_for_business(current_user.business_id)
        return rules

    def update_rule(
        self,
        current_user: User,
        rule_id: UUID,
        data: AutomationRuleUpdate,
    ) -> AutomationRule:
        rule = self.repo.get_by_id(rule_id)
        if not rule or rule.business_id != current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Automation rule not found.",
            )

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(rule, field, value)

        self.repo.update(rule)
        self.db.commit()
        self.db.refresh(rule)

        logger.info(
            "Automation rule updated | rule_id=%s business_id=%s fields=%s",
            rule.id,
            rule.business_id,
            list(update_data.keys()),
        )
        return rule

    def _get_or_create_campaign_for_type(
        self, business_id: UUID, ctype: CampaignType
    ) -> Campaign:
        # Find active campaign matching business_id and campaign_type
        stmt = (
            select(Campaign)
            .where(
                Campaign.business_id == business_id,
                Campaign.campaign_type == ctype,
                Campaign.is_active.is_(True),
            )
            .order_by(Campaign.created_at.desc())
        )
        campaign = self.db.scalar(stmt)

        if not campaign:
            target_segment, title, message = DEFAULT_CAMPAIGN_MAPPINGS.get(
                ctype,
                (
                    TargetSegment.ALL_CUSTOMERS,
                    f"Automated {ctype.value} Campaign",
                    f"Automated notification for {ctype.value}.",
                ),
            )
            campaign = Campaign(
                business_id=business_id,
                name=f"Auto-{ctype.value.capitalize()}-Campaign",
                campaign_type=ctype,
                target_segment=target_segment,
                title=title,
                message=message,
                is_active=True,
            )
            self.campaign_repo.create(campaign)
            self.db.flush()

        return campaign

    def run_automation(
        self,
        current_user: User,
        campaign_type: CampaignType | None = None,
    ) -> AutomationRunResponse:
        logger.info(
            "Manual automation trigger initiated | business_id=%s campaign_type=%s",
            current_user.business_id,
            campaign_type,
        )

        # 1. Determine rules to evaluate
        if campaign_type is not None:
            rule = self.repo.get_by_campaign_type(
                current_user.business_id, campaign_type
            )
            if not rule or not rule.is_enabled:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Automation rule for '{campaign_type.value}' is disabled or not configured.",
                )
            rules_to_run = [rule]
        else:
            rules_to_run = self.repo.get_enabled_rules(current_user.business_id)
            if not rules_to_run:
                self.init_default_rules_for_business(current_user.business_id)
                rules_to_run = self.repo.get_enabled_rules(current_user.business_id)

        now_utc = datetime.now(timezone.utc)
        details = []
        total_logs_created = 0
        campaigns_processed = 0

        for rule in rules_to_run:
            campaign = self._get_or_create_campaign_for_type(
                current_user.business_id, rule.campaign_type
            )
            campaigns_processed += 1

            # 2. Fetch audience using CustomerSegmentationRepository
            segment = campaign.target_segment
            if segment == TargetSegment.NEW_CUSTOMERS:
                audience = self.segment_repo.get_new_customers(
                    current_user.business_id, days=30
                )
            elif segment == TargetSegment.INACTIVE_15:
                audience = self.segment_repo.get_inactive_customers(
                    current_user.business_id, days=15
                )
            elif segment == TargetSegment.INACTIVE_30:
                audience = self.segment_repo.get_inactive_customers(
                    current_user.business_id, days=30
                )
            elif segment == TargetSegment.INACTIVE_60:
                audience = self.segment_repo.get_inactive_customers(
                    current_user.business_id, days=60
                )
            elif segment == TargetSegment.INACTIVE_90:
                audience = self.segment_repo.get_inactive_customers(
                    current_user.business_id, days=90
                )
            elif segment == TargetSegment.BIRTHDAY_TODAY:
                audience = self.segment_repo.get_birthday_today(
                    current_user.business_id,
                    month=now_utc.month,
                    day=now_utc.day,
                )
            elif segment == TargetSegment.ANNIVERSARY_TODAY:
                audience = self.segment_repo.get_anniversary_today(
                    current_user.business_id,
                    month=now_utc.month,
                    day=now_utc.day,
                )
            elif segment == TargetSegment.VIP_CUSTOMERS:
                audience = self.segment_repo.get_vip_customers(
                    current_user.business_id, limit=20
                )
            elif segment == TargetSegment.ALL_CUSTOMERS:
                audience = self.customer_repo.get_all_by_business(
                    current_user.business_id
                )
            else:
                audience = []

            # 3. Deduplication Check (Requirement 4)
            # Find existing PENDING logs for this campaign to avoid duplicates
            pending_logs_stmt = select(CampaignLog.customer_id).where(
                CampaignLog.campaign_id == campaign.id,
                CampaignLog.status == CampaignLogStatus.PENDING,
            )
            existing_pending_customer_ids = set(
                self.db.scalars(pending_logs_stmt).all()
            )

            new_logs = []
            duplicates_skipped = 0

            for cust in audience:
                if cust.id in existing_pending_customer_ids:
                    duplicates_skipped += 1
                else:
                    new_logs.append(
                        CampaignLog(
                            campaign_id=campaign.id,
                            customer_id=cust.id,
                            status=CampaignLogStatus.PENDING,
                        )
                    )
                    existing_pending_customer_ids.add(cust.id)

            if new_logs:
                self.log_repo.bulk_create(new_logs)

            rule.last_run_at = now_utc
            self.repo.update(rule)

            logs_cnt = len(new_logs)
            total_logs_created += logs_cnt

            details.append(
                AutomationRunDetail(
                    campaign_type=rule.campaign_type,
                    campaign_id=campaign.id,
                    customers_found=len(audience),
                    logs_created=logs_cnt,
                    duplicates_skipped=duplicates_skipped,
                )
            )

        self.db.commit()

        logger.info(
            "Automation run completed | rules_evaluated=%s campaigns_processed=%s total_logs_created=%s",
            len(rules_to_run),
            campaigns_processed,
            total_logs_created,
        )

        return AutomationRunResponse(
            business_id=current_user.business_id,
            rules_evaluated=len(rules_to_run),
            campaigns_processed=campaigns_processed,
            total_logs_created=total_logs_created,
            details=details,
        )
