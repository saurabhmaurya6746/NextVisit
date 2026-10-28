import concurrent.futures
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.v1.devices.router import register_device
from tests.conftest import TestSessionLocal as SessionLocal
from app.models.business import Business, BusinessStatus
from app.models.client_device import ClientDevice
from app.models.dining_area import DiningArea
from app.models.order import Order, OrderStatus
from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.models.visit import Visit
from app.schemas.client_device import ClientDeviceCreate, ClientDeviceUpdate
from app.schemas.order import DirectSaleCreate, DirectSaleItemCreate, OrderCreate, OrderItemCreate, OrderSettleRequest
from app.repositories.client_device_repository import ClientDeviceRepository
from app.repositories.order_repository import OrderRepository
from app.schemas.sync import SyncPushRequest, SyncTransactionItem
from app.services.client_device_service import ClientDeviceService
from app.services.order_service import OrderService
from app.services.sync_service import SyncService


def test_device_registration_and_prefix_uniqueness(db: Session, test_setup: dict):
    user = test_setup["user"]
    service = ClientDeviceService(db)

    # 1. Register device with valid prefix
    data = ClientDeviceCreate(
        device_name="Front Desk Windows POS",
        device_type="DESKTOP_WINDOWS",
        device_prefix="D1",
        device_identifier="MAC-00-11-22-33",
    )
    device = service.register_device(user, data)
    assert device.id is not None
    assert device.device_prefix == "D1"
    assert device.is_active is True

    # 2. Duplicate prefix for same business must be rejected
    with pytest.raises(HTTPException) as exc_info:
        service.register_device(user, ClientDeviceCreate(
            device_name="Duplicate Desk",
            device_type="DESKTOP_WINDOWS",
            device_prefix="d1",  # Case-insensitive
        ))
    assert exc_info.value.status_code == 400
    assert "already registered" in exc_info.value.detail.lower()

    # 3. Invalid prefix format must be rejected
    with pytest.raises(HTTPException) as exc_info:
        service.register_device(user, ClientDeviceCreate(
            device_name="Invalid Prefix Desk",
            device_type="DESKTOP_WINDOWS",
            device_prefix="D-1@#",
        ))
    assert exc_info.value.status_code == 400


def test_unauthorized_device_push_rejected(db: Session, test_setup: dict):
    user = test_setup["user"]
    sync_service = SyncService(db)

    # Unknown device UUID
    req = SyncPushRequest(
        device_id=uuid4(),
        transactions=[
            SyncTransactionItem(
                client_tx_id=uuid4(),
                operation_type="DIRECT_SALE",
                payload={"test": "data"},
            )
        ],
    )
    with pytest.raises(HTTPException) as exc:
        sync_service.process_push(user, req)
    assert exc.value.status_code == 403
    assert "not registered" in exc.value.detail.lower()


def test_idempotent_transaction_retry_and_deduplication(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    # Register device
    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="Tablet 1",
        device_type="ANDROID_TABLET",
        device_prefix="T1",
    ))

    sync_service = SyncService(db)
    client_tx_id = uuid4()
    order_id = uuid4()

    sale_payload = {
        "id": str(order_id),
        "order_number": "ORD-T1-000001",
        "table_id": str(table.id),
        "customer_phone": "9876543210",
        "customer_name": "Rohan Sharma",
        "payment_method": "CASH",
        "discount_amount": 0.0,
        "tax_amount": 12.5,
        "items": [
            {
                "menu_item_id": str(item.id),
                "item_name": item.name,
                "unit_price": item.price,
                "quantity": 2,
                "tax_rate": 5.0,
                "discount": 0.0,
            }
        ],
    }

    push_req = SyncPushRequest(
        device_id=device.id,
        transactions=[
            SyncTransactionItem(
                client_tx_id=client_tx_id,
                operation_type="DIRECT_SALE",
                payload=sale_payload,
            )
        ],
    )

    # First attempt: must process successfully
    res1 = sync_service.process_push(user, push_req)
    assert res1.processed_count == 1
    assert res1.results[0].status == "SUCCESS"
    assert res1.results[0].status_code == 200
    first_data = res1.results[0].data
    assert first_data["order_id"] == str(order_id)
    assert first_data["order_number"] == "ORD-T1-000001"

    # Verify entities in DB
    order_count = db.query(Order).filter(Order.id == order_id).count()
    assert order_count == 1
    visit_count = db.query(Visit).filter(Visit.customer_id == first_data["customer_id"]).count()
    assert visit_count == 1

    # Second attempt: exact duplicate retry must return ALREADY_COMMITTED without duplicate rows
    res2 = sync_service.process_push(user, push_req)
    assert res2.processed_count == 1
    assert res2.results[0].status == "ALREADY_COMMITTED"
    assert res2.results[0].data == first_data

    # Ensure still exactly 1 order and 1 visit
    assert db.query(Order).filter(Order.id == order_id).count() == 1
    assert db.query(Visit).filter(Visit.customer_id == first_data["customer_id"]).count() == 1


def test_changed_payload_under_same_transaction_id_rejected(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="Billing POS",
        device_type="DESKTOP_WINDOWS",
        device_prefix="B1",
    ))

    sync_service = SyncService(db)
    client_tx_id = uuid4()

    payload_a = {
        "table_id": str(table.id),
        "customer_phone": "9998887771",
        "payment_method": "CASH",
        "items": [{"menu_item_id": str(item.id), "item_name": item.name, "unit_price": 250.0, "quantity": 1}],
    }

    # Push Payload A
    res1 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[SyncTransactionItem(client_tx_id=client_tx_id, operation_type="DIRECT_SALE", payload=payload_a)],
        ),
    )
    assert res1.results[0].status == "SUCCESS"

    # Push Payload B (different items/amounts) under the SAME transaction ID
    payload_b = {
        "table_id": str(table.id),
        "customer_phone": "9998887771",
        "payment_method": "UPI",
        "items": [{"menu_item_id": str(item.id), "item_name": item.name, "unit_price": 500.0, "quantity": 2}],
    }
    res2 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[SyncTransactionItem(client_tx_id=client_tx_id, operation_type="DIRECT_SALE", payload=payload_b)],
        ),
    )
    assert res2.results[0].status == "CONFLICT"
    assert res2.results[0].status_code == 409
    assert "different payload" in res2.results[0].error.lower()


def test_atomic_direct_sale_rollback_on_error(db: Session, test_setup: dict):
    user = test_setup["user"]
    order_service = OrderService(db)

    # Attempt direct sale on invalid table
    invalid_data = DirectSaleCreate(
        id=uuid4(),
        table_id=uuid4(),  # Non-existent table
        customer_phone="9876543219",
        payment_method="CASH",
        items=[
            DirectSaleItemCreate(
                item_name="Tea",
                unit_price=20.0,
                quantity=1,
            )
        ],
    )

    with pytest.raises(HTTPException) as exc:
        order_service.create_and_settle_order(user, invalid_data)
    assert exc.value.status_code == 404

    # Ensure no customer or order was committed
    assert db.query(Order).filter(Order.id == invalid_data.id).first() is None


