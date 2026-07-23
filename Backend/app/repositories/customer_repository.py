from uuid import UUID

from sqlalchemy import select

from app.models.customer import Customer
from app.repositories.base_repository import BaseRepository


class CustomerRepository(BaseRepository):

    def get_all_by_business(self, business_id: UUID) -> list[Customer]:
        stmt = (
            select(Customer)
            .where(Customer.business_id == business_id)
            .order_by(Customer.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, customer_id: UUID) -> Customer | None:
        stmt = select(Customer).where(Customer.id == customer_id)
        return self.db.scalar(stmt)

    def get_by_phone(self, business_id: UUID, phone: str) -> Customer | None:
        stmt = select(Customer).where(
            Customer.business_id == business_id,
            Customer.phone == phone,
        )
        return self.db.scalar(stmt)

    def create(self, customer: Customer) -> Customer:
        self.db.add(customer)
        self.db.flush()
        self.db.refresh(customer)
        return customer

    def update(self, customer: Customer) -> Customer:
        self.db.flush()
        self.db.refresh(customer)
        return customer
