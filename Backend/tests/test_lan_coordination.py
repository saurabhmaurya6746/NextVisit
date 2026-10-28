from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.main import app
from app.models.business import Business
from app.models.client_device import ClientDevice
from app.models.dining_area import DiningArea
from app.models.lan_pairing import LanDevicePairing, LanPairingSession
from app.models.order import Order, OrderStatus
from app.models.restaurant_table import RestaurantTable
from app.models.sync_transaction import SyncTransaction
from app.models.user import User
from app.models.visit import Visit
from app.repositories.lan_pairing_repository import LanPairingRepository
from app.schemas.client_device import ClientDeviceCreate
from app.schemas.lan import (
    LanPairingClaimRequest,
    LanRelayPushRequest,
)
from app.schemas.sync import SyncTransactionItem
from app.services.client_device_service import ClientDeviceService
from app.services.lan_coordinator_service import LanCoordinatorService, is_private_lan_ip
from tests.conftest import TestSessionLocal


@pytest.fixture
def client():
    return TestClient(app)


def test_private_lan_ip_detection():
    # Loopback & RFC 1918 private IPs must pass
    assert is_private_lan_ip("127.0.0.1") is True
    assert is_private_lan_ip("::1") is True
    assert is_private_lan_ip("192.168.1.100") is True
    assert is_private_lan_ip("10.0.0.50") is True
    assert is_private_lan_ip("172.20.10.2") is True
    assert is_private_lan_ip("testclient") is True

    # Public internet IPs must be rejected
    assert is_private_lan_ip("8.8.8.8") is False
    assert is_private_lan_ip("104.244.42.1") is False
    assert is_private_lan_ip("203.0.113.5") is False
    assert is_private_lan_ip(None) is False


def test_lan_coordinator_status_healthy_and_no_secrets(client: TestClient, test_setup: dict):
    biz = test_setup["business"]
    res = client.get(f"/api/v1/lan/status?business_id={biz.id}")
    assert res.status_code == 200
    data = res.json()

    assert data["coordinator_name"] == "NextVisit Windows Desktop LAN Coordinator"
    assert data["business_id"] == str(biz.id)
    assert data["version"] == "1.0.0"
    assert data["is_pairing_open"] is False

    # Security check: Zero secrets leaked
    res_text = res.text.lower()
    assert "password" not in res_text
    assert "secret" not in res_text
    assert "token" not in res_text
    assert "postgresql" not in res_text


def test_lan_interface_public_ip_rejected(client: TestClient, test_setup: dict):
    biz = test_setup["business"]
    # Simulate a public IP attempting to access the LAN coordinator
    res = client.get(
        f"/api/v1/lan/status?business_id={biz.id}",
        headers={"x-forwarded-for": "198.51.100.45"},
    )
    assert res.status_code == 403
    assert "restricted strictly to private local network" in res.json()["detail"].lower()


