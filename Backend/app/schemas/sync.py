from datetime import datetime, timezone
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class SyncTransactionItem(BaseModel):
    client_tx_id: UUID
    operation_type: str = Field(..., min_length=1, max_length=50)  # e.g., "CREATE_ORDER", "SETTLE_ORDER", "DIRECT_SALE"
    payload: dict[str, Any]


class SyncPushRequest(BaseModel):
    device_id: UUID
    transactions: list[SyncTransactionItem] = Field(..., min_length=1, max_length=100)


class SyncTransactionResult(BaseModel):
    client_tx_id: UUID
    status: str  # "SUCCESS", "ALREADY_COMMITTED", "FAILED", "CONFLICT"
    status_code: int = 200
    data: dict[str, Any] | None = None
    error: str | None = None


class SyncPushResponse(BaseModel):
    device_id: UUID
    processed_count: int
    results: list[SyncTransactionResult]
    server_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SyncPullResponse(BaseModel):
    business_id: UUID
    server_time: datetime
    menu_categories: list[dict[str, Any]]
    dining_areas: list[dict[str, Any]]
    business_settings: dict[str, Any] | None
    device_order_sequence: int | None = None
