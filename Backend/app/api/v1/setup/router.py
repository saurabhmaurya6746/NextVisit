from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.setup import AreaSetupItem, AreaSetupResponse
from app.services.dining_area_service import DiningAreaService

router = APIRouter(prefix="/setup", tags=["Restaurant Setup"])


@router.post("/tables", response_model=AreaSetupResponse, status_code=status.HTTP_201_CREATED, summary="Batch setup restaurant dining areas and tables")
def setup_restaurant_tables(
    items: list[AreaSetupItem],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return DiningAreaService(db).batch_setup_tables(current_user, items)
