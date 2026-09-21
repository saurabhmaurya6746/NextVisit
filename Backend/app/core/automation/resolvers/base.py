from abc import ABC, abstractmethod
from uuid import UUID
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.user import User


class IAutomationContextResolver(ABC):

    @abstractmethod
    def resolve_customer_context(
        self,
        db: Session,
        business_id: UUID,
        customer_id: UUID,
    ) -> Dict[str, Any]:
        """
        Extracts customer variables (name, visits, spent, last visit, favorite service/dish, stylist/table, rebook link).
        """
        pass

    @abstractmethod
    def get_seed_templates(self) -> list[Dict[str, Any]]:
        """
        Returns default industry-specific campaign seed templates.
        """
        pass
