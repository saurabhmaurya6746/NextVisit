from datetime import datetime, timedelta, timezone
import hashlib
import ipaddress
import logging
import secrets
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client_device import ClientDevice
from app.models.dining_area import DiningArea
from app.models.lan_pairing import LanDevicePairing, LanPairingSession
from app.models.order import Order, OrderStatus
from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.repositories.client_device_repository import ClientDeviceRepository
from app.repositories.lan_pairing_repository import LanPairingRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.sync_transaction_repository import SyncTransactionRepository
from app.schemas.lan import (
    LanPairingClaimRequest,
    LanPairingClaimResponse,
    LanPairingInitiateResponse,
    LanRelayOrderItem,
    LanRelayPullResponse,
    LanRelayPushRequest,
    LanRelayPushResponse,
    LanStatusResponse,
)
from app.schemas.sync import SyncTransactionItem, SyncTransactionResult
from app.services.sync_service import SyncService

logger = logging.getLogger(__name__)


PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def is_private_lan_ip(client_host: str | None) -> bool:
    """
    Validates whether the incoming client IP address is a private LAN, loopback,
    or link-local address (RFC 1918 / RFC 3927 / RFC 4291).
    Rejects public Internet routable IPs.
    """
    if not client_host:
        return False
    if client_host in ("127.0.0.1", "::1", "localhost", "testclient"):
        return True
    try:
        ip = ipaddress.ip_address(client_host)
        return any(ip in net for net in PRIVATE_NETWORKS)
    except ValueError:
        return False



