import logging
from uuid import UUID
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.business import Business
from app.models.business_type import BusinessType
from app.core.automation.resolvers.base import IAutomationContextResolver
from app.core.automation.resolvers.restaurant import RestaurantContextResolver
from app.core.automation.resolvers.salon import SalonContextResolver

logger = logging.getLogger(__name__)


class AutomationEngine:
    """
    Unified, zero-duplication Automation Engine for multi-tenant & multi-industry businesses.
    Resolves customer variables and templates using industry-specific Context Resolvers.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_resolver(self, business_id: UUID) -> IAutomationContextResolver:
        biz = self.db.scalar(select(Business).where(Business.id == business_id))
        biz_type = str(biz.type_id).lower() if (biz and hasattr(biz, "type_id") and biz.type_id) else "salon"

        if "restaurant" in biz_type or "cafe" in biz_type:
            return RestaurantContextResolver()
        return SalonContextResolver()

    def resolve_variables(
        self,
        business_id: UUID,
        customer_id: UUID,
        template_text: str,
    ) -> str:
        resolver = self.get_resolver(business_id)
        ctx = resolver.resolve_customer_context(self.db, business_id, customer_id)

        rendered = template_text
        for key, val in ctx.items():
            rendered = rendered.replace(f"{{{key}}}", str(val))

        return rendered

    def get_industry_seed_templates(self, business_id: UUID) -> list[Dict[str, Any]]:
        resolver = self.get_resolver(business_id)
        return resolver.get_seed_templates()