def test_cross_business_tenant_isolation(db: Session, test_setup: dict):
    from app.core.security import hash_password
    from app.models.business import Business, BusinessStatus
    from app.models.user import User

    # Create Business B and User B
    bt = test_setup["business"].business_type_id
    biz_b = Business(
        business_type_id=bt,
        name="Business B Cafe",
        owner_name="Owner B",
        email=f"biz_b_{uuid4().hex[:6]}@example.com",
        phone="8887776665",
        country="India",
        currency="INR",
        timezone="Asia/Kolkata",
        address="Bangalore",
        status=BusinessStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(biz_b)
    db.commit()
    db.refresh(biz_b)

    user_b = User(
        business_id=biz_b.id,
        name="Owner B",
        email=f"user_b_{uuid4().hex[:6]}@example.com",
        hashed_password=hash_password("Secret@123"),
        role="OWNER",
        status="ACTIVE",
        is_active=True,
        is_verified=True,
    )
    db.add(user_b)
    db.commit()
    db.refresh(user_b)

    # Register device for Business A
    device_service = ClientDeviceService(db)
    dev_a = device_service.register_device(test_setup["user"], ClientDeviceCreate(
        device_name="Device A",
        device_prefix="DA",
    ))

    # User B attempts to push using Device A -> Must be rejected with 403
    sync_service = SyncService(db)
    with pytest.raises(HTTPException) as exc:
        sync_service.process_push(user_b, SyncPushRequest(
            device_id=dev_a.id,
            transactions=[SyncTransactionItem(client_tx_id=uuid4(), operation_type="DIRECT_SALE", payload={})],
        ))
    assert exc.value.status_code == 403

    # Cleanup Business B
    db.delete(user_b)
    db.delete(biz_b)
    db.commit()


def test_online_order_and_settlement_compatibility(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    # 1. Existing online order creation (no client id, no custom order number)
    online_order_data = OrderCreate(
        table_id=table.id,
        items=[
            OrderItemCreate(
                menu_item_id=item.id,
                item_name=item.name,
                unit_price=item.price,
                quantity=1,
            )
        ],
    )
    created = order_service.create_order(user, online_order_data)
    assert created.id is not None
    assert created.order_number.startswith("ORD-")
    assert created.status == OrderStatus.OPEN

    # 2. Existing online order settlement
    settle_data = OrderSettleRequest(
        phone="9988776655",
        customer_name="Priya Patel",
        payment_method="UPI",
    )
    settle_res = order_service.settle_order(user, created.id, settle_data)
    assert settle_res["order_id"] == created.id
    assert settle_res["payment_method"] == "UPI"
    assert settle_res["visit_id"] is not None

    # Verify status changed to SERVED
    db.refresh(created)
    assert created.status == OrderStatus.SERVED


def test_concurrent_duplicate_requests(test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    # Register device
    dev_db = SessionLocal()
    dev_service = ClientDeviceService(dev_db)
    dev = dev_service.register_device(user, ClientDeviceCreate(
        device_name="Concurrency POS",
        device_prefix="CP",
    ))
    dev_id = dev.id
    dev_db.close()

    tx_id = uuid4()
    req = SyncPushRequest(
        device_id=dev_id,
        transactions=[
            SyncTransactionItem(
                client_tx_id=tx_id,
                operation_type="DIRECT_SALE",
                payload={
                    "table_id": str(table.id),
                    "customer_phone": "9112233445",
                    "customer_name": "Concurrent Guest",
                    "payment_method": "CASH",
                    "items": [
                        {
                            "menu_item_id": str(item.id),
                            "item_name": item.name,
                            "unit_price": item.price,
                            "quantity": 1,
                        }
                    ],
                },
            )
        ],
    )

    def submit_push():
        local_db = SessionLocal()
        try:
            local_sync = SyncService(local_db)
            return local_sync.process_push(user, req)
        finally:
            local_db.close()

    # Execute 2 concurrent requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(submit_push)
        f2 = executor.submit(submit_push)
        res1 = f1.result()
        res2 = f2.result()

    statuses = [res1.results[0].status, res2.results[0].status]
    assert "SUCCESS" in statuses
    assert "ALREADY_COMMITTED" in statuses or statuses.count("SUCCESS") == 1


def test_mismatched_operation_type_replay_rejected(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="Replay Test Device",
        device_type="DESKTOP_WINDOWS",
        device_prefix="RP",
    ))

    sync_service = SyncService(db)
    client_tx_id = uuid4()

    # Step 1: Submit DIRECT_SALE
    res1 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=client_tx_id,
                    operation_type="DIRECT_SALE",
                    payload={
                        "table_id": str(table.id),
                        "customer_phone": "9998881111",
                        "payment_method": "CASH",
                        "items": [{"menu_item_id": str(item.id), "item_name": item.name, "unit_price": 100.0, "quantity": 1}],
                    },
                )
            ],
        ),
    )
    assert res1.results[0].status == "SUCCESS"

    # Step 2: Attempt replay using same client_tx_id but operation_type="CREATE_ORDER"
    res2 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=client_tx_id,
                    operation_type="CREATE_ORDER",
                    payload={
                        "table_id": str(table.id),
                        "items": [{"menu_item_id": str(item.id), "quantity": 1}],
                    },
                )
            ],
        ),
    )
    assert res2.results[0].status == "CONFLICT"
    assert res2.results[0].status_code == 409
    assert "different payload or operation type" in res2.results[0].error.lower()


def test_mismatched_device_prefix_order_number_rejected(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="Prefix Test POS",
        device_type="DESKTOP_WINDOWS",
        device_prefix="PX",
    ))

    sync_service = SyncService(db)

    # Attempt to sync with order_number that does not match ORD-PX- prefix
    res = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=uuid4(),
                    operation_type="CREATE_ORDER",
                    payload={
                        "table_id": str(table.id),
                        "order_number": "ORD-OTHER-000001",
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "unit_price": item.price,
                                "quantity": 1,
                            }
                        ],
                    },
                )
            ],
        ),
    )
    assert res.results[0].status == "FAILED"
    assert res.results[0].status_code == 400
    assert "must start with device prefix 'ORD-PX-'" in res.results[0].error


def test_device_spoofing_prevented_in_order_creation(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    legit_device = device_service.register_device(user, ClientDeviceCreate(
        device_name="Legit POS",
        device_type="DESKTOP_WINDOWS",
        device_prefix="LG",
    ))
    fake_device_id = uuid4()

    sync_service = SyncService(db)
    res = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=legit_device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=uuid4(),
                    operation_type="CREATE_ORDER",
                    payload={
                        "table_id": str(table.id),
                        "device_id": str(fake_device_id),
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "unit_price": item.price,
                                "quantity": 1,
                            }
                        ],
                    },
                )
            ],
        ),
    )
    assert res.results[0].status == "SUCCESS"
    created_order_id = UUID(res.results[0].data["id"])
    saved_order = db.query(Order).filter(Order.id == created_order_id).first()
    assert saved_order.device_id == legit_device.id


