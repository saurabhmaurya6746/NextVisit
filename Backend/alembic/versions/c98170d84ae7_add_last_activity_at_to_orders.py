"""add_last_activity_at_to_orders

Revision ID: c98170d84ae7
Revises: ae8170d84ae6
Create Date: 2026-07-29 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c98170d84ae7'
down_revision: Union[str, Sequence[str], None] = 'ae8170d84ae6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('orders', sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('orders', 'last_activity_at')
