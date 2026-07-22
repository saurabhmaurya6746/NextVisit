import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.repositories.business_type_repository import BusinessTypeRepository

logger = logging.getLogger(__name__)


class BusinessTypeService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = BusinessTypeRepository(db)

    def get_all(self):
        logger.info("Fetching all business types")
        return self.repo.get_all()

    def get_by_id(self, business_type_id: UUID):
        logger.info("Fetching business type | id=%s", business_type_id)
        return self.repo.get_by_id(business_type_id)