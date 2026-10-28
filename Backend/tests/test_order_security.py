from uuid import uuid4
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.business import Business, BusinessStatus
from app.models.business_type import BusinessType
from app.models.customer import Customer
from app.models.dining_area import DiningArea
from app.models.order import Order, OrderStatus
from app.models.restaurant_table import RestaurantTable
from app.models.user import User
from app.schemas.order import OrderCreate, OrderItemCreate, OrderSettleRequest
from app.services.order_service import OrderService


@pytest.fixture
def secondary_business(db: Session):
    """Creates a second distinct business and owner user for cross-tenant testing."""
    unique_suffix = uuid4().hex[:8]
    bt = db.query(BusinessType).first()

    biz2 = Business(
        business_type_id=bt.id,
        name=f"CrossTenant Bistro {unique_suffix}",
        owner_name=f"Owner2 {unique_suffix}",
        email=f"bistro2_{unique_suffix}@example.com",
        phone="8887776665",
        country="India",
        currency="INR",
        timezone="Asia/Kolkata",
        address="456 Secondary Lane",
        status=BusinessStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(biz2)
    db.commit()
    db.refresh(biz2)

    user2 = User(
        business_id=biz2.id,
        name=f"Owner2 {unique_suffix}",
        email=f"owner2_{unique_suffix}@example.com",
        hashed_password=hash_password("Secret@123"),
        role="OWNER",
        status="ACTIVE",
        is_active=True,
        is_verified=True,
    )
    db.add(user2)
    db.commit()
    db.refresh(user2)

    yield {"business": biz2, "user": user2}

    try:
        db.delete(user2)
        db.delete(biz2)
        db.commit()
    except Exception:
        db.rollback()


# -----------------------------------------------------------------------------
# 1. ORDER DETAIL AUTHORIZATION TESTS
# -----------------------------------------------------------------------------

def test_unauthenticated_order_detail_rejected_without_token(db: Session, test_setup: dict):
    """Unauthenticated request with neither user credentials nor visit token must be rejected with 401."""
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    order = order_service.create_order(
        user,
        OrderCreate(
            table_id=table.id,
            items=[OrderItemCreate(menu_item_id=item.id, item_name=item.name, unit_price=item.price, quantity=1)],
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        order_service.get_order(current_user=None, order_id=order.id, visit_token=None)
    assert exc_info.value.status_code == 401
    assert "authentication required" in exc_info.value.detail.lower()


def test_order_detail_with_valid_visit_token_succeeds(db: Session, test_setup: dict):
    """Public QR guest presenting the valid visit token for the order must be granted access."""
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    # Guest places QR order (no user)
    order = order_service.create_order(
        None,
        OrderCreate(
            table_id=table.id,
            order_source="QR",
            items=[OrderItemCreate(menu_item_id=item.id, item_name=item.name, unit_price=item.price, quantity=1)],
        ),
    )
    assert order.visit_token is not None
    assert order.visit_token.startswith("vt_")

    # Guest polls order using matching visit_token
    retrieved = order_service.get_order(current_user=None, order_id=order.id, visit_token=order.visit_token)
    assert retrieved.id == order.id
    assert retrieved.order_number == order.order_number


def test_order_detail_with_mismatched_visit_token_rejected(db: Session, test_setup: dict):
    """Unauthenticated request with a wrong or forged visit token must be rejected with 403."""
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    order = order_service.create_order(
        None,
        OrderCreate(
            table_id=table.id,
            items=[OrderItemCreate(menu_item_id=item.id, item_name=item.name, unit_price=item.price, quantity=1)],
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        order_service.get_order(current_user=None, order_id=order.id, visit_token="vt_forged_invalid_token_999")
    assert exc_info.value.status_code == 403
    assert "invalid or expired visit token" in exc_info.value.detail.lower()


def test_order_detail_with_expired_visit_token_rejected_after_settlement(db: Session, test_setup: dict):
    """Once an order is settled, its visit_token is revoked; subsequent use of the old token must return 403."""
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    order = order_service.create_order(
        None,
        OrderCreate(
            table_id=table.id,
            items=[OrderItemCreate(menu_item_id=item.id, item_name=item.name, unit_price=item.price, quantity=1)],
        ),
    )
    saved_token = order.visit_token
    assert saved_token is not None

    # Settle order (invalidates visit_token)
    order_service.settle_order(
        user,
        order.id,
        OrderSettleRequest(phone="9988771122", payment_method="CASH"),
    )

    db.refresh(order)
    assert order.visit_token is None

    with pytest.raises(HTTPException) as exc_info:
        order_service.get_order(current_user=None, order_id=order.id, visit_token=saved_token)
    assert exc_info.value.status_code == 403
    assert "invalid or expired visit token" in exc_info.value.detail.lower()


def test_authenticated_same_business_user_can_read_order(db: Session, test_setup: dict):
    """Authenticated staff/owner from the same business can read the order without needing a visit token."""
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    order = order_service.create_order(
        user,
        OrderCreate(
            table_id=table.id,
            items=[OrderItemCreate(menu_item_id=item.id, item_name=item.name, unit_price=item.price, quantity=1)],
        ),
    )

    retrieved = order_service.get_order(current_user=user, order_id=order.id, visit_token=None)
    assert retrieved.id == order.id


def test_authenticated_cross_business_user_rejected(db: Session, test_setup: dict, secondary_business: dict):
    """Authenticated user from Business B must be strictly forbidden (403) from accessing Business A's order."""
    user1 = test_setup["user"]
    user2 = secondary_business["user"]
    table1 = test_setup["table"]
    item1 = test_setup["item"]
    order_service = OrderService(db)

    order1 = order_service.create_order(
        user1,
        OrderCreate(
            table_id=table1.id,
            items=[OrderItemCreate(menu_item_id=item1.id, item_name=item1.name, unit_price=item1.price, quantity=1)],
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        order_service.get_order(current_user=user2, order_id=order1.id)
    assert exc_info.value.status_code == 403
    assert "access denied" in exc_info.value.detail.lower()


# -----------------------------------------------------------------------------
# 2. ORDER ITEM MUTATION AUTHORIZATION TESTS
# -----------------------------------------------------------------------------

def test_unauthenticated_add_order_item_rejected_without_token(db: Session, test_setup: dict):
    """Unauthenticated caller without visit token cannot add items to any order (401)."""
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    order = order_service.create_order(
        user,
        OrderCreate(
            table_id=table.id,
            items=[OrderItemCreate(menu_item_id=item.id, item_name=item.name, unit_price=item.price, quantity=1)],
        ),
    )

    new_item_data = OrderItemCreate(
        item_name="Extra Garlic Naan",
        unit_price=50.0,
        quantity=2,
    )

    with pytest.raises(HTTPException) as exc_info:
        order_service.add_order_item(current_user=None, order_id=order.id, data=new_item_data, visit_token=None)
    assert exc_info.value.status_code == 401


def test_unauthenticated_add_order_item_with_valid_visit_token_succeeds(db: Session, test_setup: dict):
    """Public QR guest with a matching visit token can legitimately add extra items to their active order."""
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    order = order_service.create_order(
        None,
        OrderCreate(
            table_id=table.id,
            order_source="QR",
            items=[OrderItemCreate(menu_item_id=item.id, item_name=item.name, unit_price=item.price, quantity=1)],
        ),
    )
    initial_total = order.total_amount

    new_item_data = OrderItemCreate(
        item_name="Gulab Jamun",
        unit_price=100.0,
        quantity=2,
    )

    updated = order_service.add_order_item(
        current_user=None,
        order_id=order.id,
        data=new_item_data,
        visit_token=order.visit_token,
    )
    assert updated.total_amount == initial_total + 200.0
    assert any(it.item_name == "Gulab Jamun" for it in updated.items)


def test_unauthenticated_add_order_item_with_mismatched_visit_token_rejected(db: Session, test_setup: dict):
    """Unauthenticated caller with mismatched visit token cannot mutate order items (403)."""
    table = test_setup["table"]
    item = test_setup["item"]
    order_service = OrderService(db)

    order = order_service.create_order(
        None,
        OrderCreate(
            table_id=table.id,
            items=[OrderItemCreate(menu_item_id=item.id, item_name=item.name, unit_price=item.price, quantity=1)],
        ),
    )

    new_item_data = OrderItemCreate(
        item_name="Malicious Free Item",
        unit_price=0.0,
        quantity=10,
    )

    with pytest.raises(HTTPException) as exc_info:
        order_service.add_order_item(
            current_user=None,
            order_id=order.id,
            data=new_item_data,
            visit_token="vt_tampered_token",
        )
    assert exc_info.value.status_code == 403


def test_authenticated_cross_business_add_order_item_rejected(db: Session, test_setup: dict, secondary_business: dict):
    """Authenticated staff from Business B cannot add items to an order of Business A (403)."""
    user1 = test_setup["user"]
    user2 = secondary_business["user"]
    table1 = test_setup["table"]
    item1 = test_setup["item"]
    order_service = OrderService(db)

    order1 = order_service.create_order(
        user1,
        OrderCreate(
            table_id=table1.id,
            items=[OrderItemCreate(menu_item_id=item1.id, item_name=item1.name, unit_price=item1.price, quantity=1)],
        ),
    )

    new_item_data = OrderItemCreate(item_name="Cross-Business Item", unit_price=200.0, quantity=1)

    with pytest.raises(HTTPException) as exc_info:
        order_service.add_order_item(current_user=user2, order_id=order1.id, data=new_item_data)
    assert exc_info.value.status_code == 403


# -----------------------------------------------------------------------------
# 3. CUSTOMER AUTO-DETECT TESTS
# -----------------------------------------------------------------------------

def test_unauthenticated_customer_auto_detect_returns_safe_response_no_500(db: Session):
    """Unauthenticated call to auto_detect_customer must return exists=False safely and never raise 500."""
    order_service = OrderService(db)
    res = order_service.auto_detect_customer(current_user=None, phone="9876543210", order_amount=150.0)
    assert res["exists"] is False
    assert res["customer_id"] is None
    assert res["name"] is None
    assert res["phone"] == "9876543210"
    assert res["loyalty"] is None


def test_authenticated_customer_auto_detect_functions_properly(db: Session, test_setup: dict):
    """Authenticated user can lookup customer by phone for their own business."""
    user = test_setup["user"]
    biz = test_setup["business"]
    order_service = OrderService(db)

    # Seed customer under business 1
    cust = Customer(
        business_id=biz.id,
        name="Sunita Sharma",
        phone="9871122334",
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)

    res = order_service.auto_detect_customer(current_user=user, phone="9871122334", order_amount=500.0)
    assert res["exists"] is True
    assert res["customer_id"] == cust.id
    assert res["name"] == "Sunita Sharma"
    assert res["phone"] == "9871122334"


# -----------------------------------------------------------------------------
# 4. FASTAPI ROUTER HTTP INTEGRATION TESTS (TestClient)
# -----------------------------------------------------------------------------

def test_fastapi_http_order_security_routes(test_setup: dict):
    """End-to-end HTTP verification using TestClient to test router-level dependencies and header/query extraction."""
    client = TestClient(app)
    user = test_setup["user"]
    table = test_setup["table"]
    item = test_setup["item"]

    # 1. Unauthenticated order creation (public QR) succeeds and issues visit_token
    qr_create_resp = client.post(
        "/api/v1/orders",
        json={
            "table_id": str(table.id),
            "order_source": "QR",
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
    assert qr_create_resp.status_code == 201
    order_data = qr_create_resp.json()
    order_id = order_data["id"]
    visit_token = order_data["visit_token"]
    assert visit_token is not None

    # 2. GET /orders/{id} with no token -> 401 Unauthorized
    anon_get_resp = client.get(f"/api/v1/orders/{order_id}")
    assert anon_get_resp.status_code == 401

    # 3. GET /orders/{id} with invalid query visit_token -> 403 Forbidden
    bad_token_resp = client.get(f"/api/v1/orders/{order_id}?visit_token=vt_wrong")
    assert bad_token_resp.status_code == 403

    # 4. GET /orders/{id} with valid query visit_token -> 200 OK
    query_token_resp = client.get(f"/api/v1/orders/{order_id}?visit_token={visit_token}")
    assert query_token_resp.status_code == 200
    assert query_token_resp.json()["id"] == order_id

    # 5. GET /orders/{id} with valid X-Visit-Token header -> 200 OK
    header_token_resp = client.get(f"/api/v1/orders/{order_id}", headers={"X-Visit-Token": visit_token})
    assert header_token_resp.status_code == 200
    assert header_token_resp.json()["id"] == order_id

    # 6. POST /orders/{id}/items with no token -> 401 Unauthorized
    anon_post_item_resp = client.post(
        f"/api/v1/orders/{order_id}/items",
        json={"item_name": "Roti", "unit_price": 30.0, "quantity": 2},
    )
    assert anon_post_item_resp.status_code == 401

    # 7. POST /orders/{id}/items with X-Visit-Token header -> 201 Created
    header_post_item_resp = client.post(
        f"/api/v1/orders/{order_id}/items",
        headers={"X-Visit-Token": visit_token},
        json={"item_name": "Roti", "unit_price": 30.0, "quantity": 2},
    )
    assert header_post_item_resp.status_code == 201
    assert header_post_item_resp.json()["total_amount"] > order_data["total_amount"]

    # 8. POST /orders/customers/auto-detect unauthenticated -> 200 OK with exists=False (safe fallback)
    anon_autodetect_resp = client.post("/api/v1/orders/customers/auto-detect?phone=9123456789")
    assert anon_autodetect_resp.status_code == 200
    assert anon_autodetect_resp.json()["exists"] is False
