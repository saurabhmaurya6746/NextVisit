from uuid import UUID
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.core.automation.resolvers.base import IAutomationContextResolver
from app.models.customer import Customer
from app.models.order import Order


class RestaurantContextResolver(IAutomationContextResolver):

    def resolve_customer_context(
        self,
        db: Session,
        business_id: UUID,
        customer_id: UUID,
    ) -> Dict[str, Any]:
        customer = db.scalar(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.business_id == business_id,
            )
        )
        if not customer:
            return {}

        # Fetch last order
        last_order = db.scalar(
            select(Order)
            .where(Order.customer_id == customer_id, Order.business_id == business_id)
            .order_by(Order.created_at.desc())
        )

        last_visit_str = (
            last_order.created_at.strftime("%d %b %Y")
            if last_order and last_order.created_at
            else (customer.last_visit_at.strftime("%d %b %Y") if customer.last_visit_at else "recently")
        )

        return {
            "customer_name": customer.name or "Valued Guest",
            "customer_phone": customer.phone or "",
            "last_visit_date": last_visit_str,
            "total_visits": str(customer.visit_count or 0),
            "total_spent": f"₹{customer.total_spent or 0:.2f}",
            "loyalty_points": str(customer.loyalty_points or 0),
            "favorite_dish": "Special Thali",
            "restaurant_name": "Restaurant",
        }

    def get_seed_templates(self) -> list[Dict[str, Any]]:
        return [
          {
            "title": "Welcome Discount (Restaurant)",
            "category": "welcome",
            "body": "Hi {customer_name}! Welcome to {restaurant_name}. Enjoy 10% off your next dining visit!",
          },
          {
            "title": "Birthday Treat (Restaurant)",
            "category": "birthday",
            "body": "Happy Birthday {customer_name}! Celebrate with a complimentary dessert at {restaurant_name}.",
          },
          {
            "title": "We Miss You (Restaurant)",
            "category": "winback",
            "body": "Hi {customer_name}, we haven't seen you since {last_visit_date}! Enjoy 15% off your next meal at {restaurant_name}.",
          },
        ]
