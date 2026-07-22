from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.business_type_service import BusinessTypeService
from app.schemas.business_type import BusinessTypeResponse

router = APIRouter(
    prefix="/business-types",
    tags=["Business Types"],
)


@router.get(
    "",
    response_model=list[BusinessTypeResponse],
)
def get_business_types(
    db: Session = Depends(get_db),
):
    return BusinessTypeService(db).get_all()