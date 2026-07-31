from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class BirthdaySummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    today: int
    tomorrow: int
    this_week: int
    this_month: int


class BirthdayCustomerItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    email: str | None = None
    birth_date: date | None = None
    age: int | None = None
    last_visit_at: datetime | None = None
    visit_count: int
    total_spent: float
    loyalty_points: int = 0
    customer_tier: str = "First Time"
    current_coupon: str = "BDAYSPECIAL"
    preferred_language: str = "Auto"
    favorite_item: str | None = None
    favorites: list[str] = []
    initials: str = "NV"


class PaginatedBirthdayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    summary: BirthdaySummaryResponse
    items: list[BirthdayCustomerItem]
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_previous: bool