def test_cross_tenant_table_order_rejected(db: Session, test_setup: dict):
    user1 = test_setup["user"]
    item1 = test_setup["item"]
    order_service = OrderService(db)

    # Create a second business and table
    biz2 = Business(
        business_type_id=test_setup["business"].business_type_id,
        name=f"Other Biz {uuid4().hex[:6]}",
        owner_name="Other Owner",
        email=f"other_{uuid4().hex[:6]}@example.com",
        phone="9998887711",
        country="India",
        currency="INR",
        timezone="Asia/Kolkata",
        address="456 Other St",
        status=BusinessStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(biz2)
    db.commit()
    db.refresh(biz2)

    area2 = DiningArea(business_id=biz2.id, name="Other Area", display_order=1)
    db.add(area2)
    db.commit()
    db.refresh(area2)

    table2 = RestaurantTable(business_id=biz2.id, dining_area_id=area2.id, table_name="T-Other", is_active=True)
    db.add(table2)
    db.commit()
    db.refresh(table2)

    # user1 from biz1 attempts to create order on table2 belonging to biz2
    with pytest.raises(HTTPException) as exc:
        order_service.create_order(
            user1,
            OrderCreate(
                table_id=table2.id,
                items=[
                    OrderItemCreate(
                        menu_item_id=item1.id,
                        item_name=item1.name,
                        unit_price=item1.price,
                        quantity=1,
                    )
                ],
            ),
        )
    assert exc.value.status_code == 403
    assert "belongs to another business" in exc.value.detail


def test_cross_tenant_settle_order_rejected(db: Session, test_setup: dict):
    user1 = test_setup["user"]
    table1 = test_setup["table"]
    item1 = test_setup["item"]
    order_service = OrderService(db)

    # Create order in biz1
    order1 = order_service.create_order(
        user1,
        OrderCreate(
            table_id=table1.id,
            items=[
                OrderItemCreate(
                    menu_item_id=item1.id,
                    item_name=item1.name,
                    unit_price=item1.price,
                    quantity=1,
                )
            ],
        ),
    )

    # Create a user in biz2
    biz2 = Business(
        business_type_id=test_setup["business"].business_type_id,
        name=f"Other Biz {uuid4().hex[:6]}",
        owner_name="Other Owner",
        email=f"other_{uuid4().hex[:6]}@example.com",
        phone="9998887722",
        country="India",
        currency="INR",
        timezone="Asia/Kolkata",
        address="456 Other St",
        status=BusinessStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(biz2)
    db.commit()
    db.refresh(biz2)

    user2 = User(
        business_id=biz2.id,
        name="User Biz 2",
        email=f"user2_{uuid4().hex[:6]}@example.com",
        hashed_password="hash",
        role="OWNER",
        status="ACTIVE",
        is_active=True,
        is_verified=True,
    )
    db.add(user2)
    db.commit()
    db.refresh(user2)

    # user2 attempts to settle user1's order
    with pytest.raises(HTTPException) as exc:
        order_service.settle_order(
            user2,
            order1.id,
            OrderSettleRequest(payment_method="CASH", phone="9998887771"),
        )
    assert exc.value.status_code == 403
    assert "belongs to another business" in exc.value.detail


def test_non_owner_device_registration_forbidden(db: Session, test_setup: dict):
    waiter = User(
        business_id=test_setup["business"].id,
        name="Waiter Joe",
        email=f"waiter_{uuid4().hex[:6]}@example.com",
        hashed_password="hash",
        role="WAITER",
        status="ACTIVE",
        is_active=True,
        is_verified=True,
    )
    with pytest.raises(HTTPException) as exc:
        register_device(
            data=ClientDeviceCreate(
                device_name="Unauthorized Device",
                device_type="DESKTOP_WINDOWS",
                device_prefix="UA",
            ),
            current_user=waiter,
            db=db,
        )
    assert exc.value.status_code == 403
    assert "Only owners and administrators" in exc.value.detail


def test_sync_push_max_limit_enforced():
    fake_txs = [
        SyncTransactionItem(
            client_tx_id=uuid4(),
            operation_type="DIRECT_SALE",
            payload={"table_id": str(uuid4())},
        )
        for _ in range(101)
    ]
    with pytest.raises(ValidationError):
        SyncPushRequest(device_id=uuid4(), transactions=fake_txs)


def test_sync_pull_delta_with_since(db: Session, test_setup: dict):
    user = test_setup["user"]
    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="Delta Test Device",
        device_type="DESKTOP_WINDOWS",
        device_prefix="DL",
    ))

    sync_service = SyncService(db)

    # Initial pull (since=None)
    pull_all = sync_service.process_pull(user, device.id)
    assert len(pull_all.menu_categories) >= 1
    assert len(pull_all.dining_areas) >= 1

    # Future since should return 0 modified categories
    future_time = datetime.now(timezone.utc) + timedelta(days=1)
    pull_future = sync_service.process_pull(user, device.id, since=future_time)
    assert len(pull_future.menu_categories) == 0
    assert len(pull_future.dining_areas) == 0


def test_sync_push_settle_order_offline_lifecycle(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    # 1. Register device
    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="Settlement POS",
        device_type="DESKTOP_WINDOWS",
        device_prefix="ST1",
    ))

    # 2. Create an open order
    order_service = OrderService(db)
    order = order_service.create_order(
        user,
        OrderCreate(
            table_id=table.id,
            items=[
                OrderItemCreate(
                    menu_item_id=item.id,
                    item_name=item.name,
                    unit_price=item.price,
                    quantity=2,
                )
            ],
        ),
    )
    assert order.status == OrderStatus.OPEN

    sync_service = SyncService(db)
    client_tx_id = uuid4()

    settle_tx = SyncTransactionItem(
        client_tx_id=client_tx_id,
        operation_type="SETTLE_ORDER",
        payload={
            "order_id": str(order.id),
            "settle_data": {
                "phone": "9876543210",
                "customer_name": "Offline Customer",
                "payment_method": "CASH",
                "discount_amount": 0.0,
            },
        },
    )

    # 3. First sync push succeeds and settles order
    resp1 = sync_service.process_push(user, SyncPushRequest(device_id=device.id, transactions=[settle_tx]))
    assert resp1.processed_count == 1
    assert resp1.results[0].status == "SUCCESS"
    assert resp1.results[0].status_code == 200

    # Verify order is SERVED
    db.refresh(order)
    assert order.status == OrderStatus.SERVED

    # 4. Repeated sync with SAME client_tx_id returns ALREADY_COMMITTED without duplicate settlement
    resp2 = sync_service.process_push(user, SyncPushRequest(device_id=device.id, transactions=[settle_tx]))
    assert resp2.processed_count == 1
    assert resp2.results[0].status == "ALREADY_COMMITTED"
    assert resp2.results[0].status_code == 200

    # 5. Push with DIFFERENT client_tx_id on already settled order must be rejected (400 "Order is already served")
    diff_tx = SyncTransactionItem(
        client_tx_id=uuid4(),
        operation_type="SETTLE_ORDER",
        payload={
            "order_id": str(order.id),
            "settle_data": {
                "phone": "9876543210",
                "payment_method": "CASH",
            },
        },
    )
    resp3 = sync_service.process_push(user, SyncPushRequest(device_id=device.id, transactions=[diff_tx]))
    assert resp3.processed_count == 1
    assert resp3.results[0].status == "FAILED"
    assert resp3.results[0].status_code == 400
    assert "already served" in resp3.results[0].error.lower()


