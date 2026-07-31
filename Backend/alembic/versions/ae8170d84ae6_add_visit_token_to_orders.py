"""add_visit_token_to_orders

Revision ID: ae8170d84ae6
Revises: 0b1fe2e97458
Create Date: 2026-07-29 10:41:23.299549

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ae8170d84ae6'
down_revision: Union[str, Sequence[str], None] = '0b1fe2e97458'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('orders', sa.Column('visit_token', sa.String(length=100), nullable=True))
    op.create_index(op.f('ix_orders_visit_token'), 'orders', ['visit_token'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_orders_visit_token'), table_name='orders')
    op.drop_column('orders', 'visit_token')
