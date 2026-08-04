from uuid import UUID
from typing import Dict, Any
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from app.core.automation.resolvers.base import IAutomationContextResolver
from app.models.customer import Customer
from app.models.visit import Visit
from app.models.user import User


class SalonContextResolver(IAutomationContextResolver):

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

        # Fetch last completed salon visit with services & staff
        last_visit = db.scalar(
            select(Visit)
            .options(selectinload(Visit.services))
            .where(Visit.customer_id == customer_id, Visit.business_id == business_id)
            .order_by(Visit.created_at.desc())
        )

        last_service_name = "Salon Service"
        if last_visit and last_visit.services:
            svc_item = last_visit.services[0]
            if hasattr(svc_item, "service") and svc_item.service:
                last_service_name = svc_item.service.name
            else:
                last_service_name = "Hair Care & Styling"

        stylist_name = "Stylist"
        if last_visit and last_visit.staff_id:
            staff_user = db.scalar(select(User).where(User.id == last_visit.staff_id))
            if staff_user and staff_user.name:
                stylist_name = staff_user.name

        last_visit_str = (
            last_visit.created_at.strftime("%d %b %Y")
            if last_visit and last_visit.created_at
            else (customer.last_visit_at.strftime("%d %b %Y") if customer.last_visit_at else "recently")
        )

        return {
            "customer_name": customer.name or "Valued Client",
            "customer_phone": customer.phone or "",
            "last_visit_date": last_visit_str,
            "total_visits": str(customer.visit_count or 0),
            "total_spent": f"₹{customer.total_spent or 0:.2f}",
            "loyalty_points": str(customer.loyalty_points or 0),
            "last_service_name": last_service_name,
            "stylist_name": stylist_name,
            "salon_name": "Salon & Spa",
            "rebook_link": "https://nextvisit.in/book",
        }

    def get_seed_templates(self) -> list[Dict[str, Any]]:
        return [
          {
            "title": "Welcome Greeting (Salon)",
            "category": "welcome",
            "body": "Hi {customer_name}! Welcome to {salon_name}. Enjoy 15% off your first hair & beauty appointment!",
          },
          {
            "title": "Birthday Glam Special (Salon)",
            "category": "birthday",
            "body": "Happy Birthday {customer_name}! Treat yourself to a complimentary facial or hair styling at {salon_name}.",
          },
          {
            "title": "Rebook Reminder (Salon)",
            "category": "winback",
            "body": "Hi {customer_name}, it's been a while since your last {last_service_name} at {salon_name}! Book your next appointment today: {rebook_link}",
          },
          {
            "title": "Post-Service Review Booster (Salon)",
            "category": "review",
            "body": "Thank you for visiting {salon_name}, {customer_name}! How was your service with {stylist_name}? Leave a review to earn 50 bonus loyalty points!",
          },
        ]