def test_phase8_batch_push_mixed_outcomes(db: Session, test_setup: dict):
    """
    Phase 8: Safe batch push with independent per-item acknowledgements:
    - 1 valid new CREATE_ORDER -> SUCCESS (200)
    - 1 duplicate replay -> ALREADY_COMMITTED (200)
    - 1 malformed/invalid payload -> FAILED (400)
    - 1 conflicting payload for an existing tx_id -> CONFLICT (409)
    """
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    sync_service = SyncService(db)

    device_repo = ClientDeviceRepository(db)
    device = device_repo.create(
        ClientDevice(
            business_id=user.business_id,
            device_name="Phase8 Mixed Batch POS",
            device_type="DESKTOP_WINDOWS",
            device_prefix="MX01",
            is_active=True,
        )
    )

    # Pre-commit two initial transactions: one for duplicate test, one for conflict test
    tx_dup_id = uuid4()
    tx_dup_order = SyncTransactionItem(
        client_tx_id=tx_dup_id,
        operation_type="CREATE_ORDER",
        payload={
            "order_number": f"ORD-{device.device_prefix}-000001",
            "table_id": str(table.id),
            "order_source": "POS",
            "items": [
                {
                    "menu_item_id": str(item.id),
                    "item_name": item.name,
                    "unit_price": item.price,
                    "quantity": 1,
                    "tax_rate": 5.0,
                    "discount": 0.0,
                }
            ],
        },
    )

    tx_conf_id = uuid4()
    tx_conf_orig = SyncTransactionItem(
        client_tx_id=tx_conf_id,
        operation_type="CREATE_ORDER",
        payload={
            "order_number": f"ORD-{device.device_prefix}-000002",
            "table_id": str(table.id),
            "order_source": "POS",
            "items": [
                {
                    "menu_item_id": str(item.id),
                    "item_name": item.name,
                    "unit_price": item.price,
                    "quantity": 1,
                    "tax_rate": 5.0,
                    "discount": 0.0,
                }
            ],
        },
    )

    pre_resp = sync_service.process_push(
        user,
        SyncPushRequest(device_id=device.id, transactions=[tx_dup_order, tx_conf_orig]),
    )
    assert pre_resp.results[0].status == "SUCCESS"
    assert pre_resp.results[1].status == "SUCCESS"

    # Now prepare mixed batch of 4 items:
    # 1. New valid order
    tx_new = SyncTransactionItem(
        client_tx_id=uuid4(),
        operation_type="CREATE_ORDER",
        payload={
            "order_number": f"ORD-{device.device_prefix}-000003",
            "table_id": str(table.id),
            "order_source": "POS",
            "items": [
                {
                    "menu_item_id": str(item.id),
                    "item_name": item.name,
                    "unit_price": item.price,
                    "quantity": 2,
                    "tax_rate": 5.0,
                    "discount": 0.0,
                }
            ],
        },
    )
    # 2. Duplicate of tx_dup_order (exact match)
    tx_dup = tx_dup_order
    # 3. Invalid schema / nonexistent operation
    tx_invalid = SyncTransactionItem(
        client_tx_id=uuid4(),
        operation_type="UNKNOWN_UNSUPPORTED_OP",
        payload={"some": "data"},
    )
    # 4. Conflict: same client_tx_id as tx_conf_orig, but altered payload
    conflict_payload = dict(tx_conf_orig.payload)
    conflict_payload["notes"] = "Altered payload to trigger conflict"
    tx_conflict = SyncTransactionItem(
        client_tx_id=tx_conf_id,
        operation_type="CREATE_ORDER",
        payload=conflict_payload,
    )

    batch_resp = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[tx_new, tx_dup, tx_invalid, tx_conflict],
        ),
    )

    assert batch_resp.processed_count == 4

    # Verify per-item independent outcomes:
    # Item 1: SUCCESS
    assert batch_resp.results[0].client_tx_id == tx_new.client_tx_id
    assert batch_resp.results[0].status == "SUCCESS"
    assert batch_resp.results[0].status_code == 200

    # Item 2: ALREADY_COMMITTED
    assert batch_resp.results[1].client_tx_id == tx_dup.client_tx_id
    assert batch_resp.results[1].status == "ALREADY_COMMITTED"
    assert batch_resp.results[1].status_code == 200

    # Item 3: FAILED (independent failure, does not fail the batch)
    assert batch_resp.results[2].client_tx_id == tx_invalid.client_tx_id
    assert batch_resp.results[2].status == "FAILED"
    assert batch_resp.results[2].status_code == 400
    assert "unsupported sync operation_type" in batch_resp.results[2].error.lower()

    # Item 4: CONFLICT
    assert batch_resp.results[3].client_tx_id == tx_conflict.client_tx_id
    assert batch_resp.results[3].status == "CONFLICT"
    assert batch_resp.results[3].status_code == 409


def test_phase8_clock_skew_and_utc_server_time(db: Session, test_setup: dict):
    """
    Phase 8: Confirms that both push and pull endpoints return timezone-aware UTC server_time
    for client clock skew detection and cursor advancement.
    """
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    sync_service = SyncService(db)
    device_repo = ClientDeviceRepository(db)
    device = device_repo.create(
        ClientDevice(
            business_id=user.business_id,
            device_name="Phase8 Time POS",
            device_type="DESKTOP_WINDOWS",
            device_prefix="TM01",
            is_active=True,
        )
    )

    dummy_tx = SyncTransactionItem(
        client_tx_id=uuid4(),
        operation_type="CREATE_ORDER",
        payload={
            "order_number": f"ORD-{device.device_prefix}-000001",
            "table_id": str(table.id),
            "order_source": "POS",
            "items": [
                {
                    "menu_item_id": str(item.id),
                    "item_name": item.name,
                    "unit_price": item.price,
                    "quantity": 1,
                    "tax_rate": 5.0,
                    "discount": 0.0,
                }
            ],
        },
    )

    # 1. Test Push returns server_time
    push_resp = sync_service.process_push(
        user,
        SyncPushRequest(device_id=device.id, transactions=[dummy_tx]),
    )
    assert push_resp.server_time is not None
    assert push_resp.server_time.tzinfo is not None

    # 2. Test Pull returns server_time
    pull_resp = sync_service.process_pull(user, device.id)
    assert pull_resp.server_time is not None
    assert pull_resp.server_time.tzinfo is not None