def test_lan_pairing_initiation_and_role_authorization(client: TestClient, test_setup: dict, db: Session):
    owner = test_setup["user"]
    biz = test_setup["business"]

    # 1. Owner authorization succeeds
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz.id)})
    res = client.post(
        "/api/v1/lan/pairing/initiate",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 201
    init_data = res.json()
    assert len(init_data["pairing_code"]) == 6
    assert init_data["pairing_code"].isdigit()
    assert init_data["expires_in_seconds"] == 300
    assert init_data["business_id"] == str(biz.id)

    # 2. Non-owner / Staff role forbidden
    from app.core.security import hash_password
    staff_user = User(
        business_id=biz.id,
        name="Waiter Joe",
        email=f"waiter_{uuid4().hex[:6]}@example.com",
        hashed_password=hash_password("StaffPass123"),
        role="STAFF",
        is_active=True,
    )

    db.add(staff_user)
    db.commit()
    db.refresh(staff_user)

    staff_token = create_access_token(data={"sub": str(staff_user.id), "business_id": str(biz.id)})
    res_staff = client.post(
        "/api/v1/lan/pairing/initiate",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff.status_code == 403
    assert "only owners and administrators" in res_staff.json()["detail"].lower()


def test_lan_pairing_claim_and_token_issuance(client: TestClient, test_setup: dict, db: Session):
    owner = test_setup["user"]
    biz = test_setup["business"]
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz.id)})

    # 1. Initiate pairing
    init_res = client.post(
        "/api/v1/lan/pairing/initiate",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    code = init_res.json()["pairing_code"]

    # 2. Android device claims pairing
    device_id = uuid4()
    claim_payload = {
        "pairing_code": code,
        "business_id": str(biz.id),
        "device_id": str(device_id),
        "device_name": "Table Captain Mobile A",
        "device_type": "ANDROID_MOBILE",
        "device_prefix": "MOB01",
    }
    claim_res = client.post("/api/v1/lan/pairing/claim", json=claim_payload)
    assert claim_res.status_code == 200
    claim_data = claim_res.json()

    assert claim_data["lan_token"].startswith("lan_")
    assert claim_data["device_id"] == str(device_id)
    assert claim_data["business_id"] == str(biz.id)
    assert claim_data["device_prefix"] == "MOB01"

    # 3. One-time code claim reuse must be rejected
    reuse_res = client.post("/api/v1/lan/pairing/claim", json=claim_payload)
    assert reuse_res.status_code == 400
    assert "already been claimed" in reuse_res.json()["detail"].lower()


def test_lan_pairing_claim_expired_rejected(client: TestClient, test_setup: dict, db: Session):
    owner = test_setup["user"]
    biz = test_setup["business"]
    pairing_repo = LanPairingRepository(db)

    # Manually insert expired session
    past = datetime.now(timezone.utc) - timedelta(minutes=10)
    session = pairing_repo.create_pairing_session(
        business_id=biz.id,
        created_by_user_id=owner.id,
        pairing_code="999888",
        expires_at=past,
    )

    claim_payload = {
        "pairing_code": "999888",
        "business_id": str(biz.id),
        "device_id": str(uuid4()),
        "device_name": "Late Tablet",
        "device_type": "ANDROID_TABLET",
        "device_prefix": "TAB01",
    }
    claim_res = client.post("/api/v1/lan/pairing/claim", json=claim_payload)
    assert claim_res.status_code == 400
    assert "expired" in claim_res.json()["detail"].lower()


def test_lan_pairing_claim_cross_business_rejected(client: TestClient, test_setup: dict, db: Session):
    owner = test_setup["user"]
    biz_a = test_setup["business"]
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz_a.id)})

    # Business A initiates pairing
    init_res = client.post(
        "/api/v1/lan/pairing/initiate",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    code = init_res.json()["pairing_code"]

    # Business B attempts to claim Business A's pairing code
    biz_b = Business(
        business_type_id=biz_a.business_type_id,
        name="Rogue Business B",
        owner_name="Owner B",
        email=f"biz_b_{uuid4().hex[:6]}@example.com",
        phone="9998887771",
        country="India",
        currency="INR",
        timezone="Asia/Kolkata",
        address="B Street",
        status="ACTIVE",
        is_active=True,
    )
    db.add(biz_b)
    db.commit()
    db.refresh(biz_b)

    claim_payload = {
        "pairing_code": code,
        "business_id": str(biz_b.id),
        "device_id": str(uuid4()),
        "device_name": "Rogue Handheld",
        "device_type": "ANDROID_MOBILE",
        "device_prefix": "ROG01",
    }
    claim_res = client.post("/api/v1/lan/pairing/claim", json=claim_payload)
    assert claim_res.status_code == 403
    assert "cross-business pairing forbidden" in claim_res.json()["detail"].lower()


def test_lan_relay_push_rejected_for_unpaired_or_expired_token(client: TestClient, test_setup: dict):
    # 1. Missing token
    res = client.post(
        "/api/v1/lan/relay/push",
        json={"device_id": str(uuid4()), "transactions": []},
    )
    assert res.status_code == 401

    # 2. Random unknown token
    res = client.post(
        "/api/v1/lan/relay/push",
        headers={"X-LAN-Token": "lan_random_fake_token_12345"},
        json={"device_id": str(uuid4()), "transactions": []},
    )
    assert res.status_code == 401
    assert "unpaired" in res.json()["detail"].lower()


def test_lan_relay_push_anti_spoofing_prevented(client: TestClient, test_setup: dict, db: Session):
    owner = test_setup["user"]
    biz = test_setup["business"]
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz.id)})

    # Pair Device A
    init_res = client.post("/api/v1/lan/pairing/initiate", headers={"Authorization": f"Bearer {owner_token}"})
    code = init_res.json()["pairing_code"]

    dev_a_id = uuid4()
    claim_res = client.post(
        "/api/v1/lan/pairing/claim",
        json={
            "pairing_code": code,
            "business_id": str(biz.id),
            "device_id": str(dev_a_id),
            "device_name": "Legitimate Device A",
            "device_type": "ANDROID_MOBILE",
            "device_prefix": "DEV01",
        },
    )
    lan_token = claim_res.json()["lan_token"]

    # Spoofing attempt: Device A's LAN token used with Device B's device_id
    dev_b_id = uuid4()
    relay_res = client.post(
        "/api/v1/lan/relay/push",
        headers={"X-LAN-Token": lan_token},
        json={
            "device_id": str(dev_b_id),
            "transactions": [
                {
                    "client_tx_id": str(uuid4()),
                    "operation_type": "CREATE_ORDER",
                    "payload": {"test": "data"},
                }
            ],
        },
    )
    assert relay_res.status_code == 403
    assert "device spoofing rejected" in relay_res.json()["detail"].lower()


