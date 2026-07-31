import logging
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.models.dining_area import DiningArea
from app.models.restaurant_table import RestaurantTable
from app.models.order import Order, OrderStatus
from app.services.menu_service import MenuService
from app.services.restaurant_table_service import RestaurantTableService
from app.repositories.order_repository import OrderRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/qr", tags=["Public QR Ordering"])


def _slugify(text: str) -> str:
    if not text:
        return ""
    s = text.strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    return s


def _ensure_default_menu(db: Session, business_id: uuid.UUID):
    """If a business has no menu categories yet, seed standard default categories & dishes so QR Ordering works immediately."""
    from app.models.menu_category import MenuCategory
    from app.models.menu_item import MenuItem

    existing_cat = db.scalar(select(MenuCategory).where(MenuCategory.business_id == business_id))
    if existing_cat:
        return

    defaults = [
        {
            "name": "Starters & Appetizers",
            "items": [
                {"name": "Paneer Tikka", "description": "Grilled cottage cheese marinated in spiced yogurt", "price": 240.0, "is_veg": True, "gst_percentage": 5.0},
                {"name": "Crispy Spring Rolls", "description": "Deep-fried rolls stuffed with fresh vegetables & glass noodles", "price": 180.0, "is_veg": True, "gst_percentage": 5.0},
                {"name": "Chicken Malai Tikka", "description": "Tender chicken pieces marinated in cream & mild spices", "price": 320.0, "is_veg": False, "gst_percentage": 5.0},
            ],
        },
        {
            "name": "Main Course",
            "items": [
                {"name": "Butter Chicken", "description": "Rich & creamy tomato gravy with boneless tandoori chicken", "price": 380.0, "is_veg": False, "gst_percentage": 5.0},
                {"name": "Dal Makhani", "description": "Slow-cooked black lentils with butter and fresh cream", "price": 260.0, "is_veg": True, "gst_percentage": 5.0},
                {"name": "Paneer Butter Masala", "description": "Cottage cheese cubes in rich tomato-cashew gravy", "price": 290.0, "is_veg": True, "gst_percentage": 5.0},
                {"name": "Garlic Naan", "description": "Leavened oven-baked flatbread topped with minced garlic & butter", "price": 60.0, "is_veg": True, "gst_percentage": 5.0},
            ],
        },
        {
            "name": "Beverages & Desserts",
            "items": [
                {"name": "Fresh Lime Soda", "description": "Refreshing lime juice with sweet or salted soda", "price": 90.0, "is_veg": True, "gst_percentage": 5.0},
                {"name": "Cold Coffee with Ice Cream", "description": "Chilled blended espresso topped with vanilla scoop", "price": 140.0, "is_veg": True, "gst_percentage": 5.0},
                {"name": "Gulab Jamun (2 Pcs)", "description": "Soft fried dough balls soaked in warm cardamom sugar syrup", "price": 110.0, "is_veg": True, "gst_percentage": 5.0},
            ],
        },
    ]

    for order_idx, cat_def in enumerate(defaults, start=1):
        cat = MenuCategory(
            business_id=business_id,
            name=cat_def["name"],
            display_order=order_idx,
            is_active=True,
        )
        db.add(cat)
        db.flush()

        for item_idx, item_def in enumerate(cat_def["items"], start=1):
            item = MenuItem(
                business_id=business_id,
                category_id=cat.id,
                name=item_def["name"],
                description=item_def["description"],
                price=item_def["price"],
                gst_percentage=item_def["gst_percentage"],
                is_veg=item_def["is_veg"],
                is_available=True,
                display_order=item_idx,
            )
            db.add(item)

    db.commit()
    logger.info("Automatically seeded default menu categories and items for business %s", str(business_id))


