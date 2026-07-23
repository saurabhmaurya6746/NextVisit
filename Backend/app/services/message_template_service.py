import logging
import re
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.campaign import CampaignType
from app.models.message_template import MessageTemplate
from app.models.user import User
from app.repositories.business_repository import BusinessRepository
from app.repositories.customer_repository import CustomerRepository
from app.repositories.loyalty_repository import LoyaltyRepository
from app.repositories.message_template_repository import (
    MessageTemplateRepository,
)
from app.schemas.message_template import (
    MessageTemplatePreviewRequest,
    MessageTemplatePreviewResponse,
    MessageTemplateUpdate,
)

logger = logging.getLogger(__name__)

DEFAULT_TEMPLATE_DEFINITIONS = {
    CampaignType.BIRTHDAY: (
        "Birthday Greetings",
        "Hi {{customer_name}}, Happy Birthday from {{business_name}}! Visit us today and enjoy a special birthday discount of ₹{{discount}}.",
    ),
    CampaignType.ANNIVERSARY: (
        "Anniversary Special",
        "Happy Anniversary {{customer_name}}! Celebrate your special milestone with {{business_name}}. You currently have {{points}} loyalty points.",
    ),
    CampaignType.WELCOME: (
        "Welcome Message",
        "Hello {{customer_name}}, welcome to {{business_name}}! We are thrilled to have you. You have completed {{visit_count}} visit(s) with us.",
    ),
    CampaignType.RECOVERY: (
        "We Miss You",
        "Hi {{customer_name}}, we miss seeing you at {{business_name}}! Come back soon and get an exclusive ₹{{discount}} discount.",
    ),
    CampaignType.FESTIVAL: (
        "Festival Greetings",
        "Happy Festive Season {{customer_name}}! {{business_name}} wishes you joy and prosperity.",
    ),
    CampaignType.VIP: (
        "VIP Reward",
        "Dear {{customer_name}}, as a VIP guest at {{business_name}}, you have {{points}} loyalty points ready to redeem on your next visit!",
    ),
    CampaignType.CUSTOM: (
        "Custom Message",
        "Hi {{customer_name}}, thank you for being a valued guest at {{business_name}}.",
    ),
}


class MessageTemplateService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = MessageTemplateRepository(db)
        self.business_repo = BusinessRepository(db)
        self.customer_repo = CustomerRepository(db)
        self.loyalty_repo = LoyaltyRepository(db)

    def init_default_templates_for_business(
        self, business_id: UUID
    ) -> list[MessageTemplate]:
        created_templates = []
        for ctype, (tname, tmsg) in DEFAULT_TEMPLATE_DEFINITIONS.items():
            existing = self.repo.get_by_campaign_type(business_id, ctype)
            if not existing:
                template = MessageTemplate(
                    business_id=business_id,
                    campaign_type=ctype,
                    template_name=tname,
                    message=tmsg,
                    is_default=True,
                )
                self.repo.create(template)
                created_templates.append(template)

        if created_templates:
            self.db.commit()
            logger.info(
                "Initialized %s default message templates | business_id=%s",
                len(created_templates),
                business_id,
            )

        return self.repo.get_all_by_business(business_id)

    def list_templates(self, current_user: User) -> list[MessageTemplate]:
        templates = self.repo.get_all_by_business(current_user.business_id)
        if not templates:
            templates = self.init_default_templates_for_business(
                current_user.business_id
            )
        return templates

    def get_template_by_campaign_type(
        self, current_user: User, campaign_type: CampaignType
    ) -> MessageTemplate:
        template = self.repo.get_by_campaign_type(
            current_user.business_id, campaign_type
        )
        if not template:
            templates = self.init_default_templates_for_business(
                current_user.business_id
            )
            template = next(
                (t for t in templates if t.campaign_type == campaign_type), None
            )

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message template for campaign type '{campaign_type.value}' not found.",
            )

        return template

    def update_template(
        self,
        current_user: User,
        template_id: UUID,
        data: MessageTemplateUpdate,
    ) -> MessageTemplate:
        template = self.repo.get_by_id(template_id)
        if not template or template.business_id != current_user.business_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message template not found.",
            )

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(template, field, value)

        self.repo.update(template)
        self.db.commit()
        self.db.refresh(template)

        logger.info(
            "Message template updated | template_id=%s business_id=%s fields=%s",
            template.id,
            template.business_id,
            list(update_data.keys()),
        )
        return template

    @staticmethod
    def render_template(
        template_str: str, placeholders: dict[str, str]
    ) -> str:
        """
        Replaces placeholders like {{customer_name}} or {customer_name}.
        Missing or None values are replaced with empty string.
        """
        if not template_str:
            return ""

        rendered = template_str

        for key, val in placeholders.items():
            str_val = str(val) if val is not None else ""
            pattern = re.compile(rf"\{{\{{\s*{key}\s*\}}\}}|{{\s*{key}\s*}}")
            rendered = pattern.sub(str_val, rendered)

        # Replace any remaining unfulfilled {{var}} or {var} placeholders with empty string
        rendered = re.sub(r"\{\{\s*\w+\s*\}\}|\{\s*\w+\s*\}", "", rendered)
        return rendered

    def preview_template(
        self,
        current_user: User,
        data: MessageTemplatePreviewRequest,
    ) -> MessageTemplatePreviewResponse:
        logger.info(
            "Generating message template preview | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )

        business = self.business_repo.get_by_id(current_user.business_id)
        business_name = business.name if business else ""

        customer = None
        if data.customer_id:
            customer = self.customer_repo.get_by_id(data.customer_id)
            if customer and customer.business_id != current_user.business_id:
                customer = None

        loyalty = None
        if customer:
            loyalty = self.loyalty_repo.get_customer_loyalty(customer.id)

        customer_name = customer.name if customer else ""
        visit_count = str(customer.visit_count) if customer else ""

        if data.discount is not None:
            discount_val = f"{data.discount:.2f}"
        else:
            discount_val = ""

        if data.points is not None:
            points_val = str(data.points)
        elif loyalty is not None:
            points_val = str(loyalty.current_points)
        else:
            points_val = ""

        placeholders = {
            "customer_name": customer_name,
            "business_name": business_name,
            "discount": discount_val,
            "points": points_val,
            "visit_count": visit_count,
        }

        # Determine template content
        if data.message_override:
            message_template_text = data.message_override
        elif data.template_id:
            tmpl = self.repo.get_by_id(data.template_id)
            if not tmpl or tmpl.business_id != current_user.business_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Message template not found.",
                )
            message_template_text = tmpl.message
        elif data.campaign_type:
            tmpl = self.get_template_by_campaign_type(
                current_user, data.campaign_type
            )
            message_template_text = tmpl.message
        else:
            tmpl = self.get_template_by_campaign_type(
                current_user, CampaignType.BIRTHDAY
            )
            message_template_text = tmpl.message

        preview_message = self.render_template(
            message_template_text, placeholders
        )

        return MessageTemplatePreviewResponse(
            preview_message=preview_message,
            placeholders_used=placeholders,
        )