def test_lan_relay_push_revocation(client: TestClient, test_setup: dict, db: Session):
    owner = test_setup["user"]
    biz = test_setup["business"]
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz.id)})

    # Pair Device
    init_res = client.post("/api/v1/lan/pairing/initiate", headers={"Authorization": f"Bearer {owner_token}"})
    code = init_res.json()["pairing_code"]

    dev_id = uuid4()
    claim_res = client.post(
        "/api/v1/lan/pairing/claim",
        json={
            "pairing_code": code,
            "business_id": str(biz.id),
            "device_id": str(dev_id),
            "device_name": "Temporary Waiter Tablet",
            "device_type": "ANDROID_TABLET",
            "device_prefix": "TAB05",
        },
    )
    lan_token = claim_res.json()["lan_token"]

    # Owner revokes device
    revoke_res = client.post(
        f"/api/v1/lan/pairing/{dev_id}/revoke",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert revoke_res.status_code == 200

    # Device attempts to push with revoked token
    push_res = client.post(
        "/api/v1/lan/relay/push",
        headers={"X-LAN-Token": lan_token},
        json={
            "device_id": str(dev_id),
            "transactions": [
                {
                    "client_tx_id": str(uuid4()),
                    "operation_type": "CREATE_ORDER",
                    "payload": {},
                }
            ],
        },
    )
    assert push_res.status_code == 403
    assert "revoked" in push_res.json()["detail"].lower()


def test_two_android_devices_concurrent_orders_and_idempotency(
    client: TestClient, test_setup: dict, db: Session
):
    owner = test_setup["user"]
    biz = test_setup["business"]
    table = test_setup["table"]
    item = test_setup["item"]
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz.id)})

    # 1. Pair Android Device 1 (Waiter Phone, prefix MOB01)
    init1 = client.post("/api/v1/lan/pairing/initiate", headers={"Authorization": f"Bearer {owner_token}"})
    dev1_id = uuid4()
    claim1 = client.post(
        "/api/v1/lan/pairing/claim",
        json={
            "pairing_code": init1.json()["pairing_code"],
            "business_id": str(biz.id),
            "device_id": str(dev1_id),
            "device_name": "Waiter Phone 1",
            "device_type": "ANDROID_MOBILE",
            "device_prefix": "MOB01",
        },
    )
    token1 = claim1.json()["lan_token"]

    # 2. Pair Android Device 2 (Captain Tablet, prefix TAB01)
    init2 = client.post("/api/v1/lan/pairing/initiate", headers={"Authorization": f"Bearer {owner_token}"})
    dev2_id = uuid4()
    claim2 = client.post(
        "/api/v1/lan/pairing/claim",
        json={
            "pairing_code": init2.json()["pairing_code"],
            "business_id": str(biz.id),
            "device_id": str(dev2_id),
            "device_name": "Captain Tablet 1",
            "device_type": "ANDROID_TABLET",
            "device_prefix": "TAB01",
        },
    )
    token2 = claim2.json()["lan_token"]

    # 3. Concurrently relay orders from both devices
    order1_id = uuid4()
    order2_id = uuid4()
    tx1_id = uuid4()
    tx2_id = uuid4()

    req1 = {
        "device_id": str(dev1_id),
        "transactions": [
            {
                "client_tx_id": str(tx1_id),
                "operation_type": "CREATE_ORDER",
                "payload": {
                    "client_order_id": str(order1_id),
                    "order_number": "ORD-MOB01-000001",
                    "table_id": str(table.id),
                    "customer_details": {
                        "name": "Guest 1",
                        "phone": "9998880001",
                    },
                    "items": [
                        {
                            "menu_item_id": str(item.id),
                            "item_name": item.name,
                            "quantity": 1,
                            "unit_price": item.price,
                            "tax_rate": 5.0,
                            "discount": 0.0,
                        }
                    ],
                },
            }
        ],
    }

    req2 = {
        "device_id": str(dev2_id),
        "transactions": [
            {
                "client_tx_id": str(tx2_id),
                "operation_type": "CREATE_ORDER",
                "payload": {
                    "client_order_id": str(order2_id),
                    "order_number": "ORD-TAB01-000001",
                    "table_id": str(table.id),
                    "customer_details": {
                        "name": "Guest 2",
                        "phone": "9998880002",
                    },
                    "items": [
                        {
                            "menu_item_id": str(item.id),
                            "item_name": item.name,
                            "quantity": 2,
                            "unit_price": item.price,
                            "tax_rate": 5.0,
                            "discount": 0.0,
                        }
                    ],
                },
            }
        ],
    }


    res1 = client.post("/api/v1/lan/relay/push", headers={"X-LAN-Token": token1}, json=req1)
    res2 = client.post("/api/v1/lan/relay/push", headers={"X-LAN-Token": token2}, json=req2)

    assert res1.status_code == 200
    assert res1.json()["results"][0]["status"] == "SUCCESS"
    assert res1.json()["results"][0]["data"]["order_number"] == "ORD-MOB01-000001"

    assert res2.status_code == 200
    assert res2.json()["results"][0]["status"] == "SUCCESS"
    assert res2.json()["results"][0]["data"]["order_number"] == "ORD-TAB01-000001"

    # Verify both orders exist in DB without collision
    db_ord1 = db.query(Order).filter(Order.client_order_id == order1_id).first()
    db_ord2 = db.query(Order).filter(Order.client_order_id == order2_id).first()
    assert db_ord1 is not None
    assert db_ord2 is not None
    assert db_ord1.device_id == dev1_id
    assert db_ord2.device_id == dev2_id

    # 4. Idempotent replay: Device 1 resends identical batch
    replay_res = client.post("/api/v1/lan/relay/push", headers={"X-LAN-Token": token1}, json=req1)
    assert replay_res.status_code == 200
    assert replay_res.json()["results"][0]["status"] == "ALREADY_COMMITTED"
    assert replay_res.json()["results"][0]["data"]["order_number"] == "ORD-MOB01-000001"

    # DB still has exactly 1 record for order 1
    assert db.query(Order).filter(Order.client_order_id == order1_id).count() == 1


    # 5. Conflict rejection: Device 1 modifies payload under same transaction ID
    tampered_req = dict(req1)
    tampered_req["transactions"] = [
        {
            "client_tx_id": str(tx1_id),
            "operation_type": "CREATE_ORDER",
            "payload": {"tampered": True},
        }
    ]
    conflict_res = client.post("/api/v1/lan/relay/push", headers={"X-LAN-Token": token1}, json=tampered_req)
    assert conflict_res.status_code == 200
    assert conflict_res.json()["results"][0]["status"] == "CONFLICT"
    assert conflict_res.json()["results"][0]["status_code"] == 409