def test_phase8_tombstone_propagation_in_delta_pull(db: Session, test_setup: dict):
    """
    Phase 8: Tests tombstone / soft-deletion propagation in delta pull:
    Deactivated categories and unavailable items are included in delta sync when updated >= since,
    allowing clients to deactivate/hide records in their local cache.
    """
    user = test_setup["user"]
    category = test_setup["category"]
    item = test_setup["item"]
    device_repo = ClientDeviceRepository(db)
    device = device_repo.create(
        ClientDevice(
            business_id=user.business_id,
            device_name="Phase8 Delta POS",
            device_type="DESKTOP_WINDOWS",
            device_prefix="DL01",
            is_active=True,
        )
    )

    # Baseline timestamp
    t0 = datetime.now(timezone.utc)

    # Deactivate category and mark item unavailable (tombstone)
    category.is_active = False
    category.updated_at = datetime.now(timezone.utc)
    item.is_available = False
    item.updated_at = datetime.now(timezone.utc)
    db.commit()

    sync_service = SyncService(db)
    delta_resp = sync_service.process_pull(user, device.id, since=t0)

    # Check category tombstone is included
    cat_ids = [c["id"] for c in delta_resp.menu_categories]
    assert str(category.id) in cat_ids
    found_cat = next(c for c in delta_resp.menu_categories if c["id"] == str(category.id))
    assert found_cat["is_active"] is False

    # Check item tombstone is included
    found_item = next(it for it in found_cat["items"] if it["id"] == str(item.id))
    assert found_item["is_available"] is False


def test_phase8_simulated_restart_outbox_repush(db: Session, test_setup: dict):
    """
    Phase 8: Simulates client app crash and restart:
    Client repushes previously committed transactions. All return ALREADY_COMMITTED idempotently
    with original response payloads, without creating duplicate orders or duplicate items in database.
    """
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    sync_service = SyncService(db)
    device_repo = ClientDeviceRepository(db)
    device = device_repo.create(
        ClientDevice(
            business_id=user.business_id,
            device_name="Phase8 Restart POS",
            device_type="DESKTOP_WINDOWS",
            device_prefix="RS01",
            is_active=True,
        )
    )

    tx1_id = uuid4()
    tx2_id = uuid4()
    tx1 = SyncTransactionItem(
        client_tx_id=tx1_id,
        operation_type="CREATE_ORDER",
        payload={
            "order_number": f"ORD-{device.device_prefix}-000001",
            "table_id": str(table.id),
            "order_source": "POS",
            "items": [
                {
                    "menu_item_id": str(item.id),
                    "item_name": item.name,
                    "unit_price": item.price,
                    "quantity": 1,
                    "tax_rate": 5.0,
                    "discount": 0.0,
                }
            ],
        },
    )
    tx2 = SyncTransactionItem(
        client_tx_id=tx2_id,
        operation_type="CREATE_ORDER",
        payload={
            "order_number": f"ORD-{device.device_prefix}-000002",
            "table_id": str(table.id),
            "order_source": "POS",
            "items": [
                {
                    "menu_item_id": str(item.id),
                    "item_name": item.name,
                    "unit_price": item.price,
                    "quantity": 1,
                    "tax_rate": 5.0,
                    "discount": 0.0,
                }
            ],
        },
    )

    # 1. Initial push before simulated crash
    resp1 = sync_service.process_push(user, SyncPushRequest(device_id=device.id, transactions=[tx1, tx2]))
    assert resp1.results[0].status == "SUCCESS"
    assert resp1.results[1].status == "SUCCESS"
    order1_id = resp1.results[0].data["id"]
    order2_id = resp1.results[1].data["id"]

    # 2. Client crashes before acknowledging in outbox; on restart client repushes both
    resp2 = sync_service.process_push(user, SyncPushRequest(device_id=device.id, transactions=[tx1, tx2]))
    assert resp2.results[0].status == "ALREADY_COMMITTED"
    assert resp2.results[1].status == "ALREADY_COMMITTED"
    assert resp2.results[0].data["id"] == order1_id
    assert resp2.results[1].data["id"] == order2_id

    # 3. Verify exactly 2 orders exist in database for this device prefix, no duplicates
    orders = db.query(Order).filter(Order.business_id == user.business_id).all()
    rs_orders = [o for o in orders if o.order_number.startswith(f"ORD-{device.device_prefix}-")]
    assert len(rs_orders) == 2


def test_offline_local_uuid_settle_order_mapping_and_idempotency(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    # 1. Register device
    device_service = ClientDeviceService(db)
    device = device_service.register_device(
        user,
        ClientDeviceCreate(
            device_name="Offline POS Desk",
            device_type="DESKTOP_WINDOWS",
            device_prefix="OP01",
        ),
    )

    sync_service = SyncService(db)
    local_order_uuid = uuid4()
    create_tx_id = uuid4()

    # 2. Push CREATE_ORDER with offline-style client_order_id (local UUID) and no id
    create_payload = {
        "client_order_id": str(local_order_uuid),
        "order_number": f"ORD-{device.device_prefix}-000001",
        "table_id": str(table.id),
        "order_source": "POS",
        "status": "OPEN",
        "subtotal": float(item.price),
        "tax_amount": 0.0,
        "discount_amount": 0.0,
        "total_amount": float(item.price),
        "items": [
            {
                "menu_item_id": str(item.id),
                "item_name": item.name,
                "unit_price": float(item.price),
                "quantity": 1,
                "tax_rate": 0.0,
                "discount": 0.0,
            }
        ],
    }

    push_create_resp = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=create_tx_id,
                    operation_type="CREATE_ORDER",
                    payload=create_payload,
                )
            ],
        ),
    )
    assert push_create_resp.results[0].status == "SUCCESS"
    server_order_id = UUID(push_create_resp.results[0].data["id"])

    # Verify server order ID is different from local_order_uuid, but client_order_id is preserved
    assert server_order_id != local_order_uuid
    created_db_order = db.query(Order).filter(Order.id == server_order_id).first()
    assert created_db_order is not None
    assert created_db_order.client_order_id == local_order_uuid
    assert created_db_order.status == OrderStatus.OPEN

    # 3. Push SETTLE_ORDER using the local_order_uuid (as sent by offline client outbox)
    settle_tx_id = uuid4()
    settle_payload = {
        "order_id": str(local_order_uuid),  # Local UUID, not server_order_id
        "settle_data": {
            "customer_name": "Test Customer",
            "phone": "9876543210",
            "payment_method": "CASH",
            "payment_status": "RECORDED_OFFLINE",
            "receipt_reference": f"REC-ORD-{device.device_prefix}-000001",
            "discount_amount": 0.0,
        },
    }

    push_settle_resp = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=settle_tx_id,
                    operation_type="SETTLE_ORDER",
                    payload=settle_payload,
                )
            ],
        ),
    )

    assert push_settle_resp.results[0].status == "SUCCESS"
    assert push_settle_resp.results[0].status_code == 200

    # Verify payment/order status in DB
    db.refresh(created_db_order)
    assert created_db_order.status == OrderStatus.SERVED

    # Verify visit was created for this settled order
    visit_id = UUID(push_settle_resp.results[0].data["visit_id"])
    created_visit = db.query(Visit).filter(Visit.id == visit_id).first()
    assert created_visit is not None
    assert created_visit.status.value == "COMPLETED"
    assert created_visit.payment_status.value == "PAID"

    # 4. Idempotency test: Re-send the exact same settlement transaction
    push_retry_resp = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=settle_tx_id,
                    operation_type="SETTLE_ORDER",
                    payload=settle_payload,
                )
            ],
        ),
    )
    assert push_retry_resp.results[0].status == "ALREADY_COMMITTED"
    assert push_retry_resp.results[0].status_code == 200
    assert push_retry_resp.results[0].data["visit_id"] == str(visit_id)

    # Ensure no duplicate visit was created
    all_visits = db.query(Visit).filter(Visit.business_id == user.business_id).all()
    assert len(all_visits) == 1