class LanCoordinatorService:
    PERMITTED_OPERATIONS = {"CREATE_ORDER", "DIRECT_SALE", "SETTLE_ORDER"}

    def __init__(self, db: Session):
        self.db = db
        self.pairing_repo = LanPairingRepository(db)
        self.device_repo = ClientDeviceRepository(db)
        self.tx_repo = SyncTransactionRepository(db)
        self.order_repo = OrderRepository(db)
        self.sync_service = SyncService(db)

    def get_status(self, business_id: UUID | None = None) -> LanStatusResponse:
        now = datetime.now(timezone.utc)
        is_open = False
        active_count = 0

        if business_id:
            valid_session = (
                self.db.query(LanPairingSession)
                .filter(
                    LanPairingSession.business_id == business_id,
                    LanPairingSession.is_claimed == False,  # noqa: E712
                    LanPairingSession.expires_at > now,
                )
                .first()
            )
            is_open = valid_session is not None

            active_count = (
                self.db.query(LanDevicePairing)
                .filter(
                    LanDevicePairing.business_id == business_id,
                    LanDevicePairing.is_revoked == False,  # noqa: E712
                    LanDevicePairing.token_expires_at > now,
                )
                .count()
            )

        return LanStatusResponse(
            coordinator_name="NextVisit Windows Desktop LAN Coordinator",
            business_id=business_id or UUID("00000000-0000-0000-0000-000000000000"),
            server_time=now,
            is_pairing_open=is_open,
            active_paired_devices_count=active_count,
            version="1.0.0",
        )

    def initiate_pairing(self, current_user: User) -> LanPairingInitiateResponse:
        """
        Generates a short-lived, 6-digit numeric pairing code approved by an authorized business user.
        Valid for 5 minutes (300 seconds).
        """
        if current_user.role.upper() not in ["OWNER", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners and administrators are authorized to initiate device pairing.",
            )

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=5)
        # Generate 6-digit numeric code (e.g. 849201)
        pairing_code = f"{secrets.randbelow(900000) + 100000}"

        session = self.pairing_repo.create_pairing_session(
            business_id=current_user.business_id,
            created_by_user_id=current_user.id,
            pairing_code=pairing_code,
            expires_at=expires_at,
        )

        return LanPairingInitiateResponse(
            pairing_code=session.pairing_code,
            expires_at=session.expires_at,
            expires_in_seconds=300,
            business_id=session.business_id,
        )

    def claim_pairing(self, req: LanPairingClaimRequest) -> LanPairingClaimResponse:
        """
        Claims a short-lived pairing code from an Android handheld on the LAN.
        Binds device to business and issues a cryptographically secure, scoped LAN session token.
        """
        now = datetime.now(timezone.utc)

        # 1. Lookup pairing session
        session = self.pairing_repo.get_pairing_session_by_code(req.pairing_code)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid pairing code.",
            )

        # 2. Check expiration
        if session.expires_at <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pairing code has expired. Please request a new code on the coordinator.",
            )

        # 3. Check already claimed (single-use)
        if session.is_claimed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pairing code has already been claimed.",
            )

        # 4. Strict cross-business check
        if session.business_id != req.business_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-business pairing forbidden: Pairing code belongs to a different business tenant.",
            )

        # 5. Device identity & registration check
        device = self.device_repo.get_by_id(req.device_id)
        if device:
            # Device already exists: ensure it belongs to this business
            if device.business_id != req.business_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cross-business device rejected: Device is already registered to another business.",
                )
            if not device.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Device has been deactivated or revoked by business administrator.",
                )
        else:
            # Device not registered yet: ensure prefix is not taken by another device for this business
            clean_prefix = req.device_prefix.strip().upper()
            import re
            if not re.match(r"^[A-Z0-9]{1,10}$", clean_prefix):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Device prefix must be 1-10 alphanumeric uppercase characters (e.g., 'MOB01', 'TAB01').",
                )
            existing_prefix_device = self.device_repo.get_by_prefix(req.business_id, clean_prefix)
            if existing_prefix_device and existing_prefix_device.id != req.device_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Device prefix '{clean_prefix}' is already in use by device '{existing_prefix_device.device_name}'.",
                )
            # Create client device registration directly with handheld device_id
            device = ClientDevice(
                id=req.device_id,
                business_id=req.business_id,
                device_name=req.device_name.strip(),
                device_type=req.device_type.strip(),
                device_prefix=clean_prefix,
                is_active=True,
            )
            device = self.device_repo.create(device)

        # 6. Mark pairing session as claimed

        self.pairing_repo.mark_session_claimed(session, device.id, now)

        # 7. Issue cryptographically secure LAN session token (valid 24 hours for daily shift)
        lan_token = f"lan_{secrets.token_urlsafe(32)}"
        lan_token_hash = hashlib.sha256(lan_token.encode("utf-8")).hexdigest()
        token_expires_at = now + timedelta(hours=24)

        self.pairing_repo.upsert_device_pairing(
            business_id=req.business_id,
            device_id=device.id,
            lan_token_hash=lan_token_hash,
            token_expires_at=token_expires_at,
        )

        return LanPairingClaimResponse(
            lan_token=lan_token,
            token_expires_at=token_expires_at,
            device_id=device.id,
            business_id=device.business_id,
            device_prefix=device.device_prefix,
            server_time=now,
        )

    def authenticate_lan_token(self, token: str) -> tuple[LanDevicePairing, ClientDevice]:
        """
        Validates LAN bearer token from paired Android handheld.
        Enforces token signature, expiration, active status, and device identity.
        """
        if not token or not token.strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing LAN authorization token.",
            )

        raw_token = token.strip()
        if raw_token.lower().startswith("bearer "):
            raw_token = raw_token[7:].strip()

        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        pairing = self.pairing_repo.get_pairing_by_token_hash(token_hash)
        if not pairing:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid LAN session token. Device is unpaired.",
            )

        if pairing.is_revoked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="LAN device pairing has been revoked by business administrator.",
            )

        now = datetime.now(timezone.utc)
        if pairing.token_expires_at <= now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="LAN session token has expired. Please re-pair with the coordinator.",
            )

        device = self.device_repo.get_by_id(pairing.device_id)
        if not device or not device.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device is inactive or has been deleted.",
            )

        self.pairing_repo.update_last_seen(pairing, now)
        return pairing, device

    def relay_push(
        self,
        pairing: LanDevicePairing,
        device: ClientDevice,
        data: LanRelayPushRequest,
    ) -> LanRelayPushResponse:
        """
        Processes relayed offline transactions from a paired Android handheld.
        Preserves client_tx_id, client_order_id, device_id, idempotency, and dependencies.
        Guarantees durable persistence on coordinator before acknowledgement.
        """
        # Anti-spoofing check: device_id in request must match authenticated LAN token
        if data.device_id != device.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Device spoofing rejected: Request device_id '{data.device_id}' does not match authenticated LAN session '{device.id}'.",
            )

        # Validate allowed operations
        for tx in data.transactions:
            op = tx.operation_type.strip().upper()
            if op not in self.PERMITTED_OPERATIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Operation '{op}' is not permitted over LAN relay. Permitted operations: {', '.join(sorted(self.PERMITTED_OPERATIONS))}",
                )

        # Resolve user proxy scoped strictly to this business
        # Uses an active business user ID to ensure foreign key integrity on orders.created_by
        biz_user = (
            self.db.query(User)
            .filter(User.business_id == device.business_id, User.is_active == True)  # noqa: E712
            .first()
        )
        proxy_user = biz_user or User(
            id=None,
            business_id=device.business_id,
            name=f"LAN {device.device_name}",
            role="STAFF",
            is_active=True,
        )


        # Dependency-safe ordering: CREATE_ORDER and DIRECT_SALE before SETTLE_ORDER
        indexed_items = list(enumerate(data.transactions))

        def op_priority(item_tuple):
            _, tx_item = item_tuple
            op = tx_item.operation_type.strip().upper()
            if op in ("CREATE_ORDER", "DIRECT_SALE"):
                return 0
            if op == "SETTLE_ORDER":
                return 1
            return 2

        sorted_items = sorted(indexed_items, key=op_priority)
        results_map: dict[int, SyncTransactionResult] = {}

        for orig_idx, item in sorted_items:
            result = self.sync_service._process_single_transaction(proxy_user, device, item)
            results_map[orig_idx] = result

        # Map back to original order
        results = [results_map[i] for i in range(len(data.transactions))]

        server_now = datetime.now(timezone.utc)
        device.last_sync_at = server_now
        # Durably commit all transactions before sending response
        self.db.commit()

        return LanRelayPushResponse(
            device_id=device.id,
            processed_count=len(results),
            server_time=server_now,
            results=results,
        )

    def relay_pull(
        self,
        pairing: LanDevicePairing,
        device: ClientDevice,
    ) -> LanRelayPullResponse:
        """
        Pulls active restaurant orders and dining table occupancy for the business
        so connected Android handhelds can see each other's live updates while offline.
        """
        server_now = datetime.now(timezone.utc)
        biz_id = device.business_id

        # Fetch recent non-cancelled orders for today
        orders = (
            self.db.query(Order)
            .filter(
                Order.business_id == biz_id,
                Order.status.in_([OrderStatus.OPEN, OrderStatus.SERVED]),
            )
            .order_by(Order.created_at.desc())
            .limit(100)
            .all()
        )

        order_dtos = []
        for o in orders:
            order_dtos.append(
                LanRelayOrderItem(
                    id=o.id,
                    order_number=o.order_number or "",
                    table_id=o.table_id,
                    table_name=o.table.table_name if o.table else None,
                    status=o.status.value if hasattr(o.status, "value") else str(o.status),
                    total_amount=float(o.total_amount or 0.0),
                    device_id=o.device_id,
                    client_order_id=o.client_order_id,
                    created_at=o.created_at,
                    items=[
                        {
                            "item_name": item.item_name,
                            "quantity": item.quantity,
                            "unit_price": float(item.unit_price),
                            "subtotal": float(item.subtotal),
                        }
                        for item in o.items
                    ],
                )
            )

        # Fetch tables and derive live occupancy from active orders
        tables = (
            self.db.query(RestaurantTable)
            .join(DiningArea, RestaurantTable.dining_area_id == DiningArea.id)
            .filter(DiningArea.business_id == biz_id, RestaurantTable.is_active == True)  # noqa: E712
            .all()
        )

        occupied_table_map = {
            o.table_id: str(o.id)
            for o in orders
            if o.table_id and o.status in (OrderStatus.OPEN, OrderStatus.SERVED)
        }

        table_statuses = [
            {
                "table_id": str(t.id),
                "table_name": t.table_name,
                "dining_area_id": str(t.dining_area_id),
                "capacity": t.capacity,
                "status": "OCCUPIED" if t.id in occupied_table_map else "AVAILABLE",
                "current_order_id": occupied_table_map.get(t.id),
            }
            for t in tables
        ]


        return LanRelayPullResponse(
            business_id=biz_id,
            server_time=server_now,
            orders=order_dtos,
            table_statuses=table_statuses,
        )

    def revoke_device_pairing(self, current_user: User, device_id: UUID) -> bool:
        if current_user.role.upper() not in ["OWNER", "ADMIN"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners and administrators can revoke device pairings.",
            )
        return self.pairing_repo.revoke_pairing(current_user.business_id, device_id)