def test_lan_relay_safe_create_before_settle_dependency(
    client: TestClient, test_setup: dict, db: Session
):
    owner = test_setup["user"]
    biz = test_setup["business"]
    table = test_setup["table"]
    item = test_setup["item"]
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz.id)})

    # Pair Device
    init = client.post("/api/v1/lan/pairing/initiate", headers={"Authorization": f"Bearer {owner_token}"})
    dev_id = uuid4()
    claim = client.post(
        "/api/v1/lan/pairing/claim",
        json={
            "pairing_code": init.json()["pairing_code"],
            "business_id": str(biz.id),
            "device_id": str(dev_id),
            "device_name": "Quick POS",
            "device_type": "ANDROID_MOBILE",
            "device_prefix": "Q1",
        },
    )
    token = claim.json()["lan_token"]

    order_id = uuid4()
    tx_create = uuid4()
    tx_settle = uuid4()

    # Pass SETTLE_ORDER before CREATE_ORDER in batch
    batch_req = {
        "device_id": str(dev_id),
        "transactions": [
            {
                "client_tx_id": str(tx_settle),
                "operation_type": "SETTLE_ORDER",
                "payload": {
                    "order_id": str(order_id),
                    "settle_data": {
                        "phone": "9998881234",
                        "payment_method": "CASH",
                        "receipt_reference": "REC-Q1-000001",
                    },
                },
            },
            {
                "client_tx_id": str(tx_create),
                "operation_type": "CREATE_ORDER",
                "payload": {
                    "client_order_id": str(order_id),
                    "order_number": "ORD-Q1-000001",
                    "table_id": str(table.id),
                    "customer_details": {
                        "name": "Settle Customer",
                        "phone": "9998881234",
                    },
                    "items": [
                        {
                            "menu_item_id": str(item.id),
                            "item_name": item.name,
                            "quantity": 1,
                            "unit_price": item.price,
                            "tax_rate": 5.0,
                            "discount": 0.0,
                        }
                    ],
                },
            },

        ],
    }

    res = client.post("/api/v1/lan/relay/push", headers={"X-LAN-Token": token}, json=batch_req)
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) == 2

    # Results match original input ordering (result 0 = settle, result 1 = create)
    settle_res = results[0]
    create_res = results[1]

    assert create_res["status"] == "SUCCESS"
    assert settle_res["status"] == "SUCCESS"

    # Verify order is marked SERVED with recorded cash payment
    db.expire_all()
    db_order = db.query(Order).filter(Order.client_order_id == order_id).first()
    assert db_order is not None
    assert db_order.status == OrderStatus.SERVED


    # Verify Visit created exactly once for the customer
    visits = db.query(Visit).filter(Visit.customer_id == db_order.customer_id).all()
    assert len(visits) == 1
    assert visits[0].payment_method.value == "CASH"