def test_regression_same_create_order_tx_retry_returns_already_committed(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Mobile",
        device_type="ANDROID_MOBILE",
        device_prefix="M1",
    ))
    sync_service = SyncService(db)

    tx_id = uuid4()
    local_order_id = uuid4()
    order_number = f"ORD-{device.device_prefix}-000001"

    order_payload = {
        "client_order_id": str(local_order_id),
        "order_number": order_number,
        "table_id": str(table.id),
        "order_source": "POS",
        "status": "OPEN",
        "subtotal": 250.0,
        "tax_amount": 12.5,
        "discount_amount": 0.0,
        "total_amount": 262.5,
        "items": [
            {
                "menu_item_id": str(item.id),
                "item_name": item.name,
                "unit_price": 250.0,
                "quantity": 1,
                "tax_rate": 5.0,
                "discount": 0.0,
            }
        ],
    }

    # 1. First push
    res1 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=tx_id,
                    operation_type="CREATE_ORDER",
                    payload=order_payload,
                )
            ],
        ),
    )
    assert res1.results[0].status == "SUCCESS"
    assert res1.results[0].status_code == 200

    # 2. Same transaction retry
    res2 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=tx_id,
                    operation_type="CREATE_ORDER",
                    payload=order_payload,
                )
            ],
        ),
    )
    assert res2.results[0].status == "ALREADY_COMMITTED"
    assert res2.results[0].status_code == 200

    # Verify only 1 order created in DB
    orders_in_db = db.query(Order).filter(Order.business_id == user.business_id).all()
    assert len(orders_in_db) == 1
    assert orders_in_db[0].order_number == order_number


def test_regression_same_order_number_different_client_order_id_rejected(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Mobile 2",
        device_type="ANDROID_MOBILE",
        device_prefix="M2",
    ))
    sync_service = SyncService(db)

    order_number = f"ORD-{device.device_prefix}-000001"
    local_order_id_1 = uuid4()
    local_order_id_2 = uuid4()

    # 1. First order commits with local_order_id_1
    res1 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=uuid4(),
                    operation_type="CREATE_ORDER",
                    payload={
                        "client_order_id": str(local_order_id_1),
                        "order_number": order_number,
                        "table_id": str(table.id),
                        "order_source": "POS",
                        "status": "OPEN",
                        "subtotal": 250.0,
                        "tax_amount": 12.5,
                        "discount_amount": 0.0,
                        "total_amount": 262.5,
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "unit_price": 250.0,
                                "quantity": 1,
                                "tax_rate": 5.0,
                                "discount": 0.0,
                            }
                        ],
                    },
                )
            ],
        ),
    )
    assert res1.results[0].status == "SUCCESS"

    # 2. Conflicting order with same order_number but different client_order_id
    res2 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=uuid4(),
                    operation_type="CREATE_ORDER",
                    payload={
                        "client_order_id": str(local_order_id_2),
                        "order_number": order_number,
                        "table_id": str(table.id),
                        "order_source": "POS",
                        "status": "OPEN",
                        "subtotal": 250.0,
                        "tax_amount": 12.5,
                        "discount_amount": 0.0,
                        "total_amount": 262.5,
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "unit_price": 250.0,
                                "quantity": 1,
                                "tax_rate": 5.0,
                                "discount": 0.0,
                            }
                        ],
                    },
                )
            ],
        ),
    )
    assert res2.results[0].status == "FAILED"
    assert res2.results[0].status_code == 409
    assert "different client order id" in res2.results[0].error.lower()

    # 3. Matching retry with same client_order_id and device returns success idempotently
    res3 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=uuid4(),
                    operation_type="CREATE_ORDER",
                    payload={
                        "client_order_id": str(local_order_id_1),
                        "order_number": order_number,
                        "table_id": str(table.id),
                        "order_source": "POS",
                        "status": "OPEN",
                        "subtotal": 250.0,
                        "tax_amount": 12.5,
                        "discount_amount": 0.0,
                        "total_amount": 262.5,
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "unit_price": 250.0,
                                "quantity": 1,
                                "tax_rate": 5.0,
                                "discount": 0.0,
                            }
                        ],
                    },
                )
            ],
        ),
    )
    assert res3.results[0].status == "SUCCESS"
    assert res3.results[0].data["order_number"] == order_number


