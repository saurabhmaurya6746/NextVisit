import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.service import Service
from app.models.user import User
from app.repositories.service_repository import ServiceRepository
from app.schemas.service import ServiceCreate, ServiceUpdate

logger = logging.getLogger(__name__)


class ServiceService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = ServiceRepository(db)

    def list_services(self, current_user: User) -> list[Service]:
        logger.info(
            "Listing services | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        return self.repo.get_all_by_business(current_user.business_id)

    def get_service(self, current_user: User, service_id: UUID) -> Service:
        service = self.repo.get_by_id(service_id)
        if not service or service.business_id != current_user.business_id:
            logger.warning(
                "Service not found or tenant mismatch | service_id=%s business_id=%s",
                service_id,
                current_user.business_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service not found.",
            )

        logger.info(
            "Service fetched | service_id=%s business_id=%s",
            service.id,
            service.business_id,
        )
        return service

    def create_service(
        self, current_user: User, data: ServiceCreate
    ) -> Service:
        logger.info(
            "Creating service | business_id=%s name=%s",
            current_user.business_id,
            data.name,
        )

        existing_service = self.repo.get_by_name(
            current_user.business_id, data.name
        )
        if existing_service:
            logger.warning(
                "Service creation rejected — duplicate name inside business | business_id=%s name=%s",
                current_user.business_id,
                data.name,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A service with this name already exists in your business.",
            )

        service = Service(
            business_id=current_user.business_id,
            **data.model_dump(),
        )
        created_service = self.repo.create(service)
        self.db.commit()
        self.db.refresh(created_service)

        logger.info(
            "Service created successfully | service_id=%s business_id=%s",
            created_service.id,
            created_service.business_id,
        )
        return created_service

    def update_service(
        self,
        current_user: User,
        service_id: UUID,
        data: ServiceUpdate,
    ) -> Service:
        service = self.get_service(current_user, service_id)

        if data.name is not None and data.name != service.name:
            existing_service = self.repo.get_by_name(
                current_user.business_id, data.name
            )
            if existing_service and existing_service.id != service.id:
                logger.warning(
                    "Service update rejected — duplicate name inside business | business_id=%s name=%s",
                    current_user.business_id,
                    data.name,
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A service with this name already exists in your business.",
                )

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(service, field, value)

        self.repo.update(service)
        self.db.commit()
        self.db.refresh(service)

        logger.info(
            "Service updated successfully | service_id=%s business_id=%s",
            service.id,
            service.business_id,
        )
        return service