def test_coordinator_restart_durability(client: TestClient, test_setup: dict, db: Session):
    """
    Simulates coordinator process restart:
    1. Pairs device and records transaction.
    2. Tears down DB session / simulates host restart.
    3. Re-instantiates session and verifies paired device is still authenticated and data intact.
    """
    owner = test_setup["user"]
    biz = test_setup["business"]
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz.id)})

    # Pair Device
    init = client.post("/api/v1/lan/pairing/initiate", headers={"Authorization": f"Bearer {owner_token}"})
    dev_id = uuid4()
    claim = client.post(
        "/api/v1/lan/pairing/claim",
        json={
            "pairing_code": init.json()["pairing_code"],
            "business_id": str(biz.id),
            "device_id": str(dev_id),
            "device_name": "Survivor POS",
            "device_type": "ANDROID_MOBILE",
            "device_prefix": "S1",
        },
    )
    token = claim.json()["lan_token"]

    # Commit direct sale before restart
    order_id = uuid4()
    tx_id = uuid4()
    push_req = {
        "device_id": str(dev_id),
        "transactions": [
            {
                "client_tx_id": str(tx_id),
                "operation_type": "DIRECT_SALE",
                "payload": {
                    "id": str(order_id),
                    "order_number": "ORD-S1-000001",
                    "table_id": str(test_setup["table"].id),
                    "customer_phone": "9998889999",
                    "payment_method": "CASH",
                    "items": [
                        {
                            "item_name": "Hot Coffee",
                            "unit_price": 40.0,
                            "quantity": 1,
                        }
                    ],
                },
            }
        ],
    }
    res_before = client.post("/api/v1/lan/relay/push", headers={"X-LAN-Token": token}, json=push_req)
    assert res_before.status_code == 200
    assert res_before.json()["results"][0]["status"] == "SUCCESS"

    # Simulate host/coordinator restart: close all connections and open a fresh session
    db.close()
    fresh_session = TestSessionLocal()

    try:
        # Check that pairing record persisted across restart
        pairing = (
            fresh_session.query(LanDevicePairing)
            .filter(LanDevicePairing.device_id == dev_id)
            .first()
        )
        assert pairing is not None
        assert pairing.is_revoked is False

        # Check that transaction persisted across restart
        order = fresh_session.query(Order).filter(Order.order_number == "ORD-S1-000001").first()
        assert order is not None


        # Connected Android device can immediately authenticate with original token after restart
        pull_res = client.get("/api/v1/lan/relay/pull", headers={"X-LAN-Token": token})
        assert pull_res.status_code == 200
        assert pull_res.json()["business_id"] == str(biz.id)
    finally:
        fresh_session.close()


