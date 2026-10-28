from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

from app.schemas.sync import SyncTransactionItem, SyncTransactionResult


class LanStatusResponse(BaseModel):
    coordinator_name: str = Field(..., description="Human-readable LAN coordinator node name")
    business_id: UUID = Field(..., description="Active Business ID")
    server_time: datetime = Field(..., description="Coordinator UTC server timestamp")
    is_pairing_open: bool = Field(..., description="Whether a pairing session is currently active")
    active_paired_devices_count: int = Field(default=0, description="Count of currently active paired devices")
    version: str = Field(default="1.0.0", description="LAN Coordination Protocol Version")


class LanPairingInitiateResponse(BaseModel):
    pairing_code: str = Field(..., description="Short-lived 6-digit pairing code")
    expires_at: datetime = Field(..., description="Expiration timestamp (UTC)")
    expires_in_seconds: int = Field(..., description="Seconds remaining until expiration")
    business_id: UUID = Field(..., description="Business ID bound to this pairing session")


class LanPairingClaimRequest(BaseModel):
    pairing_code: str = Field(..., min_length=4, max_length=16, description="Short-lived pairing code")
    business_id: UUID = Field(..., description="Business ID being claimed")
    device_id: UUID = Field(..., description="Device UUID of the connecting Android device")
    device_name: str = Field(..., min_length=1, max_length=100, description="Name of the connecting device")
    device_type: str = Field(..., description="Device form factor (e.g. ANDROID_MOBILE, ANDROID_TABLET)")
    device_prefix: str = Field(..., min_length=1, max_length=10, description="Device order prefix (e.g. MOB01)")


class LanPairingClaimResponse(BaseModel):
    lan_token: str = Field(..., description="Cryptographically secure LAN session token")
    token_expires_at: datetime = Field(..., description="Token expiration timestamp")
    device_id: UUID = Field(..., description="Authenticated device UUID")
    business_id: UUID = Field(..., description="Authenticated business UUID")
    device_prefix: str = Field(..., description="Device order prefix")
    server_time: datetime = Field(..., description="Coordinator UTC server timestamp")


class LanRelayPushRequest(BaseModel):
    device_id: UUID = Field(..., description="Registered Device ID")
    transactions: list[SyncTransactionItem] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Batch of local offline transactions to relay to coordinator",
    )


class LanRelayPushResponse(BaseModel):
    device_id: UUID
    processed_count: int
    server_time: datetime
    results: list[SyncTransactionResult]


class LanRelayOrderItem(BaseModel):
    id: UUID
    order_number: str
    table_id: UUID | None = None
    table_name: str | None = None
    status: str
    total_amount: float
    device_id: UUID | None = None
    client_order_id: UUID | None = None
    created_at: datetime
    items: list[dict] = Field(default_factory=list)


class LanRelayPullResponse(BaseModel):
    business_id: UUID
    server_time: datetime
    orders: list[LanRelayOrderItem]
    table_statuses: list[dict]
