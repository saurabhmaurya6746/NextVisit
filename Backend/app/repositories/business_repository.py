from app.models.business import Business
from app.repositories.base_repository import BaseRepository


class BusinessRepository(BaseRepository):

    def create(self, business):
        self.db.add(business)
        self.db.flush()
        self.db.refresh(business)
        return business