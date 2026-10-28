import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.sync_transaction import SyncTransaction


class SyncTransactionRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, tx: SyncTransaction) -> SyncTransaction:
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def get_by_client_tx_id(self, business_id: uuid.UUID, client_tx_id: uuid.UUID) -> SyncTransaction | None:
        stmt = select(SyncTransaction).where(
            SyncTransaction.business_id == business_id,
            SyncTransaction.client_tx_id == client_tx_id,
        )
        return self.db.scalar(stmt)

    def list_by_business(self, business_id: uuid.UUID, limit: int = 100) -> list[SyncTransaction]:
        stmt = (
            select(SyncTransaction)
            .where(SyncTransaction.business_id == business_id)
            .order_by(SyncTransaction.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())
