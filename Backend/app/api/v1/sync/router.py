from datetime import datetime
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.sync import (
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
)
from app.services.sync_service import SyncService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sync",
    tags=["POS Offline Synchronization"],
)


@router.post(
    "/push",
    response_model=SyncPushResponse,
    status_code=status.HTTP_200_OK,
    summary="Push offline order and billing transactions with guaranteed idempotency",
)
def sync_push(
    data: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SyncService(db).process_push(current_user, data)


@router.get(
    "/pull",
    response_model=SyncPullResponse,
    summary="Pull incremental master data updates (menu, dining areas, settings) for registered device",
)
def sync_pull(
    device_id: UUID = Query(..., description="Registered Client Device ID"),
    since: datetime | None = Query(default=None, description="Optional ISO timestamp cursor for delta synchronization"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return SyncService(db).process_pull(current_user, device_id, since=since)