@router.get("/bootstrap", summary="Fetch isolated public data for QR Ordering by table and business slug")
def qr_bootstrap(
    table: str = Query(..., description="Table UUID or table name slug"),
    business: str | None = Query(default=None, description="Optional business slug/name"),
    visit_token: str | None = Query(default=None, description="Client visit token for active session validation"),
    db: Session = Depends(get_db),
):
    target_table: RestaurantTable | None = None
    target_business: Business | None = None

    table_clean = table.strip()
    business_clean = business.strip() if business else None

    # Step 1: Check if table parameter is a valid UUID
    try:
        table_uuid = uuid.UUID(table_clean)
        target_table = db.scalar(select(RestaurantTable).where(RestaurantTable.id == table_uuid))
        if target_table:
            target_business = db.scalar(select(Business).where(Business.id == target_table.business_id))
    except ValueError:
        pass

    # Step 2: Resolve by business slug + table slug if not resolved by UUID
    if not target_business and business_clean:
        req_biz_slug = _slugify(business_clean)
        all_businesses = db.scalars(select(Business).where(Business.is_deleted == False)).all()
        for b in all_businesses:
            if _slugify(b.name) == req_biz_slug or b.name.strip().lower() == business_clean.lower():
                target_business = b
                break

    if not target_table and target_business:
        req_table_slug = _slugify(table_clean)
        tables = db.scalars(
            select(RestaurantTable).where(RestaurantTable.business_id == target_business.id)
        ).all()
        for t in tables:
            if (
                _slugify(t.table_name) == req_table_slug
                or t.table_name.strip().lower() == table_clean.lower()
                or str(t.id) == table_clean
            ):
                target_table = t
                break

    # If still not found and table UUID was passed but business parameter was passed:
    if not target_table and not target_business:
        all_tables = db.scalars(select(RestaurantTable).where(RestaurantTable.is_active == True)).all()
        req_table_slug = _slugify(table_clean)
        for t in all_tables:
            if _slugify(t.table_name) == req_table_slug or t.table_name.strip().lower() == table_clean.lower():
                b = db.scalar(select(Business).where(Business.id == t.business_id))
                if b and b.is_active and not b.is_deleted:
                    target_table = t
                    target_business = b
                    break

    if not target_business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found for the provided QR link.",
        )

    if not target_business.is_active or target_business.is_deleted or target_business.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This restaurant is currently inactive or unavailable.",
        )

    if not target_table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_clean}' not found for restaurant '{target_business.name}'.",
        )

    if not target_table.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table '{target_table.table_name}' is currently deactivated.",
        )

    if target_table.business_id != target_business.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{target_table.table_name}' does not belong to restaurant '{target_business.name}'.",
        )

    biz_settings = db.scalar(
        select(BusinessSettings).where(BusinessSettings.business_id == target_business.id)
    )

    dining_area = db.scalar(
        select(DiningArea).where(DiningArea.id == target_table.dining_area_id)
    )

    order_repo = OrderRepository(db)
    active_order = order_repo.get_active_order_for_table(target_table.id, target_business.id)
    if active_order and active_order.status == OrderStatus.SERVED:
        active_order = None

    # Ensure restaurant has menu items loaded
    _ensure_default_menu(db, target_business.id)

    categories = MenuService(db).repo.list_categories(target_business.id)

    categories_data = []
    for cat in categories:
        if not cat.is_active:
            continue
        avail_items = [it for it in cat.items if it.is_available]
        categories_data.append({
            "id": str(cat.id),
            "business_id": str(cat.business_id),
            "name": cat.name,
            "display_order": cat.display_order,
            "is_active": cat.is_active,
            "items": [
                {
                    "id": str(it.id),
                    "category_id": str(it.category_id),
                    "business_id": str(it.business_id),
                    "name": it.name,
                    "description": it.description,
                    "price": float(it.price),
                    "gst_percentage": float(it.gst_percentage or 0),
                    "is_veg": it.is_veg,
                    "is_available": it.is_available,
                    "display_order": it.display_order,
                    "created_at": it.created_at.isoformat() if it.created_at else None,
                    "updated_at": it.updated_at.isoformat() if it.updated_at else None,
                }
                for it in avail_items
            ],
            "created_at": cat.created_at.isoformat() if cat.created_at else None,
            "updated_at": cat.updated_at.isoformat() if cat.updated_at else None,
        })

    dining_areas = RestaurantTableService(db).get_tables_map_by_business_id(target_business.id)

    # Session validation for visit tokens
    session_is_active = False
    session_expired = False
    token_matches = False
    customer_info = None

    clean_visit_token = visit_token.strip() if (visit_token and visit_token.strip()) else None

    if active_order and active_order.status in (OrderStatus.OPEN, OrderStatus.PREPARING, OrderStatus.READY):
        if clean_visit_token and active_order.visit_token:
            token_matches = (clean_visit_token == active_order.visit_token.strip())

        # Session is ONLY active for this client if token validly matches!
        if token_matches:
            session_is_active = True

        if active_order.customer:
            customer_info = {
                "id": str(active_order.customer.id),
                "name": active_order.customer.name,
                "phone": active_order.customer.phone,
            }
    elif clean_visit_token:
        # Visit token was provided by client, but no active order exists (it was settled/cancelled)
        session_expired = True

    table_occupied_blocked = bool(
        active_order
        and active_order.status in (OrderStatus.OPEN, OrderStatus.PREPARING, OrderStatus.READY)
        and not token_matches
    )

    table_status_str = "OCCUPIED" if (active_order and active_order.status in (OrderStatus.OPEN, OrderStatus.PREPARING, OrderStatus.READY)) else "EMPTY"

    # Print backend logging for diagnostics
    logger.info(
        "QR Session Validation: Table ID=%s (%s) | Visit ID=%s | Visit Status=%s | Order ID=%s | Order Status=%s | Table Status=%s | Token Provided=%s | Token Valid=%s | Active Session Result=%s | Blocked=%s",
        str(target_table.id),
        target_table.table_name,
        "N/A",
        "ACTIVE" if active_order else "EXPIRED/NONE",
        str(active_order.id) if active_order else "None",
        active_order.status.value if active_order else "None",
        table_status_str,
        clean_visit_token or "None",
        token_matches,
        session_is_active,
        table_occupied_blocked,
    )

    return {
        "business": {
            "id": str(target_business.id),
            "name": target_business.name,
            "phone": target_business.phone,
            "address": target_business.address,
            "country": target_business.country,
            "currency": target_business.currency,
            "timezone": target_business.timezone,
            "logo_url": biz_settings.logo if (biz_settings and biz_settings.logo) else target_business.logo_url,
            "cover_image": biz_settings.cover_image if biz_settings else None,
            "opening_time": biz_settings.opening_time if biz_settings else None,
            "closing_time": biz_settings.closing_time if biz_settings else None,
            "tax_percentage": float(biz_settings.tax_percentage) if (biz_settings and biz_settings.tax_percentage is not None) else 0.0,
            "review_link": biz_settings.review_link if biz_settings else None,
            "booking_link": biz_settings.booking_link if biz_settings else None,
            "is_active": target_business.is_active,
        },
        "table": {
            "id": str(target_table.id),
            "table_name": target_table.table_name,
            "dining_area_id": str(target_table.dining_area_id),
            "dining_area_name": dining_area.name if dining_area else "Main Area",
            "capacity": target_table.capacity,
            "status": table_status_str,
            "current_order_id": str(active_order.id) if active_order else None,
        },
        "session": {
            "is_active": session_is_active,
            "session_expired": session_expired,
            "visit_token": active_order.visit_token if active_order else None,
            "token_matches": token_matches,
            "table_occupied_blocked": table_occupied_blocked,
            "customer": customer_info,
        },
        "dining_areas": dining_areas,
        "categories": categories_data,
    }
