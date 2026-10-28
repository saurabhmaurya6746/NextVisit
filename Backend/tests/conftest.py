import os
import pytest
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import hash_password
from app.models.business import Business, BusinessStatus
from app.models.business_type import BusinessType
from app.models.dining_area import DiningArea
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem
from app.models.restaurant_table import RestaurantTable
from app.models.user import User

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:(Saurabhpost67)@localhost:5432/nextvisit_test",
)
test_engine = create_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = sessionmaker(autoflush=False, autocommit=False, bind=test_engine)

from app.db.init_db import sync_database_schema
sync_database_schema(test_engine)

from app.db.database import get_db
from app.main import app


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
def db():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def test_setup(db: Session):
    """
    Creates an isolated test business, owner user, dining area, table, and menu item.
    Cleans up all created test entities after each test.
    """
    unique_suffix = uuid4().hex[:8]

    # 1. Get or create BusinessType
    bt = db.query(BusinessType).first()
    if not bt:
        bt = BusinessType(name="Restaurant")
        db.add(bt)
        db.commit()
        db.refresh(bt)

    # 2. Create Business
    biz = Business(
        business_type_id=bt.id,
        name=f"POS Test Bistro {unique_suffix}",
        owner_name=f"Owner {unique_suffix}",
        email=f"bistro_{unique_suffix}@example.com",
        phone="9998887776",
        country="India",
        currency="INR",
        timezone="Asia/Kolkata",
        address="123 Test Street",
        status=BusinessStatus.ACTIVE.value,
        is_active=True,
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)

    # 3. Create User
    user = User(
        business_id=biz.id,
        name=f"Owner {unique_suffix}",
        email=f"owner_{unique_suffix}@example.com",
        hashed_password=hash_password("Secret@123"),
        role="OWNER",
        status="ACTIVE",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 4. Create DiningArea & Table
    area = DiningArea(
        business_id=biz.id,
        name=f"Main Hall {unique_suffix}",
        display_order=1,
    )
    db.add(area)
    db.commit()
    db.refresh(area)

    table = RestaurantTable(
        business_id=biz.id,
        dining_area_id=area.id,
        table_name="T-01",
        capacity=4,
        is_active=True,
    )
    db.add(table)
    db.commit()
    db.refresh(table)

    # 5. Create Menu Category & Item
    cat = MenuCategory(
        business_id=biz.id,
        name="Main Course",
        is_active=True,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)

    item = MenuItem(
        category_id=cat.id,
        business_id=biz.id,
        name="Paneer Butter Masala",
        price=250.0,
        gst_percentage=5.0,
        is_veg=True,
        is_available=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    yield {
        "business": biz,
        "user": user,
        "dining_area": area,
        "table": table,
        "category": cat,
        "item": item,
    }

    # Teardown
    try:
        db.delete(user)
        db.delete(biz)
        db.commit()
    except Exception:
        db.rollback()