def test_regression_repeated_settlement_retry_no_duplicate_records(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Mobile 3",
        device_type="ANDROID_MOBILE",
        device_prefix="M3",
    ))
    sync_service = SyncService(db)

    local_order_id = uuid4()
    order_number = f"ORD-{device.device_prefix}-000001"

    # Create order
    sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=uuid4(),
                    operation_type="CREATE_ORDER",
                    payload={
                        "client_order_id": str(local_order_id),
                        "order_number": order_number,
                        "table_id": str(table.id),
                        "order_source": "POS",
                        "status": "OPEN",
                        "subtotal": 500.0,
                        "tax_amount": 25.0,
                        "discount_amount": 0.0,
                        "total_amount": 525.0,
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "unit_price": 500.0,
                                "quantity": 1,
                                "tax_rate": 5.0,
                                "discount": 0.0,
                            }
                        ],
                    },
                )
            ],
        ),
    )

    settle_payload = {
        "order_id": str(local_order_id),
        "settle_data": {
            "phone": "9876543210",
            "customer_name": "Loyalty Tester",
            "payment_method": "CASH",
            "receipt_reference": f"REC-{order_number}",
            "payment_status": "PAID",
        },
    }

    settle_tx_id = uuid4()

    # 1. First settlement
    res1 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=settle_tx_id,
                    operation_type="SETTLE_ORDER",
                    payload=settle_payload,
                )
            ],
        ),
    )
    assert res1.results[0].status == "SUCCESS"
    assert res1.results[0].status_code == 200

    # Count visits and customer stats
    visits_after_1 = db.query(Visit).filter(Visit.business_id == user.business_id).all()
    assert len(visits_after_1) == 1

    # 2. Same settlement retry (exact client outbox retry behavior)
    res2 = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=settle_tx_id,
                    operation_type="SETTLE_ORDER",
                    payload=settle_payload,
                )
            ],
        ),
    )
    assert res2.results[0].status == "ALREADY_COMMITTED"
    assert res2.results[0].status_code == 200

    # Verify no duplicate visit created
    visits_after_2 = db.query(Visit).filter(Visit.business_id == user.business_id).all()
    assert len(visits_after_2) == 1

    # Verify customer visit_count did not increment twice
    from app.models.customer import Customer
    cust = db.query(Customer).filter(Customer.business_id == user.business_id, Customer.phone == "9876543210").first()
    assert cust.visit_count == 1
    assert cust.total_spent == 500.0


def test_regression_batch_out_of_order_create_and_settle(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Mobile 4",
        device_type="ANDROID_MOBILE",
        device_prefix="M4",
    ))
    sync_service = SyncService(db)

    local_order_id = uuid4()
    order_number = f"ORD-{device.device_prefix}-000001"
    tx_create = uuid4()
    tx_settle = uuid4()

    # Batch where SETTLE_ORDER is placed BEFORE CREATE_ORDER
    batch_req = SyncPushRequest(
        device_id=device.id,
        transactions=[
            SyncTransactionItem(
                client_tx_id=tx_settle,
                operation_type="SETTLE_ORDER",
                payload={
                    "order_id": str(local_order_id),
                    "settle_data": {
                        "phone": "9112233445",
                        "customer_name": "Out Of Order Customer",
                        "payment_method": "UPI",
                        "receipt_reference": f"REC-{order_number}",
                    },
                },
            ),
            SyncTransactionItem(
                client_tx_id=tx_create,
                operation_type="CREATE_ORDER",
                payload={
                    "client_order_id": str(local_order_id),
                    "order_number": order_number,
                    "table_id": str(table.id),
                    "order_source": "POS",
                    "status": "OPEN",
                    "subtotal": 300.0,
                    "tax_amount": 15.0,
                    "discount_amount": 0.0,
                    "total_amount": 315.0,
                    "items": [
                        {
                            "menu_item_id": str(item.id),
                            "item_name": item.name,
                            "unit_price": 300.0,
                            "quantity": 1,
                            "tax_rate": 5.0,
                            "discount": 0.0,
                        }
                    ],
                },
            ),
        ],
    )

    batch_res = sync_service.process_push(user, batch_req)

    # Response results maintain the same index order as input transactions:
    # index 0: SETTLE_ORDER, index 1: CREATE_ORDER
    assert batch_res.results[0].client_tx_id == tx_settle
    assert batch_res.results[0].status == "SUCCESS"
    assert batch_res.results[0].status_code == 200

    assert batch_res.results[1].client_tx_id == tx_create
    assert batch_res.results[1].status == "SUCCESS"
    assert batch_res.results[1].status_code == 200

    # Verify order is SERVED in DB
    order_in_db = db.query(Order).filter(Order.order_number == order_number).first()
    assert order_in_db is not None
    assert order_in_db.status == OrderStatus.SERVED


def test_regression_settle_order_uncommitted_defers_with_503(db: Session, test_setup: dict):
    user = test_setup["user"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Mobile 5",
        device_type="ANDROID_MOBILE",
        device_prefix="M5",
    ))
    sync_service = SyncService(db)

    uncommitted_order_id = uuid4()
    tx_settle = uuid4()

    # Attempt to settle an order that does not exist in the database
    res = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=tx_settle,
                    operation_type="SETTLE_ORDER",
                    payload={
                        "order_id": str(uncommitted_order_id),
                        "settle_data": {
                            "phone": "9998881112",
                            "payment_method": "CASH",
                        },
                    },
                )
            ],
        ),
    )

    # Must be 503 SERVICE_UNAVAILABLE (retryable/deferred), NOT a permanent 404 failure!
    assert res.results[0].status == "FAILED"
    assert res.results[0].status_code == 503
    assert "not yet committed on server" in res.results[0].error.lower()


def test_regression_create_order_rejects_missing_identity_metadata(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    # 1. Manually insert an order that has an order_number but NO client_order_id (e.g. legacy/direct order)
    legacy_order = Order(
        business_id=user.business_id,
        order_number="ORD-LEGACY-000001",
        status=OrderStatus.OPEN,
        table_id=table.id,
        device_id=None,
        client_order_id=None,
        total_amount=100.0,
    )
    db.add(legacy_order)
    db.commit()
    db.refresh(legacy_order)
    assert legacy_order.client_order_id is None

    # 2. Incoming order creation attempts to reuse that order_number with a client_order_id
    incoming_data = OrderCreate(
        order_number="ORD-LEGACY-000001",
        client_order_id=uuid4(),
        table_id=table.id,
        items=[
            OrderItemCreate(
                menu_item_id=item.id,
                item_name=item.name,
                quantity=1,
                unit_price=item.price,
            )
        ],
    )

    with pytest.raises(HTTPException) as exc:
        order_service.create_order(user, incoming_data)
    assert exc.value.status_code == 409
    assert "without verified client order identity" in exc.value.detail.lower()

    # Verify existing DB row was NOT modified or claimed
    db.refresh(legacy_order)
    assert legacy_order.client_order_id is None


def test_regression_create_order_rejects_contradictory_device_id(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)
    device_service = ClientDeviceService(db)

    dev1 = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Terminal 1",
        device_type="DESKTOP_WINDOWS",
        device_prefix="T1",
    ))
    dev2 = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Terminal 2",
        device_type="DESKTOP_WINDOWS",
        device_prefix="T2",
    ))

    client_order_id = uuid4()
    order_number = "ORD-T1-000099"

    # Order registered under dev1
    ord1 = Order(
        business_id=user.business_id,
        order_number=order_number,
        status=OrderStatus.OPEN,
        table_id=table.id,
        device_id=dev1.id,
        client_order_id=client_order_id,
        total_amount=100.0,
    )
    db.add(ord1)
    db.commit()

    # dev2 attempts to create/claim the same order_number
    incoming_data = OrderCreate(
        order_number=order_number,
        client_order_id=client_order_id,
        device_id=dev2.id,
        table_id=table.id,
        items=[
            OrderItemCreate(
                menu_item_id=item.id,
                item_name=item.name,
                quantity=1,
                unit_price=item.price,
            )
        ],
    )

    with pytest.raises(HTTPException) as exc:
        order_service.create_order(user, incoming_data)
    assert exc.value.status_code == 409
    assert "contradictory device" in exc.value.detail.lower()


