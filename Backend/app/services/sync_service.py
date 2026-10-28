import hashlib
import json
import logging
from datetime import datetime, timezone
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.client_device import ClientDevice
from app.models.order import Order, OrderStatus
from app.models.sync_transaction import SyncTransaction
from app.models.user import User
from app.repositories.client_device_repository import ClientDeviceRepository
from app.repositories.dining_area_repository import DiningAreaRepository
from app.repositories.menu_repository import MenuRepository
from app.repositories.sync_transaction_repository import SyncTransactionRepository
from app.schemas.dining_area import DiningAreaResponse
from app.schemas.menu import MenuCategoryResponse
from app.schemas.order import DirectSaleCreate, OrderCreate, OrderResponse, OrderSettleRequest
from app.schemas.sync import (
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncTransactionItem,
    SyncTransactionResult,
)
from app.services.business_settings_service import BusinessSettingsService
from app.services.order_service import OrderService

logger = logging.getLogger(__name__)


class SyncService:

    def __init__(self, db: Session):
        self.db = db
        self.tx_repo = SyncTransactionRepository(db)
        self.device_repo = ClientDeviceRepository(db)
        self.order_service = OrderService(db)
        self.menu_repo = MenuRepository(db)
        self.dining_area_repo = DiningAreaRepository(db)
        self.biz_settings_service = BusinessSettingsService(db)

    @staticmethod
    def compute_payload_hash(operation_type: str, payload: dict) -> str:
        """Deterministic canonical JSON SHA-256 hash including operation_type."""
        wrapped = {"op": operation_type.strip().upper(), "payload": payload}
        canonical_str = json.dumps(wrapped, sort_keys=True, default=str)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def process_push(self, current_user: User, data: SyncPushRequest) -> SyncPushResponse:
        device = self.device_repo.get_by_id_and_business(data.device_id, current_user.business_id)
        if not device or not device.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Device '{data.device_id}' is not registered or is inactive for this business.",
            )

        # Dependency-safe ordering:
        # Sort items so CREATE_ORDER / DIRECT_SALE are processed before SETTLE_ORDER.
        # Track original indices to return results matching request order.
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
            result = self._process_single_transaction(current_user, device, item)
            results_map[orig_idx] = result

        results = [results_map[i] for i in range(len(data.transactions))]

        server_now = datetime.now(timezone.utc)
        device.last_sync_at = server_now
        self.db.commit()

        return SyncPushResponse(
            device_id=device.id,
            processed_count=len(results),
            results=results,
            server_time=server_now,
        )

    def _process_single_transaction(
        self, current_user: User, device: ClientDevice, item: SyncTransactionItem
    ) -> SyncTransactionResult:
        normalized_op = item.operation_type.strip().upper()
        payload_hash = self.compute_payload_hash(normalized_op, item.payload)

        # 1. Check idempotency registry
        existing = self.tx_repo.get_by_client_tx_id(current_user.business_id, item.client_tx_id)
        if existing:
            if existing.operation_type != normalized_op or existing.payload_hash != payload_hash:
                logger.warning(
                    "Sync conflict: tx_id=%s already exists with different operation/payload (stored op=%s, incoming op=%s)",
                    item.client_tx_id,
                    existing.operation_type,
                    normalized_op,
                )
                return SyncTransactionResult(
                    client_tx_id=item.client_tx_id,
                    status="CONFLICT",
                    status_code=status.HTTP_409_CONFLICT,
                    error="Transaction ID already exists with a different payload or operation type.",
                )

            # Idempotent match: return original committed result
            return SyncTransactionResult(
                client_tx_id=item.client_tx_id,
                status="ALREADY_COMMITTED",
                status_code=existing.status_code,
                data=existing.response_payload,
            )

        # 2. Process new transaction atomically
        try:
            resp_data = self._execute_operation(current_user, device, item)

            sync_tx = SyncTransaction(
                business_id=current_user.business_id,
                device_id=device.id,
                client_tx_id=item.client_tx_id,
                operation_type=normalized_op,
                payload_hash=payload_hash,
                status="COMMITTED",
                status_code=status.HTTP_200_OK,
                response_payload=resp_data,
            )
            self.db.add(sync_tx)
            self.db.commit()

            return SyncTransactionResult(
                client_tx_id=item.client_tx_id,
                status="SUCCESS",
                status_code=status.HTTP_200_OK,
                data=resp_data,
            )

        except IntegrityError:
            self.db.rollback()
            # Concurrent race condition: another thread committed the same tx_id
            committed = self.tx_repo.get_by_client_tx_id(current_user.business_id, item.client_tx_id)
            if committed:
                if committed.operation_type == normalized_op and committed.payload_hash == payload_hash:
                    return SyncTransactionResult(
                        client_tx_id=item.client_tx_id,
                        status="ALREADY_COMMITTED",
                        status_code=committed.status_code,
                        data=committed.response_payload,
                    )
                return SyncTransactionResult(
                    client_tx_id=item.client_tx_id,
                    status="CONFLICT",
                    status_code=status.HTTP_409_CONFLICT,
                    error="Transaction ID already exists with a different payload or operation type.",
                )
            return SyncTransactionResult(
                client_tx_id=item.client_tx_id,
                status="FAILED",
                status_code=status.HTTP_400_BAD_REQUEST,
                error="Database integrity violation during transaction processing.",
            )

        except HTTPException as he:
            self.db.rollback()
            return SyncTransactionResult(
                client_tx_id=item.client_tx_id,
                status="FAILED",
                status_code=he.status_code,
                error=he.detail,
            )

        except Exception as ex:
            self.db.rollback()
            logger.error("Error processing sync transaction %s: %s", item.client_tx_id, ex, exc_info=True)
            return SyncTransactionResult(
                client_tx_id=item.client_tx_id,
                status="FAILED",
                status_code=status.HTTP_400_BAD_REQUEST,
                error=str(ex),
            )

    def _execute_operation(
        self, current_user: User, device: ClientDevice, item: SyncTransactionItem
    ) -> dict:
        op = item.operation_type.strip().upper()
        expected_prefix = f"ORD-{device.device_prefix}-"

        if op == "CREATE_ORDER":
            order_data = OrderCreate(**item.payload)
            # Unconditionally bind device.id to prevent client device spoofing
            order_data.device_id = device.id
            if order_data.order_number and not order_data.order_number.startswith(expected_prefix):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Order number '{order_data.order_number}' must start with device prefix '{expected_prefix}'.",
                )
            created = self.order_service.create_order(current_user, order_data, auto_commit=False)
            return OrderResponse.model_validate(created).model_dump(mode="json")

        elif op == "SETTLE_ORDER":
            incoming_order_id = UUID(str(item.payload["order_id"]))
            # Safely resolve order: offline settlement payload provides client_order_id (local UUID),
            # while server settlement or direct API calls may pass server Order.id.
            resolved = self.order_service.order_repo.resolve_order(
                business_id=current_user.business_id,
                order_id_or_client_id=incoming_order_id,
                device_id=device.id,
            )

            # Fallback: check if order can be identified by receipt_reference if present (e.g. REC-ORD-POS01-000001)
            # If an order is found by receipt_reference but resolve_order did not match it,
            # that means its client identity or device is unverified or contradictory.
            # Do NOT settle or attach IDs based on receipt_reference / order_number alone!
            if not resolved and "settle_data" in item.payload:
                receipt_ref = str(item.payload["settle_data"].get("receipt_reference") or "")
                if receipt_ref.startswith("REC-"):
                    candidate_order_num = receipt_ref[4:].strip()
                    candidate = self.order_service.order_repo.get_by_order_number(
                        business_id=current_user.business_id,
                        order_number=candidate_order_num,
                    )
                    if candidate:
                        if candidate.status == OrderStatus.CANCELLED:
                            # Candidate is an old cancelled order, not the active order being settled.
                            # CREATE_ORDER for this local UUID may be in-flight or retrying; defer with 503 rather than terminal conflict.
                            pass
                        else:
                            logger.warning(
                                "SETTLE_ORDER conflict: order %s found for receipt %s, but identity mismatch (existing_client_id=%s, incoming=%s, existing_device=%s, incoming_device=%s)",
                                candidate.id,
                                receipt_ref,
                                candidate.client_order_id,
                                incoming_order_id,
                                candidate.device_id,
                                device.id,
                            )
                            raise HTTPException(
                                status_code=status.HTTP_409_CONFLICT,
                                detail=f"Settlement receipt reference '{receipt_ref}' points to order '{candidate_order_num}' which has unverified or contradictory client/device identity.",
                            )

            if not resolved:
                # Ordering / dependency safe: CREATE_ORDER has not committed yet.
                # Do NOT return a terminal 404 failure. Return 503 so outbox worker defers for retry.
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Order '{incoming_order_id}' not yet committed on server; settlement deferred for retry.",
                )

            server_order_id = resolved.id
            settle_data = OrderSettleRequest(**item.payload["settle_data"])
            settled = self.order_service.settle_order(current_user, server_order_id, settle_data, auto_commit=False)
            return json.loads(json.dumps(settled, default=str))

        elif op == "DIRECT_SALE":
            sale_data = DirectSaleCreate(**item.payload)
            # Unconditionally bind device.id to prevent client device spoofing
            sale_data.device_id = device.id
            if sale_data.order_number and not sale_data.order_number.startswith(expected_prefix):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Order number '{sale_data.order_number}' must start with device prefix '{expected_prefix}'.",
                )
            direct_result = self.order_service.create_and_settle_order(current_user, sale_data, auto_commit=False)
            return json.loads(json.dumps(direct_result, default=str))

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported sync operation_type: '{item.operation_type}'. Supported: CREATE_ORDER, SETTLE_ORDER, DIRECT_SALE.",
            )

    def process_pull(
        self, current_user: User, device_id: UUID, since: datetime | None = None
    ) -> SyncPullResponse:
        device = self.device_repo.get_by_id_and_business(device_id, current_user.business_id)
        if not device or not device.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Device '{device_id}' is not registered or is inactive for this business.",
            )

        # Use the start of the pull as the next cursor. Changes committed while
        # this response is being assembled then have updated_at > this cursor
        # and will be included in the next pull instead of being skipped.
        cursor_time = datetime.now(timezone.utc)

        categories = self.menu_repo.list_categories(current_user.business_id)
        if since:
            categories = [
                c
                for c in categories
                if (c.updated_at and c.updated_at >= since)
                or any(item.updated_at and item.updated_at >= since for item in c.items)
            ]
        # Return full active/inactive state so clients can update and deactivate local records
        serialized_cats = [
            MenuCategoryResponse.model_validate(c).model_dump(mode="json")
            for c in categories
        ]

        dining_areas = self.dining_area_repo.list_by_business(current_user.business_id)
        if since:
            dining_areas = [
                a
                for a in dining_areas
                if (a.updated_at and a.updated_at >= since)
                or any(t.updated_at and t.updated_at >= since for t in a.tables)
            ]
        serialized_areas = [
            DiningAreaResponse.model_validate(a).model_dump(mode="json")
            for a in dining_areas
        ]

        biz_settings = self.biz_settings_service.get_settings(current_user)
        biz_settings_dict = (
            {
                "currency": biz_settings.currency,
                "timezone": biz_settings.timezone,
                "enable_gst": biz_settings.enable_gst,
                "tax_percentage": biz_settings.tax_percentage,
                "invoice_prefix": biz_settings.invoice_prefix,
                "receipt_paper_size": biz_settings.receipt_paper_size,
                "payment_upi_id": biz_settings.payment_upi_id,
                "payment_payee_name": biz_settings.payment_payee_name,
            }
            if biz_settings
            else None
        )

        server_now = datetime.now(timezone.utc)
        device.last_sync_at = server_now
        self.db.commit()

        # Calculate highest order sequence for this device prefix across all orders (including cancelled)
        # to seed client local sequence and prevent offline collisions
        prefix_pattern = f"ORD-{device.device_prefix}-"
        orders_stmt = select(Order.order_number).where(
            Order.business_id == current_user.business_id,
            Order.order_number.like(f"{prefix_pattern}%"),
        )
        existing_nums = self.db.scalars(orders_stmt).all()
        max_device_seq = 0
        for num_str in existing_nums:
            suffix = (num_str or "")[len(prefix_pattern):]
            if suffix.isdigit():
                max_device_seq = max(max_device_seq, int(suffix))

        return SyncPullResponse(
            business_id=current_user.business_id,
            server_time=cursor_time,
            menu_categories=serialized_cats,
            dining_areas=serialized_areas,
            business_settings=biz_settings_dict,
            device_order_sequence=max_device_seq,
        )
