from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_optional_user
from app.db.database import get_db
from app.models.order import OrderStatus
from app.models.user import User
from app.schemas.order import (
    CustomerAutoDetectResponse,
    OrderCreate,
    OrderItemCreate,
    OrderItemResponse,
    OrderItemUpdate,
    OrderResponse,
    OrderSettleRequest,
    OrderSettleResponse,
    OrderUpdate,
    PaginatedOrdersResponse,
)
from app.schemas.revenue import RevenueAnalyticsResponse
from app.services.order_service import OrderService
from app.services.revenue_service import RevenueService

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get(
    "/revenue/analytics",
    response_model=RevenueAnalyticsResponse,
    summary="Get complete revenue analytics for the authenticated business",
)
def get_revenue_analytics(
    period: str = Query(default="this_month"),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    dining_area_id: UUID | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    order_source: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return RevenueService(db).get_revenue_analytics(
        current_user,
        period=period,
        start_date=start_date,
        end_date=end_date,
        dining_area_id=dining_area_id,
        payment_method=payment_method,
        order_source=order_source,
    )


@router.post(
    "/customers/auto-detect",
    response_model=CustomerAutoDetectResponse,
    summary="Auto detect existing vs new customer by phone for order settlement & QR",
)
def auto_detect_customer(
    phone: str = Query(...),
    order_amount: float = Query(default=0.0),
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).auto_detect_customer(current_user, phone, order_amount)


@router.post(
    "/{id}/settle",
    response_model=OrderSettleResponse,
    summary="Settle temporary order, auto-link customer, create visit, award loyalty & free table",
)
def settle_order(
    id: UUID,
    data: OrderSettleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).settle_order(current_user, id, data)


@router.get("", response_model=PaginatedOrdersResponse, summary="List orders with server-side pagination & filters")
def list_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: OrderStatus | None = Query(default=None),
    table_id: UUID | None = Query(default=None),
    customer_id: UUID | None = Query(default=None),
    order_source: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_filter: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).list_orders_paginated(
        current_user,
        page=page,
        page_size=page_size,
        status_filter=status,
        table_id=table_id,
        customer_id=customer_id,
        order_source=order_source,
        search=search,
        date_filter=date_filter,
        start_date=start_date,
        end_date=end_date,
    )


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, summary="Create temporary order")
def create_order(
    data: OrderCreate,
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).create_order(current_user, data)


@router.get("/{id}", response_model=OrderResponse, summary="Get temporary order details")
def get_order(
    id: UUID,
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).get_order(current_user, id)


@router.patch("/{id}", response_model=OrderResponse, summary="Update temporary order")
def update_order(
    id: UUID,
    data: OrderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).update_order(current_user, id, data)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, summary="Cancel / delete temporary order")
def delete_order(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    OrderService(db).delete_order(current_user, id)
    return None


# -----------------------------------------------------------------------------
# ORDER ITEMS ENDPOINTS
# -----------------------------------------------------------------------------


@router.get("/{id}/items", response_model=list[OrderItemResponse], summary="List order items")
def list_order_items(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).list_order_items(current_user, id)


@router.post("/{id}/items", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, summary="Add item to order (auto recalculates order)")
def add_order_item(
    id: UUID,
    data: OrderItemCreate,
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).add_order_item(current_user, id, data)


@router.put("/{id}/items/{item_id}", response_model=OrderResponse, summary="Update item in order (auto recalculates order)")
def update_order_item(
    id: UUID,
    item_id: UUID,
    data: OrderItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).update_order_item(current_user, id, item_id, data)


@router.delete("/{id}/items/{item_id}", response_model=OrderResponse, summary="Delete item from order (auto recalculates order)")
def delete_order_item(
    id: UUID,
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).delete_order_item(current_user, id, item_id)
