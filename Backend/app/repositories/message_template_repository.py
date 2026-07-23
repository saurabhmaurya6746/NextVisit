from uuid import UUID

from sqlalchemy import select

from app.models.campaign import CampaignType
from app.models.message_template import MessageTemplate
from app.repositories.base_repository import BaseRepository


class MessageTemplateRepository(BaseRepository):

    def get_all_by_business(self, business_id: UUID) -> list[MessageTemplate]:
        stmt = (
            select(MessageTemplate)
            .where(MessageTemplate.business_id == business_id)
            .order_by(MessageTemplate.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_campaign_type(
        self, business_id: UUID, campaign_type: CampaignType
    ) -> MessageTemplate | None:
        stmt = select(MessageTemplate).where(
            MessageTemplate.business_id == business_id,
            MessageTemplate.campaign_type == campaign_type,
        )
        return self.db.scalar(stmt)

    def get_by_id(self, template_id: UUID) -> MessageTemplate | None:
        stmt = select(MessageTemplate).where(MessageTemplate.id == template_id)
        return self.db.scalar(stmt)

    def create(self, template: MessageTemplate) -> MessageTemplate:
        self.db.add(template)
        self.db.flush()
        self.db.refresh(template)
        return template

    def update(self, template: MessageTemplate) -> MessageTemplate:
        self.db.flush()
        self.db.refresh(template)
        return template
