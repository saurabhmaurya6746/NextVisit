from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.order import OrderStatus
from app.models.user import User
from app.schemas.order import (
    OrderCreate,
    OrderItemCreate,
    OrderItemResponse,
    OrderItemUpdate,
    OrderResponse,
    OrderUpdate,
)
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("", response_model=list[OrderResponse], summary="List temporary orders")
def list_orders(
    status: OrderStatus | None = Query(default=None),
    table_id: UUID | None = Query(default=None),
    customer_id: UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).list_orders(
        current_user,
        status_filter=status,
        table_id=table_id,
        customer_id=customer_id,
    )


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, summary="Create temporary order")
def create_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return OrderService(db).create_order(current_user, data)


@router.get("/{id}", response_model=OrderResponse, summary="Get temporary order details")
def get_order(
    id: UUID,
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