def test_regression_settle_order_does_not_settle_unrelated_order_by_receipt_ref(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Mobile 6",
        device_type="ANDROID_MOBILE",
        device_prefix="M6",
    ))
    sync_service = SyncService(db)

    # Legacy or unverified order in DB with NO client_order_id
    order_number = "ORD-M6-000088"
    unrelated_order = Order(
        business_id=user.business_id,
        order_number=order_number,
        status=OrderStatus.OPEN,
        table_id=table.id,
        device_id=None,
        client_order_id=None,
        total_amount=150.0,
    )
    db.add(unrelated_order)
    db.commit()
    db.refresh(unrelated_order)

    visit_count_before = db.query(Visit).count()

    incoming_local_uuid = uuid4()
    tx_settle = uuid4()

    # Attempt to settle using local UUID and receipt_reference pointing to unrelated_order
    res = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=tx_settle,
                    operation_type="SETTLE_ORDER",
                    payload={
                        "order_id": str(incoming_local_uuid),
                        "settle_data": {
                            "phone": "9998887776",
                            "payment_method": "CASH",
                            "receipt_reference": f"REC-{order_number}",
                        },
                    },
                )
            ],
        ),
    )

    # Must be rejected with 409 Conflict, NOT matched or settled!
    assert res.results[0].status == "FAILED"
    assert res.results[0].status_code == 409
    assert "contradictory client/device identity" in res.results[0].error.lower()

    # Verify unrelated order remains completely untouched:
    db.refresh(unrelated_order)
    assert unrelated_order.status == OrderStatus.OPEN  # NOT SERVED or SETTLED
    assert unrelated_order.client_order_id is None       # NO client_order_id adoption
    assert unrelated_order.device_id is None             # NO device_id adoption

    # Verify no Visit was created
    visit_count_after = db.query(Visit).count()
    assert visit_count_after == visit_count_before


def test_regression_cancelled_order_sequence_freed_for_offline_order_retry(db: Session, test_setup: dict):
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    device_service = ClientDeviceService(db)
    device = device_service.register_device(user, ClientDeviceCreate(
        device_name="POS Mobile 7",
        device_type="ANDROID_MOBILE",
        device_prefix="M7",
    ))
    sync_service = SyncService(db)

    order_number = f"ORD-{device.device_prefix}-000001"
    old_client_id = uuid4()

    # 1. Old cancelled order on the server
    old_cancelled = Order(
        business_id=user.business_id,
        order_number=order_number,
        status=OrderStatus.CANCELLED,
        table_id=table.id,
        device_id=device.id,
        client_order_id=old_client_id,
        total_amount=150.0,
    )
    db.add(old_cancelled)
    db.commit()
    db.refresh(old_cancelled)
    old_cancelled_id = old_cancelled.id

    # 2. Offline device creates a new order that reused the sequence counter
    new_local_id = uuid4()
    tx_create = uuid4()
    tx_settle = uuid4()

    # Push CREATE_ORDER
    res_create = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=tx_create,
                    operation_type="CREATE_ORDER",
                    payload={
                        "client_order_id": str(new_local_id),
                        "order_number": order_number,
                        "table_id": str(table.id),
                        "order_source": "POS",
                        "status": "OPEN",
                        "subtotal": 250.0,
                        "tax_amount": 12.5,
                        "discount_amount": 0.0,
                        "total_amount": 262.5,
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "unit_price": 250.0,
                                "quantity": 1,
                                "tax_rate": 5.0,
                                "discount": 0.0,
                            }
                        ],
                    },
                )
            ],
        ),
    )
    assert res_create.results[0].status == "SUCCESS"
    assert res_create.results[0].status_code == 200

    # Verify old cancelled order remains strictly immutable (no renaming or mutation)
    db.refresh(old_cancelled)
    assert old_cancelled.status == OrderStatus.CANCELLED
    assert old_cancelled.order_number == order_number
    assert old_cancelled.client_order_id == old_client_id

    # Verify new offline order was safely reconciled to the next available sequence
    new_order = db.query(Order).filter(Order.business_id == user.business_id, Order.client_order_id == new_local_id).first()
    assert new_order is not None
    assert new_order.order_number == f"ORD-{device.device_prefix}-000002"
    assert new_order.client_order_id == new_local_id
    assert new_order.id != old_cancelled_id
    assert new_order.status == OrderStatus.OPEN

    # 3. Push SETTLE_ORDER for the new local order using local UUID
    res_settle = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=tx_settle,
                    operation_type="SETTLE_ORDER",
                    payload={
                        "order_id": str(new_local_id),
                        "settle_data": {
                            "phone": "9876543210",
                            "payment_method": "CASH",
                            "receipt_reference": f"REC-{order_number}",
                            "payment_status": "PAID",
                        },
                    },
                )
            ],
        ),
    )
    assert res_settle.results[0].status == "SUCCESS"
    assert res_settle.results[0].status_code == 200

    # Verify new order is now SERVED, and cancelled order remains completely untouched
    db.refresh(new_order)
    db.refresh(old_cancelled)
    assert new_order.status == OrderStatus.SERVED
    assert old_cancelled.status == OrderStatus.CANCELLED
    assert old_cancelled.order_number == order_number

    # 4. Resending CREATE_ORDER with original payload returns reconciled order idempotently
    res_retry = sync_service.process_push(
        user,
        SyncPushRequest(
            device_id=device.id,
            transactions=[
                SyncTransactionItem(
                    client_tx_id=uuid4(),
                    operation_type="CREATE_ORDER",
                    payload={
                        "client_order_id": str(new_local_id),
                        "order_number": order_number,
                        "table_id": str(table.id),
                        "order_source": "POS",
                        "status": "OPEN",
                        "subtotal": 250.0,
                        "tax_amount": 12.5,
                        "discount_amount": 0.0,
                        "total_amount": 262.5,
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "unit_price": 250.0,
                                "quantity": 1,
                                "tax_rate": 5.0,
                                "discount": 0.0,
                            }
                        ],
                    },
                )
            ],
        ),
    )
    assert res_retry.results[0].status == "SUCCESS"
    assert res_retry.results[0].data["order_number"] == new_order.order_number

    # 5. Verify process_pull returns device_order_sequence reflecting the highest sequence
    pull_res = sync_service.process_pull(user, device.id)
    assert pull_res.device_order_sequence == 2






