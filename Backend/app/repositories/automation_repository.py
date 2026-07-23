from uuid import UUID

from sqlalchemy import select

from app.models.automation import AutomationRule
from app.models.campaign import CampaignType
from app.repositories.base_repository import BaseRepository


class AutomationRepository(BaseRepository):

    def get_all_by_business(self, business_id: UUID) -> list[AutomationRule]:
        stmt = (
            select(AutomationRule)
            .where(AutomationRule.business_id == business_id)
            .order_by(AutomationRule.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_enabled_rules(self, business_id: UUID) -> list[AutomationRule]:
        stmt = (
            select(AutomationRule)
            .where(
                AutomationRule.business_id == business_id,
                AutomationRule.is_enabled.is_(True),
            )
            .order_by(AutomationRule.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_campaign_type(
        self, business_id: UUID, campaign_type: CampaignType
    ) -> AutomationRule | None:
        stmt = select(AutomationRule).where(
            AutomationRule.business_id == business_id,
            AutomationRule.campaign_type == campaign_type,
        )
        return self.db.scalar(stmt)

    def get_by_id(self, rule_id: UUID) -> AutomationRule | None:
        stmt = select(AutomationRule).where(AutomationRule.id == rule_id)
        return self.db.scalar(stmt)

    def create(self, rule: AutomationRule) -> AutomationRule:
        self.db.add(rule)
        self.db.flush()
        self.db.refresh(rule)
        return rule

    def update(self, rule: AutomationRule) -> AutomationRule:
        self.db.flush()
        self.db.refresh(rule)
        return rule
