from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class RevenueCardMetric(BaseModel):
    amount: float
    change_pct: float
    orders_count: int


class RevenueTopCards(BaseModel):
    today: RevenueCardMetric
    week: RevenueCardMetric
    month: RevenueCardMetric
    year: RevenueCardMetric


class RevenueBySourceItem(BaseModel):
    source: str
    amount: float
    count: int
    percentage: float


class RevenueByPaymentItem(BaseModel):
    method: str
    amount: float
    count: int
    percentage: float


class ItemSalesMetric(BaseModel):
    name: str
    quantity_sold: int
    revenue: float
    avg_price: float


class RevenueByCategoryItem(BaseModel):
    category: str
    revenue: float
    items_sold: int
    percentage: float


class HourlyRevenueItem(BaseModel):
    hour: str
    revenue: float
    orders: int


class DailyRevenueItem(BaseModel):
    date: str
    day: str
    revenue: float
    orders: int


class MonthlyRevenueItem(BaseModel):
    month: str
    revenue: float
    growth_pct: float


class HighestSpendingCustomerMetric(BaseModel):
    name: str
    spent: float


class CustomerRevenueAnalytics(BaseModel):
    new_customer_revenue: float
    returning_customer_revenue: float
    avg_spend_per_customer: float
    highest_spending_customer: HighestSpendingCustomerMetric | None = None
    repeat_customer_pct: float


class OrderAnalyticsMetrics(BaseModel):
    total_paid_orders: int
    average_order_value: float
    largest_order: float
    smallest_order: float
    avg_items_per_order: float


class TableRevenueItem(BaseModel):
    table_name: str
    area_name: str
    revenue: float
    orders: int


class AreaRevenueItem(BaseModel):
    area_name: str
    revenue: float
    orders: int


class DiningAnalyticsMetrics(BaseModel):
    revenue_by_table: list[TableRevenueItem] = []
    revenue_by_area: list[AreaRevenueItem] = []
    most_occupied_table: str = "N/A"
    highest_revenue_table: str = "N/A"


class TaxDiscountAnalyticsMetrics(BaseModel):
    total_tax_collected: float
    gross_revenue: float
    net_revenue: float
    total_discount_given: float
    manual_discount: float
    loyalty_redemption_discount: float


class RevenueAnalyticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    top_cards: RevenueTopCards
    by_source: list[RevenueBySourceItem] = []
    by_payment: list[RevenueByPaymentItem] = []
    top_items: list[ItemSalesMetric] = []
    least_items: list[ItemSalesMetric] = []
    by_category: list[RevenueByCategoryItem] = []
    hourly: list[HourlyRevenueItem] = []
    daily: list[DailyRevenueItem] = []
    monthly: list[MonthlyRevenueItem] = []
    customer_analytics: CustomerRevenueAnalytics
    order_analytics: OrderAnalyticsMetrics
    dining_analytics: DiningAnalyticsMetrics
    tax_discount_analytics: TaxDiscountAnalyticsMetrics