def test_lan_relay_pull_cross_device_visibility(client: TestClient, test_setup: dict, db: Session):
    owner = test_setup["user"]
    biz = test_setup["business"]
    table = test_setup["table"]
    item = test_setup["item"]
    owner_token = create_access_token(data={"sub": str(owner.id), "business_id": str(biz.id)})

    # Pair Device A
    init_a = client.post("/api/v1/lan/pairing/initiate", headers={"Authorization": f"Bearer {owner_token}"})
    dev_a = uuid4()
    claim_a = client.post(
        "/api/v1/lan/pairing/claim",
        json={
            "pairing_code": init_a.json()["pairing_code"],
            "business_id": str(biz.id),
            "device_id": str(dev_a),
            "device_name": "Device A",
            "device_type": "ANDROID_MOBILE",
            "device_prefix": "A1",
        },
    )
    token_a = claim_a.json()["lan_token"]

    # Pair Device B
    init_b = client.post("/api/v1/lan/pairing/initiate", headers={"Authorization": f"Bearer {owner_token}"})
    dev_b = uuid4()
    claim_b = client.post(
        "/api/v1/lan/pairing/claim",
        json={
            "pairing_code": init_b.json()["pairing_code"],
            "business_id": str(biz.id),
            "device_id": str(dev_b),
            "device_name": "Device B",
            "device_type": "ANDROID_MOBILE",
            "device_prefix": "B1",
        },
    )
    token_b = claim_b.json()["lan_token"]

    # Device A creates order for Table
    order_a_id = uuid4()
    client.post(
        "/api/v1/lan/relay/push",
        headers={"X-LAN-Token": token_a},
        json={
            "device_id": str(dev_a),
            "transactions": [
                {
                    "client_tx_id": str(uuid4()),
                    "operation_type": "CREATE_ORDER",
                    "payload": {
                        "client_order_id": str(order_a_id),
                        "order_number": "ORD-A1-000001",
                        "table_id": str(table.id),
                        "items": [
                            {
                                "menu_item_id": str(item.id),
                                "item_name": item.name,
                                "quantity": 1,
                                "unit_price": item.price,
                            }
                        ],
                    },
                }
            ],
        },
    )

    # Device B pulls from LAN coordinator
    pull_res = client.get("/api/v1/lan/relay/pull", headers={"X-LAN-Token": token_b})
    assert pull_res.status_code == 200
    pull_data = pull_res.json()

    # Device B can see Device A's open order
    orders = pull_data["orders"]
    matching = [o for o in orders if o["order_number"] == "ORD-A1-000001"]
    assert len(matching) == 1
    assert matching[0]["table_name"] == table.table_name
    assert matching[0]["device_id"] == str(dev_a)
