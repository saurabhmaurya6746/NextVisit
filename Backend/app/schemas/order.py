from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.order import OrderSource, OrderStatus


class OrderItemCreate(BaseModel):
    menu_item_id: UUID | None = None
    service_id: UUID | None = None
    item_name: str = Field(..., min_length=1, max_length=150)
    unit_price: float = Field(..., ge=0.0)
    quantity: int = Field(1, ge=1)
    tax_rate: float = Field(0.0, ge=0.0, le=100.0)
    discount: float = Field(0.0, ge=0.0)
    notes: str | None = Field(default=None, max_length=255)


class OrderItemUpdate(BaseModel):
    menu_item_id: UUID | None = None
    item_name: str | None = Field(default=None, min_length=1, max_length=150)
    unit_price: float | None = Field(default=None, ge=0.0)
    quantity: int | None = Field(default=None, ge=1)
    tax_rate: float | None = Field(default=None, ge=0.0, le=100.0)
    discount: float | None = Field(default=None, ge=0.0)
    notes: str | None = Field(default=None, max_length=255)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    menu_item_id: UUID | None = None
    service_id: UUID | None = None
    item_name: str
    unit_price: float
    quantity: int
    tax_rate: float
    discount: float
    subtotal: float
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class OrderCreate(BaseModel):
    table_id: UUID
    customer_id: UUID | None = None
    order_source: OrderSource = OrderSource.POS
    status: OrderStatus = OrderStatus.OPEN
    notes: str | None = Field(default=None, max_length=1000)
    subtotal: float | None = None
    tax_amount: float = Field(0.0, ge=0.0)
    discount_amount: float = Field(0.0, ge=0.0)
    items: list[OrderItemCreate] = []


class OrderUpdate(BaseModel):
    table_id: UUID | None = None
    customer_id: UUID | None = None
    status: OrderStatus | None = None
    notes: str | None = Field(default=None, max_length=1000)
    tax_amount: float | None = Field(default=None, ge=0.0)
    discount_amount: float | None = Field(default=None, ge=0.0)
    items: list[OrderItemCreate] | None = None


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    table_id: UUID
    customer_id: UUID | None = None
    order_number: str
    order_source: OrderSource
    status: OrderStatus
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    notes: str | None = None
    created_by: UUID | None = None
    items: list[OrderItemResponse] = []
    created_at: datetime
    updated_at: datetime
